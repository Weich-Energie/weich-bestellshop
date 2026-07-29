import { supabase } from '../../supabaseClient.js'

// Metadaten laufen direkt gegen die Tabelle — RLS laesst nur Shop-Admins ran.
// Die Zugangs-Chiffre ist bewusst NICHT in der Spaltenliste: sie ist per
// Spalten-REVOKE ohnehin nicht lesbar, und das soll auch so bleiben.
const SELECT = `
  id, slug, name, login_url, produkt_url_muster, playbook,
  zugang_gesetzt_am, aktiv, notiz, created_at, updated_at
`

export async function listLieferanten() {
  const { data, error } = await supabase
    .from('shop_lieferanten')
    .select(SELECT)
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

function slugAus(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export async function createLieferant({ name, login_url = '', notiz = '' }) {
  const { data, error } = await supabase
    .from('shop_lieferanten')
    .insert({
      name: name.trim(),
      slug: slugAus(name),
      login_url: login_url.trim() || null,
      notiz: notiz.trim() || null,
    })
    .select(SELECT)
    .single()
  if (error) throw error
  return data
}

export async function updateLieferant(id, felder) {
  const { data, error } = await supabase
    .from('shop_lieferanten')
    .update(felder)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw error
  return data
}

export async function deleteLieferant(id) {
  const { error } = await supabase.from('shop_lieferanten').delete().eq('id', id)
  if (error) throw error
}

// Zugangsdaten gehen NIE direkt in die Tabelle: nur die Edge Function kennt den
// Schluessel. Sie verschluesselt und schreibt; zurueck kommt nur eine Quittung.
async function rufeZugangsFunktion(payload) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Keine gültige Session — bitte neu anmelden.')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lieferant-zugang`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    },
  )

  const raw = await res.text()
  let body = null
  if (raw) { try { body = JSON.parse(raw) } catch { /* kein JSON */ } }
  if (!res.ok) {
    throw new Error(body?.error || `Fehler ${res.status}: ${raw.slice(0, 300) || '(leere Antwort)'}`)
  }
  return body
}

export async function setzeZugang(lieferantId, benutzer, passwort) {
  return rufeZugangsFunktion({
    aktion: 'setzen',
    lieferant_id: lieferantId,
    benutzer,
    passwort,
  })
}

export async function loescheZugang(lieferantId) {
  return rufeZugangsFunktion({ aktion: 'loeschen', lieferant_id: lieferantId })
}
