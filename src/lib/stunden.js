// Stunden vom Zettel: was davon auf den Auftrag gehoert.
//
// Ein Wochenbericht fuehrt oft mehrere Baustellen; das Buero hebt die Zeilen
// des Auftrags mit Textmarker hervor (Schmid Hahnbach, 02.10.2026: 12 Zeilen,
// 74 Stunden auf dem Blatt, davon vier markierte Zeilen fuer diesen Auftrag).
// Ist etwas markiert, zaehlt nur das — sonst gingen die Stunden fremder
// Baustellen auf diesen Auftrag.

// Stunden als Zahl. Die KI liefert sie meist als Zahl, gelegentlich aber als
// Text mit deutschem Komma ("8,5") — Number("8,5") waere NaN, und die Summe
// zeigte "NaN Stunden". Nicht Lesbares zaehlt als 0.
export function stundenZahl(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function irgendwasMarkiert(zeilen) {
  return (Array.isArray(zeilen) ? zeilen : []).some((z) => z?.markiert === true)
}

export function zaehltMit(zeile, markiertGenutzt) {
  return !markiertGenutzt || zeile?.markiert === true
}

export function stundenSumme(zeilen) {
  const liste = Array.isArray(zeilen) ? zeilen : []
  const markiert = irgendwasMarkiert(liste)
  return liste
    .filter((z) => zaehltMit(z, markiert))
    .reduce((s, z) => s + stundenZahl(z?.stunden), 0)
}

// Vorbelegung der Auswahl je Zeile: 'techniker' | 'monteur' | 'nicht'.
// Nicht markierte Zeilen eines markierten Blatts werden gar nicht gebucht;
// die Rolle steht selten auf dem Zettel, dann ist Monteur vorbelegt.
export function vorbelegteRolle(zeile, markiertGenutzt) {
  if (!zaehltMit(zeile, markiertGenutzt)) return 'nicht'
  return zeile?.rolle === 'techniker' ? 'techniker' : 'monteur'
}
