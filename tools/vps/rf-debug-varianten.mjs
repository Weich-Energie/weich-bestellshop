// rf-debug-varianten.mjs — Aufbau des Abschnitts "Weitere Ausfuehrungen im
// Ueberblick" auf einer R+F-Produktseite ansehen.
// Aufruf: node rf-debug-varianten.mjs <produkt-url> [--neu] [--klick]

import { oeffnen, seiteOeffnen } from './shop-lib.mjs'

const args = process.argv.slice(2)
const url = args.find((a) => !a.startsWith('--'))
const { browser, page, angemeldet, pb } = await oeffnen('r-f', { neuAnmelden: args.includes('--neu') })
if (!angemeldet) { console.error('nicht angemeldet'); await browser.close(); process.exit(2) }
try {
  await seiteOeffnen(page, url, pb)
  await page.waitForTimeout(2500)
  if (args.includes('--klick')) {
    await page.locator('.altivernative-variation-link').first().click({ timeout: 4000 }).catch((e) => console.error('Klick:', e.message.slice(0, 60)))
    await page.waitForTimeout(3500)
  }
  // Abschnitt in den Sichtbereich holen, damit Angular ihn fuellt.
  await page.locator('.alternative-variations').first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const d = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const box = document.querySelector('.alternative-variations')
    if (!box) return { fehler: 'kein .alternative-variations', url: location.href }
    // Direkte Kinder als Kandidaten fuer Zeilen
    const kinder = Array.from(box.querySelectorAll('*')).filter((e) => /\d{13}/.test(e.textContent) && !Array.from(e.children).some((k) => /\d{13}/.test(k.textContent)))
    return {
      url: location.href,
      text: norm(box.innerText).slice(0, 2500),
      zeilenAnzahl: kinder.length,
      zeilen: kinder.slice(0, 4).map((e) => ({ tag: e.tagName, klasse: (e.className || '').toString().slice(0, 80), text: norm(e.textContent).slice(0, 250), html: e.outerHTML.replace(/\s+/g, ' ').slice(0, 900) })),
      klassen: [...new Set(Array.from(box.querySelectorAll('*')).map((e) => (e.className || '').toString().split(' ')[0]).filter(Boolean))].slice(0, 25),
    }
  })
  console.log(JSON.stringify(d, null, 1))
} finally {
  await browser.close()
}
