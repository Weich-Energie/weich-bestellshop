// aufmass-auftrag-suche — PDS-Auftrag zu einer Baustelle finden, damit die
// Aufmass-App eine Erfassung mit pds_vorgang_uuid verknuepfen kann
// (Ziel-Schritt 4: "je Baustelle/PDS-Auftrag").
//
// Rein lesend, zwei Pfade: Projektakten nach Suchwort, dann je Akte die
// Auftraege. Liefert eine kompakte Kandidatenliste; der Monteur waehlt.
// Zugriff: jeder mit app_access.aufmass (oder Shop-Admin) — es sind dieselben
// Kundendaten, die der Monteur auf dem Auftragszettel hat.

import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
const ERLAUBTE_PFADE = new Set(["/projektakte/listprojektakten", "/vorgang/listvorgaengebyprojektakte"])
const MAX_AKTEN = 10

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}
function anschrift(a: any): string | null {
  if (!a) return null
  const teile = [a.strasse, [a.plz, a.ort].filter(Boolean).join(" ")].filter(Boolean)
  return teile.length ? teile.join(", ") : null
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

    // fail-closed: nur wer die Aufmass-App betreten darf (oder Shop-Admin ist)
    const { data: profil } = await sb.from("employees").select("berechtigungen").eq("email", userData.user.email).single()
    const rechte = (profil?.berechtigungen ?? {}) as Record<string, any>
    const darf = rechte?.app_access?.aufmass === true || rechte?.app_access?.bestellshop_admin === true || rechte?.rolle === "admin"
    if (!darf) return json({ error: "Kein Zugang zur Aufmass-App" }, 403)

    const body = await req.json().catch(() => ({}))
    const suchwort = String(body?.suchwort ?? "").trim()
    if (suchwort.length < 2) return json({ error: "suchwort (mind. 2 Zeichen) fehlt" }, 400)

    const { data: secret } = await sb.from("integration_secrets").select("value").eq("key", "pds").maybeSingle()
    const cfg = secret?.value as { api_key?: string; base_url?: string } | undefined
    if (!cfg?.api_key || !cfg?.base_url) return json({ error: "Keine PDS-Zugangsdaten hinterlegt" }, 503)
    const basis = cfg.base_url.replace(/\/$/, "")

    async function pds(pfad: string, rumpf: unknown): Promise<any> {
      if (!ERLAUBTE_PFADE.has(pfad)) throw new Error(`Pfad ${pfad} ist nicht freigegeben`)
      const r = await fetch(basis + pfad, {
        method: "POST",
        headers: { authorization: "Bearer " + cfg!.api_key!.trim(), "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(rumpf),
      })
      const text = await r.text()
      if (!r.ok) throw new Error(`PDS ${r.status} @ ${pfad}: ${text.slice(0, 300)}`)
      try { return text ? JSON.parse(text) : null } catch { throw new Error(`PDS-Antwort kein JSON @ ${pfad}`) }
    }

    const akten = await pds("/projektakte/listprojektakten", { suchwort, suchfelder: ["ALLES"], entriesPerPage: 50 })
    const treffer: any[] = akten?.resultList ?? []
    if (!treffer.length) return json({ treffer: 0, kandidaten: [], hinweis: `Keine Projektakte für „${suchwort}" gefunden.` })

    const kandidaten = []
    for (const akte of treffer.slice(0, MAX_AKTEN)) {
      const auftraege = await pds("/vorgang/listvorgaengebyprojektakte", {
        projektakteUUID: akte.uuid, vorgangstyp: "AUFTRAG", entriesPerPage: 50,
      })
      const liste: any[] = auftraege?.resultList ?? []
      kandidaten.push({
        projektakte_uuid: akte.uuid,
        projektakte_nummer: akte.nummer ?? null,
        name: akte.geschaeftspartner?.name ?? akte.geschaeftspartner?.anzeigename ?? akte.name ?? null,
        anschrift: anschrift(akte.geschaeftspartner?.hauptanschrift ?? akte.hauptanschrift),
        auftraege: liste.map((v) => ({
          uuid: v.uuid,
          vorgangs_nummer: v.vorgangsNummer ?? v.nummer ?? null,
          beleg_datum: v.belegDatum ?? v.datum ?? null,
          bezeichnung: v.bezeichnung ?? null,
        })),
      })
    }

    return json({
      treffer: treffer.length,
      gezeigt: kandidaten.length,
      kandidaten,
      hinweis: treffer.length > MAX_AKTEN ? `„${suchwort}" trifft ${treffer.length} Projektakten — nur die ersten ${MAX_AKTEN} gezeigt, Suche eingrenzen.` : undefined,
    })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502)
  }
})
