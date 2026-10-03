// Aufmasszettel abfotografieren statt abtippen — die Uebergangsloesung, bis das
// Aufmass durchgaengig in der App erfasst wird (Gewerk klima in weich-aufmass).
//
// Zwischen "gelesen" und "Position" liegt bewusst ein Bestaetigungsschritt.
// Zwei Gruende: Handschrift wird verwechselt (1/7, 4/9), und der Vordruck ist
// ein Shop-Ausdruck mit einer gedruckten 1 in jeder Mengenzeile, die NICHT gilt.
// Eine ungeprueft uebernommene Seite saehe vollstaendig aus und waere falsch.
//
// Zeilen ohne Artikel sind kein Fehler, sondern das Nebenprodukt: was hier
// auftaucht, wurde verbaut und fehlt im Katalog der Aufmass-App.

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box, Text, HStack, VStack, Button, Input, Table, Badge, Spinner, Flex, Spacer, IconButton,
} from '@chakra-ui/react'
import { Camera, ScanLine, Check, X, Trash2, ExternalLink, AlertTriangle, Clock, FileText, Search } from 'lucide-react'
import LieferantSucheDialog from './LieferantSucheDialog.jsx'
import { listKategorien } from '../../data/api/kategorien.js'
import { listLieferanten } from '../../data/api/lieferanten.js'
import {
  uploadAufmassFoto, leseAufmassFoto, listFotos, listZeilen, getFotoSignedUrl,
  setZeileMenge, setZeileArtikel, verwirfZeile, uebernimmZeilen, fotoStatusNachziehen, deleteFoto,
  uebernimmStunden, uebernimmAngebot,
} from '../../data/api/aufmassFoto.js'

const STATUS_FARBE = {
  neu: 'gray', laeuft: 'blue', gelesen: 'orange', uebernommen: 'green', fehler: 'red',
}
const STATUS_TEXT = {
  neu: 'noch nicht gelesen', laeuft: 'wird gelesen…', gelesen: 'gelesen, wartet auf Bestätigung',
  uebernommen: 'übernommen', fehler: 'Fehler',
}
const ART_TEXT = {
  material: 'Materialliste', stunden: 'Stundenzettel', angebot: 'Angebot', unbekannt: 'Art unklar',
}

export default function AufmassFotoBox({ nachkalkulationId, artikelListe = [], onAenderung }) {
  const qc = useQueryClient()
  const [laedtHoch, setLaedtHoch] = useState(false)
  const [liestAlle, setLiestAlle] = useState(false)
  // Welches Foto gerade gelesen wird, und bei einem Sammellauf das wievielte.
  // Ein Vision-Aufruf dauert mehrere Sekunden; ohne Rueckmeldung sieht die
  // Seite aus, als haette der Knopf nichts getan.
  const [liestFoto, setLiestFoto] = useState(null)
  const [fortschritt, setFortschritt] = useState(null)
  const [fehler, setFehler] = useState(null)
  const [offenesFoto, setOffenesFoto] = useState(null)

  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ['aufmass-fotos', nachkalkulationId],
    queryFn: () => listFotos(nachkalkulationId),
  })

  function neu() {
    qc.invalidateQueries({ queryKey: ['aufmass-fotos', nachkalkulationId] })
  }

  async function handleUpload(e) {
    const dateien = Array.from(e.target.files || [])
    if (!dateien.length) return
    setLaedtHoch(true); setFehler(null)
    try {
      // Mehrere Seiten eines Berichts gehoeren zusammen — die Reihenfolge der
      // Auswahl wird als Seitennummer festgehalten.
      let nr = fotos.length
      for (const datei of dateien) {
        nr += 1
        const foto = await uploadAufmassFoto({ nachkalkulationId, file: datei, seitennr: nr })
        neu()
        try { await leseAufmassFoto(foto.id) } catch { /* Fehler steht am Foto */ }
        neu()
      }
    } catch (e2) {
      setFehler(e2.message)
    } finally {
      setLaedtHoch(false)
      e.target.value = ''
    }
  }

  async function handleLesen(fotoId) {
    setFehler(null)
    setLiestFoto(fotoId)
    try { await leseAufmassFoto(fotoId) } catch (e) { setFehler(e.message) }
    setLiestFoto(null)
    neu()
  }

  // Auf der Baustelle zaehlt Tempo, deshalb laedt das Telefon nur hoch und
  // liest nebenher. Wer vorher weggeht, hat hier den Rest stehen.
  const ungelesen = fotos.filter((f) => f.status === 'neu' || f.status === 'fehler')

  // Der Reihe nach: jedes Bild ist ein Vision-Aufruf, gleichzeitige Aufrufe
  // bringen nur Zeitueberlaeufe.
  async function alleLesen() {
    setLiestAlle(true); setFehler(null)
    let i = 0
    for (const f of ungelesen) {
      i += 1
      setFortschritt({ nr: i, von: ungelesen.length })
      setLiestFoto(f.id)
      try { await leseAufmassFoto(f.id) } catch { /* Fehler steht am Foto */ }
      neu()
    }
    setLiestFoto(null)
    setFortschritt(null)
    setLiestAlle(false)
  }

  async function handleLoeschen(fotoId) {
    await deleteFoto(fotoId)
    if (offenesFoto === fotoId) setOffenesFoto(null)
    neu()
  }

  async function handleAnsehen(pfad) {
    const url = await getFotoSignedUrl(pfad)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
      <Flex align="center" gap={2} mb={3} flexWrap="wrap">
        <Camera size={15} />
        <Text fontWeight="bold" fontSize="sm">Aufmaßzettel</Text>
        <Spacer />
        {ungelesen.length > 0 && (
          <Button size="xs" colorPalette="blue" loading={liestAlle} onClick={alleLesen}>
            <ScanLine size={12} />{' '}
            {fortschritt ? `liest ${fortschritt.nr} von ${fortschritt.von}` : `${ungelesen.length} noch lesen`}
          </Button>
        )}
        <Button as="label" size="xs" variant="outline" cursor="pointer" loading={laedtHoch}>
          <Camera size={12} /> Fotos hinzufügen
          <input type="file" accept="image/*,application/pdf" multiple hidden onChange={handleUpload} />
        </Button>
      </Flex>

      <Text fontSize="xs" color="fg.muted" mb={3}>
        Foto des ausgefüllten Berichts hochladen — gelesen wird nur die handschriftliche
        Menge. Die gedruckte 1 im Vordruck bleibt außen vor.
      </Text>

      {fehler && <Text fontSize="sm" color="red.600" mb={2}>{fehler}</Text>}
      {isLoading && <Flex justify="center" p={4}><Spinner size="sm" /></Flex>}

      {!isLoading && fotos.length === 0 && (
        <Text fontSize="sm" color="fg.muted">Noch kein Zettel hochgeladen.</Text>
      )}

      <VStack align="stretch" gap={2}>
        {fotos.map((f) => (
          <Box key={f.id} borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
            <Flex align="center" gap={2} flexWrap="wrap">
              <Text fontSize="sm" fontWeight="medium">
                {f.seitennr ? `Seite ${f.seitennr}` : 'Seite'} · {f.original_name || 'Foto'}
              </Text>
              <Badge size="sm" variant="solid"
                colorPalette={f.blatt_art === 'stunden' ? 'purple' : f.blatt_art === 'angebot' ? 'blue' : 'gray'}>
                {ART_TEXT[f.blatt_art] || f.blatt_art}
              </Badge>
              <Badge size="sm" colorPalette={liestFoto === f.id ? 'blue' : STATUS_FARBE[f.status]} variant="subtle">
                {liestFoto === f.id
                  ? 'wird gelesen — das dauert ein paar Sekunden'
                  : (STATUS_TEXT[f.status] || f.status)}
              </Badge>
              {f.zeilen_gesamt > 0 && (
                <Text fontSize="xs" color="fg.muted">
                  {f.zeilen_offen} von {f.zeilen_gesamt} offen
                </Text>
              )}
              {f.zeilen_unsicher > 0 && (
                <HStack gap={1} color="orange.600">
                  <AlertTriangle size={12} />
                  <Text fontSize="xs">{f.zeilen_unsicher} unsicher gelesen</Text>
                </HStack>
              )}
              {f.blatt_art !== 'stunden' && f.stunden_gelesen?.zeilen?.length > 0 && (
                <Badge size="sm" colorPalette="purple" variant="outline">
                  {f.stunden_gelesen.gebucht_am ? 'Stunden gebucht' : 'auch Stunden drauf'}
                </Badge>
              )}
              {f.zeilen_ohne_artikel > 0 && (
                <Text fontSize="xs" color="purple.600">
                  {f.zeilen_ohne_artikel} ohne Artikel im Katalog
                </Text>
              )}
              <Spacer />
              <IconButton size="xs" variant="ghost" aria-label="Zettel ansehen"
                onClick={() => handleAnsehen(f.bild_pfad)}>
                <ExternalLink size={13} />
              </IconButton>
              {f.status !== 'laeuft' && (
                <Button size="xs" variant="outline" loading={liestFoto === f.id}
                  loadingText="liest…" disabled={liestAlle && liestFoto !== f.id}
                  onClick={() => handleLesen(f.id)}>
                  <ScanLine size={12} /> {f.status === 'neu' ? 'Lesen' : 'Neu lesen'}
                </Button>
              )}
              {(f.zeilen_gesamt > 0 || f.stunden_gelesen) && (
                <Button size="xs" variant="ghost"
                  onClick={() => setOffenesFoto(offenesFoto === f.id ? null : f.id)}>
                  {offenesFoto === f.id ? 'Zuklappen' : 'Ansehen'}
                </Button>
              )}
              <IconButton size="xs" variant="ghost" colorPalette="red" aria-label="Foto löschen"
                onClick={() => handleLoeschen(f.id)}>
                <Trash2 size={13} />
              </IconButton>
            </Flex>

            {f.fehler_text && (
              <Text fontSize="xs" color="red.600" mt={1}>{f.fehler_text}</Text>
            )}

            {offenesFoto === f.id && f.blatt_art === 'stunden' && (
              <StundenZettel foto={f} nachkalkulationId={nachkalkulationId}
                onAenderung={() => { neu(); onAenderung?.() }} />
            )}
            {offenesFoto === f.id && f.blatt_art === 'angebot' && (
              <AngebotBlatt foto={f} nachkalkulationId={nachkalkulationId}
                onAenderung={() => { neu(); onAenderung?.() }} />
            )}
            {offenesFoto === f.id && f.blatt_art !== 'stunden' && f.blatt_art !== 'angebot' && (
              <Zeilen
                fotoId={f.id}
                nachkalkulationId={nachkalkulationId}
                artikelListe={artikelListe}
                onAenderung={() => { neu(); onAenderung?.() }}
              />
            )}
          </Box>
        ))}
      </VStack>
    </Box>
  )
}

// ─── Stundenzettel ─────────────────────────────────────────────────────
// Die gelesenen Stunden laufen nicht von selbst in die Felder. Welcher Name
// Techniker ist und welcher Monteur, steht selten auf dem Blatt — und die
// Saetze unterscheiden sich um 6 EUR die Stunde. Also wird zugeordnet, nicht
// geraten.
function StundenZettel({ foto, nachkalkulationId, onAenderung }) {
  const zeilen = foto.stunden_gelesen?.zeilen || []
  const [rollen, setRollen] = useState(() =>
    Object.fromEntries(zeilen.map((z, i) => [i, z.rolle === 'techniker' ? 'techniker' : 'monteur'])))

  // Ein Stundenzettel läuft oft über eine ganze Woche und führt mehrere
  // Baustellen (Patrick, 02.10.2026). Die KI trägt je Zeile ein, was auf dem
  // Blatt daneben steht, und bewertet die Zugehörigkeit — gefiltert wird hier,
  // sichtbar und umkehrbar. Weggelassen hat sie nichts: wer filtert, ohne es zu
  // zeigen, nimmt dem Menschen die Möglichkeit, einen Fehler zu bemerken.
  const [dabei, setDabei] = useState(() =>
    new Set(zeilen.map((z, i) => (z.gehoert_dazu === 'nein' ? null : i)).filter((i) => i !== null)))

  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState(null)
  const erledigt = Boolean(foto.stunden_gelesen?.gebucht_am) || foto.status === 'uebernommen'

  const zaehlt = (i) => dabei.has(i)
  const summeT = zeilen.reduce((s, z, i) => s + (zaehlt(i) && rollen[i] === 'techniker' ? Number(z.stunden || 0) : 0), 0)
  const summeM = zeilen.reduce((s, z, i) => s + (zaehlt(i) && rollen[i] === 'monteur' ? Number(z.stunden || 0) : 0), 0)
  const fremd = zeilen.filter((z, i) => !zaehlt(i))
  const fremdStunden = fremd.reduce((s, z) => s + Number(z.stunden || 0), 0)

  function umschalten(i) {
    const neu = new Set(dabei)
    if (neu.has(i)) neu.delete(i)
    else neu.add(i)
    setDabei(neu)
  }

  async function uebernehmen() {
    setLaeuft(true); setFehler(null)
    try {
      await uebernimmStunden(nachkalkulationId, foto.id, {
        techniker: summeT,
        monteur: summeM,
        // Die Entscheidung wandert mit an die Zeilen: der Langtext der
        // PDS-Position führt später nur die Tage auf, die auch gezählt wurden.
        zeilen: zeilen.map((z, i) => ({
          ...z,
          rolle: rollen[i],
          gebucht: zaehlt(i),
        })),
      })
      onAenderung?.()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaeuft(false)
    }
  }

  if (!zeilen.length) {
    return <Text fontSize="sm" color="fg.muted" mt={2}>Auf dem Zettel war keine Stunde lesbar.</Text>
  }

  return (
    <Box mt={3} bg="white" borderWidth="1px" borderRadius="md" p={3}>
      <HStack gap={2} mb={2} flexWrap="wrap">
        <Clock size={14} />
        <Text fontSize="sm" fontWeight="medium">
          {dabei.size} von {zeilen.length} Einträgen · {(summeT + summeM).toLocaleString('de-DE')} Stunden
        </Text>
        {fremd.length > 0 && (
          <Badge size="sm" colorPalette="gray" variant="subtle">
            {fremd.length} andere Baustelle · {fremdStunden.toLocaleString('de-DE')} h
          </Badge>
        )}
        <Spacer />
        {!erledigt && (
          <Button size="xs" colorPalette="blue" loading={laeuft} onClick={uebernehmen}
            disabled={dabei.size === 0}>
            <Check size={12} /> Auf den Auftrag buchen
          </Button>
        )}
      </HStack>

      <Text fontSize="xs" color="fg.muted" mb={2}>
        Abgehakt zählt. Die Rolle entscheidet über den Satz — 75 €/h für Techniker, 69 €/h
        für Monteur; steht sie nicht auf dem Zettel, ist Monteur vorbelegt.
      </Text>

      <VStack align="stretch" gap={1}>
        {zeilen.map((z, i) => {
          const an = zaehlt(i)
          return (
            <HStack key={i} gap={2} fontSize="sm" opacity={an ? 1 : 0.55}>
              {erledigt ? (
                <Box w="14px">{z.gebucht === false ? '' : '·'}</Box>
              ) : (
                <input type="checkbox" checked={an} onChange={() => umschalten(i)} />
              )}
              <Text minW="130px">{z.name || '—'}</Text>
              <Text minW="88px" color="fg.muted">{z.datum || '—'}</Text>
              <Text minW="58px" textAlign="right">{Number(z.stunden || 0).toLocaleString('de-DE')} h</Text>
              {erledigt ? (
                <Badge size="sm" variant="subtle">{rollen[i] === 'techniker' ? 'Techniker' : 'Monteur'}</Badge>
              ) : (
                <select value={rollen[i]} onChange={(e) => setRollen({ ...rollen, [i]: e.target.value })}
                  disabled={!an}
                  style={{ padding: '2px 6px', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <option value="monteur">Monteur</option>
                  <option value="techniker">Techniker</option>
                </select>
              )}
              {z.baustelle && (
                <Text fontSize="xs" color={z.gehoert_dazu === 'nein' ? 'orange.700' : 'fg.muted'} truncate maxW="170px">
                  {z.baustelle}
                </Text>
              )}
              {z.gehoert_dazu === 'unklar' && !z.baustelle && (
                <Badge size="sm" colorPalette="orange" variant="subtle">ohne Baustelle</Badge>
              )}
              {z.sicherheit != null && Number(z.sicherheit) < 0.8 && (
                <Badge size="sm" colorPalette="orange" variant="subtle">unsicher</Badge>
              )}
            </HStack>
          )
        })}
      </VStack>

      {fremd.length > 0 && !erledigt && (
        <Text fontSize="xs" color="fg.muted" mt={2}>
          Die abgewählten Zeilen gehören zu einer anderen Baustelle und bleiben hier stehen,
          damit du sie prüfen kannst. Gebucht wird nur, was abgehakt ist.
        </Text>
      )}

      <HStack gap={6} mt={3} pt={2} borderTopWidth="1px">
        <Text fontSize="sm">Techniker <b>{summeT.toLocaleString('de-DE')} h</b></Text>
        <Text fontSize="sm">Monteur <b>{summeM.toLocaleString('de-DE')} h</b></Text>
        {erledigt && <Badge size="sm" colorPalette="green" variant="subtle">gebucht</Badge>}
      </HStack>
      {fehler && <Text fontSize="sm" color="red.600" mt={2}>{fehler}</Text>}
    </Box>
  )
}

// ─── Angebot als Soll-Quelle ───────────────────────────────────────────
// Der Regelfall ist der Soll-Import aus PDS. Oft ist der Auftrag dort aber noch
// nicht gefuellt — dann ist das Reonic-Angebot die einzige Soll-Quelle.
function AngebotBlatt({ foto, nachkalkulationId, onAenderung }) {
  const positionen = foto.stunden_gelesen?.angebot_positionen || []
  const summeVk = foto.stunden_gelesen?.summe_vk
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState(null)
  const [ergebnis, setErgebnis] = useState(null)
  const erledigt = foto.status === 'uebernommen'
  const ohneEk = positionen.filter((p) => p.ist_geraet && p.ek_gesamt == null).length

  async function uebernehmen() {
    setLaeuft(true); setFehler(null)
    try {
      setErgebnis(await uebernimmAngebot(nachkalkulationId, foto.id))
      onAenderung?.()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaeuft(false)
    }
  }

  if (!positionen.length) {
    return <Text fontSize="sm" color="fg.muted" mt={2}>Im Angebot war keine Position lesbar.</Text>
  }

  return (
    <Box mt={3} bg="white" borderWidth="1px" borderRadius="md" p={3}>
      <HStack gap={2} mb={2}>
        <FileText size={14} />
        <Text fontSize="sm" fontWeight="medium">
          {positionen.length} Positionen
          {summeVk != null && ` · ${Number(summeVk).toLocaleString('de-DE', { minimumFractionDigits: 2 })} € VK`}
        </Text>
        <Spacer />
        {!erledigt && (
          <Button size="xs" colorPalette="blue" loading={laeuft} onClick={uebernehmen}>
            <Check size={12} /> Als Soll übernehmen
          </Button>
        )}
      </HStack>

      <Text fontSize="xs" color="fg.muted" mb={2}>
        Überschreibt die Soll-Werte des Auftrags. Ein Angebot ist noch kein Auftrag — die
        Herkunft bleibt am Datensatz vermerkt.
      </Text>

      {ohneEk > 0 && (
        <HStack gap={1} color="orange.600" mb={2}>
          <AlertTriangle size={12} />
          <Text fontSize="xs">
            {ohneEk} Geräteposition{ohneEk > 1 ? 'en' : ''} ohne Einkaufspreis — ohne den fehlt
            die halbe Rechnung und die Deckung fällt zu hoch aus.
          </Text>
        </HStack>
      )}

      <Box overflowX="auto">
        <Table.Root variant="line" size="sm" minW="520px">
          <Table.Body>
            {positionen.map((p, i) => (
              <Table.Row key={i}>
                <Table.Cell>
                  <Text fontSize="sm">{p.bezeichnung}</Text>
                  {p.ist_geraet && <Badge size="sm" variant="subtle">Gerät</Badge>}
                </Table.Cell>
                <Table.Cell textAlign="right">
                  <Text fontSize="sm">{Number(p.menge || 1).toLocaleString('de-DE')} {p.einheit || ''}</Text>
                </Table.Cell>
                <Table.Cell textAlign="right">
                  <Text fontSize="sm" color={p.ek_gesamt == null ? 'orange.600' : undefined}>
                    {p.ek_gesamt != null
                      ? `${Number(p.ek_gesamt).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`
                      : 'kein EK'}
                  </Text>
                </Table.Cell>
                <Table.Cell textAlign="right">
                  <Text fontSize="sm">
                    {p.vk_gesamt != null
                      ? `${Number(p.vk_gesamt).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`
                      : '—'}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      {ergebnis && (
        <Text fontSize="sm" color="green.700" mt={2}>
          Übernommen: {ergebnis.positionen} Positionen, Geräteeinkauf{' '}
          {Number(ergebnis.ek_geraete).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
        </Text>
      )}
      {erledigt && !ergebnis && (
        <Badge size="sm" colorPalette="green" variant="subtle" mt={2}>als Soll übernommen</Badge>
      )}
      {fehler && <Text fontSize="sm" color="red.600" mt={2}>{fehler}</Text>}
    </Box>
  )
}

// ─── Die gelesenen Zeilen einer Seite ──────────────────────────────────

function Zeilen({ fotoId, nachkalkulationId, artikelListe, onAenderung }) {
  const qc = useQueryClient()
  const [fehler, setFehler] = useState(null)
  const [laeuft, setLaeuft] = useState(false)

  const { data: zeilen = [], isLoading } = useQuery({
    queryKey: ['aufmass-zeilen', fotoId],
    queryFn: () => listZeilen(fotoId),
  })
  // Fuer den Suchdialog: Kategorie und Lieferant eines neu angelegten Artikels.
  const { data: kategorien = [] } = useQuery({ queryKey: ['kategorien'], queryFn: listKategorien })
  const { data: lieferanten = [] } = useQuery({ queryKey: ['lieferanten'], queryFn: listLieferanten })

  function neu() {
    qc.invalidateQueries({ queryKey: ['aufmass-zeilen', fotoId] })
    onAenderung?.()
  }

  const offene = zeilen.filter((z) => z.status === 'offen')

  async function uebernehmen(auswahl) {
    setLaeuft(true); setFehler(null)
    try {
      await uebernimmZeilen(nachkalkulationId, auswahl)
      await fotoStatusNachziehen(fotoId)
      neu()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaeuft(false)
    }
  }

  if (isLoading) return <Flex justify="center" p={3}><Spinner size="sm" /></Flex>
  if (!zeilen.length) return <Text fontSize="sm" color="fg.muted" mt={2}>Keine Zeile gelesen.</Text>

  return (
    <Box mt={3}>
      <Flex mb={2} gap={2} align="center" flexWrap="wrap">
        <Text fontSize="xs" color="fg.muted">
          {offene.length} offen · {zeilen.length - offene.length} erledigt
        </Text>
        <Spacer />
        {offene.length > 0 && (
          <Button size="xs" colorPalette="blue" loading={laeuft} onClick={() => uebernehmen(offene)}>
            <Check size={12} /> Alle {offene.length} übernehmen
          </Button>
        )}
      </Flex>

      {fehler && <Text fontSize="sm" color="red.600" mb={2}>{fehler}</Text>}

      <Box overflowX="auto" bg="white" borderWidth="1px" borderRadius="md">
        <Table.Root variant="line" size="sm" minW="720px">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Vom Zettel</Table.ColumnHeader>
              <Table.ColumnHeader>Artikel im Shop</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Menge</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Aktion</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {zeilen.map((z) => (
              <Zeile key={z.id} z={z} artikelListe={artikelListe}
                kategorien={kategorien} lieferanten={lieferanten}
                onUebernehmen={() => uebernehmen([z])} onAenderung={neu} />
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  )
}

function Zeile({ z, artikelListe, kategorien, lieferanten, onUebernehmen, onAenderung }) {
  const [menge, setMenge] = useState(z.roh_menge ?? '')
  const [suchtImShop, setSuchtImShop] = useState(false)
  const erledigt = z.status !== 'offen'
  const unsicher = z.sicherheit != null && Number(z.sicherheit) < 0.8

  async function mengeSpeichern() {
    const m = Number(String(menge).replace(',', '.'))
    if (!(m > 0) || m === Number(z.roh_menge)) return
    await setZeileMenge(z.id, m)
    onAenderung()
  }

  async function artikelSetzen(id) {
    await setZeileArtikel(z.id, id || null)
    onAenderung()
  }

  return (
    <Table.Row opacity={erledigt ? 0.5 : 1}>
      <Table.Cell>
        <Text fontSize="sm">{z.roh_bezeichnung || '—'}</Text>
        <HStack gap={2}>
          {z.roh_artikelnr && <Text fontSize="xs" color="fg.muted">{z.roh_artikelnr}</Text>}
          {unsicher && (
            <Badge size="sm" colorPalette="orange" variant="subtle">
              unsicher gelesen
            </Badge>
          )}
          {z.notiz && <Text fontSize="xs" color="orange.600">{z.notiz}</Text>}
        </HStack>
      </Table.Cell>
      <Table.Cell>
        {erledigt ? (
          <Text fontSize="sm">{z.artikel?.name || <Text as="span" color="fg.muted">als Freitext</Text>}</Text>
        ) : (
          <VStack align="stretch" gap={1}>
            <select
              value={z.artikel_id || ''}
              onChange={(e) => artikelSetzen(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, maxWidth: 280 }}
            >
              <option value="">— kein Artikel, als Freitext —</option>
              {artikelListe.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {!z.artikel_id && (
              <VStack align="start" gap={0.5}>
                <Text fontSize="10px" color="purple.600">
                  fehlt im Katalog — gehört in den Artikelstamm der Aufmaß-App
                </Text>
                <Button size="xs" variant="outline" onClick={() => setSuchtImShop(true)}>
                  <Search size={11} /> Im Lieferantenshop suchen
                </Button>
              </VStack>
            )}
            {z.treffer_art === 'name' && z.artikel_id && (
              <Text fontSize="10px" color="fg.muted">über den Namen gefunden, bitte prüfen</Text>
            )}
          </VStack>
        )}
      </Table.Cell>
      <Table.Cell textAlign="right">
        {erledigt ? (
          <Text fontSize="sm">{Number(z.roh_menge).toLocaleString('de-DE')} {z.roh_einheit || ''}</Text>
        ) : (
          <HStack justify="flex-end" gap={1}>
            <Input size="xs" maxW="70px" textAlign="right" value={menge}
              onChange={(e) => setMenge(e.target.value)}
              onBlur={mengeSpeichern}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            <Text fontSize="xs" color="fg.muted">{z.roh_einheit || ''}</Text>
          </HStack>
        )}
      </Table.Cell>
      <Table.Cell textAlign="right">
        {erledigt ? (
          <Badge size="sm" colorPalette={z.status === 'uebernommen' ? 'green' : 'gray'} variant="subtle">
            {z.status === 'uebernommen' ? 'übernommen' : 'verworfen'}
          </Badge>
        ) : (
          <HStack justify="flex-end" gap={1}>
            <IconButton size="xs" variant="ghost" colorPalette="green" aria-label="Übernehmen"
              onClick={onUebernehmen}>
              <Check size={13} />
            </IconButton>
            <IconButton size="xs" variant="ghost" aria-label="Verwerfen"
              onClick={async () => { await verwirfZeile(z.id); onAenderung() }}>
              <X size={13} />
            </IconButton>
          </HStack>
        )}
      </Table.Cell>
      {/* Der Suchdialog braucht die ganze Breite und wuerde in einer Zelle
          zerdrueckt. Chakra erlaubt kein zweites tr aus derselben Komponente,
          deshalb liegt er als aufgespannte Zelle unter der Zeile. */}
      {suchtImShop && (
        <Table.Cell colSpan={4} p={0} borderBottomWidth="0">
          <LieferantSucheDialog
            zeile={z}
            kategorien={kategorien}
            lieferanten={lieferanten}
            onAbbrechen={() => setSuchtImShop(false)}
            onFertig={async (artikel) => {
              await setZeileArtikel(z.id, artikel.id)
              setSuchtImShop(false)
              onAenderung()
            }}
          />
        </Table.Cell>
      )}
    </Table.Row>
  )
}
