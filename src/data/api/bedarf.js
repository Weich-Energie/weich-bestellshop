import { supabase } from '../../supabaseClient.js'

// User: eigene Bedarfsmeldungen (alle Status).
export async function listEigeneBedarfsmeldungen(userId) {
  const { data, error } = await supabase
    .from('shop_bedarfsmeldungen')
    .select('id, beschreibung, bild_url, lieferant_url, menge, status, admin_notiz, resolved_artikel_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Admin: offene Meldungen mit User-Info (Namen aus employees per Email-Lookup).
export async function listOffeneBedarfsmeldungen() {
  const { data, error } = await supabase
    .from('shop_bedarfsmeldungen')
    .select('id, user_id, beschreibung, bild_url, lieferant_url, menge, status, created_at')
    .eq('status', 'offen')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createBedarfsmeldung({ userId, beschreibung, bildUrl = null, lieferantUrl = null, menge = 1 }) {
  const { data, error } = await supabase
    .from('shop_bedarfsmeldungen')
    .insert({
      user_id: userId,
      beschreibung,
      bild_url: bildUrl,
      lieferant_url: lieferantUrl,
      menge,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBedarfsmeldung(id) {
  const { error } = await supabase.from('shop_bedarfsmeldungen').delete().eq('id', id)
  if (error) throw error
}

export async function meldungAblehnen(id, grund) {
  const { data, error } = await supabase
    .from('shop_bedarfsmeldungen')
    .update({ status: 'abgelehnt', admin_notiz: grund || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Nach Anlage eines Katalog-Artikels aus einer Meldung: Meldung als "in_katalog" markieren.
export async function meldungInKatalog(id, artikelId) {
  const { data, error } = await supabase
    .from('shop_bedarfsmeldungen')
    .update({ status: 'in_katalog', resolved_artikel_id: artikelId })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
