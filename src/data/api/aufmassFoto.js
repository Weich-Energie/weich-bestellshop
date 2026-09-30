// Aufmasszettel als Foto — die Uebergangsloesung, bis das Aufmass durchgaengig
// in der App erfasst wird (Gewerk klima in weich-aufmass).
//
// Ablauf: Foto hochladen, KI liest die Zeilen, Mensch bestaetigt, daraus werden
// Nachkalkulations-Positionen. Zwischen "gelesen" und "Position" liegt bewusst
// ein Bestaetigungsschritt: Handschrift wird verwechselt, und der Vordruck
// traegt gedruckte Mengen, die nicht gelten.

import { supabase } from '../../supabaseClient.js'
import { normalizeArtikelnr } from './belege.js'

const BUCKET = 'shop-belege'
const PRAEFIX = 'aufmass'

// ─── Hochladen ─────────────────────────────────────────────────────────

export async function uploadAufmassFoto({ nachkalkulationId, file, seitennr = null, erfasstVon = null }) {
  const stamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const pfad = `${PRAEFIX}/${nachkalkulationId}/${stamp}-${rand}-${name}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(pfad, file, { cacheControl: '3600', upsert: false })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('shop_aufmass_foto')
    .insert({
      nachkalkulation_id: nachkalkulationId,
      bild_pfad: pfad,
      original_name: file.name,
      seitennr,
      status: 'neu',
      erfasst_von: erfasstVon || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Lesen lassen ──────────────────────────────────────────────────────

// Ruft shop-ai, schreibt die gelesenen Zeilen und ordnet ihnen Shop-Artikel zu.
// Ein zweiter Lauf ersetzt die noch offenen Zeilen; bereits uebernommene
// bleiben stehen, sonst haette man sie doppelt in der Nachkalkulation.
export async function leseAufmassFoto(fotoId) {
  const { data: foto, error: fErr } = await supabase
    .from('shop_aufmass_foto')
    .select('id, bild_pfad, nachkalkulation_id')
    .eq('id', fotoId)
    .single()
  if (fErr) throw fErr

  await supabase.from('shop_aufmass_foto').update({ status: 'laeuft', fehler_text: null }).eq('id', fotoId)

  try {
    const { data: signed, error: sErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(foto.bild_pfad, 300)
    if (sErr) throw sErr

    // Die Klima-Artikel als Abgleichliste mitgeben. Das ist der groesste Hebel
    // fuer die Lesequalitaet: das Modell muss die Nummer nicht raten, sondern
    // kann sie wiedererkennen.
    const artikel = await klimaArtikel()
    const hinweis = artikel
      .map((a) => `${a.artikelnr || '—'} = ${a.name}`)
      .join('\n')

    const { data: antwort, error: aiErr } = await supabase.functions.invoke('shop-ai', {
      body: { task: 'extract_aufmass', bild_url: signed.signedUrl, artikel_hinweis: hinweis },
    })
    if (aiErr) throw aiErr
    if (antwort?.error) throw new Error(antwort.error)
    const ergebnis = antwort?.result
    if (!ergebnis) throw new Error('Kein Ergebnis von der KI')

    // Offene Zeilen eines frueheren Laufs raeumen, uebernommene nicht anfassen.
    await supabase.from('shop_aufmass_foto_zeile').delete().eq('foto_id', fotoId).eq('status', 'offen')

    const zeilen = Array.isArray(ergebnis.zeilen) ? ergebnis.zeilen : []
    const rows = zeilen
      .filter((z) => z && z.menge != null && Number(z.menge) > 0)
      .map((z) => {
        const treffer = findeArtikel(artikel, z)
        return {
          foto_id: fotoId,
          roh_artikelnr: z.artikelnr || null,
          roh_bezeichnung: z.bezeichnung || null,
          roh_menge: Number(z.menge),
          roh_einheit: z.einheit || null,
          sicherheit: z.sicherheit != null ? Math.min(1, Math.max(0, Number(z.sicherheit))) : null,
          artikel_id: treffer.artikel?.id || null,
          treffer_art: treffer.art,
          notiz: z.notiz || null,
          status: 'offen',
        }
      })

    if (rows.length) {
      const { error: insErr } = await supabase.from('shop_aufmass_foto_zeile').insert(rows)
      if (insErr) throw insErr
    }

    await supabase
      .from('shop_aufmass_foto')
      .update({ status: 'gelesen', gelesen_am: new Date().toISOString() })
      .eq('id', fotoId)

    return {
      kopf: {
        baustelle: ergebnis.baustelle || null,
        datum: ergebnis.datum || null,
        monteur: ergebnis.monteur || null,
        stunden: ergebnis.stunden != null ? Number(ergebnis.stunden) : null,
      },
      zeilen: rows.length,
      ohne_artikel: rows.filter((r) => !r.artikel_id).length,
      unsicher: rows.filter((r) => r.sicherheit != null && r.sicherheit < 0.8).length,
    }
  } catch (e) {
    await supabase
      .from('shop_aufmass_foto')
      .update({ status: 'fehler', fehler_text: e.message || String(e) })
      .eq('id', fotoId)
    throw e
  }
}

// Die Artikel, die in der Nachkalkulation ueberhaupt in Frage kommen.
async function klimaArtikel() {
  const { data, error } = await supabase
    .from('shop_artikel')
    .select('id, artikelnr, name, einheit, preis_netto')
    .eq('aktiv', true)
    .eq('nachkalkulation_klima', true)
    .order('name')
  if (error) throw error
  return data || []
}

// Artikelnummer schlaegt Namen. Eine uebereinstimmende Nummer ist ein harter
// Treffer, der Namensvergleich bleibt Heuristik — deshalb steht die Herkunft
// des Treffers an der Zeile und ist in der Liste sichtbar.
function findeArtikel(artikel, zeile) {
  const nr = normalizeArtikelnr(zeile.artikelnr)
  if (nr) {
    const treffer = artikel.find((a) => normalizeArtikelnr(a.artikelnr) === nr)
    if (treffer) return { artikel: treffer, art: 'artikelnr' }
  }
  const text = String(zeile.bezeichnung || '').toLowerCase().trim()
  if (text.length > 4) {
    const treffer = artikel.find((a) => {
      const n = a.name.toLowerCase().trim()
      return n === text || n.includes(text) || text.includes(n)
    })
    if (treffer) return { artikel: treffer, art: 'name' }
  }
  return { artikel: null, art: 'keiner' }
}

// ─── Lesen ─────────────────────────────────────────────────────────────

export async function listFotos(nachkalkulationId) {
  const { data, error } = await supabase
    .from('shop_aufmass_foto')
    .select(`
      id, bild_pfad, original_name, seitennr, status, fehler_text, gelesen_am, created_at,
      shop_aufmass_foto_zeile ( id, status, artikel_id, sicherheit )
    `)
    .eq('nachkalkulation_id', nachkalkulationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map((f) => {
    const z = f.shop_aufmass_foto_zeile || []
    return {
      ...f,
      shop_aufmass_foto_zeile: undefined,
      zeilen_gesamt: z.length,
      zeilen_offen: z.filter((x) => x.status === 'offen').length,
      zeilen_ohne_artikel: z.filter((x) => x.status === 'offen' && !x.artikel_id).length,
      zeilen_unsicher: z.filter((x) => x.status === 'offen' && x.sicherheit != null && Number(x.sicherheit) < 0.8).length,
    }
  })
}

export async function listZeilen(fotoId) {
  const { data, error } = await supabase
    .from('shop_aufmass_foto_zeile')
    .select(`
      id, roh_artikelnr, roh_bezeichnung, roh_menge, roh_einheit, sicherheit,
      artikel_id, treffer_art, status, position_id, notiz,
      artikel:shop_artikel ( id, artikelnr, name, einheit, preis_netto )
    `)
    .eq('foto_id', fotoId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getFotoSignedUrl(pfad, gueltigSek = 3600) {
  if (!pfad) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pfad, gueltigSek)
  if (error) throw error
  return data?.signedUrl || null
}

// ─── Zeilen bearbeiten ─────────────────────────────────────────────────

export async function setZeileMenge(id, menge) {
  const { error } = await supabase
    .from('shop_aufmass_foto_zeile')
    .update({ roh_menge: Number(menge) })
    .eq('id', id)
  if (error) throw error
}

export async function setZeileArtikel(id, artikelId) {
  const { error } = await supabase
    .from('shop_aufmass_foto_zeile')
    .update({ artikel_id: artikelId, treffer_art: artikelId ? 'name' : 'keiner' })
    .eq('id', id)
  if (error) throw error
}

export async function verwirfZeile(id) {
  const { error } = await supabase
    .from('shop_aufmass_foto_zeile')
    .update({ status: 'verworfen' })
    .eq('id', id)
  if (error) throw error
}

// ─── Uebernahme in die Nachkalkulation ─────────────────────────────────

// Der Einkaufspreis wird hier kopiert und nicht verknuepft — dieselbe Regel wie
// bei jeder anderen Position: eine spaetere Preisaenderung darf eine
// abgeschlossene Nachkalkulation nicht rueckwirkend verschieben.
//
// Zeilen ohne Artikel gehen als Freitext durch. Sie bleiben damit sichtbar und
// sind die Arbeitsliste fuer den Artikelstamm der Aufmass-App: was hier steht,
// wurde verbaut und fehlt im Katalog.
export async function uebernimmZeilen(nachkalkulationId, zeilen) {
  const ergebnis = { uebernommen: 0, freitext: 0, uebersprungen: 0 }

  for (const z of zeilen) {
    if (z.status !== 'offen') { ergebnis.uebersprungen += 1; continue }
    const menge = Number(z.roh_menge)
    if (!(menge > 0)) { ergebnis.uebersprungen += 1; continue }

    const artikel = z.artikel || null
    const einzel = artikel?.preis_netto != null ? Number(artikel.preis_netto) : null

    const { data: pos, error } = await supabase
      .from('shop_nachkalkulation_positionen')
      .insert({
        nachkalkulation_id: nachkalkulationId,
        artikel_id: artikel?.id || null,
        freitext: artikel ? null : (z.roh_bezeichnung || z.roh_artikelnr || 'ohne Bezeichnung'),
        menge,
        einheit: z.roh_einheit || artikel?.einheit || null,
        ek_einzel: einzel,
        ek_gesamt: einzel != null ? Math.round(einzel * menge * 100) / 100 : null,
        quelle: 'monteur',
        notiz: z.notiz || null,
      })
      .select('id')
      .single()
    if (error) throw error

    await supabase
      .from('shop_aufmass_foto_zeile')
      .update({ status: 'uebernommen', position_id: pos.id })
      .eq('id', z.id)

    ergebnis.uebernommen += 1
    if (!artikel) ergebnis.freitext += 1
  }

  return ergebnis
}

// Setzt das Foto auf "uebernommen", wenn keine offene Zeile mehr da ist.
export async function fotoStatusNachziehen(fotoId) {
  const { count, error } = await supabase
    .from('shop_aufmass_foto_zeile')
    .select('id', { count: 'exact', head: true })
    .eq('foto_id', fotoId)
    .eq('status', 'offen')
  if (error) throw error
  if (count === 0) {
    await supabase.from('shop_aufmass_foto').update({ status: 'uebernommen' }).eq('id', fotoId)
  }
}

// ─── Loeschen ──────────────────────────────────────────────────────────

// Das Bild geht mit. Die daraus entstandenen Positionen bleiben stehen — sie
// gehoeren zur Nachkalkulation, nicht zum Foto.
export async function deleteFoto(id) {
  const { data: foto } = await supabase.from('shop_aufmass_foto').select('bild_pfad').eq('id', id).single()
  if (foto?.bild_pfad) {
    try { await supabase.storage.from(BUCKET).remove([foto.bild_pfad]) } catch { /* egal */ }
  }
  const { error } = await supabase.from('shop_aufmass_foto').delete().eq('id', id)
  if (error) throw error
}
