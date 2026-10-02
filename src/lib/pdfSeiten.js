// Gescannte Zettel-PDFs vor dem Hochladen in Einzelseiten zerlegen.
//
// Warum: shop-ai liest jede Datei in EINEM KI-Aufruf. Ein Kopierer-Scan mit 18
// Seiten (02.10.2026, Schmid Hahnbach) braucht eine Antwort, die laenger ist als
// das Limit — sie bricht nach gut zwei Minuten ab, und zu sehen ist nur
// "Edge Function returned a non-2xx status code". Eine Seite je Aufruf liest in
// 10 bis 20 Sekunden und bekommt ihre eigene Blattart (Material, Stunden).
//
// Zerlegt wird NUR ein Scan, also Seiten, die bloss ein Bild sind. Ein digitales
// PDF (Reonic-Angebot) hat Schrift und gehoert als Ganzes gelesen: Positionen
// laufen ueber Seiten, und die Summe steht auf der letzten.
//
// Leere Seiten fallen weg: ein Duplex-Scan bringt die Rueckseiten mit, und jede
// waere ein bezahlter KI-Aufruf ohne Ergebnis.

const DPI = 150 //               reicht fuer Handschrift; A4 = 1240 x 1754 px
const MAX_KANTE = 2000 //        groessere Vorlagen (A3) werden darauf begrenzt
const JPEG_QUALITAET = 0.85
const PRUEF_BREITE = 300 //      Leerseiten-Pruefung auf verkleinerter Kopie
const DUNKEL = 160 //            Helligkeit 0-255, darunter zaehlt ein Pixel als Tinte
// Gemessen am Scan vom 02.10.2026: leere Rueckseiten 0,00 %, die duennste
// Inhaltsseite (eine Zeile Vordruck, drei Striche Handschrift) 2,47 %.
const LEER_SCHWELLE = 0.003

// Anteil dunkler Pixel in RGBA-Daten (wie aus getImageData).
export function anteilDunkel(rgba) {
  const pixel = Math.floor(rgba.length / 4)
  if (!pixel) return 0
  let dunkel = 0
  for (let i = 0; i < pixel * 4; i += 4) {
    // Luminanz nach ITU-R BT.601, ganzzahlig genaehert
    const hell = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000
    if (hell < DUNKEL) dunkel += 1
  }
  return dunkel / pixel
}

export function istLeer(rgba) {
  return anteilDunkel(rgba) < LEER_SCHWELLE
}

// "2504_001.pdf", Seite 3 von 18 -> "2504_001 · Seite 03.jpg"
// Zweistellig, damit die Liste in Seitenreihenfolge sortiert.
export function seitenName(originalName, seite, seitenGesamt) {
  const basis = String(originalName || 'Scan').replace(/\.pdf$/i, '')
  const stellen = String(seitenGesamt).length
  return `${basis} · Seite ${String(seite).padStart(Math.max(2, stellen), '0')}.jpg`
}

// Kurzer Satz fuer die Oberflaeche, was mit einer Auswahl passiert ist.
export function hinweisText(berichte) {
  return berichte
    .filter((b) => b.zerlegt)
    .map((b) => `${b.name}: ${b.seiten} Seiten, ${b.seiten - b.leer} hochgeladen` +
      (b.leer ? `, ${b.leer} leere übersprungen` : ''))
    .join(' · ')
}

function istPdf(datei) {
  return datei.type === 'application/pdf' || /\.pdf$/i.test(datei.name || '')
}

let pdfjsGeladen = null
// Erst laden, wenn wirklich ein PDF kommt — das Fotografieren auf der
// Baustelle soll das Megabyte pdf.js nicht mitbezahlen.
async function ladePdfjs() {
  if (!pdfjsGeladen) {
    pdfjsGeladen = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjs
    })()
  }
  return pdfjsGeladen
}

// Eine Seite ist ein Scan, wenn sie Bilder zeigt und keine sichtbare Schrift.
// Unsichtbare Schrift (Textrendermodus 3) ist die OCR-Ebene mancher Kopierer
// ueber dem Bild — sie macht aus dem Scan kein digitales Dokument.
export async function istScanSeite(page, OPS) {
  const liste = await page.getOperatorList()
  const textOps = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText])
  const bildOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject])
  let modus = 0
  let sichtbareSchrift = 0
  let bilder = 0
  for (let i = 0; i < liste.fnArray.length; i++) {
    const fn = liste.fnArray[i]
    if (fn === OPS.setTextRenderingMode) modus = liste.argsArray[i]?.[0] ?? 0
    else if (textOps.has(fn) && modus !== 3) sichtbareSchrift += 1
    else if (bildOps.has(fn)) bilder += 1
  }
  return bilder > 0 && sichtbareSchrift === 0
}

function zuBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Seite liess sich nicht als Bild speichern'))),
      'image/jpeg', JPEG_QUALITAET)
  })
}

function pruefPixel(canvas) {
  const faktor = PRUEF_BREITE / canvas.width
  const klein = document.createElement('canvas')
  klein.width = PRUEF_BREITE
  klein.height = Math.max(1, Math.round(canvas.height * faktor))
  const ctx = klein.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(canvas, 0, 0, klein.width, klein.height)
  const daten = ctx.getImageData(0, 0, klein.width, klein.height).data
  klein.width = 0
  klein.height = 0
  return daten
}

// Liefert die Dateien, die tatsaechlich hochgeladen werden, und einen Bericht.
// Alles, was nicht eindeutig ein mehrseitiger Scan ist, geht unveraendert
// durch — im Zweifel lieber das Original als eine falsch zerlegte Datei.
export async function zerlegeFuerUpload(datei) {
  const unveraendert = { dateien: [datei], bericht: { name: datei.name, zerlegt: false, seiten: 1, leer: 0 } }
  if (!istPdf(datei)) return unveraendert

  // destroy() sitzt in pdf.js 6 an der Ladeaufgabe, nicht am Dokument.
  let pdfjs, aufgabe, pdf
  try {
    pdfjs = await ladePdfjs()
    aufgabe = pdfjs.getDocument({
      data: new Uint8Array(await datei.arrayBuffer()),
      // Ohne die Decoder (JBIG2 vom Kopierer, JPEG 2000) laesst pdf.js die
      // Scanbilder weg — jede Seite waere weiss. Ausgeliefert von vite.config.js.
      wasmUrl: `${import.meta.env.BASE_URL}pdfjs-wasm/`,
    })
    pdf = await aufgabe.promise
  } catch {
    aufgabe?.destroy()
    return unveraendert // unlesbar — der Server versucht es und meldet sich
  }

  try {
    if (pdf.numPages <= 1) return unveraendert

    // Die ersten Seiten reichen fuer die Entscheidung Scan oder Dokument.
    const proben = Math.min(3, pdf.numPages)
    for (let n = 1; n <= proben; n++) {
      const page = await pdf.getPage(n)
      const scan = await istScanSeite(page, pdfjs.OPS)
      page.cleanup()
      if (!scan) return unveraendert
    }

    const dateien = []
    let leer = 0
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const eins = page.getViewport({ scale: 1 })
      let scale = DPI / 72
      const kante = Math.max(eins.width, eins.height) * scale
      if (kante > MAX_KANTE) scale *= MAX_KANTE / kante
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      // intent 'print': ohne requestAnimationFrame. Sonst haelt das Zerlegen an,
      // sobald der Tab im Hintergrund ist oder das Telefon den Bildschirm sperrt.
      await page.render({ canvas, viewport, intent: 'print', background: 'rgb(255,255,255)' }).promise

      if (istLeer(pruefPixel(canvas))) {
        leer += 1
      } else {
        const blob = await zuBlob(canvas)
        dateien.push(new File([blob], seitenName(datei.name, n, pdf.numPages), { type: 'image/jpeg' }))
      }
      page.cleanup()
      canvas.width = 0 // Speicher sofort freigeben — Telefone haben wenig davon
      canvas.height = 0
    }

    // Nur Leerseiten? Dann stimmt die Erkennung nicht — lieber das Original.
    if (!dateien.length) return unveraendert
    return { dateien, bericht: { name: datei.name, zerlegt: true, seiten: pdf.numPages, leer } }
  } finally {
    await aufgabe.destroy()
  }
}

// Fuer eine ganze Auswahl im Datei-Dialog: Reihenfolge bleibt erhalten.
export async function bereiteZettelVor(dateien) {
  const ergebnis = []
  const berichte = []
  for (const d of dateien) {
    const { dateien: teile, bericht } = await zerlegeFuerUpload(d)
    ergebnis.push(...teile)
    berichte.push(bericht)
  }
  return { dateien: ergebnis, hinweis: hinweisText(berichte) }
}
