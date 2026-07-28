import React from 'react'
import { Box, Heading, Text } from '@chakra-ui/react'

export default function KatalogPage() {
  return (
    <Box>
      <Heading size="lg" mb={4}>Katalog</Heading>
      <Text color="fg.muted">
        Hier stehen die Katalog-Artikel als Kachel-Grid mit Filter-Sidebar (Kategorie, Tags, Suche).
        Aktuell nur Skeleton — kommt in Phase 2.
      </Text>
    </Box>
  )
}
