# Artikelpflege mit aktuellen Lieferantendaten — der Shop als aktuelle Wahrheit für C-Teile

Stand 05.09.2026. Festlegung von Patrick Weich: Der Bestellshop wird laufend mit
Daten aus den Lieferanten-Shops gefüttert und ist damit die **aktuelle** Quelle
für Artikel und Einkaufspreise der C-Teile. PDS ist nicht aktuell und wird im
Nachgang gegen den Shop abgeglichen.

## Ablauf

```
Lieferanten-Shop (Link, Screenshot, Liste)
        │  Patrick gibt die Daten weiter (Chat, Datei)
        ▼
JSON-Eingabedatei  ~/.weich-db/eingaben/<datum>-<lieferant>.json
        │  node artikel-import.mjs <datei>            Trockenlauf, zeigt NEU / UPDATE / gleich
        │  node artikel-import.mjs <datei> --schreiben
        ▼
shop_artikel  (preis_netto, preis_stand, preis_quelle, lieferant_url, Kennzeichen)
        │  Trigger schreibt jede Preisaenderung nach shop_artikel_preise
        ▼
Sicht shop_pds_abgleich_offen  — Artikel, deren Shop-Preis neuer ist als der PDS-Stand
        │  Abgleich: /katalog/updatelieferanteneintrag mit dem Shop-Preis,
        │  danach pds_sync_at setzen
        ▼
PDS-Katalog auf Shop-Stand
```

## Was am Artikel steht (Migration 015)

| Spalte | Bedeutung |
|---|---|
| `preis_netto` | aktueller Einkaufspreis netto je Einheit |
| `preis_stand` | Datum, von dem der Preis stammt |
| `preis_quelle` | `frigotechnik-shop`, `saukalt`, `beleg`, `klimarechner`, `manuell`, `pds` |
| `lieferant_url` | Produktseite, aus der der Preis kommt |
| `shop_artikel_preise` | Historie: jede Aenderung mit Preis, Stand, Quelle, wer |

## Regeln

- **Nie einen Preis erfinden.** Ohne Quelle bleibt `preis_netto` leer. Der
  Klimarechner-Materialstamm ist eine Quelle (Kalkulationsgroessen, Stand
  04.08.2026), aber kein Bestellpreis — diese Artikel sind `bestellbar = false`.
- **Nicht doppeln.** Der Import ordnet zuerst ueber `pds_katalog_uuid`, dann
  ueber Lieferant + Bestellnummer, dann ueber den exakten Namen zu. Was es gibt,
  wird aktualisiert.
- **PDS-Bestand verknuepfen, nicht neu anlegen.** Artikel, die in PDS schon
  existieren (etwa NYM-J-Leitungen unter PV-Installationsmaterial), kommen mit
  ihrer `pds_katalog_uuid` in den Shop und gelten als `gesynct`.
- **Zwei Sichtbarkeiten** je Artikel (Migration 014): `bestellbar` fuer den
  Katalog, `nachkalkulation_klima` fuer Nachkalkulation, Aufmass und die
  Platzhalter-Ebene neuer Klima-Auftraege.

## Abgleich mit PDS

Die Sicht `shop_pds_abgleich_offen` listet alle Artikel mit PDS-UUID, deren
`preis_stand` juenger ist als `pds_sync_at`. Fuer jeden: Lieferanteneintrag in
PDS auf den Shop-Preis setzen (`/katalog/updatelieferanteneintrag`), dann
`pds_sync_at = now()`. Der Verkaufspreis in PDS folgt ueber die Kalkulations-
gruppe nicht automatisch (ADR 0005) — er braucht weiterhin das Musterangebot
oder die Pflege im Client.

## Werkzeuge

- `~/.weich-db/artikel-import.mjs` — Import mit Trockenlauf, Rolle `claude_shop`
  (kein DDL, kein Zugriff auf Geheimnisse).
- `~/.weich-db/eingaben/` — die Eingabedateien, eine je Tag und Lieferant, als
  Beleg dafuer, was wann woher kam.
- Beleg-Import im Shop (Admin → Beleg-Import) — fuer PDF-Rechnungen, macht
  Artikelkandidaten mit Bestellnummer und Preis.
- Link- und Screenshot-Erkennung im Artikel-Dialog — fuer einzelne Produktseiten.
