// gut-bestelltabellen.mjs — die GUT-„Bestelltabellen" (Erfassungslisten) mit
// allen Positionen exportieren. Rein lesend: nichts wird in einen Korb gelegt,
// nichts bestellt, nichts geaendert.
//
// Das sind NICHT die Warenkoerbe. Die 106 Koerbe heissen `NK <Kunde>` und sind
// die Nachkalkulation je Baustelle. Die Bestelltabellen sind nach Material
// gruppiert („HZ Edelstahlsystem", „CU Fittinge & Rohre", „Schwarz", …) — das
// ist die Struktur der Papier-Vordrucke, auf denen die Monteure die Strichliste
// gefuehrt haben, mitsamt der Artikel je Rubrik. Fuer die Rubriken der
// Aufmass-App ist das die eigentliche Vorlage.
//
// API (beides beobachtet, nicht geraten):
//   GET  /api/orderingtables/getOrderingTables?blnCompany=false  -> eigene Tabellen
//   GET  /api/orderingtables/getOrderingTables?blnCompany=true   -> Tabellen des Grosshaendlers
//   POST /api/orderingtables/getOrderingTable
//        {"tableNumber":"<id>","companyId":"551","company":false,"pageNumber":1}
//
// Der crsfKey in der Query wechselt je Aufruf. Deshalb wird eine echte Anfrage
// der App abgewartet und ihre URL als Vorlage wiederverwendet — aufgerufen wird
// aus dem Seitenkontext, damit Cookies und Header stimmen.
//
// Aufruf: node gut-bestelltabellen.mjs [--out /tmp/gut-bestelltabellen.json]
//         [--firmentabellen]   (auch die des Grosshaendlers, sonst nur eigene)

import { oeffnen } from './shop-lib.mjs'
import fs from 'node:fs'

const args = process.argv.slice(2)
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : s }
const out = wert('out', '/tmp/gut-bestelltabellen.json')
const auchFirma = args.includes('--firmentabellen')
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a)

const { browser, page, pb } = await oeffnen('gut')
const listen = { eigene: null, firma: null }
let vorlageUrl = null

page.on('response', async (r) => {
  const u = r.url()
  if (/getOrderingTables\?/.test(u)) {
    const eigen = /blnCompany=false/.test(u)
    try {
      const j = JSON.parse(await r.text())
      if (eigen && !listen.eigene) listen.eigene = j.list ?? []
      if (!eigen && !listen.firma) listen.firma = j.list ?? []
    } catch {}
  }
  if (/getOrderingTable\?/.test(u) && !vorlageUrl) vorlageUrl = u
})

try {
  await page.goto('https://www.gutonlineplus.de/p/home', { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForTimeout(2500)
  await pb.dialogeSchliessen(page)
  await page.locator('button[data-testid="uc-save-button"]').first().click({ timeout: 1500 }).catch(() => {})
  await page.waitForTimeout(3000)

  if (!vorlageUrl) {
    // Die App ruft getOrderingTable beim Start fuer die zuletzt geoeffnete
    // Tabelle. Kam sie nicht, die Seite noch einmal aufrufen.
    await page.goto('https://www.gutonlineplus.de/p/orderingtables', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3000)
  }
  if (!listen.eigene && !listen.firma) throw new Error('Tabellenliste kam nicht — Login pruefen')
  if (!vorlageUrl) throw new Error('Kein getOrderingTable-Aufruf beobachtet — Vorlage fuer crsfKey fehlt')

  const zuHolen = [
    ...(listen.eigene ?? []).map((t) => ({ ...t, firma: false })),
    ...(auchFirma ? (listen.firma ?? []).map((t) => ({ ...t, firma: true })) : []),
  ]
  log(`${zuHolen.length} Tabellen zu holen (eigene: ${listen.eigene?.length ?? 0}, Grosshaendler: ${listen.firma?.length ?? 0}${auchFirma ? '' : ', uebersprungen'})`)

  const ergebnis = []
  for (const [i, t] of zuHolen.entries()) {
    const seiten = []
    for (let seite = 1; seite <= 50; seite++) {
      const antwort = await page.evaluate(async ([url, tableNumber, company, pageNumber]) => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({ tableNumber, companyId: '551', company, pageNumber }),
          credentials: 'include',
        })
        return { status: r.status, text: await r.text() }
      }, [vorlageUrl, t.id, t.firma, seite])

      if (antwort.status !== 200) { log(`  ${t.title}: HTTP ${antwort.status}`); break }
      let j; try { j = JSON.parse(antwort.text) } catch { break }
      const pos = j.lstPos ?? []
      if (j.head && seite === 1) seiten.push({ head: j.head })
      if (!pos.length) break
      seiten.push({ positionen: pos })
      if (pos.length < 25) break // letzte Seite
    }

    const head = seiten.find((s) => s.head)?.head ?? null
    const positionen = seiten.flatMap((s) => s.positionen ?? [])
    ergebnis.push({
      titel: t.title, id: t.id, firmentabelle: t.firma,
      beschreibung: head?.description ?? t.title,
      head, anzahlPositionen: positionen.length, positionen,
    })
    log(`[${i + 1}/${zuHolen.length}] ${t.title}: ${positionen.length} Positionen`)
  }

  fs.writeFileSync(out, JSON.stringify({
    stand: new Date().toISOString(),
    anzahlTabellen: ergebnis.length,
    anzahlPositionen: ergebnis.reduce((s, t) => s + t.anzahlPositionen, 0),
    tabellen: ergebnis,
  }, null, 2))
  log(`geschrieben: ${out}`)
  for (const t of ergebnis) console.log(`${String(t.anzahlPositionen).padStart(4)}  ${t.titel}`)
} finally {
  await browser.close()
}
