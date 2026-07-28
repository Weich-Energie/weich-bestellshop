# ADR 0003 — KI-Architektur

**Datum:** 2026-07-27
**Status:** akzeptiert

## Kontext

Der Shop hat KI-Bedarf an mehreren Stellen:

- Artikel-Anlage: Kategorie, Tags, Kurzbeschreibung, Bild-Suche, Lieferanten-Link
- Bedarfsmeldung → Artikel-Kandidat: Foto + Text zu strukturiertem Artikel (Vision)
- Beleg-Import: Rechnung → Positionen (Vision + Struktur-Extraktion)
- Bestellassistent: Duplikat-Erkennung, "wird oft zusammen bestellt"
- Browser-Bestell-Automation (v1.x): Agent mit Tool-Use

Bestehendes: `ai-chat` (Haiku) und `ai-analyze` (Sonnet) als Supabase Edge Functions
im geteilten Projekt — nutzen den gleichen Anthropic-Key.

## Entscheidung

**Neue Edge Function `shop-ai`** mit taskbasiertem Modell-Routing:

- **Vision-Tasks** (Foto → Artikel, Rechnung → Positionen): Sonnet 4.6
- **Text-Tasks** (Kategorie, Tag, Beschreibung, Bestellassistent): Haiku 4.5
- **Browser-Agent** (spaeter): Sonnet 4.6 mit Tool-Use

Die Function bekommt einen `task`-Discriminator im Payload und routet intern.

## Konsequenzen

**Positiv:**
- Eigene System-Prompts, eigenes Logging, keine Feature-Kollisionen mit den
  anderen KI-Funktionen
- Modell-Auswahl kostenoptimiert pro Task
- Anthropic-Key bleibt beim etablierten Vault (nur ein Ort)
- Klare Trennung fuer spaeteres A/B-Testing von Prompts

**Negativ:**
- Dritter Edge-Function-Deploy zu verwalten
- Codeduplikation mit `ai-analyze` bei generischen Utilities (kann spaeter als
  shared library extrahiert werden)

**Verworfene Alternativen:**
- **Bestehende Functions mitverwenden**: Vermischung von Prompts und Logs, schwerer
  zu tunen, riskant beim Update einer App.
- **Client-side KI-Calls (Browser mit API-Key)**: Sicherheitsproblem (Key waere im
  Browser exponiert).
