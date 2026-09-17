// linum-kategorie-sortiment.mjs — welche Artikel eine Linum-Kategorieseite heute
// noch fuehrt. Die Produkt-URLs abgekuendigter Artikel leiten auf die Kategorie
// um; so faellt auf, wenn ein Artikel aus dem Sortiment ist.
//
// Aufruf: node linum-kategorie-sortiment.mjs [--out datei.json]

import { writeFileSync } from 'node:fs'
import { oeffnen, seiteOeffnen } from './shop-lib.mjs'

const BASIS = 'https://www.linum.eu/de/hvac/kuehlleitungen-zubehoer/kupferleitungen-doppelleitung-inoac'
const KATEGORIEN = ['1-4-3-8-isoliert', '1-4-1-2-isoliert', '1-4-5-8-isoliert', '3-8-5-8-isoliert']

const args = process.argv.slice(2)
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null

const { browser, page, angemeldet, pb } = await oeffnen('linum')
if (!angemeldet) { console.error('Linum: nicht angemeldet'); await browser.close(); process.exit(2) }

const ergebnis = { stand: new Date().toISOString(), kategorien: [] }
try {
  for (const k of KATEGORIEN) {
    await seiteOeffnen(page, `${BASIS}/${k}`, pb)
    await page.waitForTimeout(2500)
    const d = await page.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
      const zahl = (t) => (t ? Number(t.replace(/\./g, '').replace(',', '.')) : null)
      const artikel = []
      for (const e of document.querySelectorAll('[class*="product-list-item"], .product-list-item')) {
        const t = norm(e.textContent)
        const nr = (t.match(/\b(CIN|ALX|ELK)-\d{4}-\d{3}\b/) || [])[0]
        if (!nr || artikel.some((a) => a.artikelnr === nr)) continue
        const netto = e.querySelector('[class*="price--net"]')
        const laenge = (t.match(/(\d{1,3})\s*mtr\s*\/?\s*rol/i) || [])[1]
        artikel.push({
          artikelnr: nr,
          netto_preis: zahl((norm(netto?.textContent).match(/€\s*([\d.]+,\d{2})/) || [])[1]),
          gebinde_meter: laenge ? Number(laenge) : null,
          text: t.slice(0, 180),
        })
      }
      const ueberschrift = norm(document.querySelector('h1')?.textContent)
      const anzahl = (document.body.innerText.match(/\((\d+)\s*Produkte?\)/) || [])[1]
      return { ueberschrift, anzahl_laut_seite: anzahl ? Number(anzahl) : null, artikel }
    })
    ergebnis.kategorien.push({ kategorie: k, ...d })
    console.error(`${k}: ${d.artikel.length} Artikel (${d.artikel.map((a) => a.artikelnr).join(', ')})`)
  }
} finally {
  await browser.close()
}
const json = JSON.stringify(ergebnis, null, 1)
if (out) { writeFileSync(out, json); console.error('Geschrieben:', out) } else console.log(json)
