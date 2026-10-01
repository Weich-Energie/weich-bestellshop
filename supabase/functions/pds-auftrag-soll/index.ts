// pds-auftrag-soll — Liest die Soll-Werte eines Klima-Auftrags aus PDS.
//
// Ausschliesslich lesend. Sie ruft nur /vorgang/listauftraege und
// /vorgang/details auf und schreibt nichts nach PDS zurück. Das Schreiben —
// verbautes Material als Nachtragsauftrag — macht pds-auftrag-nachtrag
// (ADR 0006); der Hauptauftrag bleibt auch dort unverändert.
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
// Firmenstandort Amberg, Fuggerstrasse 23 — derselbe Bezugspunkt wie im
// Klimarechner. Zwei verschiedene Bezugspunkte hiessen zwei verschiedene Zonen
// fuer dieselbe Baustelle, und niemand wuesste, welche gilt.
const BASIS = { lat: 49.4444574, lng: 11.8265056 }

// Zonenmodell des Klimarechners: je Fahrt und Fahrzeug, nicht je Person.
const ZONEN: Array<[number, string, number]> = [
  [15, "Z1", 45],
  [30, "Z2", 90],
  [45, "Z3", 145],
  [60, "Z4", 200],
]

/** Adresse → Fahrzeit ab Amberg → Zone. Best effort: schlaegt ein Schritt
 *  fehl, bleibt die Zone leer und wird von Hand gesetzt. Ein geratener Wert
 *  waere schlimmer als keiner, weil er wie eine Messung aussieht. */
async function zoneErmitteln(adresse: string) {
  try {
    const geo = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(adresse)}`,
      { headers: { accept: "application/json", "user-agent": "weich-bestellshop/1.0" } },
    )
    if (!geo.ok) return null
    const treffer = await geo.json()
    if (!Array.isArray(treffer) || !treffer.length) return null

    const route = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${BASIS.lng},${BASIS.lat};${treffer[0].lon},${treffer[0].lat}?overview=false`,
    )
    if (!route.ok) return null
    const daten = await route.json()
    const sek = daten?.routes?.[0]?.duration
    if (sek == null) return null

    const minuten = Math.round(sek / 60)
    // Ueber 60 Minuten bleibt es bei Z4 — darueber hinaus gibt es im Modell
    // nichts, und der Auftrag gehoert ohnehin angesehen.
    const treffer2 = ZONEN.find(([grenze]) => minuten <= grenze) ?? ZONEN[ZONEN.length - 1]
    return { minuten, zone: treffer2[1], satz: treffer2[2] }
  } catch {
    return null
  }
}

const ERLAUBTE_PFADE = new Set([
  "/vorgang/listauftraege",
  "/vorgang/details",
  "/vorgang/listvorgaengebyprojektakte",
  "/projektakte/details",
])

// Die Weich GmbH ist in PDS selbst als Lieferant angelegt (Lieferantennummer
// 70022). Positionen mit diesem Lieferanten sind Eigenleistungen — Rohrpaket,
// Zuleitung, Gerüststellung. Ihr "Einkaufspreis" ist ein interner Satz, kein
// Einstandspreis, und zählt deshalb nicht als Materialkosten.
const EIGENE_FIRMA_ALS_LIEFERANT = "6139e897-1a04-48fa-bdd5-b9ac2e47ebd2"

// WARUM NICHT ÜBER "EK == VK": Diese Gleichheit ist in PDS der Normalfall, nicht
// die Ausnahme. Am 02.09.2026 am Testartikel nachgemessen: Ein per API mit 4,85 €
// Einkaufspreis angelegter Artikel bekommt die Preisstrategie
// ekEinzelpreis 4.85 / vkEinzelpreis 4.85 — der Einkaufspreis ist dabei
// vollkommen korrekt, es fehlt lediglich der Aufschlag.
//
// Der Klimarechner rechnet VK = EK × (1 + Aufschlag), als Markup und nicht als
// Handelsspanne: 30 % auf Geräte, 35 % auf feste Materialien, 100 % auf
// Verbrauch und Meterware (docs/kalkulationslogik.md im klimarechner). Wo diese
// Aufschläge in PDS nicht als Kalkulationsgruppe hinterlegt sind, bleibt VK = EK.
//
// Eine Erkennung über die Preisgleichheit würde deshalb korrekt erfasste
// Einkaufspreise als unbekannt verwerfen. Die Spanne wird stattdessen als eigene
// Kennzahl ausgewiesen — sie sagt etwas über die Kalkulation, nichts über die
// Belastbarkeit des Einkaufspreises.

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
  kopplungsID?: { superKID?: string | null } | null
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
      "Firma als Lieferant. Ihr ausgewiesener Einkaufspreis ist ein interner Satz, kein " +
      "Einstandspreis — genau hier fehlt das echte Material. " +
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
    const istAdmin = rechte?.rolle === "admin"
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
      const treffer = (liste?.resultList ?? [])
        .map((a: Record<string, any>) => ({
          vorgang_uuid: a.uuid,
          vorgangs_nummer: a.vorgangsNummer,
          bezeichnung: a.bezeichnung,
          status: a.vorgangStatus?.bezeichnung ?? null,
        }))
        // Nachträge (2026-298-N1) erscheinen in der Liste als eigene Aufträge.
        // Sie gehören nicht in die Auswahl: Nachkalkuliert wird der
        // Hauptauftrag, und auf einen Nachtrag darf kein weiterer.
        .filter((t: Record<string, any>) => !/-N\d+$/.test(String(t.vorgangs_nummer ?? "")))

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
        anzahl: treffer.length,
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
      // Positionen mit eigener Firma als Lieferant: Erloes ist echt, der
      // ausgewiesene "Einkaufspreis" ist ein interner Satz.
      const eigenleistung: Array<Record<string, unknown>> = []
      // Positionen mit echtem Fremdeinkauf, aber ohne Aufschlag — verkauft zum
      // Einkaufspreis. Kein Datenfehler, sondern eine Kalkulationsluecke.
      const ohneAufschlagListe: Array<Record<string, unknown>> = []
      // Leistungspositionen sind der Kern des Workarounds: dort wird das Material
      // gesammelt, das nicht als eigene Angebotszeile steht — im Klimarechner der
      // Sammelposten "Montagematerial", in aelteren Auftraegen die Leistung
      // "Vielen Dank fuer Ihren Auftrag". Ihr ekPreis ist der Materialeinstand
      // und damit eine Ist-Zahl, die schon in PDS steht.
      const leistungen: Array<Record<string, unknown>> = []

      for (const p of positionen) {
        const vk = p.vkPreis?.gesamtPreis ?? 0
        const ek = p.ekPreis?.gesamtPreis ?? 0
        const zeile: Record<string, unknown> = {
          nummer: p.nummer ?? null,
          kurztext: p.kurztext ?? null,
          menge: p.menge ?? null,
          einheit: p.masseinheit?.bezeichnung ?? null,
          ek_gesamt: runde(ek),
          vk_gesamt: runde(vk),
          super_kid: p.kopplungsID?.superKID ?? null,
        }

        vkGesamt += vk

        const istLeistung = p.positionsTyp === "LEISTUNG" || p.positionsTyp === "LOHN"
        const istEigenleistung = p.lieferantUUID === EIGENE_FIRMA_ALS_LIEFERANT
        // Nur Beobachtung, kein Ausschlusskriterium: Position mit Einkaufspreis,
        // aber ohne jeden Aufschlag.
        const ohneAufschlag = ek > 0 && Math.abs(ek - vk) < 0.005

        if (istEigenleistung && !istLeistung) {
          // Erloes zaehlt, der ausgewiesene EK nicht. Was hier wirklich verbaut
          // wurde, ist gegenueberzustellen.
          vkEigenleistung += vk
          eigenleistung.push({ ...zeile, grund: "eigene Firma als Lieferant" })
        } else if (istLeistung) {
          // Traegt der Eintrag einen EK, ist das der erfasste Materialeinstand
          // bzw. Lohnkosten — schon eine Ist-Zahl, nicht nur ein Plan.
          ekLeistungen += ek
          vkLeistungen += vk
          leistungen.push({ ...zeile, typ: p.positionsTyp })
        } else if (p.katalogUUID) {
          ekFremd += ek
          vkGeraete += vk
          if (ohneAufschlag) ohneAufschlagListe.push(zeile)
          geraete.push({ ...zeile, katalog_uuid: p.katalogUUID, ohne_aufschlag: ohneAufschlag })
        } else {
          // Freie Textposition ohne Katalogbezug — Montagematerial im aelteren
          // Stil, dort steht EK 0.
          erloesMontage += vk
          montage.push(zeile)
        }
      }

      // ─── Ist-Materialeinkauf aus Bestellung und Wareneingang ──────────────
      // Beide tragen dieselbe projektakteUUID wie der Auftrag, und
      // kopplungsID.superKID ist bei Auftrags-, Bestell- und
      // Wareneingangsposition identisch. Darueber laesst sich positionsgenau
      // vergleichen, was kalkuliert war und was wirklich bezahlt wurde.
      //
      // Notwendig, weil PDS den ekPreis an der Position beim Anlegen kopiert und
      // spaeter nicht nachzieht: Auftrag 2025-10313 fuehrt bis in die bezahlte
      // Rechnung 832,07 Euro als EK, obwohl Bestellung 2025-50445 und
      // Wareneingang 2025-60525 beide 1.650,00 belegen. Ohne diesen Abgleich
      // sieht der Auftrag sauber kalkuliert aus, obwohl 818 Euro Deckung fehlen.
      const projektakteUUID = (det.projektakteUUID as string | undefined) ?? undefined
      const istJeKid = new Map<string, { ek: number; quelle: string; beleg: string }>()

      if (projektakteUUID) {
        // Reihenfolge ist Absicht: der Wareneingang ueberschreibt die Bestellung,
        // weil er sagt, was tatsaechlich geliefert und berechnet wurde.
        for (const typ of ["BESTELLUNG", "WARENEINGANG"]) {
          const liste = await pds("/vorgang/listvorgaengebyprojektakte", {
            projektakteUUID,
            vorgangstyp: typ,
            page: 0,
            entriesPerPage: 100,
          }).catch(() => null)

          for (const kopf of (liste?.resultList ?? []) as Array<Record<string, any>>) {
            const d = await pds("/vorgang/details", { uuid: kopf.uuid, vorgangstyp: typ })
              .catch(() => null)
            if (!d) continue
            const pos: Position[] = []
            sammle((d.rootEbene ?? {}) as Ebene, pos)
            for (const q of pos) {
              const kid = q.kopplungsID?.superKID
              const ek = q.ekPreis?.gesamtPreis ?? 0
              if (!kid || ek <= 0) continue
              istJeKid.set(kid, { ek, quelle: typ, beleg: String(kopf.vorgangsNummer ?? "") })
            }
          }
        }
      }

      // Geraetezeilen um den belegten Einkauf ergaenzen und die effektiven
      // Materialkosten bilden: belegt, wo ein Beleg existiert, sonst kalkuliert.
      let ekEffektiv = 0
      let abweichungMaterial = 0
      let anzahlBelegt = 0

      for (const z of geraete) {
        const kid = z.super_kid as string | null
        const treffer = kid ? istJeKid.get(kid) : undefined
        const kalkuliert = z.ek_gesamt as number
        if (treffer) {
          z.ek_belegt = runde(treffer.ek)
          z.ek_quelle = treffer.quelle === "WARENEINGANG" ? "Wareneingang" : "Bestellung"
          z.ek_beleg = treffer.beleg
          z.abweichung = runde(treffer.ek - kalkuliert)
          ekEffektiv += treffer.ek
          abweichungMaterial += treffer.ek - kalkuliert
          anzahlBelegt++
        } else {
          z.ek_belegt = null
          z.ek_quelle = "nicht belegt — Lagerware oder Bestellung ohne Projektaktenbezug"
          ekEffektiv += kalkuliert
        }
      }

      // Leitgroesse: Gesamterloes minus die Einkaufspreise, die wirklich
      // Einkaufspreise sind. Eigenleistungs-Positionen bleiben aussen vor, weil
      // ihr EK der VK ist — sie abzuziehen wuerde die Deckung um genau ihren
      // eigenen Erloes kuerzen und den Auftrag zu schlecht darstellen.
      const deckungMaterialUndLohn = vkGesamt - ekFremd
      // Dasselbe, aber mit dem belegten Einkauf statt dem kalkulierten. Das ist
      // die Zahl, die zaehlt.
      const deckungIst = vkGesamt - ekEffektiv

      // Was in den Leistungspositionen als EK steht, ist bereits erfasst und
      // muss nicht erneut von Hand eingetragen werden.
      const istBereitsErfasst = ekLeistungen

      // ─── Kalkulationsart vorbelegen ───────────────────────────────────
      // Die Altauftraege wurden in zwei Versionen kalkuliert: mit ausgewiesenen
      // Montagestunden, oder mit den Montagezeiten im Artikelpreis. An der Form
      // der Positionen ist erkennbar, welche vorliegt:
      //   - eine Leistungsposition mit echtem EK sammelt das Material (Muster C)
      //   - eine Montageposition ohne katalogUUID weist die Montage aus (A)
      //   - nur Geraetepositionen heisst: die Zeit steckt im Geraetepreis (B)
      // Vorbelegt, nicht festgelegt — wie damals gerechnet wurde, weiss nur der
      // Betrieb. Ein erneuter Import darf eine Korrektur deshalb nicht
      // ueberschreiben, siehe unten.
      let kalkulationsart = "unbekannt"
      if (ekLeistungen > 0) kalkulationsart = "material_in_leistung"
      else if (erloesMontage > 0 || vkEigenleistung > 0) kalkulationsart = "stunden_ausgewiesen"
      else if (geraete.length > 0) kalkulationsart = "zeit_im_artikel"

      // --- Baustelle und Anfahrtszone --------------------------------------
      // Die Adresse steht nicht am Vorgang, sondern an der Projektakte unter
      // geschaeftspartner.hauptanschrift. Patrick, 01.10.2026: "anfahrt usw
      // kannst du doch schon aus dem projekt errechnen".
      //
      // Vorsicht bei der Bedeutung: das ist die Anschrift des Kunden, nicht
      // zwingend die der Baustelle. Bei einem Vermieter sind das zwei
      // verschiedene Orte. Deshalb wird sie gespeichert und angezeigt, damit
      // sie jemand sehen und korrigieren kann - nicht still verrechnet.
      let baustelleAdresse: string | null = null
      let zoneErgebnis: { minuten: number; zone: string; satz: number } | null = null
      if (projektakteUUID) {
        try {
          const akte = await pds("/projektakte/details", { uuid: projektakteUUID })
          const an = (akte as Record<string, any>)?.geschaeftspartner?.hauptanschrift
          const teile = [an?.strasse, [an?.plz, an?.ort].filter(Boolean).join(" ")]
            .map((t) => String(t ?? "").trim())
            .filter(Boolean)
          if (teile.length) {
            baustelleAdresse = teile.join(", ")
            zoneErgebnis = await zoneErmitteln(baustelleAdresse)
          }
        } catch {
          // Ohne Adresse laeuft der Import weiter - sie ist Zugabe, nicht
          // Voraussetzung.
        }
      }

      const { data: vorhanden } = await sb
        .from("shop_nachkalkulation")
        .select("kalkulationsart, anfahrt_zone, baustelle_adresse")
        .eq("pds_vorgang_uuid", vorgangUUID)
        .maybeSingle()
      // Eine von Hand gesetzte Art bleibt stehen.
      if (vorhanden && vorhanden.kalkulationsart && vorhanden.kalkulationsart !== "unbekannt") {
        kalkulationsart = vorhanden.kalkulationsart
      }

      const { data: gespeichert, error } = await sb
        .from("shop_nachkalkulation")
        .upsert(
          {
            kalkulationsart,
            // Eine von Hand gesetzte Zone bleibt stehen, genau wie die
            // Kalkulationsart: ein erneuter Import darf eine Korrektur nicht
            // ueberschreiben.
            ...(vorhanden?.baustelle_adresse ? {} : (baustelleAdresse ? { baustelle_adresse: baustelleAdresse } : {})),
            ...(vorhanden?.anfahrt_zone || !zoneErgebnis
              ? {}
              : { anfahrt_zone: zoneErgebnis.zone, anfahrt_satz: zoneErgebnis.satz }),
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
            ist_ek_bestellungen: anzahlBelegt > 0 ? runde(ekEffektiv) : null,
            ist_bestellungen_stand: anzahlBelegt > 0 ? new Date().toISOString() : null,
            // Einzelpositionen fuer die Anzeige "was war kalkuliert" neben dem
            // verbauten Material. Nur Anzeige — der Hauptauftrag wird nie
            // veraendert (ADR 0006). Spalte aus Migration 012.
            soll_positionen: { geraete, leistungen, eigenleistung, montage },
          },
          { onConflict: "pds_vorgang_uuid" },
        )
        .select("id, status")
        .single()

      if (error) return json({ error: error.message }, 500)

      return json({
        status: "importiert",
        nachkalkulation_id: gespeichert.id,
        kalkulationsart,
        baustelle: baustelleAdresse,
        anfahrt: zoneErgebnis
          ? { zone: zoneErgebnis.zone, satz: zoneErgebnis.satz, fahrzeit_minuten: zoneErgebnis.minuten }
          : null,
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
        ist: {
          ek_effektiv: runde(ekEffektiv),
          positionen_belegt: anzahlBelegt,
          positionen_ohne_beleg: geraete.length - anzahlBelegt,
          abweichung_material: runde(abweichungMaterial),
          deckung_ist: runde(deckungIst),
        },
        positionen: { geraete, leistungen, eigenleistung, montage, ohne_aufschlag: ohneAufschlagListe },
        hinweis: abweichungMaterial !== 0
          ? `Der belegte Einkauf weicht um ${runde(abweichungMaterial)} Euro von der ` +
            `Kalkulation ab. Deckung nach tatsaechlichem Einkauf: ${runde(deckungIst)} Euro ` +
            `statt kalkuliert ${runde(deckungMaterialUndLohn)}. ` +
            (geraete.length - anzahlBelegt > 0
              ? `${geraete.length - anzahlBelegt} Position(en) ohne Beleg — Lagerware oder ` +
                "Bestellung ohne Projektaktenbezug, dort bleibt der kalkulierte Wert stehen."
              : "Alle Positionen sind ueber Bestellung oder Wareneingang belegt.")
          : bauHinweis({
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
