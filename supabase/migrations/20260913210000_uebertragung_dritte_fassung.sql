-- Übertragene Edelstahl-Sätze, dritte Fassung — mit dem zweiten Rechnungssatz.
--
-- Geaendert haben sich nur die 35er Gruppen:
--   T-Stueck 35       10,31 -> 9,55  (Rechnung)
--   UE-Muffe IG/IG 35 neu  7,90      (eigener Artikel, andere Gewindegroesse
--                                     als die vorhandene zu 10,64)
-- Die 22-28er Saetze bleiben, weil sich dort nur das T-Stueck IG 28 geaendert
-- hat und das in der Gewindegruppe kein Gewicht traegt.

update public.shop_formteil_gruppenpreis_uebertragen
   set ek_stueck = 7.6443,
       zusammensetzung = '[{"teileart":"Bogen","anteil":72.4,"preis":7.8375,"artikel":4},
                           {"teileart":"T-Stück","anteil":15.2,"preis":9.5650,"artikel":2},
                           {"teileart":"Reduzierung","anteil":8.9,"preis":4.1200,"artikel":1},
                           {"teileart":"Muffe","anteil":3.4,"preis":4.1700,"artikel":1}]'::jsonb,
       begruendung = 'Alle Preise aus R+F-Rechnungen vom 31.07. bis 11.09.2026, '
                   || 'wo vorhanden. Der C-Stahl-Mix geht vollstaendig auf, seit '
                   || 'das Reduzierstueck 35 x 28 ueber eine Rechnung dazukam.',
       gueltig_ab = current_date
 where formteil_system = 'connect-inox' and dimensionsgruppe = '35mm und groesser'
   and preisklasse = 'presse';

update public.shop_formteil_gruppenpreis_uebertragen
   set ek_stueck = 8.8133,
       anzahl_artikel = 3,
       zusammensetzung = '[{"teileart":"Übergang","anteil":100.0,"preis":8.8133,"artikel":3}]'::jsonb,
       begruendung = 'Uebergangsstueck AG 35 x R 1 (7,90), UE-Muffe IG/IG 35 '
                   || '(7,90, neu aus Rechnung) und UE-Muffe IG/IG 35 x Rp 1 1/4 '
                   || '(10,64). Anteil 100 % Uebergang aus C-Stahl Gewinde.',
       gueltig_ab = current_date
 where formteil_system = 'connect-inox' and dimensionsgruppe = '35mm und groesser'
   and preisklasse = 'gewinde';

update public.shop_artikel a
   set preis_netto = e.ek_stueck_mengengewichtet
  from public.shop_formteil_gruppenpreis_effektiv e
 where a.formteil_dimensionsgruppe = e.dimensionsgruppe
   and a.formteil_preisklasse = e.preisklasse
   and a.name = 'Formteil ' || e.formteil_system || ' '
              || e.dimensionsgruppe || ' ' || e.preisklasse
   and a.preis_netto is distinct from e.ek_stueck_mengengewichtet;

select dimensionsgruppe, preisklasse, round(ek_stueck, 2) as satz, anzahl_artikel
  from public.shop_formteil_gruppenpreis_uebertragen
 order by dimensionsgruppe, preisklasse;
