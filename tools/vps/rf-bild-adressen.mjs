// rf-bild-adressen.mjs — vollstaendige Bildadressen einer rf24-Produktseite,
// mit alt-Text und natuerlicher Groesse. Rein lesend.
//
// Warum eigenes Skript: rf-bild-pruefen.mjs kuerzt die Adresse auf den Pfad.
// Ohne den Parameter ?context=… antwortet prd-cc.rf24.de mit 400 — eine so
// gespeicherte bild_url bliebe im Shop leer.
//
// Aufruf: node rf-bild-adressen.mjs <artikelnr> [<artikelnr> ...] [--out datei.json]

import { writeFileSync } from 'node:fs'
import { oeffnen, seiteOeffnen } from './shop-lib.mjs'

const args = process.argv.slice(2)
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null
const nummern = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')
if (!nummern.length) { console.error('Artikelnummer(n) angeben'); process.exit(1) }

const { browser, page, pb, angemeldet } = await oeffnen('r-f')
if (!angemeldet) { console.error('nicht angemeldet'); await browser.close(); process.exit(2) }

const ergebnis = []
try {
  for (const nr of nummern) {
    await seiteOeffnen(page, `https://rf24.de/produkt/${nr}`, pb)
    await page.waitForTimeout(2000)
    if (/\/login/.test(page.url())) { console.error(`${nr}: Sitzung abgelaufen`); break }
    const d = await page.evaluate(() => ({
      titel: document.title,
      bilder: Array.from(document.querySelectorAll('img'))
        .map((i) => ({
          src: i.currentSrc || i.src,
          alt: (i.alt || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          natuerlich: `${i.naturalWidth}x${i.naturalHeight}`,
          angezeigt: `${i.width}x${i.height}`,
        }))
        .filter((b) => b.src && !b.src.startsWith('data:')),
    }))
    ergebnis.push({ artikelnr: nr, ...d })
    console.error(`=== ${nr}  ${d.titel.split(' | ')[0]}`)
    for (const b of d.bilder) {
      console.error(`   ${b.natuerlich.padStart(9)} nat / ${b.angezeigt.padStart(8)} anz  alt="${b.alt}"`)
      console.error(`     ${b.src}`)
    }
  }
} finally {
  await browser.close()
}
if (out) { writeFileSync(out, JSON.stringify(ergebnis, null, 1)); console.error('Geschrieben:', out) }
