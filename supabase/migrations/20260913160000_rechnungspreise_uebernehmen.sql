-- Rechnungspreise in den Artikelstamm übernehmen.
--
-- Rangfolge der Preisquellen ab jetzt: Rechnung vor Lagerauszug vor Shop.
-- Eine Rechnung nennt den tatsaechlich bezahlten Preis; der Lagerauszug traegt
-- Standardpreise. Der Unterschied ist meist klein (1-3 %), an einzelnen
-- Stellen aber erheblich:
--
--   WESA-Kugelhahn 1" x 1"        17,57 -> 13,00   (-26 %)
--   Schlauchschelle W2 16-25       0,81 ->  0,35   (-57 %)
--   Verschlusskappe Kupfer 18 mm   5,97 ->  5,15   (-14 %)
--   OptiSteel Bogen 90 I/I 28      4,52 ->  4,08   (-10 %)
--   OptiSteel Boegen 35 mm         8,31 ->  7,70    (-7 %)
--
-- Der WESA-Kugelhahn steht als eigene Zeile in der Rubrik "Ventile &
-- Absperrung" — sein Preis geht also direkt in die Bewertung eines Aufmasses.

-- ─── Preise der vorhandenen Artikel nachziehen ────────────────────────────
update public.shop_artikel a
   set preis_netto = r.ek_stueck
  from public.shop_rf_rechnungspreis r
 where a.artikelnr = r.artikelnr
   and a.preis_netto is distinct from r.ek_stueck;

-- ─── Artikel anlegen, die es im Stamm noch nicht gibt ─────────────────────
-- Zwoelf Stueck, darunter drei OptiSteel-Formteile, die im Lagerauszug fehlten:
-- T-Stueck 28, UE-Muffe 22 und das Reduzierstueck 35 x 28. Letzteres schliesst
-- eine Luecke im uebertragenen Mischsatz — dort musste die Reduzierung bisher
-- mangels Artikel weggelassen werden.
--
-- sichtbar_aufmass bleibt bei den beiden Pumpen aus: Geraete gehoeren nicht auf
-- die Strichliste. Alles andere ist Baustellenmaterial.
insert into public.shop_artikel
  (artikelnr, name, kategorie_id, lieferant, einheit, preis_netto,
   aktiv, bestellbar, sichtbar_aufmass)
select r.artikelnr,
       r.bezeichnung,
       'a82bfe28-e672-4979-88f0-f8e977fb9f6b'::uuid,
       'R+F',
       case when r.einheit = 'M' then 'Meter' else 'Stück' end,
       r.ek_stueck,
       true,
       false,
       r.artikelnr not in ('7039104301000', '7078198100000')
  from public.shop_rf_rechnungspreis r
 where not exists (select 1 from public.shop_artikel a where a.artikelnr = r.artikelnr);

select count(*) filter (where sichtbar_aufmass) as im_aufmass,
       count(*) as gesamt
  from public.shop_artikel
 where artikelnr in (select artikelnr from public.shop_rf_rechnungspreis);
