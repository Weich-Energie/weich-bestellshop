import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Flex, VStack, Heading, Input, Button, Text, Field } from '@chakra-ui/react'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

// Ziel des Links aus der Passwort-Reset-Email (siehe resetPassword im AuthContext:
// redirectTo zeigt auf /bestellshop/update-password). Die Route liegt bewusst
// AUSSERHALB des geschuetzten Bereichs: wer sein Passwort vergessen hat, soll es
// setzen koennen, ohne vorher am Zugriffs-Check zu haengen.
//
// Die Session kommt aus dem Link selbst — supabaseClient laeuft mit
// detectSessionInUrl, liest das Token also beim Laden aus der URL.
const MIN_LAENGE = 8

export default function UpdatePasswordPage() {
  const { session, loading, updatePassword } = useAuth()
  const [passwort, setPasswort] = useState('')
  const [wiederholung, setWiederholung] = useState('')
  const [fehler, setFehler] = useState(null)
  const [fertig, setFertig] = useState(false)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setFehler(null)
    if (passwort.length < MIN_LAENGE) {
      setFehler(`Das Passwort braucht mindestens ${MIN_LAENGE} Zeichen.`)
      return
    }
    if (passwort !== wiederholung) {
      setFehler('Die beiden Eingaben sind nicht gleich.')
      return
    }
    setBusy(true)
    try {
      await updatePassword(passwort)
      setFertig(true)
    } catch (err) {
      // Ein abgebrochener Netzwerk-Aufruf meldet sich als "Failed to fetch" —
      // damit kann ein Monteur nichts anfangen.
      const roh = err.message || ''
      setFehler(/failed to fetch|network|load failed/i.test(roh)
        ? 'Keine Verbindung zum Server. Bitte noch einmal versuchen.'
        : roh || 'Passwort setzen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50" p={4}>
      <Box bg="white" borderWidth="1px" borderRadius="lg" p={8} maxW="400px" w="100%">
        <VStack gap={4} align="stretch">
          <VStack gap={2}>
            <KeyRound size={40} color="#3182CE" />
            <Heading size="lg">Neues Passwort</Heading>
            <Text fontSize="sm" color="fg.muted">WEICHENERGIE Bestellshop</Text>
          </VStack>

          {loading ? (
            <Text fontSize="sm" color="fg.muted" textAlign="center">Moment…</Text>
          ) : fertig ? (
            <VStack gap={3} align="stretch">
              <Text fontSize="sm" color="green.600">
                Passwort gespeichert. Du kannst dich damit ab jetzt anmelden.
              </Text>
              <Button colorPalette="blue" onClick={() => navigate('/', { replace: true })}>
                Weiter zum Shop
              </Button>
            </VStack>
          ) : !session ? (
            // Ohne Session steckt kein gueltiges Token in der URL: Link abgelaufen,
            // schon benutzt, oder jemand ruft die Seite direkt auf.
            <VStack gap={3} align="stretch">
              <Text fontSize="sm" color="orange.600">
                Dieser Link ist abgelaufen oder wurde schon benutzt. Fordere auf der
                Anmelde-Seite einen neuen an.
              </Text>
              <Button variant="outline" onClick={() => navigate('/login', { replace: true })}>
                Zur Anmeldung
              </Button>
            </VStack>
          ) : (
            <form onSubmit={onSubmit}>
              <VStack gap={3} align="stretch">
                <Field.Root required>
                  <Field.Label>Neues Passwort</Field.Label>
                  <Input type="password" value={passwort} autoComplete="new-password"
                    onChange={(e) => setPasswort(e.target.value)} required />
                  <Field.HelperText>Mindestens {MIN_LAENGE} Zeichen.</Field.HelperText>
                </Field.Root>
                <Field.Root required>
                  <Field.Label>Noch einmal</Field.Label>
                  <Input type="password" value={wiederholung} autoComplete="new-password"
                    onChange={(e) => setWiederholung(e.target.value)} required />
                </Field.Root>
                {fehler && <Text color="red.500" fontSize="sm">{fehler}</Text>}
                <Button type="submit" colorPalette="blue" loading={busy}>Passwort speichern</Button>
              </VStack>
            </form>
          )}
        </VStack>
      </Box>
    </Flex>
  )
}
