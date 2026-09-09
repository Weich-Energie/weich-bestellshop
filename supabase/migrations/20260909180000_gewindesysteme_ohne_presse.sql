-- Fachliche Korrektur (Patrick 09.09.2026): "gewinde schwarz gibts doch
-- garnich zum pressen".
--
-- Richtig. Bei Gewindesystemen wird geschraubt, nicht gepresst — ein Winkel
-- Nr. 92, ein T-Stück Nr. 130 oder ein Stopfen Nr. 290 sind Gewindefittings.
-- Meine Klassifikation hatte sie als 'presse' geführt, weil im Text kein
-- "Übergang" oder "Verschraubung" stand. Die Unterscheidung presse/gewinde
-- trägt nur bei Pressfitting-Systemen (Edelstahl, Kupfer, C-Stahl, Uponor):
-- dort kostet der Gewindeanschluss ein Mehrfaches, weil er Rotguss oder
-- Siliziumbronze braucht. Bei einem reinen Gewindesystem gibt es diesen
-- Unterschied nicht.
--
-- Folge: gewinde-schwarz und rotguss-gewinde haben nur noch die Klasse
-- 'gewinde', und die Strichliste zeigt dort nur einen Zähler.

update public.shop_gut_artikel_klassifikation
set preisklasse = 'gewinde'
where kategorie = 'formteil'
  and formteil_system in ('gewinde-schwarz', 'rotguss-gewinde');

-- Die Presse-Kunstartikel dieser Systeme sind damit gegenstandslos. Sie stehen
-- noch nicht in PDS (pds_katalog_uuid is null), also loeschbar — im Gegensatz
-- zu den 57 alten, deren Katalogeintraege bleiben muessen.
delete from public.shop_artikel
where formteil_aufmass = true
  and formteil_dimensionsgruppe is not null
  and formteil_preisklasse = 'presse'
  and formteil_system in ('gewinde-schwarz', 'rotguss-gewinde')
  and pds_katalog_uuid is null;

-- Preise der verbleibenden Gewinde-Kunstartikel neu setzen: sie umfassen jetzt
-- alle Teile des Systems, nicht nur die mit Uebergang.
update public.shop_artikel a
set preis_netto = round(g.ek_stueck_mengengewichtet::numeric, 4),
    preis_stand = current_date
from public.shop_formteil_gruppenpreis g
where a.formteil_aufmass = true
  and a.formteil_dimensionsgruppe = g.dimensionsgruppe
  and a.formteil_system = g.formteil_system
  and a.formteil_preisklasse = g.preisklasse
  and g.ek_stueck_mengengewichtet is not null;

-- Neue Kombinationen koennen entstanden sein (etwa gewinde-schwarz bis 3/4"
-- als reine Gewindegruppe) — nachziehen.
insert into public.shop_artikel (
  name, artikelnr, einheit, preis_netto, preis_stand, preis_quelle,
  bestellbar, formteil_aufmass, formteil_system, formteil_dimensionsgruppe,
  formteil_preisklasse, lieferant, lieferant_id, kategorie_id
)
select
  'Formteil ' || g.formteil_system || ' ' || g.dimensionsgruppe || ' ' || g.preisklasse,
  'FORMTEIL-G-' || upper(replace(g.formteil_system, '-', '_')) || '-'
    || upper(regexp_replace(g.dimensionsgruppe, '[^a-zA-Z0-9]+', '_', 'g')) || '-'
    || upper(g.preisklasse),
  'Stück',
  round(g.ek_stueck_mengengewichtet::numeric, 4),
  current_date,
  'formteil-gruppenpreis',
  false, true,
  g.formteil_system, g.dimensionsgruppe, g.preisklasse,
  'R+F (Gruppenmittel)',
  (select lieferant_id from public.shop_artikel where formteil_aufmass = true and lieferant_id is not null limit 1),
  (select kategorie_id from public.shop_artikel where formteil_aufmass = true and kategorie_id is not null limit 1)
from public.shop_formteil_gruppenpreis g
where g.ek_stueck_mengengewichtet is not null
  and g.dimensionsgruppe <> 'ohne Mass'
on conflict (formteil_system, formteil_dimensionsgruppe, formteil_preisklasse)
  where formteil_aufmass = true and formteil_dimensionsgruppe is not null
do update set
  preis_netto = excluded.preis_netto,
  preis_stand = excluded.preis_stand,
  name = excluded.name;

comment on column public.shop_gut_artikel_klassifikation.preisklasse is
  'presse = reine Pressverbindung (Bogen, Muffe, Kupplung, Winkel, Reduzierung, '
  'glatter Abzweig, Verschluss); gewinde = mit Gewindeanschluss. '
  'Bei den Gewindesystemen gewinde-schwarz und rotguss-gewinde gibt es nur '
  '"gewinde" — dort wird nichts gepresst (Korrektur 09.09.2026).';
