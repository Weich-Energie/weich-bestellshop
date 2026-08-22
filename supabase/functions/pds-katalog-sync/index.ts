// pds-katalog-sync — Legt einen Shop-Artikel als echten Katalogartikel in PDS an.
//
// Ersetzt das händische Anlegen im PDS-Client, das bisher dazu geführt hat, dass
// dort nur Dummies ohne Katalogverknüpfung stehen und Klimaanlagen nicht
// nachkalkulierbar sind. Der Shop kann Artikel aus Link oder Screenshot per KI
// erkennen und benennen — PDS kann das nicht, also ist der Shop der Anlage-Kanal.
//
// Warum eine Edge Function und nicht der Browser: der PDS-Key liegt in
// integration_secrets, einer Tabelle ohne RLS-Policy, an die nur service_role
// herankommt. Gespiegelt aus weich-energie-app/supabase/functions/pds-preise.
//
// Anders als pds-preise schreibt diese Funktion. Deshalb drei Sicherungen:
//
//   1. WHITELIST — es sind ausschliesslich die vier Katalog-Pfade unten
//      aufrufbar. /katalog/delete steht bewusst nicht darin: gelöscht wird in
//      PDS von Hand oder gar nicht.
//   2. IDEMPOTENZ — angelegt wird nur, wenn pds_katalog_uuid noch null ist. Die
//      UUID wird sofort nach dem create zurückgeschrieben. /katalog/delete
//      greift in PDS nur bei Einträgen ohne Bestand und ohne Verwendung, eine
//      Dublette im Artikelstamm bleibt also für immer stehen.
//   3. PROTOKOLL — jeder Aufruf landet in shop_pds_sync_log, auch der Dry-Run.
//      Ohne das ist nach einem Abbruch nicht feststellbar, was in PDS ankam.
//
// Feld- und ID-Mapping: docs/pds-katalog-mapping.md
// Klima-Warengruppen und Umzugsliste: docs/pds-klima-warengruppen.md

import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
}

// Mehr darf diese Funktion nicht. Ergänzungen gehören begründet, nicht nebenbei.
const ERLAUBTE_PFADE = new Set([
  "/katalog/create",
  "/katalog/addlieferanteneintrag",
  "/katalog/updateAbbildung",
  "/katalog/update",
])

// PDS erwartet in massEinheit eine Zeichenkette, die exakt einer vorhandenen
// Maßeinheit entspricht. Die Zuordnung steht in shop_pds_einheiten; dieser
// Fallback greift nur, falls die Tabelle einen Wert nicht kennt — dann wird
// nicht geraten, sondern abgebrochen.
const MWST_ALLGEMEIN = "67ea2b65-ba85-4023-9296-a53ad35a5865" // 19 %, nicht die PV-0-%-Gruppe

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

type Artikel = {
  id: string
  name: string
  beschreibung: string | null
  artikelnr: string | null
  einheit: string | null
  preis_netto: number | null
  bild_url: string | null
  aktiv: boolean
  pds_katalog_uuid: string | null
  kategorie_id: string | null
  lieferant_id: string | null
  lieferant: string | null
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
    const nutzerId = userData.user.id

    // Diese Funktion laeuft mit service_role und umgeht RLS, prueft die
    // Berechtigung also selbst — fail-closed, wie in lieferant-zugang.
    const { data: profil } = await sb
      .from("employees")
      .select("berechtigungen")
      .eq("email", userData.user.email)
      .single()

    const rechte = (profil?.berechtigungen ?? {}) as Record<string, any>
    const istAdmin = rechte?.app_access?.bestellshop_admin === true || rechte?.rolle === "admin"
    if (!istAdmin) return json({ error: "Nur Shop-Admins duerfen nach PDS uebertragen" }, 403)

    const body = await req.json().catch(() => ({}))
    const artikelId = String(body?.artikel_id ?? "").trim()
    // Standard ist der Trockenlauf. Schreiben muss ausdrücklich verlangt werden.
    const dryRun = body?.dry_run !== false
    if (!artikelId) return json({ error: "artikel_id fehlt" }, 400)

    // ─── Artikel samt Mapping laden ─────────────────────────────────────────
    const { data: artikel } = await sb
      .from("shop_artikel")
      .select(
        "id, name, beschreibung, artikelnr, einheit, preis_netto, bild_url, aktiv, " +
          "pds_katalog_uuid, kategorie_id, lieferant_id, lieferant",
      )
      .eq("id", artikelId)
      .maybeSingle<Artikel>()

    if (!artikel) return json({ error: "Artikel nicht gefunden" }, 404)

    if (artikel.pds_katalog_uuid) {
      // Kein Fehler, sondern der Normalfall bei einem zweiten Klick.
      return json({
        status: "bereits_uebertragen",
        pds_katalog_uuid: artikel.pds_katalog_uuid,
        hinweis: "Dieser Artikel steht schon in PDS. Ein zweiter Aufruf wuerde eine Dublette anlegen.",
      })
    }

    // ─── Mapping pruefen, statt zu raten ────────────────────────────────────
    const luecken: string[] = []

    const { data: kategorie } = artikel.kategorie_id
      ? await sb
          .from("shop_kategorien")
          .select("name, pds_kategorie_uuid, pds_warengruppe_uuid")
          .eq("id", artikel.kategorie_id)
          .maybeSingle()
      : { data: null }

    if (!kategorie) luecken.push("Artikel hat keine Shop-Kategorie")
    else {
      if (!kategorie.pds_warengruppe_uuid) {
        luecken.push(
          `Kategorie "${kategorie.name}" hat keine PDS-Warengruppe. Fuer Klima sind die ` +
            "(KLIMA)-Warengruppen zuerst in PDS von Hand anzulegen — siehe docs/pds-klima-warengruppen.md",
        )
      }
      if (!kategorie.pds_kategorie_uuid) {
        luecken.push(`Kategorie "${kategorie.name}" hat keine PDS-Katalogkategorie`)
      }
    }

    const { data: einheit } = artikel.einheit
      ? await sb
          .from("shop_pds_einheiten")
          .select("pds_bezeichnung")
          .eq("shop_einheit", artikel.einheit)
          .maybeSingle()
      : { data: null }

    if (!einheit) {
      luecken.push(
        `Einheit "${artikel.einheit ?? "(leer)"}" ist in shop_pds_einheiten nicht zugeordnet. ` +
          "PDS fuehrt vier Stueck- und vier Meter-Varianten parallel; geraten wird hier nicht.",
      )
    }

    const { data: lieferant } = artikel.lieferant_id
      ? await sb
          .from("shop_lieferanten")
          .select("name, pds_person_uuid")
          .eq("id", artikel.lieferant_id)
          .maybeSingle()
      : { data: null }

    // Ohne Lieferant entsteht ein Artikel, der in PDS nicht nachbestellbar ist —
    // genau das Problem, das dieser Sync loesen soll.
    if (!lieferant?.pds_person_uuid) {
      luecken.push(
        artikel.lieferant_id
          ? `Lieferant "${lieferant?.name}" hat keine PDS-Person hinterlegt`
          : `Artikel hat keinen Lieferanten-Bezug (Freitext: "${artikel.lieferant ?? "leer"}")`,
      )
    }

    // ─── Nutzlasten bauen ───────────────────────────────────────────────────
    const { data: gebinde } = await sb
      .from("shop_artikel_gebinde")
      .select("stueckzahl")
      .eq("artikel_id", artikel.id)
      .eq("ist_default", true)
      .maybeSingle()

    const createRumpf: Record<string, unknown> = {
      name: artikel.name,
      typ: "ARTIKEL",
      suchwort: artikel.name,
      kurztext: artikel.name,
      langtext: artikel.beschreibung ?? artikel.name,
      massEinheit: einheit?.pds_bezeichnung,
      preisEinheit: 1,
      kategorieUUID: kategorie?.pds_kategorie_uuid,
      warengruppeUUID: kategorie?.pds_warengruppe_uuid,
      mwstTypUUID: MWST_ALLGEMEIN,
      // kostengruppe, kalkulationsgruppe und Kostenarten bleiben leer — sie sind
      // im Mandanten durchgaengig ungepflegt, siehe docs/pds-katalog-mapping.md.
    }

    // Der EK-Preis geht ausschliesslich hier hinein. Weder create noch update
    // haben ein Preisfeld, ein VK-Preis ist per API gar nicht setzbar.
    const lieferantRumpf: Record<string, unknown> = {
      lieferantUUID: lieferant?.pds_person_uuid,
      bestellnummer: artikel.artikelnr ?? "",
      verpackungsmenge: gebinde?.stueckzahl ?? null,
      einkaufspreis: {
        preiseinheit: 1,
        standardpreis: artikel.preis_netto ?? 0,
      },
      standard: true,
    }

    async function protokoll(
      operation: string,
      request: unknown,
      response: unknown,
      httpStatus: number | null,
      erfolg: boolean,
      fehler: string | null,
    ) {
      await sb.from("shop_pds_sync_log").insert({
        artikel_id: artikel.id,
        operation,
        dry_run: dryRun,
        request,
        response,
        http_status: httpStatus,
        erfolg,
        fehler,
        created_by: nutzerId,
      })
    }

    if (luecken.length > 0) {
      await protokoll("pruefung", { createRumpf, lieferantRumpf }, { luecken }, null, false, luecken.join("; "))
      await sb
        .from("shop_artikel")
        .update({ pds_sync_status: "fehler", pds_sync_fehler: luecken.join("; ") })
        .eq("id", artikel.id)
      return json({ status: "mapping_unvollstaendig", luecken }, 422)
    }

    if (dryRun) {
      await protokoll("pruefung", { createRumpf, lieferantRumpf }, null, null, true, null)
      await sb
        .from("shop_artikel")
        .update({ pds_sync_status: "bereit", pds_sync_fehler: null })
        .eq("id", artikel.id)
      return json({
        status: "trockenlauf",
        hinweis: "Nichts an PDS gesendet. Fuer die echte Uebertragung dry_run: false setzen.",
        wuerde_senden: {
          "/katalog/create": createRumpf,
          "/katalog/addlieferanteneintrag": { katalogUUID: "(aus create)", ...lieferantRumpf },
        },
      })
    }

    // ─── Ab hier wird geschrieben ───────────────────────────────────────────
    const { data: secret } = await sb
      .from("integration_secrets")
      .select("value")
      .eq("key", "pds")
      .maybeSingle()

    const cfg = secret?.value as { api_key?: string; base_url?: string } | undefined
    if (!cfg?.api_key || !cfg?.base_url) return json({ error: "Keine PDS-Zugangsdaten hinterlegt" }, 503)

    const basis = cfg.base_url.replace(/\/$/, "")
    const kopf = {
      "authorization": "Bearer " + cfg.api_key.trim(),
      "content-type": "application/json",
      "accept": "application/json",
    }

    async function pds(pfad: string, rumpf: unknown) {
      if (!ERLAUBTE_PFADE.has(pfad)) throw new Error(`Pfad ${pfad} ist nicht freigegeben`)
      const r = await fetch(basis + pfad, { method: "POST", headers: kopf, body: JSON.stringify(rumpf) })
      const text = await r.text()
      let daten: unknown = null
      try {
        daten = text ? JSON.parse(text) : null
      } catch {
        daten = { rohtext: text }
      }
      await protokoll(pfad, rumpf, daten, r.status, r.ok, r.ok ? null : text.slice(0, 2000))
      if (!r.ok) throw new Error(`PDS ${r.status} @ ${pfad}: ${text.slice(0, 500)}`)
      return daten as Record<string, unknown>
    }

    let katalogUUID: string
    try {
      const angelegt = await pds("/katalog/create", createRumpf)
      katalogUUID = String(angelegt?.uuid ?? "")
      if (!katalogUUID) throw new Error("PDS hat keine uuid zurueckgegeben")
    } catch (e) {
      await sb
        .from("shop_artikel")
        .update({ pds_sync_status: "fehler", pds_sync_fehler: String(e instanceof Error ? e.message : e) })
        .eq("id", artikel.id)
      return json({ status: "fehler", schritt: "create", fehler: String(e instanceof Error ? e.message : e) }, 502)
    }

    // Sofort zurueckschreiben, noch vor dem Lieferanteneintrag. Bricht der
    // naechste Schritt ab, ist der Artikel in PDS trotzdem auffindbar und wird
    // nicht ein zweites Mal angelegt.
    await sb
      .from("shop_artikel")
      .update({
        pds_katalog_uuid: katalogUUID,
        pds_sync_status: "gesynct",
        pds_sync_at: new Date().toISOString(),
        pds_sync_fehler: null,
      })
      .eq("id", artikel.id)

    const warnungen: string[] = []

    try {
      await pds("/katalog/addlieferanteneintrag", { katalogUUID, ...lieferantRumpf })
    } catch (e) {
      // Der Artikel steht in PDS, ist aber noch nicht nachbestellbar. Kein
      // Abbruch mit Fehlerstatus, sonst wuerde ein erneuter Lauf einen zweiten
      // Katalogeintrag anlegen wollen.
      warnungen.push(`Lieferanteneintrag fehlgeschlagen: ${e instanceof Error ? e.message : e}`)
      await sb
        .from("shop_artikel")
        .update({ pds_sync_fehler: warnungen.join("; ") })
        .eq("id", artikel.id)
    }

    return json({
      status: "uebertragen",
      pds_katalog_uuid: katalogUUID,
      warnungen,
      hinweis: artikel.bild_url
        ? "Bild wurde nicht uebertragen — /katalog/updateAbbildung ist noch nicht angebunden."
        : undefined,
    })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
