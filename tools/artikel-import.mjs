// artikel-import.mjs — Artikel aus einer JSON-Datei in den Bestellshop schreiben.
//
// Zweck: Patrick liefert laufend Daten aus den Lieferanten-Shops (Links,
// Screenshots, Listen). Daraus entsteht eine JSON-Datei, dieses Skript legt die
// Artikel an oder aktualisiert Preis und Stand. Trockenlauf ist Standard.
//
// Aufruf:
//   node artikel-import.mjs eingaben/2026-09-05-frigotechnik.json            (zeigt, was passieren wuerde)
//   node artikel-import.mjs eingaben/2026-09-05-frigotechnik.json --schreiben
//
// Eine Eingabedatei ist ein Array von Objekten:
//   {
//     "name": "Kabelkanal 60x40 weiss 2 m",         Pflicht
//     "artikelnr": "2102331",                       Bestellnummer beim Lieferanten (Schluessel fuer Aktualisierung)
//     "lieferant": "Frigotechnik",                  Name wie in shop_lieferanten, sonst Freitext
//     "lieferant_url": "https://...",               Produktseite
//     "preis_netto": 4.12,                          Einkaufspreis netto je Einheit
//     "preis_stand": "2026-09-05",                  Datum des Preises; fehlt es, gilt heute
//     "quelle": "frigotechnik-shop",                frigotechnik-shop | saukalt | beleg | klimarechner | manuell
//     "einheit": "Meter",                           Stück | Meter | Paar | Satz | ... wie im Shop
//     "beschreibung": "...",                        optional
//     "kategorie": "Klima",                         Name der Shop-Kategorie, Standard Klima
//     "aufschlagsklasse": "verbrauch",              haupt | fest | verbrauch | null
//     "bestellbar": true,                           Standard true
//     "nachkalkulation_klima": true,                Standard false
//     "pds_katalog_uuid": null                      wenn der Artikel in PDS schon existiert
//   }
//
// Zuordnung eines vorhandenen Artikels, in dieser Reihenfolge:
//   1. pds_katalog_uuid  2. lieferant + artikelnr  3. exakter Name (ohne Gross/Klein)
// Gefundene Artikel werden aktualisiert (Preis, Stand, Quelle, URL, Kennzeichen),
// alles andere wird neu angelegt. Die Preishistorie schreibt der Trigger aus
// Migration 015.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const hier = dirname(fileURLToPath(import.meta.url))
const env = {}
for (const zeile of readFileSync(join(hier, '.env'), 'utf8').split('\n')) {
  const t = zeile.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const args = process.argv.slice(2)
const schreiben = args.includes('--schreiben')
const datei = args.find((a) => !a.startsWith('--'))
if (!datei) {
  console.error('Eingabedatei fehlt. Aufruf: node artikel-import.mjs <datei.json> [--schreiben]')
  process.exit(2)
}

const eingaben = JSON.parse(readFileSync(datei, 'utf8'))
if (!Array.isArray(eingaben)) {
  console.error('Die Datei muss ein JSON-Array sein.')
  process.exit(2)
}

const ERLAUBTE_KLASSEN = new Set(['haupt', 'fest', 'verbrauch'])
const heute = new Date().toISOString().slice(0, 10)

const client = new pg.Client({
  host: env.PGHOST, port: Number(env.PGPORT || 5432), database: env.PGDATABASE || 'postgres',
  user: env.PGUSER, password: env.PGPASSWORD, ssl: { rejectUnauthorized: false },
})
await client.connect()

try {
  const { rows: kategorien } = await client.query('select id, name from shop_kategorien')
  const katId = (name) => kategorien.find((k) => k.name.toLowerCase() === String(name || 'Klima').toLowerCase())?.id ?? null

  // Lieferanten sind erst ab Migration 015 fuer diese Rolle lesbar. Davor bleibt
  // lieferant_id leer und der Name steht als Text am Artikel.
  let lieferanten = []
  try {
    lieferanten = (await client.query('select id, name from shop_lieferanten')).rows
  } catch { /* kein Leserecht — Text reicht */ }
  const lieferantId = (name) => lieferanten.find((l) => l.name.toLowerCase() === String(name || '').toLowerCase())?.id ?? null

  const zusammenfassung = { neu: 0, aktualisiert: 0, unveraendert: 0, fehler: 0 }
  const zeilen = []

  for (const e of eingaben) {
    const name = String(e.name || '').trim()
    if (!name) { zusammenfassung.fehler++; zeilen.push(['FEHLER', '(ohne Name)', 'name fehlt']); continue }
    if (e.aufschlagsklasse && !ERLAUBTE_KLASSEN.has(e.aufschlagsklasse)) {
      zusammenfassung.fehler++; zeilen.push(['FEHLER', name, `aufschlagsklasse ${e.aufschlagsklasse} unbekannt`]); continue
    }
    const kategorieId = katId(e.kategorie)
    if (!kategorieId) { zusammenfassung.fehler++; zeilen.push(['FEHLER', name, `Kategorie ${e.kategorie || 'Klima'} nicht gefunden`]); continue }

    // Vorhandenen Artikel suchen
    let vorhanden = null
    if (e.pds_katalog_uuid) {
      vorhanden = (await client.query('select * from shop_artikel where pds_katalog_uuid = $1', [e.pds_katalog_uuid])).rows[0] ?? null
    }
    if (!vorhanden && e.artikelnr && e.lieferant) {
      vorhanden = (await client.query(
        'select * from shop_artikel where artikelnr = $1 and lower(lieferant) = lower($2)', [String(e.artikelnr), e.lieferant],
      )).rows[0] ?? null
    }
    if (!vorhanden) {
      vorhanden = (await client.query('select * from shop_artikel where lower(name) = lower($1)', [name])).rows[0] ?? null
    }

    const felder = {
      name,
      beschreibung: e.beschreibung ?? vorhanden?.beschreibung ?? null,
      kategorie_id: kategorieId,
      lieferant: e.lieferant ?? vorhanden?.lieferant ?? null,
      lieferant_id: lieferantId(e.lieferant) ?? vorhanden?.lieferant_id ?? null,
      lieferant_url: e.lieferant_url ?? vorhanden?.lieferant_url ?? null,
      artikelnr: e.artikelnr != null ? String(e.artikelnr) : (vorhanden?.artikelnr ?? null),
      preis_netto: e.preis_netto ?? vorhanden?.preis_netto ?? null,
      preis_stand: e.preis_netto != null ? (e.preis_stand ?? heute) : (vorhanden?.preis_stand ?? null),
      preis_quelle: e.preis_netto != null ? (e.quelle ?? 'manuell') : (vorhanden?.preis_quelle ?? null),
      einheit: e.einheit ?? vorhanden?.einheit ?? 'Stück',
      aufschlagsklasse: e.aufschlagsklasse ?? vorhanden?.aufschlagsklasse ?? null,
      bestellbar: e.bestellbar ?? vorhanden?.bestellbar ?? true,
      nachkalkulation_klima: e.nachkalkulation_klima ?? vorhanden?.nachkalkulation_klima ?? false,
      pds_katalog_uuid: e.pds_katalog_uuid ?? vorhanden?.pds_katalog_uuid ?? null,
    }

    if (vorhanden) {
      const geaendert = Object.keys(felder).filter((k) => String(felder[k] ?? '') !== String(vorhanden[k] ?? ''))
      if (geaendert.length === 0) { zusammenfassung.unveraendert++; zeilen.push(['gleich', name, '']); continue }
      zusammenfassung.aktualisiert++
      zeilen.push(['UPDATE', name, geaendert.map((k) => `${k}: ${vorhanden[k] ?? '—'} → ${felder[k]}`).join('; ')])
      if (schreiben) {
        const spalten = Object.keys(felder)
        const setz = spalten.map((k, i) => `${k} = $${i + 2}`).join(', ')
        await client.query(`update shop_artikel set ${setz}, updated_at = now() where id = $1`, [vorhanden.id, ...spalten.map((k) => felder[k])])
      }
    } else {
      zusammenfassung.neu++
      zeilen.push(['NEU', name, `${felder.preis_netto ?? '—'} € / ${felder.einheit} · ${felder.aufschlagsklasse ?? 'ohne Klasse'} · ${felder.bestellbar ? 'bestellbar' : 'nur Kalkulation'}${felder.nachkalkulation_klima ? ' · Nachkalk. Klima' : ''}`])
      if (schreiben) {
        const spalten = Object.keys(felder)
        await client.query(
          `insert into shop_artikel (${spalten.join(', ')}, pds_sync_status) values (${spalten.map((_, i) => `$${i + 1}`).join(', ')}, $${spalten.length + 1})`,
          [...spalten.map((k) => felder[k]), felder.pds_katalog_uuid ? 'gesynct' : 'offen'],
        )
      }
    }
  }

  for (const [art, name, info] of zeilen) console.log(`${art.padEnd(7)} ${name}${info ? '  —  ' + info : ''}`)
  console.log('')
  console.log(`${schreiben ? 'GESCHRIEBEN' : 'TROCKENLAUF (nichts geschrieben — mit --schreiben ausfuehren)'}: ` +
    `${zusammenfassung.neu} neu, ${zusammenfassung.aktualisiert} aktualisiert, ${zusammenfassung.unveraendert} unveraendert, ${zusammenfassung.fehler} Fehler`)
} finally {
  await client.end()
}
