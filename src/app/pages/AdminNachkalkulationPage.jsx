import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Button, Input, Table, Badge, Spinner, Flex, Spacer,
  IconButton,
} from '@chakra-ui/react'
import {
  Search, Download, Trash2, Plus, ArrowLeft, TrendingDown, TrendingUp, Eye, Send, RotateCcw,
} from 'lucide-react'
import {
  sucheAuftraege, importiereSoll, materialVorschau, mengenSetzen, transportAnlegen, materialZuruecksetzen,
} from '../../data/api/pdsSync.js'
import {
  listNachkalkulationen, addPosition, deletePosition, setStatus,
} from '../../data/api/nachkalkulation.js'
import { listArtikel } from '../../data/api/artikel.js'

function euro(n) {
  if (n == null) return '—'
  return `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export default function AdminNachkalkulationPage() {
  const [offen, setOffen] = useState(null)
  if (offen) return <Detail id={offen} onZurueck={() => setOffen(null)} />
  return <Uebersicht onOeffnen={setOffen} />
}

// ─── Übersicht: Aufträge aus PDS holen, Liste der Nachkalkulationen ────────
function Uebersicht({ onOeffnen }) {
  const qc = useQueryClient()
  const [suchwort, setSuchwort] = useState('Klima')
  const [treffer, setTreffer] = useState(null)
  const [suchend, setSuchend] = useState(false)
  const [fehler, setFehler] = useState(null)
  const [importiert, setImportiert] = useState(null)

  const { data: liste = [], isLoading } = useQuery({
    queryKey: ['nachkalkulationen'],
    queryFn: listNachkalkulationen,
  })

  async function handleSuche() {
    setSuchend(true); setFehler(null)
    try {
      setTreffer(await sucheAuftraege(suchwort))
    } catch (e) {
      setFehler(e.message)
    } finally {
      setSuchend(false)
    }
  }

  async function handleImport(vorgangUuid) {
    setFehler(null)
    try {
      const antwort = await importiereSoll(vorgangUuid)
      setImportiert(antwort)
      qc.invalidateQueries({ queryKey: ['nachkalkulationen'] })
    } catch (e) {
      setFehler(e.message)
    }
  }

  return (
    <Box>
      <Heading size="lg" mb={4}>Nachkalkulation</Heading>

      <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
        <Text fontWeight="bold" fontSize="sm" mb={2}>Auftrag aus PDS holen</Text>
        <HStack gap={2} flexWrap="wrap">
          <HStack borderWidth="1px" borderRadius="md" px={2} bg="gray.50">
            <Search size={14} />
            <Input variant="flushed" size="sm" value={suchwort} border="none" maxW="240px"
              onChange={(e) => setSuchwort(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSuche()} />
          </HStack>
          <Button size="sm" onClick={handleSuche} loading={suchend}>Suchen</Button>
        </HStack>

        {fehler && <Text fontSize="sm" color="red.600" mt={2}>{fehler}</Text>}

        {treffer && (
          <Box mt={3}>
            <Text fontSize="xs" color="fg.muted" mb={2}>{treffer.hinweis}</Text>
            <Box overflowX="auto" maxH="320px" overflowY="auto">
              <Table.Root variant="line" size="sm" minW="640px">
                <Table.Body>
                  {treffer.auftraege.map((a) => (
                    <Table.Row key={a.vorgang_uuid}>
                      <Table.Cell><Text fontSize="sm" fontWeight="medium">{a.vorgangs_nummer}</Text></Table.Cell>
                      <Table.Cell><Text fontSize="sm">{a.bezeichnung}</Text></Table.Cell>
                      <Table.Cell><Badge size="sm" variant="subtle">{a.status || '—'}</Badge></Table.Cell>
                      <Table.Cell textAlign="right">
                        {a.nachkalkulation ? (
                          <Text fontSize="xs" color="fg.muted">bereits importiert</Text>
                        ) : (
                          <Button size="xs" variant="outline" onClick={() => handleImport(a.vorgang_uuid)}>
                            <Download size={12} /> Soll holen
                          </Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </Box>
        )}

        {importiert?.soll && (
          <Box mt={3} borderWidth="1px" borderRadius="md" p={3} bg="blue.50" borderColor="blue.200">
            <Text fontSize="sm" fontWeight="medium" mb={1}>Soll übernommen</Text>
            <Text fontSize="sm">
              Auftrag {euro(importiert.soll.vk_gesamt)} · Geräteeinkauf {euro(importiert.soll.ek_geraete)} ·
              bleibt für Material, Lohn und Gewinn {euro(importiert.soll.deckung_material_und_lohn)}
            </Text>
            <Text fontSize="xs" color="fg.muted" mt={1}>{importiert.hinweis}</Text>
          </Box>
        )}
      </Box>

      <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
        {isLoading ? (
          <Flex justify="center" p={8}><Spinner /></Flex>
        ) : (
          <Box overflowX="auto">
            <Table.Root variant="line" size="sm" minW="860px">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Auftrag</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Nach Geräteeinkauf</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Ist-Material</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Rest für Lohn</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Auftrag gesamt</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {liste.map((n) => (
                  <Table.Row key={n.id}>
                    <Table.Cell>
                      <Text fontSize="sm" fontWeight="medium">{n.pds_vorgangs_nummer}</Text>
                      <Text fontSize="xs" color="fg.muted">{n.bezeichnung}</Text>
                    </Table.Cell>
                    <Table.Cell textAlign="right"><Text fontSize="sm">{euro(n.deckung_material_und_lohn)}</Text></Table.Cell>
                    <Table.Cell textAlign="right"><Text fontSize="sm">{euro(n.ist_material)}</Text></Table.Cell>
                    <Table.Cell textAlign="right"><Abweichung wert={n.rest_fuer_lohn} /></Table.Cell>
                    <Table.Cell textAlign="right"><Text fontSize="sm">{euro(n.soll_vk_gesamt)}</Text></Table.Cell>
                    <Table.Cell>
                      <Badge size="sm" colorPalette={n.status === 'geprueft' ? 'green' : n.status === 'erfasst' ? 'blue' : 'gray'}>
                        {n.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Button size="xs" variant="outline" onClick={() => onOeffnen(n.id)}>Erfassen</Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
                {liste.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={7}>
                      <Text py={4} textAlign="center" color="fg.muted">
                        Noch keine Nachkalkulation — hol dir oben einen Auftrag aus PDS.
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// Vorzeichen bewusst deutlich: negativ heisst, das Material allein hat den Rest
// nach dem Geraeteeinkauf aufgezehrt — fuer Lohn und Gewinn bleibt nichts.
function Abweichung({ wert }) {
  if (wert == null) return <Text fontSize="sm">—</Text>
  const negativ = Number(wert) < 0
  return (
    <HStack gap={1} justify="flex-end" color={negativ ? 'red.600' : 'green.700'}>
      {negativ ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
      <Text fontSize="sm" fontWeight="medium">{euro(wert)}</Text>
    </HStack>
  )
}

// ─── Detail: Ist-Positionen erfassen ───────────────────────────────────────
function Detail({ id, onZurueck }) {
  const qc = useQueryClient()
  const [artikelSuche, setArtikelSuche] = useState('')
  const [menge, setMenge] = useState('')
  const [gewaehlt, setGewaehlt] = useState(null)
  const [quelle, setQuelle] = useState('monteur')
  const [fehler, setFehler] = useState(null)

  const { data: liste = [] } = useQuery({ queryKey: ['nachkalkulationen'], queryFn: listNachkalkulationen })
  const { data: artikelListe = [] } = useQuery({
    queryKey: ['shop-artikel'],
    queryFn: () => listArtikel(),
  })

  const nk = liste.find((n) => n.id === id)

  const vorschlaege = useMemo(() => {
    const s = artikelSuche.trim().toLowerCase()
    if (!s) return []
    return artikelListe
      .filter((a) => [a.name, a.artikelnr].filter(Boolean).join(' ').toLowerCase().includes(s))
      .slice(0, 8)
  }, [artikelListe, artikelSuche])

  function neu() {
    qc.invalidateQueries({ queryKey: ['nachkalkulationen'] })
  }

  async function handleAdd() {
    setFehler(null)
    const m = Number(String(menge).replace(',', '.'))
    if (!gewaehlt || !(m > 0)) return
    try {
      await addPosition(id, { artikel: gewaehlt, menge: m, quelle })
      setGewaehlt(null); setMenge(''); setArtikelSuche('')
      neu()
    } catch (e) {
      setFehler(e.message)
    }
  }

  async function handleDelete(posId) {
    await deletePosition(posId)
    neu()
  }

  async function handleStatus(neuerStatus) {
    await setStatus(id, neuerStatus)
    neu()
  }

  if (!nk) return <Flex justify="center" p={8}><Spinner /></Flex>

  return (
    <Box>
      <Flex mb={4} align="center" gap={2} flexWrap="wrap">
        <Button size="sm" variant="ghost" onClick={onZurueck}><ArrowLeft size={14} /> Zurück</Button>
        <Box>
          <Heading size="md">{nk.pds_vorgangs_nummer}</Heading>
          <Text fontSize="sm" color="fg.muted">{nk.bezeichnung}</Text>
        </Box>
        <Spacer />
        {nk.status !== 'geprueft' && (
          <Button size="sm" variant="outline" onClick={() => handleStatus('geprueft')}>Als geprüft markieren</Button>
        )}
      </Flex>

      <HStack gap={4} mb={4} flexWrap="wrap" align="stretch">
        <Kennzahl titel="Nach Geräteeinkauf übrig" wert={euro(nk.deckung_material_und_lohn)} />
        <Kennzahl titel="Ist-Materialeinsatz" wert={euro(nk.ist_material)} />
        <Kennzahl titel="Rest für Lohn und Gewinn" wert={euro(nk.rest_fuer_lohn)}
          farbe={Number(nk.rest_fuer_lohn) < 0 ? 'red.600' : 'green.700'} />
        <Kennzahl titel="Auftrag gesamt (VK)" wert={euro(nk.soll_vk_gesamt)} />
      </HStack>

      <KalkuliertePositionen soll={nk.soll_positionen} />

      <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
        <Text fontWeight="bold" fontSize="sm" mb={2}>Verbautes Material erfassen</Text>
        <HStack gap={2} flexWrap="wrap" align="start">
          <Box position="relative">
            <HStack borderWidth="1px" borderRadius="md" px={2} bg="gray.50">
              <Search size={14} />
              <Input variant="flushed" size="sm" border="none" minW="260px"
                placeholder="Artikel aus dem Shop-Katalog..."
                value={gewaehlt ? gewaehlt.name : artikelSuche}
                onChange={(e) => { setGewaehlt(null); setArtikelSuche(e.target.value) }} />
            </HStack>
            {!gewaehlt && vorschlaege.length > 0 && (
              <VStack position="absolute" zIndex={10} bg="white" borderWidth="1px" borderRadius="md"
                mt={1} align="stretch" gap={0} minW="260px" boxShadow="md">
                {vorschlaege.map((a) => (
                  <Box key={a.id} px={3} py={2} cursor="pointer" _hover={{ bg: 'gray.50' }}
                    onClick={() => { setGewaehlt(a); setArtikelSuche('') }}>
                    <Text fontSize="sm">{a.name}</Text>
                    <Text fontSize="xs" color="fg.muted">
                      {a.einheit || '—'} · {a.preis_netto != null ? euro(a.preis_netto) : 'kein EK'}
                    </Text>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
          <Input size="sm" maxW="110px" placeholder="Menge" value={menge}
            onChange={(e) => setMenge(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
          <select value={quelle} onChange={(e) => setQuelle(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6 }}>
            <option value="monteur">Monteur</option>
            <option value="beleg">Beleg</option>
            <option value="schaetzung">Schätzung</option>
          </select>
          <Button size="sm" colorPalette="blue" onClick={handleAdd} disabled={!gewaehlt || !menge}>
            <Plus size={14} /> Hinzufügen
          </Button>
        </HStack>
        {nk.ist_aus_auftrag > 0 && (
          <Text fontSize="xs" color="fg.muted" mt={2}>
            {euro(nk.ist_aus_auftrag)} sind bereits im Auftrag als Einstandspreis einer
            Leistungsposition erfasst und zählen oben mit. Hier gehört nur nach, was darin fehlt.
          </Text>
        )}
        {gewaehlt && gewaehlt.preis_netto == null && (
          <Text fontSize="xs" color="orange.600" mt={2}>
            Für diesen Artikel ist kein Einkaufspreis hinterlegt — die Position zählt dann mit 0 €.
          </Text>
        )}
        {fehler && <Text fontSize="sm" color="red.600" mt={2}>{fehler}</Text>}
      </Box>

      <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
        <Box overflowX="auto">
          <Table.Root variant="line" size="sm" minW="680px">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Position</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="right">Menge</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="right">EK einzeln</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="right">EK gesamt</Table.ColumnHeader>
                <Table.ColumnHeader>Quelle</Table.ColumnHeader>
                <Table.ColumnHeader></Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {nk.positionen.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>
                    <Text fontSize="sm">{p.artikel?.name || p.freitext}</Text>
                    {!p.artikel && (
                      <Text fontSize="xs" color="orange.600">
                        noch kein Shop-Artikel — Kandidat für die Katalog-Anlage
                      </Text>
                    )}
                    {p.artikel && !p.artikel.pds_katalog_uuid && (
                      <Text fontSize="xs" color="orange.600">
                        noch nicht in PDS — vor dem Transport unter „Nach PDS übertragen" anlegen
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell textAlign="right">
                    <Text fontSize="sm">{Number(p.menge)} {p.einheit || ''}</Text>
                  </Table.Cell>
                  <Table.Cell textAlign="right"><Text fontSize="sm">{euro(p.ek_einzel)}</Text></Table.Cell>
                  <Table.Cell textAlign="right"><Text fontSize="sm">{euro(p.ek_gesamt)}</Text></Table.Cell>
                  <Table.Cell>
                    <HStack gap={1}>
                      <Badge size="sm" variant="subtle">{p.quelle}</Badge>
                      {p.pds_transport_at && (
                        <Badge size="sm" colorPalette="green" variant="subtle">
                          → PDS {new Date(p.pds_transport_at).toLocaleDateString('de-DE')}
                        </Badge>
                      )}
                    </HStack>
                  </Table.Cell>
                  <Table.Cell>
                    {!p.pds_transport_at && (
                      <IconButton size="2xs" variant="ghost" colorPalette="red" aria-label="Löschen"
                        onClick={() => handleDelete(p.id)}>
                        <Trash2 size={12} />
                      </IconButton>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
              {nk.positionen.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <Text py={4} textAlign="center" color="fg.muted">
                      Noch nichts erfasst. Nach dem Geräteeinkauf stehen {euro(nk.deckung_material_und_lohn)}
                      für Material, Lohn und Gewinn zur Verfügung.
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      </Box>

      <MaterialBlock nk={nk} onGeaendert={neu} />
    </Box>
  )
}

function Kennzahl({ titel, wert, farbe }) {
  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="white" minW="190px" flex="1">
      <Text fontSize="xs" color="fg.muted" mb={1}>{titel}</Text>
      <Text fontSize="xl" fontWeight="bold" color={farbe}>{wert}</Text>
    </Box>
  )
}

// ─── Kalkulierte Positionen aus dem PDS-Auftrag (nur Anzeige) ──────────────
// Kommt aus soll_positionen, das der Soll-Import ablegt. Aeltere Importe haben
// das Feld noch nicht — dann hilft ein erneutes "Soll holen" in der Uebersicht.
// Der Hauptauftrag wird nie veraendert (ADR 0006), deshalb kein Bearbeiten.
function KalkuliertePositionen({ soll }) {
  if (!soll) {
    return (
      <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
        <Text fontWeight="bold" fontSize="sm" mb={1}>Kalkulierte Positionen aus dem Auftrag</Text>
        <Text fontSize="sm" color="fg.muted">
          Für diesen Import liegen die Einzelpositionen noch nicht vor. In der Übersicht den Auftrag
          erneut suchen und „Soll holen" — die erfassten Positionen bleiben dabei erhalten.
        </Text>
      </Box>
    )
  }

  const gruppen = [
    ['Gerät', soll.geraete], ['Leistung', soll.leistungen],
    ['Eigenleistung', soll.eigenleistung], ['Montage', soll.montage],
  ]
  const zeilen = gruppen.flatMap(([art, liste]) => (liste || []).map((p) => ({ ...p, art })))

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
      <Text fontWeight="bold" fontSize="sm" mb={1}>Kalkulierte Positionen aus dem Auftrag</Text>
      <Text fontSize="xs" color="fg.muted" mb={2}>
        Stand des Auftrags in PDS, nur zur Orientierung. Platzhalter der Ebene „Montagematerial"
        bekommen ihre Menge direkt; alles andere geht über ein Transportangebot.
      </Text>
      <Box overflowX="auto">
        <Table.Root variant="line" size="sm" minW="680px">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Position</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Menge</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">EK</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">VK</Table.ColumnHeader>
              <Table.ColumnHeader>Art</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {zeilen.map((p, i) => (
              <Table.Row key={`${p.nummer || 'p'}-${i}`}>
                <Table.Cell>
                  <Text fontSize="sm">{p.nummer ? `${p.nummer} · ` : ''}{p.kurztext || '—'}</Text>
                  {p.ek_beleg && (
                    <Text fontSize="xs" color="fg.muted">EK belegt durch {p.ek_quelle} {p.ek_beleg}</Text>
                  )}
                </Table.Cell>
                <Table.Cell textAlign="right">
                  <Text fontSize="sm">{p.menge != null ? Number(p.menge) : '—'} {p.einheit || ''}</Text>
                </Table.Cell>
                <Table.Cell textAlign="right"><Text fontSize="sm">{euro(p.ek_belegt ?? p.ek_gesamt)}</Text></Table.Cell>
                <Table.Cell textAlign="right"><Text fontSize="sm">{euro(p.vk_gesamt)}</Text></Table.Cell>
                <Table.Cell><Badge size="sm" variant="subtle">{p.art}</Badge></Table.Cell>
              </Table.Row>
            ))}
            {zeilen.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <Text py={3} textAlign="center" color="fg.muted">Der Auftrag hat keine Positionen.</Text>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  )
}

// ─── Nach PDS: Mengen setzen oder Transportangebot ─────────────────────────
// ADR 0007. Die Vorschau teilt die offenen Positionen in zwei Gruppen:
//   mengen    — Platzhalter im Auftrag vorhanden, Menge wird per API gesetzt
//   transport — kein Platzhalter, geht als Angebot zum Kopieren im Client
// Beides wird getrennt ausgeloest, damit klar ist, was wohin geht.
function MaterialBlock({ nk, onGeaendert }) {
  const [vorschau, setVorschau] = useState(null)
  const [laedt, setLaedt] = useState(false)
  const [sendet, setSendet] = useState(null) // 'mengen' | 'transport' | null
  const [antwort, setAntwort] = useState(null)
  const [fehler, setFehler] = useState(null)

  const offen = nk.positionen.filter((p) => !p.pds_transport_at).length
  const uebertragen = nk.positionen.length - offen

  async function handleVorschau() {
    setLaedt(true); setFehler(null); setAntwort(null)
    try {
      setVorschau(await materialVorschau(nk.id))
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaedt(false)
    }
  }

  async function handleMengen() {
    if (!vorschau) return
    const ok = window.confirm(
      `Mengen von ${vorschau.mengen.length} Platzhalter-Position(en) in Auftrag ${nk.pds_vorgangs_nummer} setzen?\n\n` +
      'Geändert wird nur die Menge dieser Positionen. Rückgängig nur im PDS-Client.',
    )
    if (!ok) return
    setSendet('mengen'); setFehler(null)
    try {
      const a = await mengenSetzen(nk.id)
      setAntwort(a); setVorschau(null); onGeaendert()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setSendet(null)
    }
  }

  async function handleTransport() {
    if (!vorschau) return
    const ok = window.confirm(
      `Transportangebot mit ${vorschau.transport.ebene.positionen.length} Position(en) für ${nk.pds_vorgangs_nummer} anlegen?\n\n` +
      'Es hängt an der Weich GmbH als Kunde und wird nach dem Kopieren im PDS-Client gelöscht.',
    )
    if (!ok) return
    setSendet('transport'); setFehler(null)
    try {
      const a = await transportAnlegen(nk.id)
      setAntwort(a); setVorschau(null); onGeaendert()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setSendet(null)
    }
  }

  async function handleReset() {
    const ok = window.confirm(
      'Alle Positionen wieder als „nicht übertragen“ markieren?\n\n' +
      'Mengen, die schon im Auftrag stehen, würden beim nächsten Setzen erneut addiert. ' +
      'Nur sinnvoll, wenn in PDS nichts angekommen ist.',
    )
    if (!ok) return
    setFehler(null)
    try {
      await materialZuruecksetzen(nk.id)
      setAntwort(null); onGeaendert()
    } catch (e) {
      setFehler(e.message)
    }
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} mt={4} bg="white">
      <Flex align="center" gap={2} flexWrap="wrap">
        <Box>
          <Text fontWeight="bold" fontSize="sm">Nach PDS übertragen</Text>
          <Text fontSize="xs" color="fg.muted">
            Platzhalter der Ebene „Montagematerial" in {nk.pds_vorgangs_nummer} bekommen ihre Menge direkt.
            Material ohne Platzhalter geht als Transportangebot zum Kopieren im Client.
          </Text>
        </Box>
        <Spacer />
        <Button size="sm" variant="outline" onClick={handleVorschau} loading={laedt} disabled={offen === 0}>
          <Eye size={14} /> Vorschau {offen > 0 ? `(${offen} offen)` : ''}
        </Button>
      </Flex>

      {antwort?.status === 'mengen_gesetzt' && (
        <Box mt={3} borderWidth="1px" borderRadius="md" p={3} bg="green.50" borderColor="green.200">
          <Text fontSize="sm" fontWeight="medium" color="green.800">
            {antwort.anzahl} Menge(n) in Auftrag {nk.pds_vorgangs_nummer} gesetzt
          </Text>
          <Text fontSize="xs" color="green.900" mt={1}>{antwort.anleitung}</Text>
          {antwort.offen_transport > 0 && (
            <Text fontSize="xs" color="orange.700" mt={1}>
              {antwort.offen_transport} Position(en) ohne Platzhalter sind noch offen — erneut „Vorschau", dann Transportangebot.
            </Text>
          )}
          {antwort.warnung && <Text fontSize="xs" color="red.600" mt={1}>{antwort.warnung}</Text>}
        </Box>
      )}

      {(antwort?.status === 'transport_angelegt' || (!antwort && nk.pds_transport_nummer)) && (
        <Box mt={3} borderWidth="1px" borderRadius="md" p={3} bg="green.50" borderColor="green.200">
          <Text fontSize="sm" fontWeight="medium" color="green.800">
            Transportangebot {antwort?.angebot?.vorgangs_nummer || nk.pds_transport_nummer} mit{' '}
            {antwort?.angebot?.positionen ?? nk.pds_transport_positionen ?? '—'} Position(en)
            {!antwort && nk.pds_transport_at ? ` vom ${new Date(nk.pds_transport_at).toLocaleDateString('de-DE')}` : ''}
          </Text>
          <Text fontSize="xs" color="green.900" mt={1}>
            {antwort?.anleitung ||
              `Im PDS-Client öffnen (Kunde Weich GmbH), Ebene in Auftrag ${nk.pds_vorgangs_nummer} kopieren, Kundenpreise anpassen, Angebot löschen.`}
          </Text>
          {antwort?.warnung && <Text fontSize="xs" color="red.600" mt={1}>{antwort.warnung}</Text>}
        </Box>
      )}

      {uebertragen > 0 && (
        <HStack mt={2} gap={2}>
          <Text fontSize="xs" color="fg.muted">{uebertragen} Position(en) als übertragen markiert.</Text>
          <Button size="2xs" variant="ghost" onClick={handleReset}>
            <RotateCcw size={11} /> Markierung aufheben
          </Button>
        </HStack>
      )}

      {vorschau && (
        <Box mt={3}>
          {vorschau.mengen.length > 0 && (
            <Box mb={3}>
              <Text fontSize="sm" fontWeight="medium" mb={1}>
                Mengen setzen — {vorschau.mengen.length} Platzhalter im Auftrag
              </Text>
              <Box overflowX="auto">
                <Table.Root variant="line" size="sm" minW="620px">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Position im Auftrag</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="right">bisher</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="right">+ verbaut</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="right">neu</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {vorschau.mengen.map((m) => (
                      <Table.Row key={m.position_uuid}>
                        <Table.Cell>
                          <Text fontSize="sm">{m.nummer ? `${m.nummer} · ` : ''}{m.name}</Text>
                          <Text fontSize="xs" color="fg.muted">{m.ebene}</Text>
                        </Table.Cell>
                        <Table.Cell textAlign="right"><Text fontSize="sm">{m.menge_aktuell} {m.einheit || ''}</Text></Table.Cell>
                        <Table.Cell textAlign="right"><Text fontSize="sm">+{m.menge_plus}</Text></Table.Cell>
                        <Table.Cell textAlign="right"><Text fontSize="sm" fontWeight="medium">{m.menge_neu} {m.einheit || ''}</Text></Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
              <Button size="sm" colorPalette="blue" mt={2} onClick={handleMengen} loading={sendet === 'mengen'}>
                <Send size={14} /> Mengen in Auftrag setzen
              </Button>
            </Box>
          )}

          {vorschau.transport.ebene.positionen.length > 0 && (
            <Box mb={3}>
              <Text fontSize="sm" fontWeight="medium" mb={1}>
                Ohne Platzhalter — {vorschau.transport.ebene.positionen.length} Position(en) als Transportangebot
              </Text>
              {!vorschau.auftrag.hat_platzhalter_ebene && (
                <Text fontSize="xs" color="fg.muted" mb={1}>
                  Dieser Auftrag hat keine Ebene „Montagematerial (Nachkalkulation)" — er stammt aus der Zeit vor
                  den Platzhaltern. Alles geht über das Transportangebot.
                </Text>
              )}
              <Box overflowX="auto">
                <Table.Root variant="line" size="sm" minW="620px">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Position</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="right">Menge</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="right">EK einzeln</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="right">VK einzeln</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {vorschau.transport.ebene.positionen.map((p) => (
                      <Table.Row key={p.katalog_uuid}>
                        <Table.Cell><Text fontSize="sm">{p.name}</Text></Table.Cell>
                        <Table.Cell textAlign="right"><Text fontSize="sm">{Number(p.menge)} {p.einheit || ''}</Text></Table.Cell>
                        <Table.Cell textAlign="right"><Text fontSize="sm">{euro(p.ek_einzel)}</Text></Table.Cell>
                        <Table.Cell textAlign="right">
                          <Text fontSize="sm">{p.vk_einzel != null ? euro(p.vk_einzel) : 'aus PDS-Katalog'}</Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
              <Button size="sm" variant="outline" colorPalette="blue" mt={2} onClick={handleTransport}
                loading={sendet === 'transport'}>
                <Send size={14} /> Transportangebot anlegen
              </Button>
            </Box>
          )}

          {vorschau.nicht_uebertragbar.length > 0 && (
            <Box mt={2} borderWidth="1px" borderColor="orange.200" bg="orange.50" borderRadius="md" p={2}>
              <Text fontSize="xs" fontWeight="medium" color="orange.800">
                Bleibt im Shop ({vorschau.nicht_uebertragbar.length})
              </Text>
              {vorschau.nicht_uebertragbar.map((p, i) => (
                <Text key={i} fontSize="xs" color="orange.900">{p.name} — {p.grund}</Text>
              ))}
            </Box>
          )}
          <Text fontSize="xs" color="fg.muted" mt={2}>{vorschau.hinweis}</Text>
        </Box>
      )}

      {fehler && <Text fontSize="sm" color="red.600" mt={2}>{fehler}</Text>}
    </Box>
  )
}
