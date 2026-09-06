// erkunden.mjs — eine Seite eines Lieferanten-Shops angemeldet anschauen, um
// das Playbook zu vervollstaendigen: welche Links sehen nach Produkten aus,
// wo stehen Preise, wie blaettert die Liste.
//
// Aufruf: node erkunden.mjs --lieferant linum <url> [--shot /tmp/x.png]
// Ausgabe: JSON mit Link-Mustern (gruppiert nach Pfadform), Preis-Textstellen,
// Blaetter-Links, Seitentext-Anfang.

import { oeffnen, seiteOeffnen } from './shop-lib.mjs'

const args = process.argv.slice(2)
const wert = (n, standard) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : standard }
const mitWert = new Set(['--lieferant', '--shot'])
const url = args.find((a, i) => !a.startsWith('--') && !(i > 0 && mitWert.has(args[i - 1])))
const slug = wert('lieferant', '')
const shot = wert('shot', null)
if (!slug || !url) { console.error('Aufruf: node erkunden.mjs --lieferant <slug> <url>'); process.exit(1) }

const tippen = wert('tippen', null)
const { browser, page, angemeldet, sitzung, pb } = await oeffnen(slug, { ohneLogin: args.includes('--ohne-login') })
try {
  await seiteOeffnen(page, url, pb)
  // --tippen "Begriff": in das Suchfeld der Seite tippen und Enter druecken —
  // fuer Shops, deren Suche nur ueber die eigene Eingabe funktioniert.
  if (tippen) {
    const feld = page.locator('input[type="search"], input[placeholder*="suchen" i], input[name*="search" i], input[name*="Search"]').first()
    await feld.waitFor({ timeout: 10_000 })
    await feld.fill(tippen)
    await feld.press('Enter')
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(2500)
  }
  // Nachgeladene Trefferlisten (Angular, Infinite Scroll): kurz warten, einmal scrollen, nochmal warten.
  await page.waitForTimeout(3000)
  await page.mouse.wheel(0, 1500).catch(() => {})
  await page.waitForTimeout(2500)
  const d = await page.evaluate(() => {
    const links = [...new Set(Array.from(document.querySelectorAll('a[href]')).map((a) => a.href))]
      .filter((h) => h.startsWith(location.origin))
    const produktKandidaten = links.filter((h) => /~p\d|\/p\/|\/products?\/|\/produkt|\/artikel\/|-\d{5,}\.html|\/a\/\d|sku=|artnr=/i.test(h)).slice(0, 15)
    // Pfadform: Ziffern -> N, lange Slugs -> S
    const form = (h) => new URL(h).pathname.split('/').filter(Boolean)
      .map((s) => /^\d+$/.test(s) ? 'N' : /^[a-z0-9-]{12,}$/i.test(s) ? 'S' : s).join('/')
    const gruppen = {}
    for (const h of links) { const f = form(h); (gruppen[f] ??= []).push(h) }
    const muster = Object.entries(gruppen).sort((a, b) => b[1].length - a[1].length).slice(0, 15)
      .map(([f, hs]) => ({ muster: f, anzahl: hs.length, beispiele: hs.slice(0, 3) }))
    const blaetter = Array.from(document.querySelectorAll('a[href]')).map((a) => a.href).filter((h) => /page=|pgNr=|seite|\/\d+\/?$/i.test(h)).slice(0, 8)
    const blaetter2 = Array.from(document.querySelectorAll('a')).filter((a) => /^\s*(\d+|›|»|weiter|nächste)\s*$/i.test(a.textContent)).map((a) => a.href).slice(0, 8)
    const preise = Array.from(document.querySelectorAll('body *'))
      .filter((e) => e.children.length === 0 && /\d\s*€|€\s*\d|EUR/.test(e.textContent))
      .map((e) => ({ klasse: (e.className || e.parentElement?.className || '').toString().slice(0, 60), text: e.parentElement.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) }))
      .slice(0, 12)
    // Kachel-Muster fuer Shops, die Treffer ohne klassische Links rendern (Angular & Co.)
    const kacheln = Array.from(document.querySelectorAll('[class*="product-tile"],[class*="productTile"],[class*="product-item"],[class*="productItem"],[class*="product-card"],[class*="ProductCard"],article,[class*="tile"]'))
      .filter((e) => e.textContent.trim().length > 20).slice(0, 3)
      .map((e) => ({ tag: e.tagName, klasse: (e.className || '').toString().slice(0, 80), html: e.outerHTML.replace(/\s+/g, ' ').slice(0, 500) }))
    const anzahlText = (document.body.innerText.match(/(\d[\d.]*)\s+(Produkte|Artikel|Treffer|Ergebnisse)/i) || [])[0] ?? null
    return {
      url: location.href, titel: document.title, anzahlText, produktKandidaten, kacheln, linkMuster: muster, blaettern: [...new Set([...blaetter, ...blaetter2])],
      preise, text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 700),
    }
  })
  if (shot) { await page.screenshot({ path: shot, fullPage: false }); d.screenshot = shot }
  console.log(JSON.stringify({ lieferant: slug, angemeldet, sitzung, ...d }, null, 1))
} finally {
  await browser.close()
}
