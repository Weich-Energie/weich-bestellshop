// Aufmasszettel abfotografieren statt abtippen — die Uebergangsloesung, bis das
// Aufmass durchgaengig in der App erfasst wird (Gewerk klima in weich-aufmass).
//
// Zwischen "gelesen" und "Position" liegt bewusst ein Bestaetigungsschritt.
// Zwei Gruende: Handschrift wird verwechselt (1/7, 4/9), und der Vordruck ist
// ein Shop-Ausdruck mit einer gedruckten 1 in jeder Mengenzeile, die NICHT gilt.
// Eine ungeprueft uebernommene Seite saehe vollstaendig aus und waere falsch.
//
// Zeilen ohne Artikel sind kein Fehler, sondern das Nebenprodukt: was hier
// auftaucht, wurde verbaut und fehlt im Katalog der Aufmass-App.

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Text, HStack, VStack, Button, Input, Table, Badge, Spinner, Flex, Spacer, IconButton,
} from '@chakra-ui/react'
import { Camera, ScanLine, Check, X, Trash2, ExternalLink, AlertTriangle } from 'lucide-react'
import {
  uploadAufmassFoto, leseAufmassFoto, listFotos, listZeilen, getFotoSignedUrl,
  setZeileMenge, setZeileArtikel, verwirfZeile, uebernimmZeilen, fotoStatusNachziehen, deleteFoto,
} from '../../data/api/aufmassFoto.js'

const STATUS_FARBE = {
  neu: 'gray', laeuft: 'blue', gelesen: 'orange', uebernommen: 'green', fehler: 'red',
}
const STATUS_TEXT = {
  neu: 'noch nicht gelesen', laeuft: 'wird gelesen…', gelesen: 'gelesen, wartet auf Bestätigung',
  uebernommen: 'übernommen', fehler: 'Fehler',
}

export default function AufmassFotoBox({ nachkalkulationId, artikelListe = [], onAenderung }) {
  const qc = useQueryClient()
  const [laedtHoch, setLaedtHoch] = useState(false)
  const [fehler, setFehler] = useState(null)
  const [offenesFoto, setOffenesFoto] = useState(null)

  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ['aufmass-fotos', nachkalkulationId],
    queryFn: () => listFotos(nachkalkulationId),
  })

  function neu() {
    qc.invalidateQueries({ queryKey: ['aufmass-fotos', nachkalkulationId] })
  }

  async function handleUpload(e) {
    const dateien = Array.from(e.target.files || [])
    if (!dateien.length) return
    setLaedtHoch(true); setFehler(null)
    try {
      // Mehrere Seiten eines Berichts gehoeren zusammen — die Reihenfolge der
      // Auswahl wird als Seitennummer festgehalten.
      let nr = fotos.length
      for (const datei of dateien) {
        nr += 1
        const foto = await uploadAufmassFoto({ nachkalkulationId, file: datei, seitennr: nr })
        neu()
        // Gleich lesen lassen: das ist der Grund, warum man hochlaedt.
        try { await leseAufmassFoto(foto.id) } catch { /* Fehler steht am Foto */ }
        neu()
      }
    } catch (e2) {
      setFehler(e2.message)
    } finally {
      setLaedtHoch(false)
      e.target.value = ''
    }
  }

  async function handleLesen(fotoId) {
    setFehler(null)
    try { await leseAufmassFoto(fotoId) } catch (e) { setFehler(e.message) }
    neu()
  }

  async function handleLoeschen(fotoId) {
    await deleteFoto(fotoId)
    if (offenesFoto === fotoId) setOffenesFoto(null)
    neu()
  }

  async function handleAnsehen(pfad) {
    const url = await getFotoSignedUrl(pfad)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
      <Flex align="center" gap={2} mb={3} flexWrap="wrap">
        <Camera size={15} />
        <Text fontWeight="bold" fontSize="sm">Aufmaßzettel</Text>
        <Spacer />
        <Button as="label" size="xs" variant="outline" cursor="pointer" loading={laedtHoch}>
          <Camera size={12} /> Fotos hinzufügen
          <input type="file" accept="image/*,application/pdf" multiple hidden onChange={handleUpload} />
        </Button>
      </Flex>

      <Text fontSize="xs" color="fg.muted" mb={3}>
        Foto des ausgefüllten Berichts hochladen — gelesen wird nur die handschriftliche
        Menge. Die gedruckte 1 im Vordruck bleibt außen vor.
      </Text>

      {fehler && <Text fontSize="sm" color="red.600" mb={2}>{fehler}</Text>}
      {isLoading && <Flex justify="center" p={4}><Spinner size="sm" /></Flex>}

      {!isLoading && fotos.length === 0 && (
        <Text fontSize="sm" color="fg.muted">Noch kein Zettel hochgeladen.</Text>
      )}

      <VStack align="stretch" gap={2}>
        {fotos.map((f) => (
          <Box key={f.id} borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
            <Flex align="center" gap={2} flexWrap="wrap">
              <Text fontSize="sm" fontWeight="medium">
                {f.seitennr ? `Seite ${f.seitennr}` : 'Seite'} · {f.original_name || 'Foto'}
              </Text>
              <Badge size="sm" colorPalette={STATUS_FARBE[f.status]} variant="subtle">
                {STATUS_TEXT[f.status] || f.status}
              </Badge>
              {f.zeilen_gesamt > 0 && (
                <Text fontSize="xs" color="fg.muted">
                  {f.zeilen_offen} von {f.zeilen_gesamt} offen
                </Text>
              )}
              {f.zeilen_unsicher > 0 && (
                <HStack gap={1} color="orange.600">
                  <AlertTriangle size={12} />
                  <Text fontSize="xs">{f.zeilen_unsicher} unsicher gelesen</Text>
                </HStack>
              )}
              {f.zeilen_ohne_artikel > 0 && (
                <Text fontSize="xs" color="purple.600">
                  {f.zeilen_ohne_artikel} ohne Artikel im Katalog
                </Text>
              )}
              <Spacer />
              <IconButton size="xs" variant="ghost" aria-label="Zettel ansehen"
                onClick={() => handleAnsehen(f.bild_pfad)}>
                <ExternalLink size={13} />
              </IconButton>
              {f.status !== 'laeuft' && (
                <Button size="xs" variant="outline" onClick={() => handleLesen(f.id)}>
                  <ScanLine size={12} /> {f.status === 'neu' ? 'Lesen' : 'Neu lesen'}
                </Button>
              )}
              {f.zeilen_gesamt > 0 && (
                <Button size="xs" variant="ghost"
                  onClick={() => setOffenesFoto(offenesFoto === f.id ? null : f.id)}>
                  {offenesFoto === f.id ? 'Zeilen zu' : 'Zeilen zeigen'}
                </Button>
              )}
              <IconButton size="xs" variant="ghost" colorPalette="red" aria-label="Foto löschen"
                onClick={() => handleLoeschen(f.id)}>
                <Trash2 size={13} />
              </IconButton>
            </Flex>

            {f.fehler_text && (
              <Text fontSize="xs" color="red.600" mt={1}>{f.fehler_text}</Text>
            )}

            {offenesFoto === f.id && (
              <Zeilen
                fotoId={f.id}
                nachkalkulationId={nachkalkulationId}
                artikelListe={artikelListe}
                onAenderung={() => { neu(); onAenderung?.() }}
              />
            )}
          </Box>
        ))}
      </VStack>
    </Box>
  )
}

// ─── Die gelesenen Zeilen einer Seite ──────────────────────────────────

function Zeilen({ fotoId, nachkalkulationId, artikelListe, onAenderung }) {
  const qc = useQueryClient()
  const [fehler, setFehler] = useState(null)
  const [laeuft, setLaeuft] = useState(false)

  const { data: zeilen = [], isLoading } = useQuery({
    queryKey: ['aufmass-zeilen', fotoId],
    queryFn: () => listZeilen(fotoId),
  })

  function neu() {
    qc.invalidateQueries({ queryKey: ['aufmass-zeilen', fotoId] })
    onAenderung?.()
  }

  const offene = zeilen.filter((z) => z.status === 'offen')

  async function uebernehmen(auswahl) {
    setLaeuft(true); setFehler(null)
    try {
      await uebernimmZeilen(nachkalkulationId, auswahl)
      await fotoStatusNachziehen(fotoId)
      neu()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaeuft(false)
    }
  }

  if (isLoading) return <Flex justify="center" p={3}><Spinner size="sm" /></Flex>
  if (!zeilen.length) return <Text fontSize="sm" color="fg.muted" mt={2}>Keine Zeile gelesen.</Text>

  return (
    <Box mt={3}>
      <Flex mb={2} gap={2} align="center" flexWrap="wrap">
        <Text fontSize="xs" color="fg.muted">
          {offene.length} offen · {zeilen.length - offene.length} erledigt
        </Text>
        <Spacer />
        {offene.length > 0 && (
          <Button size="xs" colorPalette="blue" loading={laeuft} onClick={() => uebernehmen(offene)}>
            <Check size={12} /> Alle {offene.length} übernehmen
          </Button>
        )}
      </Flex>

      {fehler && <Text fontSize="sm" color="red.600" mb={2}>{fehler}</Text>}

      <Box overflowX="auto" bg="white" borderWidth="1px" borderRadius="md">
        <Table.Root variant="line" size="sm" minW="720px">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Vom Zettel</Table.ColumnHeader>
              <Table.ColumnHeader>Artikel im Shop</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Menge</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Aktion</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {zeilen.map((z) => (
              <Zeile key={z.id} z={z} artikelListe={artikelListe}
                onUebernehmen={() => uebernehmen([z])} onAenderung={neu} />
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  )
}

function Zeile({ z, artikelListe, onUebernehmen, onAenderung }) {
  const [menge, setMenge] = useState(z.roh_menge ?? '')
  const erledigt = z.status !== 'offen'
  const unsicher = z.sicherheit != null && Number(z.sicherheit) < 0.8

  async function mengeSpeichern() {
    const m = Number(String(menge).replace(',', '.'))
    if (!(m > 0) || m === Number(z.roh_menge)) return
    await setZeileMenge(z.id, m)
    onAenderung()
  }

  async function artikelSetzen(id) {
    await setZeileArtikel(z.id, id || null)
    onAenderung()
  }

  return (
    <Table.Row opacity={erledigt ? 0.5 : 1}>
      <Table.Cell>
        <Text fontSize="sm">{z.roh_bezeichnung || '—'}</Text>
        <HStack gap={2}>
          {z.roh_artikelnr && <Text fontSize="xs" color="fg.muted">{z.roh_artikelnr}</Text>}
          {unsicher && (
            <Badge size="sm" colorPalette="orange" variant="subtle">
              unsicher gelesen
            </Badge>
          )}
          {z.notiz && <Text fontSize="xs" color="orange.600">{z.notiz}</Text>}
        </HStack>
      </Table.Cell>
      <Table.Cell>
        {erledigt ? (
          <Text fontSize="sm">{z.artikel?.name || <Text as="span" color="fg.muted">als Freitext</Text>}</Text>
        ) : (
          <VStack align="stretch" gap={1}>
            <select
              value={z.artikel_id || ''}
              onChange={(e) => artikelSetzen(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, maxWidth: 280 }}
            >
              <option value="">— kein Artikel, als Freitext —</option>
              {artikelListe.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {!z.artikel_id && (
              <Text fontSize="10px" color="purple.600">
                fehlt im Katalog — gehört in den Artikelstamm der Aufmaß-App
              </Text>
            )}
            {z.treffer_art === 'name' && z.artikel_id && (
              <Text fontSize="10px" color="fg.muted">über den Namen gefunden, bitte prüfen</Text>
            )}
          </VStack>
        )}
      </Table.Cell>
      <Table.Cell textAlign="right">
        {erledigt ? (
          <Text fontSize="sm">{Number(z.roh_menge).toLocaleString('de-DE')} {z.roh_einheit || ''}</Text>
        ) : (
          <HStack justify="flex-end" gap={1}>
            <Input size="xs" maxW="70px" textAlign="right" value={menge}
              onChange={(e) => setMenge(e.target.value)}
              onBlur={mengeSpeichern}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            <Text fontSize="xs" color="fg.muted">{z.roh_einheit || ''}</Text>
          </HStack>
        )}
      </Table.Cell>
      <Table.Cell textAlign="right">
        {erledigt ? (
          <Badge size="sm" colorPalette={z.status === 'uebernommen' ? 'green' : 'gray'} variant="subtle">
            {z.status === 'uebernommen' ? 'übernommen' : 'verworfen'}
          </Badge>
        ) : (
          <HStack justify="flex-end" gap={1}>
            <IconButton size="xs" variant="ghost" colorPalette="green" aria-label="Übernehmen"
              onClick={onUebernehmen}>
              <Check size={13} />
            </IconButton>
            <IconButton size="xs" variant="ghost" aria-label="Verwerfen"
              onClick={async () => { await verwirfZeile(z.id); onAenderung() }}>
              <X size={13} />
            </IconButton>
          </HStack>
        )}
      </Table.Cell>
    </Table.Row>
  )
}
