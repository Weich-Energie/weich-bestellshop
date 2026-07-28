# weich-bestellshop (Planung)

Interner Bestellshop fuer Weich Solartechnik GmbH. Verbrauchsmaterial (C-Teile).
Vierte App im Oekosystem, shared Supabase.

**Status:** Planungsphase. Repo/Code existiert noch nicht — nur Konzept-Doku.

## Doku

- [CONTEXT.md](CONTEXT.md) — Domain-Glossar, Kern-Entitaeten, Zustands-Zyklus
- [ROADMAP.md](ROADMAP.md) — Phasen 0-9, Nicht-Ziele
- [docs/adr/](docs/adr/) — Architektur-Entscheidungen
  - [0001 Separates Repo, shared Supabase](docs/adr/0001-separates-repo-shared-supabase.md)
  - [0002 App-Zugriffs-System als Vorbedingung](docs/adr/0002-app-zugriffs-system.md)
  - [0003 KI-Architektur](docs/adr/0003-ki-architektur.md)
  - [0004 Browser-Automation-Runtime auf Hostinger](docs/adr/0004-browser-automation-runtime.md)

## Naechste konkrete Schritte

1. **Phase 0 starten** (App-Zugriffs-System in Ressourcenplanung + zwei anderen Apps)
   — Cross-Repo-Change, blockierend fuer alles Shop-spezifische.
2. **GitHub-Repo `weich-bestellshop` anlegen** (Patrick manuell) und Ressourcenplanung
   als Template kopieren.
3. **Vercel-Projekt aufsetzen** mit shared Supabase-Env-Vars.

Solange kein Repo existiert, bleibt diese Ordner-Struktur lokaler Staging-Bereich
und wird nach Repo-Erstellung dorthin migriert.
