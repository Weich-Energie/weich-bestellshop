// pds-auftrag-transport — Schreibt das verbaute Material einer Nachkalkulation
// als Transportangebot nach PDS, aus dem der Client in den Kundenauftrag kopiert.
//
// ADR 0006 (Fassung 2) und docs/pds-nachtragsauftrag.md. Kurzfassung: Die
// Vorgangs-API kann in einen bestehenden Auftrag keine Positionen einfügen —
// updateposition braucht vorhandene Positions-UUIDs, updatevorgang ändert nur
// den Kopf. Der Betrieb kopiert deshalb im PDS-Client aus einem Musterangebot
// in den Auftrag. Diese Function liefert dieses Musterangebot je Auftrag: ein
// Angebot bei der Weich GmbH (nie beim Kunden), eine Ebene, genau die
// verbauten Positionen mit Menge, EK und VK. Nach dem Kopieren wird das Angebot
// im Client gelöscht.
//
// Drei Aktionen, alle mit nachkalkulation_id:
//   vorschau       — baut die Ebene aus den noch nicht übertragenen Positionen,
//                    sendet nichts. Standard.
//   uebertragen    — legt das Transportangebot an und markiert die Positionen
//                    als übertragen. Ein zweiter Aufruf nimmt nur Neues mit.
//   zuruecksetzen  — hebt die Markierung aller Positionen auf. Für den Fall,
//                    dass das Angebot gelöscht wurde, ohne zu kopieren.
//
// Übertragen werden nur Positionen mit Shop-Artikel UND PDS-Katalog-UUID.
// Was in PDS steht, muss dort auch im Katalog existieren.

import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
}

// Positivliste. /vorgang/details nur, um vor dem Schreiben zu prüfen, dass der
// Zielauftrag noch existiert — die Bezeichnung des Transports nennt ihn.
const ERLAUBTE_PFADE = new Set([
  "/vorgang/details",
  "/vorgang/create",
])

const PFAD_CREATE = "/vorgang/create"

// Die Weich GmbH ist in PDS auch als Kunde angelegt (Kundennummer 10039). Das
// Transportangebot hängt an ihr, nicht am Kunden — wie das Musterangebot für
// den Katalog-VK in pds-katalog-sync.
const EIGENE_FIRMA_ALS_KUNDE = "6139e897-1a04-48fa-bdd5-b9ac2e47ebd2"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

function runde(n: number) {
  return Math.round(n * 100) / 100
}

// VK = EK × (1 + Aufschlag) — Markup, nicht Handelsspanne, wie im Klimarechner
// und in pds-katalog-sync.
function berechneVk(ek: number, aufschlagProzent: number): number {
  return runde(ek * (1 + aufschlagProzent / 100))
}

function heuteDe() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

type Artikel = {
  id: string
  name: string
  einheit: string | null
  pds_katalog_uuid: string | null
  preis_netto: number | string | null
  aufschlagsklasse: string | null
}

type NkPosition = {
  id: string
  artikel_id: string | null
  freitext: string | null
  menge: number | string
  einheit: string | null
  ek_einzel: number | string | null
  quelle: string
  pds_transport_at: string | null
  shop_artikel: Artikel | null
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405)

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  )

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nicht autorisiert" }, 401)

    const { data: userData, error: authErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""))
    if (authErr || !userData?.user?.email) return json({ error: "Ungueltige Session" }, 401)

    // service_role umgeht RLS — die Berechtigung wird hier selbst geprüft,
    // fail-closed. Diese Function legt Vorgänge in PDS an.
    const { data: profil } = await sb
      .from("employees")
      .select("berechtigungen")
      .eq("email", userData.user.email)
      .single()

    const rechte = (profil?.berechtigungen ?? {}) as Record<string, any>
    const istAdmin = rechte?.app_access?.bestellshop_admin === true || rechte?.rolle === "admin"
    if (!istAdmin) return json({ error: "Nur Shop-Admins duerfen nach PDS uebertragen" }, 403)

    const body = await req.json().catch(() => ({}))
    const aktion = String(body?.aktion ?? "vorschau").trim()
    const nkId = String(body?.nachkalkulation_id ?? "").trim()
    if (!nkId) return json({ error: "nachkalkulation_id fehlt" }, 400)

    // ─── Nachkalkulation mit Positionen und Artikeln ───────────────────────
    const { data: nk, error: nkErr } = await sb
      .from("shop_nachkalkulation")
      .select(`
        id, pds_vorgang_uuid, pds_vorgangs_nummer, bezeichnung, status,
        pds_transport_uuid, pds_transport_nummer,
        shop_nachkalkulation_positionen (
          id, artikel_id, freitext, menge, einheit, ek_einzel, quelle, pds_transport_at,
          shop_artikel ( id, name, einheit, pds_katalog_uuid, preis_netto, aufschlagsklasse )
        )
      `)
      .eq("id", nkId)
      .single()

    if (nkErr || !nk) return json({ error: "Nachkalkulation nicht gefunden" }, 404)

    // ─── Zurücksetzen ──────────────────────────────────────────────────────
    if (aktion === "zuruecksetzen") {
      const { error: e1 } = await sb
        .from("shop_nachkalkulation_positionen")
        .update({ pds_transport_at: null })
        .eq("nachkalkulation_id", nkId)
      if (e1) return json({ error: e1.message }, 500)
      const { error: e2 } = await sb
        .from("shop_nachkalkulation")
        .update({
          pds_transport_uuid: null,
          pds_transport_nummer: null,
          pds_transport_at: null,
          pds_transport_positionen: null,
        })
        .eq("id", nkId)
      if (e2) return json({ error: e2.message }, 500)
      return json({
        status: "zurueckgesetzt",
        hinweis:
          `Alle Positionen zu ${nk.pds_vorgangs_nummer} gelten wieder als nicht übertragen. ` +
          "Der nächste Transport nimmt sie alle mit.",
      })
    }

    if (aktion !== "vorschau" && aktion !== "uebertragen") {
      return json({ error: 'aktion muss "vorschau", "uebertragen" oder "zuruecksetzen" sein' }, 400)
    }

    // ─── Aufschlagsklassen ─────────────────────────────────────────────────
    const { data: kalkRows } = await sb
      .from("shop_pds_kalkulationsgruppen")
      .select("klasse, aufschlag_prozent")
    const aufschlagJeKlasse = new Map<string, number>(
      (kalkRows ?? []).map((k: { klasse: string; aufschlag_prozent: number | string }) => [
        k.klasse,
        Number(k.aufschlag_prozent),
      ]),
    )

    // ─── Positionen sortieren: übertragbar, schon übertragen, nicht möglich ─
    // Gleiche Artikel werden zusammengezogen — zwei Monteurzettel mit je 10 m
    // Kabelkanal sind in PDS eine Position mit 20 m.
    type Uebertragbar = {
      katalog_uuid: string
      name: string
      einheit: string | null
      menge: number
      ek_einzel: number
      vk_einzel: number | null
      aufschlag_prozent: number | null
      positions_ids: string[]
    }
    const jeKatalog = new Map<string, Uebertragbar>()
    const nichtUebertragbar: Array<{ name: string; menge: number; grund: string }> = []
    let bereitsUebertragen = 0

    for (const p of (nk.shop_nachkalkulation_positionen ?? []) as NkPosition[]) {
      const menge = Number(p.menge)
      const a = p.shop_artikel
      const name = a?.name ?? p.freitext ?? "(ohne Bezeichnung)"

      if (p.pds_transport_at) {
        bereitsUebertragen++
        continue
      }
      if (!a) {
        nichtUebertragbar.push({ name, menge, grund: "Freitext ohne Shop-Artikel — zuerst als Artikel anlegen" })
        continue
      }
      if (!a.pds_katalog_uuid) {
        nichtUebertragbar.push({ name, menge, grund: "Artikel noch nicht in PDS — zuerst unter „Nach PDS übertragen“ anlegen" })
        continue
      }
      if (!(menge > 0)) {
        nichtUebertragbar.push({ name, menge, grund: "Menge 0" })
        continue
      }

      // EK: der beim Erfassen kopierte Wert, sonst der aktuelle Artikelpreis.
      const ek = p.ek_einzel != null
        ? Number(p.ek_einzel)
        : (a.preis_netto != null ? Number(a.preis_netto) : 0)

      const aufschlag = a.aufschlagsklasse ? aufschlagJeKlasse.get(a.aufschlagsklasse) ?? null : null
      // Ohne Aufschlagsklasse bekommt PDS keinen VK mitgegeben und zieht ihn aus
      // dem Katalog — der steht dort seit der Musterangebot-Übernahme.
      const vk = aufschlag != null && ek > 0 ? berechneVk(ek, aufschlag) : null

      const vorhanden = jeKatalog.get(a.pds_katalog_uuid)
      if (vorhanden) {
        vorhanden.menge = runde(vorhanden.menge + menge)
        vorhanden.positions_ids.push(p.id)
      } else {
        jeKatalog.set(a.pds_katalog_uuid, {
          katalog_uuid: a.pds_katalog_uuid,
          name: a.name,
          einheit: p.einheit ?? a.einheit ?? null,
          menge,
          ek_einzel: runde(ek),
          vk_einzel: vk,
          aufschlag_prozent: aufschlag,
          positions_ids: [p.id],
        })
      }
    }

    const uebertragbar = [...jeKatalog.values()]
    const ebeneBezeichnung = `Verbautes Material fuer ${nk.pds_vorgangs_nummer} — Bestellshop ${heuteDe()}`
    const angebotBezeichnung =
      `ZZ-TRANSPORT verbautes Material fuer Auftrag ${nk.pds_vorgangs_nummer} — nach Kopieren loeschen`

    const summeEk = runde(uebertragbar.reduce((s, p) => s + p.ek_einzel * p.menge, 0))
    const alleMitVk = uebertragbar.every((p) => p.vk_einzel != null)
    const summeVk = alleMitVk
      ? runde(uebertragbar.reduce((s, p) => s + (p.vk_einzel ?? 0) * p.menge, 0))
      : null

    const pdsPositionen = uebertragbar.map((p) => ({
      positionsTyp: "ARTIKEL",
      positionsArt: "NORMAL",
      katalogUUID: p.katalog_uuid,
      menge: p.menge,
      ekPreis: { einzelPreis: p.ek_einzel },
      // vkFix nur, wenn wir den VK auch wirklich setzen. Sonst rechnet PDS aus
      // dem Katalog.
      ...(p.vk_einzel != null ? { vkPreis: { einzelPreis: p.vk_einzel }, vkFix: true } : {}),
    }))

    const anfrage = {
      context: { vorgangstyp: "ANGEBOT" },
      vorgangsdaten: {
        personUUID: EIGENE_FIRMA_ALS_KUNDE,
        bezeichnung: angebotBezeichnung,
        selektionskriterien: [{ bezeichnung: "Gewerk", wert: "SHK" }],
        rootEbene: {
          bezeichnung: "Leistungsverzeichnis",
          ebenen: [
            {
              bezeichnung: ebeneBezeichnung,
              ebeneArt: "NORMAL",
              positionen: pdsPositionen,
            },
          ],
        },
      },
    }

    const vorschau = {
      angebot_bezeichnung: angebotBezeichnung,
      ebene: {
        bezeichnung: ebeneBezeichnung,
        positionen: uebertragbar.map(({ positions_ids: _ids, ...p }) => ({
          ...p,
          ek_gesamt: runde(p.ek_einzel * p.menge),
          vk_gesamt: p.vk_einzel != null ? runde(p.vk_einzel * p.menge) : null,
        })),
      },
      nicht_uebertragbar: nichtUebertragbar,
      bereits_uebertragen: bereitsUebertragen,
      summen: { ek: summeEk, vk: summeVk },
    }

    if (aktion === "vorschau") {
      return json({
        status: "vorschau",
        ...vorschau,
        hinweis: uebertragbar.length === 0
          ? (bereitsUebertragen > 0
              ? `Alle ${bereitsUebertragen} Position(en) sind bereits übertragen. Neues Material zuerst erfassen.`
              : "Keine übertragbare Position. Übertragen werden nur Shop-Artikel, die bereits in PDS angelegt sind.")
          : `${uebertragbar.length} Position(en) gehen in ein Transportangebot bei der Weich GmbH. ` +
            `Im PDS-Client die Ebene in Auftrag ${nk.pds_vorgangs_nummer} kopieren, dann das Angebot löschen.` +
            (bereitsUebertragen > 0 ? ` ${bereitsUebertragen} Position(en) waren schon übertragen und bleiben aussen vor.` : "") +
            (nichtUebertragbar.length > 0 ? ` ${nichtUebertragbar.length} Position(en) bleiben im Shop.` : ""),
      })
    }

    // ─── Übertragen ────────────────────────────────────────────────────────
    if (uebertragbar.length === 0) {
      return json({ error: "Keine übertragbare Position — nichts anzulegen.", ...vorschau }, 400)
    }

    const { data: secret } = await sb
      .from("integration_secrets")
      .select("value")
      .eq("key", "pds")
      .maybeSingle()

    const cfg = secret?.value as { api_key?: string; base_url?: string } | undefined
    if (!cfg?.api_key || !cfg?.base_url) return json({ error: "Keine PDS-Zugangsdaten hinterlegt" }, 503)

    const basis = cfg.base_url.replace(/\/$/, "")
    async function pdsRoh(pfad: string, rumpf: unknown): Promise<{ ok: boolean; status: number; daten: any; text: string }> {
      if (!ERLAUBTE_PFADE.has(pfad)) throw new Error(`Pfad ${pfad} ist nicht freigegeben`)
      const r = await fetch(basis + pfad, {
        method: "POST",
        headers: {
          "authorization": "Bearer " + cfg!.api_key!.trim(),
          "content-type": "application/json",
          "accept": "application/json",
        },
        body: JSON.stringify(rumpf),
      })
      const text = await r.text()
      let daten: any = null
      try { daten = text ? JSON.parse(text) : null } catch { daten = null }
      return { ok: r.ok, status: r.status, daten, text }
    }

    // Vor dem Schreiben: Existiert der Zielauftrag noch? Das Angebot nennt ihn
    // in der Bezeichnung, und ein Transport ins Leere hilft niemandem.
    const det = await pdsRoh("/vorgang/details", { uuid: nk.pds_vorgang_uuid, vorgangstyp: "AUFTRAG" })
    if (!det.ok || !det.daten?.uuid) {
      return json({ error: `Auftrag ${nk.pds_vorgangs_nummer} ist in PDS nicht mehr auffindbar (${det.status}).` }, 404)
    }

    const antwort = await pdsRoh(PFAD_CREATE, anfrage)

    // Protokoll wie beim Katalog-Sync, ohne Artikelbezug — der Transport gehört
    // zur Nachkalkulation, nicht zu einem Artikel.
    await sb.from("shop_pds_sync_log").insert({
      artikel_id: null,
      operation: PFAD_CREATE,
      dry_run: false,
      request: { nachkalkulation_id: nkId, zweck: "transportangebot", ...anfrage },
      response: antwort.daten ?? { text: antwort.text.slice(0, 2000) },
      http_status: antwort.status,
      erfolg: antwort.ok,
      fehler: antwort.ok ? null : antwort.text.slice(0, 500),
      created_by: userData.user.id,
    })

    if (!antwort.ok) {
      return json({ error: `PDS ${antwort.status} @ ${PFAD_CREATE}: ${antwort.text.slice(0, 500)}` }, 502)
    }

    const angebotUUID = String(antwort.daten?.uuid ?? "")
    const angebotNummer = String(antwort.daten?.vorgangsNummer ?? "")
    const jetzt = new Date().toISOString()

    // Sofort festhalten — ab hier steht das Angebot in PDS, und die Positionen
    // dürfen beim nächsten Transport nicht noch einmal mit.
    const alleIds = uebertragbar.flatMap((p) => p.positions_ids)
    const { error: posErr } = await sb
      .from("shop_nachkalkulation_positionen")
      .update({ pds_transport_at: jetzt })
      .in("id", alleIds)

    const { error: updErr } = await sb
      .from("shop_nachkalkulation")
      .update({
        pds_transport_uuid: angebotUUID || null,
        pds_transport_nummer: angebotNummer || null,
        pds_transport_at: jetzt,
        pds_transport_positionen: uebertragbar.length,
        ...(nk.status === "offen" ? { status: "erfasst" } : {}),
      })
      .eq("id", nkId)

    const fehlerBeimMerken = posErr?.message ?? updErr?.message ?? null

    return json({
      status: "uebertragen",
      angebot: {
        uuid: angebotUUID,
        vorgangs_nummer: angebotNummer,
        positionen: uebertragbar.length,
        ek_summe: summeEk,
        vk_summe: summeVk,
      },
      ...vorschau,
      anleitung:
        `Angebot ${angebotNummer} im PDS-Client öffnen (Kunde Weich GmbH). Die Ebene ` +
        `„${ebeneBezeichnung}“ in Auftrag ${nk.pds_vorgangs_nummer} kopieren, dort Preise für den ` +
        "Kunden anpassen, danach das Transportangebot löschen.",
      warnung: fehlerBeimMerken
        ? `Angebot ${angebotNummer} steht in PDS, konnte im Shop aber nicht vermerkt werden: ${fehlerBeimMerken}. ` +
          "Nicht erneut übertragen, sonst entsteht ein zweites Angebot mit denselben Positionen."
        : undefined,
    })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502)
  }
})
