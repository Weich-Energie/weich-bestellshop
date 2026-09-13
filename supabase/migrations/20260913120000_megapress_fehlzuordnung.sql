-- Falsche Zuordnung ueber Systemgrenzen hinweg zuruecknehmen.
--
-- Die Textsuche hat drei Prestabo-Uebergangsstuecken ein MEGAPRESS-T-STUECK
-- zugewiesen (R+F 1017314020200, 25,65 EUR). Megapress ist ein anderes System
-- und ein T-Stueck ist kein Uebergangsstueck — die Zuordnung ist objektiv
-- falsch, nicht nur unsicher.
--
--   POVUS3525A  Prestabo-Uebergangsstueck 35mm x 1" AG   400 Stueck
--   POVUS3525I  Prestabo-Uebergangsstueck 35mm x 1" IG    39 Stueck
--   POVUS2825I  Prestabo-Uebergangsstueck 28mm x 1" IG     5 Stueck
--
-- Wirkung: 444 Stueck trugen 25,65 EUR, zusammen 11 389 EUR. Zum Vergleich
-- kostet das 28er Prestabo-Uebergangsstueck im Regal 6,35 EUR. Die Gruppe
-- prestabo-stahl / 35mm und groesser / gewinde bestand ausschliesslich aus
-- diesen beiden Artikeln — sie verliert damit ihren Satz. Das ist richtig so:
-- lieber kein Satz als ein um das Vierfache zu hoher.
--
-- Im Regal gibt es kein 35er Prestabo-Uebergangsstueck, ein Ersatzpreis laesst
-- sich also nicht sauber herleiten. Patrick entscheidet, ob die Gruppe einen
-- uebertragenen Satz bekommt; C-Stahl ist ohnehin abgeloest und die Rubrik in
-- der Aufmass-App bereits ausgeblendet.

update public.shop_gut_positionen
   set rf_artikelnummer = null,
       rf_ek_netto_stueck = null,
       rf_zuordnung_quelle = null,
       rf_zuordnung_stand = now()
 where artikelnummer in ('POVUS3525A', 'POVUS3525I', 'POVUS2825I')
   and rf_artikelnummer = '1017314020200';

-- Der Kunstartikel darf keinen Preis mehr tragen, den es nicht mehr gibt.
-- shop_pds_formteil_gruppen liest ihn fuer die PDS-Uebergabe.
update public.shop_artikel
   set preis_netto = null
 where name = 'Formteil prestabo-stahl 35mm und groesser gewinde'
   and not exists (
     select 1 from public.shop_formteil_gruppenpreis_effektiv e
      where e.formteil_system = 'prestabo-stahl'
        and e.dimensionsgruppe = '35mm und groesser'
        and e.preisklasse = 'gewinde'
        and e.ek_stueck_mengengewichtet is not null
   );

select formteil_system, dimensionsgruppe, preisklasse,
       anzahl_artikel, round(menge_gesamt) as menge,
       round(ek_stueck_mengengewichtet, 2) as satz
  from public.shop_formteil_gruppenpreis_effektiv
 where formteil_system = 'prestabo-stahl'
 order by dimensionsgruppe, preisklasse;
