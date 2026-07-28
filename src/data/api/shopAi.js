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
