// gut-listen-erkunden.mjs — nachsehen, welche Listen-Bereiche der GUT-Shop
// neben den Warenkoerben fuehrt (Vorlagen, Merklisten, Favoriten, …).
// Rein lesend: keine Klicks auf Bestellen, nichts wird in einen Korb gelegt.
//
// Sammelt die Einträge des Seitenmenues und protokolliert alle /api/-Antworten,
// die beim Oeffnen der gefundenen Listen-Seiten zurueckkommen.
//
// Aufruf: node gut-listen-erkunden.mjs [--out /tmp/gut-listen.json]

import { oeffnen } from './shop-lib.mjs'
import fs from 'node:fs'

const args = process.argv.slice(2)
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : s }
const out = wert('out', '/tmp/gut-listen.json')
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a)

const { browser, page, pb } = await oeffnen('gut')
const gesehen = []
page.on('response', async (r) => {
  const u = r.url()
  if (!/\/api\//.test(u)) return
  let t = null
  try { t = await r.text() } catch {}
  gesehen.push({ url: u.replace('https://www.gutonlineplus.de', ''), status: r.status(), laenge: t?.length ?? 0, anfang: t?.slice(0, 300) ?? null })
})

try {
  await page.goto('https://www.gutonlineplus.de/p/home', { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForTimeout(2500)
  await pb.dialogeSchliessen(page)
  await page.locator('button[data-testid="uc-save-button"]').first().click({ timeout: 1500 }).catch(() => {})
  await page.waitForTimeout(1500)

  // Seitenmenue oeffnen — ohne das sind die Navigationspunkte nicht im Layout.
  await page.locator('#menuButton').first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(2000)

  const nav = await page.evaluate(() => [...document.querySelectorAll('a[href]')]
    .map((a) => ({ text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60), href: a.getAttribute('href') }))
    .filter((x) => x.href && /^[/#]/.test(x.href) && x.text)
    .filter((x, i, l) => l.findIndex((y) => y.href === x.href) === i))

  log(`${nav.length} Navigationsziele`)
  for (const n of nav) console.log(`  ${n.href}   ${n.text}`)

  fs.writeFileSync(out, JSON.stringify({ stand: new Date().toISOString(), nav, api: gesehen }, null, 2))
  log(`geschrieben: ${out} (${gesehen.length} API-Antworten)`)
} finally {
  await browser.close()
}
