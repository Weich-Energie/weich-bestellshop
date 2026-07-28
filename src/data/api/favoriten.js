import { supabase } from '../../supabaseClient.js'

export async function listFavoritenIds(userId) {
  const { data, error } = await supabase
    .from('shop_favoriten')
    .select('artikel_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []).map((r) => r.artikel_id)
}

export async function addFavorit(userId, artikelId) {
  const { error } = await supabase
    .from('shop_favoriten')
    .upsert({ user_id: userId, artikel_id: artikelId }, { onConflict: 'user_id,artikel_id' })
  if (error) throw error
}

export async function removeFavorit(userId, artikelId) {
  const { error } = await supabase
    .from('shop_favoriten')
    .delete()
    .eq('user_id', userId)
    .eq('artikel_id', artikelId)
  if (error) throw error
}

export async function toggleFavorit(userId, artikelId, currentlyFavorited) {
  if (currentlyFavorited) await removeFavorit(userId, artikelId)
  else await addFavorit(userId, artikelId)
}
