import React, { useEffect, useState } from 'react'
import {
  Dialog, Portal, Button, Field, Input, Textarea, VStack, HStack, Box, Text,
  Select, NativeSelect, IconButton, Flex, Spacer, createListCollection,
} from '@chakra-ui/react'
import { X, Upload, Link as LinkIcon, Image as ImgIcon } from 'lucide-react'
import { createArtikel, updateArtikel, deleteArtikel } from '../../data/api/artikel.js'
import { uploadArtikelBild, deleteArtikelBild } from '../../data/api/storage.js'
import ArtikelBild from './ArtikelBild.jsx'

export default function ArtikelDialog({ open, onClose, artikel, kategorien, onSaved }) {
  const isNew = !artikel?.id
  const [name, setName] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [kategorieId, setKategorieId] = useState('')
  const [lieferant, setLieferant] = useState('')
  const [lieferantUrl, setLieferantUrl] = useState('')
  const [preis, setPreis] = useState('')
  const [einheit, setEinheit] = useState('Stück')
  const [aktiv, setAktiv] = useState(true)
  const [tagsRaw, setTagsRaw] = useState('')
  const [bildExternUrl, setBildExternUrl] = useState('')
  const [bildDatei, setBildDatei] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    if (artikel) {
      setName(artikel.name || '')
      setBeschreibung(artikel.beschreibung || '')
      setKategorieId(artikel.kategorie_id || '')
      setLieferant(artikel.lieferant || '')
      setLieferantUrl(artikel.lieferant_url || '')
      setPreis(artikel.preis_netto != null ? String(artikel.preis_netto) : '')
      setEinheit(artikel.einheit || 'Stück')
      setAktiv(artikel.aktiv !== false)
      setTagsRaw((artikel.tags || []).map((t) => t.name).join(', '))
      setBildExternUrl(artikel.bild_ist_extern ? (artikel.bild_url || '') : '')
    } else {
      setName(''); setBeschreibung(''); setKategorieId('')
      setLieferant(''); setLieferantUrl(''); setPreis(''); setEinheit('Stück')
      setAktiv(true); setTagsRaw(''); setBildExternUrl('')
    }
    setBildDatei(null); setError(null)
  }, [open, artikel])

  async function save() {
    setSaving(true); setError(null)
    try {
      const fields = {
        name: name.trim(),
        beschreibung: beschreibung.trim() || null,
        kategorie_id: kategorieId || null,
        lieferant: lieferant.trim() || null,
        lieferant_url: lieferantUrl.trim() || null,
        preis_netto: preis ? Number(preis.replace(',', '.')) : null,
        einheit: einheit || null,
        aktiv,
      }
      if (bildExternUrl && !bildDatei) {
        fields.bild_url = bildExternUrl.trim()
        fields.bild_ist_extern = true
      }

      const tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean)

      let saved
      if (isNew) {
        saved = await createArtikel(fields, tags)
      } else {
        saved = await updateArtikel(artikel.id, fields, tags)
      }

      // Bild-Datei-Upload NACH Artikel-Erstellung (braucht artikel.id fuer Storage-Pfad)
      if (bildDatei) {
        // Bei Update: altes internes Bild loeschen
        if (!isNew && artikel?.bild_url && !artikel?.bild_ist_extern) {
          try { await deleteArtikelBild(artikel.bild_url) } catch { /* egal */ }
        }
        const path = await uploadArtikelBild(saved.id, bildDatei)
        await updateArtikel(saved.id, { bild_url: path, bild_ist_extern: false })
      }

      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.message || 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!artikel?.id) return
    if (!window.confirm(`Artikel "${artikel.name}" wirklich loeschen?`)) return
    setSaving(true); setError(null)
    try {
      if (artikel.bild_url && !artikel.bild_ist_extern) {
        try { await deleteArtikelBild(artikel.bild_url) } catch { /* egal */ }
      }
      await deleteArtikel(artikel.id)
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.message || 'Loeschen fehlgeschlagen (evtl. in Bestellungen referenziert — dann besser deaktivieren)')
    } finally {
      setSaving(false)
    }
  }

  const kategorienCollection = createListCollection({
    items: [{ label: '– keine –', value: '' }, ...kategorien.map((k) => ({ label: k.name, value: k.id }))],
  })

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{isNew ? 'Neuer Artikel' : 'Artikel bearbeiten'}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton size="sm" variant="ghost"><X size={16} /></IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={3} align="stretch">
                <HStack align="flex-start" gap={4}>
                  <VStack gap={2} align="stretch">
                    <ArtikelBild artikel={artikel} size="100px" />
                    <Text fontSize="xs" color="fg.muted" textAlign="center">Vorschau</Text>
                  </VStack>
                  <VStack gap={2} align="stretch" flex="1">
                    <Field.Root required>
                      <Field.Label>Name</Field.Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Beschreibung</Field.Label>
                      <Textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={2} />
                    </Field.Root>
                  </VStack>
                </HStack>

                <HStack gap={2}>
                  <Field.Root>
                    <Field.Label>Kategorie</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field value={kategorieId} onChange={(e) => setKategorieId(e.target.value)}>
                        <option value="">– keine –</option>
                        {kategorien.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Einheit</Field.Label>
                    <Input value={einheit} onChange={(e) => setEinheit(e.target.value)} placeholder="Stück, Meter, Packung..." />
                  </Field.Root>
                </HStack>

                <Field.Root>
                  <Field.Label>Tags (kommagetrennt)</Field.Label>
                  <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="cat6, verbrauch, elektrik" />
                </Field.Root>

                <HStack gap={2}>
                  <Field.Root>
                    <Field.Label>Lieferant</Field.Label>
                    <Input value={lieferant} onChange={(e) => setLieferant(e.target.value)} placeholder="Reichelt, Conrad, Amazon..." />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Preis (netto, €)</Field.Label>
                    <Input value={preis} onChange={(e) => setPreis(e.target.value)} placeholder="0,00" />
                  </Field.Root>
                </HStack>

                <Field.Root>
                  <Field.Label>Lieferanten-URL</Field.Label>
                  <Input value={lieferantUrl} onChange={(e) => setLieferantUrl(e.target.value)} placeholder="https://..." />
                </Field.Root>

                <Box borderWidth="1px" borderRadius="md" p={3} bg="bg.subtle">
                  <Text fontWeight="bold" fontSize="sm" mb={2}>Bild</Text>
                  <VStack gap={2} align="stretch">
                    <Field.Root>
                      <Field.Label><HStack gap={1}><ImgIcon size={12} /> Datei hochladen</HStack></Field.Label>
                      <Input type="file" accept="image/*" onChange={(e) => setBildDatei(e.target.files?.[0] || null)} />
                    </Field.Root>
                    <Text fontSize="xs" color="fg.muted">— oder —</Text>
                    <Field.Root>
                      <Field.Label><HStack gap={1}><LinkIcon size={12} /> Externe URL</HStack></Field.Label>
                      <Input value={bildExternUrl} onChange={(e) => setBildExternUrl(e.target.value)} placeholder="https://.../bild.jpg" />
                    </Field.Root>
                  </VStack>
                </Box>

                <HStack>
                  <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} id="aktiv-cb" />
                  <label htmlFor="aktiv-cb"><Text fontSize="sm">Artikel aktiv (im Katalog sichtbar)</Text></label>
                </HStack>

                {error && <Text color="red.500" fontSize="sm">{error}</Text>}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack w="100%">
                {!isNew && (
                  <Button variant="ghost" colorPalette="red" onClick={handleDelete} loading={saving}>Löschen</Button>
                )}
                <Spacer />
                <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
                <Button colorPalette="blue" onClick={save} loading={saving} disabled={!name.trim()}>
                  {isNew ? 'Anlegen' : 'Speichern'}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
