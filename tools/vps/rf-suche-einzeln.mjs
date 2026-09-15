// rf-suche-einzeln.mjs — eine R+F-Suche bedienen und das Ergebnis auf stdout
// ausgeben. Rein lesend; nichts wird in einen Korb gelegt oder bestellt.
//
// Gedacht als Rückseite der Suchleiste in der Aufmaß-Verwaltung: der Admin gibt
// eine Nummer ein oder scannt einen Barcode, weich-api ruft dieses Skript,
// Patrick sieht die Treffer und drückt auf Hinzufügen.
//
// Der Weg führt über die Suchseite, nicht über die API von Hand — siehe
// rf-nummer-aufloesen.mjs. Das ist hier doppelt nützlich: die Suche findet
// R+F-Nummern, die hinterlegten Wettbewerbsnummern (GUT) und alles, was R+F
// sonst indexiert. Ob ein Regal-Etikett eine EAN oder die R+F-Nummer trägt,
// muss der Aufrufer deshalb nicht wissen.
//
// Zusätzlich wird bei einer 13-stelligen Zahl die Produktseite direkt versucht:
// sie liefert Preis und Bild verlässlicher als die Trefferliste.
//
// Aufruf: node rf-suche-einzeln.mjs "<begriff>" [--treffer 8]
// Ausgabe (stdout, JSON): { begriff, gesamt, treffer: [{ artikelnr, name,
//   preis_netto, bild_url, matchcode, lieferantennr }], quelle }
// Protokoll geht auf stderr, damit stdout reines JSON bleibt.

import { oeffnen, seiteOeffnen } from './shop-lib.mjs'

const args = process.argv.slice(2)
const begriff = (args.find((a) => !a.startsWith('--')) ?? '').trim()
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : s }
const maxTreffer = Math.min(Number(wert('treffer', 8)) || 8, 20)
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a)

const raus = (obj, code = 0) => {
  process.stdout.write(JSON.stringify(obj))
  process.exit(code)
}

if (!begriff) raus({ fehler: 'kein Begriff' }, 1)
// Kein Freitext-Stöbern: die Leiste ist für Nummern und Scans gedacht, und eine
// Volltextsuche liefert hunderte Treffer, aus denen niemand am Handy wählt.
if (begriff.length < 4) raus({ fehler: 'Begriff zu kurz — mindestens 4 Zeichen' }, 1)

const glatt = (s) => (s || '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()
const preisLesen = (text) => {
  // "je: 4,08 €" ist der Stückpreis; ohne "je" steht dort der Gesamtpreis der
  // Verpackungseinheit, und den darf man nicht als Stückpreis nehmen.
  const m = glatt(text).match(/je:?\s*([\d.]+,\d{2})\s*€/i)
  if (!m) return null
  return Number(m[1].replace(/\./g, '').replace(',', '.'))
}

let sitzung
try {
  sitzung = await oeffnen('r-f')
} catch (e) {
  raus({ fehler: 'Browserdienst nicht erreichbar: ' + e.message }, 2)
}
const { page, browser, pb, angemeldet } = sitzung
if (!angemeldet) {
  await browser.close()
  // Der Aufrufer soll das unterscheiden können: hier hilft kein Wiederholen,
  // sondern nur eine neue Anmeldung.
  raus({ fehler: 'R+F-Sitzung abgelaufen', sitzung_abgelaufen: true }, 3)
}

let letzte = null
page.on('response', async (r) => {
  if (!/products\/search/.test(r.url())) return
  try {
    const j = JSON.parse(await r.text())
    if (j?.pagination?.totalResults === undefined) return
    letzte = {
      gesamt: j.pagination.totalResults,
      produkte: (j.products ?? []).slice(0, maxTreffer).map((p) => ({
        artikelnr: p.code,
        name: glatt(p.name),
        preis_netto: p.price?.value ?? null,
        bild_url: p.images?.[0]?.url
          ? (p.images[0].url.startsWith('http') ? p.images[0].url : `https://rf24.de${p.images[0].url}`)
          : null,
        matchcode: p.matchCode ?? null,
        lieferantennr: p.supplierArticleAidNumber ?? null,
      })),
    }
  } catch { /* keine JSON-Antwort */ }
})

try {
  // 1. Eine 13-stellige Zahl ist eine R+F-Artikelnummer: Produktseite direkt.
  if (/^\d{13}$/.test(begriff)) {
    await seiteOeffnen(page, `https://rf24.de/produkt/${begriff}`, pb)
    const da = await page.locator('h1').first().count().catch(() => 0)
    const titel = da ? glatt(await page.locator('h1').first().innerText().catch(() => '')) : ''
    if (titel && !/^Oh oh|nicht gefunden|Seite nicht/i.test(titel)) {
      const rumpf = glatt(await page.locator('body').innerText().catch(() => ''))
      // Bild nach der alt-Steckbrief-Regel: das Bild, dessen alt zum Titel
      // passt — auf einer rf24-Seite liegen auch die Nachbar-Ausfuehrungen.
      let bild = null
      for (const b of await page.locator('img').all()) {
        const alt = glatt(await b.getAttribute('alt').catch(() => ''))
        const src = await b.getAttribute('src').catch(() => null)
        if (!src || !alt) continue
        if (alt.toLowerCase() === titel.toLowerCase()) { bild = src; break }
      }
      await browser.close()
      raus({
        begriff, gesamt: 1, quelle: 'produktseite',
        treffer: [{
          artikelnr: begriff, name: titel,
          preis_netto: preisLesen(rumpf),
          bild_url: bild && bild.startsWith('http') ? bild : (bild ? `https://rf24.de${bild}` : null),
          matchcode: null, lieferantennr: null,
        }],
      })
    }
    log(`Produktseite ${begriff} gibt es nicht — weiter mit der Suche`)
  }

  // 2. Suche. Findet R+F-Nummern, GUT-Nummern und Bezeichnungen.
  letzte = null
  await seiteOeffnen(page, `https://rf24.de/search?query=${encodeURIComponent(begriff)}`, pb)
  for (let v = 0; v < 25 && !letzte; v++) await page.waitForTimeout(400)
  if (/\/login/.test(page.url())) {
    await browser.close()
    raus({ fehler: 'R+F-Sitzung abgelaufen', sitzung_abgelaufen: true }, 3)
  }
  if (!letzte) {
    await browser.close()
    raus({ begriff, gesamt: 0, treffer: [], quelle: 'suche', hinweis: 'keine Antwort der Suche' })
  }
  // Über 50 Treffer heisst: der Begriff wurde nicht erkannt, die Suche fällt
  // auf den Gesamtkatalog zurück. Das ist kein Ergebnis, sondern ein Nichts.
  const erkannt = letzte.gesamt > 0 && letzte.gesamt <= 50
  await browser.close()
  raus({
    begriff, gesamt: letzte.gesamt, quelle: 'suche',
    treffer: erkannt ? letzte.produkte : [],
    hinweis: erkannt ? null
      : `${letzte.gesamt} Treffer — die Nummer wurde nicht erkannt`,
  })
} catch (e) {
  try { await browser.close() } catch { /* egal */ }
  raus({ fehler: e.message }, 2)
}
