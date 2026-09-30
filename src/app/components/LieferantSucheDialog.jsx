// "Bei <Lieferant> suchen" — für eine Aufmaßzeile, die keinen Artikel im
// Katalog hat.
//
// Der Ablauf ist bewusst zweistufig: die App sucht und schlägt vor, der
// Mensch bestätigt. Drei Dinge kann keine Maschine entscheiden, und alle drei
// sind an einem einzigen Montagebericht schon vorgekommen:
//
//  - Ob die Nummer auf dem Zettel zum eingebauten Teil gehört. Einmal stand
//    dort ein FI-Schalter Typ A, eingebaut war ein Typ B — Faktor dreizehn.
//  - Ob ein Artikel als Rolle oder in Metern geführt wird. Der Shop schreibt
//    beides gleich, die Nachkalkulation rechnet sonst das Hundertfache.
//  - Ob "Profipress" wirklich Profipress heißt oder Prestabo gemeint ist.
//
// Deshalb steht hier alles nebeneinander: Trefferliste, Einheit, Preis — und
// erst dann der Knopf, der anlegt.

import React, { useEffect, useMemo, useState } from 'react'
import {
  Box, Text, HStack, VStack, Button, Input, Badge, Spinner, Flex, Spacer, Table, IconButton,
} from '@chakra-ui/react'
import { Search, Check, X, ExternalLink, AlertTriangle } from 'lucide-react'
import { LIEFERANTEN, lieferantRaten, sucheBeiLieferant, artikelAusTreffer } from '../../data/api/lieferantSuche.js'

const SELECT_STIL = { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white' }

function euro(n) {
  if (n == null) return '—'
  return `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export default function LieferantSucheDialog({ zeile, lieferanten = [], kategorien = [], onFertig, onAbbrechen }) {
  const geraten = useMemo(() => lieferantRaten(zeile.roh_artikelnr), [zeile.roh_artikelnr])
  const [slug, setSlug] = useState(geraten || 'gut')
  const [begriff, setBegriff] = useState(zeile.roh_artikelnr || zeile.roh_bezeichnung || '')
  const [laeuft, setLaeuft] = useState(false)
  const [ergebnis, setErgebnis] = useState(null)
  const [fehler, setFehler] = useState(null)
  const [gewaehlt, setGewaehlt] = useState(null)
  const [legtAn, setLegtAn] = useState(false)

  // Die Einheit gehört dem Menschen, nicht dem Shop: eine 100-m-Rolle steht
  // dort genauso da wie ein Meterpreis. Vorbelegt wird mit dem, was auf dem
  // Zettel stand — der Monteur hat schließlich notiert, was er verbraucht hat.
  const [einheit, setEinheit] = useState(zeile.roh_einheit || 'Stück')
  const [preis, setPreis] = useState('')
  const [kategorieId, setKategorieId] = useState('')

  useEffect(() => {
    if (!gewaehlt) return
    setPreis(gewaehlt.preis_netto != null ? String(gewaehlt.preis_netto) : '')
  }, [gewaehlt])

  async function suchen() {
    setLaeuft(true); setFehler(null); setErgebnis(null); setGewaehlt(null)
    try {
      const a = await sucheBeiLieferant({ lieferant: slug, begriff: begriff.trim() })
      setErgebnis(a)
      // Ein exakter Nummerntreffer ist der Regelfall — gleich vorwählen, aber
      // nicht anlegen.
      const exakt = (a.treffer || []).find((t) => t.exakt)
      if (exakt) setGewaehlt(exakt)
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaeuft(false)
    }
  }

  async function anlegen() {
    if (!gewaehlt) return
    setLegtAn(true); setFehler(null)
    try {
      const lief = lieferanten.find((l) => l.slug === slug)
      const artikel = await artikelAusTreffer(gewaehlt, {
        lieferantName: LIEFERANTEN.find((l) => l.slug === slug)?.name ?? slug,
        lieferantId: lief?.id ?? null,
        kategorieId: kategorieId || null,
        einheit,
        preisNetto: preis === '' ? null : Number(String(preis).replace(',', '.')),
      })
      onFertig?.(artikel)
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLegtAn(false)
    }
  }

  const mengeAufZettel = Number(zeile.roh_menge || 0)
  // Ein Gebinde- oder Rollenpreis neben einer kleinen Menge ist das Muster,
  // das schon zweimal zum Hundertfachen geführt hat. Beim Zusammentreffen
  // wird gewarnt, nicht gerechnet — umrechnen muss, wer die Ware kennt.
  const verdaechtig = gewaehlt
    && gewaehlt.preis_netto != null
    && /\b(100|200|500|50|25|10)\b|ROL|RG|Ring|Stange/i.test(`${gewaehlt.name ?? ''} ${gewaehlt.einheit ?? ''}`)
    && mengeAufZettel > 0 && mengeAufZettel < 20

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} mt={2} bg="blue.50" borderColor="blue.200">
      <Flex align="center" gap={2} mb={2} flexWrap="wrap">
        <Search size={14} />
        <Text fontSize="sm" fontWeight="medium">Artikel im Lieferantenshop suchen</Text>
        <Spacer />
        <IconButton size="xs" variant="ghost" aria-label="Abbrechen" onClick={onAbbrechen}>
          <X size={14} />
        </IconButton>
      </Flex>

      <Text fontSize="xs" color="fg.muted" mb={2}>
        Vom Zettel: <b>{zeile.roh_bezeichnung || '—'}</b>
        {zeile.roh_artikelnr && <> · Nummer <b>{zeile.roh_artikelnr}</b></>}
        {mengeAufZettel > 0 && <> · Menge <b>{mengeAufZettel.toLocaleString('de-DE')} {zeile.roh_einheit || ''}</b></>}
      </Text>

      <HStack gap={2} mb={2} flexWrap="wrap">
        <select value={slug} onChange={(e) => setSlug(e.target.value)} style={SELECT_STIL}>
          {LIEFERANTEN.map((l) => (
            <option key={l.slug} value={l.slug}>{l.name}{geraten === l.slug ? ' (passt zur Nummer)' : ''}</option>
          ))}
        </select>
        <Input size="sm" maxW="260px" value={begriff} bg="white"
          placeholder="Nummer oder Bezeichnung"
          onChange={(e) => setBegriff(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && suchen()} />
        <Button size="sm" colorPalette="blue" onClick={suchen} loading={laeuft}
          loadingText="sucht im Shop…" disabled={begriff.trim().length < 3}>
          <Search size={13} /> Suchen
        </Button>
      </HStack>

      {laeuft && (
        <Text fontSize="xs" color="fg.muted">
          Der Shop wird über den angemeldeten Browser abgefragt — das dauert einige Sekunden.
        </Text>
      )}
      {fehler && <Text fontSize="sm" color="red.600" mb={2}>{fehler}</Text>}

      {ergebnis && (
        <Box bg="white" borderWidth="1px" borderRadius="md" overflowX="auto" mb={2}>
          {ergebnis.treffer.length === 0 ? (
            <Text fontSize="sm" color="fg.muted" p={3}>
              Nichts gefunden. Anderen Lieferanten wählen, oder mit der Bezeichnung statt der
              Nummer suchen.
            </Text>
          ) : (
            <Table.Root variant="line" size="sm" minW="560px">
              <Table.Body>
                {ergebnis.treffer.map((t, i) => (
                  <Table.Row key={i} bg={gewaehlt === t ? 'blue.50' : undefined}
                    cursor="pointer" onClick={() => setGewaehlt(t)}>
                    <Table.Cell>
                      <HStack gap={2}>
                        <Text fontSize="sm" fontWeight={gewaehlt === t ? 'bold' : 'normal'}>
                          {t.artikelnr ?? '—'}
                        </Text>
                        {t.exakt && <Badge size="sm" colorPalette="green" variant="subtle">Nummer stimmt</Badge>}
                      </HStack>
                      <Text fontSize="xs" color="fg.muted">{t.name ?? 'ohne Bezeichnung'}</Text>
                    </Table.Cell>
                    <Table.Cell textAlign="right">
                      <Text fontSize="sm">{euro(t.preis_netto)}</Text>
                      {t.listenpreis != null && (
                        <Text fontSize="10px" color="fg.muted">Liste {euro(t.listenpreis)}</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell><Text fontSize="xs" color="fg.muted">{t.einheit ?? ''}</Text></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      )}

      {gewaehlt && (
        <Box bg="white" borderWidth="1px" borderRadius="md" p={3}>
          <Text fontSize="sm" fontWeight="medium" mb={2}>{gewaehlt.name}</Text>

          {verdaechtig && (
            <HStack gap={1} color="orange.700" mb={2} align="start">
              <AlertTriangle size={13} />
              <Text fontSize="xs">
                Der Shop-Preis sieht nach Gebinde oder Rolle aus, auf dem Zettel stehen aber nur
                {' '}{mengeAufZettel.toLocaleString('de-DE')} {zeile.roh_einheit || 'Stück'}. Wenn das ein
                Rollenpreis ist, gehört hier der Preis je Meter oder je Stück hin — sonst rechnet
                die Nachkalkulation ein Vielfaches.
              </Text>
            </HStack>
          )}

          <HStack gap={3} flexWrap="wrap" align="end">
            <Box>
              <Text fontSize="xs" color="fg.muted">Einheit im Stamm</Text>
              <select value={einheit} onChange={(e) => setEinheit(e.target.value)} style={SELECT_STIL}>
                <option value="Stück">Stück</option>
                <option value="Meter">Meter</option>
                <option value="Rolle">Rolle</option>
                <option value="Packung">Packung</option>
                <option value="Liter">Liter</option>
                <option value="Kilogramm">Kilogramm</option>
              </select>
            </Box>
            <Box>
              <Text fontSize="xs" color="fg.muted">Einkaufspreis je Einheit</Text>
              <Input size="sm" maxW="120px" value={preis} onChange={(e) => setPreis(e.target.value)} />
              <Text fontSize="10px" color="fg.muted">Shop: {euro(gewaehlt.preis_netto)} {gewaehlt.einheit ?? ''}</Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="fg.muted">Kategorie</Text>
              <select value={kategorieId} onChange={(e) => setKategorieId(e.target.value)} style={SELECT_STIL}>
                <option value="">— ohne —</option>
                {kategorien.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </Box>
            <Spacer />
            <Button size="sm" colorPalette="green" onClick={anlegen} loading={legtAn}>
              <Check size={14} /> Anlegen und zuordnen
            </Button>
          </HStack>

          {ergebnis?.url && (
            <Text fontSize="10px" color="fg.muted" mt={2}>
              <a href={ergebnis.url} target="_blank" rel="noopener noreferrer">
                Suchergebnis im Shop ansehen <ExternalLink size={9} style={{ display: 'inline' }} />
              </a>
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
}
