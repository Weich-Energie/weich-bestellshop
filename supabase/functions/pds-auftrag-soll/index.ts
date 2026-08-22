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
// Warum die Aufteilung Geräte gegen Montage: die Gerätepositionen tragen eine
// katalogUUID und echte Einkaufspreise, die Montagematerial-Positionen sind
// freie Textpositionen mit EK 0,00. Ein geplanter Materialeinsatz existiert
// also nicht — verglichen wird der Erlös dieser Positionen gegen das, was
// tatsächlich verbaut wurde. Hergeleitet in docs/nachkalkulation-datenmodell.md.
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

type Position = {
  nummer?: string
  kurztext?: string
  menge?: number
  katalogUUID?: string | null
  positionsTyp?: string
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
      let ekGeraete = 0
      let vkGeraete = 0

      const montage: Array<Record<string, unknown>> = []
      const geraete: Array<Record<string, unknown>> = []

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

        // Die Trennlinie ist der Katalogbezug: Positionen ohne katalogUUID sind
        // die freien Textpositionen fuer Montagematerial.
        if (p.katalogUUID) {
          ekGeraete += ek
          vkGeraete += vk
          geraete.push({ ...zeile, katalog_uuid: p.katalogUUID })
        } else {
          erloesMontage += vk
          montage.push(zeile)
        }
      }

      // Leitgroesse ueber beide Auftragsmuster: was nach dem Geraeteeinkauf
      // uebrig bleibt, muss Montagematerial, Lohn und Gewinn tragen. Bei
      // Auftraegen ohne eigene Montageposition ist erloesMontage null, diese
      // Groesse aber nicht.
      const deckungMaterialUndLohn = vkGesamt - ekGeraete

      const { data: gespeichert, error } = await sb
        .from("shop_nachkalkulation")
        .upsert(
          {
            pds_vorgang_uuid: vorgangUUID,
            pds_vorgangs_nummer: det.vorgangsNummer ?? "",
            bezeichnung: det.bezeichnung ?? "",
            soll_vk_gesamt: runde(vkGesamt),
            soll_ek_geraete: runde(ekGeraete),
            soll_vk_geraete: runde(vkGeraete),
            soll_erloes_montage: runde(erloesMontage),
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
          ek_geraete: runde(ekGeraete),
          vk_geraete: runde(vkGeraete),
          erloes_montage: runde(erloesMontage),
          deckung_material_und_lohn: runde(deckungMaterialUndLohn),
        },
        positionen: { geraete, montage },
        hinweis:
          montage.length > 0
            ? `${montage.length} eigene Montagepositionen mit ${runde(erloesMontage)} Euro Erloes ` +
              "und 0 Euro geplantem Materialeinsatz."
            : "Keine eigene Montageposition — die Montage steckt im Geraete-Verkaufspreis. " +
              `Zu vergleichen ist der Rest nach Geraeteeinkauf: ${runde(deckungMaterialUndLohn)} Euro.`,
      })
    }

    return json({ error: 'aktion muss "suchen" oder "importieren" sein' }, 400)
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502)
  }
})
