// rf-bilder-pruefen-alle.mjs — prüft für jeden Artikel mit hinterlegtem Bild,
// ob es das Bild ist, das rf24 für genau diese Ausführung zeigt, und schlägt
// sonst das passendere vor. Rein lesend.
//
// Hintergrund (Fund 12.09.2026): rf-bilder.mjs nahm „das größte /medias/-Bild
// ab 100 px". Auf einer rf24-Produktseite liegen aber auch die Bilder der
// Nachbar-Ausführungen. Ergebnis: bei „PROFIPRESS Bogen 90 Grad I/I 18 mm"
// hing das Bild einer Profipress-MUFFE, bei der 15-mm-Ausführung ein Bild mit
// „d: 22". Patrick ist das an einem Artikel aufgefallen.
//
// Verlässlich ist das alt-Attribut. rf24 schreibt dort einen Steckbrief hinein:
//   "Profipress-Bogen 90 Grad<br>…<br>d: 22<br>…<br>Modell 2416<br>Artikel 291518"
// Unser Artikelname trägt dieselben Merkmale: "… Bogen 90 Grad I/I aus Kupfer
// 15 mm Modell 2416". Verglichen werden deshalb Modellnummer, Durchmesser und
// Teileart — nicht die Bildgröße und nicht der Seitentitel (den gibt es auf
// diesen Seiten gar nicht, das hat den ersten Anlauf unbrauchbar gemacht).
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
const glatt = (s) => (s || '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()

// ─── Merkmale aus einem Text ziehen ───────────────────────────────────────
const modellNr = (s) => (glatt(s).match(/Modell\s*(\d{3,6})/i) || [])[1] ?? null
const durchmesser = (s) => {
  const t = glatt(s)
  const d = t.match(/\bd:\s*(\d{1,3})\b/i)            // rf24-Steckbrief
  if (d) return d[1]
  const mm = t.match(/\b(\d{1,3})\s*mm\b/i)           // unser Artikelname
  if (mm) return mm[1]
  const dn = t.match(/\bDN\s*(\d{1,3})\b/i)
  if (dn) return dn[1]
  return null
}
const ARTEN = ['bogen', 'muffe', 't-stück', 't-stueck', 'übergangsstück', 'uebergangsstueck',
  'winkel', 'reduzier', 'kupplung', 'nippel', 'stopfen', 'kappe', 'verschraubung',
  'ventil', 'kugelhahn', 'schelle', 'rohr']
const teileart = (s) => {
  const t = glatt(s).toLowerCase()
  return ARTEN.find((w) => t.includes(w)) ?? null
}
const winkelGrad = (s) => (glatt(s).match(/\b(45|87,5|87\.5|90)\s*Grad/i) || [])[1] ?? null

// Punkte: Modell wiegt am schwersten, dann Durchmesser, dann Art und Winkel.
function bewerten(alt, name) {
  let p = 0
  const mA = modellNr(alt), mN = modellNr(name)
  if (mA && mN) p += mA === mN ? 4 : -4
  const dA = durchmesser(alt), dN = durchmesser(name)
  if (dA && dN) p += dA === dN ? 3 : -3
  const tA = teileart(alt), tN = teileart(name)
  if (tA && tN) p += tA === tN ? 2 : -2
  const wA = winkelGrad(alt), wN = winkelGrad(name)
  if (wA && wN) p += wA === wN ? 1 : -1
  return p
}

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
      bilder: [...document.images].filter((x) => /\/medias\//.test(x.src) && !/\.svg($|\?)/.test(x.src))
        .map((x) => ({ src: x.src, alt: x.alt || '', b: x.naturalWidth })),
    }))
    if (/\/login/.test(d.url)) throw new Error(`Sitzung abgelaufen bei ${a.artikelnr}`)

    const gespeichert = pfad(a.bild_url)
    const bewertet = d.bilder.map((x) => ({ ...x, punkte: bewerten(x.alt, a.name) }))
    // Dubletten derselben Datei zusammenfassen, die beste Bewertung gewinnt.
    const jeDatei = new Map()
    for (const x of bewertet) {
      const k = pfad(x.src)
      if (!jeDatei.has(k) || jeDatei.get(k).punkte < x.punkte) jeDatei.set(k, x)
    }
    const kandidaten = [...jeDatei.values()].sort((x, y) => y.punkte - x.punkte || y.b - x.b)
    const bestes = kandidaten[0] ?? null
    const aktuell = jeDatei.get(gespeichert) ?? null

    let status
    if (!d.bilder.length) status = 'keine_bilder'
    else if (!aktuell) status = 'nicht_auf_seite'
    else if (bestes && pfad(bestes.src) === gespeichert) status = 'bestaetigt'
    else if (aktuell.punkte === bestes.punkte) status = 'gleichwertig'
    else status = 'besseres_vorhanden'

    ergebnis.push({
      artikelnr: a.artikelnr, name: a.name, status,
      punkte_aktuell: aktuell?.punkte ?? null,
      alt_aktuell: glatt(aktuell?.alt).slice(0, 120) || null,
      punkte_bestes: bestes?.punkte ?? null,
      alt_bestes: glatt(bestes?.alt).slice(0, 120) || null,
      gespeichert,
      vorschlag: status === 'besseres_vorhanden' ? bestes.src : null,
    })
    if (status !== 'bestaetigt') log(`  ${status}: ${a.artikelnr} ${a.name.slice(0, 46)}`)
    if ((i + 1) % 20 === 0) log(`${i + 1}/${artikel.length}`)
    sichern()
  }
} finally {
  sichern()
  await browser.close()
}

const zaehl = ergebnis.reduce((m, e) => ({ ...m, [e.status]: (m[e.status] || 0) + 1 }), {})
log('fertig:', JSON.stringify(zaehl))
