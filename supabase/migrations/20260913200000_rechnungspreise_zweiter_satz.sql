-- Preise und Artikel aus dem zweiten Rechnungssatz übernehmen.
--
-- Die groessten Korrekturen treffen Rubrikzeilen, gehen also direkt in die
-- Bewertung eines Aufmasses:
--   Rueckflussverhinderer DN 25   22,52 -> 17,59   (-22 %)
--   Rueckflussverhinderer DN 20   17,68 -> 13,91   (-21 %)
--   Rohrverschraubung RG R 1/2    10,75 ->  9,82
--   Luftstopfen G 1/2              1,64 ->  1,48
--
-- Neu im Katalog unter anderem das OptiSteel-Systemrohr 35 x 1,5 (6,40 EUR/m)
-- und drei Rohrschalen mit echten Preisen — die 35/30 kostet laut Rechnung
-- 5,99 statt der 6,39, die ich gestern aus dem Shop genommen hatte.
--
-- Nicht ueberschrieben: die UE-Muffe IG/IG 35 der Rechnung (7085473353000,
-- 7,90) ist ein anderer Artikel als die im Katalog (7085473354000, 10,64) —
-- andere Gewindegroesse. Sie kommt als eigener Artikel dazu.

update public.shop_artikel a
   set preis_netto = r.ek_stueck
  from public.shop_rf_rechnungspreis r
 where a.artikelnr = r.artikelnr
   and a.preis_netto is distinct from r.ek_stueck;

-- Geraete und Pumpen gehoeren nicht auf die Strichliste.
insert into public.shop_artikel
  (artikelnr, name, kategorie_id, lieferant, einheit, preis_netto,
   aktiv, bestellbar, sichtbar_aufmass)
select r.artikelnr, r.bezeichnung,
       'a82bfe28-e672-4979-88f0-f8e977fb9f6b'::uuid, 'R+F',
       case when r.einheit = 'M' then 'Meter' else 'Stück' end,
       r.ek_stueck, true, false,
       r.bezeichnung !~* '(pumpe|gefäss|gefaess|rückspülfilter|rueckspuelfilter)'
  from public.shop_rf_rechnungspreis r
 where not exists (select 1 from public.shop_artikel a where a.artikelnr = r.artikelnr);

-- Rohrschale 35/30: Rechnungspreis schlaegt den Shop-Preis von gestern.
update public.shop_gut_positionen
   set rf_ek_netto_stueck = 5.99, rf_zuordnung_stand = now()
 where artikelnummer = 'RORS8003530' and rf_artikelnummer = '1005520035030';

select count(*) filter (where sichtbar_aufmass) as im_aufmass, count(*) as gesamt
  from public.shop_artikel
 where artikelnr in (select artikelnr from public.shop_rf_rechnungspreis);
