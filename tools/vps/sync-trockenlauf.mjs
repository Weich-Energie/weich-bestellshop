// Trockenlauf pds-katalog-sync fuer alle Formteil-Kunstartikel (dry_run: true,
// Standard der Function — sendet nichts an PDS, prueft nur das Mapping).
import fs from 'node:fs'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12cmJienFmc3Boc21rZ3V0ZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4OTg4NTksImV4cCI6MjA4NDQ3NDg1OX0.vzMO0CU0zsdIxCusZWnD3AyIjGQQA2UROZVPRF6hiwI'
const jwt = fs.readFileSync('jwt.txt', 'utf8').trim()
const artikel = JSON.parse(fs.readFileSync('kunstartikel-ids.json', 'utf8'))
const ergebnis = []
for (const a of artikel) {
  const r = await fetch('https://mvrbbzqfsphsmkgutegx.supabase.co/functions/v1/pds-katalog-sync', {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ artikel_id: a.id, dry_run: true }),
  })
  let j = null; try { j = await r.json() } catch {}
  ergebnis.push({ name: a.name, http: r.status, status: j?.status ?? null, luecken: j?.luecken ?? null, kalkulation: j?.kalkulation ?? null, hinweise: j?.hinweise ?? j?.hinweis ?? null })
  await new Promise((x) => setTimeout(x, 300))
}
fs.writeFileSync('sync-trockenlauf.json', JSON.stringify(ergebnis, null, 1))
const zaehler = {}
for (const e of ergebnis) { const k = `${e.http} ${e.status}`; zaehler[k] = (zaehler[k] ?? 0) + 1 }
console.log('Zusammenfassung:', JSON.stringify(zaehler))
const luecken = ergebnis.filter((e) => e.luecken)
if (luecken.length) console.log('Beispiel-Luecken:', JSON.stringify(luecken.slice(0, 3), null, 1))
const kalk = ergebnis.find((e) => e.kalkulation || e.hinweise)
if (kalk) console.log('Beispiel-Hinweis:', JSON.stringify({ kalkulation: kalk.kalkulation, hinweise: kalk.hinweise }, null, 1))
