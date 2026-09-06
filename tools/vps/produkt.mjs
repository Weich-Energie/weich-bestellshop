// produkt.mjs — eine Produktseite eines Lieferanten-Shops hinter dem Login abrufen.
//
// Aufruf:
//   node produkt.mjs --lieferant frigotechnik --login-test
//   node produkt.mjs --lieferant frigotechnik [--shot /tmp/x.png] <produkt-url>
//   node produkt.mjs --lieferant frigotechnik --ohne-login <produkt-url>     (nur oeffentliche Daten)
//   Optionen: --neu-anmelden   --breite 1280
//
// Ausgabe: eine JSON-Zeile auf stdout. Fehler nach stderr, Exit-Code 1.
// Gemeinsamer Unterbau (Playbooks, Login, Sitzung, Auslesen): shop-lib.mjs.
// Fuer ganze Trefferlisten: sammeln.mjs.

import { oeffnen, produktDaten } from './shop-lib.mjs'

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const wert = (n, standard) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : standard }
const mitWert = new Set(['--lieferant', '--shot', '--breite'])
const url = args.find((a, i) => !a.startsWith('--') && !(i > 0 && mitWert.has(args[i - 1])))
const slug = wert('lieferant', '')
const loginTest = flag('login-test')
const shotPfad = wert('shot', null)

if (!slug) { console.error('--lieferant <slug> fehlt.'); process.exit(1) }
if (!url && !loginTest) { console.error('Produkt-URL fehlt (oder --login-test).'); process.exit(1) }

let sitzung
try {
  sitzung = await oeffnen(slug, { ohneLogin: flag('ohne-login'), neuAnmelden: flag('neu-anmelden'), breite: Number(wert('breite', '1280')) })
} catch (e) {
  console.error(e.message)
  console.log(JSON.stringify({ lieferant: slug, angemeldet: false, fehler: e.message }))
  process.exit(1)
}

const { browser, page, angemeldet } = sitzung
const ergebnis = { lieferant: slug, angemeldet, sitzung: sitzung.sitzung }
try {
  if (loginTest) {
    console.log(JSON.stringify(ergebnis))
  } else {
    const fehler = []
    page.on('pageerror', (e) => fehler.push(String(e.message).slice(0, 200)))
    Object.assign(ergebnis, await produktDaten(page, url, sitzung.pb), { seitenfehler: fehler.slice(0, 5) })
    if (shotPfad) {
      await page.screenshot({ path: shotPfad, fullPage: true })
      ergebnis.screenshot = shotPfad
    }
    console.log(JSON.stringify(ergebnis))
  }
} catch (e) {
  console.error('Fehler:', e.message)
  console.log(JSON.stringify({ ...ergebnis, fehler: e.message }))
  process.exitCode = 1
} finally {
  await browser.close()
}
