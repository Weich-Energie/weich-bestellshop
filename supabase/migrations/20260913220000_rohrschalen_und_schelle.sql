-- Vier weitere Zähllisten-Artikel zugeordnet.
--
-- Die Rohrschalen folgen einem festen Nummernschema: 1005520 + Rohrdurchmesser
-- dreistellig + Daemmdicke dreistellig. Damit ist die Zuordnung eindeutig, sie
-- ist nicht geraten. Drei davon belegen Rechnungen, die vierte (22/20) ist im
-- Shop nachgeschlagen — dort gibt es keine Rechnung.
--
--   RORS8001820  Rohrschale 18/20  -> 1005520018020   3,34 EUR  (Rechnung)
--   RORS8002220  Rohrschale 22/20  -> 1005520022020   3,75 EUR  (Shop)
--   RORS8002820  Rohrschale 28/20  -> 1005520028020   3,71 EUR  (Rechnung)
--   SCHLSCH1625  Schlauchschelle 16-25 -> 1016735100000  0,35 EUR  (Rechnung)
--
-- Die Schlauchschelle stand schon im Katalog, nur die Verknuepfung zum
-- GUT-Artikel fehlte.

update public.shop_gut_positionen
   set rf_artikelnummer = '1005520018020', rf_ek_netto_stueck = 3.34,
       rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
 where artikelnummer = 'RORS8001820' and rf_artikelnummer is null;

update public.shop_gut_positionen
   set rf_artikelnummer = '1005520022020', rf_ek_netto_stueck = 3.75,
       rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
 where artikelnummer = 'RORS8002220' and rf_artikelnummer is null;

update public.shop_gut_positionen
   set rf_artikelnummer = '1005520028020', rf_ek_netto_stueck = 3.71,
       rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
 where artikelnummer = 'RORS8002820' and rf_artikelnummer is null;

update public.shop_gut_positionen
   set rf_artikelnummer = '1016735100000', rf_ek_netto_stueck = 0.35,
       rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
 where artikelnummer = 'SCHLSCH1625' and rf_artikelnummer is null;

-- Rohrschale 22/20 im Katalog anlegen, sie fehlte dort noch.
insert into public.shop_artikel
  (artikelnr, name, kategorie_id, lieferant, einheit, preis_netto,
   aktiv, bestellbar, sichtbar_aufmass)
select '1005520022020',
       'Rockwool Heizungsrohrschale 800 für Rohr 22 mm, Dämmdicke 20 mm',
       'a82bfe28-e672-4979-88f0-f8e977fb9f6b'::uuid, 'R+F', 'Meter', 3.75,
       true, false, true
 where not exists (select 1 from public.shop_artikel where artikelnr = '1005520022020');

select p.artikelnummer, max(p.rf_artikelnummer) as rf_nr,
       round(avg(p.rf_ek_netto_stueck), 2) as ek, round(sum(p.menge)) as menge
  from public.shop_gut_positionen p
 where p.artikelnummer in ('RORS8001820','RORS8002220','RORS8002820','SCHLSCH1625')
 group by p.artikelnummer order by 1;
