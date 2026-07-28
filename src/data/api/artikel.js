import { supabase } from '../../supabaseClient.js'
import { ensureTags } from './kategorien.js'

// Liest Artikel-Liste mit Kategorie und Tags. Sichtbar fuer alle Shop-User.
export async function listArtikel({ includeInaktiv = false } = {}) {
  let q = supabase
    .from('shop_artikel')
    .select(`
      id, name, beschreibung, kategorie_id, bild_url, bild_ist_extern,
      lieferant, lieferant_url, preis_netto, einheit, aktiv,
      shop_artikel_tags ( tag_id, shop_tags ( id, name ) )
    `)
    .order('name', { ascending: true })
  if (!includeInaktiv) q = q.eq('aktiv', true)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(normalizeArtikel)
}

export async function getArtikel(id) {
  const { data, error } = await supabase
    .from('shop_artikel')
    .select(`
      id, name, beschreibung, kategorie_id, bild_url, bild_ist_extern,
      lieferant, lieferant_url, preis_netto, einheit, aktiv,
      shop_artikel_tags ( tag_id, shop_tags ( id, name ) )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return normalizeArtikel(data)
}

function normalizeArtikel(row) {
  const tags = (row.shop_artikel_tags || [])
    .map((rel) => rel.shop_tags)
    .filter(Boolean)
  return { ...row, tags, shop_artikel_tags: undefined }
}

export async function createArtikel(fields, tagNamen = []) {
  const { data: user } = await supabase.auth.getUser()
  const created_by = user?.user?.id || null
  const { data, error } = await supabase
    .from('shop_artikel')
    .insert({ ...fields, created_by })
    .select()
    .single()
  if (error) throw error

  if (tagNamen.length) {
    const tags = await ensureTags(tagNamen)
    const rels = tags.map((t) => ({ artikel_id: data.id, tag_id: t.id }))
    const { error: linkErr } = await supabase.from('shop_artikel_tags').insert(rels)
    if (linkErr) throw linkErr
  }
  return data
}

export async function updateArtikel(id, fields, tagNamen) {
  const { data, error } = await supabase
    .from('shop_artikel')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  if (tagNamen !== undefined) {
    await supabase.from('shop_artikel_tags').delete().eq('artikel_id', id)
    if (tagNamen.length) {
      const tags = await ensureTags(tagNamen)
      const rels = tags.map((t) => ({ artikel_id: id, tag_id: t.id }))
      const { error: linkErr } = await supabase.from('shop_artikel_tags').insert(rels)
      if (linkErr) throw linkErr
    }
  }
  return data
}

export async function deleteArtikel(id) {
  const { error } = await supabase.from('shop_artikel').delete().eq('id', id)
  if (error) throw error
}
