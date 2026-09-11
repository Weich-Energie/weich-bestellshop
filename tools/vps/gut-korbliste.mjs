// gut-korbliste.mjs — nur die Titel aller GUT-Warenkoerbe auflisten.
// Rein lesend, legt nichts in einen Korb und bestellt nichts.
//
// Zweck: nachsehen, welche Koerbe es ueberhaupt gibt, ohne die Positionen zu
// ziehen. gut-export-koerbe.mjs holt zwar auch die Liste, braucht dafuer aber
// pro Korb einen Seitenaufruf.
//
// Aufruf: node gut-korbliste.mjs [--out /tmp/gut-korbliste.json]

import { oeffnen } from './shop-lib.mjs'
import fs from 'node:fs'

const args = process.argv.slice(2)
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : s }
const out = wert('out', '/tmp/gut-korbliste.json')
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a)

const { browser, page, pb } = await oeffnen('gut')
try {
  let body = null
  const listener = async (r) => {
    if (/\/api\/carts\/list/.test(r.url()) && !body) { try { body = await r.text() } catch {} }
  }
  page.on('response', listener)
  await page.goto('https://www.gutonlineplus.de/p/carts', { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForTimeout(3000)
  await pb.dialogeSchliessen(page)
  await page.locator('button[data-testid="uc-save-button"]').first().click({ timeout: 1500 }).catch(() => {})
  await page.waitForTimeout(2500)
  page.off('response', listener)

  if (!body) throw new Error('Korbliste (/api/carts/list) kam nicht — Login oder Consent pruefen')
  const liste = JSON.parse(body).obj || []
  log(`${liste.length} Koerbe`)
  const knapp = liste.map((c) => ({
    titel: c.title,
    cartNumber: c.cartNumber,
    positionen: c.positionCount ?? null,
    prozessart: c.processType ?? null,
    geaendert: c.changeDate ?? c.createDate ?? null,
  }))
  fs.writeFileSync(out, JSON.stringify({ stand: new Date().toISOString(), anzahl: knapp.length, koerbe: knapp }, null, 2))
  for (const k of knapp) console.log(`${String(k.positionen ?? '?').padStart(4)}  pa=${k.prozessart ?? '?'}  ${k.titel}`)
  log(`geschrieben: ${out}`)
} finally {
  await browser.close()
}
