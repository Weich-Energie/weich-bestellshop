# ADR 0004 — Browser-Automation-Runtime auf Hostinger

**Datum:** 2026-07-27
**Status:** akzeptiert

## Kontext

Der Bot fuer die tatsaechliche Bestellabgabe bei Lieferanten braucht Playwright
(realer Browser, Selenium-artige Interaktion). Serverless-Umgebungen (Vercel
Edge/Serverless) sind dafuer ungeeignet: Bundle > 250 MB, kalter Start dauert
Sekunden, Zeitlimits schneiden lange Flows ab, kein State zwischen Aufrufen.

## Entscheidung

Der Bot laeuft als **Node-Service auf der bestehenden Hostinger-Instanz
`weich-code`**. Kommunikation mit dem Shop ueber Supabase (Job-Queue-Tabelle
`bot_jobs`) — der Shop schreibt Jobs rein, der Bot pollt/subscribed und
schreibt Ergebnisse zurueck.

**Runtime-Details:**
- Node.js + Playwright (Chromium)
- Systemd-Service auf `weich-code`
- Supabase Realtime Subscription auf `bot_jobs`-Tabelle
- Anthropic Sonnet 4.6 mit Tool-Use fuer die Steuerung

**Zwei-Modus-Setup (siehe CONTEXT.md):**
- **Modus A (Playbook)**: 2-4 Frequenz-Champion-Lieferanten mit vollem Auto-Kauf.
  Sicherheitsnetz: Warenkorb-Screenshot + Positions-Liste → Freigabe → dann
  "Kaufen"-Klick.
- **Modus B (Ad-hoc)**: Universelle KI-Vorbereitung eines Warenkorb-Links, der
  User klickt final manuell im eigenen Browser.

Passwoerter fuer Lieferanten-Accounts in `supplier_credentials`-Tabelle,
verschluesselt mit `pgcrypto` und einem Master-Key als Env-Var auf dem Bot-Service.

## Konsequenzen

**Positiv:**
- Playwright laeuft nativ, kein Cold-Start-Overhead
- Lange Flows moeglich (Rechnung > 30s ist okay)
- Bot ist frei skalierbar auf der Hostinger-Instanz
- Job-Queue-Pattern ist entkoppelt: Shop und Bot koennen unabhaengig deployen

**Negativ:**
- Neuer produktiver Service auf Hostinger — Monitoring/Uptime muessen aufgebaut
  werden (bisher lief dort nichts produktiv)
- SSH-Zugriff/Update-Prozess ist manueller als bei Vercel-Auto-Deploy
- Backup fuer den Bot-Service muss mitgedacht werden (auch wenn er zustandslos ist)

**Verworfene Alternativen:**
- **Playwright auf Vercel**: Technisch nicht praktikabel (Bundle-Groesse, Timeouts).
- **Browserless.io / externe Playwright-as-a-Service**: Zusaetzliche Kosten,
  Datenschutz-Fragen (Lieferanten-Credentials via externer Dienst).
- **Ressourcenplanung-App auf Hostinger umziehen**: Rueckschritt — Vercel bietet
  fuer die Static-Frontends klare Vorteile (CDN, Auto-Deploy, Preview-URLs).
