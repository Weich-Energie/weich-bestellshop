import { supabase } from '../../supabaseClient.js'
import { ensureTags } from './kategorien.js'

// Bewusst OHNE die pds_-Spalten und lieferant_id aus Migration 008: diese Liste
// treibt den Katalog, den jeder Monteur oeffnet. Steht die Migration noch aus,
// wuerde eine Spalte hier die zentrale Seite lahmlegen. Den Sync-Status holt
// listArtikelMitPdsStatus in pdsSync.js getrennt — faellt das aus, betrifft es
// nur die Admin-Seite.
const ARTIKEL_SELECT = `
  id, name, beschreibung, kategorie_id, bild_url, bild_ist_extern,
  lieferant, lieferant_url, artikelnr, preis_netto, einheit, aktiv,
  aufschlagsklasse, bestellbar, nachkalkulation_klima,
  shop_artikel_tags ( tag_id, shop_tags ( id, name ) ),
  shop_artikel_varianten ( id, name, sort_order ),
  shop_artikel_gebinde ( id, name, stueckzahl, ist_default, sort_order )
`

// Liest Artikel-Liste mit Kategorie, Tags, Varianten und Gebinden.
//
// Zwei fachliche Sichten auf denselben Stamm (Migration 014): Der Katalog
// zeigt nur bestellbare Artikel, die Nachkalkulation (und spaeter die
// Aufmass-App) nur die mit Kennzeichen "Nachkalkulation Klima". Ein Artikel
// kann in beiden, in einer oder in keiner Sicht liegen — Geraete etwa werden
// kalkuliert, aber ueber den Grosshandel beschafft, nicht ueber den Shop.
export async function listArtikel({ includeInaktiv = false, nurBestellbar = false, nurNachkalkulation = false } = {}) {
  let q = supabase.from('shop_artikel').select(ARTIKEL_SELECT).order('name', { ascending: true })
  if (!includeInaktiv) q = q.eq('aktiv', true)
  if (nurBestellbar) q = q.eq('bestellbar', true)
  if (nurNachkalkulation) q = q.eq('nachkalkulation_klima', true)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(normalizeArtikel)
}

export async function getArtikel(id) {
  const { data, error } = await supabase.from('shop_artikel').select(ARTIKEL_SELECT).eq('id', id).single()
  if (error) throw error
  return normalizeArtikel(data)
}

function normalizeArtikel(row) {
  const tags = (row.shop_artikel_tags || []).map((rel) => rel.shop_tags).filter(Boolean)
  const varianten = (row.shop_artikel_varianten || []).slice().sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  const gebinde = (row.shop_artikel_gebinde || []).slice().sort((a, b) => a.sort_order - b.sort_order || a.stueckzahl - b.stueckzahl)
  return {
    ...row,
    tags, varianten, gebinde,
    shop_artikel_tags: undefined,
    shop_artikel_varianten: undefined,
    shop_artikel_gebinde: undefined,
  }
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

// Aktive Bestellwuensche (pending/approved/ordered) — hilft Doppelbestellungen zu erkennen.
// Rueckgabe: Liste { artikel_id, variante_id, menge_summe, anzahl, letztes_datum }
export async function listAktiveOrderCounts() {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .select('artikel_id, variante_id, menge, created_at, status')
    .in('status', ['pending', 'approved', 'ordered'])
  if (error) throw error
  const map = new Map()
  for (const r of data || []) {
    const key = `${r.artikel_id}::${r.variante_id || ''}`
    const cur = map.get(key) || {
      artikel_id: r.artikel_id, variante_id: r.variante_id,
      anzahl: 0, menge_summe: 0, letztes_datum: null,
    }
    cur.anzahl += 1
    cur.menge_summe += r.menge
    if (!cur.letztes_datum || r.created_at > cur.letztes_datum) cur.letztes_datum = r.created_at
    map.set(key, cur)
  }
  return [...map.values()]
}

// ─── Varianten ──────────────────────────────────────────────────────────
export async function replaceVarianten(artikelId, varianten) {
  // varianten: [{ id?, name, sort_order? }]
  await supabase.from('shop_artikel_varianten').delete().eq('artikel_id', artikelId)
  const clean = varianten.filter((v) => v.name?.trim())
  if (clean.length) {
    const rows = clean.map((v, i) => ({
      artikel_id: artikelId,
      name: v.name.trim(),
      sort_order: v.sort_order ?? i,
    }))
    const { error } = await supabase.from('shop_artikel_varianten').insert(rows)
    if (error) throw error
  }
}

// ─── Gebinde ────────────────────────────────────────────────────────────
export async function replaceGebinde(artikelId, gebinde) {
  // gebinde: [{ id?, name, stueckzahl, ist_default?, sort_order? }]
  await supabase.from('shop_artikel_gebinde').delete().eq('artikel_id', artikelId)
  const clean = gebinde.filter((g) => g.name?.trim() && Number(g.stueckzahl) >= 1)
  if (clean.length) {
    // Nur ein Default erlaubt — nimm den ersten mit ist_default, sonst gar keiner
    let defaultTaken = false
    const rows = clean.map((g, i) => {
      const isDef = !!g.ist_default && !defaultTaken
      if (isDef) defaultTaken = true
      return {
        artikel_id: artikelId,
        name: g.name.trim(),
        stueckzahl: Math.max(1, Number(g.stueckzahl) || 1),
        ist_default: isDef,
        sort_order: g.sort_order ?? i,
      }
    })
    const { error } = await supabase.from('shop_artikel_gebinde').insert(rows)
    if (error) throw error
  }
}
