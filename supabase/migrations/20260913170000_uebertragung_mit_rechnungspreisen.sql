-- Die übertragenen Edelstahl-Sätze mit Rechnungspreisen neu gerechnet.
--
-- Zwei Verbesserungen gegenüber der ersten Fassung von heute Vormittag:
--
-- 1. Preise kommen jetzt aus R+F-Rechnungen statt aus dem Lagerauszug. Die
--    35er Bögen fallen damit von 8,31 auf 7,70, der Bogen 90 I/I 28 von 4,52
--    auf 4,08.
-- 2. Das **Reduzierstück 35 x 28** (4,12 €) war im Lagerauszug nicht
--    enthalten. Deshalb musste der Satz für 35 mm+ Presse ohne die
--    Reduzierungen gerechnet und deren 8,9 % Anteil auf die übrigen Teilearten
--    verteilt werden. Jetzt ist der Artikel da und der C-Stahl-Mix geht
--    vollständig auf.
--
-- Ebenfalls neu im Katalog und in den Satz eingerechnet: T-Stück d = 28
-- (6,39 €) und Ü-Muffe IG/IG d = 22 (5,88 €).

update public.shop_formteil_gruppenpreis_uebertragen
   set ek_stueck = 4.1210,
       anzahl_artikel = 9,
       zusammensetzung = '[{"teileart":"Bogen","anteil":83.0,"preis":3.8250,"artikel":6},
                           {"teileart":"T-Stück","anteil":12.7,"preis":6.4000,"artikel":2},
                           {"teileart":"Reduzierung","anteil":4.2,"preis":3.0800,"artikel":1}]'::jsonb,
       begruendung = 'Preise aus R+F-Rechnungen vom 03. bis 11.09.2026, wo '
                   || 'vorhanden. Muffe ohne Anteil: in C-Stahl wurde in dieser '
                   || 'Groesse keine verbaut.',
       gueltig_ab = current_date
 where formteil_system = 'connect-inox' and dimensionsgruppe = '22-28mm'
   and preisklasse = 'presse';

update public.shop_formteil_gruppenpreis_uebertragen
   set ek_stueck = 6.4450,
       anzahl_artikel = 4,
       zusammensetzung = '[{"teileart":"Übergang","anteil":100.0,"preis":6.4450,"artikel":4}]'::jsonb,
       begruendung = 'Uebergangsstuecke AG 22 x R 1 (5,15), 28 x R 1 (6,92), '
                   || '28 x R 3/4 (7,83) und UE-Muffe IG/IG 22 x Rp 1/2 (5,88, '
                   || 'neu aus Rechnung). Anteil 100 % Uebergang aus C-Stahl '
                   || 'Gewinde. Die T-Stuecke mit Innengewinde bleiben ohne Gewicht.',
       gueltig_ab = current_date
 where formteil_system = 'connect-inox' and dimensionsgruppe = '22-28mm'
   and preisklasse = 'gewinde';

update public.shop_formteil_gruppenpreis_uebertragen
   set ek_stueck = 7.7022,
       anzahl_artikel = 8,
       zusammensetzung = '[{"teileart":"Bogen","anteil":72.4,"preis":7.8375,"artikel":4},
                           {"teileart":"T-Stück","anteil":15.2,"preis":9.9450,"artikel":2},
                           {"teileart":"Reduzierung","anteil":8.9,"preis":4.1200,"artikel":1},
                           {"teileart":"Muffe","anteil":3.4,"preis":4.1700,"artikel":1}]'::jsonb,
       begruendung = 'Der C-Stahl-Mix geht jetzt vollstaendig auf: das '
                   || 'Reduzierstueck 35 x 28 (4,12) kam ueber eine Rechnung '
                   || 'dazu und fehlte im Lagerauszug. Boegen und T-Stuecke mit '
                   || 'Rechnungspreisen.',
       gueltig_ab = current_date
 where formteil_system = 'connect-inox' and dimensionsgruppe = '35mm und groesser'
   and preisklasse = 'presse';

update public.shop_formteil_gruppenpreis_uebertragen
   set ek_stueck = 9.2700,
       anzahl_artikel = 2,
       zusammensetzung = '[{"teileart":"Übergang","anteil":100.0,"preis":9.2700,"artikel":2}]'::jsonb,
       begruendung = 'Uebergangsstueck AG 35 x R 1 (7,90 aus Rechnung) und '
                   || 'UE-Muffe IG/IG 35 x Rp 1 1/4 (10,64). Anteil 100 % '
                   || 'Uebergang aus C-Stahl Gewinde.',
       gueltig_ab = current_date
 where formteil_system = 'connect-inox' and dimensionsgruppe = '35mm und groesser'
   and preisklasse = 'gewinde';

-- Kunstartikel nachziehen, sie tragen den wirksamen Satz fuer die PDS-Uebergabe.
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
