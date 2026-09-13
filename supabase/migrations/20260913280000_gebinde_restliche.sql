-- Die letzten beiden Gebinde-Artikel, gefunden statt geraten.
--
-- Mit der Rechenregel "Stueckpreis geteilt durch Positionswert je Stueck" laesst
-- sich die Gebindegroesse aus den Daten selbst ableiten. Ein Durchlauf ueber
-- den ganzen Bestand findet genau noch zwei Artikel mit einem Verhaeltnis ueber
-- 1,5 — beide bei glatt 100:
--
--   CCWFRS160  Wickelfalzrohrschelle KLICK   210,42 / 2,1033 = 100,04
--   CCLR18     Rohrschelle KLICK 16-18mm      45,36 / 0,4540 =  99,91
--
-- Damit sind alle Gebinde-Artikel erfasst: zwoelf Stueck, alle aus der
-- CONEL/KLICK-Familie plus die beiden Trinkwasser-Dichtungen.

update public.shop_gut_positionen
   set ek_netto_stueck_original = ek_netto_stueck,
       gebindegroesse = 100,
       ek_netto_stueck = round(ek_netto_stueck / 100.0, 4)
 where artikelnummer in ('CCWFRS160', 'CCLR18')
   and gebindegroesse is null;

select count(distinct artikelnummer) as gebinde_artikel,
       round(sum(ek_netto_stueck_original * menge)::numeric, 0) as waere_falsch,
       round(sum(ek_netto_gesamt)::numeric, 0) as ist_richtig
  from public.shop_gut_positionen where gebindegroesse = 100;
