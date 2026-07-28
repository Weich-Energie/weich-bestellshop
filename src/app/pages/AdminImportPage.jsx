import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Button, Badge, Spinner, Flex, Input, IconButton,
  Field, Table, Spacer,
} from '@chakra-ui/react'
import {
  Upload, FileText, Check, X, Clock, ArrowRight, Trash2, ExternalLink, AlertCircle, Copy,
} from 'lucide-react'
import {
  uploadBeleg, processBeleg, listBelege, listPositionen, deleteBeleg,
  markPositionUebernommen, markPositionIgnoriert, markPositionSpaeter, normalizeArtikelnr,
} from '../../data/api/belege.js'
import { listKategorien } from '../../data/api/kategorien.js'
import ArtikelDialog from '../components/ArtikelDialog.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

function fmt(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function euro(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toFixed(2)} €`
}

const STATUS_BELEG_META = {
  processing: { label: 'wird verarbeitet', color: 'blue' },
  ready: { label: 'bereit', color: 'green' },
  error: { label: 'Fehler', color: 'red' },
}

const STATUS_POS_META = {
  pending: { label: 'offen', color: 'orange' },
  duplikat: { label: 'Duplikat', color: 'yellow' },
  spaeter: { label: 'später', color: 'blue' },
  uebernommen: { label: 'übernommen', color: 'green' },
  ignoriert: { label: 'ignoriert', color: 'gray' },
}

function BelegKarte({ beleg, onOpen, onDelete }) {
  const meta = STATUS_BELEG_META[beleg.status] || { label: beleg.status, color: 'gray' }
  const s = beleg.positions_summary || {}
  return (
    <Box borderWidth="1px" borderRadius="lg" p={3} bg="white">
      <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
        <HStack gap={3} align="flex-start">
          <Box color="fg.muted"><FileText size={28} /></Box>
          <VStack align="stretch" gap={1}>
            <HStack gap={2} flexWrap="wrap">
              <Text fontWeight="bold" fontSize="sm">
                {beleg.lieferant || beleg.original_name || 'Beleg'}
              </Text>
              <Badge colorPalette={meta.color} size="sm">{meta.label}</Badge>
              {beleg.rechnungsnr && <Badge variant="outline">Nr {beleg.rechnungsnr}</Badge>}
            </HStack>
            <HStack gap={4} fontSize="xs" color="fg.muted" flexWrap="wrap">
              {beleg.rechnungsdatum && <Text>Rechnung: {fmt(beleg.rechnungsdatum)}</Text>}
              {beleg.gesamtbetrag != null && <Text>{euro(beleg.gesamtbetrag)}</Text>}
              <Text>Positionen: {s.total || 0}</Text>
              {s.pending > 0 && <Text color="orange.600">offen: {s.pending}</Text>}
              {s.duplikat > 0 && <Text color="yellow.700">Duplikate: {s.duplikat}</Text>}
              {s.uebernommen > 0 && <Text color="green.700">übernommen: {s.uebernommen}</Text>}
            </HStack>
            {beleg.error_msg && <Text fontSize="xs" color="red.600">Fehler: {beleg.error_msg}</Text>}
          </VStack>
        </HStack>
        <HStack gap={2}>
          {beleg.status === 'ready' && (
            <Button size="sm" colorPalette="blue" onClick={onOpen}>
              <ArrowRight size={14} /> Positionen prüfen
            </Button>
          )}
          <IconButton size="sm" variant="ghost" colorPalette="red" onClick={onDelete} aria-label="Löschen">
            <Trash2 size={14} />
          </IconButton>
        </HStack>
      </Flex>
    </Box>
  )
}

function PositionsAnsicht({ belegId, kategorien, onClose }) {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [prefillFromPos, setPrefillFromPos] = useState(null)
  const [aktivePos, setAktivePos] = useState(null)
  const [ignoriereOpen, setIgnoriereOpen] = useState({})
  const [ignoriereGrund, setIgnoriereGrund] = useState({})

  const { data: positionen = [], isLoading } = useQuery({
    queryKey: ['shop-beleg-positionen', belegId],
    queryFn: () => listPositionen(belegId),
  })

  function refresh() {
    qc.invalidateQueries({ queryKey: ['shop-beleg-positionen', belegId] })
    qc.invalidateQueries({ queryKey: ['shop-belege'] })
    qc.invalidateQueries({ queryKey: ['shop-artikel'] })
    qc.invalidateQueries({ queryKey: ['shop-artikel-admin'] })
    qc.invalidateQueries({ queryKey: ['shop-kategorien'] })
  }

  const ignoriereMutation = useMutation({
    mutationFn: ({ id, grund }) => markPositionIgnoriert(id, grund),
    onSuccess: refresh,
  })
  const spaeterMutation = useMutation({
    mutationFn: (id) => markPositionSpaeter(id),
    onSuccess: refresh,
  })

  function startUebernehmen(pos) {
    setAktivePos(pos)
    setPrefillFromPos({
      name: pos.raw_beschreibung.slice(0, 80),
      beschreibung: pos.raw_beschreibung,
      preis_netto: pos.raw_einzelpreis,
      artikelnr: pos.raw_artikelnr || '',
      einheit: pos.ki_einheit || '',
      tags: Array.isArray(pos.ki_tags) ? pos.ki_tags.join(', ') : '',
      kategorie_id: findKategorieId(pos.ki_kategorie, kategorien),
    })
    setDialogOpen(true)
  }

  async function onArtikelSaved(saved) {
    if (aktivePos && saved?.id) {
      try { await markPositionUebernommen(aktivePos.id, saved.id) } catch { /* egal */ }
    }
    setAktivePos(null); setPrefillFromPos(null)
    refresh()
  }

  if (isLoading) return <Flex justify="center" p={12}><Spinner size="xl" /></Flex>

  return (
    <Box>
      <HStack mb={3}>
        <Button size="sm" variant="ghost" onClick={onClose}>← Zurück zur Beleg-Liste</Button>
        <Spacer />
        <Text fontSize="sm" color="fg.muted">{positionen.length} Position{positionen.length !== 1 ? 'en' : ''}</Text>
      </HStack>

      <Box overflowX="auto">
          <Table.Root variant="line" size="sm" minW="720px">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Status</Table.ColumnHeader>
            <Table.ColumnHeader>Beschreibung</Table.ColumnHeader>
            <Table.ColumnHeader>Menge</Table.ColumnHeader>
            <Table.ColumnHeader>Preis</Table.ColumnHeader>
            <Table.ColumnHeader>KI-Kategorie</Table.ColumnHeader>
            <Table.ColumnHeader>Aktionen</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {positionen.map((p) => {
            const meta = STATUS_POS_META[p.status] || { label: p.status, color: 'gray' }
            const isIgn = ignoriereOpen[p.id]
            const isTerminal = p.status === 'uebernommen' || p.status === 'ignoriert'
            return (
              <Table.Row key={p.id}>
                <Table.Cell>
                  <Badge colorPalette={meta.color} size="sm">{meta.label}</Badge>
                  {p.duplikat?.name && (() => {
                    // Nummern-Treffer ist eindeutig, Name-Treffer nur wahrscheinlich —
                    // der Admin soll auf einen Blick sehen, wie sicher der Fund ist.
                    const nrTreffer = !!normalizeArtikelnr(p.raw_artikelnr) &&
                      normalizeArtikelnr(p.raw_artikelnr) === normalizeArtikelnr(p.duplikat.artikelnr)
                    return (
                      <Text fontSize="xs" color={nrTreffer ? 'red.600' : 'yellow.700'} mt={1}>
                        {nrTreffer ? `= gleiche Art-Nr: ${p.duplikat.name}` : `≈ ${p.duplikat.name}`}
                      </Text>
                    )
                  })()}
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm">{p.raw_beschreibung}</Text>
                  {p.raw_artikelnr && <Text fontSize="xs" color="fg.muted">Art-Nr: {p.raw_artikelnr}</Text>}
                  {p.ignore_grund && <Text fontSize="xs" color="red.600">Grund: {p.ignore_grund}</Text>}
                </Table.Cell>
                <Table.Cell><Text fontSize="sm">{p.raw_menge != null ? p.raw_menge : '—'}</Text></Table.Cell>
                <Table.Cell><Text fontSize="sm">{euro(p.raw_einzelpreis)}</Text></Table.Cell>
                <Table.Cell><Text fontSize="xs">{p.ki_kategorie || '—'}</Text></Table.Cell>
                <Table.Cell>
                  {!isTerminal && !isIgn && (
                    <HStack gap={1}>
                      <Button size="xs" colorPalette="green" onClick={() => startUebernehmen(p)}>
                        <Check size={12} /> Übernehmen
                      </Button>
                      <IconButton size="xs" variant="ghost" onClick={() => spaeterMutation.mutate(p.id)} title="Später">
                        <Clock size={12} />
                      </IconButton>
                      <IconButton size="xs" variant="ghost" colorPalette="red"
                        onClick={() => setIgnoriereOpen((s) => ({ ...s, [p.id]: true }))} title="Ignorieren">
                        <X size={12} />
                      </IconButton>
                    </HStack>
                  )}
                  {isIgn && (
                    <HStack gap={1}>
                      <Input size="xs" placeholder="Grund..." maxW="140px"
                        value={ignoriereGrund[p.id] || ''}
                        onChange={(e) => setIgnoriereGrund((s) => ({ ...s, [p.id]: e.target.value }))} />
                      <Button size="xs" colorPalette="red"
                        onClick={() => {
                          ignoriereMutation.mutate({ id: p.id, grund: ignoriereGrund[p.id] || null })
                          setIgnoriereOpen((s) => ({ ...s, [p.id]: false }))
                        }}>OK</Button>
                      <IconButton size="xs" variant="ghost"
                        onClick={() => setIgnoriereOpen((s) => ({ ...s, [p.id]: false }))}>
                        <X size={12} />
                      </IconButton>
                    </HStack>
                  )}
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table.Root>
          </Box>

      <ArtikelDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setAktivePos(null); setPrefillFromPos(null) }}
        artikel={null}
        prefill={prefillFromPos}
        kategorien={kategorien}
        onSaved={onArtikelSaved}
      />
    </Box>
  )
}

function findKategorieId(kiName, kategorien) {
  if (!kiName) return ''
  const cleaned = String(kiName).replace(/^NEU:\s*/i, '').trim().toLowerCase()
  const existing = kategorien.find((k) => k.name.toLowerCase() === cleaned)
  return existing?.id || ''
}

export default function AdminImportPage() {
  const qc = useQueryClient()
  const { currentUser } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [offenerBeleg, setOffenerBeleg] = useState(null)
  const [processStatus, setProcessStatus] = useState({}) // id → 'processing' | 'done' | 'error'

  const { data: belege = [], isLoading } = useQuery({
    queryKey: ['shop-belege'],
    queryFn: listBelege,
    refetchInterval: (query) => {
      const list = query.state.data || []
      return list.some((b) => b.status === 'processing') ? 3000 : false
    },
  })
  const { data: kategorien = [] } = useQuery({
    queryKey: ['shop-kategorien'],
    queryFn: listKategorien,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBeleg,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-belege'] }),
  })

  async function handleFiles(fileList) {
    const files = [...fileList].filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (files.length === 0) { setUploadError('Nur PDF-Dateien werden unterstuetzt.'); return }
    setUploading(true); setUploadError(null)
    try {
      for (const f of files) {
        try {
          const beleg = await uploadBeleg({ file: f, importedBy: currentUser?.authId })
          qc.invalidateQueries({ queryKey: ['shop-belege'] })
          setProcessStatus((s) => ({ ...s, [beleg.id]: 'processing' }))
          // Verarbeitung nicht auf User-Klick, sondern sofort — im Hintergrund
          processBeleg({ belegId: beleg.id, kategorien: kategorien.map((k) => k.name) })
            .then(() => setProcessStatus((s) => ({ ...s, [beleg.id]: 'done' })))
            .catch(() => setProcessStatus((s) => ({ ...s, [beleg.id]: 'error' })))
            .finally(() => qc.invalidateQueries({ queryKey: ['shop-belege'] }))
        } catch (e) {
          setUploadError(`${f.name}: ${e.message || 'Upload fehlgeschlagen'}`)
        }
      }
    } finally {
      setUploading(false)
    }
  }

  if (offenerBeleg) {
    return (
      <PositionsAnsicht
        belegId={offenerBeleg.id}
        kategorien={kategorien}
        onClose={() => setOffenerBeleg(null)}
      />
    )
  }

  return (
    <Box>
      <Heading size="lg" mb={4}>Beleg-Import</Heading>

      <Box
        borderWidth="2px" borderStyle="dashed" borderRadius="lg" p={6} mb={6}
        bg="white" textAlign="center"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.background = '#EBF8FF' }}
        onDragLeave={(e) => { e.currentTarget.style.background = 'white' }}
        onDrop={(e) => {
          e.preventDefault(); e.currentTarget.style.background = 'white'
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
        }}>
        <VStack gap={2}>
          <Upload size={40} color="#3182CE" />
          <Text fontWeight="bold">PDF-Rechnungen hier fallen lassen</Text>
          <Text fontSize="sm" color="fg.muted">oder Datei(en) auswählen — mehrere gleichzeitig OK</Text>
          <Input type="file" accept="application/pdf" multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)} maxW="360px" />
          {uploading && <Text fontSize="sm" color="blue.600">Hochlade...</Text>}
          {uploadError && <Text fontSize="sm" color="red.500">{uploadError}</Text>}
        </VStack>
      </Box>

      {isLoading ? (
        <Flex justify="center" p={12}><Spinner size="xl" /></Flex>
      ) : belege.length === 0 ? (
        <Flex direction="column" align="center" py={8} gap={2}>
          <FileText size={40} color="#9ca3af" />
          <Text color="fg.muted">Noch keine Belege — laed eine PDF-Rechnung hoch.</Text>
        </Flex>
      ) : (
        <VStack align="stretch" gap={2}>
          {belege.map((b) => (
            <BelegKarte
              key={b.id}
              beleg={b}
              onOpen={() => setOffenerBeleg(b)}
              onDelete={() => {
                if (window.confirm(`Beleg "${b.original_name || b.lieferant}" mit allen Positionen loeschen?`)) {
                  deleteMutation.mutate(b.id)
                }
              }}
            />
          ))}
        </VStack>
      )}
    </Box>
  )
}
