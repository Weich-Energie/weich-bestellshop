# ADR 0007 — Montagematerial als Platzhalter im Auftrag, Mengen per API

Datum: 04.09.2026
Status: angenommen
Baut auf: ADR 0005 (Shop als Anlage-Kanal), ADR 0006 (Transportangebot)

## Kontext

Gewollt ist das verbaute Material **im Kundenauftrag**, ohne Handarbeit im
PDS-Client. ADR 0006 hat festgehalten, dass die Vorgangs-API an einen
bestehenden Auftrag keine Positionen anhängen kann, und ist beim
Transportangebot gelandet: Angebot anlegen, im Client kopieren, Angebot
löschen. Das funktioniert, ist aber pro Auftrag dreimal Client.

Zwei Befunde vom selben Tag ändern das Bild:

1. Die API kann die **Menge vorhandener Positionen** ändern
   (`/vorgang/updateposition`). Getestet an 2026-314: Menge 1 → 3, Gesamtpreis
   folgt; Menge 0 → 2 funktioniert ebenso.
2. Die PDS-Aufträge zu Klima-Projekten entstehen **bereits per API** aus dem
   Reonic-Projekt (Meghs Anlage), heute nur mit den Hauptkomponenten. Genau
   dort fehlt das Montagematerial, das die Monteure später notieren.

## Entscheidung

Neue Klima-Aufträge bekommen beim Anlegen eine Ebene
**„Montagematerial (Nachkalkulation)"** mit den üblichen C-Teilen als
Katalogpositionen mit **Menge 0**. Nach dem Bauen setzt der Bestellshop die
verbauten Mengen per `updateposition`. Im Client bleibt nur, was ohnehin
Handarbeit ist: Kundenpreise anpassen und, falls gewünscht, Nullzeilen löschen.

- **Welche Artikel Platzhalter sind, bestimmt der Shop.** Kennzeichen
  `pds_platzhalter` am Artikel, gesetzt von einem Admin. Die Sicht
  `shop_pds_montagematerial_platzhalter` liefert die Liste an die Anlage
  (Migration 014, docs/pds-montagematerial-platzhalter.md). Bewusst kein
  Automatismus über Kategorie: In „Klima" liegen auch Geräte.
- **Der Shop findet die Platzhalter über die Katalog-UUID**, nicht über die
  Ebenenbezeichnung. Gibt es denselben Artikel mehrfach, gewinnt die Position
  in einer Ebene, deren Name „Montagematerial" enthält.
- **Mengen werden addiert.** Neue Menge = Menge im Auftrag + erfasste, noch
  nicht übertragene Menge. Übertragene Shop-Positionen tragen
  `pds_transport_at` und gehen nie zweimal.
- **Geändert wird nur die Menge**, und nur an Positionen, deren Katalog-UUID
  zu einem Shop-Artikel gehört. Preise, Texte, Geräte, Leistungen: nie.
- **Das Transportangebot bleibt als Ausweichweg** für Material ohne Platzhalter
  und für Aufträge aus der Zeit vor der Ebene. Die Function bietet beide Wege
  aus derselben Vorschau an.

## Konsequenzen

- Function `pds-auftrag-material` ersetzt `pds-auftrag-transport`. Whitelist:
  `/vorgang/details`, `/vorgang/updateposition`, `/vorgang/create`.
- Meghs Auftragsanlage muss die Ebene mitgeben. Ohne sie fällt das Werkzeug
  automatisch auf das Transportangebot zurück und sagt das in der Vorschau.
- Ein Artikel, der neu über den Shop nach PDS kommt, ist erst ab dem
  **nächsten** angelegten Auftrag Platzhalter. Für laufende Aufträge bleibt
  das Transportangebot.
- Positionen mit Menge 0 stehen im Auftrag. Ob PDS sie im Druck unterdrückt,
  ist offen; sonst löscht sie der Client. Das ist der einzige Rest an
  Handarbeit dieses Wegs.
- Die Zeile „Kundenaufträge in PDS umschreiben" aus dem Projektziel ist damit
  bewusst aufgehoben, aber eng: Nur Mengen, nur Platzhalter, nur Shop-Artikel.

## Verworfene Alternativen

- **Nachtragsauftrag** — eigener Vorgang neben dem Auftrag (ADR 0006).
- **Nur Transportangebot** — dreimal Client pro Auftrag; bleibt Ausweichweg.
- **Auftragsvorlage im Client statt Anlage per API** — unnötig, weil die
  Anlage bereits per API läuft; die Liste käme dann nicht aus dem Shop.
- **Ein Sammel-Platzhalter „Montagematerial" mit Menge in Euro** — wäre ein
  Zahlenhack ohne Artikelbezug; die Nachkalkulation will wissen, *was* verbaut
  wurde.
