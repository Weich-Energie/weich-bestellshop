import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Button, Input, Table, Badge, Spinner, Flex, Spacer,
  IconButton,
} from '@chakra-ui/react'
import { Plus, Trash2, Edit3, Tag } from 'lucide-react'
import {
  listArtikel, pruefeArtikelVerwendung, setzeArtikelAktiv, deleteArtikelMehrere,
} from '../../data/api/artikel.js'
import { listKategorien, createKategorie, deleteKategorie } from '../../data/api/kategorien.js'
import ArtikelBild from '../components/ArtikelBild.jsx'
import ArtikelDialog from '../components/ArtikelDialog.jsx'
import ArtikelLoeschDialog from '../components/ArtikelLoeschDialog.jsx'
import ArtikelFilter, {
  LEERER_FILTER, artikelFiltern, lieferantenAus, AuswahlLeiste,
} from '../components/ArtikelFilter.jsx'

export default function AdminKatalogPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState(LEERER_FILTER)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editArtikel, setEditArtikel] = useState(null)
  const [neueKategorie, setNeueKategorie] = useState('')
  const [auswahl, setAuswahl] = useState(() => new Set())
  const [loeschDialog, setLoeschDialog] = useState(null)
  const [arbeitet, setArbeitet] = useState(false)

  const { data: artikelListe = [], isLoading: loadingArt } = useQuery({
    queryKey: ['shop-artikel-admin'],
    queryFn: () => listArtikel({ includeInaktiv: true }),
  })
  const { data: kategorien = [] } = useQuery({
    queryKey: ['shop-kategorien'],
    queryFn: listKategorien,
  })

  const lieferanten = useMemo(() => lieferantenAus(artikelListe), [artikelListe])
  const gefiltert = useMemo(() => artikelFiltern(artikelListe, filter), [artikelListe, filter])

  const ausgewaehlt = useMemo(
    () => gefiltert.filter((a) => auswahl.has(a.id)),
    [gefiltert, auswahl],
  )
  const alleGewaehlt = gefiltert.length > 0 && ausgewaehlt.length === gefiltert.length

  function umschalten(id) {
    setAuswahl((alt) => {
      const neu = new Set(alt)
      if (neu.has(id)) neu.delete(id); else neu.add(id)
      return neu
    })
  }
  function alleUmschalten() {
    setAuswahl((alt) => {
      const neu = new Set(alt)
      if (alleGewaehlt) gefiltert.forEach((a) => neu.delete(a.id))
      else gefiltert.forEach((a) => neu.add(a.id))
      return neu
    })
  }

  async function handleSichtbarkeit(aktiv) {
    const ids = ausgewaehlt.map((a) => a.id)
    if (!ids.length) return
    setArbeitet(true)
    try {
      await setzeArtikelAktiv(ids, aktiv)
      setAuswahl(new Set())
      refresh()
    } catch (e) {
      window.alert(`Konnte nicht ${aktiv ? 'einblenden' : 'ausblenden'}: ${e.message}`)
    } finally {
      setArbeitet(false)
    }
  }

  // Erst pruefen, was an den Artikeln haengt, dann fragen. Ein Loeschen, das
  // stillschweigend Zaehllisten-Zeilen und Preishistorie mitnimmt, waere eine
  // boese Ueberraschung.
  async function handleLoeschenVorbereiten(liste) {
    if (!liste.length) return
    setArbeitet(true)
    try {
      const { je, unlesbar } = await pruefeArtikelVerwendung(liste.map((a) => a.id))
      setLoeschDialog({ liste, je, unlesbar })
    } catch (e) {
      window.alert(`Prüfung fehlgeschlagen: ${e.message}`)
    } finally {
      setArbeitet(false)
    }
  }

  async function handleLoeschenAusfuehren(ids) {
    if (!ids.length) return
    setArbeitet(true)
    try {
      const { geloescht, gescheitert } = await deleteArtikelMehrere(ids)
      setAuswahl((alt) => {
        const neu = new Set(alt)
        geloescht.forEach((id) => neu.delete(id))
        return neu
      })
      setLoeschDialog(null)
      refresh()
      if (gescheitert.length) {
        window.alert(
          `${geloescht.length} gelöscht, ${gescheitert.length} nicht.\n\n` +
          gescheitert.slice(0, 8).map((g) => g.fehler).join('\n'),
        )
      }
    } catch (e) {
      window.alert(`Löschen fehlgeschlagen: ${e.message}`)
    } finally {
      setArbeitet(false)
    }
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ['shop-artikel-admin'] })
    qc.invalidateQueries({ queryKey: ['shop-artikel'] })
    qc.invalidateQueries({ queryKey: ['shop-kategorien'] })
  }

  async function handleAddKategorie() {
    const name = neueKategorie.trim()
    if (!name) return
    await createKategorie({ name })
    setNeueKategorie('')
    refresh()
  }

  async function handleDeleteKategorie(id, name) {
    if (!window.confirm(`Kategorie "${name}" loeschen? Betroffene Artikel behalten die Referenz nicht.`)) return
    try {
      await deleteKategorie(id)
      refresh()
    } catch (e) {
      alert(e.message)
    }
  }

  const kategorieMap = useMemo(
    () => new Map(kategorien.map((k) => [k.id, k])),
    [kategorien],
  )

  return (
    <Box>
      <Flex mb={4} align="center" flexWrap="wrap" gap={2}>
        <Heading size="lg">Katalog verwalten</Heading>
        <Spacer />
        <Button colorPalette="blue" onClick={() => { setEditArtikel(null); setDialogOpen(true) }}>
          <Plus size={16} /> Neuer Artikel
        </Button>
      </Flex>

      <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
        <Text fontWeight="bold" fontSize="sm" mb={2}><HStack gap={1} display="inline-flex"><Tag size={14} /> Kategorien</HStack></Text>
        <HStack gap={2} flexWrap="wrap" mb={3}>
          {kategorien.map((k) => (
            <HStack key={k.id} px={2} py={1} borderWidth="1px" borderRadius="md" bg="gray.50" gap={1}>
              <Text fontSize="sm">{k.name}</Text>
              <IconButton size="2xs" variant="ghost" colorPalette="red" onClick={() => handleDeleteKategorie(k.id, k.name)} aria-label="Löschen">
                <Trash2 size={12} />
              </IconButton>
            </HStack>
          ))}
          {kategorien.length === 0 && <Text fontSize="xs" color="fg.muted">Noch keine Kategorien.</Text>}
        </HStack>
        <HStack gap={2}>
          <Input size="sm" placeholder="Neue Kategorie..." value={neueKategorie}
            onChange={(e) => setNeueKategorie(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddKategorie()} maxW="240px" />
          <Button size="sm" onClick={handleAddKategorie} disabled={!neueKategorie.trim()}>
            <Plus size={14} /> Anlegen
          </Button>
        </HStack>
      </Box>

      <Box borderWidth="1px" borderRadius="lg" p={4} bg="white">
        <ArtikelFilter filter={filter} setFilter={setFilter}
          kategorien={kategorien} lieferanten={lieferanten}
          rechts={<Text fontSize="sm" color="fg.muted">{gefiltert.length} von {artikelListe.length}</Text>} />

        <AuswahlLeiste
          anzahl={ausgewaehlt.length}
          arbeitet={arbeitet}
          onAusblenden={() => handleSichtbarkeit(false)}
          onEinblenden={() => handleSichtbarkeit(true)}
          onLoeschen={() => handleLoeschenVorbereiten(ausgewaehlt)}
          onAufheben={() => setAuswahl(new Set())}
        />

        {loadingArt ? (
          <Flex justify="center" p={8}><Spinner /></Flex>
        ) : (
          <Box overflowX="auto">
          <Table.Root variant="line" size="sm" minW="720px">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader w="34px">
                  <input type="checkbox" checked={alleGewaehlt} onChange={alleUmschalten}
                    aria-label="Alle sichtbaren auswählen" style={{ cursor: 'pointer' }} />
                </Table.ColumnHeader>
                <Table.ColumnHeader></Table.ColumnHeader>
                <Table.ColumnHeader>Name</Table.ColumnHeader>
                <Table.ColumnHeader>Kategorie</Table.ColumnHeader>
                <Table.ColumnHeader>Lieferant</Table.ColumnHeader>
                <Table.ColumnHeader>Preis</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader></Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {gefiltert.map((a) => (
                <Table.Row key={a.id} bg={auswahl.has(a.id) ? 'blue.50' : undefined}>
                  <Table.Cell>
                    <input type="checkbox" checked={auswahl.has(a.id)} onChange={() => umschalten(a.id)}
                      aria-label={`${a.name} auswählen`} style={{ cursor: 'pointer' }} />
                  </Table.Cell>
                  <Table.Cell><ArtikelBild artikel={a} size="48px" kantenlaenge={120} /></Table.Cell>
                  <Table.Cell>
                    <Text fontWeight="medium" fontSize="sm">{a.name}</Text>
                    {a.tags?.length > 0 && (
                      <HStack gap={1} mt={1} flexWrap="wrap">
                        {a.tags.slice(0, 3).map((t) => <Badge key={t.id} size="xs" variant="subtle">{t.name}</Badge>)}
                        {a.tags.length > 3 && <Text fontSize="xs" color="fg.muted">+{a.tags.length - 3}</Text>}
                      </HStack>
                    )}
                  </Table.Cell>
                  <Table.Cell><Text fontSize="sm">{kategorieMap.get(a.kategorie_id)?.name || '—'}</Text></Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm">{a.lieferant || '—'}</Text>
                    {a.artikelnr && <Text fontSize="xs" color="fg.muted">Art-Nr: {a.artikelnr}</Text>}
                  </Table.Cell>
                  <Table.Cell><Text fontSize="sm">{a.preis_netto != null ? `${Number(a.preis_netto).toFixed(2)} €` : '—'}</Text></Table.Cell>
                  <Table.Cell>
                    <HStack gap={1} flexWrap="wrap">
                      <Badge colorPalette={a.aktiv ? 'green' : 'gray'} size="sm">
                        {a.aktiv ? 'aktiv' : 'inaktiv'}
                      </Badge>
                      {/* Die drei Sichten auf einen Blick — sonst muesste
                          Patrick jeden Artikel oeffnen, um zu sehen, wo er
                          erscheint. */}
                      {a.bestellbar === false && (
                        <Badge colorPalette="gray" size="sm" variant="outline">nicht bestellbar</Badge>
                      )}
                      {a.nachkalkulation_klima && (
                        <Badge colorPalette="purple" size="sm" variant="subtle">Klima</Badge>
                      )}
                      {a.sichtbar_aufmass && (
                        <Badge colorPalette="blue" size="sm" variant="subtle">Aufmaß</Badge>
                      )}
                    </HStack>
                  </Table.Cell>
                  <Table.Cell>
                    <HStack gap={0}>
                      <IconButton size="sm" variant="ghost" aria-label="Bearbeiten"
                        onClick={() => { setEditArtikel(a); setDialogOpen(true) }}>
                        <Edit3 size={14} />
                      </IconButton>
                      <IconButton size="sm" variant="ghost" colorPalette="red" aria-label="Löschen"
                        disabled={arbeitet} onClick={() => handleLoeschenVorbereiten([a])}>
                        <Trash2 size={14} />
                      </IconButton>
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              ))}
              {gefiltert.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={8}>
                    <Text py={4} textAlign="center" color="fg.muted">
                      {artikelListe.length === 0 ? 'Noch keine Artikel — leg den ersten an.' : 'Keine Treffer.'}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
          </Box>
        )}
      </Box>

      <ArtikelDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        artikel={editArtikel}
        kategorien={kategorien}
        onSaved={refresh}
      />

      <ArtikelLoeschDialog
        daten={loeschDialog}
        arbeitet={arbeitet}
        onClose={() => setLoeschDialog(null)}
        onLoeschen={handleLoeschenAusfuehren}
        onAusblenden={async (ids) => {
          setArbeitet(true)
          try {
            await setzeArtikelAktiv(ids, false)
            setAuswahl(new Set())
            setLoeschDialog(null)
            refresh()
          } catch (e) {
            window.alert(`Ausblenden fehlgeschlagen: ${e.message}`)
          } finally {
            setArbeitet(false)
          }
        }}
      />
    </Box>
  )
}
