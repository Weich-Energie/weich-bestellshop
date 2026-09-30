// fega-erkunden.mjs — einmalige Erkundung des FEGA-Shops hinter dem Login.
// Rein lesend. Meldet, wie die Suche aufgebaut ist und wie eine Trefferliste
// aussieht, damit das Playbook keine geratene URL behaelt.
//
// Aufruf: node fega-erkunden.mjs "<Suchbegriff>"

import { oeffnen } from './shop-lib.mjs'

const begriff = process.argv[2] || 'NYM-J 3x2,5'

const { browser, page, angemeldet } = await oeffnen('fega-schmitt')
if (!angemeldet) { console.error('nicht angemeldet'); await browser.close(); process.exit(2) }

try {
  console.log('Startseite:', page.url())

  // 1) Suchformular finden
  const formulare = await page.evaluate(() =>
    Array.from(document.querySelectorAll('form')).map((f) => ({
      action: f.getAttribute('action'),
      method: f.method,
      felder: Array.from(f.querySelectorAll('input,select')).map((i) => i.name).filter(Boolean),
    })).filter((f) => f.felder.some((n) => /such|search|query|begriff|artikel/i.test(n))))
  console.log('Suchformulare:', JSON.stringify(formulare, null, 1))

  // 2) Suchen wie ein Mensch: Feld füllen, Enter
  const feld = page.locator('input[name*="such" i], input[name*="search" i], input[placeholder*="uch" i]').first()
  if (await feld.count()) {
    await feld.fill(begriff)
    await feld.press('Enter')
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(2500)
    console.log('Treffer-URL:', page.url())

    const probe = await page.evaluate(() => {
      const txt = document.body.innerText.replace(/\n{3,}/g, '\n\n').slice(0, 1800)
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && /artikel|product|detail/i.test(h))
        .slice(0, 12)
      return { txt, links }
    })
    console.log('--- Seitentext ---')
    console.log(probe.txt)
    console.log('--- Produktlinks ---')
    console.log(probe.links.join('\n'))
  } else {
    // Kein passender Selektor: alle Eingabefelder auflisten, statt weiter zu raten.
    const alle = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input, [role="searchbox"], [contenteditable]')).map((i) => ({
        tag: i.tagName, name: i.name || null, id: i.id || null, typ: i.type || null,
        platzhalter: i.placeholder || null, klasse: (i.className || '').slice(0, 60),
        sichtbar: !!(i.offsetWidth || i.offsetHeight),
      })))
    console.log('Alle Eingabefelder:', JSON.stringify(alle, null, 1))
  }
} finally {
  await browser.close()
}
