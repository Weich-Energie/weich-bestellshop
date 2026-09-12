// rf-bilder-pruefen-alle.mjs — prüft für jeden Artikel mit hinterlegtem Bild,
// ob es das Bild ist, das rf24 für genau diese Artikelnummer ausweist.
// Rein lesend.
//
// Hintergrund: rf-bilder.mjs nahm „das größte /medias/-Bild ab 100 px, kein
// Logo/Icon/Hintergrund". Auf einer Produktseite stehen aber auch Zubehör- und
// Serienbilder. Verlässlich ist das `alt`-Attribut: rf24 schreibt dort den
// vollen Artikelnamen hinein. Ein Bild gilt hier als bestätigt, wenn sein alt
// mit dem Artikelnamen übereinstimmt.
//
// Aufruf: node rf-bilder-pruefen-alle.mjs <artikel.json> [--out /tmp/bild-pruefung.json]
//   artikel.json: [{ "artikelnr": "...", "name": "...", "bild_url": "..." }, ...]

import { oeffnen, seiteOeffnen } from './shop-lib.mjs'
import fs from 'node:fs'

const args = process.argv.slice(2)
const quelle = args[0]
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : s }
const out = wert('out', '/tmp/bild-pruefung.json')
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a)

const artikel = JSON.parse(fs.readFileSync(quelle, 'utf8').replace(/^﻿/, ''))
  .filter((a) => a.bild_url)
const pfad = (u) => (u || '').split('?')[0]
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()

const sitzung = await oeffnen('r-f')
const { page, browser, pb, angemeldet } = sitzung
if (!angemeldet) {
  console.error('nicht angemeldet — erst: node produkt.mjs --lieferant r-f --login-test --neu-anmelden')
  await browser.close(); process.exit(2)
}

const ergebnis = []
const sichern = () => fs.writeFileSync(out, JSON.stringify({
  stand: new Date().toISOString(), geprueft: ergebnis.length, artikel: ergebnis,
}, null, 2))

try {
  for (const [i, a] of artikel.entries()) {
    await seiteOeffnen(page, `https://rf24.de/produkt/${a.artikelnr}`, pb)
    await page.waitForTimeout(700)
    const d = await page.evaluate(() => ({
      url: location.href,
      titel: (document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim(),
      bilder: [...document.images].filter((x) => /\/medias\//.test(x.src))
        .map((x) => ({ src: x.src, alt: (x.alt || '').replace(/\s+/g, ' ').trim(), b: x.naturalWidth })),
    }))
    // Abgelaufene Sitzung leitet still auf /login um — sonst würde hier das
    // Login-Hintergrundbild als Produktbild gemeldet.
    if (/\/login/.test(d.url)) throw new Error(`Sitzung abgelaufen bei ${a.artikelnr}`)

    // Nicht auf Gleichheit mit dem Artikelnamen aus unserem Stamm pruefen —
    // der weicht in Kleinigkeiten ab („Modell 2400" fehlt bei uns). Maßstab
    // ist der Seitentitel: das hinterlegte Bild muss auf DIESER Seite liegen
    // und ein alt tragen, das zum Titel passt.
    const gespeichert = pfad(a.bild_url)
    const treffer = d.bilder.find((x) => pfad(x.src) === gespeichert)
    const passtZumTitel = (alt) => {
      const x = norm(alt), t = norm(d.titel)
      if (!x || !t) return false
      return x === t || t.startsWith(x) || x.startsWith(t)
    }
    const status = !treffer
      ? 'nicht_auf_seite'
      : passtZumTitel(treffer.alt) ? 'bestaetigt' : 'alt_passt_nicht'

    // Bei Verdacht: welches Bild der Seite trägt den Titel als alt?
    const besser = status === 'bestaetigt' ? [] : d.bilder
      .filter((x) => passtZumTitel(x.alt))
      .map((x) => ({ src: pfad(x.src), breite: x.b }))

    ergebnis.push({
      artikelnr: a.artikelnr, name: a.name, status,
      titel: d.titel,
      gespeichert,
      gespeichertes_alt: treffer?.alt ?? null,
      vorschlag: besser,
    })
    if (status !== 'bestaetigt') log(`  ${status}: ${a.artikelnr} ${a.name.slice(0, 50)}`)
    if ((i + 1) % 20 === 0) { log(`${i + 1}/${artikel.length}`); sichern() }
    sichern()
  }
} finally {
  sichern()
  await browser.close()
}

const zaehl = ergebnis.reduce((m, e) => ({ ...m, [e.status]: (m[e.status] || 0) + 1 }), {})
log('fertig:', JSON.stringify(zaehl))
