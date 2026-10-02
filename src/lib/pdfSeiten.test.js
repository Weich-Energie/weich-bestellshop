import { describe, it, expect } from 'vitest'
import { anteilDunkel, istLeer, seitenName, hinweisText } from './pdfSeiten.js'

// RGBA-Puffer mit `n` Pixeln, davon `dunkel` schwarz, der Rest weiss.
function puffer(n, dunkel, grau = 255) {
  const p = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    const v = i < dunkel ? 0 : grau
    p[i * 4] = v; p[i * 4 + 1] = v; p[i * 4 + 2] = v; p[i * 4 + 3] = 255
  }
  return p
}

describe('Leerseiten-Erkennung', () => {
  it('weisse Seite ist leer', () => {
    expect(anteilDunkel(puffer(10000, 0))).toBe(0)
    expect(istLeer(puffer(10000, 0))).toBe(true)
  })

  it('heller Scanner-Grauschleier zaehlt nicht als Inhalt', () => {
    // Rueckseiten aus dem Duplex-Scan sind nie reinweiss
    expect(istLeer(puffer(10000, 0, 200))).toBe(true)
  })

  it('duennste echte Inhaltsseite (2,47 % Tinte) ist nicht leer', () => {
    expect(istLeer(puffer(10000, 247))).toBe(false)
  })

  it('Grenze liegt bei 0,3 %', () => {
    expect(istLeer(puffer(10000, 29))).toBe(true)
    expect(istLeer(puffer(10000, 31))).toBe(false)
  })

  it('leerer Puffer ist leer und wirft nicht', () => {
    expect(istLeer(new Uint8ClampedArray(0))).toBe(true)
  })
})

describe('Seitenname', () => {
  it('haengt die Seite zweistellig an und macht ein JPEG daraus', () => {
    expect(seitenName('2504_001.pdf', 3, 18)).toBe('2504_001 · Seite 03.jpg')
  })

  it('dreistellig bei mehr als 99 Seiten', () => {
    expect(seitenName('stapel.PDF', 7, 120)).toBe('stapel · Seite 007.jpg')
  })

  it('ohne Namen', () => {
    expect(seitenName('', 1, 2)).toBe('Scan · Seite 01.jpg')
  })
})

describe('Hinweistext', () => {
  it('nennt nur zerlegte Dateien', () => {
    expect(hinweisText([
      { name: 'foto.jpg', zerlegt: false, seiten: 1, leer: 0 },
      { name: '2504_001.pdf', zerlegt: true, seiten: 18, leer: 4 },
    ])).toBe('2504_001.pdf: 18 Seiten, 14 hochgeladen, 4 leere übersprungen')
  })

  it('ohne Leerseiten kein Nachsatz', () => {
    expect(hinweisText([{ name: 'a.pdf', zerlegt: true, seiten: 3, leer: 0 }]))
      .toBe('a.pdf: 3 Seiten, 3 hochgeladen')
  })

  it('nichts zerlegt -> leer', () => {
    expect(hinweisText([{ name: 'a.jpg', zerlegt: false, seiten: 1, leer: 0 }])).toBe('')
  })
})
