// abgleich-tabelle.mjs — Ergebnis von abgleich.mjs (VPS) als Vergleichstabelle:
// je Begriff der Referenz-EK (Reonic/Klimarechner) und der guenstigste
// Nettopreis je Shop.
//
// Aufruf: node abgleich-tabelle.mjs <abgleich.json> [--alle]   (--alle: alle Treffer je Shop, nicht nur den guenstigsten)

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const datei = args.find((a) => !a.startsWith('--'))
const alle = args.includes('--alle')
const d = JSON.parse(readFileSync(datei, 'utf8'))
const shops = Object.keys(d.shops)

const eur = (n) => (n == null ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €')
const pad = (s, n, r = false) => { s = String(s); return r ? s.padStart(n) : s.padEnd(n) }

console.log(`Stand ${d.stand} · Shops: ${shops.map((s) => `${s}${d.shops[s].fehler ? ' (FEHLER)' : ''}`).join(', ')}`)
console.log('')
console.log(pad('Begriff', 14) + pad('Referenz-EK', 13, true) + shops.map((s) => pad(s.slice(0, 14), 16, true)).join('') + '  Bemerkung')
console.log('-'.repeat(14 + 13 + 16 * shops.length + 12))

let guenstigerGesamt = 0
for (const b of d.begriffe) {
  const zellen = []
  const bem = []
  let bester = null
  for (const s of shops) {
    const t = d.shops[s]?.treffer?.[b.begriff]
    const passend = (t?.passend || []).filter((p) => p.netto_preis != null)
    if (!t) { zellen.push(pad('—', 16, true)); continue }
    if (t.fehler) { zellen.push(pad('Fehler', 16, true)); bem.push(`${s}: ${t.fehler.slice(0, 60)}`); continue }
    if (passend.length === 0) { zellen.push(pad(t.passend?.length ? 'ohne Preis' : 'nicht gefunden', 16, true)); continue }
    const min = passend.reduce((m, p) => (p.netto_preis < m.netto_preis ? p : m))
    zellen.push(pad(eur(min.netto_preis), 16, true))
    if (!bester || min.netto_preis < bester.preis) bester = { preis: min.netto_preis, shop: s, titel: min.titel, url: min.url }
    if (alle) for (const p of passend) bem.push(`${s}: ${eur(p.netto_preis)} ${p.titel?.slice(0, 60)} ${p.url}`)
  }
  if (bester && b.ek != null) {
    const diff = bester.preis - b.ek
    bem.unshift(`günstigster ${bester.shop} ${diff <= 0 ? '' : '+'}${eur(diff)} gegen Referenz`)
    if (diff < 0) guenstigerGesamt += -diff
  }
  console.log(pad(b.begriff, 14) + pad(eur(b.ek), 13, true) + zellen.join('') + '  ' + bem.join(' | '))
}
console.log('')
console.log(`Summe möglicher Ersparnis je Stück gegenüber Referenz-EK (nur wo günstiger): ${eur(guenstigerGesamt)}`)
