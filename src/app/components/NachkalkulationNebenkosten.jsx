// Anfahrt, Pauschalen und Gerüst eines Auftrags.
//
// Das sind die Kosten, die bei jedem Auftrag anfallen und auf keinem Zettel
// stehen. Sätze und Aufteilung kommen aus dem Klimarechner, damit Vor- und
// Nachkalkulation dieselbe Sprache sprechen.
//
// Zwei Dinge sind hier bewusst Fragen statt Automatik:
//
//  - Die Zahl der Fahrten wird aus den Daten auf den Blättern vorgeschlagen,
//    nicht gesetzt. Der Vorschlag kann nur zu niedrig sein — ein Tag ohne
//    Zettel hinterlässt keine Spur.
//  - Ob ein Gerüst stand, weiß kein Beleg. Das weiß nur, wer dabei war.

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Text, HStack, VStack, Button, Input, Badge, Flex, Spacer, Spinner,
} from '@chakra-ui/react'
import { Truck, Save, MapPin } from 'lucide-react'
import {
  setNebenkosten, fahrtenVorschlag, ANFAHRT_ZONEN, PAUSCHALEN,
} from '../../data/api/nachkalkulation.js'

const SELECT_STIL = { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white' }

function euro(n) {
  if (n == null) return '—'
  return `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

// Firmenstandort Amberg, Fuggerstraße 23 — derselbe Bezugspunkt wie im
// Klimarechner, sonst kämen zwei verschiedene Zonen für dieselbe Baustelle.
const BASIS = { lat: 49.4444574, lng: 11.8265056 }

async function zoneAusAdresse(adresse) {
  const q = String(adresse || '').trim()
  if (!q) return null
  try {
    const geo = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(q)}`,
      { headers: { accept: 'application/json' } },
    )
    if (!geo.ok) return null
    const treffer = await geo.json()
    if (!treffer.length) return null
    const ziel = { lat: Number(treffer[0].lat), lng: Number(treffer[0].lon) }

    const route = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${BASIS.lng},${BASIS.lat};${ziel.lng},${ziel.lat}?overview=false`,
    )
    if (!route.ok) return null
    const daten = await route.json()
    const sek = daten.routes?.[0]?.duration
    if (sek == null) return null
    const minuten = Math.round(sek / 60)

    // Erste Zone, deren Obergrenze die Fahrzeit noch fasst. Über 60 Minuten
    // bleibt es bei Z4 — darüber hinaus gibt es im Modell nichts.
    const grenzen = [[15, 'Z1'], [30, 'Z2'], [45, 'Z3'], [60, 'Z4']]
    const treffer2 = grenzen.find(([g]) => minuten <= g)
    return { minuten, zone: treffer2 ? treffer2[1] : 'Z4' }
  } catch {
    return null
  }
}

export default function NachkalkulationNebenkosten({ nk, onAenderung }) {
  const [adresse, setAdresse] = useState(nk.baustelle_adresse ?? '')
  const [zone, setZone] = useState(nk.anfahrt_zone ?? '')
  const [fahrten, setFahrten] = useState(nk.anfahrt_fahrten ?? '')
  const [satz, setSatz] = useState(nk.anfahrt_satz ?? '')
  const [gewaehlt, setGewaehlt] = useState(() => {
    const vorhanden = Array.isArray(nk.pauschalen) ? nk.pauschalen : null
    if (!vorhanden) return null // noch nicht entschieden
    return new Set(vorhanden.map((p) => p.schluessel))
  })
  const [geruest, setGeruest] = useState(!!nk.geruest)
  const [geruestBetrag, setGeruestBetrag] = useState(nk.geruest_betrag ?? '')
  const [speichert, setSpeichert] = useState(false)
  const [ermittelt, setErmittelt] = useState(false)
  const [fehler, setFehler] = useState(null)
  const [fahrzeit, setFahrzeit] = useState(null)

  const { data: vorschlag } = useQuery({
    queryKey: ['fahrten-vorschlag', nk.id],
    queryFn: () => fahrtenVorschlag(nk.id),
  })

  useEffect(() => {
    setAdresse(nk.baustelle_adresse ?? '')
    setZone(nk.anfahrt_zone ?? '')
    setFahrten(nk.anfahrt_fahrten ?? '')
    setSatz(nk.anfahrt_satz ?? '')
    setGeruest(!!nk.geruest)
    setGeruestBetrag(nk.geruest_betrag ?? '')
    const vorhanden = Array.isArray(nk.pauschalen) ? nk.pauschalen : null
    setGewaehlt(vorhanden ? new Set(vorhanden.map((p) => p.schluessel)) : null)
  }, [nk.id, nk.updated_at])

  // Die Zonenwahl zieht den Satz nach, solange er nicht von Hand abweicht.
  function zoneWaehlen(z) {
    setZone(z)
    const treffer = ANFAHRT_ZONEN.find((x) => x.zone === z)
    if (treffer) setSatz(treffer.satz)
  }

  async function ermitteln() {
    setErmittelt(true); setFehler(null); setFahrzeit(null)
    const erg = await zoneAusAdresse(adresse)
    setErmittelt(false)
    if (!erg) {
      setFehler('Die Adresse ließ sich nicht einordnen — Zone bitte von Hand wählen.')
      return
    }
    setFahrzeit(erg.minuten)
    zoneWaehlen(erg.zone)
  }

  async function speichern() {
    setSpeichert(true); setFehler(null)
    try {
      await setNebenkosten(nk.id, {
        adresse,
        zone: zone || null,
        fahrten,
        satz,
        pauschalen: gewaehlt
          ? PAUSCHALEN.filter((p) => gewaehlt.has(p.schluessel))
          : null,
        geruest,
        geruestBetrag: geruest ? geruestBetrag : null,
      })
      onAenderung?.()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setSpeichert(false)
    }
  }

  function umschalten(schluessel) {
    const neu = new Set(gewaehlt ?? [])
    if (neu.has(schluessel)) neu.delete(schluessel)
    else neu.add(schluessel)
    setGewaehlt(neu)
  }

  const anfahrtGesamt = Number(fahrten || 0) * Number(satz || 0)
  const pauschalenGesamt = PAUSCHALEN
    .filter((p) => gewaehlt?.has(p.schluessel))
    .reduce((s, p) => s + p.betrag, 0)
  const gesamt = anfahrtGesamt + pauschalenGesamt + (geruest ? Number(geruestBetrag || 0) : 0)
  const schonUebertragen = Boolean(nk.nebenkosten_transport_at)

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} mb={4} bg="white">
      <Flex align="center" gap={2} mb={3} flexWrap="wrap">
        <Truck size={15} />
        <Text fontWeight="bold" fontSize="sm">Anfahrt, Pauschalen und Gerüst</Text>
        {schonUebertragen && (
          <Badge size="sm" colorPalette="green" variant="subtle">steht schon im Auftrag</Badge>
        )}
        <Spacer />
        <Button size="xs" colorPalette="blue" onClick={speichern} loading={speichert}>
          <Save size={12} /> Speichern
        </Button>
      </Flex>

      <VStack align="stretch" gap={3}>
        {/* Anfahrt */}
        <Box>
          <Text fontSize="xs" color="fg.muted" mb={1}>Baustelle</Text>
          <HStack gap={2} flexWrap="wrap">
            <Input size="sm" maxW="320px" value={adresse} placeholder="Straße, PLZ Ort"
              onChange={(e) => setAdresse(e.target.value)} />
            <Button size="sm" variant="outline" onClick={ermitteln} loading={ermittelt}
              loadingText="rechnet…" disabled={!adresse.trim()}>
              <MapPin size={13} /> Zone ermitteln
            </Button>
            {fahrzeit != null && (
              <Text fontSize="xs" color="fg.muted">{fahrzeit} min ab Amberg</Text>
            )}
          </HStack>
        </Box>

        <HStack gap={4} flexWrap="wrap" align="end">
          <Box>
            <Text fontSize="xs" color="fg.muted">Zone</Text>
            <select value={zone} onChange={(e) => zoneWaehlen(e.target.value)} style={SELECT_STIL}>
              <option value="">— offen —</option>
              {ANFAHRT_ZONEN.map((z) => (
                <option key={z.zone} value={z.zone}>{z.zone} · {z.fahrzeit} · {z.satz} €</option>
              ))}
            </select>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted">Fahrten</Text>
            <Input size="sm" maxW="90px" value={fahrten} placeholder="0"
              onChange={(e) => setFahrten(e.target.value)} />
            {vorschlag?.anzahl > 0 && (
              <Text fontSize="10px" color="blue.600" cursor="pointer"
                onClick={() => setFahrten(vorschlag.anzahl)}>
                {vorschlag.anzahl} Tag(e) auf den Zetteln — übernehmen
              </Text>
            )}
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted">Satz je Fahrt</Text>
            <Input size="sm" maxW="100px" value={satz} onChange={(e) => setSatz(e.target.value)} />
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted">Anfahrt gesamt</Text>
            <Text fontSize="md" fontWeight="bold">{euro(anfahrtGesamt)}</Text>
          </Box>
        </HStack>

        {vorschlag?.anzahl === 0 && vorschlag?.blaetter > 0 && (
          <Text fontSize="xs" color="orange.600">
            Auf den {vorschlag.blaetter} Blättern steht kein Datum — die Zahl der Fahrten
            lässt sich daraus nicht ableiten.
          </Text>
        )}

        {/* Pauschalen */}
        <Box pt={2} borderTopWidth="1px">
          <Text fontSize="xs" color="fg.muted" mb={1}>
            Pauschalen, je einmal pro Auftrag
          </Text>
          {gewaehlt === null && (
            <Text fontSize="xs" color="orange.600" mb={1}>
              Noch nicht entschieden. Ohne Auswahl fehlen diese Kosten im Auftrag —
              „keine" ist auch eine Entscheidung, aber eine bewusste.
            </Text>
          )}
          <VStack align="stretch" gap={1}>
            {PAUSCHALEN.map((p) => (
              <HStack key={p.schluessel} gap={2}>
                <input type="checkbox" checked={!!gewaehlt?.has(p.schluessel)}
                  onChange={() => umschalten(p.schluessel)} />
                <Text fontSize="sm" flex="1">{p.text}</Text>
                <Text fontSize="sm" fontWeight="medium">{euro(p.betrag)}</Text>
              </HStack>
            ))}
          </VStack>
        </Box>

        {/* Gerüst */}
        <Box pt={2} borderTopWidth="1px">
          <HStack gap={2} flexWrap="wrap">
            <input type="checkbox" checked={geruest} onChange={(e) => setGeruest(e.target.checked)} />
            <Text fontSize="sm">Gerüst wurde gestellt</Text>
            {geruest && (
              <>
                <Input size="sm" maxW="110px" value={geruestBetrag} placeholder="Betrag"
                  onChange={(e) => setGeruestBetrag(e.target.value)} />
                <Text fontSize="xs" color="fg.muted">€ netto</Text>
              </>
            )}
          </HStack>
          <Text fontSize="10px" color="fg.muted" mt={1}>
            Steht auf keinem Beleg — das weiß nur, wer dabei war.
          </Text>
        </Box>

        <HStack pt={2} borderTopWidth="1px">
          <Text fontSize="sm" color="fg.muted">Zusammen</Text>
          <Spacer />
          <Text fontSize="lg" fontWeight="bold">{euro(gesamt)}</Text>
        </HStack>

        {fehler && <Text fontSize="sm" color="red.600">{fehler}</Text>}
      </VStack>
    </Box>
  )
}
