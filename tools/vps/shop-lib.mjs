// shop-lib.mjs — gemeinsamer Unterbau fuer produkt.mjs und sammeln.mjs.
//
// Enthaelt die Playbooks je Lieferant (Login, Anmeldezustand, Trefferlisten,
// Blaettern), das Lesen der Zugangsdaten aus .env, die Sitzungsverwaltung
// (state/<slug>.json) und das Auslesen einer Produktseite.
//
// Zugangsdaten heissen LIEFERANT_<SLUG>_BENUTZER / _PASSWORT und werden mit
// lieferant-login-setzen.sh gesetzt. Sie verlassen diesen Host nie.

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const hier = path.dirname(fileURLToPath(import.meta.url))
const envPfad = path.join(hier, '.env')
const stateDir = path.join(hier, 'state')

if (fs.existsSync(envPfad)) {
  for (const zeile of fs.readFileSync(envPfad, 'utf8').split('\n')) {
    const t = zeile.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0 && !(t.slice(0, i) in process.env)) process.env[t.slice(0, i)] = t.slice(i + 1)
  }
}

// ─── Playbooks ─────────────────────────────────────────────────────────────
// Bewusst im Code, nicht in der Datenbank: Selektoren aendern sich mit dem
// Shop, und wer sie anpasst, soll den Ablauf daneben sehen.
export const PLAYBOOKS = {
  frigotechnik: {
    name: 'Frigotechnik',
    basis: 'https://www.frigotechnik.de',
    // OXID eShop mit B2B-Portal. Login ist ein Popup auf /mein-konto/, das
    // Formular geht per Ajax an cl=tc_b2b_ajax_login&fnc=login.
    loginUrl: 'https://www.frigotechnik.de/mein-konto/',
    pruefUrl: 'https://www.frigotechnik.de/mein-konto/',
    async login(page, benutzer, passwort) {
      await page.goto(this.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.locator('a[data-info="login"]').first().click()
      await page.locator('input[name="username"]').waitFor({ timeout: 15_000 })
      await page.fill('input[name="username"]', benutzer)
      await page.fill('input[name="password"]', passwort)
      await page.locator('form:has(input[name="password"]) button[type="submit"]').first().click()
      await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {})
      return this.istAngemeldet(page)
    },
    async istAngemeldet(page) {
      const abmelden = await page.locator('a:has-text("Abmelden"), a[href*="fnc=logout"], a:has-text("Logout")').count()
      const loginKnopf = await page.locator('a[data-info="login"]').count()
      return abmelden > 0 || loginKnopf === 0
    },
    // Produkt-URLs enden auf -<Artikelnummer>.html
    istProduktUrl: (h) => /frigotechnik\.de\/[^?#]+-\d{5,}\.html$/.test(h),
    sucheUrl: (begriff) => `https://www.frigotechnik.de/?cl=search&searchparam=${encodeURIComponent(begriff)}`,
    // Blaettern: Suche haengt &pgNr=N an (0-basiert), Kategorien haengen /N/ an (1-basiert, Seite 1 ohne).
    seiteUrl(listeUrl, n) {
      if (n === 0) return listeUrl
      if (/cl=search/.test(listeUrl)) return listeUrl.replace(/&pgNr=\d+/, '') + `&pgNr=${n}`
      return listeUrl.replace(/\/(\d+\/)?$/, '/') + `${n + 1}/`
    },
  },
}

export function playbook(slug) {
  const pb = PLAYBOOKS[slug]
  if (!pb) throw new Error(`Kein Playbook fuer "${slug}". Bekannt: ${Object.keys(PLAYBOOKS).join(', ')}`)
  return pb
}

export function zugang(slug) {
  const prefix = `LIEFERANT_${slug.toUpperCase().replace(/-/g, '_')}`
  return { benutzer: process.env[`${prefix}_BENUTZER`], passwort: process.env[`${prefix}_PASSWORT`], prefix }
}

// Browser samt Kontext oeffnen; meldet an, wenn gewuenscht. Gibt {browser, kontext, page, sitzung} zurueck.
export async function oeffnen(slug, { ohneLogin = false, neuAnmelden = false, breite = 1280 } = {}) {
  const pb = playbook(slug)
  fs.mkdirSync(stateDir, { recursive: true })
  const statePfad = path.join(stateDir, `${slug}.json`)
  const z = zugang(slug)
  if (!ohneLogin && (!z.benutzer || !z.passwort)) {
    throw new Error(`Zugang fehlt: ${z.prefix}_BENUTZER/_PASSWORT nicht in ${envPfad}. ` +
      `Setzen mit: bash /opt/weich-browser/lieferant-login-setzen.sh ${slug}`)
  }

  const browser = await chromium.launch({ headless: true })
  const optionen = {
    viewport: { width: breite, height: 900 },
    locale: 'de-DE',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
  }
  if (!ohneLogin && !neuAnmelden && fs.existsSync(statePfad)) optionen.storageState = statePfad
  const kontext = await browser.newContext(optionen)
  const page = await kontext.newPage()
  let angemeldet = false
  let sitzung = 'keine'

  if (!ohneLogin) {
    if (optionen.storageState) {
      await page.goto(pb.pruefUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      angemeldet = await pb.istAngemeldet(page)
      sitzung = angemeldet ? 'wiederverwendet' : 'abgelaufen'
    }
    if (!angemeldet) {
      angemeldet = await pb.login(page, z.benutzer, z.passwort)
      sitzung = angemeldet ? 'neu' : 'fehlgeschlagen'
      if (angemeldet) await kontext.storageState({ path: statePfad })
    }
    if (!angemeldet) {
      await browser.close()
      throw new Error('Anmeldung fehlgeschlagen — Zugangsdaten oder Playbook pruefen.')
    }
  }
  return { browser, kontext, page, angemeldet, sitzung, pb }
}

// Produktseite auslesen. Liefert die Rohdaten; die Deutung (Preis als Zahl,
// Einheit) macht der Abnehmer, weil sie je Shop verschieden ist.
export async function produktDaten(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  const daten = await page.evaluate(() => {
    const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
    const blaetter = Array.from(document.querySelectorAll('body *')).filter((e) => e.children.length === 0 && e.textContent.trim())
    const treffer = (re, max = 10) => blaetter.filter((e) => re.test(e.textContent)).map((e) => text(e.parentElement).slice(0, 160)).slice(0, max)
    const preise = blaetter
      .filter((e) => /\d\s*€|€\s*\d|EUR/.test(e.textContent))
      .map((e) => ({ klasse: (e.className || e.parentElement?.className || '').toString().slice(0, 80), text: text(e.parentElement).slice(0, 160) }))
      .slice(0, 15)
    const innen = document.body.innerText.replace(/ /g, ' ')
    const greife = (re) => (innen.match(re) || [])[1]?.trim() ?? null
    const ausgabe = innen.match(/Ausgabe\s*:?\s*(\d+(?:[,.]\d+)?)\s*([A-Za-zäöüÄÖÜ]+)/)
    const meta = (n) => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content ?? null
    const haupt = document.querySelector('main') || document.body
    return {
      titel: text(document.querySelector('h1')) || document.title.split(' | ')[0].split(' / ').pop(),
      seitentitel: document.title,
      artikelnummer: greife(/Artikel-?(?:nummer|Nr\.?)\s*:?\s*(\d[\d.\-\/]{3,}|[A-Z0-9][A-Z0-9.\-\/]{3,}?)(?=\s|[A-Z][a-zä]|$)/i),
      herstellernummer: greife(/(?:OEM|Hersteller)-?(?:Nummer|Nr\.?)\s*:?\s*([A-Z0-9][A-Z0-9 .\-\/]{2,}?)(?=\s+[A-Z][a-zä]|\s*$|\s{2,})/i),
      matchcode: greife(/Matchcode\s*:?\s*([A-Z0-9][A-Z0-9.\-\/]{2,})/i),
      ausgabe_menge: ausgabe ? Number(ausgabe[1].replace(',', '.')) : null,
      ausgabe_einheit: ausgabe ? ausgabe[2] : null,
      preis_nur_nach_login: /loggen Sie sich ein, um den Preis/i.test(innen),
      hersteller: treffer(/Hersteller/i, 3),
      einheit_hinweise: treffer(/Verpackungs(einheit|größe)|Mengeneinheit|Preiseinheit|je\s+(Stück|Meter|m\b)/i, 5),
      preise,
      bild: meta('og:image'),
      beschreibung: meta('description'),
      text: haupt.innerText.replace(/\s+/g, ' ').slice(0, 4000),
    }
  })
  return { url, ...daten }
}

// Alle Produkt-URLs einer Trefferliste (Suche oder Kategorie) ueber alle Seiten.
export async function produktUrlsSammeln(page, pb, listeUrl, { maxSeiten = 40, fortschritt = () => {} } = {}) {
  const gefunden = new Set()
  for (let n = 0; n < maxSeiten; n++) {
    const u = pb.seiteUrl(listeUrl, n)
    const antwort = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    if (antwort && antwort.status() >= 400) break
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    const links = await page.evaluate(() => [...new Set(Array.from(document.querySelectorAll('a[href]')).map((a) => a.href))])
    const neu = links.filter((h) => pb.istProduktUrl(h) && !gefunden.has(h))
    fortschritt({ seite: n, url: u, neu: neu.length, gesamt: gefunden.size + neu.length })
    if (neu.length === 0) break
    for (const h of neu) gefunden.add(h)
  }
  return [...gefunden]
}
