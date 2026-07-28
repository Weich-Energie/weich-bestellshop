import { supabase } from '../../supabaseClient.js'

// User: eigene Bestellungen (alle Status ausser draft = Warenkorb).
export async function listEigeneBestellungen(userId) {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .select(`
      id, menge, notiz, projekt_ref, status, reject_grund, created_at, updated_at,
      shop_artikel ( id, name, bild_url, bild_ist_extern, einheit ),
      variante:shop_artikel_varianten ( id, name ),
      gebinde:shop_artikel_gebinde ( id, name, stueckzahl )
    `)
    .eq('user_id', userId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Admin: alle offenen Bestellwuensche (pending) mit User + Artikel-Details.
export async function listOffeneFreigaben() {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .select(`
      id, user_id, menge, notiz, projekt_ref, status, created_at,
      shop_artikel ( id, name, lieferant, lieferant_url, preis_netto, einheit ),
      variante:shop_artikel_varianten ( id, name ),
      gebinde:shop_artikel_gebinde ( id, name, stueckzahl )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function freigeben(id) {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .update({ status: 'approved' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function ablehnen(id, grund) {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .update({ status: 'rejected', reject_grund: grund || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// User zieht seinen Bestellwunsch zurueck (nur aus draft/pending).
export async function zurueckziehen(id) {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
