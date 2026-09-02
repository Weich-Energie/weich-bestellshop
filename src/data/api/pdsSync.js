import { supabase } from '../../supabaseClient.js'

// Aufrufe der beiden PDS-Edge-Functions. Kein supabase.functions.invoke, aus
// demselben Grund wie in shopAi.js: bei non-2xx bleibt dort der Response-Body
// unzugaenglich, und genau darin steht die Ursache — bei pds-katalog-sync etwa
// die Liste der fehlenden Mappings.
async function invoke(funktion, payload) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Keine gültige Session — bitte neu anmelden.')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${funktion}`

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    throw new Error(`Netzwerkfehler beim Aufruf von ${funktion}: ${e.message || e}`)
  }

  const raw = await res.text()
  let body = null
  if (raw) {
    try { body = JSON.parse(raw) } catch { /* kein JSON — raw unten anzeigen */ }
  }

  // 422 ist kein Fehlerfall, sondern die Antwort "Mapping unvollstaendig" mit
  // der Liste der Luecken. Die gehoert in die Oberflaeche, nicht in einen throw.
  if (res.status === 422 && body?.luecken) return body

  if (!res.ok) {
    const detail = body?.error || (raw ? raw.slice(0, 400) : '(leere Antwort)')
    throw new Error(`${funktion} HTTP ${res.status}: ${detail}`)
  }
  if (body?.error) throw new Error(body.error)
  return body
}

// ─── Artikel mit Sync-Status ───────────────────────────────────────────────

// Getrennt von listArtikel in artikel.js, und mit Absicht: dort haengt der
// Katalog dran, den jeder Monteur oeffnet. Steht Migration 008 noch aus, faellt
// hier nur die Admin-Seite aus und nicht der Katalog.
export async function listArtikelMitPdsStatus() {
  const { data, error } = await supabase
    .from('shop_artikel')
    .select(`
      id, name, artikelnr, einheit, preis_netto, aktiv, kategorie_id,
      lieferant, lieferant_id,
      pds_katalog_uuid, pds_sync_status, pds_sync_at, pds_sync_fehler
    `)
    .order('name')
  if (error) {
    if (/column .* does not exist/i.test(error.message)) {
      throw new Error(
        'Die Spalten aus Migration 008 fehlen in der Datenbank. ' +
        'supabase/migrations/008_pds_katalog_sync.sql muss zuerst ausgefuehrt werden.',
      )
    }
    throw error
  }
  return data || []
}

// ─── Katalog-Sync ──────────────────────────────────────────────────────────

// Trockenlauf: prueft das Mapping und zeigt, was gesendet wuerde. Sendet nichts.
export async function pruefeArtikel(artikelId) {
  return invoke('pds-katalog-sync', { artikel_id: artikelId, dry_run: true })
}

// Echte Uebertragung. Legt in PDS an — nur aufrufen, wenn der Trockenlauf
// sauber war.
export async function uebertrageArtikel(artikelId) {
  return invoke('pds-katalog-sync', { artikel_id: artikelId, dry_run: false })
}

export async function listSyncProtokoll(artikelId = null, limit = 50) {
  let q = supabase
    .from('shop_pds_sync_log')
    .select('id, artikel_id, operation, dry_run, http_status, erfolg, fehler, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (artikelId) q = q.eq('artikel_id', artikelId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// ─── Stammdaten-Mapping ────────────────────────────────────────────────────

// Kategorien mit ihrem PDS-Ziel. Fehlt hier eine Warengruppe, kann kein Artikel
// dieser Kategorie uebertragen werden.
export async function listKategorienMitPds() {
  const { data, error } = await supabase
    .from('shop_kategorien')
    .select('id, name, pds_kategorie_uuid, pds_warengruppe_uuid')
    .order('name')
  if (error) throw error
  return data || []
}

export async function setzeKategorieMapping(id, { pds_kategorie_uuid, pds_warengruppe_uuid }) {
  const { error } = await supabase
    .from('shop_kategorien')
    .update({ pds_kategorie_uuid: pds_kategorie_uuid || null, pds_warengruppe_uuid: pds_warengruppe_uuid || null })
    .eq('id', id)
  if (error) throw error
}

export async function listEinheitenMapping() {
  const { data, error } = await supabase
    .from('shop_pds_einheiten')
    .select('shop_einheit, pds_bezeichnung, notiz')
    .order('shop_einheit')
  if (error) throw error
  return data || []
}

// ─── Nachkalkulation: Soll aus PDS ─────────────────────────────────────────

export async function sucheAuftraege(suchwort = 'Klima') {
  return invoke('pds-auftrag-soll', { aktion: 'suchen', suchwort })
}

export async function importiereSoll(vorgangUuid) {
  return invoke('pds-auftrag-soll', { aktion: 'importieren', vorgang_uuid: vorgangUuid })
}
