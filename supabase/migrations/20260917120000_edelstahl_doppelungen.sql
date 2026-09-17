-- Die Edelstahl-Doppelungen trennen (17.09.2026)
--
-- Fuer die CONNECT-INOX-Artikel hat die Nummernsuche nichts gefunden: R+F hat
-- die CONEL-Nummern nicht als Wettbewerbsnummern hinterlegt. Die Gegenstuecke
-- stehen aber im Ausfuehrungs-Reiter derselben Produktseite -- der Weg aus
-- docs/lieferanten-shop-zugaenge.md, weil R+F Dimensionen als Ausfuehrungen
-- eines Produkts fuehrt und nicht als eigene Produkte.
--
--   COCIB22ELKNL   -> 7085907220000  Bogen 22mm 90 Grad m. eins. Einschublaenge -> Bogen 90 I/A d = 22
--   COCIB35ELNL    -> 7085907350000  Bogen 35mm 90 Grad m. eins. Einschublaenge -> Bogen 90 I/A d = 35
--   COCIUS2820ANL  -> 7085972282000  Uebergangsstueck 28 x 3/4" AG -> AG, d = 28 x R 3/4
--   COCIUS2832ANL  -> 7085972284000  Uebergangsstueck 28 x 1 1/4" AG -> AG, d = 28 x R 11/4
--   COCIRS3522NL   -> 7085941352000  Reduzierstueck 35x22mm -> Reduzierstueck d = 35 x 22
--
-- NICHT gefunden: der Bogen 45 I/A (COCIB2245ELKNL 22 mm, COCIB3545ELNL
-- 35 mm). Die OptiSteel-Reihe fuehrt 45-Grad-Boegen nur als I/I; die geratenen
-- Nummern 7085927* gibt es nicht, und eine Textsuche liefert 381 Treffer.
-- Beide bleiben auf dem I/I-Bogen und damit als Doppelzeile stehen -- Patrick
-- muss sagen, ob es die Ausfuehrung ueberhaupt gibt.

with neu(artikelnr, name, preis, bild) as (values
  ('7085907220000', 'OptiSteel simplesta SH M Bogen 90 I/A d = 22', 3.25, 'https://prd-cc.rf24.de/medias/5d7c07100175b34578bbad9decaa3f26.jpg?context=bWFzdGVyfGltYWdlc3wyMTA2NHxpbWFnZS9qcGVnfGFEQTNMMmc1TUM4NU56VTNPVEF5T1RJNU9UVXdMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDBKdloyVnVYemt3WDBrdFFWODRNREF1YW5CbnxmNDcwZDU4NzU4OGRiNTBhYmE5MThlNWM4MWJlZDBhNzcyNmNiNmZjMDdmOTkyNjUzZDU1MzBjZGVmM2YzOWFj'),
  ('7085907350000', 'OptiSteel simplesta SH M Bogen 90 I/A d = 35', 7.89, 'https://prd-cc.rf24.de/medias/5d7c07100175b34578bbad9decaa3f26.jpg?context=bWFzdGVyfGltYWdlc3wyMTA2NHxpbWFnZS9qcGVnfGFEQTNMMmc1TUM4NU56VTNPVEF5T1RJNU9UVXdMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDBKdloyVnVYemt3WDBrdFFWODRNREF1YW5CbnxmNDcwZDU4NzU4OGRiNTBhYmE5MThlNWM4MWJlZDBhNzcyNmNiNmZjMDdmOTkyNjUzZDU1MzBjZGVmM2YzOWFj'),
  ('7085972282000', 'OptiSteel simplesta SH M Übergangsstück AG, d = 28 x R 3/4', 7.38, 'https://prd-cc.rf24.de/medias/11285befcd70a802c680b4971115407b.jpg?context=bWFzdGVyfGltYWdlc3wyNzAwNHxpbWFnZS9qcGVnfGFHSTFMMmc1Wmk4NU56VTNPVEEwT0RNd05EazBMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOemRIVmxZMnRmUVVkZk9EQXdMbXB3Wnd8MGYwZGEyODJmYmUwNDQxNDI2YzI5ZmIzYTNkZDk3YWM3NjA2ZTcyNTE5M2UxMTNiZWNiNzVkYmIxN2FhMDdlYg'),
  ('7085972284000', 'OptiSteel simplesta SH M Übergangsstück AG, d = 28 x R 11/4', 7.93, 'https://prd-cc.rf24.de/medias/11285befcd70a802c680b4971115407b.jpg?context=bWFzdGVyfGltYWdlc3wyNzAwNHxpbWFnZS9qcGVnfGFHSTFMMmc1Wmk4NU56VTNPVEEwT0RNd05EazBMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOemRIVmxZMnRmUVVkZk9EQXdMbXB3Wnd8MGYwZGEyODJmYmUwNDQxNDI2YzI5ZmIzYTNkZDk3YWM3NjA2ZTcyNTE5M2UxMTNiZWNiNzVkYmIxN2FhMDdlYg'),
  ('7085941352000', 'OptiSteel simplesta SH M Reduzierstück d = 35 x 22', 5.55, 'https://prd-cc.rf24.de/medias/76ae13460ad612e8f560f3b657f9e471.jpg?context=bWFzdGVyfGltYWdlc3wyNzg4MXxpbWFnZS9qcGVnfGFHVmxMMmc0TkM4NU56Y3lPREU0T1RVMk16RTRMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFKbFpIVjZhV1Z5TFZOMGRXVmphMTg0TURBdWFuQm58MGRmYjJiOWVkNTMwYzBjOGY1MWY2ZWYxODZhNzM1NTE3MTNiZGE5Mzc4OTU4YjU3Nzc0MGFmY2IzZjcyMmFmMA')
)
insert into public.shop_artikel
  (artikelnr, name, preis_netto, preis_quelle, preis_stand, bild_url,
   bild_ist_extern, lieferant, einheit, aktiv, sichtbar_aufmass, bestellbar)
select n.artikelnr, n.name, n.preis, 'r-f-shop', now(), n.bild,
       n.bild is not null, 'R+F', 'Stk', true, true, false
  from neu n
 where not exists (select 1 from public.shop_artikel s where s.artikelnr = n.artikelnr);

with zuordnung(gut_nr, rf_nr) as (values
  ('COCIB22ELKNL', '7085907220000'),
  ('COCIB35ELNL', '7085907350000'),
  ('COCIUS2820ANL', '7085972282000'),
  ('COCIUS2832ANL', '7085972284000'),
  ('COCIRS3522NL', '7085941352000')
)
insert into public.shop_gut_rf_zuordnung
  (gut_artikelnummer, rf_artikelnummer, entscheidung, bemerkung)
select z.gut_nr, z.rf_nr, 'zugeordnet',
       'Ueber den Ausfuehrungs-Reiter belegt, Doppelzeile getrennt (17.09.2026)'
  from zuordnung z
on conflict (gut_artikelnummer) do update
   set rf_artikelnummer = excluded.rf_artikelnummer,
       bemerkung = excluded.bemerkung, stand = now();

with zuordnung(gut_nr, rf_nr) as (values
  ('COCIB22ELKNL', '7085907220000'),
  ('COCIB35ELNL', '7085907350000'),
  ('COCIUS2820ANL', '7085972282000'),
  ('COCIUS2832ANL', '7085972284000'),
  ('COCIRS3522NL', '7085941352000')
)
update public.shop_gut_positionen p
   set rf_artikelnummer = z.rf_nr,
       rf_ek_netto_stueck =
         (select s.preis_netto from public.shop_artikel s where s.artikelnr = z.rf_nr),
       rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
  from zuordnung z
 where p.artikelnummer = z.gut_nr;

-- Die Zeilen der Zaehlliste mitnehmen -- moeglich, seit sie ihre Herkunft
-- kennen (Migration 20260917110000 im Repo weich-aufmass).
with soll as (
  select p.id, a.id as neu
    from public.aufmass_kategorie_position p
    join public.aufmass_kategorie k on k.id = p.kategorie_id
    join public.shop_gut_rf_zuordnung z on z.gut_artikelnummer = p.gut_artikelnummer
    join public.shop_artikel a on a.artikelnr = z.rf_artikelnummer and a.sichtbar_aufmass
   where k.ansicht = 'detail' and p.aktiv and p.gut_artikelnummer is not null
     and p.artikel_id is distinct from a.id
)
update public.aufmass_kategorie_position p
   set artikel_id = s.neu from soll s where p.id = s.id;

-- Die Formteil-Gruppe der neuen Artikel nachziehen.
with gruppe as (
  select z.rf_artikelnummer, min(kl.formteil_system) as system,
         min(kl.dimensionsgruppe) as dimensionsgruppe, min(kl.preisklasse) as preisklasse
    from public.shop_gut_rf_zuordnung z
    join public.shop_gut_artikel_klassifikation kl on kl.artikelnummer = z.gut_artikelnummer
   where z.rf_artikelnummer is not null and kl.kategorie = 'formteil'
     and kl.formteil_system is not null and kl.dimensionsgruppe is not null
     and kl.preisklasse is not null
   group by z.rf_artikelnummer
  having count(distinct kl.formteil_system || '|' || kl.dimensionsgruppe || '|' || kl.preisklasse) = 1
)
update public.shop_artikel a
   set formteil_system = gr.system, formteil_dimensionsgruppe = gr.dimensionsgruppe,
       formteil_preisklasse = gr.preisklasse, updated_at = now()
  from gruppe gr
 where a.artikelnr = gr.rf_artikelnummer and not a.formteil_aufmass
   and a.formteil_system is null;

select k.name as rubrik, count(*) as zeilen, count(distinct p.artikel_id) as artikel
  from public.aufmass_kategorie k
  join public.aufmass_kategorie_position p on p.kategorie_id = k.id and p.aktiv
 where k.ansicht = 'detail'
 group by k.name, k.sortierung having count(*) <> count(distinct p.artikel_id)
 order by k.sortierung;
