// rf-artikel-holen.mjs — Stammdaten zu R+F-Artikelnummern holen: Name, Preis,
// Einheit, Bild. Rein lesend.
//
// Gedacht fuer Artikel, die ueber die Nummernaufloesung neu dazugekommen sind
// und im Katalog noch fehlen. Das Bild wird nach der Regel aus
// rf-bilder-pruefen-alle.mjs gewaehlt: nicht das groesste Bild der Seite,
// sondern das, dessen alt-Steckbrief zum Artikelnamen passt — auf einer
// rf24-Seite liegen auch die Bilder der Nachbar-Ausfuehrungen.
//
// Aufruf: node rf-artikel-holen.mjs <nummern.json> [--out /tmp/rf-artikel.json]

import { oeffnen, seiteOeffnen } from './shop-lib.mjs'
import fs from 'node:fs'

const args = process.argv.slice(2)
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : s }
const out = wert('out', '/tmp/rf-artikel.json')
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a)

const nummern = JSON.parse(fs.readFileSync(args[0], 'utf8').replace(/^﻿/, ''))
  .map((x) => (typeof x === 'string' ? x : x.artikelnr ?? x.rf_nr))

const sitzung = await oeffnen('r-f')
const { page, browser, pb, angemeldet } = sitzung
if (!angemeldet) {
  console.error('nicht angemeldet — erst: node produkt.mjs --lieferant r-f --login-test --neu-anmelden')
  await browser.close(); process.exit(2)
}

const glatt = (s) => (s || '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()
const norm = (s) => glatt(s).toLowerCase()

const ergebnis = []
const sichern = () => fs.writeFileSync(out, JSON.stringify({
  stand: new Date().toISOString(), anzahl: ergebnis.length, artikel: ergebnis,
}, null, 2))

try {
  for (const [i, nr] of nummern.entries()) {
    await seiteOeffnen(page, `https://rf24.de/produkt/${nr}`, pb)
    await page.waitForTimeout(900)
    const d = await page.evaluate(() => {
      const t = (document.querySelector('h1')?.textContent || document.title || '')
        .replace(/\s*\|\s*Alle Kategorien\s*$/, '')
      const preisText = [...document.querySelectorAll('[class*="price" i]')]
        .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
        .find((x) => /je:\s*[\d.,]+\s*€|^[\d.,]+\s*€/.test(x)) || ''
      return {
        url: location.href,
        titel: t.replace(/\s+/g, ' ').trim(),
        preisText,
        text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200),
        bilder: [...document.images]
          .filter((x) => /\/medias\//.test(x.src) && !/\.svg($|\?)/.test(x.src))
          .map((x) => ({ src: x.src, alt: x.alt || '' })),
      }
    })
    if (/\/login/.test(d.url)) throw new Error(`Sitzung abgelaufen bei ${nr}`)

    // "je: 12,34 €" ist der Stueckpreis, sonst der erste Euro-Betrag.
    const mJe = d.preisText.match(/je:\s*([\d.]+,\d{2})\s*€/)
    const mErst = d.preisText.match(/([\d.]+,\d{2})\s*€/)
    const roh = (mJe ?? mErst)?.[1] ?? null
    const preis = roh ? Number(roh.replace(/\./g, '').replace(',', '.')) : null

    const mEinheit = d.text.match(/\b(VPE|Verpackungseinheit)\b[^\d]{0,10}(\d+)\s*(M|ST|Stück)?/i)
    const bild = d.bilder.find((b) => norm(b.alt) === norm(d.titel))
      ?? d.bilder.find((b) => norm(b.alt).startsWith(norm(d.titel).slice(0, 30)))
      ?? null

    ergebnis.push({
      artikelnr: nr,
      name: d.titel,
      preis_netto: preis,
      vpe: mEinheit ? mEinheit[2] : null,
      bild_url: bild?.src ?? null,
      bild_alt: glatt(bild?.alt).slice(0, 120) || null,
    })
    if (!preis) log(`  kein Preis: ${nr} ${d.titel.slice(0, 40)}`)
    if ((i + 1) % 10 === 0) { log(`${i + 1}/${nummern.length}`); sichern() }
    sichern()
  }
} finally {
  sichern()
  await browser.close()
}

const mitPreis = ergebnis.filter((x) => x.preis_netto != null).length
const mitBild = ergebnis.filter((x) => x.bild_url).length
log(`fertig: ${ergebnis.length} Artikel, ${mitPreis} mit Preis, ${mitBild} mit Bild`)
