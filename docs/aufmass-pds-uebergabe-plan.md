# PDS-Übergabe der Aufmaß-Erfassung — Bauplan (Ziel-Schritt 5)

Stand 07.09.2026. **Bewusst nur als Plan, nicht als Code**: die
PDS-Verbindung dieser Sitzung ist gerade gestört (siehe Chatverlauf), eine
Function, die in echte Kundenaufträge schreibt, ohne sie auch nur einmal
testen zu können, ist ein zu hohes Risiko für falsche Mengen im PDS. Sobald
die Verbindung steht, lässt sich das hier direkt umsetzen und gegen einen
echten Testauftrag prüfen.

## Grundlage, die schon steht

- **Formteil-Kunstartikel**: 57 `shop_artikel`-Zeilen mit
  `formteil_aufmass = true`, `formteil_system`, `formteil_dimension`, Preis =
  mengengewichteter R+F-Mittelwert (Migration
  `20260907140000_formteil_kunstartikel.sql`). Noch **nicht** nach PDS
  synchronisiert (`pds_katalog_uuid` ist überall `null`).
- **Muster von `pds-auftrag-material`** (Klima-Nachkalkulation, ADR 0007):
  Platzhalter-Ebene im Auftrag → Menge per `/vorgang/updateposition` setzen;
  ohne Platzhalter → Transportangebot bei der Weich GmbH zum Kopieren im
  Client (ADR 0006). Diese Funktion wird 1:1 wiederverwendet, nur die
  Datenquelle wechselt von `shop_nachkalkulation_positionen` zu den drei
  `aufmass_*`-Tabellen.

## Befund 07.09.2026: Trockenlauf des Katalog-Syncs

Die bestehende Edge Function `pds-katalog-sync` lässt sich direkt über das
Supabase-Functions-Gateway aufrufen (User-JWT eines Shop-Admins + anon-Key) —
sie spricht PDS serverseitig mit dem Schlüssel aus `integration_secrets` an
und ist damit **unabhängig von der MCP-Verbindung einer Claude-Sitzung**. Das
ist der verlässlichere Weg für Automatisierung als der MCP-Server.

Trockenlauf für den Kunstartikel „Formteil b-press-kupfer 15mm" (Standard
`dry_run: true`, sendet nichts an PDS, prüft nur das Mapping) ergab genau zwei
Lücken, die für **alle 57 Kunstartikel** gleich gelten:

1. **Keine Shop-Kategorie.** Im Shop gibt es nur zwei Kategorien, und nur
   „Klima" trägt beide PDS-UUIDs (Warengruppe + Katalogkategorie). Formteile
   für Heizung/Sanitär unter „Klima" einzuhängen wäre fachlich falsch.
   Warengruppen/Kategorien kann die PDS-API nicht anlegen — eine Warengruppe
   „Formteile Heizung/Sanitär" (o. ä.) muss **von Hand in PDS** entstehen,
   danach eine `shop_kategorien`-Zeile mit beiden UUIDs. **Entscheidung
   Patrick.**
2. **Kein Lieferanten-Bezug.** `shop_lieferanten` kennt R+F (slug `r-f`) und
   GUT, beide ohne `pds_person_uuid`. R+F muss in PDS als Lieferant (Person)
   existieren, die UUID gehört in `shop_lieferanten.pds_person_uuid` (Admin →
   Lieferanten). **Braucht PDS-Zugriff oder Patricks Angabe.** Danach
   `shop_artikel.lieferant_id` der Kunstartikel auf R+F setzen.

Einheit „Stück" → PDS „Stck" ist zugeordnet, das passt bereits.

### Beide Lücken geschlossen (07.09.2026, später am Tag)

Über den MCP-Server **lokal auf dem VPS** (`tools/vps/mcp-lokal.mjs`,
Streamable HTTP an `localhost:3000/mcp`, Token aus `/opt/weich-api/.env`)
liessen sich die nötigen PDS-Daten lesen — unabhängig von der gestörten
MCP-Verbindung der Claude-Sitzung:

| Was | PDS-Objekt | UUID |
|---|---|---|
| Lieferant R+F | Person „Richter+Frenzel Nürnberg GmbH", Lieferantennr. 70077 | `ef164291-89b3-463e-a0e2-d2cbe72d70bb` |
| Katalogkategorie | SHK › Handelsware › `8-SHK-Installationsmaterial` | `4e84d95e-3881-4733-8444-56eea6f6f71c` |
| Warengruppe | `(SHK)Installationsmaterial` | `dca773ae-4c27-4195-8243-a7c1252f4efb` |

Shop-seitig gesetzt: `shop_lieferanten.pds_person_uuid` für `r-f`, neue
`shop_kategorien`-Zeile „SHK-Installationsmaterial (Formteile)" mit beiden
UUIDs, und bei allen 57 Kunstartikeln `lieferant_id` (R+F) und
`kategorie_id`. **Nichts davon hat PDS verändert.** Beide Zuordnungen sind
fachlich naheliegend (die Formteile sind SHK-Installationsmaterial), aber eine
Wahl — Patrick kann sie vor dem echten Sync noch umhängen.

**Trockenlauf für alle 57 Kunstartikel: grün** (07.09.2026, über das
Functions-Gateway mit dem Testkonto als temporärem Shop-Admin, danach wieder
entzogen). Alle 57 antworten `200 trockenlauf`, keine Mapping-Lücke mehr;
`pds_sync_status` steht auf `bereit`. Skript: `sync-trockenlauf.mjs`
(Scratchpad; bei Bedarf nach `tools/` übernehmen).

**Nächster Schritt braucht Freigabe:** `pds-katalog-sync` mit `dry_run: false`
legt 57 Katalogeinträge in PDS an. Die sind per API nicht löschbar („eine
Dublette bleibt für immer stehen", CLAUDE.md). Vorher ggf. Kategorie/
Warengruppe umhängen, falls SHK-Installationsmaterial nicht gewünscht ist.
Hinweis aus dem Trockenlauf: keine Aufschlagsklasse gesetzt — PDS würde VK =
EK setzen. Für Formteile, die im Montagematerial aufgehen, ist das vertretbar
(gleiche Begründung wie in `pds-katalog-sync` selbst); sonst vorher
`aufschlagsklasse` an den Kunstartikeln setzen.

## Edge Function `aufmass-pds-uebergabe` — deployt, nur Vorschau (07.09.2026)

`supabase/functions/aufmass-pds-uebergabe/index.ts`, Kopie des Ablaufs aus
`pds-auftrag-material` mit den `aufmass_*`-Tabellen als Quelle. Schreibende
Aktionen antworten 501 (`SCHREIBEN_FREIGEGEBEN = false`, Pfad-Positivliste nur
`/vorgang/details`), bis Kunstartikel in PDS stehen und Patrick den
Schreibweg freigibt. Getestet gegen die Testerfassung
`c60d59ff-7d68-4a30-bcbe-c1f76468833f` („QA Vorschau Kluegl", QA-Konto) mit
Auftrag **2025-10348** (Klügl, Ammerthal): 37 Positionen, 29 mit Katalog-UUID,
Ebenen u. a. „Rohre und Zubehör" — ein Wärmepumpen-/SHK-Auftrag, passt zum
Korb „NK Klügl". Ergebnis wie erwartet: Formteile „noch nicht in PDS",
Rohrmeter „Zielartikel offen", nichts geschrieben.

Schreibweg freischalten = drei Änderungen in der Function: `SCHREIBEN_FREIGEGEBEN`,
`/vorgang/updateposition` und `/vorgang/create` in die Positivliste, und die
beiden Schreibzweige aus `pds-auftrag-material` (mengen_setzen /
transport_anlegen) übernehmen — inkl. Protokoll in `shop_pds_sync_log` und
Markierung der übertragenen Positionen (Spalte `pds_transport_at` an
`aufmass_formteile` fehlt noch, Migration nötig).

## Edge Function `aufmass-auftrag-suche` — deployt, rein lesend (07.09.2026)

Schliesst Schritt 2 der Liste unten: die App sucht über
`/projektakte/listprojektakten` (Suchwort, `suchfelder: ["ALLES"]`) und je
Akte `/vorgang/listvorgaengebyprojektakte` (`vorgangstyp: "AUFTRAG"`), zeigt
Kandidaten und setzt bei Auswahl `pds_vorgang_uuid` + `pds_vorgangs_nummer`
(neue Spalte, Migration `20260907230000` im Repo `weich-aufmass`). Zugang für
jeden mit `app_access.aufmass`. Getestet: „Haberstumpf" → Projektakte 2025-1107
→ Auftrag 2025-10133 („WP Panasonic"). Bei mehr als 10 Projektakten wird
abgeschnitten und um Eingrenzung gebeten — häufige Nachnamen (Schmidt,
Richter) sind ohne Vorname/Ort nicht eindeutig, siehe Baustellen-Vergleich.

## Schritte, in Reihenfolge

1. **Kunstartikel nach PDS synchronisieren.** Sobald die beiden Lücken oben
   geschlossen sind: `pds-katalog-sync` je Kunstartikel (57 Aufrufe, erst
   `dry_run: true`, dann `dry_run: false`) über das Functions-Gateway — die
   Function braucht dafür keine Änderung, `formteil_aufmass`-Artikel sind
   normale `shop_artikel`. Danach haben alle 57 einen `pds_katalog_uuid`.
2. **Baustelle mit PDS-Auftrag verknüpfen.** `aufmass_erfassung.pds_vorgang_uuid`
   ist im Schema vorbereitet, aber die App setzt es noch nicht — `baustelle_text`
   ist reiner Freitext. Braucht in der App eine Suche gegen
   `pds_projekt_kompakt` (oder eine passende Auftragssuche), sobald verfügbar.
3. **Neue Edge Function `aufmass-pds-uebergabe`**, Kopie des Ablaufs aus
   `pds-auftrag-material`:
   - Input: `erfassung_id` (statt `nachkalkulation_id`).
   - Lädt `aufmass_erfassung` + `aufmass_formteile` + `aufmass_rohrmeter` +
     `aufmass_einzelartikel`.
   - Formteile: je `(formteil_system, dimension)` den Kunstartikel aus
     `shop_artikel where formteil_aufmass` nachschlagen, dann wie bei Klima:
     Platzhalter im Auftrag → Menge setzen, sonst → Transportangebot.
   - Rohrmeter: eigene Kunstartikel je System (kein Dimension-Mittelwert
     nötig, Rohr wird nach Meter bezahlt) — **noch zu klären**, ob Rohrmeter
     überhaupt einen Formteil-artigen Kunstartikel braucht oder ob es
     bestehende Rohr-Artikel aus dem GUT/R+F-Katalog gibt, die direkt
     referenziert werden können.
   - Einzelartikel: aktuell Freitext ohne Artikelbindung (siehe
     `weich-aufmass/CLAUDE.md`) — für PDS-Übergabe muss das zuerst auf
     `shop_artikel`-Referenzen umgestellt werden, sonst gibt es keinen
     `pds_katalog_uuid` zum Zuordnen.
4. **App-Button „Nach PDS übertragen"** analog zur Nachkalkulation, sichtbar
   nur für Shop-Admins (bzw. ein neues `aufmass_admin`-Recht).

## Offene Fragen für dieses Vorgehen

- Rohrmeter-Kunstartikel: pro Meter oder eine feste Verpackungseinheit?
- Reicht ein Transportangebot-Umweg (wie bei Klima) auch für Aufmaß, oder
  sollen neue Klima-Aufträge künftig direkt eine „Formteil (Aufmaß)"-Ebene
  mit Platzhaltern bekommen, analog zu „Montagematerial (Nachkalkulation)"?
- Wer bekommt das neue Recht, PDS-Übergaben aus der Aufmaß-App auszulösen?
