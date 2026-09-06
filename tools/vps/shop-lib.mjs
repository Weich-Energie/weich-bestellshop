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
    // Produktseite: ".product__price" enthaelt "Pro Stk. € 65,40 € 109,00" — erst Netto, dann UVP.
    netto: { selektor: '.product__price, .price--net, .product-list-item__price--net', muster: /€\s*([\d.]+,\d{2})/ },
    // /de/search?HeaderSearch.Search= zeigt nur Kategorien; die echte Trefferseite ist suchergebnisse-linum.
    sucheUrl: (begriff) => `https://www.linum.eu/de/suchergebnisse-linum?search=${encodeURIComponent(begriff)}`,
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
    netto: { selektor: '.single-price, .list-price, .price, .price-total', muster: /je:?\s*([\d.]+,\d{2})\s*€/, ersatz: /^\s*([\d.]+,\d{2})\s*€/ },
    seiteUrl(listeUrl, n) {
      const basis = listeUrl.replace(/([?&])currentPage=\d+/, '$1').replace(/[?&]$/, '')
      return basis + (basis.includes('?') ? '&' : '?') + `currentPage=${n + 1}`
    },
  },

  // GUT Gruppe (gutonlineplus.de) — Haustechnik-Grosshandel. Login-Formular
  // direkt auf der Startseite (#a3), Usercentrics-Consent davor.
  gut: {
    name: 'GUT',
    basis: 'https://www.gutonlineplus.de',
    loginUrl: 'https://www.gutonlineplus.de/',
    pruefUrl: 'https://www.gutonlineplus.de/',
    async dialogeSchliessen(page) {
      for (const sel of ['button[data-testid="uc-deny-all-button"]', 'button:has-text("Ablehnen")', 'button:has-text("Einstellungen speichern")', 'button:has-text("Nur notwendige")', 'button:has-text("Speichern")']) {
        if (await page.locator(sel).first().click({ timeout: 1500 }).then(() => true).catch(() => false)) break
      }
    },
    async login(page, benutzer, passwort) {
      await page.goto(this.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await this.dialogeSchliessen(page)
      // jQuery-Mobile-App: das Login-Formular steckt in einem eingeklappten
      // Benutzermenue (ul#UlMenuLogin, display:none). Erst das Menue oeffnen,
      // sonst haelt Playwright die Felder fuer unsichtbar.
      await page.locator('#a3_inputName').waitFor({ state: 'attached', timeout: 20_000 })
      await page.locator('li.user .userBody, li.user, #MenuLogin').first().click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(800)
      if (!(await page.locator('#a3_inputName').isVisible().catch(() => false))) {
        await page.evaluate(() => { const ul = document.querySelector('#UlMenuLogin'); if (ul) ul.style.display = 'block' })
        await page.waitForTimeout(300)
      }
      if (await page.locator('#a3_inputName').isVisible().catch(() => false)) {
        await page.fill('#a3_inputName', benutzer)
        await page.fill('#a3_inputPass', passwort)
        await page.locator('#a3_btnSubmit').click({ timeout: 5000 }).catch(async () => { await page.press('#a3_inputPass', 'Enter') })
      } else {
        // Felder bleiben unsichtbar (verschachtelte jQuery-Mobile-Panels):
        // Werte per Skript setzen, Eingabe-Ereignisse ausloesen, Formular absenden.
        await page.evaluate(({ b, p }) => {
          const setze = (sel, wert) => { const e = document.querySelector(sel); e.value = wert; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }
          setze('#a3_inputName', b); setze('#a3_inputPass', p)
          const knopf = document.querySelector('#a3_btnSubmit')
          if (knopf) knopf.click(); else document.querySelector('#a3').requestSubmit()
        }, { b: benutzer, p: passwort })
      }
      await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {})
      await page.waitForTimeout(3000)
      return this.istAngemeldet(page)
    },
    async istAngemeldet(page) {
      // Nach dem Login verschwindet das Login-Formular aus dem Benutzermenue.
      const pw = await page.locator('#a3_inputPass').count()
      const abmelden = await page.locator('a:has-text("Abmelden"), a:has-text("Logout"), a[href*="logout"], a[href*="Logout"], #a3_btnLogout, [id*="Logout"]').count()
      return abmelden > 0 || pw === 0
    },
    // Einseiten-App mit Hash-Routing: Produkte haben keine eigenen URLs. Suche
    // ueber das Suchfeld, Treffer werden direkt aus der Liste gelesen.
    async suchen(page, begriff) {
      if (!/gutonlineplus\.de/.test(page.url())) await page.goto('https://www.gutonlineplus.de/', { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await this.dialogeSchliessen(page)
      const feld = page.locator('input[placeholder*="Artikeln zu suchen"]:visible, input[placeholder*="Suchbegriff"]:visible').first()
      await feld.waitFor({ timeout: 20_000 })
      await feld.fill('')
      await feld.fill(begriff)
      await feld.press('Enter')
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
      await page.waitForTimeout(3500)
    },
    istProduktUrl: () => false,
    sucheUrl: (begriff) => `https://www.gutonlineplus.de/p/search/${encodeURIComponent(begriff)}`,
    netto: { selektor: '[data-cid="NetPriced"], .GCtextLine.bodyLG', muster: /([\d.]+,\d{2})\s*€/ },
    // Treffer direkt aus der Ergebnistabelle lesen. Jede Zeile hat Elemente mit
    // gemeinsamem id-Praefix "..._productTable_<n>"; der Nettopreis steht in
    // data-cid="NetPriced", daneben "per 1 m" und "8,60 € Listenpreis".
    async trefferAusListe(page) {
      return page.evaluate(() => {
        const out = []
        for (const np of document.querySelectorAll('[data-cid="NetPriced"]')) {
          const prefix = (np.id || '').replace(/_netPriceContainer.*$/, '')
          if (!prefix || !/productTable_\d+$/.test(prefix)) continue
          const zeile = Array.from(document.querySelectorAll(`[id^="${prefix}_"]`))
          const texte = [...new Set(zeile.filter((e) => e.children.length === 0).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean))]
          const nettoText = np.textContent.replace(/\s+/g, ' ').trim()
          const einheit = (np.parentElement?.textContent.match(/per\s+([\d,.]+\s*[A-Za-zäöü]+)/) || [])[1] ?? null
          const listeT = texte.find((t) => /Listenpreis/.test(t)) || ''
          const liste = (listeT.match(/([\d.]+,\d{2})/) || [])[1] ?? null
          const artikelnummer = texte.find((t) => /^[A-Z0-9][A-Z0-9.\-\/]{4,}$/.test(t) && !/€/.test(t)) ?? null
          const titel = texte.filter((t) => !/€|Listenpreis|^per\s|^m$|^Stück$/.test(t) && t !== artikelnummer).sort((a, b) => b.length - a.length)[0] ?? null
          const zahl = (s) => (s ? Number(s.replace(/[^\d,]/g, '').replace(',', '.')) : null)
          out.push({ url: location.href, artikelnummer, titel, netto_preis: zahl(nettoText), netto_quelle: `${nettoText} ${einheit ? 'per ' + einheit : ''} ${listeT}`.trim(), listenpreis: zahl(liste), einheit })
        }
        return out
      })
    },
    seiteUrl(listeUrl, n) { return n === 0 ? listeUrl : listeUrl + (listeUrl.includes('?') ? '&' : '?') + `page=${n + 1}` },
  },

  // COLONS (colons.de) — SHK-Onlineshop. Login /login mit E-Mail, CookieFirst-Consent.
  colons: {
    name: 'Colons',
    basis: 'https://www.colons.de',
    loginUrl: 'https://www.colons.de/login',
    pruefUrl: 'https://www.colons.de/',
    async dialogeSchliessen(page) {
      for (const sel of ['[data-cookiefirst-action="reject"]', 'button:has-text("Ablehnen")', 'button:has-text("Nur notwendige")', '[data-cookiefirst-action="save"]']) {
        if (await page.locator(sel).first().click({ timeout: 1500 }).then(() => true).catch(() => false)) break
      }
    },
    async login(page, benutzer, passwort) {
      await page.goto(this.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await this.dialogeSchliessen(page)
      await page.locator('input[type="password"]').first().waitFor({ timeout: 20_000 })
      await page.locator('input[type="email"], input[placeholder*="E-Mail"]').first().fill(benutzer)
      await page.locator('input[type="password"]').first().fill(passwort)
      // Enter im Passwortfeld statt Klick: der Knopf "Jetzt Anmelden" wird im
      // headless Browser nicht zuverlaessig als Teil des Formulars gefunden.
      await page.press('input[type="password"]', 'Enter')
      await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {})
      await page.waitForTimeout(2500)
      return this.istAngemeldet(page)
    },
    async istAngemeldet(page) {
      if (/\/login/.test(page.url())) return false
      const abmelden = await page.locator('a:has-text("Abmelden"), a[href*="logout"]').count()
      const pw = await page.locator('input[type="password"]').count()
      return abmelden > 0 || pw === 0
    },
    // Produktseiten: /de/<slug>-<Artikelnummer, 6+ Ziffern>; Trefferliste .product-grid-item, Blaettern &page=N (1-basiert).
    istProduktUrl: (h) => /colons\.de\/de\/[a-z0-9-]+-\d{6,}\/?$/i.test(h),
    sucheUrl: (begriff) => `https://www.colons.de/search?q=${encodeURIComponent(begriff)}&ipp=24`,
    seiteUrl(listeUrl, n) { const b = listeUrl.replace(/&page=\d+/, ''); return n === 0 ? b : b + `&page=${n + 1}` },
    netto: { selektor: '.product__price, .product-detail__price, [class*="price"]', muster: /([\d.]+,\d{2})\s*€/ },
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
    // Auf der Produktseite steht im .product-price nur "567,36 EUR"; "netto / Stk" ist ein Nachbarelement.
    netto: { selektor: '.product-price', muster: /([\d.]+,\d{2})\s*EUR/ },
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
  // Zugangsdaten erst holen, wenn die gespeicherte Sitzung nicht mehr traegt —
  // sonst haengt jeder Lauf am Shop-Abruf, auch wenn die Sitzung noch gilt
  // (am 06.09.2026 brach der Schiessl-Lauf an einem 500 der Edge Function ab).
  const sitzungVorhanden = !ohneLogin && !neuAnmelden && fs.existsSync(statePfad)
  let z = {}
  const zugangHolen = async () => {
    z = await zugang(slug)
    if (!z.benutzer || !z.passwort) {
      throw new Error(`Zugang fehlt fuer ${slug}: ${z.grund ?? 'im Shop unter Lieferanten "Zugang hinterlegen"'} ` +
        `(oder lokal: bash /opt/weich-browser/lieferant-login-setzen.sh ${slug})`)
    }
  }
  if (!ohneLogin && !sitzungVorhanden) await zugangHolen()

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
      if (!z.benutzer) await zugangHolen()
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
      // "Artikelnummer: 2032030", "Artikelnummer 0000100847068", "Art-Nr.: 290492000", "Bestell-Nr.: 781.0005"
      artikelnummer: greife(/(?:Artikel|Art\.?|Bestell)\s*-?\s*(?:nummer|Nr\.?)\s*:?\s*(\d[\d.\-\/]{3,}|[A-Z0-9][A-Z0-9.\-\/]{3,}?)(?=\s|[A-Z][a-zä]|$)/i),
      gtin: greife(/(?:GTIN|EAN)\s*-?\s*(?:Nr\.?)?\s*:?\s*(\d{8,14})/i),
      // Frigotechnik "OEM-Nummer: MS257 105", R+F "Werksnummer 2MXM40A9", andere "Hersteller-Nr.: …"
      herstellernummer: greife(/(?:OEM|Hersteller|Werks)-?(?:Artikel)?-?(?:Nummer|Nr\.?)\s*:?\s*([A-Z0-9][A-Z0-9 .\-\/_]{2,}?)(?=\s+[A-Z][a-zä]|\s*$|\s{2,})/i),
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
      // Selektoren in der angegebenen Reihenfolge, nicht in DOM-Reihenfolge —
      // und nichts aus Teasern, Empfehlungen oder Alternativartikeln.
      const fremd = '[class*="teaser"], [class*="recommend"], [class*="similar"], [class*="alternativ"], [class*="slider"], [class*="carousel"], [class*="cross"], [class*="upsell"]'
      const debug = []
      for (const sel of selektor.split(',').map((s) => s.trim()).filter(Boolean)) {
        for (const e of document.querySelectorAll(sel)) {
          const t = e.textContent.replace(/\s+/g, ' ').trim()
          const ausgeschlossen = !!e.closest(fremd)
          if (debug.length < 6) debug.push(`${sel} | ${ausgeschlossen ? 'AUSGESCHLOSSEN ' : ''}${t.slice(0, 60)}`)
          if (ausgeschlossen) continue
          const m = t.match(re) || (re2 && t.match(re2))
          if (m) return { text: t.slice(0, 80), zahl: m[1] }
        }
      }
      return { debug }
    }, {
      selektor: pb.netto.selektor,
      muster: { source: pb.netto.muster.source, flags: pb.netto.muster.flags },
      ersatz: pb.netto.ersatz ? { source: pb.netto.ersatz.source, flags: pb.netto.ersatz.flags } : null,
    })
    if (treffer?.zahl) {
      daten.netto_preis = Number(treffer.zahl.replace(/\./g, '').replace(',', '.'))
      daten.netto_quelle = treffer.text
    } else if (treffer?.debug) {
      daten.netto_debug = treffer.debug
    }
  }
  return { url, ...daten }
}

// Suche ausfuehren: Standard ist die Such-URL, Playbooks koennen eine eigene
// suchen()-Routine mitbringen (Eingabe ins Suchfeld).
export async function suchen(page, pb, begriff) {
  if (pb.suchen) { await pb.suchen(page, begriff) } else { await seiteOeffnen(page, pb.sucheUrl(begriff), pb) }
  // Nachgeladene Trefferlisten brauchen einen Moment, manche laden erst beim Scrollen.
  await page.waitForTimeout(2500)
  await page.mouse.wheel(0, 1200).catch(() => {})
  await page.waitForTimeout(1500)
  return page.url()
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
