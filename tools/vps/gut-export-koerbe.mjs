// gut-export-koerbe.mjs — alle GUT-Warenkoerbe mit vollstaendigen Positionen
// (Artikelnr., Beschreibung, Menge, Einheit, EK netto, Nettowert, Listenpreis,
// Lagerbestand) exportieren. Rein lesend.
//
// Nutzt die JSON-API der App statt DOM-Scraping (robuster, liefert echte
// Zahlen statt formatierter Texte):
//   /api/carts/list                         -> alle Koerbe (cartNumber, Titel)
//   /api/carts/cart/positions/<seite>       -> Positionen je Korb, seitenweise
//                                               (60 pro Seite, Nachladen per Scroll)
//   /api/products/getpricesandstocksforcarts -> Preis (netto/brutto) + Bestand,
//                                               wird nach jeder geladenen Seite
//                                               fuer die neuen Positionen aufgerufen
//
// Aufruf: node gut-export-koerbe.mjs [--out /tmp/gut-export.json] [--limit N]
//         [--korb <Namensfilter>]
// Ausgabe: JSON {stand, anzahlKoerbe, anzahlPositionenErwartet,
//           anzahlPositionenGefunden, koerbe:[{name, cartNumber, positionen:[...]}],
//           fehler:[...]}. Fortschritt geht nach stderr.

import { oeffnen } from './shop-lib.mjs'
import fs from 'node:fs'

const args = process.argv.slice(2)
const wert = (n, standard) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : standard }
const out = wert('out', '/tmp/gut-export.json')
const limit = Number(wert('limit', '0')) || Infinity
const korbFilter = wert('korb', null)

function log(...a) { console.error(new Date().toISOString().slice(11, 19), ...a) }

const { browser, page, pb } = await oeffnen('gut')
const ergebnis = { stand: new Date().toISOString(), koerbe: [], fehler: [] }

try {
  // ─── Kornliste einmal komplett holen ───────────────────────────────────
  let listeBody = null
  const listeListener = async (r) => { if (/\/api\/carts\/list\?/.test(r.url()) && !listeBody) { try { listeBody = await r.text() } catch {} } }
  page.on('response', listeListener)
  await page.goto('https://www.gutonlineplus.de/p/carts', { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForTimeout(3000)
  await pb.dialogeSchliessen(page)
  await page.locator('button[data-testid="uc-save-button"]').first().click({ timeout: 1500 }).catch(() => {})
  await page.waitForTimeout(2000)
  page.off('response', listeListener)
  if (!listeBody) throw new Error('Korbliste (/api/carts/list) kam nicht — Login oder Consent geprueft?')
  let liste = JSON.parse(listeBody).obj || []
  if (korbFilter) liste = liste.filter((c) => new RegExp(korbFilter, 'i').test(c.title))
  liste = liste.slice(0, limit)
  log(`Korbliste: ${liste.length} Koerbe`)

  // ─── Je Korb: Positionen seitenweise laden, Preise/Bestand mergen ──────
  for (const [idx, korb] of liste.entries()) {
    log(`[${idx + 1}/${liste.length}] ${korb.title}`)
    const posAntworten = []
    const preisAntworten = []
    const onResponse = async (r) => {
      if (/\/api\/carts\/cart\/positions\//.test(r.url())) { try { posAntworten.push(await r.text()) } catch {} }
      if (/getpricesandstocksforcarts/.test(r.url())) { try { preisAntworten.push(await r.text()) } catch {} }
    }
    page.on('response', onResponse)
    try {
      await page.goto(`https://www.gutonlineplus.de/p/cart/${korb.cartNumber}/positions`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {})
      await page.waitForTimeout(1800)

      // Nachladen: scrollen bis die letzte Positions-Antwort hasMorePositions:false meldet
      // oder zehn Versuche ohne neue Antwort vergehen.
      for (let versuch = 0; versuch < 20; versuch++) {
        const letzte = posAntworten.length ? JSON.parse(posAntworten[posAntworten.length - 1]) : null
        if (letzte && letzte.cart?.hasMorePositions === false) break
        const vorher = posAntworten.length
        await page.mouse.wheel(0, 4000).catch(() => {})
        await page.waitForTimeout(1500)
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
        if (posAntworten.length === vorher && versuch > 3) break // keine neue Seite mehr, auch ohne hasMorePositions-Flag
      }

      // Positionen zusammenfuehren (mehrere Seiten moeglich)
      const alleParsed = posAntworten.map((b) => { try { return JSON.parse(b) } catch { return null } }).filter(Boolean)
      const carthead = alleParsed[0]?.cart?.carthead
      const positionenRoh = alleParsed.flatMap((p) => p.cart?.cartPositions ?? [])
      // nach cartPositionNo deduplizieren (Nachladen kann ueberlappen)
      const positionenMap = new Map()
      for (const p of positionenRoh) positionenMap.set(p.cartPositionNo, p)

      // Preise/Bestand ueber alle Preis-Antworten zu einer Map je Artikelnummer zusammenfuehren.
      // stockArray traegt keine Artikelnummer, nur productKey (supplier+runNumber) — darueber
      // mit priceArray verknuepfen, das dieselbe productKey-Struktur UND die Artikelnummer hat.
      const preisMap = new Map()
      const stockByKey = new Map()
      for (const body of preisAntworten) {
        let j; try { j = JSON.parse(body) } catch { continue }
        for (const p of j.obj?.priceArray ?? []) preisMap.set(p.productNumber, p)
        for (const s of j.obj?.stockArray ?? []) stockByKey.set(`${s.productKey?.supplier}|${s.productKey?.runNumber}`, s)
      }

      const positionen = [...positionenMap.values()].map((p) => {
        const preis = preisMap.get(p.product.productNumber)
        const bestand = preis ? stockByKey.get(`${preis.productKey?.supplier}|${preis.productKey?.runNumber}`) : null
        return {
          artikelnummer: p.product.productNumber,
          beschreibung1: p.product.description1?.replace(/\s+/g, ' ').trim() ?? null,
          beschreibung2: p.product.description2?.replace(/\s+/g, ' ').trim() ?? null,
          menge: p.quantity,
          einheit: p.quantityUnit,
          ek_netto_stueck: preis?.netPrice ?? null,
          ek_netto_gesamt: preis?.netValue ?? null,
          listenpreis_stueck: preis?.grosPrice ?? null,
          bestand: bestand?.stockQuantityInternal ?? null,
          herstellernummer: p.product.supplier ?? null,
          discountGroup: p.product.discountGroup ?? null,
        }
      })

      ergebnis.koerbe.push({
        name: korb.title,
        cartNumber: korb.cartNumber,
        prozessart: carthead?.processType,
        positionenErwartet: carthead?.positionCount ?? null,
        positionenGefunden: positionen.length,
        positionen,
      })
      if (carthead && carthead.positionCount !== positionen.length) {
        log(`  WARNUNG: erwartet ${carthead.positionCount}, gefunden ${positionen.length}`)
      }
    } catch (e) {
      log(`  FEHLER: ${e.message?.slice(0, 200)}`)
      ergebnis.fehler.push({ korb: korb.title, cartNumber: korb.cartNumber, fehler: String(e.message || e).slice(0, 300) })
    } finally {
      page.off('response', onResponse)
    }
  }
} finally {
  await browser.close()
}

ergebnis.anzahlKoerbe = ergebnis.koerbe.length
ergebnis.anzahlPositionenGefunden = ergebnis.koerbe.reduce((s, k) => s + k.positionen.length, 0)
ergebnis.anzahlPositionenErwartet = ergebnis.koerbe.reduce((s, k) => s + (k.positionenErwartet ?? 0), 0)
fs.writeFileSync(out, JSON.stringify(ergebnis, null, 1))
log(`Fertig: ${ergebnis.anzahlKoerbe} Koerbe, ${ergebnis.anzahlPositionenGefunden}/${ergebnis.anzahlPositionenErwartet} Positionen, ${ergebnis.fehler.length} Fehler -> ${out}`)
