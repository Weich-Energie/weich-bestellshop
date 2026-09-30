// lieferant-suche — Artikelsuche in einem Lieferantenshop, fuer den Knopf
// "Bei <Lieferant> suchen" an einer offenen Aufmasszeile.
//
// Die Shops verlangen einen Login, und ihre Zugaenge liegen verschluesselt im
// Shop. Gesucht wird deshalb nicht von hier, sondern ueber den angemeldeten
// Playwright-Browser auf dem VPS. Diese Function prueft nur Anmeldung und
// Rolle und reicht weiter — dasselbe Muster wie bza-reonic.
//
// Rein lesend: es wird nichts in einen Warenkorb gelegt und nichts bestellt.
// Das Anlegen des Artikels passiert danach im Shop selbst, nach Bestaetigung
// durch einen Menschen. Der Grund steht in docs/nachkalkulation-datenmodell.md:
// ob ein Artikel als Rolle oder als Meter gefuehrt wird, und ob die Nummer auf
// dem Zettel ueberhaupt zum eingebauten Teil gehoert, kann keine Maschine
// entscheiden.
//
// Secrets: WEICH_API_URL, WEICH_API_TOKEN (dieselben wie in der
// Service-Ticket-App; alle Apps teilen ein Supabase-Projekt).

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const fehler = (nachricht: string, status: number) =>
  new Response(JSON.stringify({ error: nachricht }), { status, headers: CORS })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return fehler("Nur POST", 405)

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) return fehler("Nicht autorisiert", 401)

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )
    const { data: userData, error: authErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""))
    if (authErr || !userData?.user) return fehler("Ungültige Sitzung", 401)

    // Die Suche zeigt Einkaufspreise. Im Katalog sieht ein normaler Nutzer
    // bewusst keine Preise (siehe CLAUDE.md), also bleibt auch das hier bei
    // den Shop-Admins.
    const { data: mitarbeiter } = await sb
      .from("employees")
      .select("berechtigungen")
      .eq("email", userData.user.email)
      .maybeSingle()
    const rolle = (mitarbeiter?.berechtigungen as Record<string, unknown> | null)?.rolle
    if (rolle !== "admin") return fehler("Nur für Shop-Admins", 403)

    const basis = (Deno.env.get("WEICH_API_URL") ?? "").replace(/\/+$/, "")
    const token = Deno.env.get("WEICH_API_TOKEN") ?? ""
    if (!basis || !token) return fehler("weich-api ist nicht konfiguriert", 500)

    const body = await req.json().catch(() => ({}))
    const lieferant = String(body?.lieferant ?? "").trim()
    const begriff = String(body?.begriff ?? "").trim()
    if (!lieferant) return fehler("lieferant fehlt", 400)
    if (begriff.length < 3) return fehler("Der Suchbegriff braucht mindestens 3 Zeichen", 400)

    // Der Browserstart plus Seitenaufbau dauert; bei GUT kommt je Treffer ein
    // Seitenwechsel fuer die Bezeichnung dazu. Die Frist liegt ueber der des
    // Dienstes, damit sein eigener Zeitueberlauf durchkommt und nicht hier
    // abgeschnitten wird.
    const steuerung = new AbortController()
    const uhr = setTimeout(() => steuerung.abort(), 100_000)
    let antwort: Response
    try {
      antwort = await fetch(`${basis}/lieferant/suche`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lieferant,
          begriff,
          treffer: Math.min(Math.max(Number(body?.treffer ?? 8) || 8, 1), 20),
          mitBezeichnung: body?.mitBezeichnung !== false,
        }),
        signal: steuerung.signal,
      })
    } catch (e) {
      clearTimeout(uhr)
      const abgebrochen = (e as Error)?.name === "AbortError"
      return fehler(
        abgebrochen
          ? "Der Shop hat zu lange gebraucht. Noch einmal versuchen, oder mit einem genaueren Begriff."
          : `Der Suchdienst ist nicht erreichbar: ${(e as Error).message}`,
        abgebrochen ? 504 : 502,
      )
    }
    clearTimeout(uhr)

    const text = await antwort.text()
    if (!antwort.ok) {
      // Den Status des Dienstes durchreichen: 503 heisst "Sitzung abgelaufen"
      // und braucht eine neue Anmeldung am Shop, kein erneutes Suchen.
      let nachricht = text.slice(0, 300)
      try { nachricht = String(JSON.parse(text)?.fehler ?? nachricht) } catch { /* Rohtext */ }
      return fehler(nachricht, antwort.status)
    }

    return new Response(text, { headers: CORS })
  } catch (e) {
    return fehler(String((e as Error)?.message ?? e), 500)
  }
})
