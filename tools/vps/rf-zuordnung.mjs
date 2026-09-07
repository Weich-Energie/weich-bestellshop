// rf-zuordnung.mjs — GUT-Artikel per Volltextsuche einem R+F-Artikel zuordnen.
// Eingabe: JSON-Liste [{artikelnummer, beschreibung1, beschreibung2,
// herstellernummer, menge_gesamt, ek_gesamt, ek_stueck}, ...] (Export aus
// shop_gut_verbrauch_je_artikel). Ausgabe: je Artikel bis zu drei R+F-Kandidaten
// plus eine automatische Einschaetzung (sicher/unsicher/kein_treffer).
//
// Automatische Einschaetzung ist bewusst vorsichtig: "sicher" nur, wenn im
// besten Treffer alle Zahlen (Dimensionen, Millimeterangaben) aus der
// GUT-Beschreibung auch im R+F-Text vorkommen UND mindestens ein Fachbegriff
// (T-Stück, Winkel, Bogen, ...) uebereinstimmt. Alles andere bleibt fuer die
// manuelle Pruefliste (Ziel: "Rest manuell ueber eine Pruefliste").
//
// Aufruf: node rf-zuordnung.mjs <eingabe.json> <ausgabe.json> [--limit N] [--start N]
// Fortschritt nach stderr, damit --out sauber bleibt (falls per > umgeleitet).

import { oeffnen, suchen } from './shop-lib.mjs'
import fs from 'node:fs'

const [, , inPath, outPath, ...rest] = process.argv
if (!inPath || !outPath) { console.error('Aufruf: node rf-zuordnung.mjs <eingabe.json> <ausgabe.json> [--limit N] [--start N]'); process.exit(1) }
const wert = (n, standard) => { const i = rest.indexOf(`--${n}`); return i >= 0 && rest[i + 1] ? Number(rest[i + 1]) : standard }
const limit = wert('limit', Infinity)
const start = wert('start', 0)

function log(...a) { console.error(new Date().toISOString().slice(11, 19), ...a) }

// Fachbegriffe, deren Uebereinstimmung fuer "sicher" noetig ist. GUT schreibt
// ue/oe/ss statt ü/ö/ß — beide Schreibweisen abdecken.
const FACHBEGRIFFE = [
  ['t-stueck', 't-stück'], ['winkel'], ['bogen'], ['reduzierstueck', 'reduzierstück'],
  ['uebergangsstueck', 'übergangsstück', 'uebergangsnippel', 'übergangsnippel'],
  ['verschraubung'], ['muffe'], ['stopfen'], ['nippel'], ['kappe'], ['schelle'],
  ['kugelhahn'], ['ventil'], ['langnippel'], ['doppelnippel'], ['reduzierung'],
  ['kreuzstueck', 'kreuzstück'], ['flansch'], ['sicherungsventil'], ['rueckflussverhinderer', 'rückflussverhinderer'],
]
function fachbegriffeIn(text) {
  const t = text.toLowerCase()
  const treffer = new Set()
  for (const gruppe of FACHBEGRIFFE) if (gruppe.some((w) => t.includes(w))) treffer.add(gruppe[0])
  return treffer
}
// GUT haengt an fast jede Beschreibung einen internen Zeichnungscode an
// ("Rotguss P4243G", "Kupfer P5002") — bei R+F kommt der nie vor, also aus dem
// Soll-Text vor dem Zahlenvergleich entfernen (sonst gilt ein sonst perfekter
// Treffer als "unsicher", nur weil der GUT-Code fehlt).
function ohneInterneCodes(text) {
  return text.replace(/\bP\d{3,6}[A-Z]?\b/gi, ' ')
}

// Alle Zahlen, auch einstellige — Zollmasse wie 1" oder 1 1/2" sind gerade die
// einstelligen und dürfen nicht durchrutschen (Testfund 06.09.2026: "35mm x
// 1\"AG" wurde sonst als Treffer fuer "35mm x R1 1/2 AG" akzeptiert, ein
// anderes Gewinde). Bruchgroessen wie "1 1/2" muessen als EIN Token gelten,
// sonst faellt die "1" davon mit einer echten bare-"1" zusammen und ein
// 1 1/2"-Fitting sieht wie ein 1"-Fitting aus. Deshalb zuerst nach
// Ganzzahl+Bruch suchen, erst danach nach einer einzelnen Zahl.
// Nur auf der GUT-Seite ausgewertet — zusaetzliche Zahlen im R+F-Text
// (Preise, "3 Ausführungen") schaden nicht, sie muessen nicht fehlen.
function zahlenIn(text) {
  return new Set(text.match(/(?:\d+\s+)?\d+\/\d+|\d+(?:[.,]\d+)?/g) || [])
}

// Gewinderichtung ist physisch entscheidend (Aussen- passt nicht auf
// Aussengewinde) und wird von der reinen Zahlen-/Fachbegriff-Pruefung nicht
// erfasst. "AG"/"IG" als eigenes Wort, oder kombiniert wie "I/A", "A/A".
function gewindeTokens(text) {
  const t = text.toUpperCase()
  const tokens = new Set()
  for (const m of t.matchAll(/\b(AG|IG)\b/g)) tokens.add(m[1])
  for (const m of t.matchAll(/\b([AI])\s?\/\s?([AI])\b/g)) {
    tokens.add(m[1] === 'A' ? 'AG' : 'IG')
    tokens.add(m[2] === 'A' ? 'AG' : 'IG')
  }
  return tokens
}

function bewerten(gutTextRoh, rfTextRoh) {
  const gutText = ohneInterneCodes(gutTextRoh)
  // Jede Kachel beginnt mit "N Ausführung(en)" (Variantenzahl) — eine fuehrende
  // "1 Ausführung" liefert sonst eine falsche bare-"1" und deckt GUT-Zollmasse
  // zu, die gar nicht im eigentlichen Produkttext vorkommen (Testfund
  // 06.09.2026: "1 Ausführung ... Rp1 1/4" schien "1\"" zu treffen).
  const rfText = rfTextRoh.replace(/^\d+\s+Ausführung(en)?\s*/, '')
  const gutZahlen = zahlenIn(gutText)
  const rfZahlen = zahlenIn(rfText)
  const gutFach = fachbegriffeIn(gutText)
  const rfFach = fachbegriffeIn(rfText)
  const fehlendeZahlen = [...gutZahlen].filter((z) => !rfZahlen.has(z))
  const fachTreffer = [...gutFach].some((f) => rfFach.has(f))
  const gutGewinde = gewindeTokens(gutText)
  const rfGewinde = gewindeTokens(rfText)
  // Widerspruch nur, wenn beide Seiten ueberhaupt eine Gewinderichtung nennen
  // und sie sich nicht ueberschneiden — sonst waeren Artikel ganz ohne
  // Gewindeangabe (Rohre, Schellen) faelschlich betroffen.
  const gewindeWiderspruch = gutGewinde.size > 0 && rfGewinde.size > 0 && ![...gutGewinde].some((g) => rfGewinde.has(g))
  return { fehlendeZahlen, fachTreffer, zahlenGesamt: gutZahlen.size, gewindeWiderspruch }
}

const eingabe = JSON.parse(fs.readFileSync(inPath, 'utf8')).slice(start, start + limit)
log(`${eingabe.length} Artikel zu suchen (Start ${start})`)

const { browser, page, pb } = await oeffnen('r-f')
const ausgabe = []

try {
  for (const [i, artikel] of eingabe.entries()) {
    const begriff = [artikel.beschreibung1, artikel.beschreibung2].filter(Boolean).join(' ')
      .replace(/\s+/g, ' ').replace(/[^\wäöüÄÖÜß"'\/. -]/g, ' ').trim()
    log(`[${i + 1}/${eingabe.length}] ${artikel.artikelnummer}: "${begriff.slice(0, 60)}"`)
    const eintrag = { artikelnummer: artikel.artikelnummer, beschreibung: begriff, kandidaten: [], einschaetzung: 'kein_treffer' }
    try {
      await suchen(page, pb, begriff)
      // Echte Trefferkacheln (docs/lieferanten-shop-zugaenge.md, Abschnitt R+F):
      // div.position__container, immer mit Link auf /produkt/<Artikel-Nr>. Das
      // Kopfzeilen-Widget ("0 Positionen 0,00 €") traegt diese Klasse nicht.
      const kacheln = await page.evaluate(() => {
        const gesehen = new Set()
        const ergebnis = []
        for (const k of document.querySelectorAll('div.position__container')) {
          const href = k.querySelector('a[href*="/produkt/"]')?.href ?? null
          if (!href) continue
          const text = k.textContent.replace(/\s+/g, ' ').trim()
          if (gesehen.has(text)) continue
          gesehen.add(text)
          ergebnis.push({ text: text.slice(0, 300), href })
          if (ergebnis.length >= 12) break
        }
        return ergebnis
      })
      // Alle geladenen Kacheln bewerten (nicht nur die ersten 3) — der beste
      // Treffer liegt manchmal weiter unten in der Suchreihenfolge. Fund
      // 07.09.2026: Top-3-Grenze liess reale Treffer fuer Artikel mit vielen
      // Ausfuehrungen aussen vor.
      for (const k of kacheln) {
        // Kein Leerzeichen zwischen Artikelnummer und "Werks-Nr." im Text —
        // deshalb auf Ziffern begrenzen statt \S+ (das griffe in den naechsten Wortteil).
        const artikelNr = (k.text.match(/Artikel-?Nr\.?:\s*(\d+)/i) || [])[1] ?? null
        const werksNr = (k.text.match(/Werks-?Nr\.?:\s*(\d+)/i) || [])[1] ?? null
        const netto = (k.text.match(/je\s*([\d.]+,\d{2})\s*€/) || [])[1] ?? null
        const listenpreis = (k.text.match(/Listenpreis:\s*([\d.]+,\d{2})\s*€/) || [])[1] ?? null
        const bewertung = bewerten(begriff, k.text)
        eintrag.kandidaten.push({
          rf_artikelnummer: artikelNr, werksnummer: werksNr,
          ek_netto_stueck: netto ? Number(netto.replace(/\./g, '').replace(',', '.')) : null,
          listenpreis_stueck: listenpreis ? Number(listenpreis.replace(/\./g, '').replace(',', '.')) : null,
          text: k.text, url: k.href, bewertung,
        })
      }
      // Nicht zwingend der erste Suchtreffer ist der beste — nach wenigsten
      // fehlenden Zahlen und Fachbegriff-Treffer neu sortieren, beste Vermutung
      // zuerst (auch fuer die manuelle Pruefliste hilfreich).
      eintrag.kandidaten.sort((a, b) =>
        Number(a.bewertung.gewindeWiderspruch) - Number(b.bewertung.gewindeWiderspruch) ||
        a.bewertung.fehlendeZahlen.length - b.bewertung.fehlendeZahlen.length ||
        Number(b.bewertung.fachTreffer) - Number(a.bewertung.fachTreffer))
      eintrag.kandidaten = eintrag.kandidaten.slice(0, 5) // Top 5 reichen fuer die Pruefliste, spart Platz
      const bester = eintrag.kandidaten[0]
      if (bester) {
        eintrag.einschaetzung = (bester.bewertung.fehlendeZahlen.length === 0 && bester.bewertung.fachTreffer
          && bester.bewertung.zahlenGesamt > 0 && !bester.bewertung.gewindeWiderspruch)
          ? 'sicher' : 'unsicher'
      }
    } catch (e) {
      eintrag.fehler = String(e.message || e).slice(0, 200)
      log(`  FEHLER: ${eintrag.fehler}`)
    }
    ausgabe.push(eintrag)
    // Zwischenstand sichern — bei einem Abbruch nach Stunde X ist bis dahin nichts verloren.
    fs.writeFileSync(outPath, JSON.stringify(ausgabe, null, 1))
  }
} finally {
  await browser.close()
}

const sicher = ausgabe.filter((a) => a.einschaetzung === 'sicher').length
const unsicher = ausgabe.filter((a) => a.einschaetzung === 'unsicher').length
const keinTreffer = ausgabe.filter((a) => a.einschaetzung === 'kein_treffer').length
log(`Fertig: ${ausgabe.length} Artikel — sicher ${sicher}, unsicher ${unsicher}, kein Treffer ${keinTreffer} -> ${outPath}`)
