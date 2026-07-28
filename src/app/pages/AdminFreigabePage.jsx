import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Button, Badge, Spinner, Flex, Input, IconButton,
} from '@chakra-ui/react'
import { Check, X, ExternalLink } from 'lucide-react'
import { listOffeneFreigaben, freigeben, ablehnen } from '../../data/api/bestellungen.js'
import PositionText from '../components/PositionText.jsx'

function fmt(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminFreigabePage() {
  const qc = useQueryClient()
  const [ablehnGrund, setAblehnGrund] = useState({}) // id → text
  const [ablehnOpen, setAblehnOpen] = useState({})   // id → bool

  const { data: liste = [], isLoading } = useQuery({
    queryKey: ['shop-freigaben'],
    queryFn: listOffeneFreigaben,
  })

  const freigMutation = useMutation({
    mutationFn: freigeben,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-freigaben'] }),
  })
  const ablehnMutation = useMutation({
    mutationFn: ({ id, grund }) => ablehnen(id, grund),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-freigaben'] }),
  })

  if (isLoading) return <Flex justify="center" p={12}><Spinner size="xl" /></Flex>

  return (
    <Box>
      <Heading size="lg" mb={4}>
        Freigaben {liste.length > 0 && <Badge colorPalette="orange" ml={2}>{liste.length} offen</Badge>}
      </Heading>

      {liste.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py={12}>Keine offenen Bestellwünsche.</Text>
      ) : (
        <VStack align="stretch" gap={3}>
          {liste.map((b) => {
            const isAbl = ablehnOpen[b.id]
            return (
              <Box key={b.id} borderWidth="1px" borderRadius="lg" p={4} bg="white">
                <HStack align="flex-start" gap={4}>
                  <VStack align="stretch" flex="1" gap={1}>
                    <HStack gap={2} flexWrap="wrap" align="center">
                      <PositionText artikel={b.shop_artikel} variante={b.variante} gebinde={b.gebinde} menge={b.menge} size="md" />
                      {b.shop_artikel?.preis_netto != null && (
                        <Badge variant="outline">≈ {(Number(b.shop_artikel.preis_netto) * b.menge).toFixed(2)} €</Badge>
                      )}
                    </HStack>
                    <HStack fontSize="xs" color="fg.muted" gap={4} flexWrap="wrap">
                      <Text>Lieferant: {b.shop_artikel?.lieferant || '—'}</Text>
                      <Text>Angefragt: {fmt(b.created_at)}</Text>
                      {b.projekt_ref && <Text>Projekt: {b.projekt_ref}</Text>}
                    </HStack>
                    {b.notiz && <Text fontSize="sm" mt={1}>Notiz: {b.notiz}</Text>}
                    {b.shop_artikel?.lieferant_url && (
                      <Box>
                        <a href={b.shop_artikel.lieferant_url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: '#3182CE', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          Zum Lieferanten <ExternalLink size={12} />
                        </a>
                      </Box>
                    )}
                  </VStack>
                  <VStack gap={2} align="flex-end" minW="180px">
                    {!isAbl ? (
                      <>
                        <Button colorPalette="green" size="sm" w="100%" onClick={() => freigMutation.mutate(b.id)}>
                          <Check size={14} /> Freigeben
                        </Button>
                        <Button colorPalette="red" variant="outline" size="sm" w="100%"
                          onClick={() => setAblehnOpen((s) => ({ ...s, [b.id]: true }))}>
                          <X size={14} /> Ablehnen
                        </Button>
                      </>
                    ) : (
                      <VStack gap={2} w="100%" align="stretch">
                        <Input size="sm" placeholder="Grund..." value={ablehnGrund[b.id] || ''}
                          onChange={(e) => setAblehnGrund((s) => ({ ...s, [b.id]: e.target.value }))} />
                        <HStack>
                          <Button size="xs" variant="ghost" onClick={() => setAblehnOpen((s) => ({ ...s, [b.id]: false }))}>Abbruch</Button>
                          <Button size="xs" colorPalette="red"
                            onClick={() => {
                              ablehnMutation.mutate({ id: b.id, grund: ablehnGrund[b.id] || null })
                              setAblehnOpen((s) => ({ ...s, [b.id]: false }))
                            }}>
                            Ablehnen
                          </Button>
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
    </Box>
  )
}
