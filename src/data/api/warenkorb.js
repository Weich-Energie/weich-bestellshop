import { supabase } from '../../supabaseClient.js'

// Warenkorb = order_requests im Status 'draft' fuer den aktuellen User.

export async function listWarenkorb(userId) {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .select(`
      id, artikel_id, menge, notiz, projekt_ref, status, created_at,
      shop_artikel ( id, name, bild_url, bild_ist_extern, einheit, kategorie_id )
    `)
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// Legt den Artikel in den Warenkorb (oder erhoeht die Menge, falls schon drin).
export async function addZuWarenkorb({ userId, artikelId, menge = 1, notiz = null, projektRef = null }) {
  const { data: existing } = await supabase
    .from('shop_order_requests')
    .select('id, menge')
    .eq('user_id', userId)
    .eq('artikel_id', artikelId)
    .eq('status', 'draft')
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('shop_order_requests')
      .update({ menge: existing.menge + menge })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('shop_order_requests')
    .insert({
      user_id: userId,
      artikel_id: artikelId,
      menge,
      notiz,
      projekt_ref: projektRef,
      status: 'draft',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWarenkorbPosition(id, patch) {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeWarenkorbPosition(id) {
  const { error } = await supabase.from('shop_order_requests').delete().eq('id', id)
  if (error) throw error
}

// Wandelt den gesamten Warenkorb in pending-Bestellwuensche um.
export async function bestellungAbschicken(userId) {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .update({ status: 'pending' })
    .eq('user_id', userId)
    .eq('status', 'draft')
    .select()
  if (error) throw error
  return data || []
}
