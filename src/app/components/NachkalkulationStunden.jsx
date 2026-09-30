// Kalkulationsart und Stunden eines nachkalkulierten Auftrags.
//
// Warum das zusammengehoert: Die Altauftraege wurden in zwei Versionen
// kalkuliert — einmal mit ausgewiesenen Montagestunden, einmal mit den
// Montagezeiten im Artikelpreis. Dieselbe Zahl bedeutet in beiden Faellen
// etwas anderes, und bei der zweiten Version gibt es ueberhaupt keine
// Soll-Stunde. Die Oberflaeche muss das zeigen, statt ein leeres Feld
// aussehen zu lassen wie einen Pflegefehler.
//
// Die Bruecke zwischen beiden ist der erreichte Stundensatz: was am Ende je
// geleisteter Stunde uebrig blieb. Der ist ueber beide Versionen hinweg
// vergleichbar, denn gearbeitet wurde so oder so.

import React, { useEffect, useState } from 'react'
import { Box, Text, HStack, VStack, Button, Input, Badge, Flex, Spacer } from '@chakra-ui/react'
import { Clock, Save } from 'lucide-react'
import { setKalkulationsart, setStunden, KALKULATIONSARTEN } from '../../data/api/nachkalkulation.js'

function euro(n) {
  if (n == null) return '—'
  return `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function stunden(n) {
  if (n == null) return '—'
  return `${Number(n).toLocaleString('de-DE', { maximumFractionDigits: 2 })} h`
}

const SELECT_STIL = { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white' }

export default function NachkalkulationStunden({ nk, onAenderung }) {
  const [art, setArt] = useState(nk.kalkulationsart || 'unbekannt')
  const [soll, setSoll] = useState(nk.soll_stunden ?? '')
  const [techniker, setTechniker] = useState(nk.ist_stunden_techniker ?? '')
  const [monteur, setMonteur] = useState(nk.ist_stunden_monteur ?? '')
  const [satzT, setSatzT] = useState(nk.stundensatz_techniker ?? 75)
  const [satzM, setSatzM] = useState(nk.stundensatz_monteur ?? 69)
  const [quelle, setQuelle] = useState(nk.stunden_quelle || '')
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState(null)

  // Nach dem Speichern kommt der Datensatz neu herein — die Felder ziehen nach,
  // damit nicht der alte Tippstand stehen bleibt.
  useEffect(() => {
    setArt(nk.kalkulationsart || 'unbekannt')
    setSoll(nk.soll_stunden ?? '')
    setTechniker(nk.ist_stunden_techniker ?? '')
    setMonteur(nk.ist_stunden_monteur ?? '')
    setSatzT(nk.stundensatz_techniker ?? 75)
    setSatzM(nk.stundensatz_monteur ?? 69)
    setQuelle(nk.stunden_quelle || '')
  }, [nk.id, nk.updated_at])

  const beschreibung = KALKULATIONSARTEN.find((k) => k.wert === art)
  const ohneSollStunden = art === 'zeit_im_artikel'

  const zahl = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))
  const geaendert =
    art !== (nk.kalkulationsart || 'unbekannt') ||
    zahl(soll) !== (nk.soll_stunden != null ? Number(nk.soll_stunden) : null) ||
    zahl(techniker) !== (nk.ist_stunden_techniker != null ? Number(nk.ist_stunden_techniker) : null) ||
    zahl(monteur) !== (nk.ist_stunden_monteur != null ? Number(nk.ist_stunden_monteur) : null) ||
    zahl(satzT) !== Number(nk.stundensatz_techniker ?? 75) ||
    zahl(satzM) !== Number(nk.stundensatz_monteur ?? 69) ||
    (quelle || null) !== (nk.stunden_quelle || null)

  async function speichern() {
    setSpeichert(true); setFehler(null)
    try {
      if (art !== (nk.kalkulationsart || 'unbekannt')) await setKalkulationsart(nk.id, art)
      await setStunden(nk.id, {
        // Bei "Zeit im Artikel" gibt es keine Soll-Stunde. Sie wird beim
        // Umschalten geleert, damit keine Zahl aus einer anderen Kalkulationsart
        // stehen bleibt und spaeter als Vergleichswert gelesen wird.
        sollStunden: ohneSollStunden ? null : zahl(soll),
        istTechniker: zahl(techniker),
        istMonteur: zahl(monteur),
        satzTechniker: zahl(satzT),
        satzMonteur: zahl(satzM),
        quelle: quelle || null,
      })
      onAenderung?.()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
      <Flex align="center" gap={2} mb={3} flexWrap="wrap">
        <Clock size={15} />
        <Text fontWeight="bold" fontSize="sm">Kalkulationsart und Stunden</Text>
        <Spacer />
        {geaendert && (
          <Button size="xs" colorPalette="blue" onClick={speichern} loading={speichert}>
            <Save size={12} /> Speichern
          </Button>
        )}
      </Flex>

      <VStack align="stretch" gap={3}>
        <Box>
          <Text fontSize="xs" color="fg.muted" mb={1}>So wurde dieser Auftrag kalkuliert</Text>
          <select value={art} onChange={(e) => setArt(e.target.value)} style={{ ...SELECT_STIL, minWidth: 240 }}>
            {KALKULATIONSARTEN.map((k) => (
              <option key={k.wert} value={k.wert}>{k.kurz}</option>
            ))}
          </select>
          {beschreibung && art !== 'unbekannt' && (
            <Text fontSize="xs" color="fg.muted" mt={1} maxW="640px">{beschreibung.text}</Text>
          )}
          {art === 'unbekannt' && (
            <Text fontSize="xs" color="orange.600" mt={1}>
              Solange die Art offen ist, lässt sich der Auftrag nicht mit anderen vergleichen.
            </Text>
          )}
        </Box>

        <HStack gap={4} flexWrap="wrap" align="end">
          <Feld titel="Soll-Stunden" hinweis={ohneSollStunden ? 'entfällt bei dieser Art' : 'laut Auftrag'}>
            <Input size="sm" maxW="100px" value={ohneSollStunden ? '' : soll}
              disabled={ohneSollStunden}
              placeholder={ohneSollStunden ? '—' : '0'}
              onChange={(e) => setSoll(e.target.value)} />
          </Feld>
          <Feld titel="Ist Techniker" hinweis={`${euro(satzT)}/h`}>
            <Input size="sm" maxW="100px" value={techniker} placeholder="0"
              onChange={(e) => setTechniker(e.target.value)} />
          </Feld>
          <Feld titel="Ist Monteur" hinweis={`${euro(satzM)}/h`}>
            <Input size="sm" maxW="100px" value={monteur} placeholder="0"
              onChange={(e) => setMonteur(e.target.value)} />
          </Feld>
          <Feld titel="Sätze €/h" hinweis="am Auftrag eingefroren">
            <HStack gap={1}>
              <Input size="sm" maxW="72px" value={satzT} onChange={(e) => setSatzT(e.target.value)} />
              <Input size="sm" maxW="72px" value={satzM} onChange={(e) => setSatzM(e.target.value)} />
            </HStack>
          </Feld>
          <Feld titel="Woher" hinweis="trennt Gemessenes von Geschätztem">
            <select value={quelle} onChange={(e) => setQuelle(e.target.value)} style={SELECT_STIL}>
              <option value="">— offen —</option>
              <option value="zettel">Vom Zettel</option>
              <option value="zeiterfassung">Zeiterfassung</option>
              <option value="schaetzung">Schätzung</option>
            </select>
          </Feld>
        </HStack>

        {nk.ist_stunden != null ? (
          <HStack gap={6} flexWrap="wrap" pt={2} borderTopWidth="1px">
            <Ergebnis titel="Geleistete Stunden" wert={stunden(nk.ist_stunden)} />
            <Ergebnis titel="Lohnkosten zu Sätzen" wert={euro(nk.lohnkosten_ist)} />
            <Ergebnis
              titel="Ergebnis nach Material und Lohn"
              wert={euro(nk.ergebnis)}
              farbe={Number(nk.ergebnis) < 0 ? 'red.600' : 'green.700'}
            />
            <Ergebnis
              titel="Erreicht je Stunde"
              wert={`${euro(nk.erreichter_stundensatz)}/h`}
              farbe={Number(nk.erreichter_stundensatz) < Number(satzM) ? 'red.600' : 'green.700'}
            />
            {nk.stunden_abweichung != null && (
              <Ergebnis
                titel="Gegen Soll"
                wert={`${nk.stunden_abweichung > 0 ? '+' : ''}${stunden(nk.stunden_abweichung)}`}
                farbe={Number(nk.stunden_abweichung) > 0 ? 'red.600' : 'green.700'}
              />
            )}
            {quelle === 'schaetzung' && (
              <Badge size="sm" colorPalette="orange" variant="subtle">geschätzt</Badge>
            )}
          </HStack>
        ) : (
          <Text fontSize="xs" color="fg.muted" pt={2} borderTopWidth="1px">
            Ohne Ist-Stunden bleibt offen, ob der Auftrag getragen hat — „Rest für Lohn und
            Gewinn" sagt nur, wieviel Geld übrig war, nicht ob es gereicht hat.
          </Text>
        )}

        {fehler && <Text fontSize="sm" color="red.600">{fehler}</Text>}
      </VStack>
    </Box>
  )
}

function Feld({ titel, hinweis, children }) {
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted">{titel}</Text>
      {children}
      {hinweis && <Text fontSize="10px" color="fg.muted" mt={0.5}>{hinweis}</Text>}
    </Box>
  )
}

function Ergebnis({ titel, wert, farbe }) {
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted">{titel}</Text>
      <Text fontSize="md" fontWeight="bold" color={farbe}>{wert}</Text>
    </Box>
  )
}
