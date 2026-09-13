// rf-nummer-aufloesen.mjs — GUT-Artikelnummern über die R+F-Suche auflösen.
// Rein lesend.
//
// Patricks Hinweis vom 13.09.2026: R+F hat einen grossen Teil der
// Wettbewerbsnummern intern hinterlegt, damit ein Installateur beim
// Lieferantenwechsel nicht umlernen muss. Die GUT-Nummer findet den R+F-Artikel
// also oft direkt — unvergleichlich viel besser als die Textsuche, an der die
// 91 geratenen Zuordnungen hingen.
//
// Der Weg fuehrt ueber die Suchseite, nicht ueber die API von Hand: der
// Parameter heisst `query`, nicht `q` (mit `q` laedt die Seite, ignoriert den
// Begriff aber und meldet alle 1,4 Mio Artikel — das hat mich eine Runde
// gekostet). Die Anwendung baut daraus den richtigen Solr-Ausdruck; wir lesen
// nur die Antwort mit.
//
// Aufruf: node rf-nummer-aufloesen.mjs <nummern.json> [--out /tmp/aufgeloest.json]
//   nummern.json: ["POVUS3525A", ...] oder [{"gut_nr":"...","text":"..."}, ...]

import { oeffnen, seiteOeffnen } from './shop-lib.mjs'
import fs from 'node:fs'

const args = process.argv.slice(2)
const quelle = args[0]
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : s }
const out = wert('out', '/tmp/aufgeloest.json')
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a)

const roh = JSON.parse(fs.readFileSync(quelle, 'utf8').replace(/^﻿/, ''))
const eintraege = roh.map((x) => (typeof x === 'string' ? { gut_nr: x } : x))

const sitzung = await oeffnen('r-f')
const { page, browser, pb, angemeldet } = sitzung
if (!angemeldet) {
  console.error('nicht angemeldet — erst: node produkt.mjs --lieferant r-f --login-test --neu-anmelden')
  await browser.close(); process.exit(2)
}

// Antworten der Produktsuche mitlesen. Die Seite ruft sie zweimal auf; die
// Fassung mit pagination(FULL) traegt die Trefferzahl.
let letzte = null
page.on('response', async (r) => {
  if (!/products\/search/.test(r.url())) return
  try {
    const j = JSON.parse(await r.text())
    if (j?.pagination?.totalResults === undefined) return
    letzte = {
      gesamt: j.pagination.totalResults,
      produkte: (j.products ?? []).slice(0, 5).map((p) => ({
        artikelnr: p.code,
        name: (p.name || '').replace(/\s+/g, ' ').trim(),
        matchcode: p.matchCode ?? null,
        lieferantennr: p.supplierArticleAidNumber ?? null,
      })),
    }
  } catch { /* keine JSON-Antwort */ }
})

const ergebnis = []
const sichern = () => fs.writeFileSync(out, JSON.stringify({
  stand: new Date().toISOString(), anzahl: ergebnis.length, treffer: ergebnis,
}, null, 2))

try {
  for (const [i, e] of eintraege.entries()) {
    letzte = null
    await seiteOeffnen(page, `https://rf24.de/search?query=${encodeURIComponent(e.gut_nr)}`, pb)
    // Auf die Antwort warten statt blind zu pausieren.
    for (let v = 0; v < 20 && !letzte; v++) await page.waitForTimeout(400)
    if (/\/login/.test(page.url())) throw new Error(`Sitzung abgelaufen bei ${e.gut_nr}`)

    // Ueber 50 Treffer heisst: die Nummer wurde nicht erkannt, die Suche faellt
    // auf den Gesamtkatalog zurueck.
    const brauchbar = letzte && letzte.gesamt > 0 && letzte.gesamt <= 50
    ergebnis.push({
      ...e,
      gesamt: letzte?.gesamt ?? null,
      eindeutig: !!(letzte && letzte.gesamt === 1),
      treffer: brauchbar ? letzte.produkte : [],
    })
    const t = ergebnis[ergebnis.length - 1]
    if (t.treffer.length) {
      log(`  ${e.gut_nr} -> ${t.treffer[0].artikelnr}  ${t.gesamt} Treffer  ${t.treffer[0].name.slice(0, 44)}`)
    }
    if ((i + 1) % 10 === 0) { log(`${i + 1}/${eintraege.length}`); sichern() }
  }
} finally {
  sichern()
  await browser.close()
}

const eindeutig = ergebnis.filter((x) => x.eindeutig).length
const mit = ergebnis.filter((x) => x.treffer.length).length
log(`fertig: ${eindeutig} eindeutig, ${mit} mit Treffern, ${ergebnis.length} geprueft`)
