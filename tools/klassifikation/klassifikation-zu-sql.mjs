// klassifikation-zu-sql.mjs — Klassifikations-JSON in SQL fuer
// shop_gut_artikel_klassifikation umwandeln.
import fs from 'node:fs'
const [, , inPath, outPath] = process.argv
const rows = JSON.parse(fs.readFileSync(inPath, 'utf8'))
const sqlStr = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)

const teile = ['begin;']
for (const r of rows) {
  teile.push(
    `insert into public.shop_gut_artikel_klassifikation (artikelnummer, kategorie, formteil_system, dimension) ` +
    `values (${sqlStr(r.artikelnummer)}, ${sqlStr(r.kategorie)}, ${sqlStr(r.system ?? null)}, ${sqlStr(r.dimension ?? null)}) ` +
    `on conflict (artikelnummer) do update set kategorie = excluded.kategorie, ` +
    `formteil_system = excluded.formteil_system, dimension = excluded.dimension;`
  )
}
teile.push('commit;')
fs.writeFileSync(outPath, teile.join('\n') + '\n')
console.log(`Geschrieben: ${outPath} (${rows.length} Artikel)`)
