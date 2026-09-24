import React from 'react'
import { Box, Text, HStack, VStack, Button, Spinner, Flex, Spacer, Code } from '@chakra-ui/react'
import { AlertTriangle, StopCircle } from 'lucide-react'

// Zustand und Ergebnis des Sammellaufs. Bewusst eine Liste statt nur einer
// Zahl: bei 25 Artikeln ist die Frage nicht "hat es geklappt", sondern welche
// drei es nicht waren und warum.
export function SammelAnzeige({ sammel, onAbbrechen, onSchliessen }) {
  const { echt, gesamt, index, aktuell, ergebnisse = [], laeuft, abgebrochen } = sammel

  const art = (e) => {
    if (e.fehler) return 'fehler'
    if (e.antwort?.luecken) return 'luecken'
    if (e.antwort?.status === 'uebertragen') return 'angelegt'
    if (e.antwort?.status === 'trockenlauf') return 'bereit'
    if (e.antwort?.status === 'bereits_uebertragen') return 'schon_drin'
    return 'unklar'
  }
  const zaehle = (a) => ergebnisse.filter((e) => art(e) === a).length
  const stockend = ergebnisse.filter((e) => ['fehler', 'luecken'].includes(art(e)))
  const angebote = ergebnisse
    .map((e) => e.antwort?.angebot?.vorgangs_nummer)
    .filter(Boolean)

  const anteil = gesamt ? Math.round((index / gesamt) * 100) : 0

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} mb={3}
      borderColor={stockend.length ? 'orange.300' : laeuft ? 'blue.200' : 'green.300'}
      bg={stockend.length ? 'orange.50' : laeuft ? 'blue.50' : 'green.50'}>
      <Flex align="center" gap={2} mb={2} flexWrap="wrap">
        <Text fontSize="sm" fontWeight="bold">
          {echt ? 'Sammelübertragung' : 'Sammel-Probelauf'} — {index} von {gesamt}
        </Text>
        {laeuft && <Spinner size="xs" />}
        <Spacer />
        {laeuft ? (
          <Button size="xs" variant="outline" colorPalette="red" onClick={onAbbrechen}>
            <StopCircle size={12} /> Abbrechen
          </Button>
        ) : (
          <Button size="xs" variant="ghost" onClick={onSchliessen}>schließen</Button>
        )}
      </Flex>

      <Box h="6px" bg="blackAlpha.200" borderRadius="full" overflow="hidden" mb={2}>
        <Box h="100%" w={`${anteil}%`} bg={laeuft ? 'blue.500' : 'green.500'} transition="width .2s" />
      </Box>

      {laeuft && aktuell && (
        <Text fontSize="xs" color="fg.muted" mb={2}>läuft: {aktuell}</Text>
      )}

      <HStack gap={3} flexWrap="wrap" mb={stockend.length ? 2 : 0}>
        {echt
          ? <Text fontSize="sm">{zaehle('angelegt')} angelegt</Text>
          : <Text fontSize="sm">{zaehle('bereit')} bereit</Text>}
        {zaehle('schon_drin') > 0 && <Text fontSize="sm">{zaehle('schon_drin')} standen schon in PDS</Text>}
        {zaehle('luecken') > 0 && <Text fontSize="sm" color="red.700">{zaehle('luecken')} mit Lücken</Text>}
        {zaehle('fehler') > 0 && <Text fontSize="sm" color="red.700">{zaehle('fehler')} Fehler</Text>}
        {abgebrochen && <Text fontSize="sm" color="orange.700">abgebrochen</Text>}
      </HStack>

      {stockend.length > 0 && (
        <VStack align="stretch" gap={1} mt={1}>
          {stockend.map((e, i) => (
            <HStack key={i} gap={2} align="start">
              <Box color="red.500" mt="3px"><AlertTriangle size={13} /></Box>
              <Text fontSize="sm">
                <b>{e.artikel.name}</b>: {e.fehler || e.antwort.luecken.join('; ')}
              </Text>
            </HStack>
          ))}
        </VStack>
      )}

      {!laeuft && echt && angebote.length > 0 && (
        <Box borderWidth="1px" borderColor="blue.200" bg="blue.50" borderRadius="md" p={3} mt={3}>
          <Text fontSize="sm" fontWeight="medium" color="blue.800">
            {angebote.length} Musterangebote angelegt — erst danach steht der Verkaufspreis am Artikel
          </Text>
          <Text fontSize="sm" color="blue.900" mt={1}>
            Je Angebot im PDS-Client: Position 001 „in Katalog übernehmen“, dann das Angebot löschen.
            Sie hängen alle an der Weich GmbH als Kunde, kein echter Kunde sieht sie.
          </Text>
          <Code display="block" whiteSpace="pre-wrap" p={2} mt={2} fontSize="xs" borderRadius="md">
            {angebote.join('  ')}
          </Code>
        </Box>
      )}
    </Box>
  )
}
