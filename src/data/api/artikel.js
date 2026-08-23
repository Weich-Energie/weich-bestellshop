import { supabase } from '../../supabaseClient.js'
import { ensureTags } from './kategorien.js'

const ARTIKEL_SELECT = `
  id, name, beschreibung, kategorie_id, bild_url, bild_ist_extern,
  lieferant, lieferant_url, artikelnr, preis_netto, einheit, aktiv,
  shop_artikel_tags ( tag_id, shop_tags ( id, name ) ),
  shop_artikel_varianten ( id, name, sort_order ),
  shop_artikel_gebinde ( id, name, stueckzahl, ist_default, sort_order )
`

// Liest Artikel-Liste mit Kategorie, Tags, Varianten und Gebinden.
export async function listArtikel({ includeInaktiv = false } = {}) {
  let q = supabase.from('shop_artikel').select(ARTIKEL_SELECT).order('name', { ascending: true })
  if (!includeInaktiv) q = q.eq('aktiv', true)
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
//
// Laeuft ueber eine security-definer-Funktion statt direkt auf der Tabelle: RLS
// zeigt einem Monteur dort nur seine EIGENEN Zeilen, der Hinweis warnte ihn also
// nie vor der Bestellung eines Kollegen — obwohl er genau dafuer gedacht ist.
// Die Funktion liefert ausschliesslich Zaehler, nie wer bestellt hat.
export async function listAktiveOrderCounts() {
  const { data, error } = await supabase.rpc('shop_aktive_bestell_zaehler')
  if (error) throw error
  return (data || []).map((r) => ({
    artikel_id: r.artikel_id,
    variante_id: r.variante_id,
    anzahl: Number(r.anzahl) || 0,
    menge_summe: Number(r.menge_summe) || 0,
    letztes_datum: r.letztes_datum,
  }))
}

// Varianten und Gebinde werden per Namen abgeglichen statt geloescht und neu
// angelegt. Grund: shop_order_requests.variante_id/gebinde_id zeigen mit
// "on delete set null" hierhin. Loeschen-und-neu hat deshalb bei JEDEM Speichern
// eines Artikels — auch bei einer reinen Preiskorrektur — die Variante aus allen
// bestehenden Bestellungen entfernt; aus "Handschuhe Gr. 10" wurde in Verlauf und
// Historie "Handschuhe". Gleicher Name heisst jetzt: gleiche ID bleibt.
// Wirklich entfernte Eintraege werden weiter geloescht (und verlieren ihren Bezug
// in alten Bestellungen) — das ist gewollt und die einzige verbleibende Luecke.
function gleicheZeile(vorhandene, name) {
  return vorhandene.find((v) => v.name.trim().toLowerCase() === name.toLowerCase()) || null
}

// Doppelte Namen wuerden beide auf dieselbe vorhandene Zeile zeigen — der erste gewinnt.
function ohneDoppelte(eintraege) {
  const gesehen = new Set()
  return eintraege.filter((e) => {
    const key = e.name.toLowerCase()
    if (gesehen.has(key)) return false
    gesehen.add(key)
    return true
  })
}

async function loescheUeberzaehlige(tabelle, vorhandene, behalten) {
  const weg = vorhandene.filter((v) => !behalten.has(v.id)).map((v) => v.id)
  if (!weg.length) return
  const { error } = await supabase.from(tabelle).delete().in('id', weg)
  if (error) throw error
}

// ─── Varianten ──────────────────────────────────────────────────────────
export async function replaceVarianten(artikelId, varianten) {
  // varianten: [{ id?, name, sort_order? }]
  const { data: vorhandene, error: leseErr } = await supabase
    .from('shop_artikel_varianten')
    .select('id, name, sort_order')
    .eq('artikel_id', artikelId)
  if (leseErr) throw leseErr

  const soll = ohneDoppelte(
    varianten
      .filter((v) => v.name?.trim())
      .map((v, i) => ({ name: v.name.trim(), sort_order: v.sort_order ?? i })),
  )

  const behalten = new Set()
  const neu = []
  for (const v of soll) {
    const alt = gleicheZeile(vorhandene || [], v.name)
    if (!alt) {
      neu.push({ artikel_id: artikelId, name: v.name, sort_order: v.sort_order })
      continue
    }
    behalten.add(alt.id)
    if (alt.name !== v.name || alt.sort_order !== v.sort_order) {
      const { error } = await supabase
        .from('shop_artikel_varianten')
        .update({ name: v.name, sort_order: v.sort_order })
        .eq('id', alt.id)
      if (error) throw error
    }
  }

  await loescheUeberzaehlige('shop_artikel_varianten', vorhandene || [], behalten)
  if (neu.length) {
    const { error } = await supabase.from('shop_artikel_varianten').insert(neu)
    if (error) throw error
  }
}

// ─── Gebinde ────────────────────────────────────────────────────────────
export async function replaceGebinde(artikelId, gebinde) {
  // gebinde: [{ id?, name, stueckzahl, ist_default?, sort_order? }]
  const { data: vorhandene, error: leseErr } = await supabase
    .from('shop_artikel_gebinde')
    .select('id, name, stueckzahl, ist_default, sort_order')
    .eq('artikel_id', artikelId)
  if (leseErr) throw leseErr

  // Nur ein Default erlaubt — der erste mit ist_default, sonst gar keiner.
  let defaultVergeben = false
  const soll = ohneDoppelte(
    gebinde
      .filter((g) => g.name?.trim() && Number(g.stueckzahl) >= 1)
      .map((g, i) => {
        const istDefault = !!g.ist_default && !defaultVergeben
        if (istDefault) defaultVergeben = true
        return {
          name: g.name.trim(),
          stueckzahl: Math.max(1, Number(g.stueckzahl) || 1),
          ist_default: istDefault,
          sort_order: g.sort_order ?? i,
        }
      }),
  )

  const behalten = new Set()
  const neu = []
  for (const g of soll) {
    const alt = gleicheZeile(vorhandene || [], g.name)
    if (!alt) {
      neu.push({ artikel_id: artikelId, ...g })
      continue
    }
    behalten.add(alt.id)
    const geaendert =
      alt.name !== g.name ||
      alt.stueckzahl !== g.stueckzahl ||
      alt.ist_default !== g.ist_default ||
      alt.sort_order !== g.sort_order
    if (geaendert) {
      const { error } = await supabase
        .from('shop_artikel_gebinde')
        .update(g)
        .eq('id', alt.id)
      if (error) throw error
    }
  }

  await loescheUeberzaehlige('shop_artikel_gebinde', vorhandene || [], behalten)
  if (neu.length) {
    const { error } = await supabase.from('shop_artikel_gebinde').insert(neu)
    if (error) throw error
  }
}
