// pds-auftrag-nachtrag — Schreibt das verbaute Material einer Nachkalkulation
// als Nachtragsauftrag nach PDS.
//
// ADR 0006 und docs/pds-nachtragsauftrag.md. Kurzfassung: Die Vorgangs-API
// kann einen bestehenden Auftrag nicht um Positionen ergänzen, wohl aber einen
// Nachtrag anlegen (/vorgang/createnachtragsauftrag). Der ist in PDS ein
// eigener Vorgang mit der Nummer des Hauptauftrags plus "-N1"; der Hauptauftrag
// bleibt unverändert — am 04.09.2026 an Testauftrag 2026-314 nachgewiesen.
//
// Drei Aktionen, alle mit nachkalkulation_id:
//   vorschau       — baut die Ebene, sendet nichts. Standard.
//   uebertragen    — legt den Nachtrag an, genau einmal je Nachkalkulation.
//   zuruecksetzen  — vergisst den Nachtrag im Shop. Nur wenn er in PDS von Hand
//                    gelöscht wurde; sonst entsteht beim nächsten Mal -N2.
//
// Übertragen werden nur Positionen mit Shop-Artikel UND PDS-Katalog-UUID.
// Freitext und Artikel ohne Katalog-Sync bleiben im Shop; was in PDS steht,
// muss dort auch im Katalog existieren.
//
// Ein Nachtrag lässt sich per API nicht löschen. Deshalb: Vorschau zeigt exakt
// die Ebene, die entstehen wird, und das Frontend fragt vor dem Anlegen nach.

import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
}

// Positivliste. /vorgang/details nur, um vor dem Schreiben zu prüfen, dass der
// Auftrag existiert und selbst kein Nachtrag ist.
const ERLAUBTE_PFADE = new Set([
  "/vorgang/details",
  "/vorgang/createnachtragsauftrag",
])

const PFAD_NACHTRAG = "/vorgang/createnachtragsauftrag"

// Nachträge heißen "2026-298-N1". Auf einen Nachtrag darf kein weiterer.
const IST_NACHTRAG = /-N\d+$/

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
    // fail-closed. Diese Function schreibt in ein Kundenprojekt in PDS.
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
        pds_nachtrag_uuid, pds_nachtrag_nummer,
        shop_nachkalkulation_positionen (
          id, artikel_id, freitext, menge, einheit, ek_einzel, quelle,
          shop_artikel ( id, name, einheit, pds_katalog_uuid, preis_netto, aufschlagsklasse )
        )
      `)
      .eq("id", nkId)
      .single()

    if (nkErr || !nk) return json({ error: "Nachkalkulation nicht gefunden" }, 404)

    // ─── Zurücksetzen ──────────────────────────────────────────────────────
    if (aktion === "zuruecksetzen") {
      const { error } = await sb
        .from("shop_nachkalkulation")
        .update({
          pds_nachtrag_uuid: null,
          pds_nachtrag_nummer: null,
          pds_nachtrag_at: null,
          pds_nachtrag_positionen: null,
        })
        .eq("id", nkId)
      if (error) return json({ error: error.message }, 500)
      return json({
        status: "zurueckgesetzt",
        hinweis:
          `Der Shop kennt zu ${nk.pds_vorgangs_nummer} keinen Nachtrag mehr. Existiert ` +
          `${nk.pds_nachtrag_nummer ?? "der Nachtrag"} in PDS noch, entsteht beim nächsten ` +
          "Übertragen ein zweiter.",
      })
    }

    if (aktion !== "vorschau" && aktion !== "uebertragen") {
      return json({ error: 'aktion muss "vorschau", "uebertragen" oder "zuruecksetzen" sein' }, 400)
    }

    if (nk.pds_nachtrag_uuid) {
      return json({
        error:
          `Zu ${nk.pds_vorgangs_nummer} wurde bereits Nachtrag ${nk.pds_nachtrag_nummer} angelegt. ` +
          "Ein zweiter Aufruf würde -N2 erzeugen. Soll neu übertragen werden, den Nachtrag im " +
          "PDS-Client löschen und hier zurücksetzen.",
        nachtrag: { uuid: nk.pds_nachtrag_uuid, vorgangs_nummer: nk.pds_nachtrag_nummer },
      }, 409)
    }

    if (IST_NACHTRAG.test(String(nk.pds_vorgangs_nummer))) {
      return json({
        error: `${nk.pds_vorgangs_nummer} ist selbst ein Nachtrag. Der Nachtrag gehört an den Hauptauftrag.`,
      }, 400)
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

    // ─── Positionen sortieren: übertragbar oder nicht ──────────────────────
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
    }
    const jeKatalog = new Map<string, Uebertragbar>()
    const nichtUebertragbar: Array<{ name: string; menge: number; grund: string }> = []

    for (const p of (nk.shop_nachkalkulation_positionen ?? []) as NkPosition[]) {
      const menge = Number(p.menge)
      const a = p.shop_artikel
      const name = a?.name ?? p.freitext ?? "(ohne Bezeichnung)"

      if (!a) {
        nichtUebertragbar.push({ name, menge, grund: "Freitext ohne Shop-Artikel — zuerst als Artikel anlegen" })
        continue
      }
      if (!a.pds_katalog_uuid) {
        nichtUebertragbar.push({ name, menge, grund: "Artikel noch nicht in PDS — zuerst unter „Nach PDS übertragen" anlegen" })
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
      } else {
        jeKatalog.set(a.pds_katalog_uuid, {
          katalog_uuid: a.pds_katalog_uuid,
          name: a.name,
          einheit: p.einheit ?? a.einheit ?? null,
          menge,
          ek_einzel: runde(ek),
          vk_einzel: vk,
          aufschlag_prozent: aufschlag,
        })
      }
    }

    const uebertragbar = [...jeKatalog.values()]
    const ebeneBezeichnung = `Verbautes Material — Bestellshop ${heuteDe()}`

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
      uuid: nk.pds_vorgang_uuid,
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
    }

    const vorschau = {
      ebene: {
        bezeichnung: ebeneBezeichnung,
        positionen: uebertragbar.map((p) => ({
          ...p,
          ek_gesamt: runde(p.ek_einzel * p.menge),
          vk_gesamt: p.vk_einzel != null ? runde(p.vk_einzel * p.menge) : null,
        })),
      },
      nicht_uebertragbar: nichtUebertragbar,
      summen: { ek: summeEk, vk: summeVk },
    }

    if (aktion === "vorschau") {
      return json({
        status: "vorschau",
        ...vorschau,
        hinweis: uebertragbar.length === 0
          ? "Keine übertragbare Position. Übertragen werden nur Shop-Artikel, die bereits in PDS angelegt sind."
          : `${uebertragbar.length} Position(en) gehen als Nachtrag zu ${nk.pds_vorgangs_nummer}. ` +
            "PDS kopiert zusätzlich alle Positionen des Hauptauftrags mit Menge 0 in den Nachtrag — " +
            "das ist die Differenzdarstellung von PDS und im Client zu bereinigen." +
            (nichtUebertragbar.length > 0
              ? ` ${nichtUebertragbar.length} Position(en) bleiben im Shop.`
              : ""),
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

    // Vor dem Schreiben: Existiert der Auftrag noch, und ist er wirklich der
    // Hauptauftrag? Die Nummer im Shop kann veraltet sein.
    const det = await pdsRoh("/vorgang/details", { uuid: nk.pds_vorgang_uuid, vorgangstyp: "AUFTRAG" })
    if (!det.ok || !det.daten?.uuid) {
      return json({ error: `Auftrag ${nk.pds_vorgangs_nummer} ist in PDS nicht mehr auffindbar (${det.status}).` }, 404)
    }
    if (IST_NACHTRAG.test(String(det.daten.vorgangsNummer ?? ""))) {
      return json({ error: `${det.daten.vorgangsNummer} ist in PDS ein Nachtrag — kein Nachtrag auf einen Nachtrag.` }, 400)
    }

    const antwort = await pdsRoh(PFAD_NACHTRAG, anfrage)

    // Protokoll wie beim Katalog-Sync, nur ohne Artikelbezug — der Nachtrag
    // gehört zur Nachkalkulation, nicht zu einem Artikel.
    await sb.from("shop_pds_sync_log").insert({
      artikel_id: null,
      operation: PFAD_NACHTRAG,
      dry_run: false,
      request: { nachkalkulation_id: nkId, ...anfrage },
      response: antwort.daten ?? { text: antwort.text.slice(0, 2000) },
      http_status: antwort.status,
      erfolg: antwort.ok,
      fehler: antwort.ok ? null : antwort.text.slice(0, 500),
      created_by: userData.user.id,
    })

    if (!antwort.ok) {
      return json({ error: `PDS ${antwort.status} @ ${PFAD_NACHTRAG}: ${antwort.text.slice(0, 500)}` }, 502)
    }

    const nachtragUUID = String(antwort.daten?.uuid ?? "")
    const nachtragNummer = String(antwort.daten?.vorgangsNummer ?? "")

    // Sofort festhalten — ab hier existiert der Nachtrag in PDS, und ein
    // zweiter Klick darf keinen zweiten anlegen.
    const { error: updErr } = await sb
      .from("shop_nachkalkulation")
      .update({
        pds_nachtrag_uuid: nachtragUUID || null,
        pds_nachtrag_nummer: nachtragNummer || null,
        pds_nachtrag_at: new Date().toISOString(),
        pds_nachtrag_positionen: uebertragbar.length,
        ...(nk.status === "offen" ? { status: "erfasst" } : {}),
      })
      .eq("id", nkId)

    return json({
      status: "uebertragen",
      nachtrag: {
        uuid: nachtragUUID,
        vorgangs_nummer: nachtragNummer,
        positionen: uebertragbar.length,
        ek_summe: summeEk,
        vk_summe: summeVk,
      },
      ...vorschau,
      anleitung:
        `Nachtrag ${nachtragNummer} im PDS-Client öffnen. Die Ebene „${ebeneBezeichnung}" enthält ` +
        "das verbaute Material. Die von PDS eingefügten Positionen mit Menge 0 sind die Differenz " +
        "zum Hauptauftrag — streichen oder stehen lassen, je nach Kundendokument. Preise für den " +
        "Kunden dort anpassen.",
      warnung: updErr
        ? `Der Nachtrag ${nachtragNummer} steht in PDS, konnte im Shop aber nicht vermerkt werden: ${updErr.message}. ` +
          "Nicht erneut übertragen."
        : undefined,
    })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502)
  }
})
