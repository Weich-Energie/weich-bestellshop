// rf-bild-pruefen.mjs — für einzelne Artikel ALLE Bildkandidaten der
// rf24-Produktseite auflisten, mit Titel und Größe. Rein lesend.
//
// Zweck: rf-bilder.mjs nimmt „das größte /medias/-Bild ab 100 px". Wenn eine
// Seite mehrere Bilder trägt (Zubehör, Varianten, Serienbild), kann die Regel
// danebengreifen. Hier sieht man, was zur Auswahl stand und was der Titel der
// Seite sagt — damit lässt sich ein Verdacht prüfen, statt zu raten.
//
// Aufruf: node rf-bild-pruefen.mjs <artikelnr> [<artikelnr> ...]

import { oeffnen, seiteOeffnen } from './shop-lib.mjs'

const nummern = process.argv.slice(2)
if (!nummern.length) { console.error('Artikelnummer(n) angeben'); process.exit(1) }

const sitzung = await oeffnen('r-f')
const { page, browser, pb, angemeldet } = sitzung
if (!angemeldet) {
  console.error('nicht angemeldet — erst: node produkt.mjs --lieferant r-f --login-test --neu-anmelden')
  await browser.close()
  process.exit(2)
}

try {
  for (const nr of nummern) {
    await seiteOeffnen(page, `https://rf24.de/produkt/${nr}`, pb)
    await page.waitForTimeout(1200)
    const daten = await page.evaluate(() => {
      const bilder = [...document.images]
        .filter((i) => /\/medias\//.test(i.src))
        .map((i) => ({
          src: i.src,
          breite: i.naturalWidth, hoehe: i.naturalHeight,
          alt: (i.alt || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          klasse: (i.className || '').toString().slice(0, 40),
          imGalerie: !!i.closest('[class*="gallery" i], [class*="slider" i], [class*="carousel" i]'),
        }))
      const h1 = document.querySelector('h1')
      return {
        titel: (h1?.textContent || document.title).replace(/\s+/g, ' ').trim().slice(0, 110),
        url: location.href,
        bilder,
      }
    })

    console.log(`\n=== ${nr}`)
    console.log(`Seite:  ${daten.url}`)
    console.log(`Titel:  ${daten.titel}`)
    // rf24 leitet abgelaufene Sitzungen still auf /login um. Ohne diese
    // Pruefung meldet das Skript das Login-Hintergrundbild als Produktbild.
    if (/\/login/.test(daten.url)) {
      throw new Error('Sitzung abgelaufen — erst: node produkt.mjs --lieferant r-f --login-test --neu-anmelden')
    }
    if (!daten.bilder.length) { console.log('  keine /medias/-Bilder gefunden'); continue }
    const groesstes = [...daten.bilder].sort((a, b) => b.breite - a.breite)[0]
    for (const b of daten.bilder) {
      const marke = b.src === groesstes.src ? '->' : '  '
      console.log(`${marke} ${String(b.breite).padStart(4)}x${String(b.hoehe).padEnd(4)} galerie=${b.imGalerie ? 'ja' : 'nein'}  alt="${b.alt}"`)
      console.log(`     ${b.src.split('?')[0]}`)
    }
    console.log(`  (-> ist das Bild, das rf-bilder.mjs genommen hätte)`)
  }
} finally {
  await browser.close()
}
