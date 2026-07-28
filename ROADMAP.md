# weich-bestellshop — Roadmap

## Phase 0 — App-Zugriffs-System (obsolet-ish, siehe ADR 0002 rev)

**Ergebnis der Recherche beim Bootstrap:** Das App-Access-System existiert bereits
als JSON-Feld in `employees.berechtigungen.app_access` (Phase 11 / AAC-04 in
Ressourcenplanung). Der Bestellshop uebernimmt das Pattern.

Restliche Arbeit fuer diese Phase:
- Fail-closed-Check in `AuthContext.jsx` implementieren (erledigt beim Bootstrap)
- Retro-Migration via SQL: pro Shop-User setzen
  `berechtigungen -> 'app_access' -> 'bestellshop' = true`
- Patrick bekommt `bestellshop_admin = true`
- Andere Apps brauchen KEIN Update — sie ignorieren den Shop-Key still

## Phase 1 — Bootstrap & Fundament

- Neues GitHub-Repo `weich-bestellshop` (manuell durch Patrick anlegen)
- Ressourcenplanung-App als Template kopieren, App-spezifisches raus
- Vercel-Projekt aufsetzen, Env-Vars, Domain
- Bundle-Struktur: `src/app/pages/`, `src/data/api/`, `supabase/migrations/`
- Login mit PIN (wie in Ressourcenplanung), Access-Check gegen `app_access`

## Phase 2 — Katalog & Bestell-Basics

- Migrationen: `shop_kategorien`, `shop_tags`, `shop_artikel`, `shop_artikel_tags`,
  `shop_favoriten`, `shop_order_requests`, `shop_orders`, `shop_order_positions`
- Admin: Katalog-Artikel manuell anlegen (mit Bild-Upload → Supabase Storage,
  Bucket `shop-artikel`)
- User: Katalog stoebern, Favoriten setzen, in Warenkorb legen
- Warenkorb → Bestellwunsch abschicken
- Admin: Bestellwuensche freigeben/ablehnen
- Zustands-Zyklus draft → pending → approved → ordered → received → closed

## Phase 3 — Bedarfsmeldung im Shop

- Migration: `shop_bedarfsmeldungen`
- User-UI: "Bedarf melden" (Beschreibung, Handy-Foto, optional Link)
- Admin-Backlog: Bedarfsmeldungen sichten, in Katalog-Artikel wandeln oder ablehnen
- Bucket `shop-bedarf` in Supabase Storage

## Phase 4 — Sammelbestellung

- Admin sieht freigegebene Bestellwuensche gruppiert nach Lieferant
- KI-Vorschlag fuer Gruppierung (Haiku)
- Sammelbestellung anlegen: mehrere `order_requests` → eine `order` mit
  `order_positions`
- Wareneingang-Screen: Sammelbestellung als `received` markieren, alle Positionen
  gehen auf `received`, User bekommen In-App-Notification
- User klickt "abgeholt" → `closed`

## Phase 5 — KI-Support fuer Anlage

- Edge Function `shop-ai` deployen
- Beim Katalog-Artikel-Anlage-Formular: KI-Vorschlaege fuer Kategorie, Tags,
  Kurzbeschreibung, Bild-Suche-Query, Lieferanten-Link (Haiku 4.5)
- Bei Bedarfsmeldung mit Foto: KI erkennt Artikel und schlaegt Katalog-Artikel-
  Felder vor (Sonnet 4.6 Vision)
- Duplikat-Erkennung beim Anlegen

## Phase 6 — Beleg-Import (Massenimport aus DATEV)

- Bucket `shop-belege` in Supabase Storage
- Admin-Upload: einzelne oder Bulk-PDFs
- Sonnet 4.6 Vision extrahiert Rechnungspositionen (JSON:
  `{beschreibung, menge, einzelpreis, artikelnr, lieferant}`)
- Auto-Filter beim Import: Lieferanten-Whitelist/Blacklist, Betrags-Schwelle,
  Duplikate-Check gegen bestehende Katalog-Artikel
- Review-Screen: pro Position `uebernehmen | ignorieren | spaeter klaeren`
- Uebernommene Positionen werden Katalog-Artikel-Kandidaten mit vorgefuellten Feldern

## Phase 7 — Browser-Bestell-Bot (Modus B / Ad-hoc)

- Node-Service auf Hostinger `weich-code` aufsetzen (Systemd, Playwright, Node)
- Migration: `bot_jobs`, `supplier_credentials`
- Ad-hoc-Modus (Modus B): KI findet Artikel im angegebenen Shop, fuellt Warenkorb,
  gibt Warenkorb-Link zurueck an User (kein echter Kauf)
- Realtime-Subscription: Shop erstellt Job, Bot verarbeitet, Ergebnis zurueck

## Phase 8 — Browser-Bestell-Bot (Modus A / Playbook)

- Playbook-Pattern definieren (Login-URL, Selektoren, Warenkorb-Flow, Kauf-Klick)
- Playbook fuer Frequenz-Champion 1 (Lieferant tbd)
- Playbook fuer Frequenz-Champion 2 (Lieferant tbd)
- Sicherheitsnetz vor Kauf: Vorschau (Screenshot + Positionen + Endbetrag) →
  User-Bestaetigung → Kauf-Klick
- Fehler-Fallback: Screenshot + Log speichern, Bestellung "manuell fertigstellen"

## Phase 9 — Notifications (Email-Kanal)

- Email-Notifications fuer Wareneingang, Freigabe-Aenderungen (v1.0 war
  In-App-only)
- Wiederverwendung des bestehenden Resend-Setups aus Service-Ticket-App

## Cross-Cutting

Fortlaufend: Tests (Vitest + Playwright E2E), Bundle-Optimierung, RLS-Reviews,
Vercel Preview-Deploys fuer PRs.

## Nicht in v1.0

- Teillieferungs-Handling (kommt wenn's oft vorkommt)
- Multi-Warenkorb (Wunschlisten a la Amazon)
- Kostenstellen-Auswertung / Budget-Tracking pro User
- Automatische DATEV-Ordner-Watch oder DATEV-API
- Werkstattleiter-Rolle (Freigeber ohne Admin-Rechte)
