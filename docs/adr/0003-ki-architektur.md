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

**Neue Edge Function `shop-ai`** mit taskbasiertem Routing:

Anfangs (v1): Haiku fuer Text, Sonnet fuer Vision.

**Revidierte Modell-Politik (v2, 2026-07-28):** Sonnet 4.6 fuer beide Tasks.

Gruende fuer den Wechsel:
- User-Prioritaet: gute Ergebnisse wichtiger als absolute Performance.
- Konsistenz: einheitliches Modell reduziert Prompt-Design-Overhead und
  Verhaltens-Diffs.
- Kategorie/Tag-Qualitaet: Sonnet trifft bei fachlichen Nuancen (Solartechnik-
  Komponenten) spuerbar zuverlaessiger als Haiku.
- Kosten sind bei einem internen Shop (~500 Artikel-Anlagen pro Jahr) mit
  ~5€ Jahresbudget vernachlaessigbar.
- Latenz-Aufschlag (0.7s → 2s) bei manuellen "KI-Vorschlaege"-Klicks irrelevant.

Haiku bleibt reserviert fuer:
- Spaetere Live-Suggestion-Szenarien (Autocomplete beim Tippen).
- Klick-Entscheidungen im Browser-Bestell-Bot (Phase 7/8) — viele schnelle
  Tool-Use-Calls pro Bestellvorgang.
- Massen-Batches wenn Kosten spuerbar werden (> 1000 Aufrufe/Tag).

Opus 4.7: nur wenn Reasoning ueber viele Schritte noetig — fuer strukturierte
Extraktion overkill.

Die Function bekommt einen `task`-Discriminator im Payload und routet intern.

## Nachtrag 2026-08-23 — Zugriff: nur Shop-Admins

`shop-ai` hat bis hierhin nur geprueft, dass das JWT gueltig ist. Die Supabase-
Instanz ist aber mit Ressourcenplanung, Service-Ticket und Betriebsradar geteilt:
ein gueltiges Token sagt damit nur, dass jemand *irgendeine* der vier Apps
benutzt. Jeder Mitarbeiter mit Zugang zu einer beliebigen App konnte die Funktion
also aufrufen — und ueber `extract_shop_link` bzw. `analyze_bedarf_bild` eine
beliebige URL serverseitig abrufen lassen.

**Entscheidung:** Alle fuenf Tasks pruefen jetzt fail-closed auf Shop-Admin
(`app_access.bestellshop_admin === true` oder `rolle === 'admin'`), nach dem
Muster von `lieferant-zugang`. Das passt zur Nutzung: alle Tasks haengen an
Admin-Seiten (Katalog-Dialog, Beleg-Import, Bedarfsmeldungen). Sollte eine
KI-Funktion spaeter fuer normale Nutzer gebraucht werden — etwa Foto-Analyse
direkt in der Bedarfsmeldung — bekommt dieser Task einen eigenen, schwaecheren
Check auf `app_access.bestellshop` statt einer Aufweichung fuer alle.

Zusaetzlich pruefen die drei Tasks, die eine uebergebene URL laden, das Ziel
gegen Loopback-, private und Link-Local-Adressen (inklusive 169.254.169.254).
Das ist eine Huerde, keine Grenze: Umleitungen werden weiter gefolgt und nicht
erneut geprueft, und Namen, die erst per DNS intern zeigen, kann eine Edge
Function ohne eigenen Resolver nicht erkennen. Die eigentliche Tuer ist der
Admin-Check.

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
