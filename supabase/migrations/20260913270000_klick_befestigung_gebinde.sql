-- Die drei KLICK-Befestigungsartikel sind ebenfalls Gebinde.
--
-- Patrick bestaetigt es, und diesmal habe ich die Gebindegroesse nicht
-- angenommen, sondern ausgerechnet. GUT liefert den Stueckpreis je Gebinde und
-- den Positionswert je Stueck; ihr Verhaeltnis ist die Gebindegroesse:
--
--   CCLGMV830   17,49 / 0,1749 = 100,0   Gewindemuffe KLICK M8x30
--   CCLSTS8100  22,82 / 0,2282 = 100,0   Stockschraube KLICK M8x100
--   CCLSTS8120  25,09 / 0,2509 = 100,0   Stockschraube KLICK M8x120
--
-- Glatt 100,0 bei allen dreien — das ist keine Naeherung.
-- Nur ek_netto_stueck wird geteilt; ek_netto_gesamt war schon richtig.

update public.shop_gut_positionen
   set ek_netto_stueck_original = ek_netto_stueck,
       gebindegroesse = 100,
       ek_netto_stueck = round(ek_netto_stueck / 100.0, 4)
 where artikelnummer in ('CCLSTS8120', 'CCLSTS8100', 'CCLGMV830')
   and gebindegroesse is null;

select artikelnummer, round(avg(ek_netto_stueck_original), 2) as vorher,
       round(avg(ek_netto_stueck), 4) as jetzt,
       round(avg(rf_ek_netto_stueck), 2) as rf
  from public.shop_gut_positionen
 where gebindegroesse = 100
 group by artikelnummer order by 1;
