// shop-ai — KI-Support fuer Bestellshop.
// Task-Routing: enrich_artikel + analyze_bedarf_bild + extract_beleg + extract_shop_link + extract_shop_screenshot.
// Modell-Politik (siehe ADR 0003): Sonnet 4.6 fuer alle Tasks — Konsistenz + bessere
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
// Modell-Zuordnung pro Task (siehe Kommentar oben — Konsistenz + Qualitaet).
const MODEL_ENRICH = SONNET
const MODEL_VISION = SONNET
const MODEL_BELEG = SONNET
const MODEL_LINK = SONNET

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

// ─── Task: extract_beleg ─────────────────────────────────────────────
// Laedt PDF von signed URL, sendet als "document"-Content an Sonnet Vision,
// erwartet strukturiertes JSON mit Meta (Lieferant, Datum, Nr, Summe) + Positionen.
async function extractBeleg(body: any) {
  const { pdf_url, kategorien } = body
  if (!pdf_url) return json({ error: "pdf_url fehlt" }, 400)

  const pdfRes = await fetch(pdf_url)
  if (!pdfRes.ok) return json({ error: `PDF-Download fehlgeschlagen: ${pdfRes.status}` }, 502)
  const buf = await pdfRes.arrayBuffer()
  if (buf.byteLength > 32 * 1024 * 1024) return json({ error: "PDF > 32 MB — Anthropic-Limit" }, 413)
  const base64 = bytesToBase64(new Uint8Array(buf))

  const katListe = Array.isArray(kategorien) ? kategorien.filter((k: any) => typeof k === "string") : []
  const katHint = katListe.length ? `Vorhandene Kategorien: ${katListe.join(", ")}. ` : ""

  const systemPrompt =
    `Du bist Rechnungs-Extractor fuer den internen Bestellshop von WEICHENERGIE (Weich GmbH) — ` +
    `Solartechnik-Firma (PV, Waermepumpen, Wallboxen, Speicher). ` +
    `Analysiere die PDF-Rechnung und liefere strukturierte Daten. ` +
    `${katHint} ` +
    `Antworte STRIKT nur mit JSON (kein Prosa, kein Codeblock). Schema:\n` +
    `{\n` +
    `  "lieferant": "Name des Rechnungsstellers",\n` +
    `  "rechnungsnr": "Rechnungs-Nr (leer wenn nicht erkennbar)",\n` +
    `  "rechnungsdatum": "YYYY-MM-DD (leer wenn nicht erkennbar)",\n` +
    `  "gesamtbetrag": 1234.56,\n` +
    `  "positionen": [\n` +
    `    {\n` +
    `      "beschreibung": "Artikel-Text von der Rechnung",\n` +
    `      "menge": 5,\n` +
    `      "einzelpreis": 12.34,\n` +
    `      "artikelnr": "Artikelnummer (leer wenn nicht angegeben)",\n` +
    `      "kategorie": "passende Katalog-Kategorie oder NEU:<name>",\n` +
    `      "tags": ["tag1", "tag2"],\n` +
    `      "einheit": "Stueck|Meter|Packung|..."\n` +
    `    }\n` +
    `  ]\n` +
    `}\n` +
    `WICHTIG: Nur echte Warenpositionen extrahieren, KEINE Zeilen wie "Zwischensumme", ` +
    `"MwSt", "Versandkosten", "Rabatt", "Endbetrag", "Fracht". ` +
    `Preise IMMER netto (falls brutto ausgewiesen, netto berechnen falls MwSt-Satz erkennbar). ` +
    `Deutsche Zahlen (Komma als Dezimal) in Zahlen mit Punkt umwandeln.`

  const userContent = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
    { type: "text", text: "Extrahiere aus dieser Rechnung die Meta-Daten und alle Warenpositionen." },
  ]

  const text = await callClaude(MODEL_BELEG, systemPrompt, [{ role: "user", content: userContent }], 4096)
  const parsed = extractJson(text)
  if (!parsed) return json({ error: "KI-Antwort nicht parsebar", raw: text }, 502)
  return json({ result: parsed })
}

// ─── Task: extract_shop_link ─────────────────────────────────────────
// Laedt HTML einer Produkt-URL (server-side, umgeht CORS), reduziert auf lesbaren
// Inhalt, laesst Sonnet Produkt-Daten extrahieren.
async function extractShopLink(body: any) {
  const { url, kategorien } = body
  if (!url || typeof url !== "string") return json({ error: "url fehlt" }, 400)
  let parsedUrl: URL
  try { parsedUrl = new URL(url) } catch { return json({ error: "URL ungueltig" }, 400) }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) return json({ error: "Nur http/https" }, 400)

  let html: string
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    })
    if (!resp.ok) return json({ error: `Shop hat ${resp.status} zurueckgegeben (evtl. Bot-Blockade)` }, 502)
    html = await resp.text()
  } catch (e) {
    return json({ error: `Fetch fehlgeschlagen: ${(e as any)?.message || e}` }, 502)
  }

  // Sanitize: script/style/comments raus, HTML-Boilerplate reduzieren
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
  // Limit auf 100 KB — Sonnet hat viel Context, aber wir sparen Tokens
  if (html.length > 100_000) html = html.slice(0, 100_000)

  const katListe = Array.isArray(kategorien) ? kategorien.filter((k: any) => typeof k === "string") : []
  const katHint = katListe.length ? `Vorhandene Kategorien: ${katListe.join(", ")}. ` : ""

  const systemPrompt =
    `Du bist Produkt-Extractor fuer den internen Bestellshop von WEICHENERGIE (Weich GmbH) — ` +
    `Solartechnik-Firma. Aus einer HTML-Produktseite extrahiere die Artikel-Daten. ` +
    `${katHint} ` +
    `Antworte STRIKT nur mit JSON (kein Prosa, kein Codeblock). Schema:\n` +
    `{\n` +
    `  "name": "praeziser Artikelname",\n` +
    `  "beschreibung": "1-2 Saetze mit erkennbaren Merkmalen",\n` +
    `  "preis_netto": 12.34,\n` +
    `  "einheit": "Stueck|Meter|Packung|...",\n` +
    `  "kategorie": "passende Kategorie oder NEU:<name>",\n` +
    `  "tags": ["tag1", "tag2"],\n` +
    `  "bildsuche_query": "praeziser Suchbegriff falls kein direktes Bild",\n` +
    `  "bild_url": "absolute URL des Produktbildes (leer wenn nicht sicher findbar)",\n` +
    `  "lieferant": "Name des Shops/Herstellers",\n` +
    `  "artikelnr": "Artikel-/Bestell-Nr (leer wenn nicht angegeben)"\n` +
    `}\n` +
    `WICHTIG: Preis IMMER netto. Wenn Brutto ausgewiesen (deutscher Shop, meist 19% MwSt), ` +
    `netto berechnen: brutto / 1.19. Bei "zzgl. MwSt": Preis ist bereits netto.`

  const userMessage = `URL: ${url}\n\nHTML-Auszug:\n${html}`
  const text = await callClaude(MODEL_LINK, systemPrompt, [{ role: "user", content: userMessage }], 1024)
  const parsed = extractJson(text)
  if (!parsed) return json({ error: "KI-Antwort nicht parsebar", raw: text }, 502)
  return json({ result: parsed })
}

// ─── Task: extract_shop_screenshot ────────────────────────────────────
// Fallback wenn URL-Import scheitert (Bot-Block, SPA, Login-Wall):
// User schickt Screenshot der Produktseite als base64 direkt, Sonnet Vision
// extrahiert die gleichen Felder wie extract_shop_link.
async function extractShopScreenshot(body: any) {
  const { image_base64, image_mime_type, url, kategorien } = body
  if (!image_base64) return json({ error: "image_base64 fehlt" }, 400)
  let mimeType = image_mime_type || "image/jpeg"
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)) mimeType = "image/jpeg"

  const katListe = Array.isArray(kategorien) ? kategorien.filter((k: any) => typeof k === "string") : []
  const katHint = katListe.length ? `Vorhandene Kategorien: ${katListe.join(", ")}. ` : ""

  const systemPrompt =
    `Du bist Produkt-Extractor fuer den internen Bestellshop von WEICHENERGIE (Weich GmbH) — ` +
    `Solartechnik-Firma. Aus einem Screenshot einer Produktseite extrahiere die Artikel-Daten. ` +
    `${katHint} ` +
    `Antworte STRIKT nur mit JSON (kein Prosa, kein Codeblock). Schema:\n` +
    `{\n` +
    `  "name": "praeziser Artikelname",\n` +
    `  "beschreibung": "1-2 Saetze mit erkennbaren Merkmalen",\n` +
    `  "preis_netto": 12.34,\n` +
    `  "einheit": "Stueck|Meter|Packung|...",\n` +
    `  "kategorie": "passende Kategorie oder NEU:<name>",\n` +
    `  "tags": ["tag1", "tag2"],\n` +
    `  "bildsuche_query": "praeziser Suchbegriff falls kein direktes Bild",\n` +
    `  "lieferant": "Name des Shops/Herstellers",\n` +
    `  "artikelnr": "Artikel-/Bestell-Nr (leer wenn nicht erkennbar)"\n` +
    `}\n` +
    `WICHTIG: Preis IMMER netto. Wenn Brutto ausgewiesen (deutscher Shop, meist 19% MwSt), ` +
    `netto berechnen: brutto / 1.19. Bei "zzgl. MwSt": Preis ist bereits netto. ` +
    `Wenn kein Preis erkennbar (Login-Wall etc.): preis_netto null lassen.`

  const userContent = [
    { type: "image", source: { type: "base64", media_type: mimeType, data: image_base64 } },
    { type: "text", text: `${url ? `Ursprungs-URL (Kontext): ${url}\n\n` : ""}Extrahiere die Produktdaten aus dem Screenshot.` },
  ]

  const text = await callClaude(MODEL_LINK, systemPrompt, [{ role: "user", content: userContent }], 1024)
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
    if (task === "extract_beleg") return await extractBeleg(body)
    if (task === "extract_shop_link") return await extractShopLink(body)
    if (task === "extract_shop_screenshot") return await extractShopScreenshot(body)
    return json({ error: `Unbekannte task: ${task}` }, 400)
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500)
  }
})
