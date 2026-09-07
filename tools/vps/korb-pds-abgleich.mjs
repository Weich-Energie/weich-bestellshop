// korb-pds-abgleich.mjs — ordnet GUT-Korbnamen lesend PDS-Projektakten zu.
// Akzeptiert nur eindeutige Treffer: genau EINE Projektakte mit SHK-Auftrag.
// Prueft dann ueber die Rechnungsliste, ob die Baustelle abgerechnet ist.
// Laeuft auf dem VPS gegen den lokalen MCP-Server (wie mcp-lokal.mjs).
//
// Eingabe: JSON mit Korbnamen, z. B. Ausgabe von
//   select json_agg(json_build_object('name', name, 'positionen', positionen_gefunden)) from shop_gut_koerbe
// ueber `supabase db query -o json` ({rows:[{json_agg:[...]}]}) oder ein
// schlichtes Array [{name, positionen}]. Ein BOM am Dateianfang wird entfernt.
// Aufruf auf dem VPS (Token wie bei mcp-lokal.mjs per Wrapper in MCP_TOKEN):
//   node korb-pds-abgleich.mjs /tmp/koerbe-namen.json /tmp/korb-pds-abgleich.json
// Ergebnis und Regeln: docs/gut-korb-pds-zuordnung.md
import { readFileSync, writeFileSync } from 'node:fs'

const BASIS = process.env.MCP_URL ?? 'http://localhost:3000/mcp'
const EINGABE = process.argv[2] ?? '/tmp/koerbe-namen.json'
const AUSGABE = process.argv[3] ?? '/tmp/korb-pds-abgleich.json'

let sessionId = null
let naechsteId = 1
async function rpc(method, params, { erwarteAntwort = true } = {}) {
  const body = { jsonrpc: '2.0', method, params }
  if (erwarteAntwort) body.id = naechsteId++
  const r = await fetch(BASIS, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(process.env.MCP_TOKEN ? { authorization: `Bearer ${process.env.MCP_TOKEN}` } : {}),
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify(body),
  })
  const sid = r.headers.get('mcp-session-id')
  if (sid) sessionId = sid
  const text = await r.text()
  if (!erwarteAntwort) return null
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`)
  const ct = r.headers.get('content-type') ?? ''
  if (ct.includes('text/event-stream')) {
    const daten = text.split('\n').filter((z) => z.startsWith('data:')).map((z) => z.slice(5).trim()).filter(Boolean)
    const antworten = daten.map((d) => { try { return JSON.parse(d) } catch { return null } }).filter(Boolean)
    return antworten.find((a) => a.id === body.id) ?? antworten.at(-1)
  }
  return JSON.parse(text)
}

async function pds(name, body) {
  const antwort = await rpc('tools/call', { name: 'api_aufrufen', arguments: { name, args: { body } } })
  if (antwort?.error) throw new Error(JSON.stringify(antwort.error))
  const text = (antwort?.result?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  // Erste Zeile ist "200 200" o. ae., danach JSON
  const start = text.indexOf('{')
  if (start < 0) throw new Error(`keine JSON-Antwort: ${text.slice(0, 200)}`)
  const json = JSON.parse(text.slice(start))
  if (json.errorCode) throw new Error(`${json.errorCode} ${json.hinweis ?? ''}`)
  return json.daten ?? json
}

const STOPP = new Set(['nk', 'nachkalk', 'nachkalk.', 'nachk.', 'nachk', 'aufmaß', 'aufmass', 'hv', 'neu', 'teil', 'test'])
function suchkandidaten(name) {
  const tokens = name.split(/\s+/).filter((t) => t && !STOPP.has(t.toLowerCase()) && !/^\d+$/.test(t) && !/^[A-Za-zÄÖÜ]\.?$/.test(t))
  const voll = tokens.join(' ')
  const einzeln = tokens.filter((t) => t.length >= 4 && !/^\d/.test(t))
  return [...new Set([voll, ...einzeln].filter(Boolean))]
}

function gewerk(v) {
  return (v.selektionskriterien ?? []).find((s) => s.bezeichnung === 'Gewerk')?.wert ?? null
}
function rechnungsart(r) {
  return (r.selektionskriterien ?? []).find((s) => s.bezeichnung === 'Rechnungsart')?.wert ?? null
}

const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'korb-pds-abgleich', version: '0.1' } })
if (init?.error) { console.error('initialize fehlgeschlagen:', JSON.stringify(init.error)); process.exit(2) }
await rpc('notifications/initialized', {}, { erwarteAntwort: false })

const eingabe = JSON.parse(readFileSync(EINGABE, 'utf8').replace(/^﻿/, ''))
const koerbe = eingabe.rows?.[0]?.json_agg ?? eingabe
const ergebnis = []

for (const korb of koerbe) {
  const zeile = { korb: korb.name, positionen: korb.positionen, kandidaten: suchkandidaten(korb.name), status: 'offen' }
  ergebnis.push(zeile)
  try {
    if (zeile.kandidaten.length === 0) { zeile.status = 'kein_suchwort'; continue }
    let akten = []
    for (const kandidat of zeile.kandidaten) {
      const d = await pds('pds_getProjektakten', { suchwort: kandidat, suchfelder: ['ALLES'], entriesPerPage: 50 })
      akten = d.resultList ?? []
      zeile.suchwort = kandidat
      zeile.projektakten_treffer = d.totalHitCount ?? akten.length
      if (akten.length > 0) break
    }
    if (akten.length === 0) { zeile.status = 'keine_projektakte'; continue }
    if (akten.length > 15) { zeile.status = 'mehrdeutig_zu_viele'; continue }

    const shkAkten = []
    for (const akte of akten) {
      const v = await pds('pds_getListVorgaengeByProjektakte', { projektakteUUID: akte.uuid, vorgangstyp: 'AUFTRAG', entriesPerPage: 50 })
      const auftraege = (v.resultList ?? []).filter((a) => gewerk(a) === 'SHK')
      if (auftraege.length > 0) {
        shkAkten.push({
          projektakte_uuid: akte.uuid,
          projektakte_nummer: akte.nummer ?? akte.projektakteNummer ?? null,
          bezeichnung: akte.bezeichnung ?? akte.name ?? null,
          auftraege: auftraege.map((a) => ({ uuid: a.uuid, nummer: a.vorgangsNummer, bezeichnung: a.bezeichnung, status: a.vorgangStatus?.bezeichnung ?? null })),
        })
      }
    }
    zeile.shk_projektakten = shkAkten.length
    if (shkAkten.length === 0) { zeile.status = 'kein_shk_auftrag'; continue }
    if (shkAkten.length > 1) { zeile.status = 'mehrdeutig_shk'; zeile.treffer = shkAkten; continue }

    const akte = shkAkten[0]
    zeile.treffer = akte
    const r = await pds('pds_getListRechnungen', { suchwort: zeile.suchwort, entriesPerPage: 100 })
    const rechnungen = (r.resultList ?? []).filter((x) => x.projektakteUUID === akte.projektakte_uuid)
    zeile.rechnungen = rechnungen.map((x) => ({ nummer: x.vorgangsNummer, art: rechnungsart(x), status: x.vorgangStatus?.bezeichnung ?? null, extern: x.externeNummer ?? null }))
    const schluss = rechnungen.filter((x) => rechnungsart(x) !== 'Abschlagsrechnung' && x.vorgangStatus?.kategorie === 'Abgerechnet')
    zeile.status = schluss.length > 0 ? 'abgerechnet' : rechnungen.length > 0 ? 'nur_abschlaege' : 'ohne_rechnung'
  } catch (e) {
    zeile.status = 'fehler'
    zeile.fehler = String(e.message ?? e).slice(0, 300)
  }
  console.log(`${zeile.status.padEnd(20)} ${korb.name}${zeile.treffer?.auftraege ? ' → ' + zeile.treffer.auftraege.map((a) => a.nummer).join(', ') : ''}`)
  writeFileSync(AUSGABE, JSON.stringify(ergebnis, null, 2))
}

const zaehlung = {}
for (const z of ergebnis) zaehlung[z.status] = (zaehlung[z.status] ?? 0) + 1
console.log('\nZusammenfassung:', JSON.stringify(zaehlung))
if (sessionId) await fetch(BASIS, { method: 'DELETE', headers: { 'mcp-session-id': sessionId } }).catch(() => {})
process.exit(0)
