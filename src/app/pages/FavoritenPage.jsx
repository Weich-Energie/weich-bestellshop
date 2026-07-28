import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Box, Heading, Text, HStack, VStack, Button, Badge, Spinner, Flex, SimpleGrid, IconButton } from '@chakra-ui/react'
import { Heart, ShoppingCart, ExternalLink } from 'lucide-react'
import { listArtikel } from '../../data/api/artikel.js'
import { listFavoritenIds, toggleFavorit } from '../../data/api/favoriten.js'
import { addZuWarenkorb } from '../../data/api/warenkorb.js'
import ArtikelBild from '../components/ArtikelBild.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function FavoritenPage() {
  const { currentUser } = useAuth()
  const qc = useQueryClient()

  const { data: artikelListe = [], isLoading: la } = useQuery({
    queryKey: ['shop-artikel'],
    queryFn: () => listArtikel(),
  })
  const { data: favIds = [], isLoading: lf } = useQuery({
    queryKey: ['shop-favoriten', currentUser?.id],
    queryFn: () => listFavoritenIds(currentUser.id),
    enabled: !!currentUser?.id,
  })

  const favSet = useMemo(() => new Set(favIds), [favIds])
  const favArtikel = useMemo(() => artikelListe.filter((a) => favSet.has(a.id)), [artikelListe, favSet])

  const favMutation = useMutation({
    mutationFn: ({ artikelId, currently }) => toggleFavorit(currentUser.id, artikelId, currently),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-favoriten', currentUser.id] }),
  })
  const cartMutation = useMutation({
    mutationFn: (artikelId) => addZuWarenkorb({ userId: currentUser.id, artikelId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop-warenkorb', currentUser.id] }),
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
            <Box key={a.id} borderWidth="1px" borderRadius="lg" bg="white" p={3} position="relative" display="flex" flexDirection="column" gap={2}>
              <Box position="absolute" top={2} right={2}>
                <IconButton size="sm" variant="ghost" colorPalette="red"
                  onClick={() => favMutation.mutate({ artikelId: a.id, currently: true })} aria-label="Entfernen">
                  <Heart size={16} fill="currentColor" />
                </IconButton>
              </Box>
              <ArtikelBild artikel={a} size="100%" />
              <VStack align="stretch" gap={1}>
                <Text fontWeight="bold" fontSize="sm" lineClamp={2}>{a.name}</Text>
                {a.tags?.length > 0 && (
                  <HStack gap={1} flexWrap="wrap">
                    {a.tags.slice(0, 3).map((t) => <Badge key={t.id} size="xs" variant="subtle" colorPalette="blue">{t.name}</Badge>)}
                  </HStack>
                )}
              </VStack>
              <HStack gap={2} mt="auto">
                <Button size="sm" colorPalette="blue" flex="1"
                  onClick={() => cartMutation.mutate(a.id)}>
                  <ShoppingCart size={14} /> In Warenkorb
                </Button>
                {a.lieferant_url && (
                  <IconButton size="sm" variant="outline" asChild aria-label="Lieferant">
                    <a href={a.lieferant_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
                  </IconButton>
                )}
              </HStack>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Box>
  )
}
