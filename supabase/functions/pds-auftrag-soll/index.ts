// pds-auftrag-soll — Liest die Soll-Werte eines Klima-Auftrags aus PDS.
//
// Ausschliesslich lesend. Sie ruft nur /vorgang/listauftraege und
// /vorgang/details auf und schreibt nichts nach PDS zurück — der Kundenauftrag
// bleibt unberührt, dort steht bewusst eine Pauschale für Montagematerial.
//
// Zwei Aktionen:
//   { aktion: "suchen",   suchwort }        -> Auftragsliste zur Auswahl
//   { aktion: "importieren", vorgang_uuid } -> Soll-Werte in shop_nachkalkulation
//
// Die Positionen werden in vier Gruppen geteilt, weil die Klima-Aufträge über
// die Jahre unterschiedlich erfasst wurden (docs/nachkalkulation-datenmodell.md):
//
//   geraete       — ARTIKEL mit katalogUUID und echtem Fremdlieferanten-EK
//   eigenleistung — eigene Firma als Lieferant oder EK gleich VK. Ihr Erlös ist
//                   echt, ihr ausgewiesener EK ist keiner. Genau hier fehlt das
//                   verbaute Material.
//   leistungen    — LEISTUNG oder LOHN. Trägt die Position einen ekPreis, ist das
//                   der Materialeinstand und schon eine Ist-Zahl.
//   montage       — freie Textpositionen ohne Katalogbezug, EK 0,00 (älterer Stil)
//
// Leitgrösse: Gesamt-VK minus die Einkaufspreise, die wirklich Einkaufspreise
// sind. Das ist der Betrag, aus dem Material, Lohn und Gewinn bezahlt werden.
//
// PDS-Key aus integration_secrets, Muster wie in pds-katalog-sync.

import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
}

// Diese Funktion darf nur lesen. Beide Pfade sind GET-artige Abfragen, die PDS
// als POST erwartet — ein schreibender Pfad hat hier nichts zu suchen.
const ERLAUBTE_PFADE = new Set(["/vorgang/listauftraege", "/vorgang/details"])

// Die Weich GmbH ist in PDS selbst als Lieferant angelegt (Lieferantennummer
// 70022). Positionen mit diesem Lieferanten sind Eigenleistungen — Rohrpaket,
// Zuleitung, Gerüststellung. Bei ihnen steht im Katalog der Verkaufspreis auch
// im Einkaufspreis (nachgewiesen an "Zuleitung(230V) inkl. Kanal":
// ekEinzelpreis 25.00 gegen vkEinzelpreis 25). Ihr ekPreis ist deshalb KEIN
// Einstandspreis und darf nicht als Materialkosten zählen.
const EIGENE_FIRMA_ALS_LIEFERANT = "6139e897-1a04-48fa-bdd5-b9ac2e47ebd2"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

type Position = {
  nummer?: string
  kurztext?: string
  menge?: number
  katalogUUID?: string | null
  positionsTyp?: string
  lieferantUUID?: string | null
  masseinheit?: { bezeichnung?: string } | null
  ekPreis?: { gesamtPreis?: number } | null
  vkPreis?: { gesamtPreis?: number } | null
}

type Ebene = { bezeichnung?: string; positionen?: Position[]; ebenen?: Ebene[] }

// Rekursiv, weil die Ebenentiefe nicht garantiert ist. Klima-Aufträge haben
// derzeit eine Ebene, verlassen darf man sich darauf nicht.
function sammle(e: Ebene, raus: Position[]) {
  for (const p of e.positionen ?? []) raus.push(p)
  for (const kind of e.ebenen ?? []) sammle(kind, raus)
}

function runde(n: number) {
  return Math.round(n * 100) / 100
}

// Sagt in einem Satz, welcher Erfassungsart dieser Auftrag folgt und was daraus
// fuer die Nachkalkulation zu tun ist. Die drei Arten stehen in
// docs/nachkalkulation-datenmodell.md.
function bauHinweis(z: {
  anzahlLeistungen: number
  anzahlMontage: number
  istBereitsErfasst: number
  erloesMontage: number
  deckung: number
  anzahlEigenleistung: number
  vkEigenleistung: number
}) {
  if (z.anzahlEigenleistung > 0) {
    return (
      `${z.anzahlEigenleistung} Positionen mit ${z.vkEigenleistung} Euro Erloes tragen die eigene ` +
      "Firma als Lieferant oder einen Einkaufspreis in Hoehe des Verkaufspreises — ihr " +
      "ausgewiesener EK ist kein Einstandspreis. Genau hier fehlt das echte Material. " +
      `Zu deckende Summe: ${z.deckung} Euro.`
    )
  }
  if (z.istBereitsErfasst > 0) {
    return (
      `${z.anzahlLeistungen} Leistungspositionen mit ${z.istBereitsErfasst} Euro Einstandspreis. ` +
      "Der Materialeinstand ist hier schon im Auftrag erfasst — von Hand nachzutragen ist nur, " +
      "was darin fehlt."
    )
  }
  if (z.anzahlLeistungen > 0) {
    return (
      `${z.anzahlLeistungen} Leistungspositionen, aber ohne Einstandspreis. Genau hier gehoert ` +
      `das verbaute Material hinterlegt. Zu deckende Summe: ${z.deckung} Euro.`
    )
  }
  if (z.anzahlMontage > 0) {
    return (
      `${z.anzahlMontage} freie Montagepositionen mit ${z.erloesMontage} Euro Erloes und ohne ` +
      "Einstandspreis. Das Material ist vollstaendig nachzutragen."
    )
  }
  return (
    "Nur Geraetepositionen — Montage und Material stecken im Geraete-Verkaufspreis (aelterer " +
    `Stil). Zu deckende Summe nach Geraeteeinkauf: ${z.deckung} Euro.`
  )
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

    // Laeuft mit service_role und umgeht RLS, prueft die Berechtigung also
    // selbst — fail-closed. Nachkalkulation zeigt EK-Preise und Margen.
    const { data: profil } = await sb
      .from("employees")
      .select("berechtigungen")
      .eq("email", userData.user.email)
      .single()

    const rechte = (profil?.berechtigungen ?? {}) as Record<string, any>
    const istAdmin = rechte?.app_access?.bestellshop_admin === true || rechte?.rolle === "admin"
    if (!istAdmin) return json({ error: "Nur Shop-Admins duerfen nachkalkulieren" }, 403)

    const body = await req.json().catch(() => ({}))
    const aktion = String(body?.aktion ?? "").trim()

    const { data: secret } = await sb
      .from("integration_secrets")
      .select("value")
      .eq("key", "pds")
      .maybeSingle()

    const cfg = secret?.value as { api_key?: string; base_url?: string } | undefined
    if (!cfg?.api_key || !cfg?.base_url) return json({ error: "Keine PDS-Zugangsdaten hinterlegt" }, 503)

    const basis = cfg.base_url.replace(/\/$/, "")
    async function pds(pfad: string, rumpf: unknown) {
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
      if (!r.ok) throw new Error(`PDS ${r.status} @ ${pfad}: ${text.slice(0, 500)}`)
      return text ? JSON.parse(text) : null
    }

    // ─── Suchen ─────────────────────────────────────────────────────────────
    if (aktion === "suchen") {
      const suchwort = String(body?.suchwort ?? "Klima").trim()
      const liste = await pds("/vorgang/listauftraege", {
        page: 0,
        entriesPerPage: 100,
        suchwort,
      })

      // Nur das Nötige zurückgeben. Die Antwort von PDS enthält auch
      // Personenbezüge, die im Frontend hier nichts zu suchen haben.
      const treffer = (liste?.resultList ?? []).map((a: Record<string, any>) => ({
        vorgang_uuid: a.uuid,
        vorgangs_nummer: a.vorgangsNummer,
        bezeichnung: a.bezeichnung,
        status: a.vorgangStatus?.bezeichnung ?? null,
      }))

      // Schon importierte Aufträge markieren, damit keiner zweimal angefasst wird.
      const { data: vorhanden } = await sb
        .from("shop_nachkalkulation")
        .select("pds_vorgang_uuid, status")

      const bekannt = new Map<string, string>(
        (vorhanden ?? []).map((n: { pds_vorgang_uuid: string; status: string }) => [
          n.pds_vorgang_uuid,
          n.status,
        ]),
      )

      return json({
        anzahl: liste?.totalHitCount ?? treffer.length,
        auftraege: treffer.map((t: Record<string, any>) => ({
          ...t,
          nachkalkulation: bekannt.get(t.vorgang_uuid) ?? null,
        })),
        hinweis:
          "Die Trefferliste kommt aus einer Textsuche im Auftragstitel. PDS kann " +
          "nicht nach Gewerk oder Warengruppe filtern, deshalb ist die Liste zu " +
          "bestaetigen und nicht vollstaendig.",
      })
    }

    // ─── Importieren ────────────────────────────────────────────────────────
    if (aktion === "importieren") {
      const vorgangUUID = String(body?.vorgang_uuid ?? "").trim()
      if (!vorgangUUID) return json({ error: "vorgang_uuid fehlt" }, 400)

      const det = await pds("/vorgang/details", { uuid: vorgangUUID, vorgangstyp: "AUFTRAG" })
      if (!det?.uuid) return json({ error: "Auftrag nicht gefunden" }, 404)

      const positionen: Position[] = []
      sammle((det.rootEbene ?? {}) as Ebene, positionen)

      let vkGesamt = 0
      let erloesMontage = 0
      let ekFremd = 0        // nur echte Fremdeinkaeufe
      let vkGeraete = 0
      let ekLeistungen = 0
      let vkLeistungen = 0
      let vkEigenleistung = 0

      const montage: Array<Record<string, unknown>> = []
      const geraete: Array<Record<string, unknown>> = []
      // Positionen, deren ekPreis kein Einstandspreis ist: eigene Firma als
      // Lieferant oder EK gleich VK. Ihr Erloes ist echt, ihre Kosten nicht.
      const eigenleistung: Array<Record<string, unknown>> = []
      // Leistungspositionen sind der Kern des Workarounds: dort wird das Material
      // gesammelt, das nicht als eigene Angebotszeile steht — im Klimarechner der
      // Sammelposten "Montagematerial", in aelteren Auftraegen die Leistung
      // "Vielen Dank fuer Ihren Auftrag". Ihr ekPreis ist der Materialeinstand
      // und damit eine Ist-Zahl, die schon in PDS steht.
      const leistungen: Array<Record<string, unknown>> = []

      for (const p of positionen) {
        const vk = p.vkPreis?.gesamtPreis ?? 0
        const ek = p.ekPreis?.gesamtPreis ?? 0
        const zeile = {
          nummer: p.nummer ?? null,
          kurztext: p.kurztext ?? null,
          menge: p.menge ?? null,
          einheit: p.masseinheit?.bezeichnung ?? null,
          ek_gesamt: runde(ek),
          vk_gesamt: runde(vk),
        }

        vkGesamt += vk

        const istLeistung = p.positionsTyp === "LEISTUNG" || p.positionsTyp === "LOHN"
        const istEigenleistung =
          p.lieferantUUID === EIGENE_FIRMA_ALS_LIEFERANT || (ek > 0 && Math.abs(ek - vk) < 0.005)

        if (istEigenleistung && !istLeistung) {
          // Erloes zaehlt, der ausgewiesene EK nicht. Was hier wirklich verbaut
          // wurde, ist gegenueberzustellen.
          vkEigenleistung += vk
          eigenleistung.push({
            ...zeile,
            grund: p.lieferantUUID === EIGENE_FIRMA_ALS_LIEFERANT
              ? "eigene Firma als Lieferant"
              : "Einkaufspreis gleich Verkaufspreis",
          })
        } else if (istLeistung) {
          // Traegt der Eintrag einen EK, ist das der erfasste Materialeinstand
          // bzw. Lohnkosten — schon eine Ist-Zahl, nicht nur ein Plan.
          ekLeistungen += ek
          vkLeistungen += vk
          leistungen.push({ ...zeile, typ: p.positionsTyp })
        } else if (p.katalogUUID) {
          ekFremd += ek
          vkGeraete += vk
          geraete.push({ ...zeile, katalog_uuid: p.katalogUUID })
        } else {
          // Freie Textposition ohne Katalogbezug — Montagematerial im aelteren
          // Stil, dort steht EK 0.
          erloesMontage += vk
          montage.push(zeile)
        }
      }

      // Leitgroesse: Gesamterloes minus die Einkaufspreise, die wirklich
      // Einkaufspreise sind. Eigenleistungs-Positionen bleiben aussen vor, weil
      // ihr EK der VK ist — sie abzuziehen wuerde die Deckung um genau ihren
      // eigenen Erloes kuerzen und den Auftrag zu schlecht darstellen.
      const deckungMaterialUndLohn = vkGesamt - ekFremd

      // Was in den Leistungspositionen als EK steht, ist bereits erfasst und
      // muss nicht erneut von Hand eingetragen werden.
      const istBereitsErfasst = ekLeistungen

      const { data: gespeichert, error } = await sb
        .from("shop_nachkalkulation")
        .upsert(
          {
            pds_vorgang_uuid: vorgangUUID,
            pds_vorgangs_nummer: det.vorgangsNummer ?? "",
            bezeichnung: det.bezeichnung ?? "",
            pds_projektakte_uuid: det.projektakteUUID ?? null,
            soll_vk_gesamt: runde(vkGesamt),
            soll_ek_geraete: runde(ekFremd),
            soll_vk_geraete: runde(vkGeraete),
            soll_erloes_montage: runde(erloesMontage),
            soll_ek_leistungen: runde(ekLeistungen),
            soll_vk_leistungen: runde(vkLeistungen),
            soll_stand: new Date().toISOString(),
          },
          { onConflict: "pds_vorgang_uuid" },
        )
        .select("id, status")
        .single()

      if (error) return json({ error: error.message }, 500)

      return json({
        status: "importiert",
        nachkalkulation_id: gespeichert.id,
        soll: {
          vk_gesamt: runde(vkGesamt),
          ek_fremdeinkauf: runde(ekFremd),
          vk_geraete: runde(vkGeraete),
          vk_eigenleistung: runde(vkEigenleistung),
          erloes_montage: runde(erloesMontage),
          ek_leistungen: runde(ekLeistungen),
          vk_leistungen: runde(vkLeistungen),
          deckung_material_und_lohn: runde(deckungMaterialUndLohn),
          ist_bereits_erfasst: runde(istBereitsErfasst),
        },
        positionen: { geraete, leistungen, eigenleistung, montage },
        hinweis: bauHinweis({
          anzahlLeistungen: leistungen.length,
          anzahlMontage: montage.length,
          istBereitsErfasst: runde(istBereitsErfasst),
          erloesMontage: runde(erloesMontage),
          deckung: runde(deckungMaterialUndLohn),
          anzahlEigenleistung: eigenleistung.length,
          vkEigenleistung: runde(vkEigenleistung),
        }),
      })
    }

    return json({ error: 'aktion muss "suchen" oder "importieren" sein' }, 400)
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502)
  }
})
