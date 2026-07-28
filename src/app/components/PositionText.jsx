import React from 'react'
import { Badge, HStack, Text, VStack } from '@chakra-ui/react'

// Einheitliche Darstellung einer Bestell-Position: Name + Variante + Menge (mit Gebinde-Info).
export default function PositionText({ artikel, variante, gebinde, menge, size = 'sm' }) {
  const einheit = artikel?.einheit || 'Stk'
  const gesamt = gebinde ? menge * gebinde.stueckzahl : menge
  return (
    <VStack align="stretch" gap={0}>
      <HStack gap={2} flexWrap="wrap">
        <Text fontWeight="bold" fontSize={size}>{artikel?.name || '—'}</Text>
        {variante?.name && <Badge size="sm" colorPalette="purple">{variante.name}</Badge>}
      </HStack>
      {gebinde ? (
        <Text fontSize="xs" color="fg.muted">
          {menge} × {gebinde.name} (à {gebinde.stueckzahl} Stk) = <strong>{gesamt} Stk</strong>
        </Text>
      ) : (
        <Text fontSize="xs" color="fg.muted">{menge} {einheit}</Text>
      )}
    </VStack>
  )
}
