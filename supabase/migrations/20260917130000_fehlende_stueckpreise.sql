-- Fehlende Stueckpreise an den Positionen nachtragen (17.09.2026)
--
-- Vier zugeordnete Positionen mit 1 715 EUR Verbrauch hatten kein
-- rf_ek_netto_stueck und fielen damit aus jeder Bewertung -- darunter POVT35
-- mit 1 655 EUR auf 148 Stueck. Der Grund ist ein Reihenfolgefehler in
-- Migration 20260915170000: dort setzte Schritt 3 die Preise per Subselect,
-- die drei Prestabo-Artikel wurden aber erst in Schritt 4 angelegt. Der
-- Subselect fand sie nicht und schrieb NULL.
--
-- Deshalb hier nicht nur die vier Faelle, sondern die Regel: wo eine Position
-- eine Zuordnung hat und der Katalog einen Preis kennt, wird er uebernommen.
-- Bestehende Stueckpreise bleiben unangetastet -- sie stammen aus dem
-- Lagerauszug oder aus Rechnungen und sind besser als ein Shop-Listenpreis.

update public.shop_gut_positionen p
   set rf_ek_netto_stueck = a.preis_netto
  from public.shop_artikel a
 where a.artikelnr = p.rf_artikelnummer
   and p.rf_artikelnummer is not null
   and p.rf_ek_netto_stueck is null
   and a.preis_netto is not null;

-- Kontrolle: bleibt etwas ohne Preis, fehlt der Artikel im Katalog.
select p.artikelnummer, p.rf_artikelnummer,
       round(sum(p.ek_netto_gesamt), 2) as verbrauch
  from public.shop_gut_positionen p
 where p.rf_artikelnummer is not null and p.rf_ek_netto_stueck is null
 group by 1, 2 order by 3 desc nulls last;
