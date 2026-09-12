// bilder-korrigieren.mjs — baut aus dem Prüfergebnis von
// tools/vps/rf-bilder-pruefen-alle.mjs das UPDATE für shop_artikel.bild_url.
//
// Geschrieben wird nur, wo die Prüfung ein besser passendes Bild gefunden hat
// (status 'besseres_vorhanden') UND der Vorsprung eindeutig ist. Ein knapper
// Vorsprung heißt: die Merkmale reichen nicht, dann bleibt das alte Bild und
// der Fall kommt auf die Liste zum Ansehen.
//
// Aufruf: node tools/bilder-korrigieren.mjs <bild-pruefung.json> <ziel.sql>
//         [--mindest-vorsprung 3]

import fs from 'node:fs'

const args = process.argv.slice(2)
const quelle = args[0]
const ziel = args[1]
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? Number(args[i + 1]) : s }
const mindest = wert('mindest-vorsprung', 3)

if (!quelle || !ziel) { console.error('Aufruf: node bilder-korrigieren.mjs <pruefung.json> <ziel.sql>'); process.exit(1) }

const j = JSON.parse(fs.readFileSync(quelle, 'utf8').replace(/^﻿/, ''))
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"

const kandidaten = j.artikel.filter((a) => a.status === 'besseres_vorhanden' && a.vorschlag)
const sicher = kandidaten.filter((a) => (a.punkte_bestes - a.punkte_aktuell) >= mindest)
const knapp = kandidaten.filter((a) => (a.punkte_bestes - a.punkte_aktuell) < mindest)
const sonstige = j.artikel.filter((a) => !['bestaetigt', 'besseres_vorhanden'].includes(a.status))

console.log(`geprueft: ${j.artikel.length}`)
console.log(`  bestaetigt:          ${j.artikel.filter((a) => a.status === 'bestaetigt').length}`)
console.log(`  besseres vorhanden:  ${kandidaten.length}  (davon eindeutig: ${sicher.length}, knapp: ${knapp.length})`)
for (const [s, n] of Object.entries(sonstige.reduce((m, a) => ({ ...m, [a.status]: (m[a.status] || 0) + 1 }), {})))
  console.log(`  ${s}: ${n}`)

if (!sicher.length) {
  fs.writeFileSync(ziel, '-- nichts eindeutig zu korrigieren\n', 'utf8')
  process.exit(0)
}

const werte = sicher.map((a) => `(${q(a.artikelnr)}, ${q(a.vorschlag)})`).join(',\n  ')
const sql = `-- ${sicher.length} Produktbilder korrigiert, Stand ${j.stand.slice(0, 10)}
--
-- Quelle: tools/vps/rf-bilder-pruefen-alle.mjs. Ersetzt werden nur Bilder, bei
-- denen das vorgeschlagene Bild mindestens ${mindest} Punkte besser zum Artikel passt
-- (Modellnummer, Durchmesser, Teileart, Winkel aus dem alt-Steckbrief von
-- rf24). Knappe Faelle bleiben unveraendert.
with neu(artikelnr, url) as (values
  ${werte}
)
update public.shop_artikel a
   set bild_url = n.url,
       bild_ist_extern = true
  from neu n
 where a.artikelnr = n.artikelnr
   and a.bild_url is distinct from n.url;

select count(*) filter (where bild_url is not null) as mit_bild, count(*) as gesamt
  from public.shop_artikel where sichtbar_aufmass;
`
fs.writeFileSync(ziel, sql, 'utf8')
console.log(`\nSQL fuer ${sicher.length} Artikel geschrieben: ${ziel}`)

if (knapp.length) {
  console.log(`\nKnappe Faelle (bleiben unveraendert, bitte ansehen):`)
  for (const a of knapp.slice(0, 20))
    console.log(`  ${a.artikelnr} ${a.name.slice(0, 44)} | jetzt ${a.punkte_aktuell}, best ${a.punkte_bestes}`)
}
if (sonstige.length) {
  console.log(`\nOhne Vorschlag:`)
  for (const a of sonstige.slice(0, 20)) console.log(`  ${a.status}  ${a.artikelnr} ${a.name.slice(0, 44)}`)
}
