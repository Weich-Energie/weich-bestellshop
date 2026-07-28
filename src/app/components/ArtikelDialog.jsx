import React, { useEffect, useState } from 'react'
import {
  Dialog, Portal, Button, Field, Input, Textarea, VStack, HStack, Box, Text,
  Select, NativeSelect, IconButton, Flex, Spacer, Spinner, createListCollection,
} from '@chakra-ui/react'
import { X, Upload, Link as LinkIcon, Image as ImgIcon, Plus, Trash2, Package, Layers, Sparkles, ExternalLink } from 'lucide-react'
import { createArtikel, updateArtikel, deleteArtikel, replaceVarianten, replaceGebinde } from '../../data/api/artikel.js'
import { createKategorie } from '../../data/api/kategorien.js'
import { uploadArtikelBild, deleteArtikelBild } from '../../data/api/storage.js'
import { enrichArtikel, extractShopLink, extractShopScreenshot } from '../../data/api/shopAi.js'
import ArtikelBild from './ArtikelBild.jsx'

export default function ArtikelDialog({ open, onClose, artikel, prefill, kategorien, onSaved }) {
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
  const [varianten, setVarianten] = useState([]) // [{ name }]
  const [gebinde, setGebinde] = useState([])     // [{ name, stueckzahl, ist_default }]
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [bildsucheQuery, setBildsucheQuery] = useState('') // Fuer Google-Bildsuche-Link nach KI-Enrich
  const [linkUrl, setLinkUrl] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState(null)
  const [screenshotBusy, setScreenshotBusy] = useState(false)
  const [screenshotError, setScreenshotError] = useState(null)

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
      setVarianten((artikel.varianten || []).map((v) => ({ name: v.name })))
      setGebinde((artikel.gebinde || []).map((g) => ({ name: g.name, stueckzahl: g.stueckzahl, ist_default: !!g.ist_default })))
    } else if (prefill) {
      setName(prefill.name || '')
      setBeschreibung(prefill.beschreibung || '')
      setKategorieId(prefill.kategorie_id || '')
      setLieferant(prefill.lieferant || '')
      setLieferantUrl(prefill.lieferant_url || '')
      setPreis(prefill.preis_netto != null ? String(prefill.preis_netto) : '')
      setEinheit(prefill.einheit || 'Stück')
      setAktiv(true)
      setTagsRaw(prefill.tags || '')
      setBildExternUrl(prefill.bild_extern_url || '')
      setVarianten([]); setGebinde([])
    } else {
      setName(''); setBeschreibung(''); setKategorieId('')
      setLieferant(''); setLieferantUrl(''); setPreis(''); setEinheit('Stück')
      setAktiv(true); setTagsRaw(''); setBildExternUrl('')
      setVarianten([]); setGebinde([])
    }
    setBildDatei(null); setError(null); setAiError(null); setBildsucheQuery('')
    setLinkUrl(''); setLinkError(null); setScreenshotError(null)
  }, [open, artikel, prefill])

  // Uebernimmt ein KI-Extract-Ergebnis (aus Link oder Screenshot) in die Formularfelder.
  async function applyExtractResult(result, quellUrl) {
    if (!result) return
    if (result.name) setName(result.name)
    if (result.beschreibung) setBeschreibung(result.beschreibung)
    if (result.preis_netto != null && !isNaN(Number(result.preis_netto))) {
      setPreis(String(Number(result.preis_netto).toFixed(2)))
    }
    if (result.einheit) setEinheit(result.einheit)
    if (Array.isArray(result.tags) && result.tags.length) setTagsRaw(result.tags.join(', '))
    if (result.lieferant) setLieferant(result.lieferant)
    if (quellUrl) setLieferantUrl(quellUrl)
    if (result.bild_url) setBildExternUrl(result.bild_url)
    if (result.bildsuche_query) setBildsucheQuery(result.bildsuche_query)
    if (result.kategorie) {
      const cleaned = String(result.kategorie).replace(/^NEU:\s*/i, '').trim()
      const existing = kategorien.find((k) => k.name.toLowerCase() === cleaned.toLowerCase())
      if (existing) setKategorieId(existing.id)
      else if (cleaned) {
        try {
          const neu = await createKategorie({ name: cleaned })
          setKategorieId(neu.id)
        } catch { /* ignore */ }
      }
    }
  }

  async function handleScreenshotImport(file) {
    if (!file) return
    setScreenshotBusy(true); setScreenshotError(null)
    try {
      const result = await extractShopScreenshot({
        file,
        url: linkUrl.trim(),
        kategorien: kategorien.map((k) => k.name),
      })
      if (!result) throw new Error('Keine Antwort von der KI')
      await applyExtractResult(result, linkUrl.trim() || null)
    } catch (e) {
      setScreenshotError(e.message || 'Screenshot-Analyse fehlgeschlagen')
    } finally {
      setScreenshotBusy(false)
    }
  }

  async function handleLinkImport() {
    if (!linkUrl.trim()) { setLinkError('Bitte URL eingeben.'); return }
    setLinkBusy(true); setLinkError(null)
    try {
      const result = await extractShopLink({
        url: linkUrl.trim(),
        kategorien: kategorien.map((k) => k.name),
      })
      if (!result) throw new Error('Keine Antwort von der KI')
      // Link-Import ist "Neuanlage aus URL" — darf alle Felder ueberschreiben
      await applyExtractResult(result, linkUrl.trim())
    } catch (e) {
      setLinkError(e.message || 'Import fehlgeschlagen')
    } finally {
      setLinkBusy(false)
    }
  }

  async function handleKiVorschlag() {
    if (!name.trim()) { setAiError('Name eingeben, bevor die KI arbeitet.'); return }
    setAiBusy(true); setAiError(null)
    try {
      const result = await enrichArtikel({
        name: name.trim(),
        beschreibung: beschreibung.trim(),
        kategorien: kategorien.map((k) => k.name),
      })
      if (!result) throw new Error('Keine Antwort von der KI')

      // Beschreibung + Tags + Einheit uebernehmen (falls leer, sonst nicht ueberschreiben)
      if (result.beschreibung && !beschreibung.trim()) setBeschreibung(result.beschreibung)
      if (Array.isArray(result.tags) && result.tags.length && !tagsRaw.trim()) {
        setTagsRaw(result.tags.join(', '))
      }
      if (result.einheit && einheit === 'Stück') setEinheit(result.einheit)
      if (result.bildsuche_query) setBildsucheQuery(result.bildsuche_query)

      // Kategorie: matching per Name (case-insensitive). Wenn KI "NEU: X" liefert → anlegen.
      if (result.kategorie && !kategorieId) {
        const raw = String(result.kategorie).trim()
        const cleaned = raw.replace(/^NEU:\s*/i, '').trim()
        const existing = kategorien.find((k) => k.name.toLowerCase() === cleaned.toLowerCase())
        if (existing) {
          setKategorieId(existing.id)
        } else if (cleaned) {
          try {
            const neu = await createKategorie({ name: cleaned })
            setKategorieId(neu.id)
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setAiError(e.message || 'KI-Aufruf fehlgeschlagen')
    } finally {
      setAiBusy(false)
    }
  }

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
        if (!isNew && artikel?.bild_url && !artikel?.bild_ist_extern) {
          try { await deleteArtikelBild(artikel.bild_url) } catch { /* egal */ }
        }
        const path = await uploadArtikelBild(saved.id, bildDatei)
        saved = await updateArtikel(saved.id, { bild_url: path, bild_ist_extern: false })
      }

      // Varianten + Gebinde ersetzen (full replace, ist einfacher als Diff)
      await replaceVarianten(saved.id, varianten)
      await replaceGebinde(saved.id, gebinde)

      onSaved?.(saved)
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
                {isNew && (
                  <Box borderWidth="1px" borderRadius="md" p={3} bg="purple.50" borderColor="purple.200">
                    <Text fontWeight="bold" fontSize="sm" mb={2} color="purple.900">
                      <HStack gap={1} display="inline-flex"><Sparkles size={12} /> Artikel automatisch übernehmen</HStack>
                    </Text>
                    <HStack gap={2}>
                      <Input size="sm" bg="white" placeholder="https://shop.example.de/produkt/xyz"
                        value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} flex="1"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLinkImport() } }} />
                      <Button size="sm" colorPalette="purple" onClick={handleLinkImport}
                        loading={linkBusy} disabled={!linkUrl.trim() || screenshotBusy}>
                        <LinkIcon size={14} /> Aus Link
                      </Button>
                    </HStack>
                    {linkError && (
                      <Text color="red.500" fontSize="xs" mt={2}>
                        {linkError} — versuche es mit einem Screenshot.
                      </Text>
                    )}

                    <HStack gap={2} my={2} align="center">
                      <Box flex="1" h="1px" bg="purple.200" />
                      <Text fontSize="xs" color="purple.700">oder Screenshot der Produktseite</Text>
                      <Box flex="1" h="1px" bg="purple.200" />
                    </HStack>

                    {/* Fallback fuer Bot-Blockaden, SPA-Shops und Login-Walls: Screenshot
                        einfuegen (Win+Shift+S → Strg+V) oder Datei waehlen. */}
                    <Box
                      tabIndex={0}
                      onPaste={(e) => {
                        const item = Array.from(e.clipboardData?.items || [])
                          .find((i) => i.type.startsWith('image/'))
                        if (!item) return
                        e.preventDefault()
                        handleScreenshotImport(item.getAsFile())
                      }}
                      borderWidth="1px" borderStyle="dashed" borderColor="purple.300"
                      borderRadius="md" p={2} bg="white"
                      _focusVisible={{ borderColor: 'purple.500', outline: 'none', boxShadow: '0 0 0 1px var(--chakra-colors-purple-500)' }}
                    >
                      <VStack gap={2} align="stretch">
                        <Text fontSize="xs" color="fg.muted">
                          Hierhin klicken und mit <b>Strg+V</b> einfügen (Screenshot mit Win+Shift+S) — oder Datei wählen:
                        </Text>
                        <Input size="sm" type="file" accept="image/*" disabled={screenshotBusy || linkBusy}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            handleScreenshotImport(file)
                          }} />
                        {screenshotBusy && (
                          <HStack gap={2}>
                            <Spinner size="xs" colorPalette="purple" />
                            <Text fontSize="xs" color="purple.700">Screenshot wird analysiert…</Text>
                          </HStack>
                        )}
                      </VStack>
                    </Box>
                    {screenshotError && <Text color="red.500" fontSize="xs" mt={2}>{screenshotError}</Text>}
                  </Box>
                )}
                <HStack align="flex-start" gap={4}>
                  <VStack gap={2} align="stretch">
                    <ArtikelBild artikel={artikel} size="100px" />
                    <Text fontSize="xs" color="fg.muted" textAlign="center">Vorschau</Text>
                  </VStack>
                  <VStack gap={2} align="stretch" flex="1">
                    <Field.Root required>
                      <Field.Label>Name</Field.Label>
                      <HStack gap={2}>
                        <Input value={name} onChange={(e) => setName(e.target.value)} flex="1" />
                        <Button size="sm" variant="outline" colorPalette="purple" onClick={handleKiVorschlag} loading={aiBusy} disabled={!name.trim()}>
                          <Sparkles size={14} /> KI-Vorschläge
                        </Button>
                      </HStack>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Beschreibung</Field.Label>
                      <Textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={2} />
                    </Field.Root>
                    {aiError && <Text color="red.500" fontSize="xs">{aiError}</Text>}
                    {bildsucheQuery && (
                      <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(bildsucheQuery)}`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: '#3182CE', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Google-Bildsuche für „{bildsucheQuery}" öffnen <ExternalLink size={12} />
                      </a>
                    )}
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

                <Box borderWidth="1px" borderRadius="md" p={3} bg="bg.subtle">
                  <HStack mb={2} justify="space-between">
                    <Text fontWeight="bold" fontSize="sm"><HStack gap={1} display="inline-flex"><Layers size={14} /> Varianten (z.B. Groesse 8, 10, 12)</HStack></Text>
                    <Button size="xs" variant="ghost" onClick={() => setVarianten((v) => [...v, { name: '' }])}>
                      <Plus size={12} /> Variante
                    </Button>
                  </HStack>
                  <VStack gap={1} align="stretch">
                    {varianten.length === 0 && <Text fontSize="xs" color="fg.muted">Keine Varianten. Ohne Varianten erscheint der Artikel normal im Katalog.</Text>}
                    {varianten.map((v, i) => (
                      <HStack key={i} gap={2}>
                        <Input size="sm" placeholder="z.B. Groesse 8" value={v.name}
                          onChange={(e) => setVarianten((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
                        <IconButton size="xs" variant="ghost" colorPalette="red"
                          onClick={() => setVarianten((prev) => prev.filter((_, idx) => idx !== i))}>
                          <Trash2 size={12} />
                        </IconButton>
                      </HStack>
                    ))}
                  </VStack>
                </Box>

                <Box borderWidth="1px" borderRadius="md" p={3} bg="bg.subtle">
                  <HStack mb={2} justify="space-between">
                    <Text fontWeight="bold" fontSize="sm"><HStack gap={1} display="inline-flex"><Package size={14} /> Gebinde/Packgroessen (z.B. Pack à 10 Stk)</HStack></Text>
                    <Button size="xs" variant="ghost" onClick={() => setGebinde((g) => [...g, { name: '', stueckzahl: 1, ist_default: g.length === 0 }])}>
                      <Plus size={12} /> Gebinde
                    </Button>
                  </HStack>
                  <VStack gap={1} align="stretch">
                    {gebinde.length === 0 && <Text fontSize="xs" color="fg.muted">Keine Gebinde. User bestellt in Basis-Einheit.</Text>}
                    {gebinde.map((g, i) => (
                      <HStack key={i} gap={2}>
                        <Input size="sm" placeholder="Name (z.B. Pack)" value={g.name}
                          onChange={(e) => setGebinde((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
                        <HStack gap={1}>
                          <Text fontSize="xs" color="fg.muted">à</Text>
                          <Input size="sm" type="number" min={1} w="70px" value={g.stueckzahl}
                            onChange={(e) => setGebinde((prev) => prev.map((x, idx) => idx === i ? { ...x, stueckzahl: Math.max(1, Number(e.target.value) || 1) } : x))} />
                          <Text fontSize="xs" color="fg.muted">Stk</Text>
                        </HStack>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          <input type="radio" name="gebinde-default" checked={!!g.ist_default}
                            onChange={() => setGebinde((prev) => prev.map((x, idx) => ({ ...x, ist_default: idx === i })))} />
                          Standard
                        </label>
                        <IconButton size="xs" variant="ghost" colorPalette="red"
                          onClick={() => setGebinde((prev) => prev.filter((_, idx) => idx !== i))}>
                          <Trash2 size={12} />
                        </IconButton>
                      </HStack>
                    ))}
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
