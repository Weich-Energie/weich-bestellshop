// Probe der Artikel-Passung an echten Zeilen und echten Artikelnamen aus dem
// Auftrag Pawlik (2025-10182). Aufruf: node src/app/components/artikelPassung.probe.mjs
//
// Kein Testrahmen, mit Absicht: die Probe soll in einer Sekunde laufen und
// eine Zahl sagen. Sie ist der Grund, warum die Regeln in artikelPassung.js
// so aussehen, wie sie aussehen — jede Verschärfung dort kam aus einem
// Fehlgriff hier. Beim naechsten Eingriff zuerst laufen lassen, dann aendern,
// dann wieder laufen lassen.
//
// Stand 04.10.2026: 11 von 11 an erster Stelle.
import { sortiereNachPassung } from './artikelPassung.js'

const artikel = [
  'Optiline Kondensatpumpe Neu mit 6 m PVC- Schlauch',
  'Rohrschelle KLICK 19-22mm M8 1/2" CONEL für Stahl/Metall/Abflussrohr',
  'NEUT Mantelleitung Eca NYM-J 3x2,5 grau',
  'NEUT PVC-Aderleitung Eca H07V-K 1x10 schwarz',
  'DVGW-Freistromventil DIN 3502, messing DN 25 (Rp 1)  m. E.',
  'DVGW-Freistromventil DIN 3502, messing DN 20 (Rp 3/4)  m. E.',
  'DVGW-Freistromventil DIN 3502, messing DN 15 (Rp 1/2)  m. E.',
  'Doppelnippel aus RG/CuSi blank DN 25 (R 1) x 100 mm',
  'Winkel aus RG/CuSi Nr.3092 R 1, mit I/A-Gewinde',
  'Uponor Uni Pipe PLUS 32 x 3,00 mm weiß, 5-Schicht-Verbundrohr',
  'Uponor Uni Pipe PLUS 20 x 2,25 mm weiß, 5-Schicht-Verbundrohr',
  'Prestabo-Übergangsstück 28 mm x 1" IG, Stahl unlegiert verzinkt',
  'Prestabo-Übergangsstück 18 mm x 3/4" AG, Stahl unlegiert verzinkt',
  'ABB FI-Schutzschalter F204B-63/0,03 4polig B63A 30mA 3kA 4TE',
  'ABB Leitungsschutzschalter S203-B16 B16A 3polig 6kA',
  'TEHA Leitungsfuehrungskanal LF40040 40x40mm verkehrsweiss',
  'KFE-Hahn DVGW-Ausführung 1/2" Durchgang vernickelt ohne Schlauchverschraubung',
  'HAGE SLS-Schalter HTS350E 3polig 50A fuer Sammelschiene',
  'PROT FR-Abzweigdose leer 85x85mm PFRAD 8585',
  'Rockwool Heizungsrohrschale 800 für Rohr 35/30',
  'POLL Hauptleitungsabzweigklemme HLAK 25-4/8 grau 25qmm 4polig',
  'T-Stück aus RG/CuSi Nr.3130 in Rp1 x Rp1/2',
].map((name, i) => ({ id: `a${i}`, name, artikelnr: null, einheit: /rohr|leitung|kabel|kanal|schale|pipe/i.test(name) ? 'Meter' : 'Stück' }))

const faelle = [
  { roh_bezeichnung: 'Kondensatpumpe', roh_einheit: 'Stück', erwartet: 'Optiline Kondensatpumpe' },
  { roh_bezeichnung: 'Rohrschelle ø 22', roh_einheit: 'Stück', erwartet: 'Rohrschelle KLICK' },
  { roh_bezeichnung: 'NYM 3x2,5mm Kabel', roh_einheit: 'm', erwartet: 'Mantelleitung' },
  { roh_bezeichnung: 'Freistrom-Ventil 1"', roh_einheit: 'Stück', erwartet: 'DN 25 (Rp 1)' },
  { roh_bezeichnung: 'Freistrom-Ventil 3/4"', roh_einheit: 'Stück', erwartet: 'DN 20 (Rp 3/4)' },
  { roh_bezeichnung: 'Kabelkanal 40x40', roh_einheit: 'm', erwartet: 'Leitungsfuehrungskanal' },
  { roh_bezeichnung: 'Kfe Hahn 1/2" DVGW', roh_einheit: 'Stück', erwartet: 'KFE-Hahn' },
  { roh_bezeichnung: 'Uponor-Rohr ø 32', roh_einheit: 'm', erwartet: 'Uni Pipe PLUS 32' },
  { roh_bezeichnung: 'Mineralwollschale ø 35/30', roh_einheit: 'm', erwartet: 'Rockwool' },
  { roh_bezeichnung: 'T-Stück 1" x 1/2"', roh_einheit: 'Stück', erwartet: 'T-Stück' },
  { roh_bezeichnung: '4-Pol Klemmstein 25mm', roh_einheit: 'Stück', erwartet: 'Hauptleitungsabzweigklemme' },
]

let treffer = 0
for (const f of faelle) {
  const { vorschlaege } = sortiereNachPassung(f, artikel)
  const erster = vorschlaege[0]?.artikel.name ?? '(kein Vorschlag)'
  const ok = erster.includes(f.erwartet)
  if (ok) treffer++
  console.log(`${ok ? 'OK  ' : 'NEIN'}  "${f.roh_bezeichnung}"`)
  console.log(`        → ${erster.slice(0, 68)}${vorschlaege[0] ? `  [${vorschlaege[0].punkte}]` : ''}`)
  if (!ok) {
    console.log(`        erwartet: ${f.erwartet}`)
    for (const v of vorschlaege.slice(1, 4)) console.log(`        auch: ${v.artikel.name.slice(0, 58)} [${v.punkte}]`)
  }
}
console.log(`\n${treffer} von ${faelle.length} richtig an erster Stelle`)
