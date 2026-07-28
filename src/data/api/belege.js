import { supabase } from '../../supabaseClient.js'

const BELEG_BUCKET = 'shop-belege'

// ─── Upload + Verarbeitung ─────────────────────────────────────────────

// Speichert PDF im Storage, legt Beleg-Row (status=processing) an.
export async function uploadBeleg({ file, importedBy }) {
  const stamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${stamp}-${rand}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error: upErr } = await supabase.storage
    .from(BELEG_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('shop_belege')
    .insert({
      pdf_url: path,
      original_name: file.name,
      status: 'processing',
      imported_by: importedBy || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Ruft die shop-ai Edge Function, schreibt Meta + Positionen zurueck.
// Duplikat-Check gegen shop_artikel per Name-Match.
export async function processBeleg({ belegId, kategorien = [] }) {
  // 1) Beleg laden fuer pdf_url
  const { data: beleg, error: bErr } = await supabase
    .from('shop_belege')
    .select('id, pdf_url')
    .eq('id', belegId)
    .single()
  if (bErr) throw bErr

  // 2) Signed URL fuer Edge Function generieren
  const { data: signedData, error: sErr } = await supabase.storage
    .from(BELEG_BUCKET)
    .createSignedUrl(beleg.pdf_url, 300) // 5 min genuegt fuer die Verarbeitung
  if (sErr) throw sErr

  // 3) KI aufrufen
  let extracted
  try {
    const { data, error } = await supabase.functions.invoke('shop-ai', {
      body: {
        task: 'extract_beleg',
        pdf_url: signedData.signedUrl,
        kategorien,
      },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    extracted = data?.result
  } catch (e) {
    await supabase.from('shop_belege').update({ status: 'error', error_msg: e.message || String(e) }).eq('id', belegId)
    throw e
  }
  if (!extracted) {
    await supabase.from('shop_belege').update({ status: 'error', error_msg: 'Kein Ergebnis' }).eq('id', belegId)
    throw new Error('Kein Ergebnis von der KI')
  }

  // 4) Meta zurueckschreiben
  await supabase
    .from('shop_belege')
    .update({
      lieferant: extracted.lieferant || null,
      rechnungsnr: extracted.rechnungsnr || null,
      rechnungsdatum: extracted.rechnungsdatum && /^\d{4}-\d{2}-\d{2}$/.test(extracted.rechnungsdatum)
        ? extracted.rechnungsdatum : null,
      gesamtbetrag: extracted.gesamtbetrag != null ? Number(extracted.gesamtbetrag) : null,
      status: 'ready',
      error_msg: null,
    })
    .eq('id', belegId)

  // 5) Positionen einfuegen
  const positions = Array.isArray(extracted.positionen) ? extracted.positionen : []
  if (positions.length === 0) return { beleg_id: belegId, positions_count: 0 }

  // Duplikat-Check: hole existierende Artikel-Namen fuer Fuzzy-Match
  const { data: existArtikel } = await supabase.from('shop_artikel').select('id, name')
  const nameToArtikel = new Map((existArtikel || []).map((a) => [a.name.toLowerCase().trim(), a]))

  const rows = positions.map((p) => {
    const desc = String(p.beschreibung || '').trim()
    const key = desc.toLowerCase()
    // Simpler Match: erste zwei Worte
    const firstTwoWords = key.split(/\s+/).slice(0, 2).join(' ')
    let duplikat = null
    for (const [aName, a] of nameToArtikel) {
      if (aName === key || aName.includes(firstTwoWords) || firstTwoWords.length > 4 && key.includes(aName)) {
        duplikat = a
        break
      }
    }
    return {
      beleg_id: belegId,
      raw_beschreibung: desc,
      raw_menge: p.menge != null ? Number(p.menge) : null,
      raw_einzelpreis: p.einzelpreis != null ? Number(p.einzelpreis) : null,
      raw_artikelnr: p.artikelnr || null,
      ki_kategorie: p.kategorie || null,
      ki_tags: Array.isArray(p.tags) ? p.tags : null,
      ki_einheit: p.einheit || null,
      duplikat_artikel_id: duplikat?.id || null,
      status: duplikat ? 'duplikat' : 'pending',
    }
  })

  const { error: insErr } = await supabase.from('shop_beleg_positionen').insert(rows)
  if (insErr) throw insErr

  return { beleg_id: belegId, positions_count: rows.length, duplikate: rows.filter((r) => r.status === 'duplikat').length }
}

// ─── Reads ─────────────────────────────────────────────────────────────
export async function listBelege() {
  const { data, error } = await supabase
    .from('shop_belege')
    .select(`
      id, pdf_url, original_name, lieferant, rechnungsnr, rechnungsdatum,
      gesamtbetrag, status, error_msg, created_at
    `)
    .order('created_at', { ascending: false })
  if (error) throw error

  // Zaehle offene Positionen pro Beleg (pending oder spaeter)
  const belegIds = (data || []).map((b) => b.id)
  if (belegIds.length === 0) return []
  const { data: counts } = await supabase
    .from('shop_beleg_positionen')
    .select('beleg_id, status')
    .in('beleg_id', belegIds)
  const summary = new Map()
  for (const c of counts || []) {
    const cur = summary.get(c.beleg_id) || { total: 0, pending: 0, spaeter: 0, uebernommen: 0, ignoriert: 0, duplikat: 0 }
    cur.total += 1
    cur[c.status] = (cur[c.status] || 0) + 1
    summary.set(c.beleg_id, cur)
  }
  return data.map((b) => ({ ...b, positions_summary: summary.get(b.id) || { total: 0, pending: 0, spaeter: 0, uebernommen: 0, ignoriert: 0, duplikat: 0 } }))
}

export async function listPositionen(belegId) {
  const { data, error } = await supabase
    .from('shop_beleg_positionen')
    .select(`
      id, seitennr, raw_beschreibung, raw_menge, raw_einzelpreis, raw_artikelnr,
      ki_kategorie, ki_tags, ki_einheit, duplikat_artikel_id, uebernommen_artikel_id,
      status, ignore_grund,
      duplikat:shop_artikel!duplikat_artikel_id ( id, name )
    `)
    .eq('beleg_id', belegId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// ─── Position-Aktionen ─────────────────────────────────────────────────
export async function markPositionUebernommen(id, artikelId) {
  const { data, error } = await supabase
    .from('shop_beleg_positionen')
    .update({ status: 'uebernommen', uebernommen_artikel_id: artikelId })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markPositionIgnoriert(id, grund) {
  const { data, error } = await supabase
    .from('shop_beleg_positionen')
    .update({ status: 'ignoriert', ignore_grund: grund || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markPositionSpaeter(id) {
  const { data, error } = await supabase
    .from('shop_beleg_positionen')
    .update({ status: 'spaeter' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Beleg loeschen (inkl. PDF im Storage) ────────────────────────────
export async function deleteBeleg(id) {
  const { data: beleg } = await supabase.from('shop_belege').select('pdf_url').eq('id', id).single()
  if (beleg?.pdf_url) {
    try { await supabase.storage.from(BELEG_BUCKET).remove([beleg.pdf_url]) } catch { /* egal */ }
  }
  const { error } = await supabase.from('shop_belege').delete().eq('id', id)
  if (error) throw error
}

// ─── Signed URL fuer PDF-Vorschau ─────────────────────────────────────
export async function getBelegSignedUrl(path, expiresIn = 3600) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BELEG_BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data?.signedUrl || null
}
