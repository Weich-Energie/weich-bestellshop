import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Heading, Text, HStack, VStack, Button, Input, Table, Badge, Spinner, Flex, Spacer,
  IconButton,
} from '@chakra-ui/react'
import { Plus, Search, Trash2, Edit3, Tag } from 'lucide-react'
import { listArtikel } from '../../data/api/artikel.js'
import { listKategorien, createKategorie, deleteKategorie } from '../../data/api/kategorien.js'
import ArtikelBild from '../components/ArtikelBild.jsx'
import ArtikelDialog from '../components/ArtikelDialog.jsx'

export default function AdminKatalogPage() {
  const qc = useQueryClient()
  const [suche, setSuche] = useState('')
  const [kategorieFilter, setKategorieFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editArtikel, setEditArtikel] = useState(null)
  const [neueKategorie, setNeueKategorie] = useState('')

  const { data: artikelListe = [], isLoading: loadingArt } = useQuery({
    queryKey: ['shop-artikel-admin'],
    queryFn: () => listArtikel({ includeInaktiv: true }),
  })
  const { data: kategorien = [] } = useQuery({
    queryKey: ['shop-kategorien'],
    queryFn: listKategorien,
  })

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase()
    return artikelListe.filter((a) => {
      if (kategorieFilter && a.kategorie_id !== kategorieFilter) return false
      if (!s) return true
      const haystack = [a.name, a.beschreibung, a.lieferant, ...(a.tags || []).map((t) => t.name)]
        .filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(s)
    })
  }, [artikelListe, suche, kategorieFilter])

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
        <HStack mb={3} gap={2} flexWrap="wrap">
          <HStack borderWidth="1px" borderRadius="md" px={2} bg="gray.50">
            <Search size={14} />
            <Input variant="flushed" size="sm" placeholder="Suche..." value={suche} onChange={(e) => setSuche(e.target.value)} border="none" />
          </HStack>
          <select value={kategorieFilter} onChange={(e) => setKategorieFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6 }}>
            <option value="">Alle Kategorien</option>
            {kategorien.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <Spacer />
          <Text fontSize="sm" color="fg.muted">{gefiltert.length} von {artikelListe.length}</Text>
        </HStack>

        {loadingArt ? (
          <Flex justify="center" p={8}><Spinner /></Flex>
        ) : (
          <Table.Root variant="line" size="sm">
            <Table.Header>
              <Table.Row>
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
                <Table.Row key={a.id}>
                  <Table.Cell><ArtikelBild artikel={a} size="48px" /></Table.Cell>
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
                  <Table.Cell><Text fontSize="sm">{a.lieferant || '—'}</Text></Table.Cell>
                  <Table.Cell><Text fontSize="sm">{a.preis_netto != null ? `${Number(a.preis_netto).toFixed(2)} €` : '—'}</Text></Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={a.aktiv ? 'green' : 'gray'} size="sm">
                      {a.aktiv ? 'aktiv' : 'inaktiv'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <IconButton size="sm" variant="ghost" onClick={() => { setEditArtikel(a); setDialogOpen(true) }}>
                      <Edit3 size={14} />
                    </IconButton>
                  </Table.Cell>
                </Table.Row>
              ))}
              {gefiltert.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={7}>
                    <Text py={4} textAlign="center" color="fg.muted">
                      {artikelListe.length === 0 ? 'Noch keine Artikel — leg den ersten an.' : 'Keine Treffer.'}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        )}
      </Box>

      <ArtikelDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        artikel={editArtikel}
        kategorien={kategorien}
        onSaved={refresh}
      />
    </Box>
  )
}
