-- Kunstartikel-Preise auf den wirksamen Mischsatz nachziehen.
--
-- Durch die Nummernaufloesung haben sich viele Saetze geaendert, und die Gruppe
-- prestabo-stahl / 35mm und groesser / gewinde hat wieder einen: sie war leer,
-- seit die falsche Megapress-Zuordnung zurueckgenommen wurde. Die Nummernsuche
-- hat die echten Prestabo-Uebergangsstuecke gefunden — fuenf Artikel, 551
-- Stueck, 8,60 EUR. Der alte, falsche Satz lag bei 25,65 EUR.
--
-- shop_pds_formteil_gruppen liest den Preis vom Artikel, nicht aus der Sicht.

update public.shop_artikel a
   set preis_netto = e.ek_stueck_mengengewichtet
  from public.shop_formteil_gruppenpreis_effektiv e
 where a.formteil_dimensionsgruppe = e.dimensionsgruppe
   and a.formteil_preisklasse = e.preisklasse
   and a.name = 'Formteil ' || e.formteil_system || ' '
              || e.dimensionsgruppe || ' ' || e.preisklasse
   and a.preis_netto is distinct from e.ek_stueck_mengengewichtet;

select count(*) filter (where preis_netto is not null) as mit_preis,
       count(*) as kunstartikel
  from public.shop_artikel where formteil_dimensionsgruppe is not null;
