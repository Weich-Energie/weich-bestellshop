// aufmass-pds-uebergabe — Bringt ein Aufmass (Aufmass-App) in den PDS-Auftrag.
//
// Ziel-Schritt 5, Muster: pds-auftrag-material (Klima-Nachkalkulation, ADR 0007
// und ADR 0006). Formteile werden ueber die Formteil-Kunstartikel
// (shop_artikel.formteil_aufmass) auf PDS-Katalogeintraege abgebildet und wie
// dort behandelt: Platzhalter im Auftrag -> Menge setzen, sonst Transport-
// angebot. Einzelartikel sind im MVP Freitext ohne Artikelbindung und gehen
// noch nicht nach PDS (werden als "nicht uebertragbar" ausgewiesen).
//
// STAND 07.09.2026: NUR "vorschau" IST FREIGESCHALTET. Die schreibenden
// Aktionen (mengen_setzen, transport_anlegen) antworten 501, bis
//   1. die Kunstartikel per pds-katalog-sync in PDS stehen (pds_katalog_uuid) und
//   2. Patrick den Schreibweg freigibt.
// Die Vorschau liest nur (/vorgang/details) und rechnet, was passieren wuerde.

import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
// Positivliste: lesen, Menge an vorhandenen Positionen aendern, Angebot anlegen.
// Nie Preise/Texte anderer Positionen, nie loeschen. Schreibweg freigegeben am
// 07.09.2026 (Patrick: "GO").
const ERLAUBTE_PFADE = new Set(["/vorgang/details", "/vorgang/updateposition", "/vorgang/create"])
const SCHREIBEN_FREIGEGEBEN = true
// Die Weich GmbH ist in PDS auch Kunde (Kundennummer 10039); Transportangebote
// haengen an ihr — wie in pds-auftrag-material.
const EIGENE_FIRMA_ALS_KUNDE = "6139e897-1a04-48fa-bdd5-b9ac2e47ebd2"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}
function runde(n: number) { return Math.round(n * 100) / 100 }

type PdsPosition = {
  uuid?: string; nummer?: string; kurztext?: string; menge?: number
  katalogUUID?: string | null; masseinheit?: { bezeichnung?: string } | null
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

  const sb = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "")

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nicht autorisiert" }, 401)
    const { data: userData, error: authErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""))
    if (authErr || !userData?.user?.email) return json({ error: "Ungueltige Session" }, 401)

    // service_role umgeht RLS — Berechtigung selbst pruefen, fail-closed. Der
    // Schreibweg in Kundenauftraege bleibt bei den Shop-Admins (wie Klima).
    const { data: profil } = await sb.from("employees").select("berechtigungen").eq("email", userData.user.email).single()
    const rechte = (profil?.berechtigungen ?? {}) as Record<string, any>
    const istAdmin = rechte?.app_access?.bestellshop_admin === true || rechte?.rolle === "admin"
    if (!istAdmin) return json({ error: "Nur Shop-Admins duerfen nach PDS uebertragen" }, 403)

    const body = await req.json().catch(() => ({}))
    const aktion = String(body?.aktion ?? "vorschau").trim()
    const erfassungId = String(body?.erfassung_id ?? "").trim()
    if (!erfassungId) return json({ error: "erfassung_id fehlt" }, 400)
    if (!["vorschau", "mengen_setzen", "transport_anlegen"].includes(aktion)) {
      return json({ error: 'aktion muss "vorschau", "mengen_setzen" oder "transport_anlegen" sein' }, 400)
    }
    if (aktion !== "vorschau" && !SCHREIBEN_FREIGEGEBEN) {
      return json({
        error: "Schreibweg noch nicht freigegeben",
        hinweis: "Erst muessen die Formteil-Kunstartikel in PDS stehen (pds-katalog-sync) und der Schreibweg freigegeben sein — siehe docs/aufmass-pds-uebergabe-plan.md.",
      }, 501)
    }

    // ─── Erfassung laden ───────────────────────────────────────────────────
    const { data: erf, error: erfErr } = await sb
      .from("aufmass_erfassung")
      .select(`
        id, baustelle_text, pds_vorgang_uuid, pds_vorgangs_nummer, status,
        aufmass_formteile ( id, formteil_system, dimension, dimensionsgruppe, preisklasse, anzahl, pds_transport_at ),
        aufmass_rohrmeter ( id, formteil_system, dimension, dimensionsgruppe, meter ),
        aufmass_einzelartikel ( id, bezeichnung, menge, einheit )
      `)
      .eq("id", erfassungId)
      .single()
    if (erfErr || !erf) return json({ error: "Erfassung nicht gefunden" }, 404)
    if (!erf.pds_vorgang_uuid) {
      return json({ error: "Erfassung ist mit keinem PDS-Auftrag verknuepft (pds_vorgang_uuid fehlt)." }, 422)
    }

    // ─── Kunstartikel: erst je Strichlisten-Gruppe, dann je Einzeldimension ──
    // Seit dem Umbau der Erfassung (09.09.2026) liefert die App
    // System + Dimensionsgruppe + Preisklasse. Erfassungen von davor tragen
    // nur die feine Dimension; fuer sie greift die zweite Karte.
    const { data: kunst } = await sb
      .from("shop_artikel")
      .select(
        "id, name, einheit, preis_netto, pds_katalog_uuid, formteil_system, " +
        "formteil_dimension, formteil_dimensionsgruppe, formteil_preisklasse")
      .eq("formteil_aufmass", true)
    const kunstJeGruppe = new Map<string, any>()
    const kunstJeDimension = new Map<string, any>()
    for (const k of kunst ?? []) {
      if (k.formteil_dimensionsgruppe && k.formteil_preisklasse) {
        kunstJeGruppe.set(
          `${k.formteil_system}|${k.formteil_dimensionsgruppe}|${k.formteil_preisklasse}`, k)
      }
      if (k.formteil_dimension) {
        kunstJeDimension.set(`${k.formteil_system}|${k.formteil_dimension}`, k)
      }
    }
    // Findet den Kunstartikel zu einer Aufmass-Zeile.
    function kunstartikelFuer(f: any) {
      if (f.dimensionsgruppe && f.preisklasse) {
        const g = kunstJeGruppe.get(`${f.formteil_system}|${f.dimensionsgruppe}|${f.preisklasse}`)
        if (g) return g
      }
      return kunstJeDimension.get(`${f.formteil_system}|${f.dimension}`)
    }
    function zeilenName(f: any) {
      const mass = f.dimensionsgruppe ?? f.dimension
      return `Formteil ${f.formteil_system} ${mass}${f.preisklasse ? " " + f.preisklasse : ""}`
    }

    // ─── PDS-Auftrag lesen ─────────────────────────────────────────────────
    const { data: secret } = await sb.from("integration_secrets").select("value").eq("key", "pds").maybeSingle()
    const cfg = secret?.value as { api_key?: string; base_url?: string } | undefined
    if (!cfg?.api_key || !cfg?.base_url) return json({ error: "Keine PDS-Zugangsdaten hinterlegt" }, 503)
    const basis = cfg.base_url.replace(/\/$/, "")
    async function pdsRoh(pfad: string, rumpf: unknown) {
      if (!ERLAUBTE_PFADE.has(pfad)) throw new Error(`Pfad ${pfad} ist nicht freigegeben`)
      const r = await fetch(basis + pfad, {
        method: "POST",
        headers: { authorization: "Bearer " + cfg!.api_key!.trim(), "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(rumpf),
      })
      const text = await r.text()
      let daten: any = null
      try { daten = text ? JSON.parse(text) : null } catch { daten = null }
      return { ok: r.ok, status: r.status, daten, text }
    }

    const det = await pdsRoh("/vorgang/details", { uuid: erf.pds_vorgang_uuid, vorgangstyp: "AUFTRAG" })
    if (!det.ok || !det.daten?.uuid) {
      return json({ error: `Auftrag ${erf.pds_vorgang_uuid} ist in PDS nicht auffindbar (${det.status}).` }, 404)
    }
    const pdsPositionen: Array<PdsPosition & { ebene: string }> = []
    sammle((det.daten.rootEbene ?? {}) as PdsEbene, pdsPositionen, det.daten.rootEbene?.bezeichnung ?? "")

    const platzhalterJeKatalog = new Map<string, PdsPosition & { ebene: string }>()
    const sortiert = [...pdsPositionen].sort((a, b) =>
      (/montagematerial|formteil/i.test(a.ebene) ? 0 : 1) - (/montagematerial|formteil/i.test(b.ebene) ? 0 : 1))
    for (const p of sortiert) {
      if (p.katalogUUID && p.uuid && !platzhalterJeKatalog.has(p.katalogUUID)) platzhalterJeKatalog.set(p.katalogUUID, p)
    }

    // ─── Formteile einsortieren ────────────────────────────────────────────
    // Je Katalog-UUID buendeln (mehrere Aufmass-Zeilen derselben Gruppe addieren
    // sich), Zeilen-IDs merken fuer die Markierung pds_transport_at.
    const mengenJeKatalog = new Map<string, any>()
    const transportJeKatalog = new Map<string, any>()
    const nichtUebertragbar: Array<{ name: string; menge: number; grund: string }> = []
    let bereitsUebertragen = 0

    for (const f of (erf.aufmass_formteile ?? []) as any[]) {
      if (f.pds_transport_at) { bereitsUebertragen++; continue }
      const k = kunstartikelFuer(f)
      const name = k?.name ?? zeilenName(f)
      const anzahl = Number(f.anzahl)
      if (!k) { nichtUebertragbar.push({ name, menge: anzahl, grund: "Kein Kunstartikel fuer diese Gruppe" }); continue }
      if (!k.pds_katalog_uuid) { nichtUebertragbar.push({ name, menge: anzahl, grund: "Kunstartikel noch nicht in PDS (pds-katalog-sync ausstehend)" }); continue }
      const platz = platzhalterJeKatalog.get(k.pds_katalog_uuid)
      if (platz) {
        const z = mengenJeKatalog.get(k.pds_katalog_uuid)
        if (z) { z.menge_plus = runde(z.menge_plus + anzahl); z.menge_neu = runde(z.menge_aktuell + z.menge_plus); z.positions_ids.push(f.id) }
        else {
          const aktuell = Number(platz.menge ?? 0)
          mengenJeKatalog.set(k.pds_katalog_uuid, { position_uuid: platz.uuid, ebene: platz.ebene, name: platz.kurztext ?? name, menge_aktuell: aktuell, menge_plus: anzahl, menge_neu: runde(aktuell + anzahl), positions_ids: [f.id] })
        }
      } else {
        const ek = k.preis_netto != null ? Number(k.preis_netto) : 0
        const t = transportJeKatalog.get(k.pds_katalog_uuid)
        if (t) { t.menge = runde(t.menge + anzahl); t.ek_gesamt = runde(t.ek_einzel * t.menge); t.positions_ids.push(f.id) }
        else transportJeKatalog.set(k.pds_katalog_uuid, { katalog_uuid: k.pds_katalog_uuid, name, menge: anzahl, ek_einzel: runde(ek), ek_gesamt: runde(ek * anzahl), positions_ids: [f.id] })
      }
    }
    const mengen = [...mengenJeKatalog.values()]
    const transport = [...transportJeKatalog.values()]
    for (const r of (erf.aufmass_rohrmeter ?? []) as any[]) {
      nichtUebertragbar.push({ name: `Rohr ${r.formteil_system} ${r.dimensionsgruppe ?? r.dimension}`, menge: Number(r.meter), grund: "Rohrmeter: Zielartikel noch nicht festgelegt (siehe Plan, offene Frage)" })
    }
    for (const e of (erf.aufmass_einzelartikel ?? []) as any[]) {
      nichtUebertragbar.push({ name: e.bezeichnung, menge: Number(e.menge), grund: "Einzelartikel ohne Artikelbindung (Freitext)" })
    }

    const teile: string[] = []
    if (mengen.length) teile.push(`${mengen.length} Formteil-Gruppe(n) haben einen Platzhalter im Auftrag — Menge wuerde direkt gesetzt.`)
    if (transport.length) teile.push(`${transport.length} Formteil-Gruppe(n) ohne Platzhalter — wuerden als Transportangebot gehen.`)
    if (bereitsUebertragen) teile.push(`${bereitsUebertragen} Formteil-Gruppe(n) sind schon uebertragen.`)
    if (nichtUebertragbar.length) teile.push(`${nichtUebertragbar.length} Position(en) bleiben in der Aufmass-App.`)
    if (!teile.length) teile.push("Nichts zu uebertragen.")

    const vorschau = {
      schreiben_freigegeben: SCHREIBEN_FREIGEGEBEN,
      auftrag: {
        uuid: erf.pds_vorgang_uuid,
        vorgangs_nummer: det.daten.vorgangsNummer ?? null,
        positionen_gesamt: pdsPositionen.length,
        platzhalter_mit_katalog: platzhalterJeKatalog.size,
        ebenen: [...new Set(pdsPositionen.map((p) => p.ebene))],
      },
      erfassung: { id: erf.id, baustelle: erf.baustelle_text, status: erf.status },
      mengen: mengen.map(({ positions_ids: _i, ...m }) => m),
      transport: transport.map(({ positions_ids: _i, ...t }) => t),
      transport_summe_ek: runde(transport.reduce((s, p) => s + p.ek_gesamt, 0)),
      bereits_uebertragen: bereitsUebertragen,
      nicht_uebertragbar: nichtUebertragbar,
      hinweis: teile.join(" "),
    }
    if (aktion === "vorschau") return json({ status: "vorschau", ...vorschau })

    // ─── Schreibweg (nur erreichbar, wenn SCHREIBEN_FREIGEGEBEN) ────────────
    // 1:1 das Muster aus pds-auftrag-material: Mengen an Platzhaltern setzen,
    // sonst Transportangebot bei der Weich GmbH. Protokoll in shop_pds_sync_log,
    // Markierung pds_transport_at an den Formteil-Zeilen.
    const jetzt = new Date().toISOString()
    const vorgangsNummer = det.daten.vorgangsNummer ?? erf.pds_vorgangs_nummer ?? erf.pds_vorgang_uuid
    async function protokoll(operation: string, request: unknown, antwort: { ok: boolean; status: number; daten: any; text: string }) {
      await sb.from("shop_pds_sync_log").insert({
        artikel_id: null, operation, dry_run: false,
        request: { erfassung_id: erfassungId, zweck: "aufmass", ...(request as object) },
        response: antwort.daten ? { uuid: antwort.daten.uuid, vorgangsNummer: antwort.daten.vorgangsNummer } : { text: antwort.text.slice(0, 2000) },
        http_status: antwort.status, erfolg: antwort.ok, fehler: antwort.ok ? null : antwort.text.slice(0, 500),
        created_by: userData.user.id,
      })
    }

    if (aktion === "mengen_setzen") {
      if (!mengen.length) return json({ error: "Keine Formteil-Gruppe mit Platzhalter im Auftrag.", ...vorschau }, 400)
      const anfrage = {
        context: { vorgangstyp: "AUFTRAG" },
        vorgangsDaten: { uuid: erf.pds_vorgang_uuid, positionsDaten: mengen.map((m) => ({ uuid: m.position_uuid, menge: m.menge_neu })) },
      }
      const antwort = await pdsRoh("/vorgang/updateposition", anfrage)
      await protokoll("/vorgang/updateposition", anfrage, antwort)
      if (!antwort.ok) return json({ error: `PDS ${antwort.status} @ /vorgang/updateposition: ${antwort.text.slice(0, 500)}` }, 502)
      const ids = mengen.flatMap((m) => m.positions_ids)
      const { error: markErr } = await sb.from("aufmass_formteile").update({ pds_transport_at: jetzt }).in("id", ids)
      if (erf.status !== "uebertragen" && !transport.length) await sb.from("aufmass_erfassung").update({ status: "uebertragen" }).eq("id", erfassungId)
      return json({
        status: "mengen_gesetzt", anzahl: mengen.length, mengen: vorschau.mengen, offen_transport: transport.length,
        anleitung: `Die Mengen stehen in Auftrag ${vorgangsNummer}. Im PDS-Client nur noch Kundenpreise pruefen und Platzhalter mit Menge 0 loeschen, falls sie stoeren.`,
        warnung: markErr ? `Mengen stehen in PDS, die Markierung im Aufmass scheiterte: ${markErr.message}. Nicht erneut setzen.` : undefined,
      })
    }

    // transport_anlegen
    if (!transport.length) return json({ error: "Keine Formteil-Gruppe fuer ein Transportangebot.", ...vorschau }, 400)
    const heute = (() => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}` })()
    const angebotBezeichnung = `ZZ-TRANSPORT Aufmass fuer Auftrag ${vorgangsNummer} — nach Kopieren loeschen`
    const anfrage = {
      context: { vorgangstyp: "ANGEBOT" },
      vorgangsdaten: {
        personUUID: EIGENE_FIRMA_ALS_KUNDE,
        bezeichnung: angebotBezeichnung,
        selektionskriterien: [{ bezeichnung: "Gewerk", wert: "SHK" }],
        rootEbene: {
          bezeichnung: "Leistungsverzeichnis",
          ebenen: [{
            bezeichnung: `Formteile Aufmass fuer ${vorgangsNummer} — Aufmass-App ${heute}`,
            ebeneArt: "NORMAL",
            positionen: transport.map((p) => ({
              positionsTyp: "ARTIKEL", positionsArt: "NORMAL", katalogUUID: p.katalog_uuid, menge: p.menge,
              ekPreis: { einzelPreis: p.ek_einzel },
            })),
          }],
        },
      },
    }
    const antwort = await pdsRoh("/vorgang/create", anfrage)
    await protokoll("/vorgang/create", anfrage, antwort)
    if (!antwort.ok) return json({ error: `PDS ${antwort.status} @ /vorgang/create: ${antwort.text.slice(0, 500)}` }, 502)
    const angebotUUID = String(antwort.daten?.uuid ?? "")
    const angebotNummer = String(antwort.daten?.vorgangsNummer ?? "")
    const ids = transport.flatMap((p) => p.positions_ids)
    const { error: markErr } = await sb.from("aufmass_formteile").update({ pds_transport_at: jetzt }).in("id", ids)
    const { error: erfErr2 } = await sb.from("aufmass_erfassung").update({
      pds_transport_uuid: angebotUUID || null, pds_transport_nummer: angebotNummer || null, pds_transport_at: jetzt, status: "uebertragen",
    }).eq("id", erfassungId)
    return json({
      status: "transport_angelegt",
      angebot: { uuid: angebotUUID, vorgangs_nummer: angebotNummer, positionen: transport.length, ek_summe: vorschau.transport_summe_ek },
      anleitung: `Angebot ${angebotNummer} im PDS-Client oeffnen (Kunde Weich GmbH), die Ebene in Auftrag ${vorgangsNummer} kopieren, Kundenpreise anpassen, Angebot loeschen.`,
      warnung: (markErr ?? erfErr2) ? `Angebot ${angebotNummer} steht in PDS, die Markierung im Aufmass scheiterte: ${(markErr ?? erfErr2)!.message}. Nicht erneut anlegen.` : undefined,
    })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502)
  }
})
