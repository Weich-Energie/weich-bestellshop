import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Stack, Button, Input, Badge, Spinner, Flex,
  Spacer, IconButton, Field, Dialog, Portal,
} from '@chakra-ui/react'
import { Plus, Trash2, KeyRound, Check, X, Truck, ExternalLink } from 'lucide-react'
import {
  listLieferanten, createLieferant, updateLieferant, deleteLieferant,
  setzeZugang, loescheZugang,
} from '../../data/api/lieferanten.js'

function datum(wert) {
  if (!wert) return null
  return new Date(wert).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Dialog zum Setzen der Zugangsdaten. Bewusst schlicht: zwei Felder, ein Knopf.
function ZugangDialog({ open, onClose, lieferant, onGespeichert }) {
  const [benutzer, setBenutzer] = useState('')
  const [passwort, setPasswort] = useState('')
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState(null)

  React.useEffect(() => {
    if (open) { setBenutzer(''); setPasswort(''); setFehler(null) }
  }, [open, lieferant?.id])

  async function speichern() {
    setBusy(true); setFehler(null)
    try {
      await setzeZugang(lieferant.id, benutzer, passwort)
      setPasswort('')
      onGespeichert?.()
      onClose()
    } catch (e) {
      setFehler(e.message || 'Speichern fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Zugang für {lieferant?.name}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton size="sm" variant="ghost" aria-label="Schließen"><X size={16} /></IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={3} align="stretch">
                <Box borderWidth="1px" borderRadius="md" p={3} bg="blue.50" borderColor="blue.200">
                  <Text fontSize="sm">
                    Die Daten werden verschlüsselt gespeichert und können danach <b>nicht mehr
                    angezeigt</b> werden — auch nicht von dir. Zum Ändern einfach neu eintragen.
                  </Text>
                </Box>
                <Field.Root required>
                  <Field.Label>Benutzername / Kundennummer</Field.Label>
                  <Input value={benutzer} onChange={(e) => setBenutzer(e.target.value)}
                    autoComplete="off" placeholder="wie im Lieferanten-Portal" />
                </Field.Root>
                <Field.Root required>
                  <Field.Label>Passwort</Field.Label>
                  <Input type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)}
                    autoComplete="new-password" />
                </Field.Root>
                {fehler && <Text color="red.500" fontSize="sm">{fehler}</Text>}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
              <Button colorPalette="blue" onClick={speichern} loading={busy}
                disabled={!benutzer.trim() || !passwort}>
                Zugang speichern
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

function LieferantKarte({ lieferant, onZugang, onRefresh }) {
  const [name, setName] = useState(lieferant.name)
  const [loginUrl, setLoginUrl] = useState(lieferant.login_url || '')
  const [busy, setBusy] = useState(false)
  const geaendert = name !== lieferant.name || loginUrl !== (lieferant.login_url || '')

  async function speichern() {
    setBusy(true)
    try {
      await updateLieferant(lieferant.id, { name: name.trim(), login_url: loginUrl.trim() || null })
      onRefresh()
    } finally { setBusy(false) }
  }

  async function entfernen() {
    if (!window.confirm(`Lieferant "${lieferant.name}" wirklich löschen?`)) return
    setBusy(true)
    try { await deleteLieferant(lieferant.id); onRefresh() } finally { setBusy(false) }
  }

  const gesetzt = !!lieferant.zugang_gesetzt_am

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
      <Flex align="center" gap={3} mb={3} flexWrap="wrap">
        <Text fontWeight="bold">{lieferant.name}</Text>
        {gesetzt ? (
          <Badge colorPalette="green" size="sm"><Check size={12} /> Zugang hinterlegt</Badge>
        ) : (
          <Badge colorPalette="orange" size="sm">kein Zugang</Badge>
        )}
        <Spacer />
        <IconButton size="sm" variant="ghost" colorPalette="red" onClick={entfernen}
          loading={busy} aria-label="Löschen">
          <Trash2 size={14} />
        </IconButton>
      </Flex>

      <Stack direction={{ base: 'column', md: 'row' }} gap={2} mb={3}>
        <Field.Root flex="1">
          <Field.Label fontSize="xs">Name</Field.Label>
          <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} />
        </Field.Root>
        <Field.Root flex="2">
          <Field.Label fontSize="xs">Adresse der Login-Seite</Field.Label>
          <Input size="sm" value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)}
            placeholder="https://..." />
        </Field.Root>
      </Stack>

      <Stack direction={{ base: 'column', sm: 'row' }} gap={2}>
        <Button size="sm" colorPalette="blue" variant={gesetzt ? 'outline' : 'solid'}
          onClick={() => onZugang(lieferant)}>
          <KeyRound size={14} /> {gesetzt ? 'Zugang ersetzen' : 'Zugang hinterlegen'}
        </Button>
        {gesetzt && (
          <Button size="sm" variant="ghost" colorPalette="red" loading={busy}
            onClick={async () => {
              if (!window.confirm('Hinterlegten Zugang entfernen?')) return
              setBusy(true)
              try { await loescheZugang(lieferant.id); onRefresh() } finally { setBusy(false) }
            }}>
            Zugang entfernen
          </Button>
        )}
        {lieferant.login_url && (
          <Button size="sm" variant="ghost" asChild>
            <a href={lieferant.login_url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Portal öffnen
            </a>
          </Button>
        )}
        <Spacer />
        {geaendert && (
          <Button size="sm" colorPalette="green" onClick={speichern} loading={busy}>Änderungen speichern</Button>
        )}
      </Stack>

      {gesetzt && (
        <Text fontSize="xs" color="fg.muted" mt={2}>
          Zugang hinterlegt am {datum(lieferant.zugang_gesetzt_am)}
        </Text>
      )}
    </Box>
  )
}

export default function AdminLieferantenPage() {
  const qc = useQueryClient()
  const [neuName, setNeuName] = useState('')
  const [zugangFuer, setZugangFuer] = useState(null)

  const { data: lieferanten = [], isLoading } = useQuery({
    queryKey: ['shop-lieferanten'],
    queryFn: listLieferanten,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['shop-lieferanten'] })

  const anlegen = useMutation({
    mutationFn: () => createLieferant({ name: neuName }),
    onSuccess: () => { setNeuName(''); refresh() },
  })

  return (
    <Box>
      <Flex mb={4} align="center" gap={2} flexWrap="wrap">
        <Heading size="lg"><HStack gap={2} display="inline-flex"><Truck size={22} /> Lieferanten</HStack></Heading>
      </Flex>

      <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
        <Text fontSize="sm" color="fg.muted" mb={3}>
          Hier hinterlegst du die Zugänge zu den Lieferanten-Portalen. Der Shop nutzt sie,
          um Artikeldaten und Netto-Preise zu holen, die ohne Anmeldung nicht sichtbar sind.
          Passwörter werden verschlüsselt abgelegt und sind danach nicht mehr einsehbar.
        </Text>
        <Stack direction={{ base: 'column', sm: 'row' }} gap={2}>
          <Input size="sm" placeholder="Name des Lieferanten, z.B. Frigotechnik"
            value={neuName} onChange={(e) => setNeuName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && neuName.trim() && anlegen.mutate()} />
          <Button size="sm" colorPalette="blue" onClick={() => anlegen.mutate()}
            loading={anlegen.isPending} disabled={!neuName.trim()}>
            <Plus size={14} /> Lieferant anlegen
          </Button>
        </Stack>
        {anlegen.isError && (
          <Text color="red.500" fontSize="xs" mt={2}>{anlegen.error?.message}</Text>
        )}
      </Box>

      {isLoading ? (
        <Flex justify="center" p={12}><Spinner size="xl" /></Flex>
      ) : lieferanten.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py={12}>Noch kein Lieferant angelegt.</Text>
      ) : (
        <VStack align="stretch" gap={3}>
          {lieferanten.map((l) => (
            <LieferantKarte key={l.id} lieferant={l} onZugang={setZugangFuer} onRefresh={refresh} />
          ))}
        </VStack>
      )}

      <ZugangDialog
        open={!!zugangFuer}
        lieferant={zugangFuer}
        onClose={() => setZugangFuer(null)}
        onGespeichert={refresh}
      />
    </Box>
  )
}
