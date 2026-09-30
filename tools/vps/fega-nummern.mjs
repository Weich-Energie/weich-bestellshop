// fega-nummern.mjs — sucht FEGA-Artikelnummern und liest den ersten Treffer.
// Rein lesend, nichts wird in den Warenkorb gelegt.
//
// Fuer das Regieaufmass: die Elektro-Zeilen der Montageberichte tragen
// FEGA-Nummern, im Shop-Katalog fehlen sie. Dieses Skript holt Bezeichnung,
// Preis und Einheit, damit sie mit echtem Einkaufspreis angelegt werden koennen.
//
// Aufruf: node fega-nummern.mjs 104232 266350 ... [--out datei.json]

import { writeFileSync } from 'node:fs'
import { oeffnen, playbook } from './shop-lib.mjs'

const args = process.argv.slice(2)
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null
const nummern = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')
if (!nummern.length) { console.error('Nummer(n) angeben'); process.exit(1) }

const { browser, page, angemeldet } = await oeffnen('fega-schmitt')
if (!angemeldet) { console.error('nicht angemeldet'); await browser.close(); process.exit(2) }
const pb = playbook('fega-schmitt')

const ergebnis = []
try {
  for (const nr of nummern) {
    await pb.suchen(page, nr)

    // Die Trefferliste zeigt je Artikel Preis, Nummer, Bezeichnung und Einheit
    // als Textblock. Statt auf Klassennamen zu bauen, die sich mit jedem
    // Theme aendern, wird der Block um die gesuchte Nummer herum gelesen.
    const treffer = await page.evaluate((gesucht) => {
      const text = document.body.innerText
      const zeilen = text.split('\n').map((z) => z.trim()).filter(Boolean)
      const i = zeilen.findIndex((z) => z === gesucht)
      if (i === -1) return { gefunden: false, ausschnitt: zeilen.slice(0, 25).join(' | ').slice(0, 600) }
      // Wie weit Preis und Einheit von der Nummer entfernt stehen, haengt am
      // Seitenaufbau. Deshalb ein grosszuegiges Fenster und der NAECHSTE
      // Preis in beide Richtungen, statt einer festen Zeilenzahl.
      const davor = zeilen.slice(Math.max(0, i - 8), i).reverse()
      const danach = zeilen.slice(i + 1, i + 10)
      // FEGA stellt zwei Preise nebeneinander, die Spalte heisst "Netto /
      // Brutto". Das ist NICHT die Mehrwertsteuer: netto ist der eigene
      // Einkaufspreis, brutto der Bruttolistenpreis des Herstellers. Wer den
      // zweiten Wert nimmt, legt den Katalogpreis als Einkauf an.
      const istPreis = (z) => /^\s*[\d.]+,\d{2}\s*€?\s*$/.test(z)
      const preise = danach.filter(istPreis).concat(davor.filter(istPreis))
      const zahl = (t) => (t ? Number(t.replace(/[^\d,]/g, '').replace(',', '.')) : null)
      const preisText = preise[0] ?? null
      const preis = zahl(preisText)
      const listenpreis = zahl(preise[1] ?? null)
      const bezeichnung = danach.find((z) => z.length > 8 && !/^\+|^[A-Z]{2,4}$|€/.test(z)) || null
      const einheit = danach.find((z) => /^(STK|MTR|PAK|ROL|KG|LTR|SET)$/i.test(z)) || null
      return {
        gefunden: true, preis, listenpreis, preis_text: preisText, bezeichnung, einheit, url: location.href,
        // Der Rohausschnitt bleibt dabei: ohne ihn laesst sich ein falsch
        // zugeordneter Preis spaeter nicht mehr nachvollziehen.
        umfeld: [...davor.slice(0, 4).reverse(), `>>> ${gesucht}`, ...danach.slice(0, 6)].join(' | ').slice(0, 400),
      }
    }, nr)

    ergebnis.push({ artikelnr: nr, ...treffer })
    if (treffer.gefunden) {
      console.log(`${nr}  netto ${String(treffer.preis ?? '?').padStart(8)}  liste ${String(treffer.listenpreis ?? '?').padStart(8)}  ${treffer.bezeichnung ?? ''}`)
      if (treffer.preis == null) console.log(`        Umfeld: ${treffer.umfeld}`)
    } else {
      console.log(`${nr}  NICHT GEFUNDEN  ${treffer.ausschnitt ?? ''}`)
    }
  }
} finally {
  await browser.close()
}

if (out) { writeFileSync(out, JSON.stringify(ergebnis, null, 1)); console.error('Geschrieben:', out) }
