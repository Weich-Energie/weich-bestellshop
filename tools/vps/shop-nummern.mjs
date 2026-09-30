// shop-nummern.mjs — Artikelnummern in EINEM beliebigen Lieferantenshop
// nachschlagen. Rein lesend, nichts wird in einen Warenkorb gelegt.
//
// Verallgemeinerung von fega-nummern.mjs: dieselbe Aufgabe stellt sich bei
// jedem Shop, und beim Regieaufmass weiss man vorher nicht, wo ein Artikel
// herkommt. Gleichzeitig ist das die Vorarbeit fuer den Knopf in der App
// ("Bei <Lieferant> suchen") — die Antwort hat schon das Format, das dort
// gebraucht wird.
//
// Aufruf: node shop-nummern.mjs --lieferant gut SPUS28251 CCLR22 [--out x.json]

import { writeFileSync } from 'node:fs'
import { oeffnen, playbook } from './shop-lib.mjs'

const args = process.argv.slice(2)
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : s }
const slug = wert('lieferant', null)
const out = wert('out', null)
if (!slug) { console.error('--lieferant <slug> angeben'); process.exit(1) }
const nummern = args.filter((a, i) => !a.startsWith('--') && !['--lieferant', '--out'].includes(args[i - 1]))
if (!nummern.length) { console.error('Nummer(n) angeben'); process.exit(1) }

const { browser, page, angemeldet } = await oeffnen(slug)
if (!angemeldet) { console.error(`${slug}: nicht angemeldet`); await browser.close(); process.exit(2) }
const pb = playbook(slug)

const ergebnis = []
try {
  for (const nr of nummern) {
    if (typeof pb.suchen !== 'function') { console.error(`${slug}: Playbook kann nicht suchen`); break }
    await pb.suchen(page, nr)

    // Erst der Weg des Playbooks, wenn es einen hat — der kennt die Struktur
    // seiner Trefferliste. Sonst der Textweg, der bei jedem Shop funktioniert,
    // weil er nur auf die gesuchte Nummer im Seitentext schaut.
    let treffer = []
    if (typeof pb.trefferAusListe === 'function') {
      treffer = await pb.trefferAusListe(page).catch(() => [])
    }
    if (!treffer.length) {
      treffer = await page.evaluate((gesucht) => {
        const zeilen = document.body.innerText.split('\n').map((z) => z.trim()).filter(Boolean)
        const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
        const ziel = norm(gesucht)
        const i = zeilen.findIndex((z) => norm(z) === ziel)
        if (i === -1) return []
        const danach = zeilen.slice(i + 1, i + 12)
        const davor = zeilen.slice(Math.max(0, i - 8), i).reverse()
        const istPreis = (z) => /^[\d.]+,\d{2}\s*€?$/.test(z)
        const zahl = (t) => (t ? Number(t.replace(/[^\d,]/g, '').replace(',', '.')) : null)
        const preise = danach.filter(istPreis).concat(davor.filter(istPreis))
        return [{
          artikelnummer: gesucht,
          titel: danach.find((z) => z.length > 8 && !istPreis(z) && !/^\+/.test(z)) || null,
          netto_preis: zahl(preise[0] ?? null),
          listenpreis: zahl(preise[1] ?? null),
          einheit: danach.find((z) => /^(STK|MTR|PAK|ROL|KG|LTR|SET|m|Stk|Stück)$/i.test(z)) || null,
          umfeld: [...davor.slice(0, 3).reverse(), `>>> ${gesucht}`, ...danach.slice(0, 6)].join(' | ').slice(0, 300),
        }]
      }, nr)
    }

    // Die Trefferliste eines Playbooks liefert die ganze Seite — auf die
    // gesuchte Nummer eingrenzen, sonst steht der erste beliebige Artikel da.
    const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const genau = treffer.filter((t) => norm(t.artikelnummer) === norm(nr))
    const nimm = genau.length ? genau : treffer.slice(0, 3)

    ergebnis.push({ gesucht: nr, genau: genau.length > 0, treffer: nimm })
    if (!nimm.length) {
      console.log(`${nr.padEnd(14)} NICHT GEFUNDEN`)
    } else {
      for (const t of nimm) {
        console.log(`${nr.padEnd(14)} ${genau.length ? '=' : '~'} ${String(t.netto_preis ?? '?').padStart(9)} ${(t.einheit ?? '?').padEnd(5)} ${t.titel ?? ''}`)
      }
    }
  }
} finally {
  await browser.close()
}

if (out) { writeFileSync(out, JSON.stringify(ergebnis, null, 1)); console.error('Geschrieben:', out) }
