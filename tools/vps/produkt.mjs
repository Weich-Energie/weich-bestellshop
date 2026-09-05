// produkt.mjs — Produktseite eines Lieferanten-Shops hinter dem Login abrufen.
//
// Gewerbe-Shops zeigen Netto-Preise erst nach Anmeldung. Dieses Skript meldet
// sich mit den in /opt/weich-browser/.env hinterlegten Zugangsdaten an, merkt
// sich die Sitzung (state/<slug>.json) und liefert zu einer Produkt-URL alles,
// was der Bestellshop fuer einen Artikel braucht: Titel, Artikelnummer,
// Preisangaben, Einheit, Text der Seite und einen Screenshot.
//
// Aufruf:
//   node produkt.mjs --lieferant frigotechnik --login-test
//   node produkt.mjs --lieferant frigotechnik https://www.frigotechnik.de/...-2032030.html
//   node produkt.mjs --lieferant frigotechnik --ohne-login <url>     (nur oeffentliche Daten)
//   Optionen: --shot /tmp/x.png   --breite 1280   --neu-anmelden
//
// Zugangsdaten setzt man mit lieferant-login-setzen.sh; sie heissen
// LIEFERANT_<SLUG>_BENUTZER / _PASSWORT und verlassen diesen Host nicht.
//
// Ausgabe: eine JSON-Zeile auf stdout. Fehler gehen nach stderr, Exit-Code 1.

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const hier = path.dirname(fileURLToPath(import.meta.url))
const envPfad = path.join(hier, '.env')
const stateDir = path.join(hier, 'state')

// .env von Hand lesen, keine Abhaengigkeit dafuer.
if (fs.existsSync(envPfad)) {
  for (const zeile of fs.readFileSync(envPfad, 'utf8').split('\n')) {
    const t = zeile.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0 && !(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1)
  }
}

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const wert = (n, standard) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : standard }
const url = args.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--lieferant', '--shot', '--breite'].includes(args[i - 1])))
const slug = wert('lieferant', '')
const loginTest = flag('login-test')
const ohneLogin = flag('ohne-login')
const neuAnmelden = flag('neu-anmelden')
const shotPfad = wert('shot', null)
const breite = Number(wert('breite', '1280'))

if (!slug) { console.error('--lieferant <slug> fehlt.'); process.exit(1) }
if (!url && !loginTest) { console.error('Produkt-URL fehlt (oder --login-test).'); process.exit(1) }

// ─── Playbooks je Lieferant ────────────────────────────────────────────────
// Bewusst im Skript und nicht in der Datenbank: Selektoren aendern sich mit dem
// Shop, und wer sie anpasst, soll sie zusammen mit dem Ablauf sehen.
const PLAYBOOKS = {
  frigotechnik: {
    // OXID eShop mit B2B-Portal. Login ist ein Popup auf /mein-konto/,
    // Formular geht per Ajax an cl=tc_b2b_ajax_login&fnc=login.
    loginUrl: 'https://www.frigotechnik.de/mein-konto/',
    async login(page, benutzer, passwort) {
      await page.goto(this.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.locator('a[data-info="login"]').first().click()
      await page.locator('input[name="username"]').waitFor({ timeout: 15_000 })
      await page.fill('input[name="username"]', benutzer)
      await page.fill('input[name="password"]', passwort)
      await page.locator('form:has(input[name="password"]) button[type="submit"]').first().click()
      // Erfolg: die Seite laedt neu und der Kundenportal-Knopf verschwindet
      // bzw. ein Abmelden-Link erscheint.
      await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {})
      return this.istAngemeldet(page)
    },
    async istAngemeldet(page) {
      const abmelden = await page.locator('a:has-text("Abmelden"), a[href*="fnc=logout"], a:has-text("Logout")').count()
      const loginKnopf = await page.locator('a[data-info="login"]').count()
      return abmelden > 0 || loginKnopf === 0
    },
    // Seiten, auf denen sich der Anmeldezustand pruefen laesst.
    pruefUrl: 'https://www.frigotechnik.de/mein-konto/',
  },
}

const pb = PLAYBOOKS[slug]
if (!pb) { console.error(`Kein Playbook fuer "${slug}". Bekannt: ${Object.keys(PLAYBOOKS).join(', ')}`); process.exit(1) }

const prefix = `LIEFERANT_${slug.toUpperCase().replace(/-/g, '_')}`
const benutzer = process.env[`${prefix}_BENUTZER`]
const passwort = process.env[`${prefix}_PASSWORT`]
if (!ohneLogin && (!benutzer || !passwort)) {
  console.error(`Zugang fehlt: ${prefix}_BENUTZER/_PASSWORT nicht in ${envPfad}. ` +
    `Setzen mit: bash /opt/weich-browser/lieferant-login-setzen.sh ${slug}`)
  process.exit(1)
}

fs.mkdirSync(stateDir, { recursive: true })
const statePfad = path.join(stateDir, `${slug}.json`)
const ergebnis = { lieferant: slug, url: url ?? null, angemeldet: false, sitzung: 'keine' }

const browser = await chromium.launch({ headless: true })
try {
  const kontextOptionen = {
    viewport: { width: breite, height: 900 },
    locale: 'de-DE',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
  }
  if (!ohneLogin && !neuAnmelden && fs.existsSync(statePfad)) kontextOptionen.storageState = statePfad
  const kontext = await browser.newContext(kontextOptionen)
  const page = await kontext.newPage()
  const fehler = []
  page.on('pageerror', (e) => fehler.push(String(e.message).slice(0, 200)))

  if (!ohneLogin) {
    // Erst die gespeicherte Sitzung probieren, sonst frisch anmelden.
    if (kontextOptionen.storageState) {
      await page.goto(pb.pruefUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      ergebnis.angemeldet = await pb.istAngemeldet(page)
      ergebnis.sitzung = ergebnis.angemeldet ? 'wiederverwendet' : 'abgelaufen'
    }
    if (!ergebnis.angemeldet) {
      ergebnis.angemeldet = await pb.login(page, benutzer, passwort)
      ergebnis.sitzung = ergebnis.angemeldet ? 'neu' : 'fehlgeschlagen'
      if (ergebnis.angemeldet) await kontext.storageState({ path: statePfad })
    }
    if (!ergebnis.angemeldet) {
      if (shotPfad) await page.screenshot({ path: shotPfad, fullPage: false })
      console.error('Anmeldung fehlgeschlagen. ' + (shotPfad ? `Screenshot: ${shotPfad}` : 'Mit --shot Pfad einen Screenshot ziehen.'))
      console.log(JSON.stringify(ergebnis))
      process.exit(1)
    }
  }

  if (loginTest) {
    console.log(JSON.stringify(ergebnis))
    process.exit(0)
  }

  // ─── Produktseite ────────────────────────────────────────────────────────
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

  const daten = await page.evaluate(() => {
    const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
    const alleBlaetter = Array.from(document.querySelectorAll('body *')).filter((e) => e.children.length === 0 && e.textContent.trim())
    const treffer = (re, max = 10) => alleBlaetter.filter((e) => re.test(e.textContent)).map((e) => text(e.parentElement).slice(0, 160)).slice(0, max)
    const preisZeilen = alleBlaetter
      .filter((e) => /\d\s*€|€\s*\d|EUR/.test(e.textContent))
      .map((e) => ({ klasse: (e.className || e.parentElement?.className || '').toString().slice(0, 80), text: text(e.parentElement).slice(0, 160) }))
      .slice(0, 15)
    // Frigotechnik schreibt "Artikelnummer: 2032030OEM-Nummer: MS257" ohne
    // Trenner — deshalb Ziffern und Zeichen greifen, aber vor dem naechsten
    // Grossbuchstaben-Wort aufhoeren.
    const innen = document.body.innerText
    const greife = (re) => (innen.match(re) || [])[1]?.trim() ?? null
    const artikelnummer = greife(/Artikel-?(?:nummer|Nr\.?)\s*:?\s*(\d[\d.\-\/]{3,}|[A-Z0-9][A-Z0-9.\-\/]{3,}?)(?=\s|[A-Z][a-zä]|$)/i)
    const herstellernummer = greife(/(?:OEM|Hersteller)-?(?:Nummer|Nr\.?)\s*:?\s*([A-Z0-9][A-Z0-9 .\-\/]{2,}?)(?=\s+[A-Z][a-zä]|\s*$|\s{2,})/i)
    const matchcode = greife(/Matchcode\s*:?\s*([A-Z0-9][A-Z0-9.\-\/]{2,})/i)
    // "Ausgabe: 1 Stück" ist die Verkaufseinheit (Menge + Einheit).
    const ausgabe = innen.match(/Ausgabe\s*:?\s*(\d+(?:[,.]\d+)?)\s*([A-Za-zäöüÄÖÜ]+)/)
    const meta = (n) => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content ?? null
    const haupt = document.querySelector('main') || document.body
    return {
      titel: text(document.querySelector('h1')) || document.title.split(' | ')[0].split(' / ').pop(),
      seitentitel: document.title,
      artikelnummer,
      herstellernummer,
      matchcode,
      ausgabe_menge: ausgabe ? Number(ausgabe[1].replace(',', '.')) : null,
      ausgabe_einheit: ausgabe ? ausgabe[2] : null,
      preis_hinweis: /loggen Sie sich ein, um den Preis/i.test(innen) ? 'Preis nur nach Login' : null,
      hersteller: treffer(/Hersteller/i, 3),
      einheit: treffer(/Verpackungs(einheit|größe)|Mengeneinheit|Preiseinheit|je\s+(Stück|Meter|m\b)/i, 5),
      preise: preisZeilen,
      bild: meta('og:image'),
      beschreibung: meta('description'),
      text: haupt.innerText.replace(/\s+/g, ' ').slice(0, 4000),
    }
  })

  Object.assign(ergebnis, daten, { seitenfehler: fehler.slice(0, 5) })
  if (shotPfad) {
    await page.screenshot({ path: shotPfad, fullPage: true })
    ergebnis.screenshot = shotPfad
  }
  console.log(JSON.stringify(ergebnis))
} catch (e) {
  console.error('Fehler:', e.message)
  console.log(JSON.stringify({ ...ergebnis, fehler: e.message }))
  process.exit(1)
} finally {
  await browser.close()
}
