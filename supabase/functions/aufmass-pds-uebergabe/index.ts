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
const ERLAUBTE_PFADE = new Set(["/vorgang/details"]) // schreibende Pfade kommen mit der Freigabe dazu
const SCHREIBEN_FREIGEGEBEN = false

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
        id, baustelle_text, pds_vorgang_uuid, status,
        aufmass_formteile ( id, formteil_system, dimension, anzahl ),
        aufmass_rohrmeter ( id, formteil_system, dimension, meter ),
        aufmass_einzelartikel ( id, bezeichnung, menge, einheit )
      `)
      .eq("id", erfassungId)
      .single()
    if (erfErr || !erf) return json({ error: "Erfassung nicht gefunden" }, 404)
    if (!erf.pds_vorgang_uuid) {
      return json({ error: "Erfassung ist mit keinem PDS-Auftrag verknuepft (pds_vorgang_uuid fehlt)." }, 422)
    }

    // ─── Kunstartikel je System+Dimension ──────────────────────────────────
    const { data: kunst } = await sb
      .from("shop_artikel")
      .select("id, name, einheit, preis_netto, pds_katalog_uuid, formteil_system, formteil_dimension")
      .eq("formteil_aufmass", true)
    const kunstJeSchluessel = new Map<string, any>()
    for (const k of kunst ?? []) kunstJeSchluessel.set(`${k.formteil_system}|${k.formteil_dimension}`, k)

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
    const mengen: any[] = []
    const transport: any[] = []
    const nichtUebertragbar: Array<{ name: string; menge: number; grund: string }> = []

    for (const f of (erf.aufmass_formteile ?? []) as any[]) {
      const k = kunstJeSchluessel.get(`${f.formteil_system}|${f.dimension}`)
      const name = k?.name ?? `Formteil ${f.formteil_system} ${f.dimension}`
      if (!k) { nichtUebertragbar.push({ name, menge: f.anzahl, grund: "Kein Kunstartikel fuer System+Dimension" }); continue }
      if (!k.pds_katalog_uuid) { nichtUebertragbar.push({ name, menge: f.anzahl, grund: "Kunstartikel noch nicht in PDS (pds-katalog-sync ausstehend)" }); continue }
      const platz = platzhalterJeKatalog.get(k.pds_katalog_uuid)
      if (platz) {
        const aktuell = Number(platz.menge ?? 0)
        mengen.push({ position_uuid: platz.uuid, ebene: platz.ebene, name: platz.kurztext ?? name, menge_aktuell: aktuell, menge_plus: f.anzahl, menge_neu: runde(aktuell + f.anzahl) })
      } else {
        const ek = k.preis_netto != null ? Number(k.preis_netto) : 0
        transport.push({ katalog_uuid: k.pds_katalog_uuid, name, menge: f.anzahl, ek_einzel: runde(ek), ek_gesamt: runde(ek * f.anzahl) })
      }
    }
    for (const r of (erf.aufmass_rohrmeter ?? []) as any[]) {
      nichtUebertragbar.push({ name: `Rohr ${r.formteil_system} ${r.dimension}`, menge: Number(r.meter), grund: "Rohrmeter: Zielartikel noch nicht festgelegt (siehe Plan, offene Frage)" })
    }
    for (const e of (erf.aufmass_einzelartikel ?? []) as any[]) {
      nichtUebertragbar.push({ name: e.bezeichnung, menge: Number(e.menge), grund: "Einzelartikel ohne Artikelbindung (Freitext)" })
    }

    const teile: string[] = []
    if (mengen.length) teile.push(`${mengen.length} Formteil-Gruppe(n) haben einen Platzhalter im Auftrag — Menge wuerde direkt gesetzt.`)
    if (transport.length) teile.push(`${transport.length} Formteil-Gruppe(n) ohne Platzhalter — wuerden als Transportangebot gehen.`)
    if (nichtUebertragbar.length) teile.push(`${nichtUebertragbar.length} Position(en) bleiben in der Aufmass-App.`)
    if (!teile.length) teile.push("Nichts zu uebertragen.")

    return json({
      status: "vorschau",
      schreiben_freigegeben: SCHREIBEN_FREIGEGEBEN,
      auftrag: {
        uuid: erf.pds_vorgang_uuid,
        vorgangs_nummer: det.daten.vorgangsNummer ?? null,
        positionen_gesamt: pdsPositionen.length,
        platzhalter_mit_katalog: platzhalterJeKatalog.size,
        ebenen: [...new Set(pdsPositionen.map((p) => p.ebene))],
      },
      erfassung: { id: erf.id, baustelle: erf.baustelle_text, status: erf.status },
      mengen, transport,
      transport_summe_ek: runde(transport.reduce((s, p) => s + p.ek_gesamt, 0)),
      nicht_uebertragbar: nichtUebertragbar,
      hinweis: teile.join(" "),
    })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502)
  }
})
