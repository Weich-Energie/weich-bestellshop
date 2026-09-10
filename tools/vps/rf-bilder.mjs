// Holt die Produktbild-Adressen von rf24.de fuer eine Liste von Artikelnummern.
// Laeuft auf dem VPS, weil dort die angemeldete R+F-Sitzung liegt (rf24 zeigt
// Produktseiten nur eingeloggt; ohne Login landet man auf /login).
//
// Aufruf auf dem VPS:
//   cd /opt/weich-browser
//   node rf-bilder.mjs --datei /tmp/artikelnummern.json --ziel /tmp/rf-bilder.json [--start 0] [--limit 50]
//
// Die Eingabedatei ist ein JSON-Array von Artikelnummern (13-stellig).
// Ausgabe je Artikel: { artikelnr, bild_url, titel, fehler? }
//
// Sitzung vorher pruefen und notfalls erneuern:
//   node produkt.mjs --lieferant r-f --login-test --neu-anmelden
import fs from 'node:fs'
import { oeffnen, seiteOeffnen } from './shop-lib.mjs'

const args = process.argv.slice(2)
const wert = (name, standard = null) => {
  const i = args.indexOf(name)
  return i === -1 ? standard : args[i + 1]
}

const datei = wert('--datei')
const ziel = wert('--ziel', '/tmp/rf-bilder.json')
const start = Number(wert('--start', '0'))
const limit = Number(wert('--limit', '0'))
if (!datei) {
  console.error('Aufruf: node rf-bilder.mjs --datei <nummern.json> --ziel <ausgabe.json> [--start N] [--limit N]')
  process.exit(1)
}

let nummern = JSON.parse(fs.readFileSync(datei, 'utf8'))
if (start) nummern = nummern.slice(start)
if (limit) nummern = nummern.slice(0, limit)
console.log(`${nummern.length} Artikel, Ziel ${ziel}`)

// Ergebnis nach jedem Artikel schreiben: ein Abbruch kostet dann nur den
// laufenden Artikel, nicht den ganzen Lauf (Lehre aus der R+F-Zuordnung).
const ergebnis = []
const sichern = () => fs.writeFileSync(ziel, JSON.stringify(ergebnis, null, 1))

const sitzung = await oeffnen('r-f')
const { page, browser, pb, angemeldet } = sitzung
console.log(`Sitzung: ${sitzung.sitzung}, angemeldet: ${angemeldet}`)
if (!angemeldet) {
  console.error('Nicht angemeldet. Erst: node produkt.mjs --lieferant r-f --login-test --neu-anmelden')
  await browser.close()
  process.exit(2)
}
try {
  for (const [i, nr] of nummern.entries()) {
    try {
      await seiteOeffnen(page, `https://rf24.de/produkt/${nr}`, pb)
      // Das Produktbild kommt per Skript nach; kurz warten.
      await page.waitForTimeout(900)
      const treffer = await page.evaluate(() => {
        const kandidaten = [...document.querySelectorAll('img')]
          .map((b) => ({
            src: b.currentSrc || b.src || '',
            alt: (b.alt || '').slice(0, 80),
            breite: b.naturalWidth,
          }))
          .filter((b) => b.breite >= 100 && /medias/.test(b.src)
            && !/logo|icon|flag|hintergrund|background/i.test(b.src + b.alt))
        // Das groesste Bild ist in der Regel das Produktbild.
        kandidaten.sort((a, b) => b.breite - a.breite)
        return {
          bild: kandidaten[0] ?? null,
          titel: (document.querySelector('h1')?.textContent || document.title || '').trim().slice(0, 120),
          angemeldet: !/\/login/.test(location.pathname),
        }
      })
      if (!treffer.angemeldet) throw new Error('Sitzung abgelaufen — nicht angemeldet')
      ergebnis.push({
        artikelnr: nr,
        bild_url: treffer.bild?.src ?? null,
        breite: treffer.bild?.breite ?? null,
        titel: treffer.titel,
      })
      console.log(`${i + 1}/${nummern.length} ${nr} ${treffer.bild ? 'Bild' : 'kein Bild'}`)
    } catch (fehler) {
      ergebnis.push({ artikelnr: nr, bild_url: null, fehler: String(fehler.message ?? fehler) })
      console.log(`${i + 1}/${nummern.length} ${nr} FEHLER ${fehler.message ?? fehler}`)
      // Bei abgelaufener Sitzung bringt Weitermachen nichts.
      if (/nicht angemeldet|Sitzung/.test(String(fehler.message))) {
        console.error('Sitzung ist tot — Lauf abgebrochen. Erst neu anmelden.')
        break
      }
    }
    sichern()
  }
} finally {
  sichern()
  await browser.close()
}

const mitBild = ergebnis.filter((e) => e.bild_url).length
console.log(`\nFertig: ${mitBild} von ${ergebnis.length} mit Bild -> ${ziel}`)
