-- Zwei offene Zuordnungen aus den Rechnungen geschlossen.
--
-- Von den 33 Zähllisten-Artikeln ohne R+F-Entsprechung passen zwei eindeutig
-- auf einen Artikel der Rechnungen — eindeutig heißt: Produktname und
-- Dimension stimmen beide.
--
--   UPRPL2550   Uni Pipe PLUS 25 x 2,50 mm -> 1029201059574   5,28 EUR/m
--   UPRPL20100  Uni Pipe PLUS 20 x 2,25 mm -> 1029201059573   3,61 EUR/m
--
-- Nicht übernommen, obwohl die Textsuche sie vorschlug:
--   UPRPL16100    16 x 2,0 mm — in den Rechnungen gibt es kein 16er Rohr.
--   UCPA2015N     Übergangs*nippel* 20 x 1/2" — die Rechnung hat eine
--                 Übergangs*muffe*, das ist ein anderes Teil.
--   UCPTR202016N  T-Stück 20 x 20 x 16 — die Rechnung hat 25 x 20 x 25.
-- Genau solche Beinahe-Treffer haben die alten `vermutet`-Zuordnungen
-- produziert; sie bleiben offen, bis eine Rechnung sie wirklich belegt.

update public.shop_gut_positionen
   set rf_artikelnummer = '1029201059574',
       rf_ek_netto_stueck = 5.28,
       rf_zuordnung_quelle = 'manuell',
       rf_zuordnung_stand = now()
 where artikelnummer = 'UPRPL2550' and rf_artikelnummer is null;

update public.shop_gut_positionen
   set rf_artikelnummer = '1029201059573',
       rf_ek_netto_stueck = 3.61,
       rf_zuordnung_quelle = 'manuell',
       rf_zuordnung_stand = now()
 where artikelnummer = 'UPRPL20100' and rf_artikelnummer is null;

select p.artikelnummer,
       regexp_replace(left(max(p.beschreibung1), 40), '[[:space:]]+', ' ', 'g') as text,
       max(p.rf_artikelnummer) as rf_nr,
       round(avg(p.rf_ek_netto_stueck), 2) as ek,
       round(sum(p.menge)) as menge
  from public.shop_gut_positionen p
 where p.artikelnummer in ('UPRPL2550', 'UPRPL20100')
 group by p.artikelnummer;
