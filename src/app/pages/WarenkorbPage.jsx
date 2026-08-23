import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Box, Heading, Text, HStack, VStack, Button, Input, Spinner, Flex, IconButton,
  Textarea,
} from '@chakra-ui/react'
import { Trash2, Send, ShoppingCart } from 'lucide-react'
import {
  listWarenkorb, updateWarenkorbPosition, removeWarenkorbPosition, bestellungAbschicken,
} from '../../data/api/warenkorb.js'
import ArtikelBild from '../components/ArtikelBild.jsx'
import PositionText from '../components/PositionText.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

// Eigenes Feld mit lokalem Zustand: vorher hing der Wert direkt am Server und
// jeder Tastendruck loeste ein UPDATE aus — aus "12" wurden zwei Schreibvorgaenge,
// und zwischendurch sprang die Anzeige auf den noch nicht aktualisierten Wert
// zurueck. Geschrieben wird jetzt beim Verlassen des Feldes oder mit Enter.
function MengeFeld({ wert, onCommit }) {
  const [text, setText] = useState(String(wert))
  useEffect(() => { setText(String(wert)) }, [wert])

  function uebernehmen() {
    const zahl = Math.max(1, Math.floor(Number(String(text).replace(',', '.')) || 1))
    setText(String(zahl))
    if (zahl !== wert) onCommit(zahl)
  }

  return (
    <Input
      type="number" min={1} size="sm" w="70px" value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={uebernehmen}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      aria-label="Menge" />
  )
}

export default function WarenkorbPage() {
  const { currentUser } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const { data: positionen = [], isLoading } = useQuery({
    queryKey: ['shop-warenkorb', currentUser?.authId],
    queryFn: () => listWarenkorb(currentUser.authId),
    enabled: !!currentUser?.authId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['shop-warenkorb', currentUser?.authId] })

  const updateMutation = useMutation({ mutationFn: ({ id, patch }) => updateWarenkorbPosition(id, patch), onSuccess: invalidate })
  const removeMutation = useMutation({ mutationFn: (id) => removeWarenkorbPosition(id), onSuccess: invalidate })

  async function abschicken() {
    setSubmitting(true); setError(null)
    try {
      const sent = await bestellungAbschicken(currentUser.authId)
      invalidate()
      qc.invalidateQueries({ queryKey: ['shop-bestellungen', currentUser.authId] })
      if (sent.length) navigate('/bestellungen')
    } catch (e) {
      setError(e.message || 'Absenden fehlgeschlagen')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return <Flex justify="center" p={12}><Spinner size="xl" /></Flex>

  return (
    <Box>
      <Heading size="lg" mb={4}>Warenkorb</Heading>

      {positionen.length === 0 ? (
        <Flex direction="column" align="center" gap={3} py={12}>
          <ShoppingCart size={48} color="#9ca3af" />
          <Text color="fg.muted">Dein Warenkorb ist leer.</Text>
          <Button size="sm" colorPalette="blue" onClick={() => navigate('/katalog')}>Zum Katalog</Button>
        </Flex>
      ) : (
        <>
          <VStack align="stretch" gap={3}>
            {positionen.map((p) => (
              <Box key={p.id} borderWidth="1px" borderRadius="lg" p={3} bg="white">
                <HStack gap={3} align="flex-start">
                  <ArtikelBild artikel={p.shop_artikel} size="80px" kantenlaenge={200} />
                  <VStack align="stretch" gap={1} flex="1">
                    <PositionText
                      artikel={p.shop_artikel}
                      variante={p.variante}
                      gebinde={p.gebinde}
                      menge={p.menge} />
                    <Textarea size="sm" placeholder="Notiz (optional)..." rows={1}
                      defaultValue={p.notiz || ''}
                      onBlur={(e) => e.target.value !== (p.notiz || '') && updateMutation.mutate({ id: p.id, patch: { notiz: e.target.value || null } })} />
                  </VStack>
                  <VStack gap={2} align="flex-end">
                    <HStack>
                      <Text fontSize="xs" color="fg.muted">Menge</Text>
                      <MengeFeld
                        wert={p.menge}
                        onCommit={(menge) => updateMutation.mutate({ id: p.id, patch: { menge } })} />
                    </HStack>
                    <IconButton size="xs" variant="ghost" colorPalette="red"
                      onClick={() => removeMutation.mutate(p.id)} aria-label="Entfernen">
                      <Trash2 size={14} />
                    </IconButton>
                  </VStack>
                </HStack>
              </Box>
            ))}
          </VStack>

          {error && <Text color="red.500" fontSize="sm" mt={3}>{error}</Text>}

          <HStack mt={6} justify="flex-end">
            <Text fontSize="sm" color="fg.muted">{positionen.length} Position{positionen.length !== 1 ? 'en' : ''}</Text>
            <Button colorPalette="blue" size="lg" onClick={abschicken} loading={submitting}>
              <Send size={16} /> Bestellung abschicken
            </Button>
          </HStack>
        </>
      )}
    </Box>
  )
}
