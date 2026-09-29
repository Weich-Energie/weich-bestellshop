-- Die Formteil-Platzhalter-Sicht entfernen (29.09.2026)
--
-- `shop_pds_formteil_platzhalter` war die Positionsliste fuer eine Ebene
-- "Formteile (Aufmass)" in neuen SHK-Auftraegen: 57 Kunstartikel mit Menge 0,
-- deren Mengen die Uebergabe dann im Auftrag setzt. Dieser Weg ist aufgegeben.
--
-- Patricks Entscheidung vom 29.09.2026: die Formteile gehoeren nicht in den
-- PDS-Artikelstamm. Er hat die 57 Katalogeintraege vom 07.09. im Client
-- geloescht. Das Aufmass kommt stattdessen als Sammelposition mit Freitext in
-- den Auftrag, die Aufschluesselung bleibt im Shop.
--
-- Sachlicher Grund, warum das nichts kostet: die Nachkalkulation braucht die
-- Artikel nicht. Das Soll in PDS hat gar keinen Materialkostenanteil
-- (docs/nachkalkulation-datenmodell.md, an einem echten Klima-Auftrag
-- verifiziert); der Ist-Materialeinsatz wird im Shop aus den erfassten Mengen
-- mal EK gerechnet.
--
-- Die Sicht ist ohnehin schon leer -- sie filtert auf
-- `pds_katalog_uuid is not null`, und keiner der 29 heutigen Kunstartikel hat
-- eine. Stehen lassen waere schlimmer als loeschen: sie liest sich wie eine
-- offene Aufgabe (die Doku adressierte sie an Megh).
--
-- Die Kunstartikel selbst bleiben unberuehrt. Sie tragen die Mischsatzpreise
-- und bewerten das Aufmass -- nur eben im Shop.

drop view if exists public.shop_pds_formteil_platzhalter;

-- Gegenstueck fuer Klima (shop_pds_montagematerial_platzhalter) bleibt: dort
-- sind es echte Artikel mit Lagerbezug, und ADR 0007 gilt unveraendert.
select table_name
  from information_schema.views
 where table_schema = 'public' and table_name like 'shop_pds_%platzhalter';
