import { supabase } from '../../supabaseClient.js'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shop-ai`

// Bewusst kein supabase.functions.invoke: das wirft bei non-2xx nur
// "Edge Function returned a non-2xx status code" und macht den Response-Body
// unzugaenglich — dort steht aber die eigentliche Ursache (z.B. der
// Anthropic-API-Fehler). Mit fetch lesen wir Status und Body selbst und
// bekommen immer eine konkrete Meldung, auch wenn der Body leer ist.
async function invoke(payload) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Keine gültige Session — bitte neu anmelden.')

  let res
  try {
    res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    throw new Error(`Netzwerkfehler beim Aufruf der KI-Funktion: ${e.message || e}`)
  }

  const raw = await res.text()
  let body = null
  if (raw) {
    try { body = JSON.parse(raw) } catch { /* kein JSON — raw unten anzeigen */ }
  }

  if (!res.ok) {
    const detail = body?.error || (raw ? raw.slice(0, 400) : '(leere Antwort)')
    throw new Error(`KI-Funktion HTTP ${res.status}: ${detail}`)
  }
  if (body?.error) throw new Error(body.error)
  return body?.result || null
}

// KI-Vorschlaege fuer einen neu anzulegenden Artikel (Text-only, Haiku).
export async function enrichArtikel({ name, beschreibung = '', kategorien = [] }) {
  return invoke({
    task: 'enrich_artikel',
    name,
    beschreibung,
    kategorien,
  })
}

// Bild-Analyse einer Bedarfsmeldung (Sonnet Vision).
// bildUrl muss oeffentlich erreichbar (signed URL) sein.
export async function analyzeBedarfBild({ bildUrl, beschreibung = '', kategorien = [] }) {
  return invoke({
    task: 'analyze_bedarf_bild',
    bild_url: bildUrl,
    beschreibung,
    kategorien,
  })
}

// Produkt-Daten aus einer Shop-URL extrahieren (server-side HTML-Fetch + Sonnet).
export async function extractShopLink({ url, kategorien = [] }) {
  return invoke({
    task: 'extract_shop_link',
    url,
    kategorien,
  })
}

// Produkt-Daten aus einem Screenshot der Produktseite extrahieren (Sonnet Vision).
// Fallback fuer Bot-Blockaden, SPA-Shops und Login-Walls.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const base64 = dataUrl.split(',')[1] || ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function extractShopScreenshot({ file, url = '', kategorien = [] }) {
  if (!file) throw new Error('Datei fehlt')
  const image_base64 = await fileToBase64(file)
  const mime = file.type && ['image/jpeg','image/png','image/gif','image/webp'].includes(file.type)
    ? file.type
    : 'image/jpeg'
  return invoke({
    task: 'extract_shop_screenshot',
    image_base64,
    image_mime_type: mime,
    url,
    kategorien,
  })
}
