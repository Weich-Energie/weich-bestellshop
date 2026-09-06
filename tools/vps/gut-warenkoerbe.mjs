// gut-warenkoerbe.mjs — Warenkoerbe im GUT Online Plus (gutonlineplus.de)
// angemeldet ansehen. Rein lesend: legt nichts hinein, bestellt nichts.
//
// Aufruf: node gut-warenkoerbe.mjs [--shot /tmp/gut-wk.png] [--korb <Name oder Nr>]
// Ausgabe: JSON mit Hash-URL der Uebersicht, Seitentext, erkannten Koerben
// (Zeilen der Liste) und — mit --korb — den Positionen eines Korbs.
//
// Die App ist eine jQuery-Mobile-Einseiten-Anwendung mit Hash-Routing; das
// Hauptmenue haengt an #menuButton, der Punkt "Warenkoerbe" steht dort und
// als Symbol rechts oben im Kopf.

import { oeffnen } from './shop-lib.mjs'

const args = process.argv.slice(2)
const wert = (n, standard) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : standard }
const shot = wert('shot', null)
const korb = wert('korb', null)

const { browser, page, angemeldet, sitzung, pb } = await oeffnen('gut')
const ergebnis = { lieferant: 'gut', angemeldet, sitzung }
try {
  await page.goto('https://www.gutonlineplus.de/', { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForTimeout(2500)
  await pb.dialogeSchliessen(page)
  await page.locator('button[data-testid="uc-save-button"]').first().click({ timeout: 1500 }).catch(() => {})

  // Zur Warenkorb-Uebersicht: erst das Kopfsymbol, sonst ueber das Hauptmenue.
  const kopf = page.locator('#desktopHead a:has-text("Warenkörbe"), a:has-text("Warenkörbe"):visible, [title="Warenkörbe"]:visible').first()
  if (await kopf.count()) {
    await kopf.click({ timeout: 5000 }).catch(() => {})
  } else {
    await page.locator('#menuButton').click({ timeout: 5000 })
    await page.waitForTimeout(600)
    await page.locator('#pageMenu a:has-text("Warenkörbe"), #pageMenu li:has-text("Warenkörbe")').first().click({ timeout: 5000 })
  }
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(3000)
  // Die Uebersicht (/p/carts) zeigt zunaechst nur einen Teil; der Knopf laedt den Rest.
  const alleLaden = page.locator('a:has-text("Alle Warenkörbe laden"), button:has-text("Alle Warenkörbe laden")').first()
  if (await alleLaden.count()) {
    await alleLaden.click({ timeout: 5000 }).catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(3000)
  }

  // Jeder Korb ist ein jQuery-Mobile-Collapsible: Kopfzeile = Name, Inhalt = Details.
  const koerbe = () => page.evaluate(() => {
    const txt = (e) => (e ? e.innerText.replace(/\s+/g, ' ').replace(/click to (collapse|expand) contents/g, '').trim() : '')
    return Array.from(document.querySelectorAll('.ui-collapsible, [data-role="collapsible"]'))
      .filter((c) => c.getBoundingClientRect().height > 0)
      .map((c) => ({
        name: txt(c.querySelector('.ui-collapsible-heading, h1, h2, h3, h4')),
        offen: !c.classList.contains('ui-collapsible-collapsed'),
        inhalt: txt(c.querySelector('.ui-collapsible-content')).slice(0, 1500),
      }))
  })

  const lesen = () => page.evaluate(() => {
    const txt = (e) => e.innerText.replace(/\s+/g, ' ').trim()
    const sichtbar = (e) => e.offsetParent !== null && e.getBoundingClientRect().height > 0
    // Listenzeilen: jQuery-Mobile-Listviews, Tabellenzeilen oder Kacheln
    const zeilen = Array.from(document.querySelectorAll('ul[data-role="listview"] > li, table tr, [class*="listItem" i], [class*="row" i], [class*="cart" i] li'))
      .filter(sichtbar).map(txt).filter((t) => t.length > 3 && t.length < 400)
    const ueberschriften = Array.from(document.querySelectorAll('h1, h2, h3, .ui-title, [class*="title" i]')).filter(sichtbar).map(txt).filter(Boolean).slice(0, 10)
    const knoepfe = Array.from(document.querySelectorAll('a, button')).filter(sichtbar).map(txt).filter((t) => t && t.length < 40).slice(0, 40)
    const haupt = document.querySelector('#MainPage [data-role="content"], #MainPage .ui-content, #MainPage') || document.body
    return { hash: location.hash, url: location.href, titel: document.title, ueberschriften, zeilen: [...new Set(zeilen)].slice(0, 80), knoepfe: [...new Set(knoepfe)], text: haupt.innerText.replace(/\s+/g, ' ').slice(0, 3000) }
  })

  ergebnis.uebersicht = await lesen()
  ergebnis.koerbe = await koerbe()
  if (shot) { await page.screenshot({ path: shot, fullPage: true }); ergebnis.screenshot = shot }

  if (korb) {
    const ziel = page.locator(`ul[data-role="listview"] li:has-text("${korb}"), table tr:has-text("${korb}"), a:has-text("${korb}")`).first()
    await ziel.click({ timeout: 8000 })
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(3000)
    ergebnis.korb = await lesen()
    if (shot) { const p = shot.replace(/\.png$/, '-korb.png'); await page.screenshot({ path: p, fullPage: true }); ergebnis.korbScreenshot = p }
  }
} catch (e) {
  ergebnis.fehler = String(e.message || e).slice(0, 400)
  if (shot) { await page.screenshot({ path: shot.replace(/\.png$/, '-fehler.png') }).catch(() => {}) }
} finally {
  await browser.close()
}
console.log(JSON.stringify(ergebnis, null, 1))
