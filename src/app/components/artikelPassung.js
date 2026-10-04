// Welche Artikel passen zu einer gelesenen Aufmaßzeile?
//
// Das Auswahlfeld an einer Zeile führte bisher alle 503 Artikel alphabetisch.
// Bei "Kondensatpumpe" stand dann ein Fitting obenan, und die Zuordnung wurde
// zur Sucharbeit (Patrick, 04.10.2026). Hier entsteht stattdessen eine
// Rangfolge aus dem, was auf dem Zettel steht.
//
// Bewusst keine unscharfe Ähnlichkeit (Levenshtein und Verwandte): die
// Bezeichnungen sind Fachbegriffe, und ein Buchstabendreher zwischen "Bogen"
// und "Boden" wiegt schwerer als die Ähnlichkeit suggeriert. Gezählt wird, was
// wörtlich übereinstimmt — Sachwort, Dimension, Nummer.
//
// Die Regeln unten sind an elf echten Zeilen des Auftrags Pawlik gemessen,
// nicht geraten. Jede Verschärfung kam aus einem Fehlgriff dieser Probe.

// Wörter, die in jedem zweiten Artikelnamen vorkommen und deshalb nichts
// unterscheiden. "stück" steht hier als EINHEIT — in "T-Stück" ist es Teil des
// Sachworts und wird unten gesondert behandelt.
const FUELLWOERTER = new Set([
  'für', 'fuer', 'mit', 'ohne', 'aus', 'und', 'oder', 'der', 'die', 'das', 'den',
  'von', 'vom', 'bei', 'per', 'als', 'auf', 'zum', 'zur', 'nach', 'inkl', 'incl',
  'stueck', 'stk', 'neu', 'alt', 'art', 'nr', 'typ', 'groesse', 'blank', 'mm',
])

// Kurz, aber eindeutig: Fachkürzel tragen mehr Information als ein langes
// Wort. "NYM" allein benennt eine Mantelleitung, "FI" einen Schutzschalter.
// Ohne diese Liste fielen sie durch die Mindestlänge.
const KUERZEL = new Set([
  'nym', 'nyy', 'h07v', 'h05v', 'fi', 'rcd', 'sls', 'ls', 'kfe', 'dn', 'rp',
  'pe', 'pvc', 'rg', 'ms', 'cu', 'vsh', 'ag', 'ig', 'tp', 'wp',
])

// DN und Zoll bezeichnen dieselbe Nennweite. Ohne diese Brücke unterscheidet
// nichts zwischen "Freistromventil DN 25" und "DN 15", wenn auf dem Zettel
// nur 1" steht — und genau das war der teuerste Fehlgriff der Probe.
const DN_ZU_ZOLL = {
  8: '1/4', 10: '3/8', 15: '1/2', 20: '3/4', 25: '1', 32: '11/4',
  40: '11/2', 50: '2', 65: '21/2', 80: '3', 100: '4',
}

function normalisieren(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9/".,\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Sachwörter einer Bezeichnung.
 *
 *  Zusammengesetzte Wörter werden doppelt geführt: "T-Stück" liefert sowohl
 *  "t-stueck" als auch "stueck", damit es sowohl den Bindestrich-Artikel als
 *  auch die auseinandergeschriebene Variante findet. */
function sachwoerter(text) {
  const roh = normalisieren(text).split(/[\s,.]+/).filter(Boolean)
  const out = new Set()
  for (const w of roh) {
    const rein = w.replace(/^[-/]+|[-/]+$/g, '')
    if (!rein) continue
    if (KUERZEL.has(rein)) { out.add(rein); continue }
    if (/^\d+$/.test(rein)) continue
    if (rein.length >= 4 && !FUELLWOERTER.has(rein)) out.add(rein)
    // Bindestrich-Teile einzeln, aber nur wenn sie selbst etwas aussagen.
    // Kürzel zählen auch hier: "NYM-J" trägt sein "nym" im ersten Teil, und
    // ohne diese Zeile fand die Mantelleitung ihre eigene Zeile nicht.
    for (const teil of rein.split('-')) {
      if (teil === rein) continue
      if (KUERZEL.has(teil)) { out.add(teil); continue }
      if (teil.length >= 4 && !FUELLWOERTER.has(teil)) out.add(teil)
    }
  }
  return [...out]
}

/** Nennweiten einer Bezeichnung, auf eine Schreibweise gebracht.
 *
 *  Erfasst Zoll mit und ohne Anführungszeichen (1", R 1, Rp 3/4, G 1/2),
 *  DN-Angaben samt Umrechnung, und Querschnitte wie 3x2,5. */
function dimensionen(text) {
  const t = normalisieren(text)
  const treffer = new Set()

  // Zoll mit Zeichen: 1", 3/4", 1 1/4"
  for (const m of t.matchAll(/(\d+\s*\/\s*\d+|\d+)\s*"/g)) treffer.add(m[1].replace(/\s/g, ''))
  // Zoll ohne Zeichen, am Gewindekürzel erkennbar: R 1, Rp 3/4, G 1/2
  for (const m of t.matchAll(/\b(?:r|rp|g)\s*(\d+\s*\/\s*\d+|\d+)\b/g)) treffer.add(m[1].replace(/\s/g, ''))
  // DN, mit Umrechnung auf Zoll — damit "DN 25" und "1" zusammenfinden.
  for (const m of t.matchAll(/\bdn\s*(\d{1,3})\b/g)) {
    const dn = Number(m[1])
    treffer.add(String(dn))
    if (DN_ZU_ZOLL[dn]) treffer.add(DN_ZU_ZOLL[dn])
  }
  // Querschnitte und Rohrmaße: 3x2,5, 28x1,5, 40x40
  for (const m of t.matchAll(/(\d{1,3}\s*[x×]\s*\d+(?:[,.]\d+)?)/g)) treffer.add(m[1].replace(/\s/g, ""))
  // Blanke Maße ab 6. Bewusst OHNE Wortgrenze: die Einheit klebt oft an der
  // Zahl ("19-22mm", "25qmm"), und zwischen Ziffer und Buchstabe gibt es
  // keine. Genau daran scheiterte die Rohrschelle in der Probe.
  for (const m of t.matchAll(/(?<![\d,.])(\d{2,3})(?![\d,.])/g)) if (Number(m[1]) >= 6) treffer.add(m[1])

  return [...treffer]
}

function normNummer(nr) {
  return String(nr || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Teilen zwei Wörter einen Stamm? "Klemmstein" und "Abzweigklemme" tun es,
 *  "Bogen" und "Boden" nicht — deshalb Präfix und nicht Buchstabenabstand. */
function gleicherStamm(a, b) {
  const kurz = a.length <= b.length ? a : b
  const lang = a.length <= b.length ? b : a
  if (kurz.length < 5) return false
  for (let n = kurz.length; n >= 5; n--) {
    if (lang.includes(kurz.slice(0, n))) return true
  }
  return false
}

/**
 * Punktzahl eines Artikels für eine Zeile. Höher ist besser, 0 heißt
 * „nichts gemeinsam".
 *
 * Die Gewichte sagen, worauf Verlass ist: eine übereinstimmende Nummer ist
 * eine Tatsache, ein gemeinsames Sachwort ein Hinweis, eine gemeinsame
 * Dimension nur dann etwas wert, wenn auch das Sachwort stimmt — sonst
 * gewinnt jeder beliebige Artikel in 22 mm.
 */
export function passung(zeile, artikel) {
  const bezZeile = `${zeile.roh_bezeichnung || ''} ${zeile.roh_artikelnr || ''}`
  const bezArtikel = `${artikel.name || ''} ${artikel.artikelnr || ''}`

  let punkte = 0

  // 1) Nummer. Ganz oder als Teilstück ab fünf Zeichen — Monteure kürzen ab.
  const nrZeile = normNummer(zeile.roh_artikelnr)
  const nrArtikel = normNummer(artikel.artikelnr)
  if (nrZeile && nrArtikel) {
    if (nrZeile === nrArtikel) punkte += 100
    else if (nrZeile.length >= 5 && (nrArtikel.includes(nrZeile) || nrZeile.includes(nrArtikel))) punkte += 40
  }

  // 2) Sachwörter.
  const woerterZeile = sachwoerter(bezZeile)
  const woerterArtikel = sachwoerter(bezArtikel)
  const textArtikel = normalisieren(bezArtikel)
  let sachtreffer = 0
  for (const w of woerterZeile) {
    if (new RegExp(`\\b${w}\\b`).test(textArtikel)) { punkte += 12; sachtreffer++ }
    else if (textArtikel.includes(w)) { punkte += 8; sachtreffer++ }
    else if (woerterArtikel.some((v) => gleicherStamm(w, v))) { punkte += 5; sachtreffer++ }
  }

  // 3) Dimensionen — als Verstärker, nicht als eigener Grund. Ohne gemeinsames
  //    Sachwort ist "22" kein Hinweis, sondern Zufall. Dafür wiegt eine
  //    passende Nennweite schwer: sie unterscheidet die Geschwister.
  if (sachtreffer > 0) {
    const dimZeile = dimensionen(bezZeile)
    const dimArtikel = dimensionen(bezArtikel)
    const gemeinsam = dimZeile.filter((d) => dimArtikel.includes(d))
    punkte += gemeinsam.length * 14
    // Beide nennen eine Nennweite, aber keine gemeinsame: das ist ein
    // Gegenargument, kein neutraler Befund.
    if (!gemeinsam.length && dimZeile.length && dimArtikel.length) punkte -= 6
  }

  // 4) Einheit. Meterware zu Meterware, Stückgut zu Stückgut.
  const eZeile = normalisieren(zeile.roh_einheit)
  const eArtikel = normalisieren(artikel.einheit)
  if (eZeile && eArtikel) {
    const meter = (x) => /^(m|meter|lfm)$/.test(x)
    if (meter(eZeile) === meter(eArtikel)) punkte += 3
    else punkte -= 6
  }

  return punkte
}

/**
 * Die Artikel einer Zeile, sortiert: erst was passt, dann der Rest.
 * `grenze` ist die Punktzahl, ab der ein Artikel als Vorschlag gilt — darunter
 * landet er unter „alle anderen", wird also nicht verschwiegen.
 */
export function sortiereNachPassung(zeile, artikelListe, grenze = 8) {
  const bewertet = artikelListe
    .map((a) => ({ artikel: a, punkte: passung(zeile, a) }))
    .sort((x, y) => y.punkte - x.punkte || x.artikel.name.localeCompare(y.artikel.name, 'de'))

  return {
    vorschlaege: bewertet.filter((b) => b.punkte >= grenze).slice(0, 15),
    rest: bewertet.filter((b) => b.punkte < grenze).map((b) => b.artikel),
  }
}
