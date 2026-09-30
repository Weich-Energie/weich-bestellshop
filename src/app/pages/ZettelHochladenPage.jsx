// Zettel hochladen — die Handy-Seite.
//
// Warum eigen: Die Nachkalkulationsseite ist auf 680 bis 860 Pixel Mindestbreite
// gebaut und auf dem Telefon nicht zu bedienen. Erfassen und Pruefen gehoeren
// deshalb auseinander — fotografiert wird auf der Baustelle, durchgegangen wird
// am Rechner, wo man beim Nachkalkulieren ohnehin sitzt.
//
// Diese Seite kann genau eins: Auftrag waehlen, fotografieren, hochladen. Die
// Bilder werden gelesen und warten dann auf die Bestaetigung am Rechner.

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Heading, Text, VStack, HStack, Button, Input, Badge, Spinner, Flex,
} from '@chakra-ui/react'
import { Camera, Check, Plus, ArrowLeft, Search, Download } from 'lucide-react'
import { listNachkalkulationen } from '../../data/api/nachkalkulation.js'
import { sucheAuftraege, importiereSoll } from '../../data/api/pdsSync.js'
import { uploadAufmassFoto, leseAufmassFoto, neueNachkalkulation } from '../../data/api/aufmassFoto.js'

const ART_TEXT = {
  material: 'Materialliste', stunden: 'Stundenzettel', angebot: 'Angebot', unbekannt: 'Art unklar',
}

export default function ZettelHochladenPage() {
  const [gewaehlt, setGewaehlt] = useState(null)
  const { data: liste = [], isLoading, refetch } = useQuery({
    queryKey: ['nachkalkulationen'],
    queryFn: listNachkalkulationen,
  })

  if (gewaehlt) {
    return <Hochladen nk={gewaehlt} onZurueck={() => { setGewaehlt(null); refetch() }} />
  }

  return (
    <Box maxW="560px" mx="auto">
      <Heading size="md" mb={1}>Zettel hochladen</Heading>
      <Text fontSize="sm" color="fg.muted" mb={4}>
        Aufmaß, Stundenzettel oder Angebot fotografieren. Durchgegangen wird später am Rechner.
      </Text>

      {isLoading && <Flex justify="center" p={8}><Spinner /></Flex>}

      <VStack align="stretch" gap={2}>
        {liste.map((n) => (
          <Box key={n.id} borderWidth="1px" borderRadius="lg" p={3} bg="white"
            cursor="pointer" _active={{ bg: 'gray.50' }} onClick={() => setGewaehlt(n)}>
            <Text fontSize="sm" fontWeight="medium">{n.bezeichnung}</Text>
            <HStack gap={2} mt={1}>
              <Text fontSize="xs" color="fg.muted">{n.pds_vorgangs_nummer}</Text>
              <Badge size="sm" variant="subtle"
                colorPalette={n.status === 'geprueft' ? 'green' : 'gray'}>{n.status}</Badge>
            </HStack>
          </Box>
        ))}
      </VStack>

      <AusPds vorhanden={liste} onAngelegt={refetch} onOeffnen={setGewaehlt} />
      <NeueBaustelle onAngelegt={refetch} />
    </Box>
  )
}

// Die PDS-Akte gibt es meist schon (Patrick, 30.09.2026) — die Nachkalkulation
// dazu aber noch nicht. Ohne diesen Schritt müsste man erst an den Rechner,
// bevor man auf der Baustelle fotografieren kann.
//
// Geholt wird dabei auch gleich das Soll aus dem Auftrag. Ist der dort noch
// leer, sieht man das hinterher an den Zahlen und traegt das Angebot nach,
// wenn man es zur Hand hat.
function AusPds({ vorhanden, onAngelegt, onOeffnen }) {
  const [offen, setOffen] = useState(false)
  const [suchwort, setSuchwort] = useState('')
  const [treffer, setTreffer] = useState(null)
  const [laeuft, setLaeuft] = useState(false)
  const [holt, setHolt] = useState(null)
  const [fehler, setFehler] = useState(null)

  // Was schon als Nachkalkulation existiert, steht oben in der Liste —
  // in den Treffern waere es nur eine zweite Gelegenheit, dasselbe anzulegen.
  const bekannt = new Set(vorhanden.map((n) => n.pds_vorgang_uuid).filter(Boolean))

  async function suchen() {
    if (!suchwort.trim()) return
    setLaeuft(true); setFehler(null)
    try {
      setTreffer(await sucheAuftraege(suchwort.trim()))
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaeuft(false)
    }
  }

  async function holen(a) {
    setHolt(a.vorgang_uuid); setFehler(null)
    try {
      const antwort = await importiereSoll(a.vorgang_uuid)
      await onAngelegt?.()
      onOeffnen?.({
        id: antwort.nachkalkulation_id,
        bezeichnung: a.bezeichnung,
        pds_vorgangs_nummer: a.vorgangs_nummer,
      })
    } catch (e) {
      setFehler(e.message)
    } finally {
      setHolt(null)
    }
  }

  if (!offen) {
    return (
      <Button size="sm" variant="outline" mt={4} w="100%" onClick={() => setOffen(true)}>
        <Search size={14} /> Auftrag aus PDS holen
      </Button>
    )
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={3} mt={4} bg="white">
      <Text fontSize="sm" fontWeight="medium" mb={2}>Auftrag aus PDS</Text>
      <HStack gap={2} mb={2}>
        <Input size="sm" placeholder="Name oder Auftragsnummer" value={suchwort}
          onChange={(e) => setSuchwort(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && suchen()} />
        <Button size="sm" onClick={suchen} loading={laeuft}>Suchen</Button>
      </HStack>

      {fehler && <Text fontSize="sm" color="red.600" mb={2}>{fehler}</Text>}

      {treffer && (
        <VStack align="stretch" gap={2} maxH="50vh" overflowY="auto">
          {treffer.auftraege.filter((a) => !bekannt.has(a.vorgang_uuid)).map((a) => (
            <Flex key={a.vorgang_uuid} borderWidth="1px" borderRadius="md" p={2} align="center" gap={2}>
              <Box flex="1" minW={0}>
                <Text fontSize="sm">{a.bezeichnung}</Text>
                <Text fontSize="xs" color="fg.muted">{a.vorgangs_nummer}</Text>
              </Box>
              <Button size="xs" variant="outline" loading={holt === a.vorgang_uuid}
                onClick={() => holen(a)}>
                <Download size={12} /> Holen
              </Button>
            </Flex>
          ))}
          {treffer.auftraege.filter((a) => !bekannt.has(a.vorgang_uuid)).length === 0 && (
            <Text fontSize="sm" color="fg.muted">Kein neuer Auftrag — die Treffer stehen schon oben.</Text>
          )}
        </VStack>
      )}

      <Button size="sm" variant="ghost" mt={2} onClick={() => setOffen(false)}>Zuklappen</Button>
    </Box>
  )
}

// Fuer den Fall, dass es den Auftrag weder in PDS noch hier schon gibt. Der
// Bezug zum Vorgang laesst sich spaeter nachtragen — wichtiger ist, dass der
// Zettel nicht liegen bleibt, solange man ihn in der Hand hat.
function NeueBaustelle({ onAngelegt }) {
  const [offen, setOffen] = useState(false)
  const [name, setName] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState(null)

  async function anlegen() {
    if (!name.trim()) return
    setLaeuft(true); setFehler(null)
    try {
      await neueNachkalkulation({ bezeichnung: name.trim() })
      setName(''); setOffen(false)
      onAngelegt?.()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaeuft(false)
    }
  }

  if (!offen) {
    return (
      <Button size="sm" variant="outline" mt={4} w="100%" onClick={() => setOffen(true)}>
        <Plus size={14} /> Baustelle ist nicht dabei
      </Button>
    )
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={3} mt={4} bg="white">
      <Text fontSize="sm" fontWeight="medium" mb={2}>Neue Baustelle</Text>
      <Input size="sm" placeholder="Name der Baustelle" value={name}
        onChange={(e) => setName(e.target.value)} mb={2} />
      <HStack gap={2}>
        <Button size="sm" colorPalette="blue" loading={laeuft} onClick={anlegen}
          disabled={!name.trim()}>Anlegen</Button>
        <Button size="sm" variant="ghost" onClick={() => setOffen(false)}>Abbrechen</Button>
      </HStack>
      {fehler && <Text fontSize="sm" color="red.600" mt={2}>{fehler}</Text>}
    </Box>
  )
}

function Hochladen({ nk, onZurueck }) {
  const [laeuft, setLaeuft] = useState(false)
  const [fertig, setFertig] = useState([])
  const [fehler, setFehler] = useState(null)

  async function handleUpload(e) {
    const dateien = Array.from(e.target.files || [])
    if (!dateien.length) return
    setLaeuft(true); setFehler(null)
    for (const datei of dateien) {
      try {
        const foto = await uploadAufmassFoto({ nachkalkulationId: nk.id, file: datei })
        // Gleich lesen lassen, damit auf der Baustelle schon sichtbar ist, ob
        // das Bild etwas taugt. Ein unscharfes Foto faellt so sofort auf und
        // nicht erst drei Wochen spaeter am Rechner.
        let gelesen = null
        try { gelesen = await leseAufmassFoto(foto.id) } catch (e2) { gelesen = { fehler: e2.message } }
        setFertig((f) => [...f, { name: datei.name, ...gelesen }])
      } catch (e3) {
        setFehler(e3.message)
      }
    }
    setLaeuft(false)
    e.target.value = ''
  }

  return (
    <Box maxW="560px" mx="auto">
      <Button size="sm" variant="ghost" mb={2} onClick={onZurueck}>
        <ArrowLeft size={14} /> Andere Baustelle
      </Button>
      <Heading size="md">{nk.bezeichnung}</Heading>
      <Text fontSize="sm" color="fg.muted" mb={4}>{nk.pds_vorgangs_nummer}</Text>

      <Button as="label" w="100%" size="lg" colorPalette="blue" cursor="pointer" loading={laeuft} mb={4}>
        <Camera size={18} /> Fotografieren
        {/* capture bringt auf dem Telefon direkt die Kamera, nicht die Galerie. */}
        <input type="file" accept="image/*" capture="environment" multiple hidden onChange={handleUpload} />
      </Button>

      <Button as="label" w="100%" size="sm" variant="outline" cursor="pointer" mb={4}>
        Aus der Galerie oder ein PDF
        <input type="file" accept="image/*,application/pdf" multiple hidden onChange={handleUpload} />
      </Button>

      {fehler && <Text fontSize="sm" color="red.600" mb={2}>{fehler}</Text>}

      <VStack align="stretch" gap={2}>
        {fertig.map((f, i) => (
          <Box key={i} borderWidth="1px" borderRadius="md" p={3} bg="white">
            <HStack gap={2}>
              {f.fehler ? (
                <Text fontSize="sm" color="red.600">konnte nicht gelesen werden</Text>
              ) : (
                <>
                  <Check size={14} color="green" />
                  <Badge size="sm" variant="subtle">{ART_TEXT[f.blatt_art] || 'gelesen'}</Badge>
                </>
              )}
            </HStack>
            {!f.fehler && (
              <Text fontSize="xs" color="fg.muted" mt={1}>
                {f.blatt_art === 'stunden'
                  ? `${f.stunden_zeilen} Einträge, ${f.stunden_summe} Stunden`
                  : f.blatt_art === 'angebot'
                    ? `${f.positionen} Positionen`
                    : `${f.zeilen} Zeilen${f.ohne_artikel ? `, ${f.ohne_artikel} ohne Artikel` : ''}`}
              </Text>
            )}
            {f.unsicher > 0 && (
              <Text fontSize="xs" color="orange.600" mt={1}>
                {f.unsicher} Zeilen unsicher gelesen — am Rechner prüfen
              </Text>
            )}
            {f.fehler && <Text fontSize="xs" color="fg.muted" mt={1}>{f.fehler}</Text>}
          </Box>
        ))}
      </VStack>

      {fertig.length > 0 && (
        <Text fontSize="xs" color="fg.muted" mt={4}>
          Die Zettel liegen jetzt am Auftrag. Übernommen wird am Rechner unter
          Nachkalkulation — erst dort werden aus den gelesenen Zeilen Positionen.
        </Text>
      )}
    </Box>
  )
}
