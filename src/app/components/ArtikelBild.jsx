import React, { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Image } from '@chakra-ui/react'
import { Package } from 'lucide-react'
import { getBildVorschauUrl } from '../../data/api/storage.js'

// Zeigt ein Artikel-Bild. Loest bei internem Storage-Path automatisch die signed URL auf.
// previewUrl gewinnt gegen den gespeicherten Stand — damit zeigt der Dialog schon vor
// dem Speichern, was tatsaechlich landet (KI-Bild-URL, getippte URL, gewaehlte Datei).
//
// Performance: jede Kachel braucht eine eigene signierte URL. Damit ein Katalog mit
// 60 Artikeln nicht 60 Requests auf einmal feuert, wird erst geladen, wenn die Kachel
// in Sichtweite kommt. Beim ersten Rendern sind das nur die sichtbaren Kacheln.
export default function ArtikelBild({
  artikel,
  previewUrl = null,
  size = '120px',
  kantenlaenge = 400,
  rounded = 'md',
  bg = 'gray.50',
}) {
  const bild = artikel?.bild_url
  const extern = !!artikel?.bild_ist_extern
  const [fehlt, setFehlt] = useState(false)
  const [sichtbar, setSichtbar] = useState(false)
  const boxRef = useRef(null)

  // rootMargin: 200px vorladen, damit beim Scrollen kein leeres Kaestchen aufblitzt
  useEffect(() => {
    if (sichtbar || previewUrl || !bild || extern) return
    const node = boxRef.current
    if (!node || typeof IntersectionObserver === 'undefined') { setSichtbar(true); return }
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setSichtbar(true) },
      { rootMargin: '200px' },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [sichtbar, previewUrl, bild, extern])

  const { data: signedUrl } = useQuery({
    queryKey: ['shop-artikel-bild', bild, kantenlaenge],
    queryFn: () => getBildVorschauUrl(bild, kantenlaenge),
    enabled: !!bild && !extern && !previewUrl && sichtbar,
    staleTime: 55 * 60_000, // signed URL laeuft nach 60min ab, refresh knapp davor
  })

  const src = previewUrl || (extern ? bild : signedUrl)

  // Nicht ladbare Fremd-URL (Hotlink-Schutz, 404) → Platzhalter statt kaputtem Bild
  useEffect(() => { setFehlt(false) }, [src])

  return (
    <Box
      ref={boxRef}
      w={size} h={size} borderRadius={rounded} bg={bg} borderWidth="1px"
      overflow="hidden" display="flex" alignItems="center" justifyContent="center"
    >
      {src && !fehlt ? (
        <Image src={src} alt={artikel?.name || ''} w="100%" h="100%" objectFit="cover"
          loading="lazy" decoding="async" onError={() => setFehlt(true)} />
      ) : (
        <Package size={32} color="#9ca3af" />
      )}
    </Box>
  )
}
