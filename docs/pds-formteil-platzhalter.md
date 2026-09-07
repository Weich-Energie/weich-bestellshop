# Platzhalter-Ebene „Formteile (Aufmaß)" für SHK-Aufträge

Stand 08.09.2026. Gegenstück zu
[pds-montagematerial-platzhalter.md](pds-montagematerial-platzhalter.md)
(Klima, ADR 0007), gerichtet an den, der SHK-Aufträge anlegt (Megh / Vorlage
im PDS-Client).

## Warum

Die Aufmaß-App übergibt Formteil-Mengen in den PDS-Auftrag
(`aufmass-pds-uebergabe`). Die Vorgangs-API kann an einen bestehenden Auftrag
**keine Positionen anhängen**, nur Mengen vorhandener Positionen ändern.
Ohne Platzhalter geht die Übergabe deshalb den Umweg Transportangebot bei der
Weich GmbH, das im Client in den Auftrag kopiert und gelöscht werden muss
(ADR 0006) — so lief der erste Testlauf (Angebot 2026-292 zu Auftrag
2025-10348). Mit Platzhaltern setzt die Function die Mengen direkt
(`mengen_setzen`), ohne Nacharbeit.

## Was in die Ebene gehört

Eine eigene Ebene im Leistungsverzeichnis, Bezeichnung **„Formteile
(Aufmaß)"**, mit allen Formteil-Kunstartikeln als Positionen, **Menge 0**:

- Quelle: Sicht `shop_pds_formteil_platzhalter` (57 Zeilen, Katalog-UUID,
  Name, Artikelnummer `FORMTEIL-…`, System, Dimension, EK).
- Positionstyp ARTIKEL, `katalogUUID` aus der Sicht, Menge 0, Preise wie im
  Katalog (VK = EK, keine Aufschlagsklasse gesetzt — ggf. vorher am
  Kunstartikel pflegen und per `pds-katalog-sync`/`updatelieferanteneintrag`
  nachziehen).
- Die Function erkennt Platzhalter an der Katalog-UUID; die Ebene wird
  bevorzugt, wenn ihr Name „Formteil" oder „Montagematerial" enthält.

Positionen, die nach der Übergabe auf Menge 0 bleiben, im Client löschen,
wenn sie im Dokument stören — dieselbe Regel wie bei Klima.

## Wo die Function steht

`weich-bestellshop/supabase/functions/aufmass-pds-uebergabe/index.ts`,
Bauplan und Testlauf in [aufmass-pds-uebergabe-plan.md](aufmass-pds-uebergabe-plan.md).
Rohrmeter sind noch nicht Teil der Übergabe (Zielartikel offen), Einzelartikel
sind im MVP Freitext ohne Katalogbezug.
