import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Button, Badge, Spinner, Flex, Input,
} from '@chakra-ui/react'
import { Check, X, ExternalLink, ArrowRight, Sparkles } from 'lucide-react'
import {
  listOffeneBedarfsmeldungen, meldungAblehnen, meldungInKatalog,
} from '../../data/api/bedarf.js'
import { listKategorien } from '../../data/api/kategorien.js'
import { getBedarfSignedUrl } from '../../data/api/storage.js'
import { analyzeBedarfBild } from '../../data/api/shopAi.js'
import ArtikelDialog from '../components/ArtikelDialog.jsx'

function fmt(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function BedarfBild({ path }) {
  const { data: url } = useQuery({
    queryKey: ['shop-bedarf-bild', path],
    queryFn: () => getBedarfSignedUrl(path),
    enabled: !!path,
    staleTime: 55 * 60_000,
  })
  return (
    <Box w="80px" h="80px" borderRadius="md" bg="gray.50" borderWidth="1px" overflow="hidden">
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
    </Box>
  )
}

export default function AdminBedarfPage() {
  const qc = useQueryClient()
  const [ablehnOpen, setAblehnOpen] = useState({})
  const [ablehnGrund, setAblehnGrund] = useState({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uebernehmenMeldung, setUebernehmenMeldung] = useState(null)
  const [prefillOverride, setPrefillOverride] = useState(null)
  const [analyzing, setAnalyzing] = useState({}) // id → bool
  const [analyseError, setAnalyseError] = useState({}) // id → text

  const { data: liste = [], isLoading } = useQuery({
    queryKey: ['shop-bedarf-offen'],
    queryFn: listOffeneBedarfsmeldungen,
  })
  const { data: kategorien = [] } = useQuery({
    queryKey: ['shop-kategorien'],
    queryFn: listKategorien,
  })

  const ablehnMutation = useMutation({
    mutationFn: ({ id, grund }) => meldungAblehnen(id, grund),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-bedarf-offen'] }),
  })

  async function onArtikelSaved(savedArtikel) {
    // Nach Anlage: Meldung als "in_katalog" markieren mit Artikel-ID
    if (uebernehmenMeldung && savedArtikel?.id) {
      try {
        await meldungInKatalog(uebernehmenMeldung.id, savedArtikel.id)
      } catch (e) { console.error(e) }
    }
    setUebernehmenMeldung(null)
    qc.invalidateQueries({ queryKey: ['shop-bedarf-offen'] })
    qc.invalidateQueries({ queryKey: ['shop-artikel-admin'] })
    qc.invalidateQueries({ queryKey: ['shop-artikel'] })
  }

  function startUebernehmen(m) {
    setPrefillOverride(null)
    setUebernehmenMeldung(m)
    setDialogOpen(true)
  }

  async function startKiUebernehmen(m) {
    if (!m.bild_url) return
    setAnalyzing((s) => ({ ...s, [m.id]: true }))
    setAnalyseError((s) => ({ ...s, [m.id]: null }))
    try {
      const signedUrl = await getBedarfSignedUrl(m.bild_url)
      if (!signedUrl) throw new Error('Bild nicht verfuegbar')
      const result = await analyzeBedarfBild({
        bildUrl: signedUrl,
        beschreibung: m.beschreibung,
        kategorien: kategorien.map((k) => k.name),
      })
      if (!result) throw new Error('Keine KI-Antwort')

      // Kategorie matchen
      let kategorieId = ''
      if (result.kategorie) {
        const cleaned = String(result.kategorie).replace(/^NEU:\s*/i, '').trim()
        const existing = kategorien.find((k) => k.name.toLowerCase() === cleaned.toLowerCase())
        if (existing) kategorieId = existing.id
      }

      setPrefillOverride({
        name: result.name || m.beschreibung.slice(0, 60),
        beschreibung: result.beschreibung || m.beschreibung,
        kategorie_id: kategorieId,
        lieferant_url: m.lieferant_url || '',
        einheit: result.einheit || '',
        tags: Array.isArray(result.tags) ? result.tags.join(', ') : '',
      })
      setUebernehmenMeldung(m)
      setDialogOpen(true)
    } catch (e) {
      setAnalyseError((s) => ({ ...s, [m.id]: e.message || 'KI-Analyse fehlgeschlagen' }))
    } finally {
      setAnalyzing((s) => ({ ...s, [m.id]: false }))
    }
  }

  const prefill = prefillOverride
    || (uebernehmenMeldung ? {
      name: uebernehmenMeldung.beschreibung.slice(0, 60),
      beschreibung: uebernehmenMeldung.beschreibung,
      lieferant_url: uebernehmenMeldung.lieferant_url || '',
    } : null)

  if (isLoading) return <Flex justify="center" p={12}><Spinner size="xl" /></Flex>

  return (
    <Box>
      <Heading size="lg" mb={4}>
        Bedarfsmeldungen {liste.length > 0 && <Badge colorPalette="orange" ml={2}>{liste.length} offen</Badge>}
      </Heading>

      {liste.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py={12}>Keine offenen Bedarfsmeldungen.</Text>
      ) : (
        <VStack align="stretch" gap={3}>
          {liste.map((m) => {
            const isAbl = ablehnOpen[m.id]
            return (
              <Box key={m.id} borderWidth="1px" borderRadius="lg" p={4} bg="white">
                <HStack align="flex-start" gap={4}>
                  {m.bild_url ? <BedarfBild path={m.bild_url} /> : (
                    <Box w="80px" h="80px" borderRadius="md" bg="gray.50" borderWidth="1px" />
                  )}
                  <VStack align="stretch" flex="1" gap={1}>
                    <HStack gap={2} flexWrap="wrap">
                      <Badge colorPalette="orange">Menge: {m.menge}</Badge>
                      <Text fontSize="xs" color="fg.muted">Gemeldet: {fmt(m.created_at)}</Text>
                    </HStack>
                    <Text fontSize="sm" fontWeight="medium">{m.beschreibung}</Text>
                    {m.lieferant_url && (
                      <a href={m.lieferant_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: '#3182CE', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Zum Lieferanten <ExternalLink size={12} />
                      </a>
                    )}
                  </VStack>
                  <VStack gap={2} align="stretch" minW="220px">
                    {!isAbl ? (
                      <>
                        {m.bild_url && (
                          <Button colorPalette="purple" size="sm" variant="outline"
                            onClick={() => startKiUebernehmen(m)} loading={!!analyzing[m.id]}>
                            <Sparkles size={14} /> Mit KI analysieren
                          </Button>
                        )}
                        <Button colorPalette="green" size="sm" onClick={() => startUebernehmen(m)}>
                          <ArrowRight size={14} /> In Katalog übernehmen
                        </Button>
                        <Button variant="outline" colorPalette="red" size="sm"
                          onClick={() => setAblehnOpen((s) => ({ ...s, [m.id]: true }))}>
                          <X size={14} /> Ablehnen
                        </Button>
                        {analyseError[m.id] && <Text fontSize="xs" color="red.500">{analyseError[m.id]}</Text>}
                      </>
                    ) : (
                      <VStack gap={2} align="stretch">
                        <Input size="sm" placeholder="Grund (optional)..."
                          value={ablehnGrund[m.id] || ''}
                          onChange={(e) => setAblehnGrund((s) => ({ ...s, [m.id]: e.target.value }))} />
                        <HStack>
                          <Button size="xs" variant="ghost"
                            onClick={() => setAblehnOpen((s) => ({ ...s, [m.id]: false }))}>Abbruch</Button>
                          <Button size="xs" colorPalette="red"
                            onClick={() => {
                              ablehnMutation.mutate({ id: m.id, grund: ablehnGrund[m.id] || null })
                              setAblehnOpen((s) => ({ ...s, [m.id]: false }))
                            }}>Ablehnen</Button>
                        </HStack>
                      </VStack>
                    )}
                  </VStack>
                </HStack>
              </Box>
            )
          })}
        </VStack>
      )}

      <ArtikelDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setUebernehmenMeldung(null); setPrefillOverride(null) }}
        artikel={null}
        prefill={prefill}
        kategorien={kategorien}
        onSaved={onArtikelSaved}
      />
    </Box>
  )
}
