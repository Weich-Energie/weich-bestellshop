import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Button, Input, Badge, Spinner, Flex, Spacer,
  SimpleGrid, IconButton,
} from '@chakra-ui/react'
import { Search, Heart, ShoppingCart, ExternalLink, Plus, Minus } from 'lucide-react'
import { listArtikel, listAktiveOrderCounts } from '../../data/api/artikel.js'
import { listKategorien } from '../../data/api/kategorien.js'
import { listFavoritenIds, toggleFavorit } from '../../data/api/favoriten.js'
import { addZuWarenkorb } from '../../data/api/warenkorb.js'
import ArtikelBild from '../components/ArtikelBild.jsx'
import DoppelBestellHinweis from '../components/DoppelBestellHinweis.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

function ArtikelKarte({ artikel, kategorieName, favorisiert, aktiveCounts, onFav, onCart }) {
  const [busy, setBusy] = useState(false)
  const [menge, setMenge] = useState(1)
  const varianten = artikel.varianten || []
  const gebinde = artikel.gebinde || []
  const [varianteId, setVarianteId] = useState(() => varianten[0]?.id || '')
  const [gebindeId, setGebindeId] = useState(() => (gebinde.find((g) => g.ist_default) || gebinde[0])?.id || '')

  const gebindeObj = gebinde.find((g) => g.id === gebindeId) || null
  const gesamtStk = gebindeObj ? menge * gebindeObj.stueckzahl : menge

  // Warnung: aehnliche aktive Bestellungen fuer diese (artikel, variante)-Kombi
  const doppelInfo = useMemo(() => {
    if (!aktiveCounts) return null
    return aktiveCounts.find((c) => c.artikel_id === artikel.id && (c.variante_id || '') === (varianteId || '')) || null
  }, [aktiveCounts, artikel.id, varianteId])

  async function handleCart() {
    if (varianten.length > 0 && !varianteId) return
    setBusy(true)
    try {
      await onCart({ menge, varianteId: varianteId || null, gebindeId: gebindeId || null })
      setMenge(1)
    } finally { setBusy(false) }
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" bg="white" p={3} position="relative" display="flex" flexDirection="column" gap={2}>
      <Box position="absolute" top={2} right={2}>
        <IconButton size="sm" variant="ghost" colorPalette={favorisiert ? 'red' : 'gray'} onClick={onFav} aria-label="Favorit">
          <Heart size={16} fill={favorisiert ? 'currentColor' : 'none'} />
        </IconButton>
      </Box>
      <ArtikelBild artikel={artikel} size="100%" />
      <VStack align="stretch" gap={1}>
        <Text fontWeight="bold" fontSize="sm" lineClamp={2}>{artikel.name}</Text>
        {kategorieName && <Text fontSize="xs" color="fg.muted">{kategorieName}</Text>}
        {artikel.tags?.length > 0 && (
          <HStack gap={1} flexWrap="wrap">
            {artikel.tags.slice(0, 3).map((t) => (
              <Badge key={t.id} size="xs" variant="subtle" colorPalette="blue">{t.name}</Badge>
            ))}
          </HStack>
        )}
      </VStack>
      {varianten.length > 0 && (
        <select value={varianteId} onChange={(e) => setVarianteId(e.target.value)}
          style={{ padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}>
          {varianten.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      )}
      {gebinde.length > 0 && (
        <select value={gebindeId} onChange={(e) => setGebindeId(e.target.value)}
          style={{ padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}>
          {gebinde.map((g) => <option key={g.id} value={g.id}>{g.name} (à {g.stueckzahl} Stk)</option>)}
        </select>
      )}
      <HStack gap={2} mt="auto">
        <HStack gap={0} borderWidth="1px" borderRadius="md" bg="white">
          <IconButton size="xs" variant="ghost" onClick={() => setMenge((m) => Math.max(1, m - 1))} aria-label="Weniger">
            <Minus size={12} />
          </IconButton>
          <Input
            variant="flushed" size="sm" type="number" min={1} value={menge}
            onChange={(e) => setMenge(Math.max(1, Number(e.target.value) || 1))}
            textAlign="center" w="40px" border="none" px={0} />
          <IconButton size="xs" variant="ghost" onClick={() => setMenge((m) => m + 1)} aria-label="Mehr">
            <Plus size={12} />
          </IconButton>
        </HStack>
        <Button size="sm" colorPalette="blue" flex="1" loading={busy} onClick={handleCart}>
          <ShoppingCart size={14} /> In Warenkorb
        </Button>
        {artikel.lieferant_url && (
          <IconButton size="sm" variant="outline" asChild aria-label="Zum Lieferanten">
            <a href={artikel.lieferant_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
          </IconButton>
        )}
      </HStack>
      {gebindeObj && menge > 0 && (
        <Text fontSize="xs" color="fg.muted" textAlign="right">= {gesamtStk} Stk</Text>
      )}
      <DoppelBestellHinweis info={doppelInfo} />
    </Box>
  )
}

export default function KatalogPage() {
  const { currentUser } = useAuth()
  const qc = useQueryClient()
  const [suche, setSuche] = useState('')
  const [kategorieFilter, setKategorieFilter] = useState('')

  const { data: artikelListe = [], isLoading } = useQuery({
    queryKey: ['shop-artikel'],
    queryFn: () => listArtikel(),
  })
  const { data: kategorien = [] } = useQuery({
    queryKey: ['shop-kategorien'],
    queryFn: listKategorien,
  })
  const { data: favIds = [] } = useQuery({
    queryKey: ['shop-favoriten', currentUser?.authId],
    queryFn: () => listFavoritenIds(currentUser.authId),
    enabled: !!currentUser?.authId,
  })
  const { data: aktiveCounts = [] } = useQuery({
    queryKey: ['shop-aktive-counts'],
    queryFn: listAktiveOrderCounts,
    staleTime: 30_000,
  })

  const favSet = useMemo(() => new Set(favIds), [favIds])
  const kategorieMap = useMemo(() => new Map(kategorien.map((k) => [k.id, k])), [kategorien])

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase()
    return artikelListe.filter((a) => {
      if (kategorieFilter && a.kategorie_id !== kategorieFilter) return false
      if (!s) return true
      const haystack = [a.name, a.beschreibung, a.lieferant, ...(a.tags || []).map((t) => t.name)]
        .filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(s)
    })
  }, [artikelListe, suche, kategorieFilter])

  const favMutation = useMutation({
    mutationFn: ({ artikelId, currently }) => toggleFavorit(currentUser.authId, artikelId, currently),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-favoriten', currentUser.authId] }),
  })

  const cartMutation = useMutation({
    mutationFn: ({ artikelId, menge, varianteId, gebindeId }) =>
      addZuWarenkorb({ userId: currentUser.authId, artikelId, menge, varianteId, gebindeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-warenkorb', currentUser.authId] }),
  })

  return (
    <Box>
      <Flex mb={4} align="center" flexWrap="wrap" gap={2}>
        <Heading size="lg">Katalog</Heading>
        <Spacer />
        <HStack borderWidth="1px" borderRadius="md" px={2} bg="white">
          <Search size={14} />
          <Input variant="flushed" size="sm" placeholder="Suche..." value={suche} onChange={(e) => setSuche(e.target.value)} border="none" minW="200px" />
        </HStack>
      </Flex>

      <HStack gap={2} mb={4} flexWrap="wrap">
        <Button size="sm" variant={kategorieFilter === '' ? 'solid' : 'outline'} colorPalette={kategorieFilter === '' ? 'blue' : 'gray'} onClick={() => setKategorieFilter('')}>Alle</Button>
        {kategorien.map((k) => (
          <Button key={k.id} size="sm" variant={kategorieFilter === k.id ? 'solid' : 'outline'}
            colorPalette={kategorieFilter === k.id ? 'blue' : 'gray'} onClick={() => setKategorieFilter(k.id)}>
            {k.name}
          </Button>
        ))}
      </HStack>

      {isLoading ? (
        <Flex justify="center" p={12}><Spinner size="xl" /></Flex>
      ) : gefiltert.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py={12}>
          {artikelListe.length === 0 ? 'Der Katalog ist noch leer.' : 'Keine Treffer für deine Suche.'}
        </Text>
      ) : (
        <SimpleGrid columns={{ base: 2, md: 3, lg: 4, xl: 5 }} gap={4}>
          {gefiltert.map((a) => (
            <ArtikelKarte
              key={a.id}
              artikel={a}
              kategorieName={kategorieMap.get(a.kategorie_id)?.name}
              favorisiert={favSet.has(a.id)}
              aktiveCounts={aktiveCounts}
              onFav={() => favMutation.mutate({ artikelId: a.id, currently: favSet.has(a.id) })}
              onCart={({ menge, varianteId, gebindeId }) => cartMutation.mutateAsync({ artikelId: a.id, menge, varianteId, gebindeId })}
            />
          ))}
        </SimpleGrid>
      )}
    </Box>
  )
}
