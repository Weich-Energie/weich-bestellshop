import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Image } from '@chakra-ui/react'
import { Package } from 'lucide-react'
import { getSignedUrl } from '../../data/api/storage.js'

// Zeigt ein Artikel-Bild. Loest bei internem Storage-Path automatisch die signed URL auf.
// previewUrl gewinnt gegen den gespeicherten Stand — damit zeigt der Dialog schon vor
// dem Speichern, was tatsaechlich landet (KI-Bild-URL, getippte URL, gewaehlte Datei).
export default function ArtikelBild({ artikel, previewUrl = null, size = '120px', rounded = 'md', bg = 'gray.50' }) {
  const bild = artikel?.bild_url
  const extern = !!artikel?.bild_ist_extern
  const [fehlt, setFehlt] = useState(false)

  const { data: signedUrl } = useQuery({
    queryKey: ['shop-artikel-bild', bild],
    queryFn: () => getSignedUrl(bild),
    enabled: !!bild && !extern && !previewUrl,
    staleTime: 55 * 60_000, // signed URL laeuft nach 60min ab, refresh knapp davor
  })

  const src = previewUrl || (extern ? bild : signedUrl)

  // Nicht ladbare Fremd-URL (Hotlink-Schutz, 404) → Platzhalter statt kaputtem Bild
  useEffect(() => { setFehlt(false) }, [src])

  return (
    <Box w={size} h={size} borderRadius={rounded} bg={bg} borderWidth="1px" overflow="hidden" display="flex" alignItems="center" justifyContent="center">
      {src && !fehlt ? (
        <Image src={src} alt={artikel?.name || ''} w="100%" h="100%" objectFit="cover"
          onError={() => setFehlt(true)} />
      ) : (
        <Package size={32} color="#9ca3af" />
      )}
    </Box>
  )
}
