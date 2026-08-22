# Bestellshop — WEICHENERGIE (Weich GmbH)

## Projekt
Interner Bestellshop fuer Verbrauchsmaterial (C-Teile). Monteure/Arbeiter melden Bedarf,
Admins pflegen Katalog, geben Bestellungen frei, KI unterstuetzt bei Anlage und
Bestell-Abwicklung. Vierte App im WEICHENERGIE-App-Oekosystem — shared Supabase mit
Ressourcenplanung, Service-Ticket und Betriebsradar.

## Tech Stack
- React 19 + Vite 8 + Chakra UI v3 (NICHT v2!)
- Supabase (PostgreSQL, RLS, Edge Functions) — shared Instanz
- @tanstack/react-query, react-router-dom v7, lucide-react
- Hosting: Vercel (Auto-Deploy von master)
- Browser-Bestell-Bot (Phase 7+): Node + Playwright auf Hostinger `weich-code`

## Supabase
- Project Ref: mvrbbzqfsphsmkgutegx
- URL: https://mvrbbzqfsphsmkgutegx.supabase.co
- Auth: Email + Passwort (Supabase Auth) — kein PIN im Shop
- App-Access-Check: `employees.berechtigungen.app_access.bestellshop === true`
  (fail-closed) — Pattern uebernommen aus Ressourcenplanung Phase 11/AAC-04
- Shop-Admin-Flag: `berechtigungen.app_access.bestellshop_admin === true` ODER
  `berechtigungen.rolle === 'admin'`

## Deploy
- **Auto-Deploy ist aktiv** (Stand 21.08.2026). Das Vercel-Projekt ist mit
  `pawe1307/weich-bestellshop` verbunden; ein Push nach `master` loest ein
  Production-Deployment aus. Die aeltere Notiz „kein Auto-Deploy" vom 19.08.
  ist ueberholt.
- Ablauf: `npx vite build` (Check), commit, `git push` — ab da ist es live.
- **Unfertiges gehoert auf einen Branch**, nicht auf `master`. Branch-Pushes
  erzeugen Vorschau-Deployments und lassen die Produktion unberuehrt.
- `npx vercel --prod` geht weiterhin, deployt aber den **lokalen Ordner** statt
  des Repos — im August hat das bei der Service-Ticket-App vier Monate Arbeit
  aus der Produktion entfernt. Im Zweifel nicht verwenden.
- Das Projekt zieht ins Vercel-Team `weich-team` um; danach gilt fuer die CLI
  `--scope weich-team`.
- `.env` wird via Vercel-Env-Vars gepflegt, `.env.example` im Repo

## Cross-App-Integration
- `employees`-Tabelle ist Single Source of Truth (shared mit den anderen drei Apps)
- SELECT auf employees: explizite Spaltenliste (kein SELECT * wegen Column REVOKE)
- `berechtigungen`-JSON steuert App-Zugriffe und Rollen fuer alle vier Apps
- Realtime-Sync fuer Bestellwuensche & Sammelbestellungen: kommt in Phase 4

## Wichtige Regeln
- Immer auf Deutsch (UI, Kommentare, KI-Output)
- Chakra v3 Syntax: `Dialog.Root`, `Tabs.Root`, `Select` mit `createListCollection`
- Fail-closed Auth-Check: KEIN `?? true` — nicht gesetzt = kein Zugriff
- User sieht KEINE Preise im Katalog (nur Admin sieht Preise) — bewusste Entscheidung
- Verbrauchsmaterial (C-Teile) — hochwertige B-Teile bleiben im ERP

## Architektur
- `src/main.jsx` — Root: Chakra + Router + Query + Auth + ErrorBoundary
- `src/App.jsx` — Routen: Public LoginPage + Protected Layout mit Nested Routes
- `src/app/contexts/AuthContext.jsx` — Supabase Auth + Access-Check
- `src/app/components/Layout.jsx` — Nav-Bar + Outlet
- `src/app/pages/` — Katalog, Warenkorb, Bestellungen, Bedarf, Favoriten + Admin-Pages
- `src/data/api/` — API-Layer pro Entitaet (kommt ab Phase 2)
- `supabase/migrations/` — SQL-Migrationen (kommt ab Phase 2)

## KI (spaeter)
Neue Edge Function `shop-ai` mit taskbasiertem Routing:
- Vision (Foto→Artikel, Beleg→Positionen): Sonnet 4.6
- Text (Kategorie/Tag/Beschreibung): Haiku 4.5
- Browser-Agent (Phase 7/8): Sonnet 4.6 mit Tool-Use

## PDS-Anbindung (Stand 22.08.2026, nicht in Betrieb)
- Der Shop ist **Anlage-Kanal fuer den PDS-Artikelstamm** — PDS bleibt
  Systemfuehrer. Siehe ADR 0005.
- Nicht ueber den MCP-Server, sondern direkt per Edge Function mit dem Key aus
  `integration_secrets` (Muster: `weich-energie-app/functions/pds-preise`).
- `pds-katalog-sync` schreibt: Whitelist auf vier Katalog-Pfade,
  Trockenlauf ist Standard, Protokoll in `shop_pds_sync_log`. Angelegt wird nur
  bei `pds_katalog_uuid is null` — `/katalog/delete` greift in PDS nur ohne
  Bestand und Verwendung, eine Dublette bleibt fuer immer stehen.
- `pds-auftrag-soll` liest Soll-Werte fuer die Nachkalkulation. In den
  Kundenauftrag wird nie geschrieben, dort steht eine Pauschale.
- Vorher von Hand in PDS anzulegen: fuenf `(KLIMA)`-Warengruppen und der
  Kategoriezweig — per API nicht moeglich. Siehe docs/pds-klima-warengruppen.md.

## Domain-Doku
- [CONTEXT.md](CONTEXT.md) — Domain-Glossar
- [ROADMAP.md](ROADMAP.md) — Phasen 0-9
- [docs/adr/](docs/adr/) — Architektur-Entscheidungen
- [docs/pds-inbetriebnahme.md](docs/pds-inbetriebnahme.md) — Reihenfolge der Inbetriebnahme
- [docs/pds-katalog-mapping.md](docs/pds-katalog-mapping.md) — Feld- und ID-Mapping Shop → PDS
- [docs/pds-klima-warengruppen.md](docs/pds-klima-warengruppen.md) — Klima-Warengruppen und Umzugsliste
- [docs/nachkalkulation-datenmodell.md](docs/nachkalkulation-datenmodell.md) — Soll/Ist-Modell

## Doku-Regel
Wenn sich eine Kern-Entscheidung aendert: ADR schreiben, CLAUDE.md updaten, CONTEXT.md pflegen.
