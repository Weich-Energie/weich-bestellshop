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
- Vorschau-Deployments bauen mit `base: '/'` statt `/bestellshop/`
  (`vite.config.js` prueft `VERCEL_ENV`): dort laeuft die App auf ihrer eigenen
  Adresse und nicht unter der Dach-App. Damit die Vorschau nicht bloss eine weisse
  Seite zeigt, muessen die beiden `VITE_SUPABASE_*`-Variablen bei Vercel auch fuer
  die **Preview**-Umgebung freigegeben sein, nicht nur fuer Production.
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
- Der Katalog zeigt dem User keine Preise — bewusste UI-Entscheidung, damit nach
  Bedarf und nicht nach Preis bestellt wird. **Keine Vertraulichkeit:** Monteure
  duerfen die Preise kennen, und die Datenbank schuetzt sie nicht (jeder Shop-User
  kann `shop_artikel.preis_netto` lesen). Wer Preise im UI ergaenzen will, kann
  das also tun, ohne an RLS zu ruehren. Entscheidung vom 23.08.2026.
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
Edge Function `shop-ai` mit taskbasiertem Routing:
- Vision (Foto→Artikel, Beleg→Positionen): Sonnet 4.6
- Text (Kategorie/Tag/Beschreibung): laeuft aktuell ebenfalls auf Sonnet 4.6
  (revidierte Modell-Politik, ADR 0003 v2); Haiku 4.5 bleibt fuer spaetere
  Live-Suggestions und den Bot reserviert
- Browser-Agent (Phase 7/8): Sonnet 4.6 mit Tool-Use

**Zugriff: nur Shop-Admins** — fail-closed, geprueft in der Function selbst.
Die Supabase-Instanz ist mit den anderen drei Apps geteilt, ein gueltiges JWT
allein ist also kein Shop-Recht. Siehe ADR 0003, Nachtrag vom 23.08.2026.

## Domain-Doku
- [CONTEXT.md](CONTEXT.md) — Domain-Glossar
- [ROADMAP.md](ROADMAP.md) — Phasen 0-9
- [docs/adr/](docs/adr/) — Architektur-Entscheidungen

## Doku-Regel
Wenn sich eine Kern-Entscheidung aendert: ADR schreiben, CLAUDE.md updaten, CONTEXT.md pflegen.
