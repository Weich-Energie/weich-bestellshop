import { supabase } from '../../supabaseClient.js'

// Alle freigegebenen (approved) Bestellwuensche, die noch keiner Sammelbestellung
// zugeordnet sind. Gruppierung nach Lieferant erfolgt im UI.
export async function listApprovedForSammel() {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .select(`
      id, user_id, menge, notiz, projekt_ref, created_at,
      shop_artikel ( id, name, lieferant, lieferant_url, preis_netto, einheit ),
      variante:shop_artikel_varianten ( id, name ),
      gebinde:shop_artikel_gebinde ( id, name, stueckzahl )
    `)
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// Legt eine Sammelbestellung an und markiert die enthaltenen Requests atomar als ordered.
// Beste-Effort-Rollback bei Fehler: keine Transaktion in Supabase-JS moeglich, deshalb
// vorsichtige Reihenfolge — bei Fehler nach Position-Insert bleiben Order + Positions
// aber Requests bleiben approved (koennen in naechster Runde neu gebuendelt werden).
export async function createSammelbestellung({
  lieferant, requestIds, versandkosten = null, gesamtbetrag = null,
  externBestellNr = null, bestellDatum = null, freigabeUserId = null,
}) {
  if (!lieferant || !requestIds?.length) throw new Error('Lieferant und mindestens 1 Position sind Pflicht.')

  // 1) Requests + Preise laden fuer Positions
  const { data: reqs, error: reqErr } = await supabase
    .from('shop_order_requests')
    .select('id, menge, shop_artikel ( preis_netto )')
    .in('id', requestIds)
  if (reqErr) throw reqErr

  // 2) Order anlegen
  const { data: order, error: orderErr } = await supabase
    .from('shop_orders')
    .insert({
      lieferant,
      bestell_datum: bestellDatum || new Date().toISOString(),
      versandkosten,
      gesamtbetrag,
      extern_bestell_nr: externBestellNr,
      freigabe_user: freigabeUserId,
      status: 'ordered',
    })
    .select()
    .single()
  if (orderErr) throw orderErr

  // 3) Positions einfuegen
  const positions = reqs.map((r) => ({
    order_id: order.id,
    order_request_id: r.id,
    menge: r.menge,
    einzelpreis_netto: r.shop_artikel?.preis_netto ?? null,
  }))
  const { error: posErr } = await supabase.from('shop_order_positions').insert(positions)
  if (posErr) throw posErr

  // 4) Requests auf ordered
  const { error: updErr } = await supabase
    .from('shop_order_requests')
    .update({ status: 'ordered' })
    .in('id', requestIds)
  if (updErr) throw updErr

  return order
}

// Aktive Sammelbestellungen (nicht received) mit Positionen + Artikel + User-Refs.
export async function listAktiveSammelbestellungen() {
  const { data, error } = await supabase
    .from('shop_orders')
    .select(`
      id, lieferant, bestell_datum, versandkosten, gesamtbetrag, extern_bestell_nr, status, created_at,
      shop_order_positions (
        id, menge, einzelpreis_netto,
        shop_order_requests (
          id, user_id, notiz, projekt_ref,
          shop_artikel ( id, name, einheit ),
          variante:shop_artikel_varianten ( id, name ),
          gebinde:shop_artikel_gebinde ( id, name, stueckzahl )
        )
      )
    `)
    .neq('status', 'received')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Historische Sammelbestellungen (received).
export async function listAbgeschlosseneSammelbestellungen(limit = 30) {
  const { data, error } = await supabase
    .from('shop_orders')
    .select(`
      id, lieferant, bestell_datum, versandkosten, gesamtbetrag, extern_bestell_nr, status, created_at,
      shop_order_positions (
        id, menge, einzelpreis_netto,
        shop_order_requests (
          id, user_id, shop_artikel ( id, name, einheit )
        )
      )
    `)
    .eq('status', 'received')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// Wareneingang: Sammelbestellung + alle enthaltenen Requests auf received.
export async function markiereBestellungReceived(orderId) {
  const { data: positions, error: posErr } = await supabase
    .from('shop_order_positions')
    .select('order_request_id')
    .eq('order_id', orderId)
  if (posErr) throw posErr

  const requestIds = (positions || []).map((p) => p.order_request_id)

  const { error: reqErr } = await supabase
    .from('shop_order_requests')
    .update({ status: 'received' })
    .in('id', requestIds)
  if (reqErr) throw reqErr

  const { data, error } = await supabase
    .from('shop_orders')
    .update({ status: 'received' })
    .eq('id', orderId)
    .select()
    .single()
  if (error) throw error
  return data
}

// User klickt "Abgeholt" auf einer einzelnen received Position.
export async function markiereAbgeholt(requestId) {
  const { data, error } = await supabase
    .from('shop_order_requests')
    .update({ status: 'closed' })
    .eq('id', requestId)
    .select()
    .single()
  if (error) throw error
  return data
}
