import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Button, Input, Textarea, Badge, Spinner, Flex, Field,
  IconButton,
} from '@chakra-ui/react'
import { Send, Camera, Image as ImageIcon, Trash2, ExternalLink } from 'lucide-react'
import {
  listEigeneBedarfsmeldungen, createBedarfsmeldung, deleteBedarfsmeldung,
} from '../../data/api/bedarf.js'
import { uploadBedarfBild, deleteBedarfBild, getBedarfSignedUrl } from '../../data/api/storage.js'
import { useAuth } from '../contexts/AuthContext.jsx'

const STATUS_META = {
  offen:      { label: 'offen',            color: 'orange' },
  in_katalog: { label: 'in den Katalog',   color: 'green'  },
  abgelehnt:  { label: 'abgelehnt',        color: 'red'    },
}

function fmt(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function BedarfBild({ path }) {
  const { data: url } = useQuery({
    queryKey: ['shop-bedarf-bild', path],
    queryFn: () => getBedarfSignedUrl(path),
    enabled: !!path,
    staleTime: 55 * 60_000,
  })
  return (
    <Box w="60px" h="60px" borderRadius="md" bg="gray.50" borderWidth="1px" overflow="hidden">
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
    </Box>
  )
}

export default function BedarfPage() {
  const { currentUser } = useAuth()
  const qc = useQueryClient()
  const [beschreibung, setBeschreibung] = useState('')
  const [lieferantUrl, setLieferantUrl] = useState('')
  const [menge, setMenge] = useState(1)
  const [bildDatei, setBildDatei] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const { data: liste = [], isLoading } = useQuery({
    queryKey: ['shop-bedarf-eigene', currentUser?.authId],
    queryFn: () => listEigeneBedarfsmeldungen(currentUser.authId),
    enabled: !!currentUser?.authId,
  })

  const deleteMutation = useMutation({
    mutationFn: async ({ id, bildUrl }) => {
      if (bildUrl) { try { await deleteBedarfBild(bildUrl) } catch { /* egal */ } }
      await deleteBedarfsmeldung(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-bedarf-eigene', currentUser?.authId] }),
  })

  async function submit(e) {
    e.preventDefault()
    if (!beschreibung.trim()) return
    setBusy(true); setError(null); setSent(false)
    try {
      let bildPath = null
      if (bildDatei) bildPath = await uploadBedarfBild(currentUser.authId, bildDatei)
      await createBedarfsmeldung({
        userId: currentUser.authId,
        beschreibung: beschreibung.trim(),
        bildUrl: bildPath,
        lieferantUrl: lieferantUrl.trim() || null,
        menge: Math.max(1, Number(menge) || 1),
      })
      setBeschreibung(''); setLieferantUrl(''); setMenge(1); setBildDatei(null)
      setSent(true)
      qc.invalidateQueries({ queryKey: ['shop-bedarf-eigene', currentUser.authId] })
      qc.invalidateQueries({ queryKey: ['shop-bedarf-offen'] })
      setTimeout(() => setSent(false), 3000)
    } catch (e) {
      setError(e.message || 'Meldung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <Heading size="lg" mb={4}>Bedarf melden</Heading>

      <Box borderWidth="1px" borderRadius="lg" p={4} bg="white" mb={6}>
        <form onSubmit={submit}>
          <VStack gap={3} align="stretch">
            <Field.Root required>
              <Field.Label>Was wird gebraucht?</Field.Label>
              <Textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)}
                placeholder="z.B. Cat6-Kabel 5m, Bohrer 8mm..." rows={3} required />
            </Field.Root>

            <HStack gap={2}>
              <Field.Root maxW="120px">
                <Field.Label>Menge</Field.Label>
                <Input type="number" min={1} value={menge}
                  onChange={(e) => setMenge(Math.max(1, Number(e.target.value) || 1))} />
              </Field.Root>
              <Field.Root flex="1">
                <Field.Label>Lieferanten-Link (optional)</Field.Label>
                <Input value={lieferantUrl} onChange={(e) => setLieferantUrl(e.target.value)}
                  placeholder="https://..." />
              </Field.Root>
            </HStack>

            <Field.Root>
              <Field.Label>
                <HStack gap={1}><Camera size={14} /> Foto (optional, Handy-Kamera empfohlen)</HStack>
              </Field.Label>
              <Input type="file" accept="image/*" capture="environment"
                onChange={(e) => setBildDatei(e.target.files?.[0] || null)} />
              {bildDatei && <Text fontSize="xs" color="fg.muted" mt={1}>{bildDatei.name}</Text>}
            </Field.Root>

            {error && <Text color="red.500" fontSize="sm">{error}</Text>}
            {sent && <Text color="green.600" fontSize="sm">✓ Meldung eingegangen — Danke!</Text>}

            <Button type="submit" colorPalette="blue" loading={busy} disabled={!beschreibung.trim()}>
              <Send size={14} /> Meldung abschicken
            </Button>
          </VStack>
        </form>
      </Box>

      <Heading size="md" mb={3}>Meine Meldungen</Heading>
      {isLoading ? (
        <Flex justify="center" p={6}><Spinner /></Flex>
      ) : liste.length === 0 ? (
        <Text color="fg.muted" fontSize="sm">Du hast noch nichts gemeldet.</Text>
      ) : (
        <VStack align="stretch" gap={2}>
          {liste.map((m) => {
            const meta = STATUS_META[m.status] || { label: m.status, color: 'gray' }
            return (
              <Box key={m.id} borderWidth="1px" borderRadius="lg" p={3} bg="white">
                <HStack align="flex-start" gap={3}>
                  {m.bild_url && <BedarfBild path={m.bild_url} />}
                  <VStack align="stretch" flex="1" gap={1}>
                    <HStack gap={2} flexWrap="wrap">
                      <Badge colorPalette={meta.color} size="sm">{meta.label}</Badge>
                      <Text fontSize="xs" color="fg.muted">Menge: {m.menge}</Text>
                      <Text fontSize="xs" color="fg.muted">Gemeldet: {fmt(m.created_at)}</Text>
                    </HStack>
                    <Text fontSize="sm">{m.beschreibung}</Text>
                    {m.lieferant_url && (
                      <a href={m.lieferant_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: '#3182CE', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Zum Lieferanten <ExternalLink size={12} />
                      </a>
                    )}
                    {m.admin_notiz && (
                      <Text fontSize="sm" color="red.700">Anmerkung: {m.admin_notiz}</Text>
                    )}
                  </VStack>
                  {m.status === 'offen' && (
                    <IconButton size="xs" variant="ghost" colorPalette="red"
                      onClick={() => deleteMutation.mutate({ id: m.id, bildUrl: m.bild_url })}
                      aria-label="Löschen">
                      <Trash2 size={14} />
                    </IconButton>
                  )}
                </HStack>
              </Box>
            )
          })}
        </VStack>
      )}
    </Box>
  )
}
