# Platzhalter-Ebene „Formteile (Aufmaß)" für SHK-Aufträge

Stand 10.09.2026. Gegenstück zu
[pds-montagematerial-platzhalter.md](pds-montagematerial-platzhalter.md)
(Klima, ADR 0007), gerichtet an den, der SHK-Aufträge anlegt (Megh / Vorlage
im PDS-Client).

> **Geändert am 10.09.2026:** Die früheren 57 Kunstartikel je Einzeldimension
> („Formteil b-press-kupfer 35mm×1"AG") sind gelöscht — Patrick hat sie im
> PDS-Client entfernt, danach sind sie aus dem Shop verschwunden. An ihre
> Stelle treten **29 Artikel je Zeile der Strichliste**. Hintergrund:
> [strichliste-zuschnitt.md](strichliste-zuschnitt.md).

## Warum

Die Aufmaß-App übergibt Formteil-Mengen in den PDS-Auftrag
(`aufmass-pds-uebergabe`). Die Vorgangs-API kann an einen bestehenden Auftrag
**keine Positionen anhängen**, nur Mengen vorhandener Positionen ändern.
Ohne Platzhalter geht die Übergabe deshalb den Umweg Transportangebot bei der
Weich GmbH, das im Client in den Auftrag kopiert und gelöscht werden muss
(ADR 0006). Mit Platzhaltern setzt die Function die Mengen direkt
(`mengen_setzen`), ohne Nacharbeit.

## Was in die Ebene gehört

Eine eigene Ebene im Leistungsverzeichnis, Bezeichnung **„Formteile
(Aufmaß)"**, mit allen Formteil-Kunstartikeln als Positionen, **Menge 0**:

- Quelle: Sicht `shop_pds_formteil_platzhalter` (29 Zeilen: Katalog-UUID,
  Name, Artikelnummer `FORMTEIL-G-…`, System, Dimensionsgruppe, Preisklasse,
  EK).
- Positionstyp ARTIKEL, `katalogUUID` aus der Sicht, Menge 0, Preise wie im
  Katalog (VK = EK, keine Aufschlagsklasse gesetzt).
- Die Function erkennt Platzhalter an der Katalog-UUID; die Ebene wird
  bevorzugt, wenn ihr Name „Formteil" oder „Montagematerial" enthält.

Der Zuschnitt ist eine Zeile je **Materialsystem × Rohrdimensionsgruppe ×
Presse/Gewinde**. Bei den Gewindesystemen (Rotguss, Gewinde schwarz) gibt es
nur „Gewinde" — dort wird nichts gepresst.

| System | Gruppen | Klassen |
|---|---|---|
| Heizungsedelstahl | 22-28mm, 35mm+ | Presse, Gewinde |
| Uponor MLC | 16-20mm, 25-32mm | Presse, Gewinde |
| Rotguss / Gewinde | bis 3/4", 1"+ | nur Gewinde |
| Gewinde schwarz | bis 3/4", 1"+ | nur Gewinde |
| Kupfer Profipress | bis 18mm, 22-28mm, 35mm+ | Presse, Gewinde |
| C-Stahl Prestabo | 22-28mm, 35mm+ | Presse, Gewinde |
| Megapress, MaxiPro, Sonstige | je 1–2 | gemischt |

Positionen, die nach der Übergabe auf Menge 0 bleiben, im Client löschen,
wenn sie im Dokument stören — dieselbe Regel wie bei Klima.

## Reihenfolge

1. **Katalog-Sync**: Die 29 Artikel stehen noch **nicht** in PDS
   (`pds_katalog_uuid is null`). Erst `pds-katalog-sync` mit `dry_run: false`
   legt sie an; das wartet auf Patricks Freigabe, weil Katalogeinträge in PDS
   normalerweise nicht per API löschbar sind.
2. **Dann** kann die Platzhalter-Ebene in der Auftragsvorlage angelegt werden.
   Vorher gibt es keine Katalog-UUIDs zum Verweisen.

## Wo die Function steht

`weich-bestellshop/supabase/functions/aufmass-pds-uebergabe/index.ts`,
Bauplan und Testlauf in [aufmass-pds-uebergabe-plan.md](aufmass-pds-uebergabe-plan.md).
Sie sucht den Kunstartikel zuerst über System + Dimensionsgruppe +
Preisklasse und fällt für Erfassungen von vor dem 09.09.2026 auf die feine
Dimension zurück — nach dem Löschen der alten Artikel greift dieser Rückfall
allerdings ins Leere, und es gibt auch keine solchen Erfassungen mehr.

Rohrmeter sind noch nicht Teil der Übergabe (Zielartikel offen), Einzelartikel
sind Freitext ohne Katalogbezug.
