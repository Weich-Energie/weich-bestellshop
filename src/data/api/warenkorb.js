import { supabase } from '../../supabaseClient.js'

// Warenkorb = order_requests im Status 'draft' fuer den aktuellen User.

const WARENKORB_SELECT = `
  id, artikel_id, variante_id, gebinde_id, menge, notiz, projekt_ref, status, created_at,
  shop_artikel ( id, name, bild_url, bild_ist_extern, einheit, kategorie_id ),
  variante:shop_artikel_varianten ( id, name ),
  gebinde:shop_artikel_gebinde ( id, name, stueckzahl )
`

export async function listWarenkorb(userId) {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .select(WARENKORB_SELECT)
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// Legt den Artikel in den Warenkorb. Merged mit existierender Position, wenn Artikel,
// Variante und Gebinde alle uebereinstimmen — sonst neue Position.
export async function addZuWarenkorb({
  userId, artikelId, menge = 1, notiz = null, projektRef = null,
  varianteId = null, gebindeId = null,
}) {
  let q = supabase
    .from('shop_order_requests')
    .select('id, menge')
    .eq('user_id', userId)
    .eq('artikel_id', artikelId)
    .eq('status', 'draft')
  q = varianteId ? q.eq('variante_id', varianteId) : q.is('variante_id', null)
  q = gebindeId ? q.eq('gebinde_id', gebindeId) : q.is('gebinde_id', null)
  const { data: existing } = await q.maybeSingle()

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
      variante_id: varianteId,
      gebinde_id: gebindeId,
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
