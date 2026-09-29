// aufmass-pds-uebergabe — Bringt ein Aufmass (Aufmass-App) in den PDS-Auftrag.
//
// STRUKTUR (Patricks Vorgabe 29.09.2026):
//   1. eine LEISTUNG "Rohre und Formteile" mit dem Gesamt-EK, und
//   2. dahinter jeder andere Artikel als eigene ARTIKEL-Position.
// Welche Zeile in welchen Topf gehoert, sagt die Sicht
// aufmass_position_pds_topf — die Regel liegt in der Datenbank und ist per SQL
// pruefbar.
//
// KEIN PDS-ARTIKELSTAMM (ADR 0008). Die Positionen tragen Name, Kurztext,
// Menge und ekPreis, aber keine katalogUUID: /vorgang/create verlangt sie
// nicht. Damit waechst der Artikelstamm nicht um Rechengroessen, die per API
// ohnehin nicht mehr loeschbar waeren. Der frueher gebaute Weg ueber
// Formteil-Kunstartikel in PDS (und die Platzhalter-Ebene) ist aufgegeben.
//
// Zwei Preisquellen, weil die App zwei Ansichten hat:
//   * Zaehlliste  — jede Zeile zeigt auf einen echten Artikel, Preis von dort.
//   * Sammelansicht — eine Zeile ist eine Mischsatz-Gruppe ohne eigenen
//     Artikel; der Preis kommt aus dem Formteil-Kunstartikel.
//
// Rein lesend ist nur "vorschau". "transport_anlegen" legt ein Angebot bei der
// Weich GmbH an, das im Client in den Auftrag kopiert und dann geloescht wird
// (ADR 0006) — Vorgaenge sind per API nicht loeschbar.

import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
// Positivliste: lesen und Angebot anlegen. Nie Preise oder Texte fremder
// Positionen, nie loeschen.
const ERLAUBTE_PFADE = new Set(["/vorgang/details", "/vorgang/create"])
// Die Weich GmbH ist in PDS auch Kunde (Kundennummer 10039); Transportangebote
// haengen an ihr — wie in pds-auftrag-material.
const EIGENE_FIRMA_ALS_KUNDE = "6139e897-1a04-48fa-bdd5-b9ac2e47ebd2"
// Materialkosten ohne Stammartikel. LEISTUNG ist im Haus belegt (Muster C der
// Nachkalkulation traegt den EK im ekPreis der Leistung); ARTIKEL ohne
// katalogUUID ist laut Schema erlaubt. Beides ist am 29.09.2026 an einem
// Testangebot zu bestaetigen — siehe ADR 0008.
const TYP_LEISTUNG = "LEISTUNG"
const TYP_ARTIKEL = "ARTIKEL"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}
function runde(n: number) { return Math.round(n * 100) / 100 }

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

    // Preise und Schreibweg nach PDS: nur Shop-Admins.
    const { data: profil } = await sb.from("employees")
      .select("berechtigungen").eq("email", userData.user.email).single()
    const rechte = (profil?.berechtigungen ?? {}) as Record<string, any>
    const darf = rechte?.app_access?.bestellshop_admin === true || rechte?.rolle === "admin"
    if (!darf) return json({ error: "Nur Shop-Admins duerfen ein Aufmass nach PDS uebergeben" }, 403)

    const body = await req.json().catch(() => ({}))
    const erfassungId = String(body?.erfassung_id ?? body?.erfassungId ?? "")
    const aktion = String(body?.aktion ?? "vorschau")
    if (!erfassungId) return json({ error: "erfassung_id fehlt" }, 400)
    if (!["vorschau", "transport_anlegen"].includes(aktion)) {
      return json({
        error: 'aktion muss "vorschau" oder "transport_anlegen" sein',
        hinweis: 'mengen_setzen ist entfallen: die Platzhalter-Ebene fuer Formteile '
          + 'gibt es nicht mehr (ADR 0008).',
      }, 400)
    }

    // ─── Erfassung laden ───────────────────────────────────────────────────
    const { data: erf, error: erfErr } = await sb
      .from("aufmass_erfassung")
      .select(`
        id, baustelle_text, pds_vorgang_uuid, pds_vorgangs_nummer, status,
        aufmass_formteile ( id, position_id, formteil_system, dimension,
                            dimensionsgruppe, preisklasse, anzahl, pds_transport_at ),
        aufmass_rohrmeter ( id, formteil_system, dimension, dimensionsgruppe, meter ),
        aufmass_einzelartikel ( id, bezeichnung, menge, einheit )
      `)
      .eq("id", erfassungId)
      .single()
    if (erfErr || !erf) return json({ error: "Erfassung nicht gefunden" }, 404)
    if (!erf.pds_vorgang_uuid) {
      return json({ error: "Erfassung ist mit keinem PDS-Auftrag verknuepft (pds_vorgang_uuid fehlt)." }, 422)
    }

    // ─── Topf und Preis je Zeile ───────────────────────────────────────────
    const positionsIds = [...new Set((erf.aufmass_formteile ?? [])
      .map((f: any) => f.position_id).filter(Boolean))]
    const topfJePosition = new Map<string, any>()
    if (positionsIds.length) {
      const { data: toepfe } = await sb
        .from("aufmass_position_pds_topf")
        .select("position_id, art, name, einheit, preis_netto, topf, rubrik")
        .in("position_id", positionsIds)
      for (const t of toepfe ?? []) topfJePosition.set(t.position_id, t)
    }

    // Kunstartikel als Preisquelle der Sammelansicht.
    const { data: kunst } = await sb
      .from("shop_artikel")
      .select("id, name, einheit, preis_netto, formteil_system, formteil_dimension, "
        + "formteil_dimensionsgruppe, formteil_preisklasse")
      .eq("formteil_aufmass", true)
    const kunstJeGruppe = new Map<string, any>()
    const kunstJeDimension = new Map<string, any>()
    for (const k of kunst ?? []) {
      if (k.formteil_dimensionsgruppe && k.formteil_preisklasse) {
        kunstJeGruppe.set(`${k.formteil_system}|${k.formteil_dimensionsgruppe}|${k.formteil_preisklasse}`, k)
      }
      if (k.formteil_dimension) kunstJeDimension.set(`${k.formteil_system}|${k.formteil_dimension}`, k)
    }
    const kunstartikelFuer = (f: any) =>
      (f.dimensionsgruppe && f.preisklasse
        ? kunstJeGruppe.get(`${f.formteil_system}|${f.dimensionsgruppe}|${f.preisklasse}`)
        : null)
      ?? kunstJeDimension.get(`${f.formteil_system}|${f.dimension}`)

    // ─── Zeilen in die zwei Toepfe sortieren ───────────────────────────────
    let leistungEk = 0
    const leistungZeilen: Array<{ name: string; menge: number; ek_einzel: number; ek_gesamt: number }> = []
    const artikelPositionen = new Map<string, any>()
    const nichtUebertragbar: Array<{ name: string; menge: number; grund: string }> = []
    const alleIds: string[] = []
    let bereitsUebertragen = 0

    for (const f of (erf.aufmass_formteile ?? []) as any[]) {
      if (f.pds_transport_at) { bereitsUebertragen++; continue }
      const anzahl = Number(f.anzahl)
      if (!(anzahl > 0)) continue
      const t = f.position_id ? topfJePosition.get(f.position_id) : null

      // Eine Zeile der Zaehlliste mit echtem Artikel.
      if (t && t.art === "artikel") {
        if (t.preis_netto == null) {
          nichtUebertragbar.push({ name: t.name, menge: anzahl, grund: "Artikel ohne Preis" })
          continue
        }
        const ek = Number(t.preis_netto)
        alleIds.push(f.id)
        if (t.topf === "leistung") {
          leistungEk = runde(leistungEk + ek * anzahl)
          leistungZeilen.push({ name: t.name, menge: anzahl, ek_einzel: runde(ek), ek_gesamt: runde(ek * anzahl) })
        } else {
          const vorhanden = artikelPositionen.get(t.position_id)
          if (vorhanden) {
            vorhanden.menge = runde(vorhanden.menge + anzahl)
            vorhanden.ek_gesamt = runde(vorhanden.ek_einzel * vorhanden.menge)
            vorhanden.positions_ids.push(f.id)
          } else {
            artikelPositionen.set(t.position_id, {
              name: t.name, einheit: t.einheit ?? "Stück", menge: anzahl,
              ek_einzel: runde(ek), ek_gesamt: runde(ek * anzahl), positions_ids: [f.id],
            })
          }
        }
        continue
      }

      // Eine Gruppen-Zeile der Sammelansicht: Preis aus dem Kunstartikel.
      const k = kunstartikelFuer(f)
      const name = k?.name
        ?? `Formteil ${f.formteil_system} ${f.dimensionsgruppe ?? f.dimension}`
          + (f.preisklasse ? " " + f.preisklasse : "")
      if (!k || k.preis_netto == null) {
        nichtUebertragbar.push({ name, menge: anzahl, grund: "Kein Mischsatz fuer diese Gruppe" })
        continue
      }
      const ek = Number(k.preis_netto)
      alleIds.push(f.id)
      leistungEk = runde(leistungEk + ek * anzahl)
      leistungZeilen.push({ name, menge: anzahl, ek_einzel: runde(ek), ek_gesamt: runde(ek * anzahl) })
    }

    // Rohrmeter der Sammelansicht: es gibt keinen Meterpreis. In der Zaehlliste
    // zaehlt der Monteur die Rohre als Artikel, dort ist der Fall geloest.
    for (const r of (erf.aufmass_rohrmeter ?? []) as any[]) {
      if (!(Number(r.meter) > 0)) continue
      nichtUebertragbar.push({
        name: `Rohr ${r.formteil_system} ${r.dimensionsgruppe ?? r.dimension}`,
        menge: Number(r.meter),
        grund: "Rohrmeter der Sammelansicht: kein Meterpreis hinterlegt",
      })
    }
    for (const e of (erf.aufmass_einzelartikel ?? []) as any[]) {
      nichtUebertragbar.push({
        name: e.bezeichnung, menge: Number(e.menge),
        grund: "Einzelartikel ist Freitext ohne Artikelbindung",
      })
    }

    const artikel = [...artikelPositionen.values()]
    const vorschau = {
      erfassung: {
        id: erf.id, baustelle: erf.baustelle_text,
        pds_auftrag: erf.pds_vorgangs_nummer, status: erf.status,
      },
      leistung: {
        bezeichnung: "Rohre und Formteile",
        ek_gesamt: leistungEk,
        zeilen: leistungZeilen.length,
        aufschluesselung: leistungZeilen,
      },
      artikel,
      summe_ek: runde(leistungEk + artikel.reduce((s, a) => s + a.ek_gesamt, 0)),
      nicht_uebertragbar: nichtUebertragbar,
      bereits_uebertragen: bereitsUebertragen,
    }

    // ─── PDS lesen ─────────────────────────────────────────────────────────
    const { data: secret } = await sb.from("integration_secrets").select("value").eq("key", "pds").maybeSingle()
    const cfg = secret?.value as { api_key?: string; base_url?: string } | undefined
    if (!cfg?.api_key || !cfg?.base_url) return json({ error: "Keine PDS-Zugangsdaten hinterlegt" }, 503)
    const basis = cfg.base_url.replace(/\/$/, "")
    async function pdsRoh(pfad: string, rumpf: unknown) {
      if (!ERLAUBTE_PFADE.has(pfad)) throw new Error(`Pfad ${pfad} ist nicht freigegeben`)
      const r = await fetch(basis + pfad, {
        method: "POST",
        headers: {
          authorization: "Bearer " + cfg!.api_key!.trim(),
          "content-type": "application/json", accept: "application/json",
        },
        body: JSON.stringify(rumpf),
      })
      const text = await r.text()
      let daten: any = null
      try { daten = text ? JSON.parse(text) : null } catch { daten = null }
      return { ok: r.ok, status: r.status, daten, text }
    }
    async function protokoll(operation: string, anfrage: unknown, antwort: any) {
      await sb.from("shop_pds_sync_log").insert({
        operation, dry_run: false, request: anfrage,
        response: antwort?.daten ?? { text: String(antwort?.text ?? "").slice(0, 2000) },
        http_status: antwort?.status ?? null, erfolg: !!antwort?.ok,
        fehler: antwort?.ok ? null : String(antwort?.text ?? "").slice(0, 500),
      })
    }

    const det = await pdsRoh("/vorgang/details", { uuid: erf.pds_vorgang_uuid, vorgangstyp: "AUFTRAG" })
    if (!det.ok || !det.daten?.uuid) {
      return json({ error: `Auftrag ${erf.pds_vorgang_uuid} ist in PDS nicht auffindbar (${det.status}).` }, 404)
    }
    const vorgangsNummer = String(det.daten.vorgangsNummer ?? erf.pds_vorgangs_nummer ?? "")

    if (aktion === "vorschau") {
      return json({ status: "vorschau", pds_auftrag: vorgangsNummer, ...vorschau })
    }

    // ─── transport_anlegen ─────────────────────────────────────────────────
    if (!leistungEk && !artikel.length) {
      return json({ error: "Nichts zu uebertragen.", ...vorschau }, 400)
    }
    const heute = (() => {
      const d = new Date(); const p = (n: number) => String(n).padStart(2, "0")
      return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
    })()

    // Erst die Leistung, dann die Artikel — genau die Reihenfolge, die im
    // Auftrag stehen soll.
    const positionen: any[] = []
    if (leistungEk > 0) {
      positionen.push({
        positionsTyp: TYP_LEISTUNG, positionsArt: "NORMAL",
        name: "Rohre und Formteile",
        kurztext: `Rohre und Formteile nach Aufmass vom ${heute}`,
        langtext: leistungZeilen
          .map((z) => `${z.menge} × ${z.name} (${z.ek_einzel.toFixed(2)} €)`)
          .join("\n")
          .slice(0, 4000),
        menge: 1, pauschal: true,
        ekPreis: { einzelPreis: leistungEk, gesamtPreis: leistungEk },
      })
    }
    for (const a of artikel) {
      positionen.push({
        positionsTyp: TYP_ARTIKEL, positionsArt: "NORMAL",
        name: String(a.name).slice(0, 80), kurztext: String(a.name).slice(0, 200),
        menge: a.menge,
        ekPreis: { einzelPreis: a.ek_einzel },
      })
    }

    const anfrage = {
      context: { vorgangstyp: "ANGEBOT" },
      vorgangsdaten: {
        personUUID: EIGENE_FIRMA_ALS_KUNDE,
        bezeichnung: `ZZ-TRANSPORT Aufmass fuer Auftrag ${vorgangsNummer} — nach Kopieren loeschen`,
        selektionskriterien: [{ bezeichnung: "Gewerk", wert: "SHK" }],
        rootEbene: {
          bezeichnung: "Leistungsverzeichnis",
          ebenen: [{
            bezeichnung: `Aufmass fuer ${vorgangsNummer} — Aufmass-App ${heute}`,
            ebeneArt: "NORMAL",
            positionen,
          }],
        },
      },
    }
    const antwort = await pdsRoh("/vorgang/create", anfrage)
    await protokoll("/vorgang/create", anfrage, antwort)
    if (!antwort.ok) {
      return json({ error: `PDS ${antwort.status} @ /vorgang/create: ${antwort.text.slice(0, 500)}`, ...vorschau }, 502)
    }
    const angebotUUID = String(antwort.daten?.uuid ?? "")
    const angebotNummer = String(antwort.daten?.vorgangsNummer ?? "")
    const jetzt = new Date().toISOString()
    if (alleIds.length) {
      await sb.from("aufmass_formteile").update({ pds_transport_at: jetzt }).in("id", alleIds)
    }
    await sb.from("aufmass_erfassung").update({
      pds_transport_uuid: angebotUUID || null,
      pds_transport_nummer: angebotNummer || null,
      pds_transport_at: jetzt, status: "uebertragen",
    }).eq("id", erfassungId)

    return json({
      status: "transport_angelegt",
      angebot: { uuid: angebotUUID, nummer: angebotNummer },
      hinweis: `Angebot ${angebotNummer} bei der Weich GmbH angelegt: im Client in `
        + `Auftrag ${vorgangsNummer} kopieren, danach das Angebot loeschen.`,
      ...vorschau,
    })
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500)
  }
})
