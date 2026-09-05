// shop-zu-eingabe.mjs — Sammelergebnis eines Lieferanten-Shops (sammeln.mjs auf
// dem VPS) in eine Eingabedatei fuer artikel-import.mjs uebersetzen.
//
// Aufruf:
//   node shop-zu-eingabe.mjs eingaben/roh/2026-09-05-frigotechnik-konsolen.json \
//        --klasse fest --nachkalk --out eingaben/2026-09-05-frigotechnik-konsolen.json
//   Optionen:
//     --klasse fest|verbrauch|haupt|auto   Aufschlagsklasse (auto: Meterware -> verbrauch, sonst fest)
//     --nachkalk                            Kennzeichen "Nachkalkulation Klima" setzen
//     --nicht-bestellbar                    bestellbar = false (Standard: bestellbar)
//     --kategorie Klima                     Shop-Kategorie (Standard Klima)
//     --ohne-preis-ueberspringen            Produkte ohne erkannten Preis weglassen (Standard: mit leerem Preis uebernehmen)
//
// Preise: Der Sammellauf liefert alle Textstellen mit €. Hier wird die erste
// Zahl davor als Netto-Einzelpreis genommen, wenn die Zeile nicht nach
// "Brutto", "inkl." oder "UVP" aussieht. Was nicht eindeutig ist, bleibt leer
// und wird in der Zusammenfassung aufgelistet — niemals geraten.

import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const wert = (n, standard) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : standard }
const datei = args.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--klasse', '--kategorie', '--out'].includes(args[i - 1])))
if (!datei) { console.error('Rohdatei fehlt.'); process.exit(2) }

const roh = JSON.parse(readFileSync(datei, 'utf8'))
const lieferantName = { frigotechnik: 'Frigotechnik' }[roh.lieferant] ?? roh.lieferant
const quelle = `${roh.lieferant}-shop`
const stand = roh.stand ?? new Date().toISOString().slice(0, 10)
const klasseWahl = wert('klasse', 'auto')
const kategorie = wert('kategorie', 'Klima')

const EINHEITEN = { stück: 'Stück', stk: 'Stück', st: 'Stück', m: 'Meter', meter: 'Meter', lfm: 'Meter', paar: 'Paar', satz: 'Satz', set: 'Satz', rolle: 'Rolle', kg: 'kg', l: 'Liter', liter: 'Liter', pack: 'Packung', packung: 'Packung', karton: 'Karton', vpe: 'VPE' }
function einheit(p) {
  const e = (p.ausgabe_einheit || '').toLowerCase()
  return EINHEITEN[e] ?? (p.ausgabe_einheit || 'Stück')
}

function preis(p) {
  // Bevorzugt der vom Sammler eindeutig erkannte Nettopreis des Produkts selbst.
  // Die Textstellen mit € sind nur Rueckfall — dort stehen auch Alternativ- und
  // Empfehlungsartikel, deshalb nur die Zeile mit "Nettopreis:" akzeptieren.
  if (typeof p.netto_preis === 'number' && p.netto_preis > 0) return p.netto_preis
  const zeilen = (p.preise || []).map((z) => z.text).filter((t) => /Nettopreis\s*:/i.test(t))
  for (const t of zeilen) {
    const m = t.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*€/) || t.match(/€\s*(\d{1,3}(?:\.\d{3})*,\d{2})/)
    if (m) return Number(m[1].replace(/\./g, '').replace(',', '.'))
  }
  return null
}

function klasse(p) {
  if (klasseWahl !== 'auto') return klasseWahl
  const e = einheit(p)
  const t = `${p.titel} ${e}`.toLowerCase()
  if (e === 'Meter' || e === 'Rolle' || /kanal|kabel|leitung|schlauch|rohr|isolier|band/.test(t)) return 'verbrauch'
  return 'fest'
}

const eingaben = []
const ohnePreis = []
const ohneNummer = []
for (const p of roh.produkte || []) {
  if (p.fehler || !p.titel) continue
  const pn = preis(p)
  if (pn == null) {
    ohnePreis.push(p.titel)
    if (flag('ohne-preis-ueberspringen')) continue
  }
  if (!p.artikelnummer) ohneNummer.push(p.titel)
  eingaben.push({
    name: p.titel,
    artikelnr: p.artikelnummer ?? null,
    lieferant: lieferantName,
    lieferant_url: p.url,
    preis_netto: pn,
    preis_stand: pn != null ? stand : undefined,
    quelle: pn != null ? quelle : undefined,
    einheit: einheit(p),
    beschreibung: [p.beschreibung, p.herstellernummer ? `Herstellernummer ${p.herstellernummer}` : null, p.ausgabe_menge && p.ausgabe_menge !== 1 ? `Verkaufseinheit ${p.ausgabe_menge} ${einheit(p)}` : null].filter(Boolean).join(' · ') || null,
    kategorie,
    aufschlagsklasse: klasse(p),
    bestellbar: !flag('nicht-bestellbar'),
    nachkalkulation_klima: flag('nachkalk'),
  })
}

const out = wert('out', null)
const text = JSON.stringify(eingaben, null, 1)
if (out) writeFileSync(out, text); else console.log(text)
console.error(`${eingaben.length} Artikel uebersetzt aus ${roh.anzahl ?? (roh.produkte || []).length} Produkten (${roh.angemeldet ? 'angemeldet' : 'OHNE LOGIN — keine Netto-Preise'}).`)
if (ohnePreis.length) console.error(`Ohne erkannten Preis (${ohnePreis.length}): ${ohnePreis.slice(0, 8).join(' | ')}${ohnePreis.length > 8 ? ' …' : ''}`)
if (ohneNummer.length) console.error(`Ohne Artikelnummer (${ohneNummer.length}): ${ohneNummer.slice(0, 5).join(' | ')}`)
if (out) console.error(`Geschrieben: ${out} — jetzt: node artikel-import.mjs ${out}`)
