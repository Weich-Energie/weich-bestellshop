// shop-ai — KI-Support fuer Bestellshop.
// Task-Routing: enrich_artikel + analyze_bedarf_bild + extract_beleg + extract_aufmass
// + extract_shop_link + extract_shop_screenshot.
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
  return (await callClaudeVoll(model, systemPrompt, messages, maxTokens)).text
}

// Wie callClaude, dazu der stop_reason. "max_tokens" heisst: die Antwort ist
// abgeschnitten — das JSON ist dann unvollstaendig und nicht zu retten.
async function callClaudeVoll(model: string, systemPrompt: string, messages: any[], maxTokens = 1024) {
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
  return { text, stopReason: String(r.stop_reason || "") }
}

// Seitenzahl eines PDFs ohne Bibliothek. Reicht fuer die Kopierer-Scans
// (PDF 1.4, Seitenobjekte im Klartext). Steckt der Seitenbaum in komprimierten
// Objektstroemen, kommt 0 heraus — dann wird ganz normal gelesen.
function pdfSeitenzahl(text: string): number {
  const seiten = (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length
  let count = 0
  for (const m of text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)) count = Math.max(count, Number(m[1]))
  return Math.max(seiten, count)
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
    `"einheit": "Stück|Meter|Packung|Karton|..."}`

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
    `"einheit": "Stück|Meter|Packung|..."}`

  const userContent = [
    { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
    { type: "text", text: `Foto-Kontext: ${beschreibung || "(kein Text vom Anfrager)"}\n\nAnalysiere das Bild.` },
  ]

  const text = await callClaude(MODEL_VISION, systemPrompt, [{ role: "user", content: userContent }], 800)
  const parsed = extractJson(text)
  if (!parsed) return json({ error: "KI-Antwort nicht parsebar", raw: text }, 502)
  return json({ result: parsed })
}

// ─── Task: extract_aufmass ───────────────────────────────────────────
// Foto eines ausgefuellten Aufmass- oder Montageberichts lesen. Uebergangs-
// loesung, bis das Aufmass in der App erfasst wird.
//
// Der entscheidende Unterschied zu extract_beleg: der Vordruck ist ein
// Shop-Ausdruck und traegt in der Mengenspalte ueberall eine GEDRUCKTE 1. Die
// gilt nicht. Zaehlbar ist allein, was ein Monteur mit der Hand danebenge-
// schrieben hat. Wer die gedruckte 1 uebernimmt, bekommt eine vollstaendig
// aussehende und vollstaendig falsche Nachkalkulation.
//
// 02.10.2026 (Schmid Hahnbach, Kopierer-Scan 18 Seiten): der Barcode-Vordruck
// traegt statt der 1 eine Packungsgroesse ("10 Stück =") — die wurde als Menge
// gelesen. Strichlisten, freie Notizen ("130S25 : 11", wurde zu 11 Stunden) und
// der Textmarker auf dem Wochenbericht stehen seither ausdruecklich im Prompt.
// Eine Datei ist EIN Aufruf: mehrseitige Scans zerlegt die App im Browser
// (src/lib/pdfSeiten.js), hier werden sie nur noch abgewiesen.
async function extractAufmass(body: any) {
  const { bild_url, artikel_hinweis } = body
  if (!bild_url) return json({ error: "bild_url fehlt" }, 400)

  const imgRes = await fetch(bild_url)
  if (!imgRes.ok) return json({ error: `Bild-Download fehlgeschlagen: ${imgRes.status}` }, 502)
  const buf = await imgRes.arrayBuffer()
  if (buf.byteLength > 20 * 1024 * 1024) return json({ error: "Bild > 20 MB" }, 413)
  const base64 = bytesToBase64(new Uint8Array(buf))
  let mimeType = imgRes.headers.get("content-type") || "image/jpeg"
  const istPdf = mimeType.includes("pdf")
  if (!istPdf && !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)) {
    mimeType = "image/jpeg"
  }

  // Ein mehrseitiger Scan ist fuer EINEN Aufruf zu viel: die Antwort reisst nach
  // gut zwei Minuten ab. Neue Uploads zerlegt die App schon im Browser; das hier
  // faengt "Neu lesen" an alten Eintraegen ab — Antwort in einer Sekunde statt
  // nach zwei Minuten. Ein PDF mit Schrift (Reonic-Angebot) ist kein Scan und
  // wird weiter als Ganzes gelesen.
  if (istPdf) {
    const roh = new TextDecoder("latin1").decode(new Uint8Array(buf))
    const seiten = pdfSeitenzahl(roh)
    if (seiten > 1 && !/\/Font\b/.test(roh)) {
      return json({
        error: `Gescanntes PDF mit ${seiten} Seiten — für einen Lesedurchgang zu viel. ` +
          `Bitte diesen Eintrag löschen und das PDF neu hochladen: die App zerlegt es ` +
          `dabei in Einzelseiten und lässt leere Seiten weg.`,
      }, 422)
    }
  }

  // Bekannte Artikelnummern mitgeben: abgegriffene Zettel und krakelige
  // Handschrift werden damit deutlich zuverlaessiger gelesen, weil das Modell
  // gegen eine echte Liste abgleichen kann statt zu raten.
  const hinweis = typeof artikel_hinweis === "string" && artikel_hinweis.length
    ? `\n\nBekannte Artikel aus dem Katalog (Nummer = Bezeichnung), nutze sie zum Abgleich:\n${artikel_hinweis.slice(0, 60000)}`
    : ""

  const systemPrompt =
    `Du liest Baustellenunterlagen der Firma WEICHENERGIE (Weich GmbH, Klima- und ` +
    `Heizungsbau). Es kommen DREI Sorten Blatt herein, und sie werden alle gleich ` +
    `abfotografiert oder gescannt, manchmal quer oder auf dem Kopf — lies sie in der ` +
    `richtigen Ausrichtung. Bestimme zuerst, was du vor dir hast:\n\n` +
    `  "material" — Aufmass- oder Montagebericht: ein Ausdruck aus einem ` +
    `Lieferantenshop mit Artikelnummer, Bezeichnung und Preisspalten, oder ein ` +
    `Barcode-Vordruck mit Artikelkacheln (Regieaufmass). Ein Monteur hat die verbauten ` +
    `Mengen HANDSCHRIFTLICH dazugeschrieben.\n` +
    `  "stunden" — Stundenzettel. Namen, Tage, Arbeitszeiten, oft handschriftlich.\n` +
    `  "angebot" — ein gedrucktes Angebot oder Auftrag (haeufig aus Reonic) mit ` +
    `Positionen, Mengen und Preisen. Nichts Handschriftliches.\n\n` +
    `Fuelle nur den Abschnitt, der zur erkannten Art gehoert. Die anderen bleiben leer.\n` +
    `AUSNAHME: Stehen auf einem Materialblatt auch Arbeitsstunden (Namen mit Zeiten, ` +
    `"8 Std", "2 Mann 6 h", eine Zeile "Stunden: 12"), dann fuelle "stunden_zeilen" ` +
    `ZUSAETZLICH aus. Das ist der haeufige Fall — der Monteur notiert beides auf dasselbe ` +
    `Blatt. Sie zu uebersehen heisst, dass die Arbeit nicht abgerechnet wird.\n\n` +
    `--- BEI "material" ---\n` +
    `ENTSCHEIDENDE REGEL: Nur die handschriftliche Menge zaehlt. Eine GEDRUCKTE Zahl ist ` +
    `NIE eine Menge. Zwei Vordrucke kommen vor:\n` +
    `  a) Shop-Ausdruck als Tabelle: in der gedruckten Mengen- oder Anzahl-Spalte steht ` +
    `bei jeder Zeile eine 1 — ein Kopierrest des Ausdrucks.\n` +
    `  b) Barcode-Vordruck (Regieaufmass): Kacheln im Raster mit drei Spalten. Jede Kachel ` +
    `hat Strichcode, Artikelnummer, eine gedruckte Packungsangabe wie "10 Stück =", ` +
    `"5 m =", "60 Satz =" oder "1 Rolle =", darunter Bezeichnung und Bild. Die Zahl vor ` +
    `"Stück =" ist die PACKUNGSGROESSE des Lieferanten. Die Menge ist allein, was der ` +
    `Monteur mit der Hand an genau diese Kachel geschrieben hat — meist direkt unter der ` +
    `Bezeichnung, manchmal ueber den Bildrand. Eine Handschrift gehoert zur Kachel ` +
    `unmittelbar darueber.\n` +
    `Nimm eine Zeile nur auf, wenn an genau dieser Zeile oder Kachel eine handschriftliche ` +
    `Markierung steht. Ohne Handschrift gehoert sie NICHT ins Ergebnis, auch nicht mit ` +
    `Menge 1. Im Zweifel weglassen — eine fehlende Zeile faellt beim Pruefen auf, eine ` +
    `erfundene nicht.\n` +
    `So liest du die Handschrift:\n` +
    `  - Summen ausrechnen: "2+1" = 3, "8+5" = 13, "12m+6m" = 18 (Einheit "m"). Die ` +
    `Rechnung in "notiz" festhalten.\n` +
    `  - Dezimalkomma: "1,2" = 1.2, "5,40+3" = 8.4.\n` +
    `  - Strichliste: mehrere Striche nebeneinander werden GEZAEHLT — "|||" = 3, "|| ||" = 4. ` +
    `Ein Buendel aus vier Strichen mit Querstrich ist 5, ein Buendel und "|||" sind 8.\n` +
    `  - Ein einzelner Haken oder Strich ohne Zahl ist Menge 1 bei Sicherheit 0.6.\n` +
    `  - Durchgestrichene Zeilen gehoeren weg.\n` +
    `Handschrift ist oft unsauber: 1 und 7, 4 und 9, 0 und 6 werden verwechselt. Gib ` +
    `deine Lesesicherheit je Zeile ehrlich an.\n` +
    `Meterware (Leitung, Kabel, Schlauch, Isolierung, Rohr) wird in Metern notiert, auch ` +
    `wenn der Artikel eine Rolle oder Stange ist. Uebernimm die Zahl wie sie dasteht, ` +
    `Einheit "m".\n` +
    `Freie Notizen — unter einem Trennstrich, am Rand oder auf leerer Flaeche, z. B. ` +
    `"130S25 : 11" oder "Wasserfilter 1 Zoll" — sind weiteres MATERIAL: Artikelnummer bzw. ` +
    `Bezeichnung so wie geschrieben, Menge ist die Zahl hinter ":" oder "x". Zollangaben ` +
    `(1", 3/4") sind eine Groesse, keine Menge; steht keine Menge dabei, Menge 1 bei ` +
    `Sicherheit 0.5 und notiz "frei notiert". Solche Notizen sind NIE Stunden.\n\n` +
    `--- BEI "stunden" ---\n` +
    `Je Eintrag Name, Datum und Stunden. "2 Mann 6 h" sind zwei Zeilen zu 6 Stunden. ` +
    `Pausen abziehen, wenn sie ausgewiesen sind. Die Rolle (techniker oder monteur) ` +
    `nur setzen, wenn sie auf dem Blatt steht — sonst leer lassen und NICHT raten.\n` +
    `Stunden sind nur Eintraege, die eindeutig Arbeitszeit sind: ein Name mit Stunden, ` +
    `"Std", "h", Uhrzeiten von–bis. Eine Artikelnummer mit einer Zahl ist nie eine Stunde.\n` +
    `Wochenbericht (Tabelle mit Spalten Mo–Fr und Zeitraum "vom … bis …"): je Name und Tag ` +
    `eine Zeile, das Datum aus Zeitraum und Spalte. "8,5" sind 8.5 Stunden; ein Haken hinter ` +
    `der Zahl ist nur ein Pruefzeichen. Den Namen so uebernehmen, wie er dasteht, samt ` +
    `Ortsangabe in Klammern, z. B. "Schmid Christopher (Hahnbach)".\n` +
    `Ein Wochenbericht fuehrt oft mehrere Baustellen, und das Buero hebt die Zeilen des ` +
    `Auftrags mit Textmarker farbig hervor. Setze deshalb bei jeder Zeile "markiert": true, ` +
    `wenn sie hervorgehoben ist, sonst false. Ist auf dem Blatt gar nichts hervorgehoben, ` +
    `setze bei allen null. Gib trotzdem ALLE Zeilen zurueck — aussortiert wird in der App.\n\n` +
    `--- BEI "angebot" ---\n` +
    `Alle Warenpositionen mit Menge und Preisen, netto. KEINE Zeilen wie Zwischensumme, ` +
    `MwSt, Rabatt, Endbetrag. Steht nur ein Gesamtpreis je Zeile, rechne den Einzelpreis ` +
    `nicht aus, sondern gib den Gesamtpreis an. Erkenne, ob eine Position ein Geraet ist ` +
    `(Aussengeraet, Innengeraet, Waermepumpe, Speicher) oder eine Montage- bzw. ` +
    `Materialpauschale — das entscheidet spaeter ueber die Kalkulationsart.\n\n` +
    `Antworte STRIKT nur mit JSON (kein Prosa, kein Codeblock). Schema:\n` +
    `{\n` +
    `  "blatt_art": "material|stunden|angebot",\n` +
    `  "baustelle": "Name oder Auftragsnummer vom Blatt, leer wenn nicht lesbar",\n` +
    `  "datum": "YYYY-MM-DD oder leer",\n` +
    `  "monteur": "Name oder Kuerzel, leer wenn nicht lesbar",\n` +
    `  "zeilen": [\n` +
    `    {\n` +
    `      "artikelnr": "gedruckte Artikelnummer der Zeile, leer wenn keine",\n` +
    `      "bezeichnung": "gedruckte Bezeichnung der Zeile",\n` +
    `      "menge": 3,\n` +
    `      "einheit": "Stück|m|Rolle|Pack",\n` +
    `      "sicherheit": 0.95,\n` +
    `      "notiz": "nur bei Auffaelligkeit, sonst leer"\n` +
    `    }\n` +
    `  ],\n` +
    `  "stunden_zeilen": [\n` +
    `    { "name": "Nachname (Ort)", "datum": "YYYY-MM-DD", "stunden": 8, "rolle": "", "markiert": null, "sicherheit": 0.9 }\n` +
    `  ],\n` +
    `  "angebot_positionen": [\n` +
    `    { "bezeichnung": "...", "menge": 1, "einheit": "Stck",\n` +
    `      "ek_gesamt": null, "vk_gesamt": 2420.00, "ist_geraet": true }\n` +
    `  ],\n` +
    `  "angebot_summe_vk": 8875.00\n` +
    `}\n` +
    `Deutsche Zahlen (Komma als Dezimal) in Zahlen mit Punkt umwandeln. ` +
    `Ein Feld, das du nicht lesen kannst, bleibt leer oder null — rate nicht.` +
    hinweis

  const quelle = istPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } }

  const userContent = [
    quelle,
    { type: "text", text: "Bestimme die Blattart und lies das Blatt aus." },
  ]

  const { text, stopReason } = await callClaudeVoll(
    MODEL_VISION, systemPrompt, [{ role: "user", content: userContent }], 8000,
  )
  if (stopReason === "max_tokens") {
    return json({
      error: "Zu viel auf einmal für einen Lesedurchgang — die Antwort der KI wurde " +
        "abgeschnitten. Bitte die Seite einzeln oder in zwei Fotos hochladen.",
    }, 422)
  }
  const parsed = extractJson(text)
  if (!parsed) {
    return json({ error: "Die KI-Antwort war nicht lesbar. Bitte noch einmal lesen lassen.", raw: text }, 502)
  }
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
    `      "einheit": "Stück|Meter|Packung|..."\n` +
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

  // JSON-LD RETTEN, bevor die script-Tags fallen: viele Shops liefern die
  // verlaessliche Produktbild-URL nur dort (Schema.org "image") oder in og:image.
  // Ohne das strippt die Sanitize-Zeile unten genau die beste Bildquelle weg.
  const jsonLd = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .join("\n")
    .slice(0, 20_000)

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
    `  "einheit": "Stück|Meter|Packung|...",\n` +
    `  "kategorie": "passende Kategorie oder NEU:<name>",\n` +
    `  "tags": ["tag1", "tag2"],\n` +
    `  "bildsuche_query": "praeziser Suchbegriff falls kein direktes Bild",\n` +
    `  "bild_url": "URL des Produktbildes — bevorzugt in dieser Reihenfolge: JSON-LD \\"image\\", ` +
    `og:image, danach das Haupt-Produktbild aus dem HTML. Relative Pfade sind erlaubt, ` +
    `sie werden serverseitig aufgeloest. Nimm KEINE Platzhalter-, Logo- oder Icon-Bilder.",\n` +
    `  "lieferant": "Name des Shops/Herstellers",\n` +
    `  "artikelnr": "Artikel-/Bestell-Nr (leer wenn nicht angegeben)"\n` +
    `}\n` +
    `WICHTIG: Preis IMMER netto. Wenn Brutto ausgewiesen (deutscher Shop, meist 19% MwSt), ` +
    `netto berechnen: brutto / 1.19. Bei "zzgl. MwSt": Preis ist bereits netto.`

  const userMessage =
    `URL: ${url}\n\n` +
    (jsonLd ? `JSON-LD der Seite (verlaesslichste Quelle):\n${jsonLd}\n\n` : "") +
    `HTML-Auszug:\n${html}`
  const text = await callClaude(MODEL_LINK, systemPrompt, [{ role: "user", content: userMessage }], 1024)
  const parsed = extractJson(text)
  if (!parsed) return json({ error: "KI-Antwort nicht parsebar", raw: text }, 502)

  // Relative Bild-Pfade gegen die Produktseite aufloesen — ein "/media/x.jpg"
  // waere im Browser sonst nicht ladbar und die Vorschau bliebe leer.
  if (parsed.bild_url) {
    try {
      parsed.bild_url = new URL(String(parsed.bild_url), parsedUrl).toString()
    } catch {
      parsed.bild_url = ""
    }
  }
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
    `  "einheit": "Stück|Meter|Packung|...",\n` +
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
    if (task === "extract_aufmass") return await extractAufmass(body)
    if (task === "extract_shop_link") return await extractShopLink(body)
    if (task === "extract_shop_screenshot") return await extractShopScreenshot(body)
    return json({ error: `Unbekannte task: ${task}` }, 400)
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500)
  }
})
