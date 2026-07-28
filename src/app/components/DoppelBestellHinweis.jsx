import React from 'react'
import { HStack, Text, Badge, Tooltip } from '@chakra-ui/react'
import { AlertTriangle } from 'lucide-react'

function tagevor(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr).getTime()
  const diff = Date.now() - d
  const tage = Math.floor(diff / (24 * 3600 * 1000))
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  if (tage < 7) return `vor ${tage} Tagen`
  const wochen = Math.floor(tage / 7)
  if (wochen === 1) return 'vor 1 Woche'
  return `vor ${wochen} Wochen`
}

// Warnung, wenn dieser Artikel (ggf. Variante) bereits in aktiven Bestellungen ist.
// info: { anzahl, menge_summe, letztes_datum } — oder null (kein aktiver).
export default function DoppelBestellHinweis({ info, compact = false }) {
  if (!info || info.anzahl === 0) return null
  const label = compact
    ? `⚠ ${info.anzahl}× aktiv`
    : `⚠ Schon ${info.anzahl}× in Bestellung (letzte ${tagevor(info.letztes_datum)}), Gesamt-Menge ${info.menge_summe}`
  return (
    <HStack gap={1}>
      <Badge colorPalette="orange" size="xs">
        <HStack gap={1}>
          <AlertTriangle size={10} />
          <Text fontSize="xs">{label}</Text>
        </HStack>
      </Badge>
    </HStack>
  )
}
