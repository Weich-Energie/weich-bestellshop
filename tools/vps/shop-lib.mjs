// shop-lib.mjs — gemeinsamer Unterbau fuer produkt.mjs und sammeln.mjs.
//
// Enthaelt die Playbooks je Lieferant (Login, Anmeldezustand, Trefferlisten,
// Blaettern), das Lesen der Zugangsdaten aus .env, die Sitzungsverwaltung
// (state/<slug>.json) und das Auslesen einer Produktseite.
//
// Zugangsdaten heissen LIEFERANT_<SLUG>_BENUTZER / _PASSWORT und werden mit
// lieferant-login-setzen.sh gesetzt. Sie verlassen diesen Host nie.

import { chromium } from 'playwright'
import crypto from 'node:crypto'
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
      // Der Ajax-Login laedt die Seite danach neu. networkidle kommt zu frueh —
      // deshalb auf den Abmelden-Link warten, der erst nach dem Neuladen da ist.
      await page.locator('a:has-text("Abmelden")').first().waitFor({ timeout: 25_000 }).catch(() => {})
      await page.waitForTimeout(1500)
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

  // Linum Europe — Zubehoer-Grosshandel Klima/Kaelte. Login-Formular sitzt im
  // Seitenkopf jeder Seite (ASP.NET, Ajax-Post an /svc/de/Login/...).
  linum: {
    name: 'Linum',
    basis: 'https://www.linum.eu',
    loginUrl: 'https://www.linum.eu/de',
    pruefUrl: 'https://www.linum.eu/de',
    async login(page, benutzer, passwort) {
      await page.goto(this.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      // Cookie-Dialog liegt ueber dem Formular. "Allow selection" nimmt nur die
      // vorausgewaehlten (notwendigen) Cookies — nicht "Allow all".
      await page.locator('#js-gdpr-accept').click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(500)
      // Zweiter Dialog: Land und Sprache. Voreingestellt ist Belgien — wir
      // brauchen Deutschland/Deutsch, sonst stimmen Sortiment und Preise nicht.
      const landDialog = page.locator('#js-modal-websiteselection.show')
      if (await landDialog.count()) {
        await page.locator('#Country_79').check({ force: true }).catch(() => {})
        await page.locator('label.js-websiteselection-language[data-languageid="4"]:has-text("Deutschland")').first().click({ timeout: 3000 }).catch(() => {})
        await page.locator('#js-websiteselection-save').click({ timeout: 5000 }).catch(() => {})
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
        await page.waitForTimeout(1000)
        // Nach der Landwahl laedt die Seite neu; der Cookie-Dialog kann erneut da sein.
        await page.locator('#js-gdpr-accept').click({ timeout: 3000 }).catch(() => {})
      }
      await page.fill('#js-login-form-head input[name="LoginViewModel.Login"]', benutzer)
      await page.fill('#js-login-form-head input[name="LoginViewModel.Password"]', passwort)
      await page.locator('#js-login-form-head button[type="submit"]').first().click()
      await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {})
      await page.waitForTimeout(2000)
      return this.istAngemeldet(page)
    },
    async istAngemeldet(page) {
      const pw = await page.locator('#js-login-form-head input[name="LoginViewModel.Password"]').count()
      const abmelden = await page.locator('a:has-text("Abmelden"), a:has-text("Logout"), a[href*="Logout"], a[href*="logout"]').count()
      return abmelden > 0 || pw === 0
    },
    async dialogeSchliessen(page) {
      await page.locator('#js-gdpr-accept').click({ timeout: 2000 }).catch(() => {})
    },
    // Produktseiten haben fuenf Pfadteile nach /de/: bereich/gruppe/untergruppe/variante/produkt-slug
    istProduktUrl: (h) => /linum\.eu\/de\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+(\?|$)/.test(h),
    // Nettopreis steht als eigenes Element (Listenpreis daneben ohne --net).
    netto: { selektor: '.price--net, .product-list-item__price--net', muster: /€\s*([\d.]+,\d{2})/ },
    sucheUrl: (begriff) => `https://www.linum.eu/de/search?HeaderSearch.Search=${encodeURIComponent(begriff)}`,
    seiteUrl(listeUrl, n) {
      if (n === 0) return listeUrl
      return listeUrl + (listeUrl.includes('?') ? '&' : '?') + `page=${n + 1}`
    },
  },

  // R+F (rf24.de) — SAP Commerce. Alles hinter dem Login, auch die Suche.
  'r-f': {
    name: 'R+F',
    basis: 'https://rf24.de',
    loginUrl: 'https://rf24.de/login',
    pruefUrl: 'https://rf24.de/',
    async login(page, benutzer, passwort) {
      await page.goto(this.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      // Angular-App (SAP Spartacus): Formular kommt erst nach dem Rendern.
      await page.locator('input[name="username"]').waitFor({ timeout: 20_000 })
      // Usercentrics-Consent: nur Notwendiges, sonst nichts anklicken.
      await this.dialogeSchliessen(page)
      await page.fill('input[name="username"]', benutzer)
      await page.fill('input[name="password"]', passwort)
      // Enter statt Klick: der Absende-Knopf liegt in der Angular-Form nicht
      // zuverlaessig im selben DOM-Zweig.
      await page.press('input[name="password"]', 'Enter')
      await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30_000 }).catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {})
      await page.waitForTimeout(2000)
      return this.istAngemeldet(page)
    },
    async istAngemeldet(page) {
      if (/\/login/.test(page.url())) return false
      const pw = await page.locator('input[name="password"]').count()
      return pw === 0
    },
    // Usercentrics-Dialog auf jeder Seite, bis er einmal bestaetigt ist:
    // "Einstellungen speichern" laesst nur Essenzielles zu.
    async dialogeSchliessen(page) {
      await page.locator('button:has-text("Einstellungen speichern")').first().click({ timeout: 2500 }).catch(() => {})
    },
    // Produktseiten: /produkt/<13-stellige R+F-Nummer> oder /.../p/<Nummer>
    istProduktUrl: (h) => /rf24\.de\/(produkt\/\d{6,}|.*\/p\/\d{6,})/.test(h),
    sucheUrl: (begriff) => `https://rf24.de/search?text=${encodeURIComponent(begriff)}`,
    // Die Such-URL liefert in der Angular-App keine Treffer; nur die Eingabe im
    // Suchfeld loest die Suche aus.
    async suchen(page, begriff) {
      await page.goto('https://rf24.de/', { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await this.dialogeSchliessen(page)
      const feld = page.locator('input[placeholder*="suchen" i], input[type="search"]').first()
      await feld.waitFor({ timeout: 15_000 })
      await feld.fill(begriff)
      await feld.press('Enter')
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
      await page.waitForTimeout(3000)
    },
    // Unser Preis steht als "je 7,93 € /ST", der Listenpreis daneben als "Listenpreis: 20,70 €".
    netto: { selektor: '.price, .price-total', muster: /je\s*([\d.]+,\d{2})\s*€/, ersatz: /^\s*([\d.]+,\d{2})\s*€/ },
    seiteUrl(listeUrl, n) {
      const basis = listeUrl.replace(/([?&])currentPage=\d+/, '$1').replace(/[?&]$/, '')
      return basis + (basis.includes('?') ? '&' : '?') + `currentPage=${n + 1}`
    },
  },

  // Schiessl Kaeltegesellschaft — Sylius/Symfony-Shop, Login mit E-Mail.
  'schiessl-kaelte': {
    name: 'Schiessl Kälte',
    basis: 'https://www.schiessl-kaelte.com',
    loginUrl: 'https://www.schiessl-kaelte.com/de_DE/login',
    pruefUrl: 'https://www.schiessl-kaelte.com/de_DE/',
    async login(page, benutzer, passwort) {
      await page.goto(this.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.fill('input[name="_username"]', benutzer)
      await page.fill('input[name="_password"]', passwort)
      await page.locator('form:has(input[name="_password"]) button[type="submit"]').first().click()
      await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {})
      await page.waitForTimeout(2000)
      return this.istAngemeldet(page)
    },
    async istAngemeldet(page) {
      const abmelden = await page.locator('a:has-text("Abmelden"), a[href*="logout"]').count()
      const pw = await page.locator('input[name="_password"]').count()
      return abmelden > 0 || (pw === 0 && !/\/login/.test(page.url()))
    },
    // Produktseiten enden auf ~p<Nummer>, Kategorien auf ~c<Nummer>.
    istProduktUrl: (h) => /schiessl-kaelte\.com\/de_DE\/Shop\/.+~p\d+/.test(h),
    netto: { selektor: '.product-price, [class*="price"]', muster: /([\d.]+,\d{2})\s*EUR\s*netto/ },
    sucheUrl: (begriff) => `https://www.schiessl-kaelte.com/de_DE/search/result?q=${encodeURIComponent(begriff)}`,
    seiteUrl(listeUrl, n) {
      if (n === 0) return listeUrl
      return listeUrl + (listeUrl.includes('?') ? '&' : '?') + `page=${n + 1}`
    },
  },
}

export function playbook(slug) {
  const pb = PLAYBOOKS[slug]
  if (!pb) throw new Error(`Kein Playbook fuer "${slug}". Bekannt: ${Object.keys(PLAYBOOKS).join(', ')}`)
  return pb
}

// Zugangsdaten: zuerst lokal aus .env (LIEFERANT_<SLUG>_BENUTZER/_PASSWORT),
// sonst aus dem Shop. Dort hinterlegt ein Admin sie ueber "Zugang hinterlegen";
// die Edge Function lieferant-zugang verschluesselt mit SUPPLIER_CRED_KEY und
// speichert nur die Chiffre. Der VPS holt die Chiffre mit VPS_ZUGANG_TOKEN und
// entschluesselt sie hier mit demselben Schluessel. Klartext gibt es nur im
// Speicher dieses Prozesses.
export async function zugang(slug) {
  const prefix = `LIEFERANT_${slug.toUpperCase().replace(/-/g, '_')}`
  const lokal = { benutzer: process.env[`${prefix}_BENUTZER`], passwort: process.env[`${prefix}_PASSWORT`] }
  if (lokal.benutzer && lokal.passwort) return { ...lokal, prefix, quelle: 'vps-env' }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, VPS_ZUGANG_TOKEN, SUPPLIER_CRED_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !VPS_ZUGANG_TOKEN || !SUPPLIER_CRED_KEY) {
    return { prefix, quelle: 'keine', grund: 'weder lokale Zugangsdaten noch Shop-Anbindung (SUPABASE_URL, SUPABASE_ANON_KEY, VPS_ZUGANG_TOKEN, SUPPLIER_CRED_KEY) in .env' }
  }
  const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/lieferant-zugang`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      'x-vps-token': VPS_ZUGANG_TOKEN,
    },
    body: JSON.stringify({ aktion: 'chiffre', slug }),
  })
  const text = await r.text()
  if (!r.ok) return { prefix, quelle: 'shop', grund: `Shop antwortet ${r.status}: ${text.slice(0, 200)}` }
  const { chiffre } = JSON.parse(text)

  // Byte-Format wie in zugang.mjs und der Edge Function: base64(iv[12] | tag[16] | ciphertext)
  const key = Buffer.from(SUPPLIER_CRED_KEY, 'base64')
  if (key.length !== 32) return { prefix, quelle: 'shop', grund: 'SUPPLIER_CRED_KEY hat nicht 32 Byte' }
  const buf = Buffer.from(chiffre, 'base64')
  const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12))
  d.setAuthTag(buf.subarray(12, 28))
  const daten = JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'))
  return { benutzer: daten.benutzer, passwort: daten.passwort, prefix, quelle: 'shop' }
}

// Browser samt Kontext oeffnen; meldet an, wenn gewuenscht. Gibt {browser, kontext, page, sitzung} zurueck.
export async function oeffnen(slug, { ohneLogin = false, neuAnmelden = false, breite = 1280 } = {}) {
  const pb = playbook(slug)
  fs.mkdirSync(stateDir, { recursive: true })
  const statePfad = path.join(stateDir, `${slug}.json`)
  const z = ohneLogin ? {} : await zugang(slug)
  if (!ohneLogin && (!z.benutzer || !z.passwort)) {
    throw new Error(`Zugang fehlt fuer ${slug}: ${z.grund ?? 'im Shop unter Lieferanten "Zugang hinterlegen"'} ` +
      `(oder lokal: bash /opt/weich-browser/lieferant-login-setzen.sh ${slug})`)
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
// Seite laden und shop-eigene Dialoge (Cookies, Landwahl) wegklicken.
export async function seiteOeffnen(page, url, pb) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  if (pb?.dialogeSchliessen) await pb.dialogeSchliessen(page)
}

export async function produktDaten(page, url, pb) {
  await seiteOeffnen(page, url, pb)
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
    // Frigotechnik (angemeldet): "Nettopreis: 31,93 €" und "Bruttopreis: 53,21 €"
    // stehen im Produktkopf; Alternativ- und Empfehlungsartikel weiter unten
    // tragen dieselben Woerter ohne Doppelpunkt — deshalb nur mit Doppelpunkt
    // und nur der erste Treffer.
    const zahl = (s) => (s ? Number(s.replace(/\./g, '').replace(',', '.')) : null)
    const netto = zahl(greife(/Nettopreis\s*:\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*€/))
    const brutto = zahl(greife(/Bruttopreis\s*:\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*€/))
    const bestand = greife(/Bruttopreis\s*:\s*[\d.,]+\s*€\s*(\d+)\s*Stück/)
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
      netto_preis: netto,
      brutto_preis: brutto,
      bestand: bestand ? Number(bestand) : null,
      hersteller: treffer(/Hersteller/i, 3),
      einheit_hinweise: treffer(/Verpackungs(einheit|größe)|Mengeneinheit|Preiseinheit|je\s+(Stück|Meter|m\b)/i, 5),
      preise,
      bild: meta('og:image'),
      beschreibung: meta('description'),
      text: haupt.innerText.replace(/\s+/g, ' ').slice(0, 4000),
    }
  })
  // Shop-spezifischer Nettopreis, wenn das Playbook einen Selektor kennt und
  // die allgemeine Erkennung (Frigotechnik-Muster) nichts gefunden hat.
  if (daten.netto_preis == null && pb?.netto) {
    const treffer = await page.evaluate(({ selektor, muster, ersatz }) => {
      const re = new RegExp(muster.source, muster.flags)
      const re2 = ersatz ? new RegExp(ersatz.source, ersatz.flags) : null
      for (const e of document.querySelectorAll(selektor)) {
        const t = e.textContent.replace(/\s+/g, ' ').trim()
        const m = t.match(re) || (re2 && t.match(re2))
        if (m) return { text: t.slice(0, 80), zahl: m[1] }
      }
      return null
    }, {
      selektor: pb.netto.selektor,
      muster: { source: pb.netto.muster.source, flags: pb.netto.muster.flags },
      ersatz: pb.netto.ersatz ? { source: pb.netto.ersatz.source, flags: pb.netto.ersatz.flags } : null,
    })
    if (treffer) {
      daten.netto_preis = Number(treffer.zahl.replace(/\./g, '').replace(',', '.'))
      daten.netto_quelle = treffer.text
    }
  }
  return { url, ...daten }
}

// Suche ausfuehren: Standard ist die Such-URL, Playbooks koennen eine eigene
// suchen()-Routine mitbringen (Eingabe ins Suchfeld).
export async function suchen(page, pb, begriff) {
  if (pb.suchen) { await pb.suchen(page, begriff); return page.url() }
  const u = pb.sucheUrl(begriff)
  await seiteOeffnen(page, u, pb)
  await page.waitForTimeout(1500)
  return u
}

// Alle Produkt-URLs einer Trefferliste (Suche oder Kategorie) ueber alle Seiten.
export async function produktUrlsSammeln(page, pb, listeUrl, { maxSeiten = 40, fortschritt = () => {} } = {}) {
  const gefunden = new Set()
  for (let n = 0; n < maxSeiten; n++) {
    const u = pb.seiteUrl(listeUrl, n)
    const antwort = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    if (antwort && antwort.status() >= 400) break
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    if (pb.dialogeSchliessen) await pb.dialogeSchliessen(page)
    // Nachgeladene Listen (Angular, Infinite Scroll) brauchen einen Moment.
    await page.waitForTimeout(1500)
    const links = await page.evaluate(() => [...new Set(Array.from(document.querySelectorAll('a[href]')).map((a) => a.href))])
    const neu = links.filter((h) => pb.istProduktUrl(h) && !gefunden.has(h))
    fortschritt({ seite: n, url: u, neu: neu.length, gesamt: gefunden.size + neu.length })
    if (neu.length === 0) break
    for (const h of neu) gefunden.add(h)
  }
  return [...gefunden]
}
