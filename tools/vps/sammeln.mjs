// sammeln.mjs — eine ganze Trefferliste (Suche oder Warengruppe) eines
// Lieferanten-Shops abrufen: alle Produkt-URLs ueber alle Seiten einsammeln,
// dann jede Produktseite hinter dem Login auslesen.
//
// Aufruf:
//   node sammeln.mjs --lieferant frigotechnik --suche "Kabelkanal" --out /tmp/kabelkanal.json
//   node sammeln.mjs --lieferant frigotechnik --liste https://www.frigotechnik.de/Installationsmaterial/Konsolen-Profile/ --out /tmp/konsolen.json
//   Optionen: --max 200 (hoechstens so viele Produkte)  --ohne-login  --neu-anmelden  --nur-urls
//
// Ausgabe: JSON-Array in --out (oder stdout), eine Zeile Fortschritt je Seite
// und je 10 Produkten auf stderr. Eine Sitzung fuer alles, damit der Shop nicht
// bei jedem Artikel einen Login sieht.

import fs from 'node:fs'
import { oeffnen, produktDaten, produktUrlsSammeln } from './shop-lib.mjs'

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const wert = (n, standard) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : standard }

const slug = wert('lieferant', '')
const suche = wert('suche', null)
const liste = wert('liste', null)
const out = wert('out', null)
const max = Number(wert('max', '200'))
if (!slug) { console.error('--lieferant <slug> fehlt.'); process.exit(1) }
if (!suche && !liste) { console.error('--suche "<Begriff>" oder --liste <url> fehlt.'); process.exit(1) }

let sitzung
try {
  sitzung = await oeffnen(slug, { ohneLogin: flag('ohne-login'), neuAnmelden: flag('neu-anmelden') })
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
const { browser, page, pb, angemeldet } = sitzung
const start = Date.now()

try {
  const listeUrl = liste ?? pb.sucheUrl(suche)
  console.error(`Liste: ${listeUrl} (${angemeldet ? 'angemeldet, Sitzung ' + sitzung.sitzung : 'ohne Login'})`)
  const urls = await produktUrlsSammeln(page, pb, listeUrl, {
    fortschritt: (f) => console.error(`  Seite ${f.seite}: ${f.neu} neue Produkte, gesamt ${f.gesamt}`),
  })
  const auswahl = urls.slice(0, max)
  console.error(`${urls.length} Produkt-URLs gefunden, ${auswahl.length} werden abgerufen.`)

  const ergebnisse = []
  if (flag('nur-urls')) {
    for (const u of auswahl) ergebnisse.push({ url: u })
  } else {
    for (let i = 0; i < auswahl.length; i++) {
      const u = auswahl[i]
      try {
        const d = await produktDaten(page, u)
        delete d.text // im Sammellauf zu gross; produkt.mjs liefert ihn einzeln
        ergebnisse.push(d)
      } catch (e) {
        ergebnisse.push({ url: u, fehler: e.message })
      }
      if ((i + 1) % 10 === 0 || i === auswahl.length - 1) {
        console.error(`  ${i + 1}/${auswahl.length} abgerufen (${Math.round((Date.now() - start) / 1000)} s)`)
      }
    }
  }

  const ausgabe = JSON.stringify({
    lieferant: slug, liste: listeUrl, angemeldet, sitzung: sitzung.sitzung,
    stand: new Date().toISOString().slice(0, 10), anzahl: ergebnisse.length, produkte: ergebnisse,
  }, null, 1)
  if (out) { fs.writeFileSync(out, ausgabe); console.error(`Geschrieben: ${out}`) } else console.log(ausgabe)
} catch (e) {
  console.error('Fehler:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
