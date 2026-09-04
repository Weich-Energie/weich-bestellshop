import { supabase } from '../../supabaseClient.js'

const NK_SELECT = `
  id, pds_vorgang_uuid, pds_vorgangs_nummer, bezeichnung,
  soll_vk_gesamt, soll_ek_geraete, soll_vk_geraete, soll_erloes_montage,
  soll_ek_leistungen, soll_vk_leistungen, soll_stand, soll_positionen,
  pds_transport_uuid, pds_transport_nummer, pds_transport_at, pds_transport_positionen,
  status, notiz, created_at, updated_at,
  shop_nachkalkulation_positionen (
    id, artikel_id, freitext, menge, einheit, ek_einzel, ek_gesamt, quelle, notiz, pds_transport_at,
    shop_artikel ( id, name, einheit, pds_katalog_uuid )
  )
`

export async function listNachkalkulationen() {
  const { data, error } = await supabase
    .from('shop_nachkalkulation')
    .select(NK_SELECT)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalize)
}

export async function getNachkalkulation(id) {
  const { data, error } = await supabase.from('shop_nachkalkulation').select(NK_SELECT).eq('id', id).single()
  if (error) throw error
  return normalize(data)
}

// Rechnet die Kennzahlen an einer Stelle aus, damit Liste und Detailansicht
// nicht auseinanderlaufen koennen.
function normalize(row) {
  const positionen = (row.shop_nachkalkulation_positionen || []).map((p) => ({
    ...p,
    artikel: p.shop_artikel || null,
    shop_artikel: undefined,
  }))

  const istErfasst = positionen.reduce((s, p) => s + Number(p.ek_gesamt || 0), 0)

  // Wo der Betrieb das Material in einer Leistungsposition sammelt (Muster C),
  // steht der Einstandspreis schon im Auftrag. Er zaehlt als Ist mit, sonst
  // erscheint der Auftrag besser als er ist — und wer ihn von Hand nachtraegt,
  // zaehlt ihn doppelt.
  const istAusAuftrag = Number(row.soll_ek_leistungen || 0)
  const istMaterial = istErfasst + istAusAuftrag

  // Leitgroesse: Gesamterloes minus die Einkaufspreise, die wirklich
  // Einkaufspreise sind. soll_ek_geraete enthaelt nur echten Fremdeinkauf —
  // Eigenleistungs-Positionen (eigene Firma als Lieferant, oder EK gleich VK)
  // bleiben aussen vor, siehe docs/nachkalkulation-datenmodell.md.
  const deckung = Number(row.soll_vk_gesamt || 0) - Number(row.soll_ek_geraete || 0)

  return {
    ...row,
    positionen,
    shop_nachkalkulation_positionen: undefined,
    ist_material: runde(istMaterial),
    ist_erfasst: runde(istErfasst),
    ist_aus_auftrag: runde(istAusAuftrag),
    deckung_material_und_lohn: runde(deckung),
    // Was nach dem tatsaechlichen Materialeinsatz fuer Lohn und Gewinn bleibt.
    // Negativ heisst: das Material allein hat den Rest aufgezehrt.
    rest_fuer_lohn: runde(deckung - istMaterial),
    geraetemarge: runde(Number(row.soll_vk_geraete || 0) - Number(row.soll_ek_geraete || 0)),
  }
}

function runde(n) {
  return Math.round(n * 100) / 100
}

export async function setStatus(id, status) {
  const { error } = await supabase.from('shop_nachkalkulation').update({ status }).eq('id', id)
  if (error) throw error
}

export async function setNotiz(id, notiz) {
  const { error } = await supabase.from('shop_nachkalkulation').update({ notiz }).eq('id', id)
  if (error) throw error
}

// ek_einzel wird beim Anlegen aus dem Artikel kopiert und nicht verknuepft:
// aendert sich der Einkaufspreis spaeter, darf sich eine abgeschlossene
// Nachkalkulation nicht rueckwirkend verschieben.
export async function addPosition(nachkalkulationId, { artikel = null, freitext = null, menge, einheit = null, ekEinzel = null, quelle = 'monteur', notiz = null }) {
  const einzel = ekEinzel != null ? Number(ekEinzel) : (artikel?.preis_netto != null ? Number(artikel.preis_netto) : null)
  const m = Number(menge)

  const { data, error } = await supabase
    .from('shop_nachkalkulation_positionen')
    .insert({
      nachkalkulation_id: nachkalkulationId,
      artikel_id: artikel?.id || null,
      freitext: artikel ? null : (freitext || null),
      menge: m,
      einheit: einheit || artikel?.einheit || null,
      ek_einzel: einzel,
      ek_gesamt: einzel != null ? runde(einzel * m) : null,
      quelle,
      notiz,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePosition(id) {
  const { error } = await supabase.from('shop_nachkalkulation_positionen').delete().eq('id', id)
  if (error) throw error
}
