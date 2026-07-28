# ADR 0001 — Separates Repo, geteiltes Supabase-Projekt

**Datum:** 2026-07-27
**Status:** akzeptiert

## Kontext

Der Bestellshop ist die vierte App im Weich-Solar-Oekosystem (Ressourcenplanung,
Service-Ticket, Betriebsradar, Bestellshop). Es gibt vier plausible
Architektur-Optionen:

1. Neue Route innerhalb `ressourcenplanung-app`
2. Separates Repo, separates Supabase-Projekt
3. **Separates Repo, geteiltes Supabase-Projekt**
4. Monorepo mit den anderen drei Apps

## Entscheidung

Option 3: **Separates GitHub-Repo `weich-bestellshop`, eigener Vercel-Deploy,
geteiltes Supabase-Projekt** mit den anderen drei Apps.

## Konsequenzen

**Positiv:**
- Konsistent mit dem bereits etablierten 3-App-Muster
- Ressourcenplanungs-Bundle bleibt schlank; Shop-Chunks (Bilder, KI, spaeter
  Playwright-Bot) belasten nicht die Planungs-User
- Klare Zielgruppen-Trennung: Planer vs. Besteller
- Shared `employees`-Tabelle bleibt Single Source of Truth — keine
  Doppelpflege bei Personaldaten
- Cross-App-Integration ueber die Supabase-Tabellen ist erprobt (Service-Ticket
  <-> Ressourcenplanung)

**Negativ:**
- Vier Codebasen zu warten, vier Deploys
- Auth-Zugriff musste bisher app-uebergreifend geregelt werden (siehe ADR 0002)
- Schema-Aenderungen an geteilten Tabellen brauchen Absprache mit den anderen Apps

**Verworfene Alternativen:**
- **Option 1 (Route in Ressourcenplanung)**: Bundle-Aufblaehung, gemischte
  Zielgruppen, unterschiedliche Rollen-Modelle waeren im gleichen Code.
- **Option 2 (eigenes Supabase)**: Doppelte Personalpflege, zwei Auth-Systeme.
- **Option 4 (Monorepo)**: Setup-Aufwand zu hoch fuer ein Team dieser Groesse.
