import { supabase } from '../../supabaseClient.js'

// Ruft die shop-ai Edge Function mit gegebenem Task-Payload.
async function invoke(payload) {
  const { data, error } = await supabase.functions.invoke('shop-ai', { body: payload })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data?.result || null
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
