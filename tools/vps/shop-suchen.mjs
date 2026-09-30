// shop-suchen.mjs — Freitextsuche in einem Lieferantenshop, mit Nummern und
// Preisen. Rein lesend, nichts wird in einen Warenkorb gelegt.
//
// Gegenstueck zu shop-nummern.mjs: das schlaegt eine bekannte Nummer nach,
// dieses hier findet den Artikel, wenn nur die Bezeichnung feststeht. Genau
// der Fall beim Regieaufmass, wenn die Nummer auf dem Zettel zu nichts passt.
//
// Mit --details N werden fuer die ersten N Treffer die Bezeichnungen
// nachgeladen, sofern die Trefferliste des Shops keine fuehrt (GUT). Das
// kostet je Treffer einen Seitenwechsel, deshalb nicht fuer alle.
//
// Aufruf: node shop-suchen.mjs --lieferant gut "KFE Hahn" [--details 5] [--max 20]

import { oeffnen, playbook } from './shop-lib.mjs'

const args = process.argv.slice(2)
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : s }
const slug = wert('lieferant', null)
const max = Number(wert('max', 20))
const details = Number(wert('details', 0))
// --json: Ausgabe fuer Maschinen statt fuer Menschen. So ruft weich-api das
// Skript, und die Antwort geht unveraendert bis in die Oberflaeche durch.
const alsJson = args.includes('--json')
const begriff = args.find((a, i) => !a.startsWith('--') && !['--lieferant', '--max', '--details'].includes(args[i - 1]))
if (!slug || !begriff) { console.error('Aufruf: --lieferant <slug> "<begriff>"'); process.exit(1) }

const { browser, page, angemeldet } = await oeffnen(slug)
if (!angemeldet) {
  // Eigenes Kennzeichen: eine abgelaufene Sitzung ist kein Suchfehler, sondern
  // braucht eine neue Anmeldung. Der Aufrufer soll nicht sinnlos wiederholen.
  if (alsJson) console.log(JSON.stringify({ sitzung_abgelaufen: true, lieferant: slug }))
  else console.error(`${slug}: nicht angemeldet`)
  await browser.close(); process.exit(2)
}
const pb = playbook(slug)

try {
  await pb.suchen(page, begriff)
  let treffer = typeof pb.trefferAusListe === 'function' ? await pb.trefferAusListe(page).catch(() => []) : []
  treffer = treffer.slice(0, max)

  // Bezeichnungen nachladen, wo die Liste keine fuehrt. Jeder Aufruf wechselt
  // die Seite, deshalb wird danach neu gesucht — sonst findet der naechste
  // Durchgang seine Zeile nicht mehr.
  for (let i = 0; i < Math.min(details, treffer.length); i++) {
    if (treffer[i].titel || typeof pb.detail !== 'function') continue
    const d = await pb.detail(page, treffer[i].artikelnummer).catch(() => null)
    if (d?.titel) { treffer[i].titel = d.titel; treffer[i].hersteller = d.hersteller ?? null }
    await pb.suchen(page, begriff)
  }

  if (alsJson) {
    // Die URL gehoert mit: eine Suche, die still auf der Startseite bleibt,
    // liefert eine Liste, die wie ein Ergebnis aussieht und keines ist.
    const norm = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    console.log(JSON.stringify({
      lieferant: slug,
      begriff,
      url: page.url(),
      gesamt: treffer.length,
      treffer: treffer.map((t) => ({
        artikelnr: t.artikelnummer ?? null,
        name: t.titel ?? null,
        hersteller: t.hersteller ?? null,
        preis_netto: t.netto_preis ?? null,
        listenpreis: t.listenpreis ?? null,
        einheit: t.einheit ?? null,
        // Sagt der Oberflaeche, ob sie den Treffer vorschlagen darf oder nur
        // anbieten: eine uebereinstimmende Nummer ist etwas anderes als ein
        // Artikel, der bei der Suche zufaellig mit dabei war.
        exakt: norm(t.artikelnummer) === norm(begriff),
      })),
    }))
  } else {
    console.log(`"${begriff}" bei ${slug} — ${treffer.length} Treffer  [${page.url()}]`)
    for (const t of treffer) {
      const preis = t.netto_preis != null ? `${t.netto_preis.toFixed(2)} €` : '?'
      console.log(`${String(t.artikelnummer ?? '?').padEnd(16)} ${preis.padStart(10)} ${(t.einheit ?? '').padEnd(10)} ${t.titel ?? ''}`)
    }
  }
} finally {
  await browser.close()
}
