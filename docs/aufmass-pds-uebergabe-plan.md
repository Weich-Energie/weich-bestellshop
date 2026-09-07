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

## Schritte, in Reihenfolge

1. **Kunstartikel nach PDS synchronisieren.** `pds-katalog-sync` (bestehende
   Function) um `formteil_aufmass`-Artikel erweitern oder eine eigene,
   kleinere Sync-Function schreiben — die 57 Artikel müssen einen
   `pds_katalog_uuid` bekommen, bevor irgendetwas übertragen werden kann.
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
