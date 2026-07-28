import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Image } from '@chakra-ui/react'
import { Package } from 'lucide-react'
import { getSignedUrl } from '../../data/api/storage.js'

// Zeigt ein Artikel-Bild. Loest bei internem Storage-Path automatisch die signed URL auf.
export default function ArtikelBild({ artikel, size = '120px', rounded = 'md', bg = 'gray.50' }) {
  const bild = artikel?.bild_url
  const extern = !!artikel?.bild_ist_extern

  const { data: signedUrl } = useQuery({
    queryKey: ['shop-artikel-bild', bild],
    queryFn: () => getSignedUrl(bild),
    enabled: !!bild && !extern,
    staleTime: 55 * 60_000, // signed URL laeuft nach 60min ab, refresh knapp davor
  })

  const src = extern ? bild : signedUrl

  return (
    <Box w={size} h={size} borderRadius={rounded} bg={bg} borderWidth="1px" overflow="hidden" display="flex" alignItems="center" justifyContent="center">
      {src ? (
        <Image src={src} alt={artikel?.name || ''} w="100%" h="100%" objectFit="cover" />
      ) : (
        <Package size={32} color="#9ca3af" />
      )}
    </Box>
  )
}
