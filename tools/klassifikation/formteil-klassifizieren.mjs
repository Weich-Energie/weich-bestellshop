// Klassifiziert jeden GUT-Artikel: Kategorie (formteil | rohr | ventil |
// daemmung | sonstiges) und, nur fuer Formteile, Materialsystem + Dimension
// (mm). Grundlage fuer Ziel-Schritt 3 (Formteil-Mittelwert je System+Dimension).
// Regelbasiert auf Artikelnummer-Praefix und Beschreibungstext — beides aus
// dem GUT-Export, braucht noch keine R+F-Preise.
import fs from 'node:fs'
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))

// Reihenfolge ist die Prioritaet: erster Treffer gewinnt. "test" statt re,
// wenn die Erkennung ordnungsunabhaengig zwei Woerter braucht (z. B. "MLC"
// steht bei Uebergangsstuecken oft VOR "Uponor": "Kupfer MLC Uponor PLUS").
const SYSTEME = [
  // B-press und Profipress sind beides Viega-Kupfer-Presssysteme, preislich
  // gleich zu behandeln — eine Gruppe.
  { system: 'b-press-kupfer', test: (t) => /\bB-press\b|\bProfipress\b(?!.*Gas)/i.test(t), praefix: /^BP/ },
  { system: 'maxipro-kupfer', test: (t) => /\bMaxipro\b/i.test(t), praefix: /^BMP/ },
  { system: 'prestabo-stahl', test: (t) => /\bPrestabo\b/i.test(t), praefix: /^POV/ },
  { system: 'connect-inox', test: (t) => /CONNECT INOX/i.test(t), praefix: /^COCI/ },
  { system: 'megapress-stahl', test: (t) => /\bMegapress\b/i.test(t), praefix: /^MPR/ },
  { system: 'uponor-mlc', test: (t) => /\bUponor\b/i.test(t) && /\bMLC\b|S-Press/i.test(t), praefix: /^UCP/ },
  // "schwarz" ohne weiteren Materialbegriff ist die klassische Gewinde-Serie
  // (Nr.130/290/330/331/92/23) — vor Rotguss pruefen, sonst faellt "Rotguss
  // m.konischem AG" (das eigentlich schwarz + Rotguss-Anteil mischt) falsch.
  { system: 'gewinde-schwarz', test: (t) => /\bschwarz\b/i.test(t), praefix: null },
  { system: 'rotguss-gewinde', test: (t) => /\bRotguss\b/i.test(t), praefix: /^\d+$|^3\d{5,7}[A-Z]?$/ },
]

// Fachbegriffe, die auf ein Verbindungs-Formteil hinweisen (vs. Rohr, Ventil, ...).
const FORMTEIL_BEGRIFFE = /T-St(ü|ue)ck|Winkel|Bogen|Reduzier|(Ü|Ue)bergang|Verschraubung|Muffe|Stopfen|Nippel|Kreuzst(ü|ue)ck|Kappe|Kupplung|Wandscheibe/i
const ROHR_BEGRIFFE = /Kupferrohr|Verbundrohr|Prestabo-Rohr|\bRohr\b(?!schelle|schale)/i
const VENTIL_BEGRIFFE = /Kugelhahn|KFE|KFR|Ventil|R(ü|ue)ckflussverhinderer|Sicherheitsventil|Entl(ü|ue)fter|Thermometer|Pumpenkugelhahn|Ventilunterteil|Stellmotor|Mischer/i
const DAEMMUNG_BEGRIFFE = /Rohrschale|Isolierschale|D(ä|ae)mm|Klebeband|Wool|Manschette/i
const SCHELLE_BEGRIFFE = /Schelle|Tauchh(ü|ue)lse/i
const SONSTIGES_BEGRIFFE = /Flachheizk(ö|oe)rper|Heizk(ö|oe)rper/i

// Dimension: ALLE Groessenangaben in Erscheinungsreihenfolge, nicht nur die
// groesste. Wichtiger Befund (06.09.2026): Uebergangsstuecke/Reduzierstuecke
// sind 35% des Formteil-Werts, haben aber zwei (T-Stueck reduziert: drei)
// verschiedene Groessen — "35mm x 1\"AG" und "35mm x 1 1/4\"AG" sind
// unterschiedliche Teile mit vermutlich unterschiedlichem R+F-Preis. Nur die
// groessere Seite zu nehmen (frueherer Ansatz) haette beide in einen Topf
// geworfen. Bei einfachen Formteilen (Bogen, Winkel, gerades T-Stueck) bleibt
// es bei einer Groesse, weil dort nur eine Zahl vorkommt. Direkt wiederholte
// Angaben (dieselbe mm-Zahl in Beschreibung1 UND 2) werden zusammengefasst.
function dimension(textRoh) {
  // Kettenschreibweise "35 x 22mm" / "25 x 20 x 25mm" nennt die Einheit nur am
  // Ende, gilt aber fuer alle Zahlen der Kette — vor dem eigentlichen Tokenizer
  // auf jede Zahl der Kette uebertragen, sonst gehen die vorderen Glieder als
  // einheitlose Zahl verloren.
  const text = textRoh.replace(/(\d+(?:\/\d+)?(?:\s*x\s*\d+(?:\/\d+)?)+)\s*mm\b/gi, (ganzeKette) =>
    ganzeKette.replace(/mm\s*$/i, '').split(/\s*x\s*/i).map((z) => `${z}mm`).join(' x '))

  const tokens = []
  // Reihenfolge wichtig: Bruch (mit oder ohne fuehrende Ganzzahl) zuerst, sonst
  // reisst "1/2\"" in "1" (verworfen) und "2\"" auseinander.
  const re = /(?:\d+\s+)?\d+\/\d+\s*"(\s*(AG|IG))?|\d+\s*mm\b|\d+\s*"(\s*(AG|IG))?/gi
  // Nur Leerraum um Zoll-/mm-/Gewinde-Zeichen entfernen — das eine Leerzeichen
  // zwischen Ganzzahl und Bruch ("1 1/4") muss stehen bleiben, sonst wird
  // daraus die falsche Zahl "11/4".
  const bereinigen = (s) => s.replace(/\s+"/g, '"').replace(/\s+mm/gi, 'mm').replace(/"\s+(AG|IG)/gi, '"$1')
  let m
  while ((m = re.exec(text))) tokens.push(bereinigen(m[0]))
  if (!tokens.length) return null
  const bereinigt = tokens.filter((t, i) => t !== tokens[i - 1])
  return bereinigt.length > 1 ? bereinigt.join('×') : bereinigt[0]
}

function klassifiziere(r) {
  const text = `${r.beschreibung1 ?? ''} ${r.beschreibung2 ?? ''}`
  if (SCHELLE_BEGRIFFE.test(text)) return { kategorie: 'schelle_zubehoer' }
  if (SONSTIGES_BEGRIFFE.test(text)) return { kategorie: 'sonstiges' }
  if (DAEMMUNG_BEGRIFFE.test(text)) return { kategorie: 'daemmung' }
  if (VENTIL_BEGRIFFE.test(text)) return { kategorie: 'ventil' }
  if (ROHR_BEGRIFFE.test(text)) return { kategorie: 'rohr' }
  if (FORMTEIL_BEGRIFFE.test(text)) {
    for (const s of SYSTEME) {
      if (s.test(text) || (s.praefix && s.praefix.test(r.artikelnummer))) {
        return { kategorie: 'formteil', system: s.system, dimension: dimension(text) }
      }
    }
    return { kategorie: 'formteil', system: 'unbekanntes_system', dimension: dimension(text) }
  }
  return { kategorie: 'ungeklaert' }
}

const ergebnis = rows.map((r) => ({ ...r, ...klassifiziere(r) }))
const zaehler = {}
for (const e of ergebnis) zaehler[e.kategorie] = (zaehler[e.kategorie] ?? 0) + 1
console.log('Kategorien:', JSON.stringify(zaehler, null, 1))
const systeme = {}
for (const e of ergebnis.filter((e) => e.kategorie === 'formteil')) systeme[e.system] = (systeme[e.system] ?? 0) + 1
console.log('Formteil-Systeme:', JSON.stringify(systeme, null, 1))
console.log('Ungeklaert (Beispiele):')
for (const e of ergebnis.filter((e) => e.kategorie === 'ungeklaert').slice(0, 25)) console.log(' ', e.artikelnummer, '|', e.beschreibung1)
console.log('unbekanntes_system (Beispiele):')
for (const e of ergebnis.filter((e) => e.system === 'unbekanntes_system').slice(0, 15)) console.log(' ', e.artikelnummer, '|', e.beschreibung1)
fs.writeFileSync(process.argv[3] ?? 'klassifikation.json', JSON.stringify(ergebnis, null, 1))
