import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Button, Input, Table, Badge, Spinner, Flex, Spacer, Code,
} from '@chakra-ui/react'
import { Search, Upload, CheckCircle2, AlertTriangle, FlaskConical } from 'lucide-react'
import {
  pruefeArtikel, uebertrageArtikel, listKategorienMitPds, listEinheitenMapping,
  listArtikelMitPdsStatus,
} from '../../data/api/pdsSync.js'

const STATUS_FARBE = { offen: 'gray', bereit: 'blue', gesynct: 'green', fehler: 'red' }

export default function AdminPdsSyncPage() {
  const qc = useQueryClient()
  const [suche, setSuche] = useState('')
  const [nurOffene, setNurOffene] = useState(true)
  const [laufend, setLaufend] = useState(null)
  const [ergebnis, setErgebnis] = useState(null)

  const { data: artikelListe = [], isLoading, error: ladeFehler } = useQuery({
    queryKey: ['shop-artikel-pds'],
    queryFn: listArtikelMitPdsStatus,
  })
  const { data: kategorien = [] } = useQuery({
    queryKey: ['pds-kategorien-mapping'],
    queryFn: listKategorienMitPds,
  })
  const { data: einheiten = [] } = useQuery({
    queryKey: ['pds-einheiten-mapping'],
    queryFn: listEinheitenMapping,
  })

  const kategorieMap = useMemo(() => new Map(kategorien.map((k) => [k.id, k])), [kategorien])
  const einheitenSet = useMemo(() => new Set(einheiten.map((e) => e.shop_einheit)), [einheiten])

  // Kategorien ohne Warengruppe blockieren jeden Artikel darin. Das ist der
  // haeufigste Grund, warum eine Uebertragung mit 422 abbricht — deshalb oben
  // als Warnung und nicht erst beim Klick.
  const ohneWarengruppe = kategorien.filter((k) => !k.pds_warengruppe_uuid)

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase()
    return artikelListe.filter((a) => {
      if (nurOffene && a.pds_katalog_uuid) return false
      if (!s) return true
      return [a.name, a.artikelnr, a.lieferant].filter(Boolean).join(' ').toLowerCase().includes(s)
    })
  }, [artikelListe, suche, nurOffene])

  const anzahlGesynct = artikelListe.filter((a) => a.pds_katalog_uuid).length

  async function handle(artikel, echt) {
    setLaufend(artikel.id + (echt ? ':echt' : ':probe'))
    setErgebnis(null)
    try {
      const antwort = echt ? await uebertrageArtikel(artikel.id) : await pruefeArtikel(artikel.id)
      setErgebnis({ artikel, echt, antwort })
      qc.invalidateQueries({ queryKey: ['shop-artikel-pds'] })
    } catch (e) {
      setErgebnis({ artikel, echt, fehler: e.message })
    } finally {
      setLaufend(null)
    }
  }

  function handleUebertragen(artikel) {
    const frage =
      `"${artikel.name}" wirklich in PDS anlegen?\n\n` +
      'Das laesst sich nicht zurueckholen: PDS loescht Katalogeintraege nur, ' +
      'solange sie keinen Bestand und keine Verwendung haben.'
    if (!window.confirm(frage)) return
    handle(artikel, true)
  }

  return (
    <Box>
      <Flex mb={4} align="center" flexWrap="wrap" gap={2}>
        <Heading size="lg">Nach PDS übertragen</Heading>
        <Spacer />
        <Text fontSize="sm" color="fg.muted">{anzahlGesynct} von {artikelListe.length} übertragen</Text>
      </Flex>

      {ladeFehler && (
        <Box borderWidth="1px" borderColor="red.300" bg="red.50" borderRadius="lg" p={4} mb={4}>
          <HStack gap={2} align="start">
            <Box color="red.600" mt="2px"><AlertTriangle size={16} /></Box>
            <Text fontSize="sm">{ladeFehler.message}</Text>
          </HStack>
        </Box>
      )}

      {ohneWarengruppe.length > 0 && (
        <Box borderWidth="1px" borderColor="orange.300" bg="orange.50" borderRadius="lg" p={4} mb={4}>
          <HStack gap={2} mb={2} align="start">
            <Box color="orange.600" mt="2px"><AlertTriangle size={16} /></Box>
            <Box>
              <Text fontWeight="bold" fontSize="sm">
                {ohneWarengruppe.length} {ohneWarengruppe.length === 1 ? 'Kategorie hat' : 'Kategorien haben'} keine PDS-Warengruppe
              </Text>
              <Text fontSize="sm" mt={1}>
                Artikel in diesen Kategorien lassen sich nicht übertragen:{' '}
                {ohneWarengruppe.map((k) => k.name).join(', ')}.
              </Text>
              <Text fontSize="xs" color="fg.muted" mt={2}>
                Warengruppen kann die API nicht anlegen — die fünf (KLIMA)-Gruppen müssen einmalig
                von Hand in PDS entstehen, danach ihre UUID hier hinterlegen.
                Siehe docs/pds-klima-warengruppen.md.
              </Text>
            </Box>
          </HStack>
        </Box>
      )}

      <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
        <HStack mb={3} gap={2} flexWrap="wrap">
          <HStack borderWidth="1px" borderRadius="md" px={2} bg="gray.50">
            <Search size={14} />
            <Input variant="flushed" size="sm" placeholder="Suche..." value={suche}
              onChange={(e) => setSuche(e.target.value)} border="none" />
          </HStack>
          <Button size="sm" variant={nurOffene ? 'solid' : 'outline'} onClick={() => setNurOffene((v) => !v)}>
            {nurOffene ? 'Nur noch nicht übertragene' : 'Alle Artikel'}
          </Button>
          <Spacer />
          <Text fontSize="sm" color="fg.muted">{gefiltert.length} Artikel</Text>
        </HStack>

        {isLoading ? (
          <Flex justify="center" p={8}><Spinner /></Flex>
        ) : (
          <Box overflowX="auto">
            <Table.Root variant="line" size="sm" minW="820px">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Artikel</Table.ColumnHeader>
                  <Table.ColumnHeader>Kategorie</Table.ColumnHeader>
                  <Table.ColumnHeader>Einheit</Table.ColumnHeader>
                  <Table.ColumnHeader>EK</Table.ColumnHeader>
                  <Table.ColumnHeader>PDS</Table.ColumnHeader>
                  <Table.ColumnHeader></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {gefiltert.map((a) => {
                  const kat = kategorieMap.get(a.kategorie_id)
                  const einheitOk = a.einheit && einheitenSet.has(a.einheit)
                  return (
                    <Table.Row key={a.id}>
                      <Table.Cell>
                        <Text fontWeight="medium" fontSize="sm">{a.name}</Text>
                        {a.artikelnr && <Text fontSize="xs" color="fg.muted">Art-Nr: {a.artikelnr}</Text>}
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm">{kat?.name || '—'}</Text>
                        {kat && !kat.pds_warengruppe_uuid && (
                          <Text fontSize="xs" color="orange.600">keine Warengruppe</Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm" color={einheitOk ? undefined : 'orange.600'}>
                          {a.einheit || '—'}
                        </Text>
                        {!einheitOk && <Text fontSize="xs" color="orange.600">nicht zugeordnet</Text>}
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm">{a.preis_netto != null ? `${Number(a.preis_netto).toFixed(2)} €` : '—'}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={STATUS_FARBE[a.pds_sync_status] || 'gray'} size="sm">
                          {a.pds_sync_status || 'offen'}
                        </Badge>
                        {a.pds_katalog_uuid && (
                          <Text fontSize="xs" color="fg.muted" mt={1}>
                            {a.pds_katalog_uuid.slice(0, 8)}…
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {a.pds_katalog_uuid ? (
                          <HStack gap={1} color="green.600">
                            <CheckCircle2 size={14} />
                            <Text fontSize="xs">in PDS</Text>
                          </HStack>
                        ) : (
                          <HStack gap={1}>
                            <Button size="xs" variant="outline"
                              loading={laufend === a.id + ':probe'}
                              onClick={() => handle(a, false)}>
                              <FlaskConical size={12} /> Probe
                            </Button>
                            <Button size="xs" colorPalette="blue"
                              loading={laufend === a.id + ':echt'}
                              onClick={() => handleUebertragen(a)}>
                              <Upload size={12} /> Übertragen
                            </Button>
                          </HStack>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
                {gefiltert.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={6}>
                      <Text py={4} textAlign="center" color="fg.muted">
                        {nurOffene ? 'Alle Artikel sind übertragen.' : 'Keine Treffer.'}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Box>

      {ergebnis && <Ergebnis {...ergebnis} onClose={() => setErgebnis(null)} />}
    </Box>
  )
}

function Ergebnis({ artikel, echt, antwort, fehler, onClose }) {
  const luecken = antwort?.luecken
  const istFehler = Boolean(fehler) || Boolean(luecken)

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="white"
      borderColor={istFehler ? 'red.300' : 'green.300'}>
      <Flex align="center" mb={3}>
        <Heading size="sm">
          {echt ? 'Übertragung' : 'Probelauf'}: {artikel.name}
        </Heading>
        <Spacer />
        <Button size="xs" variant="ghost" onClick={onClose}>schließen</Button>
      </Flex>

      {fehler && <Text fontSize="sm" color="red.600">{fehler}</Text>}

      {luecken && (
        <Box>
          <Text fontSize="sm" fontWeight="medium" mb={2}>
            Nicht übertragbar — es fehlen Angaben. Absichtlich kein Standardwert:
            eine falsche Maßeinheit oder Warengruppe ist in PDS kaum zu korrigieren.
          </Text>
          <VStack align="stretch" gap={1}>
            {luecken.map((l, i) => (
              <HStack key={i} gap={2} align="start">
                <Box color="red.500" mt="3px"><AlertTriangle size={13} /></Box>
                <Text fontSize="sm">{l}</Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {antwort?.status === 'trockenlauf' && (
        <Box>
          <Text fontSize="sm" mb={2}>{antwort.hinweis}</Text>
          <Code display="block" whiteSpace="pre" overflowX="auto" p={3} fontSize="xs" borderRadius="md">
            {JSON.stringify(antwort.wuerde_senden, null, 2)}
          </Code>
        </Box>
      )}

      {antwort?.status === 'uebertragen' && (
        <VStack align="stretch" gap={2}>
          <HStack gap={2} color="green.700">
            <CheckCircle2 size={16} />
            <Text fontSize="sm" fontWeight="medium">
              In PDS angelegt: {antwort.pds_katalog_uuid}
            </Text>
          </HStack>
          {antwort.warnungen?.length > 0 && antwort.warnungen.map((w, i) => (
            <HStack key={i} gap={2} align="start">
              <Box color="orange.500" mt="3px"><AlertTriangle size={13} /></Box>
              <Text fontSize="sm">
                {w} — der Artikel steht in PDS, ist aber noch nicht nachbestellbar.
              </Text>
            </HStack>
          ))}
          {antwort.angebot && (
            <Box borderWidth="1px" borderColor="blue.200" bg="blue.50" borderRadius="md" p={3}>
              <Text fontSize="sm" fontWeight="medium" color="blue.800">
                Musterangebot {antwort.angebot.vorgangs_nummer} angelegt — VK {antwort.angebot.vk} €
              </Text>
              <Text fontSize="sm" color="blue.900" mt={1}>
                Noch zwei Handgriffe im PDS-Client, dann steht der Verkaufspreis am Artikel:
              </Text>
              <Box as="ol" pl={5} mt={1} fontSize="sm" color="blue.900">
                <li>Angebot {antwort.angebot.vorgangs_nummer} öffnen, Position 001 → „in Katalog übernehmen"</li>
                <li>Angebot löschen — es hängt an der Weich GmbH als Kunde, kein echter Kunde sieht es</li>
              </Box>
            </Box>
          )}
          {antwort.hinweis && <Text fontSize="xs" color="fg.muted">{antwort.hinweis}</Text>}
        </VStack>
      )}

      {antwort?.status === 'bereits_uebertragen' && (
        <Text fontSize="sm">{antwort.hinweis}</Text>
      )}
    </Box>
  )
}
