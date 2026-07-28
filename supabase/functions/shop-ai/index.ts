// shop-ai — KI-Support fuer Bestellshop.
// Task-Routing: enrich_artikel + analyze_bedarf_bild.
// Modell-Politik (siehe ADR 0003): Sonnet 4.6 fuer beide Tasks — Konsistenz + bessere
// Qualitaet bei Kategorie/Tag-Matching und Vision-Praezision. Kosten pro Aufruf bleiben
// bei einem internen Shop absolut vernachlaessigbar (~$0.01). Haiku waere fuer spaetere
// Live-Suggestion-Szenarien oder Bot-Klick-Entscheidungen die richtige Wahl.
// JWT-Auth ueber Supabase getUser. Anthropic-Key aus Env (shared mit ai-chat/ai-analyze).

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const API_URL = "https://api.anthropic.com/v1/messages"

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
}

const HAIKU = "claude-haiku-4-5"
const SONNET = "claude-sonnet-4-6"
// Modell-Zuordnung pro Task (siehe Kommentar in enrichArtikel/analyzeBedarfBild).
const MODEL_ENRICH = SONNET
const MODEL_VISION = SONNET

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[])
  }
  return btoa(binary)
}

// Extrahiert JSON-Objekt aus einem Textbausch (Modell kann manchmal Prosa vorne/hinten haben).
function extractJson(text: string): any | null {
  const firstBrace = text.indexOf("{")
  const lastBrace = text.lastIndexOf("}")
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null
  const candidate = text.slice(firstBrace, lastBrace + 1)
  try { return JSON.parse(candidate) } catch { return null }
}

async function callClaude(model: string, systemPrompt: string, messages: any[], maxTokens = 1024) {
  const ak = Deno.env.get("ANTHROPIC_API_KEY")
  if (!ak) throw new Error("ANTHROPIC_API_KEY fehlt")
  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ak,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  })
  if (!resp.ok) {
    const et = await resp.text()
    throw new Error(`Anthropic API ${resp.status}: ${et}`)
  }
  const r = await resp.json()
  const text = r.content?.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n") || ""
  return text
}

// ─── Task: enrich_artikel ─────────────────────────────────────────────
async function enrichArtikel(body: any) {
  const { name, beschreibung, kategorien } = body
  if (!name?.trim()) return json({ error: "name fehlt" }, 400)

  const katListe = Array.isArray(kategorien) ? kategorien.filter((k: any) => typeof k === "string") : []
  const katHint = katListe.length
    ? `Vorhandene Kategorien: ${katListe.join(", ")}. Nimm eine davon oder liefere "NEU: <name>" wenn keine passt.`
    : `Keine Kategorien definiert — schlage eine passende vor.`

  const systemPrompt =
    `Du bist Katalog-Assistent fuer den internen Bestellshop von WEICHENERGIE (Weich GmbH) — ` +
    `einer Solartechnik-Firma (PV, Waermepumpen, Wallboxen, Speicher). ` +
    `Verbrauchsmaterial und C-Teile fuer Monteure. ` +
    `${katHint} ` +
    `Antworte STRIKT nur mit einem JSON-Objekt (kein Prosa, kein Codeblock), Schema:\n` +
    `{"kategorie": "...", "tags": ["tag1", "tag2", "tag3"], "beschreibung": "1-2 kurze Saetze", ` +
    `"bildsuche_query": "praeziser Suchbegriff fuer Google Bildersuche", ` +
    `"einheit": "Stueck|Meter|Packung|Karton|..."}`

  const userMessage = `Artikel-Name: ${name}\n${beschreibung ? `Zusatzinfo: ${beschreibung}\n` : ""}`
  const text = await callClaude(MODEL_ENRICH, systemPrompt, [{ role: "user", content: userMessage }], 512)
  const parsed = extractJson(text)
  if (!parsed) return json({ error: "KI-Antwort nicht parsebar", raw: text }, 502)
  return json({ result: parsed })
}

// ─── Task: analyze_bedarf_bild ────────────────────────────────────────
async function analyzeBedarfBild(body: any) {
  const { bild_url, beschreibung, kategorien } = body
  if (!bild_url) return json({ error: "bild_url fehlt" }, 400)

  const imgRes = await fetch(bild_url)
  if (!imgRes.ok) return json({ error: `Bild-Download fehlgeschlagen: ${imgRes.status}` }, 502)
  const buf = await imgRes.arrayBuffer()
  const base64 = bytesToBase64(new Uint8Array(buf))
  let mimeType = imgRes.headers.get("content-type") || "image/jpeg"
  // Sanitize — nur was Anthropic akzeptiert
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)) mimeType = "image/jpeg"

  const katListe = Array.isArray(kategorien) ? kategorien.filter((k: any) => typeof k === "string") : []
  const katHint = katListe.length ? `Vorhandene Kategorien: ${katListe.join(", ")}. ` : ""

  const systemPrompt =
    `Du bist Bild-Analyst fuer den internen Bestellshop von WEICHENERGIE (Weich GmbH). ` +
    `Erkenne den Artikel auf dem Foto und extrahiere strukturierte Katalog-Daten. ` +
    `${katHint}` +
    `Antworte STRIKT nur mit JSON-Objekt (kein Prosa, kein Codeblock), Schema:\n` +
    `{"name": "kurzer praeziser Artikelname", "kategorie": "...", "tags": ["tag1","tag2"], ` +
    `"beschreibung": "1-2 Saetze mit erkennbaren Merkmalen (Marke, Groesse, Farbe, Material)", ` +
    `"bildsuche_query": "Suchbegriff fuer Google Bildersuche", ` +
    `"einheit": "Stueck|Meter|Packung|..."}`

  const userContent = [
    { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
    { type: "text", text: `Foto-Kontext: ${beschreibung || "(kein Text vom Anfrager)"}\n\nAnalysiere das Bild.` },
  ]

  const text = await callClaude(MODEL_VISION, systemPrompt, [{ role: "user", content: userContent }], 800)
  const parsed = extractJson(text)
  if (!parsed) return json({ error: "KI-Antwort nicht parsebar", raw: text }, 502)
  return json({ result: parsed })
}

// ─── Entry ────────────────────────────────────────────────────────────
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

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) return json({ error: "Nicht autorisiert" }, 401)
    const token = authHeader.replace("Bearer ", "")

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    )
    const { data: userData, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !userData?.user) return json({ error: "Ungueltige Session" }, 401)

    const body = await req.json()
    const task = body?.task
    if (task === "enrich_artikel") return await enrichArtikel(body)
    if (task === "analyze_bedarf_bild") return await analyzeBedarfBild(body)
    return json({ error: `Unbekannte task: ${task}` }, 400)
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500)
  }
})
