// Nachkalkulationsbericht: Angebot gegen Ist, mit Befunden.
//
// Was hier steht, hat jemand sonst von Hand aus vier Quellen zusammengetragen -
// Auftragspositionen, Wareneingänge, Aufmaß, Stundenzettel. Die Rechnung ist
// mechanisch und gehört deshalb in die App.
//
// Die Befunde sind es nicht: sie sind Regeln, die auf etwas zeigen, nicht
// Urteile. Jeder nennt deshalb, woran er hängt, und keiner sagt "Fehler" -
// eine Abweichung zwischen Beleg und Kalkulation kann eine Teillieferung sein
// oder ein Schnäppchen, und das weiß nur, wer den Beleg öffnet.

import React, { useMemo } from 'react'
import {
  Box, Text, HStack, VStack, Badge, Flex, Spacer, Table, Heading,
} from '@chakra-ui/react'
import { AlertTriangle, Info, TrendingUp } from 'lucide-react'

function euro(n) {
  if (n == null) return '—'
  return `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}
function zahl(n, stellen = 1) {
  if (n == null) return '—'
  return Number(n).toLocaleString('de-DE', { maximumFractionDigits: stellen })
}

// Der Einkaufspreis der Arbeitsstunde. Entspricht dem EK des Katalogartikels
// ARB-REG; die Verrechnungssätze 75 und 69 sind der Verkauf, nicht die Kosten.
const LOHN_EK_JE_STUNDE = 45

export default function NachkalkulationBericht({ nk }) {
  const r = useMemo(() => rechne(nk), [nk])

  return (
    <Box borderWidth="1px" borderRadius="lg" bg="white" p={{ base: 3, md: 5 }} mb={4}>
      <Flex align="baseline" gap={2} mb={1} flexWrap="wrap">
        <Heading size="md">Nachkalkulation</Heading>
        <Spacer />
        <Text fontSize="xs" color="fg.muted">
          Auftrag {nk.pds_vorgangs_nummer} · {nk.kalkulationsart?.replace(/_/g, ' ')}
        </Text>
      </Flex>
      <Text fontSize="sm" color="fg.muted" mb={4}>{nk.bezeichnung}</Text>

      {/* ─── Deckung ─────────────────────────────────────────────────── */}
      <Box borderWidth="1px" borderRadius="md" overflowX="auto" mb={4}>
        <Table.Root variant="line" size="sm" minW="420px">
          <Table.Body>
            <Zeile text="Erlös laut Angebot" wert={r.erloes} />
            <Zeile text="− Geräteeinkauf (belegt, sonst kalkuliert)" wert={-r.geraeteEk}
              hinweis={r.geraeteQuelle} />
            <Zeile text="− Material laut Aufmaß" wert={-r.materialEk} />
            <Zeile text={`− Lohn, ${zahl(r.stunden)} h zu ${euro(LOHN_EK_JE_STUNDE)}`} wert={-r.lohnEk} />
            {r.nebenkostenEk > 0 && (
              <Zeile text="− Anfahrt und Pauschalen" wert={-r.nebenkostenEk} />
            )}
          </Table.Body>
          <Table.Footer>
            <Table.Row>
              <Table.Cell fontWeight="bold">Bleibt für Gemeinkosten und Gewinn</Table.Cell>
              <Table.Cell textAlign="right" fontWeight="bold"
                color={r.deckung < 0 ? 'red.600' : 'green.700'}>
                {euro(r.deckung)}
              </Table.Cell>
            </Table.Row>
          </Table.Footer>
        </Table.Root>
      </Box>

      <HStack gap={6} flexWrap="wrap" mb={4}>
        <Kennzahl titel="Deckungsquote" wert={r.erloes > 0 ? `${zahl(r.deckung / r.erloes * 100)} %` : '—'} />
        {r.stunden > 0 && (
          <Kennzahl titel="Erreicht je Stunde" wert={`${euro(r.deckung / r.stunden)}`}
            farbe={r.deckung / r.stunden < 69 ? 'red.600' : 'green.700'} />
        )}
        <Kennzahl titel="Materialeinsatz" wert={euro(r.materialEk)} />
        <Kennzahl titel="Stunden" wert={`${zahl(r.stunden)} h`} />
      </HStack>

      {/* ─── Befunde ─────────────────────────────────────────────────── */}
      <Text fontWeight="bold" fontSize="sm" mb={2}>Befunde</Text>
      {r.befunde.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          Nichts aufgefallen. Das heißt nicht, dass alles stimmt — es heißt, dass die
          geprüften Muster hier nicht zutreffen.
        </Text>
      ) : (
        <VStack align="stretch" gap={2}>
          {r.befunde.map((b, i) => <Befund key={i} {...b} />)}
        </VStack>
      )}

      <Text fontSize="xs" color="fg.muted" mt={4} pt={3} borderTopWidth="1px">
        Arbeitszeit mit {euro(LOHN_EK_JE_STUNDE)} je Stunde als Kosten bewertet (Einkaufspreis
        ARB-REG). Die Verrechnungssätze {euro(nk.stundensatz_techniker ?? 75)} und{' '}
        {euro(nk.stundensatz_monteur ?? 69)} sind der Verkauf und stehen hier bewusst nicht.
      </Text>
    </Box>
  )
}

function Zeile({ text, wert, hinweis }) {
  return (
    <Table.Row>
      <Table.Cell>
        <Text fontSize="sm">{text}</Text>
        {hinweis && <Text fontSize="10px" color="fg.muted">{hinweis}</Text>}
      </Table.Cell>
      <Table.Cell textAlign="right">
        <Text fontSize="sm" fontFamily="mono">{euro(Math.abs(wert))}</Text>
      </Table.Cell>
    </Table.Row>
  )
}

function Kennzahl({ titel, wert, farbe }) {
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted">{titel}</Text>
      <Text fontSize="lg" fontWeight="bold" color={farbe}>{wert}</Text>
    </Box>
  )
}

function Befund({ art, titel, text }) {
  const farbe = art === 'ernst' ? 'red' : art === 'hinweis' ? 'blue' : 'orange'
  const Symbol = art === 'hinweis' ? Info : art === 'gut' ? TrendingUp : AlertTriangle
  return (
    <Box borderLeftWidth="3px" borderLeftColor={`${farbe}.400`} bg={`${farbe}.50`} p={3} borderRadius="sm">
      <HStack gap={2} align="start">
        <Box pt="2px"><Symbol size={14} /></Box>
        <Box>
          <Text fontSize="sm" fontWeight="medium">{titel}</Text>
          <Text fontSize="sm" color="fg.muted">{text}</Text>
        </Box>
      </HStack>
    </Box>
  )
}

// ─── Die Rechnung ────────────────────────────────────────────────────

function rechne(nk) {
  const z = (v) => Number(v ?? 0)
  const pos = nk.soll_positionen || {}
  const geraete = pos.geraete || []
  const leistungen = pos.leistungen || []
  const montage = pos.montage || []

  const erloes = z(nk.soll_vk_gesamt)

  // Belegter Einkauf schlägt den kalkulierten: der Wareneingang sagt, was das
  // Gerät gekostet hat, der Auftrag nur, was man dachte.
  const belegt = geraete.filter((g) => g.ek_belegt != null)
  const geraeteEk = belegt.length
    ? geraete.reduce((s, g) => s + z(g.ek_belegt ?? g.ek_gesamt), 0)
    : z(nk.soll_ek_geraete)
  const geraeteQuelle = belegt.length
    ? `${belegt.length} von ${geraete.length} Positionen durch Wareneingang belegt`
    : 'keine Position belegt — Werte aus dem Auftrag'

  const materialEk = z(nk.ist_material)
  const stunden = z(nk.ist_stunden_techniker) + z(nk.ist_stunden_monteur)
  const lohnEk = stunden * LOHN_EK_JE_STUNDE

  // Anfahrt und Pauschalen sind Kosten, solange sie nicht im Angebot stehen.
  const pauschalen = Array.isArray(nk.pauschalen) ? nk.pauschalen : []
  const nebenkostenEk = z(nk.anfahrt_fahrten) * z(nk.anfahrt_satz)
    + pauschalen.reduce((s, p) => s + z(p.betrag), 0)
    + (nk.geruest ? z(nk.geruest_betrag) : 0)

  const deckung = erloes - geraeteEk - materialEk - lohnEk - nebenkostenEk

  // ─── Befunde ───────────────────────────────────────────────────────
  const befunde = []

  // 1. Positionen, deren Beleg von der Kalkulation abweicht.
  for (const g of geraete) {
    const ab = z(g.abweichung)
    if (g.ek_belegt != null && Math.abs(ab) >= 50) {
      befunde.push({
        art: ab > 0 ? 'ernst' : 'warnung',
        titel: `${g.kurztext}: ${ab > 0 ? 'teurer' : 'günstiger'} als kalkuliert, ${euro(Math.abs(ab))}`,
        text: ab > 0
          ? `Kalkuliert ${euro(g.ek_gesamt)}, belegt ${euro(g.ek_belegt)} laut ${g.ek_quelle} ${g.ek_beleg ?? ''}. Der Auftrag führt weiterhin den kalkulierten Preis — in PDS fällt das nicht auf.`
          : `Kalkuliert ${euro(g.ek_gesamt)} für ${zahl(g.menge, 2)} Stück, belegt sind ${euro(g.ek_belegt)}. Das kann eine Teillieferung sein oder ein günstigerer Einkauf; der Beleg ${g.ek_beleg ?? ''} sagt, welches von beidem.`,
      })
    }
  }

  // 2. Geräte ohne jeden Beleg.
  const ohneBeleg = geraete.filter((g) => g.ek_belegt == null)
  if (ohneBeleg.length) {
    const summe = ohneBeleg.reduce((s, g) => s + z(g.ek_gesamt), 0)
    befunde.push({
      art: 'warnung',
      titel: `${ohneBeleg.length} Position(en) ohne Beleg, ${euro(summe)} kalkulierter Einkauf`,
      text: `${ohneBeleg.map((g) => g.kurztext).join(', ')}. Entweder Lagerware oder ohne Projektaktenbezug bestellt. Der wahre Einsatz kann nur höher liegen, nie niedriger.`,
    })
  }

  // 3. Erlös ohne Kostenseite: Leistungen mit EK = VK. Das ist in PDS der
  //    Normalzustand ohne Kalkulationsgruppe und sagt nichts über die Kosten.
  const ohneSpanne = [...leistungen, ...montage]
    .filter((p) => z(p.vk_gesamt) > 0 && Math.abs(z(p.ek_gesamt) - z(p.vk_gesamt)) < 0.01)
  if (ohneSpanne.length) {
    const summe = ohneSpanne.reduce((s, p) => s + z(p.vk_gesamt), 0)
    befunde.push({
      art: 'hinweis',
      titel: `${ohneSpanne.length} Position(en) mit Einkauf gleich Verkauf, ${euro(summe)}`,
      text: `${ohneSpanne.slice(0, 4).map((p) => p.kurztext).join(', ')}${ohneSpanne.length > 4 ? ' und weitere' : ''}. Dort ist kein Aufschlag hinterlegt, also steht dem Erlös keine bezifferte Kostenseite gegenüber. Was davon tatsächlich Kosten verursacht hat, zeigt erst die Erfassung.`,
    })
  }

  // 4. Material, das im Angebot steht, aber im Aufmaß fehlt. Grob über
  //    Stichworte - das ist ein Zeigefinger, keine Zuordnung.
  const erfasst = (nk.positionen || [])
    .map((p) => (p.artikel?.name || p.freitext || '').toLowerCase())
    .join(' ')
  const materialWorte = [
    ['kältemittel', 'Kältemittelleitung'],
    ['kabelkanal', 'Kabelkanal'],
    ['kondensat', 'Kondensatleitung'],
    ['konsole', 'Konsolen'],
  ]
  const fehlend = [...leistungen, ...montage].filter((p) => {
    const t = (p.kurztext || '').toLowerCase()
    const treffer = materialWorte.find(([wort]) => t.includes(wort))
    return treffer && !erfasst.includes(treffer[0])
  })
  for (const p of fehlend) {
    befunde.push({
      art: 'warnung',
      titel: `${p.kurztext} steht im Angebot, aber nicht im Aufmaß`,
      text: `${euro(p.vk_gesamt)} Erlös für ${zahl(p.menge, 2)} ${p.einheit || 'Einheiten'}, und unter den erfassten Positionen findet sich dazu nichts. Entweder fehlt ein Blatt, oder das Material lief separat.`,
    })
  }

  // 5. Anfahrt und Pauschalen ohne Gegenstück im Angebot.
  const alleTexte = [...leistungen, ...montage, ...geraete]
    .map((p) => (p.kurztext || '').toLowerCase()).join(' ')
  if (z(nk.anfahrt_fahrten) > 0 && !/anfahrt|fahrt|wegezeit/.test(alleTexte)) {
    befunde.push({
      art: 'hinweis',
      titel: `Anfahrt ${euro(z(nk.anfahrt_fahrten) * z(nk.anfahrt_satz))} ist im Angebot nicht vorgesehen`,
      text: `${nk.anfahrt_fahrten} Fahrten in Zone ${nk.anfahrt_zone}. Keine Angebotsposition deckt sie ab — nachfordern lässt sich das nicht, aber ins nächste Angebot gehört es.`,
    })
  }
  if (pauschalen.length && !/pauschale|einsatz|werkzeug|kleinmaterial/.test(alleTexte)) {
    const summe = pauschalen.reduce((s, p) => s + z(p.betrag), 0)
    befunde.push({
      art: 'hinweis',
      titel: `Pauschalen ${euro(summe)} sind im Angebot nicht vorgesehen`,
      text: `${pauschalen.map((p) => p.schluessel).join(', ')}. Dieselbe Lage wie bei der Anfahrt: getragen, aber nie angeboten.`,
    })
  }

  // 6. Keine Stunden erfasst - dann ist die ganze Rechnung unvollständig.
  if (stunden === 0) {
    befunde.push({
      art: 'ernst',
      titel: 'Keine Stunden erfasst',
      text: 'Ohne Arbeitszeit fehlt der größte Kostenblock. Die Deckung unten ist damit zu gut und taugt nicht zum Vergleich mit anderen Aufträgen.',
    })
  } else if (nk.stunden_quelle === 'schaetzung') {
    befunde.push({
      art: 'hinweis',
      titel: 'Die Stunden sind geschätzt',
      text: 'Sie lesen sich in jeder Auswertung wie gemessene Zahlen. Für den Rücklauf in die Angebotskalkulation taugen sie nur eingeschränkt.',
    })
  }

  return {
    erloes, geraeteEk, geraeteQuelle, materialEk, stunden, lohnEk, nebenkostenEk,
    deckung, befunde,
  }
}
