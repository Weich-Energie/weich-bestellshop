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
- **Kein Auto-Deploy** (nachgeprueft 19.08.2026: nur CLI-Deployments in `vercel ls`,
  ein `git push` loeste nichts aus)
- Nach Aenderungen: `npx vite build` (Check), commit, push, dann **manuell**
  `npx vercel --prod --yes --scope patrick-weichs-projects`
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

## Domain-Doku
- [CONTEXT.md](CONTEXT.md) — Domain-Glossar
- [ROADMAP.md](ROADMAP.md) — Phasen 0-9
- [docs/adr/](docs/adr/) — Architektur-Entscheidungen

## Doku-Regel
Wenn sich eine Kern-Entscheidung aendert: ADR schreiben, CLAUDE.md updaten, CONTEXT.md pflegen.
