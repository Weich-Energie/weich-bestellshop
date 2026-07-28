import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Heading, Text, HStack, VStack, Badge, Spinner, Flex, Button } from '@chakra-ui/react'
import { XCircle } from 'lucide-react'
import { listEigeneBestellungen, zurueckziehen } from '../../data/api/bestellungen.js'
import ArtikelBild from '../components/ArtikelBild.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

const STATUS_META = {
  pending:   { label: 'wartet auf Freigabe', color: 'orange' },
  approved:  { label: 'freigegeben',         color: 'blue'   },
  ordered:   { label: 'bestellt',            color: 'purple' },
  received:  { label: 'angekommen',          color: 'green'  },
  closed:    { label: 'abgeschlossen',       color: 'gray'   },
  rejected:  { label: 'abgelehnt',           color: 'red'    },
  cancelled: { label: 'zurückgezogen',       color: 'gray'   },
}

function fmt(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function BestellungenPage() {
  const { currentUser } = useAuth()
  const qc = useQueryClient()

  const { data: liste = [], isLoading } = useQuery({
    queryKey: ['shop-bestellungen', currentUser?.id],
    queryFn: () => listEigeneBestellungen(currentUser.id),
    enabled: !!currentUser?.id,
  })

  const withdrawMutation = useMutation({
    mutationFn: zurueckziehen,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-bestellungen', currentUser?.id] }),
  })

  if (isLoading) return <Flex justify="center" p={12}><Spinner size="xl" /></Flex>

  return (
    <Box>
      <Heading size="lg" mb={4}>Meine Bestellungen</Heading>
      {liste.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py={12}>Du hast noch keine Bestellungen abgeschickt.</Text>
      ) : (
        <VStack align="stretch" gap={3}>
          {liste.map((b) => {
            const meta = STATUS_META[b.status] || { label: b.status, color: 'gray' }
            const canWithdraw = b.status === 'pending'
            return (
              <Box key={b.id} borderWidth="1px" borderRadius="lg" p={3} bg="white">
                <HStack gap={3} align="flex-start">
                  <ArtikelBild artikel={b.shop_artikel} size="72px" />
                  <VStack align="stretch" gap={1} flex="1">
                    <HStack gap={2} flexWrap="wrap">
                      <Text fontWeight="bold" fontSize="sm">{b.shop_artikel?.name}</Text>
                      <Badge colorPalette={meta.color} size="sm">{meta.label}</Badge>
                    </HStack>
                    <HStack gap={4} fontSize="xs" color="fg.muted">
                      <Text>Menge: {b.menge}{b.shop_artikel?.einheit ? ` ${b.shop_artikel.einheit}` : ''}</Text>
                      <Text>Angefragt: {fmt(b.created_at)}</Text>
                    </HStack>
                    {b.notiz && <Text fontSize="sm" color="fg.muted">Notiz: {b.notiz}</Text>}
                    {b.reject_grund && <Text fontSize="sm" color="red.600">Abgelehnt: {b.reject_grund}</Text>}
                  </VStack>
                  {canWithdraw && (
                    <Button size="xs" variant="ghost" colorPalette="red" onClick={() => withdrawMutation.mutate(b.id)}>
                      <XCircle size={14} /> Zurückziehen
                    </Button>
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
