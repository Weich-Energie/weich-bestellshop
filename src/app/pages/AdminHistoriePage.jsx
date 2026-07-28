import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Badge, Spinner, Flex, Input, Spacer,
} from '@chakra-ui/react'
import { Search, Truck, Package } from 'lucide-react'
import { listAbgeschlosseneSammelbestellungen } from '../../data/api/orders.js'
import PositionText from '../components/PositionText.jsx'

function fmt(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function euro(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toFixed(2)} €`
}

function OrderDetail({ order }) {
  const positionen = order.shop_order_positions || []
  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
      <Flex justify="space-between" align="center" mb={2} flexWrap="wrap" gap={2}>
        <HStack gap={2} flexWrap="wrap">
          <Truck size={18} color="#38A169" />
          <Heading size="sm">{order.lieferant}</Heading>
          <Badge colorPalette="green">abgeschlossen</Badge>
          {order.extern_bestell_nr && <Badge variant="outline">Nr {order.extern_bestell_nr}</Badge>}
        </HStack>
        <Text fontSize="xs" color="fg.muted">Bestellt: {fmt(order.bestell_datum)}</Text>
      </Flex>
      <VStack align="stretch" gap={1} mb={2}>
        {positionen.map((p) => {
          const req = p.shop_order_requests
          return (
            <HStack key={p.id} justify="space-between" fontSize="sm" align="center">
              <PositionText artikel={req?.shop_artikel} variante={req?.variante} gebinde={req?.gebinde} menge={p.menge} />
              <Text color="fg.muted">{euro(p.einzelpreis_netto)}</Text>
            </HStack>
          )
        })}
      </VStack>
      <HStack justify="space-between" pt={2} borderTopWidth="1px" fontSize="sm">
        <Text color="fg.muted">Versand: {euro(order.versandkosten)}</Text>
        <Text fontWeight="bold">Gesamt: {euro(order.gesamtbetrag)}</Text>
      </HStack>
    </Box>
  )
}

export default function AdminHistoriePage() {
  const [suche, setSuche] = useState('')
  const [lieferantFilter, setLieferantFilter] = useState('')

  const { data: liste = [], isLoading } = useQuery({
    queryKey: ['shop-orders-historie'],
    queryFn: () => listAbgeschlosseneSammelbestellungen(200),
  })

  const lieferanten = useMemo(() => {
    const set = new Set()
    for (const o of liste) if (o.lieferant) set.add(o.lieferant)
    return [...set].sort()
  }, [liste])

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase()
    return liste.filter((o) => {
      if (lieferantFilter && o.lieferant !== lieferantFilter) return false
      if (!s) return true
      const positionen = (o.shop_order_positions || []).map((p) => p.shop_order_requests?.shop_artikel?.name || '').join(' ')
      const haystack = [o.lieferant, o.extern_bestell_nr, positionen].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(s)
    })
  }, [liste, suche, lieferantFilter])

  const summeAlle = gefiltert.reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0)

  if (isLoading) return <Flex justify="center" p={12}><Spinner size="xl" /></Flex>

  return (
    <Box>
      <Flex mb={4} align="center" flexWrap="wrap" gap={2}>
        <Heading size="lg">Bestellhistorie</Heading>
        {liste.length > 0 && <Badge colorPalette="green" ml={2}>{liste.length} gesamt</Badge>}
        <Spacer />
        <HStack borderWidth="1px" borderRadius="md" px={2} bg="white">
          <Search size={14} />
          <Input variant="flushed" size="sm" placeholder="Suche (Lieferant, Artikel, Bestell-Nr)..." value={suche} onChange={(e) => setSuche(e.target.value)} border="none" minW="260px" />
        </HStack>
      </Flex>

      <HStack gap={2} mb={4} flexWrap="wrap">
        <select value={lieferantFilter} onChange={(e) => setLieferantFilter(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6 }}>
          <option value="">Alle Lieferanten</option>
          {lieferanten.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <Spacer />
        <Text fontSize="sm" color="fg.muted">
          {gefiltert.length} Bestellung{gefiltert.length !== 1 ? 'en' : ''} · Summe {euro(summeAlle)}
        </Text>
      </HStack>

      {gefiltert.length === 0 ? (
        <Flex direction="column" align="center" gap={3} py={12}>
          <Package size={40} color="#9ca3af" />
          <Text color="fg.muted">
            {liste.length === 0
              ? 'Noch keine abgeschlossenen Bestellungen — Historie fuellt sich sobald Bestellungen als received markiert werden.'
              : 'Keine Treffer.'}
          </Text>
        </Flex>
      ) : (
        <VStack align="stretch" gap={3}>
          {gefiltert.map((o) => <OrderDetail key={o.id} order={o} />)}
        </VStack>
      )}
    </Box>
  )
}
