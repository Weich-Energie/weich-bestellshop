import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Box, Heading, Text, HStack, VStack, Button, Badge, Spinner, Flex, SimpleGrid, IconButton, Input } from '@chakra-ui/react'
import { Heart, ShoppingCart, ExternalLink, Plus, Minus } from 'lucide-react'
import { listArtikel } from '../../data/api/artikel.js'
import { listFavoritenIds, toggleFavorit } from '../../data/api/favoriten.js'
import { addZuWarenkorb } from '../../data/api/warenkorb.js'
import ArtikelBild from '../components/ArtikelBild.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

function FavKarte({ artikel, onUnfav, onCart }) {
  const [menge, setMenge] = useState(1)
  const [busy, setBusy] = useState(false)
  const varianten = artikel.varianten || []
  const gebinde = artikel.gebinde || []
  const [varianteId, setVarianteId] = useState(() => varianten[0]?.id || '')
  const [gebindeId, setGebindeId] = useState(() => (gebinde.find((g) => g.ist_default) || gebinde[0])?.id || '')
  const gebindeObj = gebinde.find((g) => g.id === gebindeId) || null
  const gesamtStk = gebindeObj ? menge * gebindeObj.stueckzahl : menge

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
        <IconButton size="sm" variant="ghost" colorPalette="red" onClick={onUnfav} aria-label="Entfernen">
          <Heart size={16} fill="currentColor" />
        </IconButton>
      </Box>
      <ArtikelBild artikel={artikel} size="100%" />
      <VStack align="stretch" gap={1}>
        <Text fontWeight="bold" fontSize="sm" lineClamp={2}>{artikel.name}</Text>
        {artikel.tags?.length > 0 && (
          <HStack gap={1} flexWrap="wrap">
            {artikel.tags.slice(0, 3).map((t) => <Badge key={t.id} size="xs" variant="subtle" colorPalette="blue">{t.name}</Badge>)}
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
          <IconButton size="xs" variant="ghost" onClick={() => setMenge((m) => Math.max(1, m - 1))} aria-label="Weniger"><Minus size={12} /></IconButton>
          <Input variant="flushed" size="sm" type="number" min={1} value={menge}
            onChange={(e) => setMenge(Math.max(1, Number(e.target.value) || 1))}
            textAlign="center" w="40px" border="none" px={0} />
          <IconButton size="xs" variant="ghost" onClick={() => setMenge((m) => m + 1)} aria-label="Mehr"><Plus size={12} /></IconButton>
        </HStack>
        <Button size="sm" colorPalette="blue" flex="1" loading={busy} onClick={handleCart}>
          <ShoppingCart size={14} /> In Warenkorb
        </Button>
        {artikel.lieferant_url && (
          <IconButton size="sm" variant="outline" asChild aria-label="Lieferant">
            <a href={artikel.lieferant_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
          </IconButton>
        )}
      </HStack>
      {gebindeObj && menge > 0 && (
        <Text fontSize="xs" color="fg.muted" textAlign="right">= {gesamtStk} Stk</Text>
      )}
    </Box>
  )
}

export default function FavoritenPage() {
  const { currentUser } = useAuth()
  const qc = useQueryClient()

  const { data: artikelListe = [], isLoading: la } = useQuery({
    queryKey: ['shop-artikel'],
    queryFn: () => listArtikel(),
  })
  const { data: favIds = [], isLoading: lf } = useQuery({
    queryKey: ['shop-favoriten', currentUser?.authId],
    queryFn: () => listFavoritenIds(currentUser.authId),
    enabled: !!currentUser?.authId,
  })

  const favSet = useMemo(() => new Set(favIds), [favIds])
  const favArtikel = useMemo(() => artikelListe.filter((a) => favSet.has(a.id)), [artikelListe, favSet])

  const favMutation = useMutation({
    mutationFn: ({ artikelId, currently }) => toggleFavorit(currentUser.authId, artikelId, currently),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-favoriten', currentUser.authId] }),
  })
  const cartMutation = useMutation({
    mutationFn: ({ artikelId, menge, varianteId, gebindeId }) =>
      addZuWarenkorb({ userId: currentUser.authId, artikelId, menge, varianteId, gebindeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-warenkorb', currentUser.authId] }),
  })

  if (la || lf) return <Flex justify="center" p={12}><Spinner size="xl" /></Flex>

  return (
    <Box>
      <Heading size="lg" mb={4}>Favoriten</Heading>
      {favArtikel.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py={12}>Noch keine Favoriten. Klick das ♥ auf einem Artikel im Katalog.</Text>
      ) : (
        <SimpleGrid columns={{ base: 2, md: 3, lg: 4, xl: 5 }} gap={4}>
          {favArtikel.map((a) => (
            <FavKarte
              key={a.id}
              artikel={a}
              onUnfav={() => favMutation.mutate({ artikelId: a.id, currently: true })}
              onCart={({ menge, varianteId, gebindeId }) => cartMutation.mutateAsync({ artikelId: a.id, menge, varianteId, gebindeId })}
            />
          ))}
        </SimpleGrid>
      )}
    </Box>
  )
}
