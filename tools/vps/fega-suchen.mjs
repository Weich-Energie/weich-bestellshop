// fega-suchen.mjs — Freitextsuche bei FEGA, gibt die Trefferliste aus.
// Rein lesend, nichts wird in den Warenkorb gelegt.
//
// Ergaenzt fega-nummern.mjs: das sucht eine bekannte Nummer, dieses hier
// findet den Artikel, wenn nur die Bezeichnung feststeht — etwa wenn die
// Nummer auf dem Montagebericht zu einem anderen Artikel gehoert.
//
// Aufruf: node fega-suchen.mjs "<Suchbegriff>" [--max 15]

import { oeffnen, playbook } from './shop-lib.mjs'

const args = process.argv.slice(2)
const max = args.includes('--max') ? Number(args[args.indexOf('--max') + 1]) : 15
const begriff = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--max')
if (!begriff) { console.error('Suchbegriff angeben'); process.exit(1) }

const { browser, page, angemeldet } = await oeffnen('fega-schmitt')
if (!angemeldet) { console.error('nicht angemeldet'); await browser.close(); process.exit(2) }
const pb = playbook('fega-schmitt')

try {
  await pb.suchen(page, begriff)

  // Die Trefferzeilen folgen alle demselben Muster: sechsstellige Nummer,
  // darunter Bezeichnung, darunter die beiden Preise (netto, dann brutto).
  const treffer = await page.evaluate((grenze) => {
    const zeilen = document.body.innerText.split('\n').map((z) => z.trim()).filter(Boolean)
    const istNummer = (z) => /^\d{6}$/.test(z)
    const istPreis = (z) => /^[\d.]+,\d{2}\s*€?$/.test(z)
    const zahl = (t) => (t ? Number(t.replace(/[^\d,]/g, '').replace(',', '.')) : null)
    const out = []
    for (let i = 0; i < zeilen.length && out.length < grenze; i++) {
      if (!istNummer(zeilen[i])) continue
      const danach = zeilen.slice(i + 1, i + 10)
      const preise = danach.filter(istPreis)
      out.push({
        artikelnr: zeilen[i],
        bezeichnung: danach.find((z) => z.length > 10 && !istPreis(z) && !/^\+/.test(z)) || null,
        netto: zahl(preise[0] ?? null),
        liste: zahl(preise[1] ?? null),
        einheit: danach.find((z) => /^(STK|MTR|PAK|ROL|KG|LTR|SET)$/i.test(z)) || null,
      })
    }
    return out
  }, max)

  console.log(`Suche "${begriff}" — ${treffer.length} Treffer:`)
  for (const t of treffer) {
    console.log(`${t.artikelnr}  netto ${String(t.netto ?? '?').padStart(8)}  ${t.einheit ?? '?'}  ${t.bezeichnung ?? ''}`)
  }
} finally {
  await browser.close()
}
