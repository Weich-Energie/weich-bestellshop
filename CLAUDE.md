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
- SQL ausfuehren, wenn Port 5432 gesperrt ist (Fremdnetz, `db query` meldet
  `LegacyDbConfigConnectTempRoleError`): `tools/supabase-sql-https.ps1 -SqlFile x.sql`
  geht ueber die Management-API (HTTPS) mit dem CLI-Token aus dem
  Windows-Anmeldeinformationsspeicher; kann auch DDL. Token wird nie ausgegeben.

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
- Artikel haben **drei** Sichtbarkeiten: `bestellbar` (Shop-Katalog) und
  `nachkalkulation_klima` (Nachkalkulation, Platzhalter in neuen
  Klima-Auftraegen) aus Migration 014, seit 10.09.2026 dazu `sichtbar_aufmass`
  (Artikelkatalog der Aufmass-App). Der Katalog filtert auf `bestellbar`, die
  Nachkalkulation auf `nachkalkulation_klima`. Gepflegt werden alle drei im
  Artikeldialog unter „Sichtbarkeit"; die Admin-Katalogliste zeigt sie als
  Abzeichen. Der Shop ist der **Artikelstamm fuer das Aufmass** auf der
  Baustelle — die Aufmass-App (Repo `weich-aufmass`) liest nie `shop_artikel`
  direkt, sondern die preisfreie Sicht `aufmass_artikel_katalog`, weil Monteure
  kein `has_shop_access()` haben.
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

## PDS-Anbindung (Stand 04.09.2026, in Betrieb)
- Der Shop ist **Anlage-Kanal fuer den PDS-Artikelstamm** — PDS bleibt
  Systemfuehrer. Siehe ADR 0005.
- Nicht ueber den MCP-Server, sondern direkt per Edge Function mit dem Key aus
  `integration_secrets` (Muster: `weich-energie-app/functions/pds-preise`).
- `pds-katalog-sync` schreibt: Whitelist auf vier Katalog-Pfade plus
  `/vorgang/create` fuer das Musterangebot (einziger Weg zum Katalog-VK).
  Trockenlauf ist Standard, Protokoll in `shop_pds_sync_log`. Angelegt wird nur
  bei `pds_katalog_uuid is null` — `/katalog/delete` greift in PDS nur ohne
  Bestand und Verwendung, eine Dublette bleibt fuer immer stehen.
- `pds-auftrag-soll` liest Soll-Werte und Einzelpositionen fuer die
  Nachkalkulation. Rein lesend.
- `pds-auftrag-material` bringt das verbaute Material in den Auftrag (ADR 0007):
  Neue Klima-Auftraege tragen seit Meghs Anlage eine Ebene „Montagematerial
  (Nachkalkulation)" mit Platzhaltern (Menge 0) aus der Sicht
  `shop_pds_montagematerial_platzhalter` (Kennzeichen `nachkalkulation_klima` am
  Artikel). Der Shop setzt dort die Mengen per `/vorgang/updateposition` —
  nur Menge, nur Shop-Artikel. Material ohne Platzhalter und aeltere Auftraege
  gehen als Transportangebot bei der Weich GmbH (`/vorgang/create`, ANGEBOT,
  Praefix `ZZ-TRANSPORT`) zum Kopieren im Client (ADR 0006). Grund fuer beides:
  Die API kann an einen bestehenden Auftrag keine Positionen anhaengen; der
  Nachtragsauftrag war der erste Versuch und ist verworfen. Positionen tragen
  `pds_transport_at`, nichts geht zweimal. Vorgaenge sind per API nicht
  loeschbar. Siehe docs/pds-montagematerial-platzhalter.md.
- Kategorien, Warengruppen und Kalkulationsgruppen sind per API nur lesbar;
  die Klima-Struktur steht seit 01.09.2026 (docs/pds-klima-warengruppen.md).

## Domain-Doku
- [CONTEXT.md](CONTEXT.md) — Domain-Glossar
- [ROADMAP.md](ROADMAP.md) — Phasen 0-9
- [docs/adr/](docs/adr/) — Architektur-Entscheidungen
- [docs/pds-inbetriebnahme.md](docs/pds-inbetriebnahme.md) — Reihenfolge der Inbetriebnahme
- [docs/pds-katalog-mapping.md](docs/pds-katalog-mapping.md) — Feld- und ID-Mapping Shop → PDS
- [docs/pds-klima-warengruppen.md](docs/pds-klima-warengruppen.md) — Klima-Warengruppen und Umzugsliste
- [docs/nachkalkulation-datenmodell.md](docs/nachkalkulation-datenmodell.md) — Soll/Ist-Modell
- [docs/pds-nachtragsauftrag.md](docs/pds-nachtragsauftrag.md) — warum kein Nachtrag: Befund und Test
- [docs/artikelpflege-lieferantendaten.md](docs/artikelpflege-lieferantendaten.md) — Shop als aktuelle Wahrheit fuer C-Teile, Import-Skript, PDS-Abgleich
- [docs/lieferanten-shop-zugaenge.md](docs/lieferanten-shop-zugaenge.md) — Abruf hinter dem Login (VPS), Playbook Frigotechnik, neue Shops anbinden
- [docs/pds-montagematerial-platzhalter.md](docs/pds-montagematerial-platzhalter.md) — Platzhalter-Ebene fuer die Auftragsanlage (an Megh)
- [docs/aufmass-formteil-modell.md](docs/aufmass-formteil-modell.md) — GUT-Export, R+F-Zuordnung, Formteil-Mittelwert je System+Dimension (Ziel-Schritte 1-3)
- [docs/gut-korb-pds-zuordnung.md](docs/gut-korb-pds-zuordnung.md) — GUT-Koerbe → PDS-Auftraege (lesend, `tools/vps/korb-pds-abgleich.mjs`), Abrechnungsstatus, Vergleich alt/neu auf 58 abgerechneten Baustellen
- [docs/aufmass-app-entwurf.md](docs/aufmass-app-entwurf.md) — Entwurf der Aufmass-App (Repo `weich-aufmass`, Ziel-Schritt 4)
- [docs/aufmass-pds-uebergabe-plan.md](docs/aufmass-pds-uebergabe-plan.md) — PDS-Uebergabe aus der Aufmass-App: Function `aufmass-pds-uebergabe`, Katalog-Sync der Kunstartikel, erster Lauf (Ziel-Schritt 5)
- [docs/pds-formteil-platzhalter.md](docs/pds-formteil-platzhalter.md) — Platzhalter-Ebene "Formteile (Aufmass)" fuer neue SHK-Auftraege (an Megh), Sicht `shop_pds_formteil_platzhalter`
- [docs/rf-lagerliste-echte-preise.md](docs/rf-lagerliste-echte-preise.md) — **Richtungswechsel 09.09.2026:** GUT-Koerbe sind nur Kalkulationsbasis, verbaut wurde R+F. Preise kommen aus dem Lagerauszug, Gewichte aus der Historie; Leseskript `tools/lager-auszug-lesen.py`. Abdeckung damit 91,2 %, Baustellen-Vergleich +23,3 %
- [docs/formteil-preisklassen.md](docs/formteil-preisklassen.md) — warum ein Mittelwert je Dimension zu grob ist: Gewindeteile sind 41,7 % der Menge und kosten 1,7x, Vorschlag zwei Preisklassen (`presse` / `gewinde`)
- [docs/strichliste-zuschnitt.md](docs/strichliste-zuschnitt.md) — **Zweck der Historie: Mengengeruest.** Wie viele Zeilen die Strichliste braucht (heute 32 Artikel je Baustelle, Vorschlag 14 Felder), welche Hebel wirklich vereinfachen
- [docs/systemwechsel-35mm-edelstahl.md](docs/systemwechsel-35mm-edelstahl.md) — 35 mm+ Kupfer/C-Stahl ist 48 % des historischen Verbrauchs und wird auf Heizungsedelstahl umgestellt — wichtig fuer die Frage, welche Gruppen ueberhaupt noch gebraucht werden (der Preisvergleich darin ist eine Nebenrechnung, nicht das Projektziel)

## Formteil-Kunstartikel (07.09.2026)
`shop_artikel.formteil_aufmass = true` markiert 57 Kunstartikel „Formteil
<System> <Dimension>" mit dem mengengewichteten R+F-Mittelwert als Preis —
nie `bestellbar`, kein echter Lieferant. Grundlage der kuenftigen
PDS-Uebergabe aus der Aufmass-App. Siehe docs/aufmass-formteil-modell.md.
`shop_gut_positionen.rf_zuordnung_quelle` kennt seit 09.09.2026 drei Stufen:
`automatisch` (Pruefregeln bestanden), `vermutet` (bestplatzierter Kandidat,
Entscheidung Patrick 08.09.) und `manuell`. Auswertungen sollen `vermutet`
herausfiltern koennen — der Mittelwert liegt damit deutlich hoeher.

**Wichtig (09.09.2026):** Die GUT-Warenkoerbe sind **keine Liste des verbauten
Materials**, sondern nur die Kalkulationsbasis — verbaut wurden R+F-Artikel,
erfasst per Strichliste auf GUT-Vordrucken. Preise gehoeren deshalb aus
Patricks R+F-Lagerauszug, nicht aus einer Textsuche; die Historie liefert nur
noch die Mengengewichte. Siehe docs/rf-lagerliste-echte-preise.md.

## Doku-Regel
Wenn sich eine Kern-Entscheidung aendert: ADR schreiben, CLAUDE.md updaten, CONTEXT.md pflegen.
