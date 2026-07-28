# ADR 0002 — App-Zugriffs-System (Update: existiert bereits)

**Datum:** 2026-07-27 (revidiert 2026-07-28)
**Status:** akzeptiert

## Kontext

Ursprungliche Annahme (2026-07-27): Es gebe kein App-Access-System und wir muessten
eines bauen (Tabelle `app_access(user_id, app, role)`).

Erkenntnis beim Bootstrap (2026-07-28): Ressourcenplanung hat das Muster bereits in
Phase 11 / AAC-04 implementiert — als **JSON-Feld** in `employees.berechtigungen`:

```json
{
  "rolle": "admin" | "monteur",
  "app_access": {
    "ressourcenplanung": true,
    "service_tickets": true,
    "betriebsradar": true,
    "bestellshop": true
  },
  "tabs": { ... },
  "aktionen": { ... }
}
```

**Naming-Convention der App-Keys** (aus der DB verifiziert):
- `ressourcenplanung` (Singular)
- `service_tickets` (Plural!)
- `betriebsradar` (Singular)
- `bestellshop` (Singular)

Der Zugriffs-Check ist fail-closed: `access?.[APP_KEY] === true`. Alle drei bestehenden
Apps nutzen dieses Pattern bereits.

## Entscheidung

**Der Bestellshop nutzt das existierende `berechtigungen.app_access`-Pattern**, ohne
neue Tabellen anzulegen.

Konkret:
1. Shop verwendet `APP_KEY = 'bestellshop'` (siehe `AuthContext.jsx`)
2. Fail-closed-Check identisch zur Ressourcenplanung: nach Login Profil laden,
   pruefen ob `berechtigungen.app_access.bestellshop === true`, sonst `signOut()`
   und Fehlermeldung "Du hast keinen Zugang zum Bestellshop. Wende dich an Patrick."
3. Shop-Admin: entweder `berechtigungen.rolle === 'admin'` (globaler Admin, hat schon
   Zugriff auf alle Apps) ODER neues Flag `berechtigungen.app_access.bestellshop_admin === true`
   (App-spezifischer Admin, ohne Zugriff auf andere Apps)
4. Retro-Migration: pro User der den Shop nutzen soll wird
   `berechtigungen.app_access.bestellshop = true` gesetzt (SQL-Update in Supabase).
   Patrick kriegt sofort `bestellshop_admin = true`.

Kein Cross-Repo-Change mehr noetig — die anderen Apps kennen `bestellshop` bereits nicht,
und das ist OK: sie ignorieren unbekannte App-Keys still.

## Konsequenzen

**Positiv:**
- Massive Phase-0-Vereinfachung: keine neue Tabelle, keine Migration ausser
  Retro-Update fuer die Nutzer, kein Cross-Repo-Deploy
- Konsistenz mit bestehenden Apps (gleiche Prueflogik, gleicher Toast-Text)
- Wenn spaeter feinere Rechte noetig: das JSON-Feld ist erweiterbar ohne Migration

**Negativ / Verbleibende Risiken:**
- JSON-Feld ist schwerer per SQL zu queryen als eine relationale Tabelle
  ("wer hat Shop-Zugriff?" wird ein `where berechtigungen -> 'app_access' ->> 'bestellshop' = 'true'`)
- Keine referenzielle Integritaet auf `app` und `role` — Tippfehler bleiben moeglich.
  Mitigation: Konstanten im Code, keine handeditierten JSON-Werte in Supabase.

## Aenderungen an frueherer Version dieses ADR

- ADR sagte urspruenglich "neue Tabelle `app_access(user_id, app, role)`" — obsolet.
- ADR sagte "Cross-Repo-Change in allen vier Apps" — obsolet, weil Pattern schon in
  den drei bestehenden Apps drin ist.
- Phase 0 in `ROADMAP.md` reduziert sich auf: (a) `bestellshop` als bekannten App-Key
  dokumentieren, (b) initiale User-Access-Updates via SQL.
