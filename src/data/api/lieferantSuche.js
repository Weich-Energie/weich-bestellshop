// Artikelsuche in einem Lieferantenshop, aus der Oberfläche heraus.
//
// Gebraucht beim Regieaufmass: eine gelesene Zeile hat keinen Artikel im
// Katalog, und statt den Shop in einem anderen Fenster zu durchsuchen und
// abzutippen, wird hier gesucht, ausgewählt und angelegt.
//
// Der Weg geht über die Edge Function `lieferant-suche` zum VPS, weil die
// Shops einen Login verlangen und der angemeldete Browser dort läuft. Rein
// lesend — angelegt wird erst nach Auswahl durch einen Menschen.

import { supabase } from '../../supabaseClient.js'
import { createArtikel } from './artikel.js'

// Welche Shops abgefragt werden können, und woran ihre Artikelnummern zu
// erkennen sind. Der Vorschlag spart den häufigsten Klick: die Nummer auf dem
// Zettel verrät meist schon, wo der Artikel herkommt.
export const LIEFERANTEN = [
  { slug: 'gut', name: 'GUT', muster: /^[A-Z]{2,}[A-Z0-9]*$/ },
  { slug: 'fega-schmitt', name: 'FEGA & Schmitt', muster: /^\d{6,7}$/ },
  { slug: 'r-f', name: 'R+F', muster: /^\d{13}$/ },
  { slug: 'frigotechnik', name: 'Frigotechnik', muster: null },
  { slug: 'linum', name: 'Linum', muster: /^[A-Z]{3}-\d{4}-\d{3}$/ },
  { slug: 'colons', name: 'Colons', muster: null },
  { slug: 'schiessl-kaelte', name: 'Schiessl Kälte', muster: null },
]

/** Rät den Lieferanten aus dem Format der Artikelnummer. Nur ein Vorschlag —
 *  die Muster überschneiden sich, und ein Monteur schreibt auch mal die
 *  Nummer eines anderen Systems auf. */
export function lieferantRaten(artikelnr) {
  const nr = String(artikelnr || '').trim().toUpperCase()
  if (!nr) return null
  for (const l of LIEFERANTEN) {
    if (l.muster && l.muster.test(nr)) return l.slug
  }
  return null
}

export async function sucheBeiLieferant({ lieferant, begriff, treffer = 8 }) {
  const { data, error } = await supabase.functions.invoke('lieferant-suche', {
    body: { lieferant, begriff, treffer },
  })
  if (error) {
    // Der Text der Function steckt im Rumpf, nicht in error.message — ohne
    // das liest sich jeder Fehler als "non-2xx status code".
    let text = error.message
    try { text = (await error.context?.json?.())?.error || text } catch { /* Rohtext */ }
    throw new Error(text)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

/** Legt einen gefundenen Artikel im Shop an.
 *
 *  Nicht bestellbar: der Bestellshop führt C-Teile fürs Lager, diese Artikel
 *  entstehen aus der Nachkalkulation. Sichtbar im Aufmaß, damit der Stamm der
 *  Aufmaß-App mitwächst — das ist der eigentliche Nebennutzen des ganzen
 *  Vorgangs.
 *
 *  `preis_netto` kommt aus der Netto-Spalte des Shops, nie aus der Brutto- oder
 *  Listenspalte. Bei FEGA stehen beide nebeneinander und meinen nicht die
 *  Mehrwertsteuer, sondern Einkaufs- gegen Bruttolistenpreis.
 */
export async function artikelAusTreffer(treffer, { lieferantName, lieferantId = null, kategorieId = null, einheit = null, preisNetto = null }) {
  if (!treffer?.artikelnr) throw new Error('Der Treffer hat keine Artikelnummer')
  if (!treffer?.name) throw new Error('Der Treffer hat keine Bezeichnung — bitte im Shop nachsehen')

  const beschreibung = [
    treffer.hersteller ? `Hersteller ${treffer.hersteller}.` : null,
    treffer.listenpreis != null
      ? `Bruttolistenpreis ${Number(treffer.listenpreis).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €.`
      : null,
    treffer.einheit ? `Preiseinheit laut Shop: ${treffer.einheit}.` : null,
  ].filter(Boolean).join(' ') || null

  return createArtikel({
    artikelnr: treffer.artikelnr,
    name: treffer.name,
    beschreibung,
    // Die Einheit kommt aus der Oberfläche, nicht aus dem Shop: ob eine Rolle
    // als Rolle oder in Metern geführt wird, entscheidet der Mensch. Der Shop
    // schreibt beides gleich.
    einheit: einheit || null,
    preis_netto: preisNetto != null ? Number(preisNetto) : (treffer.preis_netto ?? null),
    lieferant: lieferantName || null,
    lieferant_id: lieferantId,
    kategorie_id: kategorieId,
    preis_quelle: 'shop-suche',
    preis_stand: new Date().toISOString().slice(0, 10),
    aktiv: true,
    bestellbar: false,
    nachkalkulation_klima: true,
    sichtbar_aufmass: true,
  })
}
