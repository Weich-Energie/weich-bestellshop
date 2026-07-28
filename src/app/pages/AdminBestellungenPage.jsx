import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Button, Badge, Spinner, Flex, Input, Field,
} from '@chakra-ui/react'
import { Check, Package, Truck, ExternalLink, ShoppingBag } from 'lucide-react'
import {
  listApprovedForSammel, createSammelbestellung,
  listAktiveSammelbestellungen, markiereBestellungReceived,
} from '../../data/api/orders.js'
import PositionText from '../components/PositionText.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

const NO_LIEFERANT = '— ohne Lieferant —'

function fmt(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function euro(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toFixed(2)} €`
}

function LieferantGruppe({ lieferant, requests, onAnlegen }) {
  const { currentUser } = useAuth()
  const [selected, setSelected] = useState(() => new Set(requests.map((r) => r.id))) // default: alle
  const [versand, setVersand] = useState('')
  const [externBestellNr, setExternBestellNr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const auswahl = requests.filter((r) => selected.has(r.id))
  const summe = auswahl.reduce((s, r) => s + (Number(r.shop_artikel?.preis_netto || 0) * r.menge), 0)
  const versandNum = versand ? Number(versand.replace(',', '.')) : 0
  const gesamt = summe + (isNaN(versandNum) ? 0 : versandNum)

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function anlegen() {
    if (auswahl.length === 0) return
    setBusy(true); setError(null)
    try {
      await onAnlegen({
        lieferant: lieferant === NO_LIEFERANT ? 'Unbekannt' : lieferant,
        requestIds: [...selected],
        versandkosten: versandNum || null,
        gesamtbetrag: gesamt || null,
        externBestellNr: externBestellNr.trim() || null,
        freigabeUserId: currentUser?.authId || null,
      })
    } catch (e) {
      setError(e.message || 'Anlegen fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="white" mb={3}>
      <Flex justify="space-between" align="center" mb={3} flexWrap="wrap" gap={2}>
        <HStack gap={2}>
          <Truck size={18} color="#3182CE" />
          <Heading size="md">{lieferant}</Heading>
          <Badge>{requests.length} Position{requests.length !== 1 ? 'en' : ''}</Badge>
        </HStack>
        <Text fontSize="sm" color="fg.muted">
          Auswahl: {auswahl.length} · Summe: {euro(summe)}
        </Text>
      </Flex>

      <VStack align="stretch" gap={1} mb={3}>
        {requests.map((r) => (
          <HStack key={r.id} justify="space-between" px={2} py={1} borderRadius="sm"
            bg={selected.has(r.id) ? 'blue.50' : undefined}
            _hover={{ bg: 'gray.50', cursor: 'pointer' }}
            onClick={() => toggle(r.id)}>
            <HStack gap={2} align="center">
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} />
              <PositionText artikel={r.shop_artikel} variante={r.variante} gebinde={r.gebinde} menge={r.menge} />
              {r.projekt_ref && <Badge size="xs" variant="outline">Projekt: {r.projekt_ref}</Badge>}
            </HStack>
            <Text fontSize="xs" color="fg.muted">
              {euro(r.shop_artikel?.preis_netto)} × {r.menge} = {euro(Number(r.shop_artikel?.preis_netto || 0) * r.menge)}
            </Text>
          </HStack>
        ))}
      </VStack>

      <HStack gap={2} flexWrap="wrap" align="flex-end">
        <Field.Root maxW="140px">
          <Field.Label>Versand (€)</Field.Label>
          <Input size="sm" value={versand} onChange={(e) => setVersand(e.target.value)} placeholder="0,00" />
        </Field.Root>
        <Field.Root maxW="220px">
          <Field.Label>Externe Bestell-Nr (optional)</Field.Label>
          <Input size="sm" value={externBestellNr} onChange={(e) => setExternBestellNr(e.target.value)} placeholder="z.B. Reichelt-Nr" />
        </Field.Root>
        <Flex flex="1" />
        <Box>
          <Text fontSize="xs" color="fg.muted">Gesamt</Text>
          <Text fontWeight="bold">{euro(gesamt)}</Text>
        </Box>
        <Button colorPalette="blue" onClick={anlegen} loading={busy} disabled={auswahl.length === 0}>
          <ShoppingBag size={14} /> Sammelbestellung anlegen
        </Button>
      </HStack>
      {error && <Text color="red.500" fontSize="sm" mt={2}>{error}</Text>}
    </Box>
  )
}

function OrderKarte({ order, onReceived }) {
  const [busy, setBusy] = useState(false)
  const positionen = order.shop_order_positions || []
  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
      <Flex justify="space-between" align="center" mb={2} flexWrap="wrap" gap={2}>
        <HStack gap={2} flexWrap="wrap">
          <Truck size={18} color="#805AD5" />
          <Heading size="sm">{order.lieferant}</Heading>
          <Badge colorPalette="purple">bestellt</Badge>
          {order.extern_bestell_nr && <Badge variant="outline">Nr {order.extern_bestell_nr}</Badge>}
          <Text fontSize="xs" color="fg.muted">Bestellt: {fmt(order.bestell_datum)}</Text>
        </HStack>
        <Button size="sm" colorPalette="green" loading={busy}
          onClick={async () => { setBusy(true); try { await onReceived(order.id) } finally { setBusy(false) } }}>
          <Check size={14} /> Wareneingang bestätigen
        </Button>
      </Flex>
      <VStack align="stretch" gap={1}>
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
      <HStack justify="space-between" mt={2} pt={2} borderTopWidth="1px" fontSize="sm">
        <Text color="fg.muted">Versand: {euro(order.versandkosten)}</Text>
        <Text fontWeight="bold">Gesamt: {euro(order.gesamtbetrag)}</Text>
      </HStack>
    </Box>
  )
}

export default function AdminBestellungenPage() {
  const qc = useQueryClient()

  const { data: approved = [], isLoading: la } = useQuery({
    queryKey: ['shop-approved-fuer-sammel'],
    queryFn: listApprovedForSammel,
  })
  const { data: aktive = [], isLoading: lb } = useQuery({
    queryKey: ['shop-orders-aktiv'],
    queryFn: listAktiveSammelbestellungen,
  })

  const gruppen = useMemo(() => {
    const m = new Map()
    for (const r of approved) {
      const key = r.shop_artikel?.lieferant?.trim() || NO_LIEFERANT
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(r)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [approved])

  const anlegenMutation = useMutation({
    mutationFn: createSammelbestellung,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-approved-fuer-sammel'] })
      qc.invalidateQueries({ queryKey: ['shop-orders-aktiv'] })
    },
  })
  const receivedMutation = useMutation({
    mutationFn: markiereBestellungReceived,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-orders-aktiv'] })
      // User-Bestellungen invalidieren (Status hat sich geaendert)
      qc.invalidateQueries({ queryKey: ['shop-bestellungen'] })
    },
  })

  if (la || lb) return <Flex justify="center" p={12}><Spinner size="xl" /></Flex>

  return (
    <Box>
      <Heading size="lg" mb={4}>Sammelbestellungen</Heading>

      <Box mb={6}>
        <HStack mb={3} gap={2}>
          <Package size={20} color="#3182CE" />
          <Heading size="md">Freigegeben — wartet auf Bestellung</Heading>
          {approved.length > 0 && <Badge colorPalette="blue">{approved.length}</Badge>}
        </HStack>

        {gruppen.length === 0 ? (
          <Text color="fg.muted" fontSize="sm">Nichts wartet aktuell auf eine Bestellung.</Text>
        ) : (
          gruppen.map(([lieferant, reqs]) => (
            <LieferantGruppe
              key={lieferant}
              lieferant={lieferant}
              requests={reqs}
              onAnlegen={(payload) => anlegenMutation.mutateAsync(payload)}
            />
          ))
        )}
      </Box>

      <Box>
        <HStack mb={3} gap={2}>
          <Truck size={20} color="#805AD5" />
          <Heading size="md">Aktive Sammelbestellungen</Heading>
          {aktive.length > 0 && <Badge colorPalette="purple">{aktive.length}</Badge>}
        </HStack>
        {aktive.length === 0 ? (
          <Text color="fg.muted" fontSize="sm">Keine aktiven Bestellungen.</Text>
        ) : (
          <VStack align="stretch" gap={3}>
            {aktive.map((o) => (
              <OrderKarte key={o.id} order={o} onReceived={(id) => receivedMutation.mutateAsync(id)} />
            ))}
          </VStack>
        )}
      </Box>
    </Box>
  )
}
