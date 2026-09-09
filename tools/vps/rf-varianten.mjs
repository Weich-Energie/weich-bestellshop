// rf-varianten.mjs — R+F (rf24.de): alle Ausfuehrungen eines Produkts einsammeln.
//
// R+F fuehrt Dimensionen nicht als eigene Produkte, sondern als Ausfuehrungen
// eines Produkts ("Weitere Ausfuehrungen" / "Alle Ausfuehrungen"). Eine Suche
// liefert nur eine Variante; die anderen Dimensionen stehen auf derselben
// Produktseite hinter dem Reiter. Ohne diesen Schritt vergleicht man die
// Nachbardimension mit einem fremden Produkt — siehe
// docs/lieferanten-shop-zugaenge.md.
//
// Aufruf: node rf-varianten.mjs <produkt-url> [...] [--out /tmp/x.json] [--neu] [--debug]
//   --neu   erzwingt eine frische Anmeldung (die Sitzung verfaellt nach Stunden)

import { writeFileSync } from 'node:fs'
import { oeffnen, produktDaten } from './shop-lib.mjs'

const args = process.argv.slice(2)
const wert = (n, standard) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : standard }
const out = wert('out', null)
const debug = args.includes('--debug')
const urls = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')
if (!urls.length) { console.error('Aufruf: node rf-varianten.mjs <produkt-url> [--out datei.json] [--neu]'); process.exit(1) }

const abgemeldet = (d) => /^Anmeldung|Login/i.test(d.titel || '') || /\/login/.test(d.url || '')

let sitzung = await oeffnen('r-f', { neuAnmelden: args.includes('--neu') })
if (!sitzung.angemeldet) { console.error('R+F: nicht angemeldet'); await sitzung.browser.close(); process.exit(2) }

const ergebnis = { stand: new Date().toISOString(), produkte: [] }
try {
  for (const url of urls) {
    let kopf = await produktDaten(sitzung.page, url, sitzung.pb)
    // Die gespeicherte Sitzung verfaellt nach wenigen Stunden — dann kommt
    // statt der Produktseite die Anmeldemaske. Einmal frisch anmelden.
    if (abgemeldet(kopf)) {
      console.error('Sitzung abgelaufen — melde neu an')
      await sitzung.browser.close()
      sitzung = await oeffnen('r-f', { neuAnmelden: true })
      if (!sitzung.angemeldet) { console.error('R+F: Neuanmeldung fehlgeschlagen'); break }
      kopf = await produktDaten(sitzung.page, url, sitzung.pb)
      if (abgemeldet(kopf)) { console.error('R+F: weiterhin abgemeldet, breche ab'); break }
    }
    const { gefunden, zeilen } = await sitzung.pb.varianten(sitzung.page)
    ergebnis.produkte.push({
      url,
      titel: kopf.titel,
      artikelnummer: kopf.artikelnummer,
      herstellernummer: kopf.herstellernummer,
      netto_preis: kopf.netto_preis,
      netto_quelle: kopf.netto_quelle ?? null,
      abschnitt_gefunden: gefunden,
      ausfuehrungen: zeilen,
      seitentext: debug ? (kopf.text || '').slice(0, 3000) : undefined,
    })
    console.error(`${kopf.titel} — ${zeilen.length} Ausfuehrungen (Abschnitt: ${gefunden ? 'da' : 'fehlt'})`)
    for (const z of zeilen.slice(0, 40)) console.error(`   ${String(z.netto_preis).padStart(8)} ${z.je_ausgewiesen ? 'je' : '  '}  ${z.artikelnummer}  ${(z.titel || '').slice(0, 95)}`)
  }
} finally {
  await sitzung.browser.close()
}
const json = JSON.stringify(ergebnis, null, 1)
if (out) { writeFileSync(out, json); console.error('Geschrieben:', out) } else console.log(json)
