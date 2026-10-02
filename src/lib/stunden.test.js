import { describe, it, expect } from 'vitest'
import { stundenSumme, vorbelegteRolle, irgendwasMarkiert, stundenZahl } from './stunden.js'

// Nachgebaut nach dem Wochenbericht KW 25 (Schmid Hahnbach, 02.10.2026):
// zwoelf Zeilen, nur die vier Zeilen "Schmid Christopher (Hahnbach)" markiert.
const wochenbericht = [
  { name: 'Schmid Rita Erika', stunden: 9, markiert: false },
  { name: 'Schmid Rita Erika', stunden: 8, markiert: false },
  { name: 'Koch Hahnbach', stunden: 5, markiert: false },
  { name: 'Koch Hahnbach', stunden: 5, markiert: false },
  { name: 'Koch Hahnbach', stunden: 2, markiert: false },
  { name: 'Beuer-Peschke', stunden: 8, markiert: false },
  { name: 'Schmid Christopher (Hahnbach)', stunden: 8.5, markiert: true },
  { name: 'Schmid Christopher (Hahnbach)', stunden: 8, markiert: true },
  { name: 'Schmid Christopher (Hahnbach)', stunden: 3, markiert: true },
  { name: 'Göth K\'bruck', stunden: 8, markiert: false },
  { name: 'Schmid Christopher (Hahnbach)', stunden: 2, markiert: true },
  { name: 'Schmid Florian', stunden: 8, markiert: false },
]

describe('stundenSumme', () => {
  it('zaehlt bei markiertem Blatt nur die markierten Zeilen', () => {
    expect(stundenSumme(wochenbericht)).toBe(21.5)
  })

  it('ohne Markierung zaehlt alles (gewoehnlicher Stundenzettel)', () => {
    expect(stundenSumme([{ stunden: 8, markiert: null }, { stunden: 6 }])).toBe(14)
  })

  it('alte Lesungen ohne Feld "markiert" bleiben wie bisher', () => {
    expect(stundenSumme([{ stunden: 8 }, { stunden: 4 }])).toBe(12)
  })

  it('kaputte Eingaben werfen nicht', () => {
    expect(stundenSumme(null)).toBe(0)
    expect(stundenSumme([{ stunden: 'x' }, null])).toBe(0)
  })
})

describe('vorbelegteRolle', () => {
  const markiert = irgendwasMarkiert(wochenbericht)

  it('fremde Baustelle wird nicht gebucht', () => {
    expect(vorbelegteRolle(wochenbericht[0], markiert)).toBe('nicht')
  })

  it('markierte Zeile ist Monteur, solange keine Rolle auf dem Blatt steht', () => {
    expect(vorbelegteRolle(wochenbericht[6], markiert)).toBe('monteur')
  })

  it('Rolle vom Blatt gewinnt', () => {
    expect(vorbelegteRolle({ stunden: 4, rolle: 'techniker', markiert: true }, true)).toBe('techniker')
  })

  it('ohne Markierung auf dem Blatt wird jede Zeile gebucht', () => {
    expect(vorbelegteRolle({ stunden: 4 }, false)).toBe('monteur')
  })
})

describe('stundenZahl', () => {
  it('deutsches Komma als Text', () => {
    expect(stundenZahl('8,5')).toBe(8.5)
    expect(stundenSumme([{ stunden: '8,5' }, { stunden: 2 }])).toBe(10.5)
  })

  it('Unlesbares zaehlt als 0', () => {
    expect(stundenZahl('x')).toBe(0)
    expect(stundenZahl(undefined)).toBe(0)
    expect(stundenZahl(NaN)).toBe(0)
  })
})
