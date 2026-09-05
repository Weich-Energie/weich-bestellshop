// login-debug.mjs — Login-Ablauf eines Lieferanten Schritt fuer Schritt mit
// Screenshots, um Playbook-Fehler von falschen Zugangsdaten zu unterscheiden.
// Gibt nie Benutzer oder Passwort aus, nur deren Laenge.
import { chromium } from 'playwright'
import { playbook, zugang } from './shop-lib.mjs'

const slug = process.argv[2] || 'frigotechnik'
const pb = playbook(slug)
const z = await zugang(slug)
console.log(JSON.stringify({ quelle: z.quelle, benutzerLaenge: (z.benutzer || '').length, passwortLaenge: (z.passwort || '').length, grund: z.grund ?? null }))
if (!z.benutzer || !z.passwort) process.exit(1)

const browser = await chromium.launch({ headless: true })
const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'de-DE',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' })
const page = await kontext.newPage()
const antworten = []
page.on('response', (r) => { if (/ajax_login|fnc=login/.test(r.url())) antworten.push({ url: r.url().slice(0, 120), status: r.status() }) })

await page.goto(pb.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
await page.locator('a[data-info="login"]').first().click()
await page.locator('input[name="username"]').waitFor({ timeout: 15_000 })
await page.fill('input[name="username"]', z.benutzer)
await page.fill('input[name="password"]', z.passwort)
await page.screenshot({ path: '/tmp/login-1-ausgefuellt.png' })
const knopf = page.locator('form:has(input[name="password"]) button[type="submit"]').first()
console.log(JSON.stringify({ knopfText: (await knopf.textContent())?.trim(), knopfAnzahl: await page.locator('form:has(input[name="password"]) button[type="submit"]').count() }))
await knopf.click()
await page.waitForTimeout(6000)
await page.screenshot({ path: '/tmp/login-2-nach-klick.png' })
const zustand = await page.evaluate(() => ({
  url: location.href,
  passwortfeldSichtbar: Array.from(document.querySelectorAll('input[type=password]')).some((e) => e.offsetParent !== null),
  loginKnopf: document.querySelectorAll('a[data-info="login"]').length,
  abmelden: Array.from(document.querySelectorAll('a')).filter((a) => /abmelden|logout/i.test(a.textContent + a.href)).length,
  fehlertexte: Array.from(document.querableSelectorAll ? [] : document.querySelectorAll('.error, .alert, [class*=error], [class*=fehler], [class*=alert]')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 5),
  popupText: (document.querySelector('.popup-body')?.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  kopfText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
}))
console.log(JSON.stringify({ antworten, zustand }, null, 1))
await browser.close()
