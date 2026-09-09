// abgleich.mjs — dieselben Artikel in mehreren Lieferanten-Shops suchen und
// die Nettopreise nebeneinanderlegen.
//
// Aufruf:
//   node abgleich.mjs --begriffe /tmp/begriffe.json --shops frigotechnik,schiessl-kaelte,linum,r-f --out /tmp/abgleich.json [--max 3]
//
// begriffe.json: [{ "begriff": "2MXM40A9", "name": "Multisplit Aussengeraet 4,0kW", "quelle": "reonic", "ek": 1299.23 }, ...]
// Je Shop eine Sitzung; je Begriff: suchen, bis --max Produkt-URLs oeffnen,
// Treffer behalten, deren Titel/Text/Artikelnummer den Begriff enthaelt
// (Vergleich ohne Leerzeichen, Bindestriche, Gross/Klein).

import fs from 'node:fs'
import { oeffnen, produktDaten, suchen } from './shop-lib.mjs'

const args = process.argv.slice(2)
const wert = (n, standard) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : standard }
const begriffeDatei = wert('begriffe', null)
const shops = wert('shops', 'frigotechnik,schiessl-kaelte,linum,r-f').split(',').map((s) => s.trim()).filter(Boolean)
const out = wert('out', null)
const max = Number(wert('max', '3'))
// --locker: alle Treffer der Suche behalten, auch wenn der Begriff nicht im
// Titel steht. Fuer Gattungsbegriffe (Kabelkanal, Kondensatpumpe), bei denen
// der Shop andere Worte benutzt (Leitungskanal, Kondensatfoerderpumpe).
const locker = args.includes('--locker')
// --varianten: bei Shops, die Dimensionen als Ausfuehrungen eines Produkts
// fuehren (R+F), zu jedem Treffer auch die Geschwister lesen. Ohne das
// vergleicht man die Nachbardimension mit einem fremden Produkt.
const mitVarianten = args.includes('--varianten')
if (!begriffeDatei) { console.error('--begriffe <datei.json> fehlt'); process.exit(1) }
const begriffe = JSON.parse(fs.readFileSync(begriffeDatei, 'utf8'))

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_./]/g, '')
const ergebnis = { stand: new Date().toISOString().slice(0, 10), shops: {}, begriffe }

for (const slug of shops) {
  const t0 = Date.now()
  let sitzung
  try {
    sitzung = await oeffnen(slug)
  } catch (e) {
    ergebnis.shops[slug] = { fehler: e.message }
    console.error(`[${slug}] ${e.message}`)
    continue
  }
  const { browser, page, pb } = sitzung
  const treffer = {}
  try {
    for (const b of begriffe) {
      const zeile = { gesucht: 0, passend: [] }
      try {
        // Suchvarianten: erst der Begriff selbst, dann ohne Herstellerkuerzel
        // ("CU-Z25CKE" -> "Z25CKE"), dann ohne Bindestriche. Manche Shops
        // indexieren die Typbezeichnung nur in einer Schreibweise.
        const varianten = [...new Set([b.begriff, b.begriff.replace(/^[A-Z]{1,3}-/, ''), b.begriff.replace(/-/g, '')].filter((v) => v.length >= 4))]
        let urls = []
        let listeTreffer = null
        for (const v of varianten) {
          await suchen(page, pb, v)
          if (pb.trefferAusListe) {
            // Shops ohne Produkt-URLs (GUT): Treffer stehen komplett in der Liste.
            listeTreffer = await pb.trefferAusListe(page)
            if (listeTreffer.length) { zeile.suchbegriff = v; break }
            continue
          }
          const links = await page.evaluate(() => [...new Set(Array.from(document.querySelectorAll('a[href]')).map((a) => a.href))])
          // Varianten-Links (?selectedcolor=…) auf die Produktseite zusammenziehen.
          urls = [...new Set(links.filter((h) => pb.istProduktUrl(h)).map((h) => h.split('?')[0].split('#')[0]))].slice(0, max)
          if (urls.length) { zeile.suchbegriff = v; break }
        }
        if (listeTreffer) {
          zeile.gesucht = listeTreffer.length
          for (const t of listeTreffer) {
            const passt = locker || norm(`${t.titel} ${t.artikelnummer}`).includes(norm(b.begriff))
            if (passt && zeile.passend.length < max) zeile.passend.push({ ...t, herstellernummer: null, brutto_preis: t.listenpreis ?? null, bestand: null })
          }
          treffer[b.begriff] = zeile
          console.error(`[${slug}] ${b.begriff}: ${zeile.gesucht} in Liste, ${zeile.passend.length} passend`)
          continue
        }
        zeile.gesucht = urls.length
        for (const u of urls) {
          const d = await produktDaten(page, u, pb)
          const heuhaufen = norm(`${d.titel} ${d.artikelnummer} ${d.herstellernummer} ${d.matchcode} ${(d.text || '').slice(0, 1500)}`)
          const passt = locker || heuhaufen.includes(norm(b.begriff))
          if (passt) {
            const eintrag = { url: u, titel: d.titel, artikelnummer: d.artikelnummer, herstellernummer: d.herstellernummer, netto_preis: d.netto_preis ?? null, brutto_preis: d.brutto_preis ?? null, bestand: d.bestand ?? null, einheit: d.ausgabe_einheit ?? null, netto_quelle: d.netto_quelle ?? null }
            if (mitVarianten && pb.varianten) {
              // Die Produktseite ist noch offen — Ausfuehrungen direkt mitlesen.
              const v = await pb.varianten(page).catch((e) => ({ fehler: e.message.slice(0, 120), zeilen: [] }))
              if (v.zeilen?.length) eintrag.ausfuehrungen = v.zeilen
              if (v.fehler) eintrag.varianten_fehler = v.fehler
            }
            zeile.passend.push(eintrag)
          }
        }
      } catch (e) {
        zeile.fehler = e.message.slice(0, 200)
      }
      treffer[b.begriff] = zeile
      const anzVar = zeile.passend.reduce((n, p) => n + (p.ausfuehrungen?.length ?? 0), 0)
      console.error(`[${slug}] ${b.begriff}: ${zeile.gesucht} geprueft, ${zeile.passend.length} passend${anzVar ? `, ${anzVar} Ausfuehrungen` : ''}${zeile.fehler ? ' — ' + zeile.fehler : ''}`)
    }
  } finally {
    await browser.close()
  }
  ergebnis.shops[slug] = { angemeldet: sitzung.angemeldet, sitzung: sitzung.sitzung, dauer_s: Math.round((Date.now() - t0) / 1000), treffer }
}

const text = JSON.stringify(ergebnis, null, 1)
if (out) { fs.writeFileSync(out, text); console.error(`Geschrieben: ${out}`) } else console.log(text)
