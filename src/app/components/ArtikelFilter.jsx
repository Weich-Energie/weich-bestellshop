// Gemeinsame Filterleiste fuer die Artikellisten im Admin — Katalog und
// "Nach PDS uebertragen". Bewusst geteilt: beide Seiten filtern denselben
// Stamm, und zwei Fassungen waeren nach der ersten Aenderung verschieden.
//
// Aufteilung: artikelFiltern() ist die reine Regel, ArtikelFilter die
// Bedienung. Wer eine weitere Liste baut, nimmt beides.
import React from 'react'
import { Box, Text, HStack, Button, Input, Spacer } from '@chakra-ui/react'
import { Search, X } from 'lucide-react'

export const LEERER_FILTER = {
  suche: '',
  kategorie: '',
  lieferant: '',
  sicht: '',
  status: '',
}

// Native <select>: bei fuenf Bedienelementen nebeneinander das schmalste,
// und die Seite hat es beim Kategoriefilter immer schon so gemacht.
const AUSWAHL_STIL = { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6 }

export function istGefiltert(filter) {
  return Object.values(filter).some(Boolean)
}

// Lieferantenliste aus dem Bestand, nicht aus der Lieferantentabelle: hier
// zaehlt, was tatsaechlich an Artikeln haengt.
export function lieferantenAus(liste) {
  const s = new Set(liste.map((a) => a.lieferant).filter(Boolean))
  return [...s].sort((a, b) => a.localeCompare(b, 'de'))
}

export function artikelFiltern(liste, filter) {
  const s = (filter.suche || '').trim().toLowerCase()
  return liste.filter((a) => {
    if (filter.kategorie === '(ohne)' && a.kategorie_id) return false
    if (filter.kategorie && filter.kategorie !== '(ohne)' && a.kategorie_id !== filter.kategorie) return false
    if (filter.lieferant === '(ohne)' && a.lieferant) return false
    if (filter.lieferant && filter.lieferant !== '(ohne)' && a.lieferant !== filter.lieferant) return false
    if (filter.status === 'aktiv' && !a.aktiv) return false
    if (filter.status === 'inaktiv' && a.aktiv) return false
    if (filter.sicht === 'bestellbar' && !a.bestellbar) return false
    if (filter.sicht === 'klima' && !a.nachkalkulation_klima) return false
    if (filter.sicht === 'aufmass' && !a.sichtbar_aufmass) return false
    if (filter.sicht === 'nirgends' && (a.bestellbar || a.nachkalkulation_klima || a.sichtbar_aufmass)) return false
    if (!s) return true
    const heuhaufen = [a.name, a.beschreibung, a.lieferant, a.artikelnr, ...(a.tags || []).map((t) => t.name)]
      .filter(Boolean).join(' ').toLowerCase()
    return heuhaufen.includes(s)
  })
}

export default function ArtikelFilter({ filter, setFilter, kategorien = [], lieferanten = [], rechts = null, children = null }) {
  const setze = (feld) => (e) => setFilter({ ...filter, [feld]: e.target.value })

  return (
    <HStack mb={3} gap={2} flexWrap="wrap">
      <HStack borderWidth="1px" borderRadius="md" px={2} bg="gray.50">
        <Search size={14} />
        <Input variant="flushed" size="sm" placeholder="Suche..." value={filter.suche}
          onChange={setze('suche')} border="none" />
      </HStack>
      <select value={filter.kategorie} onChange={setze('kategorie')} style={AUSWAHL_STIL}>
        <option value="">Alle Kategorien</option>
        {kategorien.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        <option value="(ohne)">— ohne Kategorie —</option>
      </select>
      <select value={filter.lieferant} onChange={setze('lieferant')} style={AUSWAHL_STIL}>
        <option value="">Alle Lieferanten</option>
        {lieferanten.map((l) => <option key={l} value={l}>{l}</option>)}
        <option value="(ohne)">— ohne Lieferant —</option>
      </select>
      <select value={filter.sicht} onChange={setze('sicht')} style={AUSWAHL_STIL}>
        <option value="">Jede Sichtbarkeit</option>
        <option value="bestellbar">bestellbar</option>
        <option value="klima">Nachkalkulation Klima</option>
        <option value="aufmass">Aufmaß</option>
        <option value="nirgends">nirgends sichtbar</option>
      </select>
      <select value={filter.status} onChange={setze('status')} style={AUSWAHL_STIL}>
        <option value="">aktiv und inaktiv</option>
        <option value="aktiv">nur aktive</option>
        <option value="inaktiv">nur inaktive</option>
      </select>
      {istGefiltert(filter) && (
        <Button size="sm" variant="ghost" onClick={() => setFilter({ ...LEERER_FILTER })}>
          <X size={13} /> Filter zurücksetzen
        </Button>
      )}
      {children}
      <Spacer />
      {rechts && <Box>{rechts}</Box>}
    </HStack>
  )
}

// Leiste, die erscheint sobald etwas ausgewaehlt ist. Gleich in beiden Listen.
export function AuswahlLeiste({ anzahl, arbeitet, onAusblenden, onEinblenden, onLoeschen, onAufheben, extra = null }) {
  if (!anzahl) return null
  return (
    <HStack mb={3} p={3} borderWidth="1px" borderColor="blue.200" bg="blue.50" borderRadius="md"
      gap={2} flexWrap="wrap">
      <Text fontSize="sm" fontWeight="medium">{anzahl} ausgewählt</Text>
      <Spacer />
      {extra}
      {onAusblenden && <Button size="xs" variant="outline" disabled={arbeitet} onClick={onAusblenden}>Ausblenden</Button>}
      {onEinblenden && <Button size="xs" variant="outline" disabled={arbeitet} onClick={onEinblenden}>Einblenden</Button>}
      {onLoeschen && <Button size="xs" colorPalette="red" disabled={arbeitet} onClick={onLoeschen}>Löschen</Button>}
      <Button size="xs" variant="ghost" onClick={onAufheben}>Auswahl aufheben</Button>
    </HStack>
  )
}
