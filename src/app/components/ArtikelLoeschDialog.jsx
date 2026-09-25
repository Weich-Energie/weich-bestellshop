import React, { useState } from 'react'
import { Box, Text, HStack, VStack, Button, Dialog, Portal } from '@chakra-ui/react'
import { Trash2, EyeOff, AlertTriangle } from 'lucide-react'

// Zeigt vor dem Loeschen, was an den Artikeln haengt: was es blockiert, was
// stillschweigend mitginge. Und bietet Ausblenden als umkehrbaren Weg an.
export default function ArtikelLoeschDialog({ daten, arbeitet, hinweis = null, onClose, onLoeschen, onAusblenden }) {
  const [verstanden, setVerstanden] = useState(false)
  React.useEffect(() => { setVerstanden(false) }, [daten])
  if (!daten) return null

  const { liste, je, unlesbar } = daten
  const blockiert = liste.filter((a) => (je.get(a.id)?.blockiert.length || 0) > 0)
  const loeschbar = liste.filter((a) => (je.get(a.id)?.blockiert.length || 0) === 0)

  // Folgen zusammenzaehlen, damit nicht 300 Zeilen Einzelnachweis dastehen.
  const folgen = new Map()
  for (const a of loeschbar) {
    for (const m of je.get(a.id)?.mitgeloescht || []) {
      folgen.set(m.was, (folgen.get(m.was) || 0) + m.anzahl)
    }
  }

  const ids = loeschbar.map((a) => a.id)

  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} size="lg">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                {liste.length === 1 ? `„${liste[0].name}" löschen?` : `${liste.length} Artikel löschen?`}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={3}>
                {hinweis && (
                  <Box borderWidth="1px" borderColor="blue.200" bg="blue.50" borderRadius="md" p={3}>
                    <Text fontSize="sm">{hinweis}</Text>
                  </Box>
                )}
                {blockiert.length > 0 && (
                  <Box borderWidth="1px" borderColor="red.300" bg="red.50" borderRadius="md" p={3}>
                    <HStack gap={2} align="start" mb={1}>
                      <Box color="red.600" mt="2px"><AlertTriangle size={15} /></Box>
                      <Text fontSize="sm" fontWeight="medium">
                        {blockiert.length} {blockiert.length === 1 ? 'Artikel lässt sich' : 'Artikel lassen sich'} nicht
                        löschen — {blockiert.length === 1 ? 'er ist' : 'sie sind'} noch in Verwendung.
                      </Text>
                    </HStack>
                    <VStack align="stretch" gap={0} pl={6}>
                      {blockiert.slice(0, 8).map((a) => (
                        <Text key={a.id} fontSize="sm">
                          {a.name} — {je.get(a.id).blockiert.map((b) => `${b.anzahl}× ${b.was}`).join(', ')}
                        </Text>
                      ))}
                      {blockiert.length > 8 && (
                        <Text fontSize="sm" color="fg.muted">und {blockiert.length - 8} weitere</Text>
                      )}
                    </VStack>
                    <Text fontSize="xs" color="fg.muted" mt={2}>
                      Für diese ist Ausblenden der richtige Weg: der Artikel verschwindet aus allen Listen,
                      die Bestellung oder Nachkalkulation bleibt aber nachvollziehbar.
                    </Text>
                  </Box>
                )}

                {loeschbar.length > 0 ? (
                  <Box>
                    <Text fontSize="sm" mb={2}>
                      <b>{loeschbar.length}</b> {loeschbar.length === 1 ? 'Artikel wird' : 'Artikel werden'} endgültig
                      gelöscht. Das ist nicht rückholbar.
                    </Text>
                    {folgen.size > 0 && (
                      <Box borderWidth="1px" borderColor="orange.300" bg="orange.50" borderRadius="md" p={3}>
                        <Text fontSize="sm" fontWeight="medium" mb={1}>Das geht mit:</Text>
                        <VStack align="stretch" gap={0}>
                          {[...folgen].map(([was, anzahl]) => (
                            <Text key={was} fontSize="sm">{anzahl}× {was}</Text>
                          ))}
                        </VStack>
                      </Box>
                    )}
                    {unlesbar.length > 0 && (
                      <Text fontSize="xs" color="orange.700" mt={2}>
                        Nicht prüfbar (kein Leserecht): {unlesbar.join(', ')}. Was dort hängt, geht ungefragt mit.
                      </Text>
                    )}
                  </Box>
                ) : (
                  <Text fontSize="sm">Kein Artikel aus der Auswahl ist löschbar.</Text>
                )}

                {loeschbar.length > 0 && (
                  <HStack gap={2} as="label" cursor="pointer">
                    <input type="checkbox" checked={verstanden}
                      onChange={(e) => setVerstanden(e.target.checked)} />
                    <Text fontSize="sm">
                      Ja, {loeschbar.length === 1 ? 'den Artikel' : `diese ${loeschbar.length} Artikel`} endgültig löschen.
                    </Text>
                  </HStack>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
              <Button variant="outline" disabled={arbeitet}
                onClick={() => onAusblenden(liste.map((a) => a.id))}>
                <EyeOff size={14} /> Stattdessen ausblenden
              </Button>
              <Button colorPalette="red" disabled={!verstanden || !loeschbar.length || arbeitet}
                loading={arbeitet} onClick={() => onLoeschen(ids)}>
                <Trash2 size={14} /> {loeschbar.length} löschen
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
