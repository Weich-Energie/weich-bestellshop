import { supabase } from '../../supabaseClient.js'

export async function listKategorien() {
  const { data, error } = await supabase
    .from('shop_kategorien')
    .select('id, name, icon, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createKategorie({ name, icon = null, sort_order = 0 }) {
  const { data, error } = await supabase
    .from('shop_kategorien')
    .insert({ name, icon, sort_order })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateKategorie(id, patch) {
  const { data, error } = await supabase
    .from('shop_kategorien')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteKategorie(id) {
  const { error } = await supabase.from('shop_kategorien').delete().eq('id', id)
  if (error) throw error
}

// ─── Tags ───────────────────────────────────────────────────────────────
export async function listTags() {
  const { data, error } = await supabase
    .from('shop_tags')
    .select('id, name')
    .order('name')
  if (error) throw error
  return data || []
}

// Idempotent: legt Tags an, die noch nicht existieren, und gibt alle IDs zurueck.
export async function ensureTags(namen) {
  if (!namen?.length) return []
  const normalized = [...new Set(namen.map((n) => n.trim().toLowerCase()).filter(Boolean))]
  const existing = await listTags()
  const existingByName = new Map(existing.map((t) => [t.name.toLowerCase(), t]))
  const toCreate = normalized.filter((n) => !existingByName.has(n))
  if (toCreate.length) {
    const { data, error } = await supabase
      .from('shop_tags')
      .insert(toCreate.map((name) => ({ name })))
      .select('id, name')
    if (error) throw error
    for (const t of data || []) existingByName.set(t.name.toLowerCase(), t)
  }
  return normalized.map((n) => existingByName.get(n)).filter(Boolean)
}
