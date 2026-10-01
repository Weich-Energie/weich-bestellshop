// pds-auftrag-material — Bringt das verbaute Material einer Nachkalkulation in
// den PDS-Auftrag.
//
// ADR 0007 und docs/pds-montagematerial-platzhalter.md. Die Vorgangs-API kann
// an einen bestehenden Auftrag keine Positionen anhängen, aber die Menge
// vorhandener Positionen ändern. Neue Klima-Aufträge tragen deshalb eine Ebene
// "Montagematerial (Nachkalkulation)" mit Platzhaltern (Menge 0). Diese
// Function setzt dort die Mengen. Für Material ohne Platzhalter — und für alle
// älteren Aufträge — bleibt das Transportangebot (ADR 0006): ein Angebot bei
// der Weich GmbH, aus dem im Client in den Auftrag kopiert wird.
//
// Aktionen, alle mit nachkalkulation_id:
//   vorschau          — teilt die offenen Positionen in "Menge setzen" und
//                       "Transport" und zeigt beides. Sendet nichts. Standard.
//   mengen_setzen     — updateposition für alle Positionen mit Platzhalter.
//   transport_anlegen — Angebot für die Positionen ohne Platzhalter.
//   zuruecksetzen     — hebt die Markierung "übertragen" aller Positionen auf.
//
// Eine Position gilt als übertragen (pds_transport_at), sobald ihre Menge im
// Auftrag steht oder sie in einem Transportangebot liegt.
//
// Seit dem 30.09.2026 ist das ein REGIEAUFMASS, kein Rechenwerkzeug (Patrick:
// „weniger als kalkulations ding selbst sehen sondern als regie aufmaß, welches
// wir in den auftrag von pds ergänzen müssen"). Daraus folgen zwei Dinge:
//   - Freitext und Artikel ohne PDS-Eintrag gehen trotzdem mit, als freie
//     Position im Transportangebot. /vorgang/create verlangt kein katalogUUID
//     (ADR 0008); nur der Platzhalter-Weg braucht eines. Was verbaut wurde,
//     muss in den Auftrag — ein fehlender Katalogeintrag ist ein
//     Stammdatenthema und darf die Abrechnung nicht aufhalten.
//   - Die Ist-Stunden gehen als LOHN-Positionen mit, eine je Rolle, einmal
//     (Merker stunden_transport_at).

import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
}

// Positivliste. updateposition ändert ausschliesslich die Menge von Positionen,
// deren Katalog-UUID zu einem Shop-Artikel gehört — nie Preise, nie Texte,
// nie Positionen ohne Shop-Bezug.
const ERLAUBTE_PFADE = new Set([
  "/vorgang/details",
  "/vorgang/updateposition",
  "/vorgang/create",
])

// Die Weich GmbH ist in PDS auch als Kunde angelegt (Kundennummer 10039). Das
// Transportangebot hängt an ihr, nicht am Kunden.
const EIGENE_FIRMA_ALS_KUNDE = "6139e897-1a04-48fa-bdd5-b9ac2e47ebd2"

// Regiearbeit als Katalogartikel: EK 45, VK 69, Einheit Std, mit eigenem
// Langtext im Katalog. Patrick, 30.09.2026 - spaeter werden daraus vielleicht
// mehrere Artikel je Qualifikation, heute laeuft alles hierueber.
const ARB_REG_UUID = "05e63c9d-b8d9-44ef-8915-8f0626955c08"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

function runde(n: number) {
  return Math.round(n * 100) / 100
}

// VK = EK × (1 + Aufschlag) — Markup, nicht Handelsspanne, wie im Klimarechner.
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

type PdsPosition = {
  uuid?: string
  nummer?: string
  kurztext?: string
  menge?: number
  katalogUUID?: string | null
  masseinheit?: { bezeichnung?: string } | null
  ekPreis?: { einzelPreis?: number } | null
  vkPreis?: { einzelPreis?: number } | null
}
type PdsEbene = { bezeichnung?: string; positionen?: PdsPosition[]; ebenen?: PdsEbene[] }

function sammle(e: PdsEbene, raus: Array<PdsPosition & { ebene: string }>, ebene = "") {
  for (const p of e.positionen ?? []) raus.push({ ...p, ebene })
  for (const kind of e.ebenen ?? []) sammle(kind, raus, kind.bezeichnung ?? ebene)
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
    // fail-closed. Diese Function schreibt in Kundenaufträge.
    const { data: profil } = await sb
      .from("employees")
      .select("berechtigungen")
      .eq("email", userData.user.email)
      .single()

    const rechte = (profil?.berechtigungen ?? {}) as Record<string, any>
    const istAdmin = rechte?.rolle === "admin"
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
        ist_stunden_techniker, ist_stunden_monteur,
        stundensatz_techniker, stundensatz_monteur, stunden_transport_at, stunden_quelle,
        anfahrt_zone, anfahrt_fahrten, anfahrt_satz, baustelle_adresse,
        pauschalen, geruest, geruest_betrag, nebenkosten_transport_at,
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
          stunden_transport_at: null,
          nebenkosten_transport_at: null,
        })
        .eq("id", nkId)
      if (e2) return json({ error: e2.message }, 500)
      return json({
        status: "zurueckgesetzt",
        hinweis:
          `Alle Positionen zu ${nk.pds_vorgangs_nummer} gelten wieder als nicht übertragen. ` +
          "Achtung: Mengen, die schon im Auftrag stehen, würden beim nächsten Setzen noch einmal addiert.",
      })
    }

    const bekannt = new Set(["vorschau", "mengen_setzen", "transport_anlegen"])
    if (!bekannt.has(aktion)) {
      return json({ error: 'aktion muss "vorschau", "mengen_setzen", "transport_anlegen" oder "zuruecksetzen" sein' }, 400)
    }

    // ─── PDS-Zugang und Auftrag lesen ──────────────────────────────────────
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

    const det = await pdsRoh("/vorgang/details", { uuid: nk.pds_vorgang_uuid, vorgangstyp: "AUFTRAG" })
    if (!det.ok || !det.daten?.uuid) {
      return json({ error: `Auftrag ${nk.pds_vorgangs_nummer} ist in PDS nicht mehr auffindbar (${det.status}).` }, 404)
    }

    const pdsPositionen: Array<PdsPosition & { ebene: string }> = []
    sammle((det.daten.rootEbene ?? {}) as PdsEbene, pdsPositionen, det.daten.rootEbene?.bezeichnung ?? "")

    // Platzhalter im Auftrag: alle Positionen mit Katalogbezug. Gibt es denselben
    // Artikel mehrfach, gewinnt die erste Position der Ebene "Montagematerial",
    // sonst die erste überhaupt — eine Gerätezeile soll nie versehentlich zum
    // Platzhalter werden, deshalb zählt nur, was im Shop als Artikel existiert.
    const platzhalterJeKatalog = new Map<string, PdsPosition & { ebene: string }>()
    const sortiert = [...pdsPositionen].sort((a, b) => {
      const am = /montagematerial/i.test(a.ebene) ? 0 : 1
      const bm = /montagematerial/i.test(b.ebene) ? 0 : 1
      return am - bm
    })
    for (const p of sortiert) {
      if (p.katalogUUID && p.uuid && !platzhalterJeKatalog.has(p.katalogUUID)) {
        platzhalterJeKatalog.set(p.katalogUUID, p)
      }
    }

    // ─── Aufschlagsklassen (nur für den Transportweg) ──────────────────────
    const { data: kalkRows } = await sb
      .from("shop_pds_kalkulationsgruppen")
      .select("klasse, aufschlag_prozent")
    const aufschlagJeKlasse = new Map<string, number>(
      (kalkRows ?? []).map((k: { klasse: string; aufschlag_prozent: number | string }) => [
        k.klasse,
        Number(k.aufschlag_prozent),
      ]),
    )

    // ─── Offene Positionen sortieren ───────────────────────────────────────
    type MengenZiel = {
      position_uuid: string
      nummer: string | null
      ebene: string
      katalog_uuid: string
      name: string
      einheit: string | null
      menge_aktuell: number
      menge_plus: number
      menge_neu: number
      positions_ids: string[]
    }
    type TransportZiel = {
      // Null heisst: freie Position ohne Katalogbezug. /vorgang/create verlangt
      // kein katalogUUID (ADR 0008) — nur updateposition braucht eines, weil es
      // eine vorhandene Position trifft. Beim Regieaufmass zaehlt aber, dass
      // alles Verbaute in den Auftrag kommt, auch was im Katalog fehlt.
      katalog_uuid: string | null
      name: string
      einheit: string | null
      menge: number
      ek_einzel: number
      vk_einzel: number | null
      aufschlag_prozent: number | null
      positions_ids: string[]
    }

    const mengenJeKatalog = new Map<string, MengenZiel>()
    const transportJeKatalog = new Map<string, TransportZiel>()
    const nichtUebertragbar: Array<{ name: string; menge: number; grund: string }> = []
    let bereitsUebertragen = 0

    for (const p of (nk.shop_nachkalkulation_positionen ?? []) as NkPosition[]) {
      const menge = Number(p.menge)
      const a = p.shop_artikel
      const name = a?.name ?? p.freitext ?? "(ohne Bezeichnung)"

      if (p.pds_transport_at) { bereitsUebertragen++; continue }
      if (!(menge > 0)) {
        nichtUebertragbar.push({ name, menge, grund: "Menge 0" })
        continue
      }

      // Freitext und Artikel ohne PDS-Eintrag gehen als freie Position ins
      // Transportangebot. Frueher fielen sie hier heraus — beim Regieaufmass
      // waere das falsch: was verbaut wurde, muss in den Auftrag, sonst wird es
      // nicht abgerechnet. Der fehlende Katalogeintrag ist ein Stammdatenthema
      // und darf die Abrechnung nicht aufhalten.
      const katalogUuid = a?.pds_katalog_uuid ?? null
      const platz = katalogUuid ? platzhalterJeKatalog.get(katalogUuid) : undefined
      if (platz && katalogUuid && a) {
        const z = mengenJeKatalog.get(katalogUuid)
        if (z) {
          z.menge_plus = runde(z.menge_plus + menge)
          z.menge_neu = runde(z.menge_aktuell + z.menge_plus)
          z.positions_ids.push(p.id)
        } else {
          const aktuell = Number(platz.menge ?? 0)
          mengenJeKatalog.set(katalogUuid, {
            position_uuid: platz.uuid!,
            nummer: platz.nummer ?? null,
            ebene: platz.ebene,
            katalog_uuid: katalogUuid,
            name: platz.kurztext ?? a.name,
            einheit: platz.masseinheit?.bezeichnung ?? p.einheit ?? a.einheit ?? null,
            menge_aktuell: aktuell,
            menge_plus: menge,
            menge_neu: runde(aktuell + menge),
            positions_ids: [p.id],
          })
        }
        continue
      }

      // Kein Platzhalter im Auftrag → Transportangebot.
      const ek = p.ek_einzel != null
        ? Number(p.ek_einzel)
        : (a?.preis_netto != null ? Number(a.preis_netto) : 0)
      const aufschlag = a?.aufschlagsklasse ? aufschlagJeKlasse.get(a.aufschlagsklasse) ?? null : null
      const vk = aufschlag != null && ek > 0 ? berechneVk(ek, aufschlag) : null
      // Freie Positionen haben keine UUID zum Zusammenfassen — der Name tut es,
      // damit zweimal dasselbe Freitext-Teil nicht zwei Zeilen ergibt.
      const schluessel = katalogUuid ?? `frei:${name.toLowerCase().trim()}`
      const t = transportJeKatalog.get(schluessel)
      if (t) {
        t.menge = runde(t.menge + menge)
        t.positions_ids.push(p.id)
      } else {
        transportJeKatalog.set(schluessel, {
          katalog_uuid: katalogUuid,
          name: a?.name ?? name,
          einheit: p.einheit ?? a?.einheit ?? null,
          menge,
          ek_einzel: runde(ek),
          vk_einzel: vk,
          aufschlag_prozent: aufschlag,
          positions_ids: [p.id],
        })
      }
    }

    const mengen = [...mengenJeKatalog.values()]
    const transport = [...transportJeKatalog.values()]
    const hatPlatzhalterEbene = pdsPositionen.some((p) => /montagematerial/i.test(p.ebene))

    const ebeneBezeichnung = `Verbautes Material fuer ${nk.pds_vorgangs_nummer} — Bestellshop ${heuteDe()}`
    const angebotBezeichnung =
      `ZZ-TRANSPORT verbautes Material fuer Auftrag ${nk.pds_vorgangs_nummer} — nach Kopieren loeschen`

    const transportEk = runde(transport.reduce((s, p) => s + p.ek_einzel * p.menge, 0))
    const transportVk = transport.every((p) => p.vk_einzel != null)
      ? runde(transport.reduce((s, p) => s + (p.vk_einzel ?? 0) * p.menge, 0))
      : null

    const vorschau = {
      auftrag: {
        vorgangs_nummer: det.daten.vorgangsNummer ?? nk.pds_vorgangs_nummer,
        hat_platzhalter_ebene: hatPlatzhalterEbene,
        platzhalter: platzhalterJeKatalog.size,
      },
      mengen: mengen.map(({ positions_ids: _i, ...m }) => m),
      transport: {
        angebot_bezeichnung: angebotBezeichnung,
        ebene: {
          bezeichnung: ebeneBezeichnung,
          positionen: transport.map(({ positions_ids: _i, ...p }) => ({
            ...p,
            ek_gesamt: runde(p.ek_einzel * p.menge),
            vk_gesamt: p.vk_einzel != null ? runde(p.vk_einzel * p.menge) : null,
          })),
        },
        summen: { ek: transportEk, vk: transportVk },
      },
      nicht_uebertragbar: nichtUebertragbar,
      bereits_uebertragen: bereitsUebertragen,
      // Beim Regieaufmass gehoeren die Stunden dazu. Sie stehen hier, damit vor
      // dem Anlegen sichtbar ist, was mitgeht — und ob sie schon drin sind.
      stunden: {
        techniker: Number(nk.ist_stunden_techniker ?? 0),
        monteur: Number(nk.ist_stunden_monteur ?? 0),
        satz_techniker: Number(nk.stundensatz_techniker ?? 75),
        satz_monteur: Number(nk.stundensatz_monteur ?? 69),
        bereits_uebertragen: Boolean((nk as Record<string, unknown>).stunden_transport_at),
      },
      // Was ausser Material und Stunden mitgeht. Steht in der Vorschau, damit
      // vor dem Anlegen sichtbar ist, was in PDS entsteht - und was fehlt.
      nebenkosten: {
        zone: nk.anfahrt_zone ?? null,
        fahrten: Number(nk.anfahrt_fahrten ?? 0),
        satz: Number(nk.anfahrt_satz ?? 0),
        anfahrt_gesamt: runde(Number(nk.anfahrt_fahrten ?? 0) * Number(nk.anfahrt_satz ?? 0)),
        pauschalen: Array.isArray(nk.pauschalen) ? nk.pauschalen : [],
        geruest: Boolean(nk.geruest),
        geruest_betrag: Number(nk.geruest_betrag ?? 0),
        bereits_uebertragen: Boolean((nk as Record<string, unknown>).nebenkosten_transport_at),
      },
    }

    // Ein Satz, der sagt, was passieren wird.
    const teile: string[] = []
    if (mengen.length) teile.push(`${mengen.length} Position(en) haben einen Platzhalter im Auftrag — ihre Menge wird direkt gesetzt.`)
    if (transport.length) {
      teile.push(
        `${transport.length} Position(en) haben keinen Platzhalter` +
        (hatPlatzhalterEbene ? " — sie gehen als Transportangebot, oder du markierst die Artikel als Platzhalter für künftige Aufträge." :
          " — der Auftrag hat keine Montagematerial-Ebene, sie gehen als Transportangebot zum Kopieren im Client."),
      )
    }
    if (bereitsUebertragen) teile.push(`${bereitsUebertragen} Position(en) sind schon übertragen.`)
    if (nichtUebertragbar.length) teile.push(`${nichtUebertragbar.length} bleiben im Shop.`)
    if (!teile.length) teile.push("Nichts zu übertragen.")

    if (aktion === "vorschau") {
      return json({ status: "vorschau", ...vorschau, hinweis: teile.join(" ") })
    }

    const jetzt = new Date().toISOString()

    // ─── Mengen setzen ─────────────────────────────────────────────────────
    if (aktion === "mengen_setzen") {
      if (mengen.length === 0) return json({ error: "Keine Position mit Platzhalter im Auftrag.", ...vorschau }, 400)

      const anfrage = {
        context: { vorgangstyp: "AUFTRAG" },
        vorgangsDaten: {
          uuid: nk.pds_vorgang_uuid,
          positionsDaten: mengen.map((m) => ({ uuid: m.position_uuid, menge: m.menge_neu })),
        },
      }
      const antwort = await pdsRoh("/vorgang/updateposition", anfrage)

      await sb.from("shop_pds_sync_log").insert({
        artikel_id: null,
        operation: "/vorgang/updateposition",
        dry_run: false,
        request: { nachkalkulation_id: nkId, zweck: "mengen_platzhalter", ...anfrage },
        response: antwort.daten
          ? { uuid: antwort.daten.uuid, vorgangsNummer: antwort.daten.vorgangsNummer }
          : { text: antwort.text.slice(0, 2000) },
        http_status: antwort.status,
        erfolg: antwort.ok,
        fehler: antwort.ok ? null : antwort.text.slice(0, 500),
        created_by: userData.user.id,
      })

      if (!antwort.ok) {
        return json({ error: `PDS ${antwort.status} @ /vorgang/updateposition: ${antwort.text.slice(0, 500)}` }, 502)
      }

      const ids = mengen.flatMap((m) => m.positions_ids)
      const { error: posErr } = await sb
        .from("shop_nachkalkulation_positionen")
        .update({ pds_transport_at: jetzt })
        .in("id", ids)
      if (nk.status === "offen") {
        await sb.from("shop_nachkalkulation").update({ status: "erfasst" }).eq("id", nkId)
      }

      return json({
        status: "mengen_gesetzt",
        anzahl: mengen.length,
        mengen: vorschau.mengen,
        offen_transport: transport.length,
        anleitung:
          `Die Mengen stehen in Auftrag ${nk.pds_vorgangs_nummer}. Im PDS-Client nur noch die ` +
          "Kundenpreise anpassen und Platzhalter mit Menge 0 löschen, falls sie im Dokument stören.",
        warnung: posErr
          ? `Mengen stehen in PDS, die Markierung im Shop scheiterte: ${posErr.message}. Nicht erneut setzen.`
          : undefined,
      })
    }

    // ─── Transportangebot anlegen ──────────────────────────────────────────

    // --- Stunden ----------------------------------------------------------
    // Ueber den Katalogartikel ARB-REG, nicht als freie Lohnposition (Patrick,
    // 30.09.2026: "aktuell laeuft viel ueber arb-reg"). Der Artikel traegt EK
    // 45 und VK 69 je Stunde und die Einheit Std; Preise werden deshalb NICHT
    // mitgeschickt, sondern dem Katalog ueberlassen. Spaeter koennen daraus
    // mehrere Artikel je Qualifikation werden - dann aendert sich hier nur die
    // Auswahl der UUID.
    //
    // Die Aufschluesselung steht im Langtext, weil die Position nur eine Menge
    // hat: wer sie in drei Monaten liest, soll sehen, woraus die Stunden
    // bestehen, ohne den Zettel zu suchen.
    const stdT = Number(nk.ist_stunden_techniker ?? 0)
    const stdM = Number(nk.ist_stunden_monteur ?? 0)
    const stdGesamt = runde(stdT + stdM)
    const schonGebucht = Boolean((nk as Record<string, unknown>).stunden_transport_at)

    const stundenPositionen = (!schonGebucht && stdGesamt > 0)
      ? [{
        positionsTyp: "ARTIKEL",
        positionsArt: "NORMAL",
        katalogUUID: ARB_REG_UUID,
        menge: stdGesamt,
        langtext: [
          "Regiearbeit nach Aufmass",
          stdT > 0 ? `Techniker: ${stdT.toLocaleString("de-DE")} Std` : null,
          stdM > 0 ? `Monteur: ${stdM.toLocaleString("de-DE")} Std` : null,
          `Summe: ${stdGesamt.toLocaleString("de-DE")} Std`,
          nk.stunden_quelle === "schaetzung" ? "Hinweis: Stunden geschaetzt, nicht belegt." : null,
        ].filter(Boolean).join("\n"),
      }]
      : []

    // --- Anfahrt, Pauschalen, Geruest --------------------------------------
    // Die Dinge, die bei jedem Auftrag anfallen und bisher nirgends standen.
    // Alle als freie Position: einen Katalogeintrag gibt es fuer keine davon
    // (am 01.10.2026 gesucht), und der Klimarechner fuehrt sie ebenso.
    const nebenSchonGebucht = Boolean((nk as Record<string, unknown>).nebenkosten_transport_at)
    const nebenPositionen: Array<Record<string, unknown>> = []

    if (!nebenSchonGebucht) {
      const fahrten = Number(nk.anfahrt_fahrten ?? 0)
      const satz = Number(nk.anfahrt_satz ?? 0)
      if (fahrten > 0 && satz > 0) {
        nebenPositionen.push({
          positionsTyp: "ARTIKEL",
          positionsArt: "NORMAL",
          kurztext: `Anfahrt Zone ${nk.anfahrt_zone ?? "?"} (Fahrt)`,
          menge: fahrten,
          // Die Anfahrt ist Erloes ohne eigenen Materialeinkauf; der
          // Fahrzeugaufwand steckt im Satz. Ein EK darauf waere erfunden.
          ekPreis: { einzelPreis: 0 },
          vkPreis: { einzelPreis: satz },
          langtext: [
            `Anfahrt Zone ${nk.anfahrt_zone ?? "?"}`,
            `${fahrten} Fahrt(en) zu je ${satz.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR`,
            "Enthaelt Fahrzeitanteil und Fahrzeugaufwand, je Fahrt und Fahrzeug.",
          ].join("\n"),
        })
      }

      const pauschalen = Array.isArray(nk.pauschalen) ? nk.pauschalen : []
      for (const pa of pauschalen as Array<Record<string, unknown>>) {
        const betrag = Number(pa?.betrag ?? 0)
        if (!(betrag > 0)) continue
        const text = String(pa?.text ?? pa?.schluessel ?? "Pauschale")
        nebenPositionen.push({
          positionsTyp: "ARTIKEL",
          positionsArt: "NORMAL",
          kurztext: text,
          menge: 1,
          ekPreis: { einzelPreis: 0 },
          vkPreis: { einzelPreis: betrag },
          langtext: [text, pa?.schluessel ? `Schluessel ${pa.schluessel}` : null]
            .filter(Boolean).join("\n"),
        })
      }

      if (nk.geruest && Number(nk.geruest_betrag ?? 0) > 0) {
        nebenPositionen.push({
          positionsTyp: "ARTIKEL",
          positionsArt: "NORMAL",
          kurztext: "Geruestgestellung",
          menge: 1,
          ekPreis: { einzelPreis: 0 },
          vkPreis: { einzelPreis: Number(nk.geruest_betrag) },
          langtext: "Geruestgestellung fuer die Montage, Auf- und Abbau.",
        })
      }
    }

    if (transport.length === 0 && stundenPositionen.length === 0 && nebenPositionen.length === 0) {
      return json({ error: "Keine Position für ein Transportangebot.", ...vorschau }, 400)
    }

    const anfrage = {
      context: { vorgangstyp: "ANGEBOT" },
      vorgangsdaten: {
        personUUID: EIGENE_FIRMA_ALS_KUNDE,
        bezeichnung: angebotBezeichnung,
        selektionskriterien: [{ bezeichnung: "Gewerk", wert: "SHK" }],
        rootEbene: {
          bezeichnung: "Leistungsverzeichnis",
          ebenen: [{
            bezeichnung: ebeneBezeichnung,
            ebeneArt: "NORMAL",
            positionen: [
              ...transport.map((p) => ({
                positionsTyp: "ARTIKEL",
                positionsArt: "NORMAL",
                // Mit Katalogbezug holt PDS die Bezeichnung selbst. Ohne einen
                // muss sie mitkommen — und zwar als kurztext: das Feld `name`
                // loest PDS gegen den Katalog auf und antwortet 412 (ADR 0008).
                ...(p.katalog_uuid
                  ? { katalogUUID: p.katalog_uuid }
                  // Einheit in den Text, aus demselben Grund wie oben.
                  : { kurztext: p.einheit ? `${p.name} (${p.einheit})` : p.name }),
                menge: p.menge,
                ekPreis: { einzelPreis: p.ek_einzel },
                // Kein vkFix (Patrick, 01.10.2026): der Verkaufspreis ist ein
                // Vorschlag aus EK mal Aufschlag. Festgenagelt wuerde er jede
                // spaetere Anpassung im Client blockieren - und eine
                // Nachkalkulation soll den Preis nicht bestimmen, sondern
                // zeigen, was gewesen waere.
                ...(p.vk_einzel != null ? { vkPreis: { einzelPreis: p.vk_einzel } } : {}),
                // Die Bezeichnung noch einmal im Langtext (Patrick, 30.09.2026):
                // der Kurztext wird in Listen und Ausdrucken abgeschnitten,
                // und bei einer Katalogposition steht er ueberhaupt nicht im
                // Dokument, sondern wird aus dem Katalog geholt.
                langtext: [
                  p.name,
                  `${p.menge.toLocaleString("de-DE")} ${p.einheit ?? ""}`.trim(),
                  "Verbaut laut Aufmass.",
                ].join("\n"),
              })),
              // Die Stunden gehoeren zum Regieaufmass wie das Material: was
              // geleistet wurde, muss in den Auftrag, sonst wird es nicht
              // abgerechnet. Sie stehen als eigene Zeile je Rolle, weil sich
              // die Saetze unterscheiden.
              ...stundenPositionen,
              ...nebenPositionen,
            ],
          }],
        },
      },
    }

    const antwort = await pdsRoh("/vorgang/create", anfrage)

    await sb.from("shop_pds_sync_log").insert({
      artikel_id: null,
      operation: "/vorgang/create",
      dry_run: false,
      request: { nachkalkulation_id: nkId, zweck: "transportangebot", ...anfrage },
      response: antwort.daten
        ? { uuid: antwort.daten.uuid, vorgangsNummer: antwort.daten.vorgangsNummer }
        : { text: antwort.text.slice(0, 2000) },
      http_status: antwort.status,
      erfolg: antwort.ok,
      fehler: antwort.ok ? null : antwort.text.slice(0, 500),
      created_by: userData.user.id,
    })

    if (!antwort.ok) {
      return json({ error: `PDS ${antwort.status} @ /vorgang/create: ${antwort.text.slice(0, 500)}` }, 502)
    }

    const angebotUUID = String(antwort.daten?.uuid ?? "")
    const angebotNummer = String(antwort.daten?.vorgangsNummer ?? "")

    const ids = transport.flatMap((p) => p.positions_ids)
    const { error: posErr } = await sb
      .from("shop_nachkalkulation_positionen")
      .update({ pds_transport_at: jetzt })
      .in("id", ids)
    const { error: updErr } = await sb
      .from("shop_nachkalkulation")
      .update({
        pds_transport_uuid: angebotUUID || null,
        pds_transport_nummer: angebotNummer || null,
        pds_transport_at: jetzt,
        pds_transport_positionen: transport.length,
        ...(stundenPositionen.length ? { stunden_transport_at: jetzt } : {}),
        ...(nebenPositionen.length ? { nebenkosten_transport_at: jetzt } : {}),
        ...(nk.status === "offen" ? { status: "erfasst" } : {}),
      })
      .eq("id", nkId)
    const fehlerBeimMerken = posErr?.message ?? updErr?.message ?? null

    return json({
      status: "transport_angelegt",
      angebot: {
        uuid: angebotUUID,
        vorgangs_nummer: angebotNummer,
        positionen: transport.length,
        stunden_positionen: stundenPositionen.length,
        ek_summe: transportEk,
        vk_summe: transportVk,
      },
      anleitung:
        `Angebot ${angebotNummer} im PDS-Client öffnen (Kunde Weich GmbH), die Ebene in Auftrag ` +
        `${nk.pds_vorgangs_nummer} kopieren, Kundenpreise anpassen, Angebot löschen.`,
      warnung: fehlerBeimMerken
        ? `Angebot ${angebotNummer} steht in PDS, die Markierung im Shop scheiterte: ${fehlerBeimMerken}. Nicht erneut anlegen.`
        : undefined,
    })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502)
  }
})
