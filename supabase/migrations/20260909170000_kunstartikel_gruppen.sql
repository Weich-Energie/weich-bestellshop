-- Kunstartikel fuer die Strichlisten-Gruppen.
--
-- Die App speichert seit dem Umbau `dimensionsgruppe` + `preisklasse`; die
-- PDS-Uebergabe suchte Kunstartikel aber je Einzeldimension. Dadurch waere
-- jede neue Erfassung als "Kein Kunstartikel fuer System+Dimension"
-- durchgefallen. Diese Migration schliesst die Luecke.
--
-- Die 57 bestehenden Kunstartikel je Einzeldimension bleiben stehen: ihre
-- PDS-Katalogeintraege sind nicht loeschbar, und Altdaten mit feiner Dimension
-- werden weiter ueber sie bewertet.

alter table public.shop_artikel
  add column if not exists formteil_dimensionsgruppe text,
  add column if not exists formteil_preisklasse text
    check (formteil_preisklasse in ('presse', 'gewinde'));

comment on column public.shop_artikel.formteil_dimensionsgruppe is
  'Zeile der Strichliste, z. B. "22-28mm". Zusammen mit formteil_system und '
  'formteil_preisklasse der Schluessel, den die Aufmass-App liefert.';
comment on column public.shop_artikel.formteil_preisklasse is
  'presse oder gewinde. Gewindeteile kosten je System das 1,1- bis 4-fache.';

-- Ein Kunstartikel je Kombination, solange die Gruppe einen Preis hat.
create unique index if not exists shop_artikel_formteil_gruppe_uniq
  on public.shop_artikel (formteil_system, formteil_dimensionsgruppe, formteil_preisklasse)
  where formteil_aufmass = true and formteil_dimensionsgruppe is not null;

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
  false,
  true,
  g.formteil_system,
  g.dimensionsgruppe,
  g.preisklasse,
  'R+F (Gruppenmittel)',
  -- Lieferant und Kategorie von einem bestehenden Kunstartikel uebernehmen,
  -- damit pds-katalog-sync die Mapping-Pruefung besteht.
  (select lieferant_id from public.shop_artikel
    where formteil_aufmass = true and lieferant_id is not null limit 1),
  (select kategorie_id from public.shop_artikel
    where formteil_aufmass = true and kategorie_id is not null limit 1)
from public.shop_formteil_gruppenpreis g
where g.ek_stueck_mengengewichtet is not null
  and g.dimensionsgruppe <> 'ohne Mass'
on conflict (formteil_system, formteil_dimensionsgruppe, formteil_preisklasse)
  where formteil_aufmass = true and formteil_dimensionsgruppe is not null
do update set
  preis_netto = excluded.preis_netto,
  preis_stand = excluded.preis_stand,
  name = excluded.name;

-- Sicht fuer die PDS-Uebergabe und den Katalog-Sync: alle Gruppen-Kunstartikel
-- mit ihrem Schluessel und dem Stand der PDS-Anlage.
create or replace view public.shop_pds_formteil_gruppen
with (security_invoker = true) as
  select a.id, a.name, a.artikelnr, a.einheit, a.preis_netto,
         a.pds_katalog_uuid,
         a.formteil_system, a.formteil_dimensionsgruppe, a.formteil_preisklasse,
         g.anzahl_artikel, g.menge_gesamt, g.ek_stueck_min, g.ek_stueck_max,
         g.davon_echter_lagerpreis
  from public.shop_artikel a
  left join public.shop_formteil_gruppenpreis g
         on g.formteil_system = a.formteil_system
        and g.dimensionsgruppe = a.formteil_dimensionsgruppe
        and g.preisklasse = a.formteil_preisklasse
  where a.formteil_aufmass = true and a.formteil_dimensionsgruppe is not null
  order by a.formteil_system, a.formteil_dimensionsgruppe, a.formteil_preisklasse;

comment on view public.shop_pds_formteil_gruppen is
  'Kunstartikel je Strichlisten-Gruppe, mit Streuung und Zahl der echten '
  'Lagerpreise dahinter. Grundlage fuer die PDS-Uebergabe aus der Aufmass-App '
  'und fuer die Platzhalter-Ebene in neuen SHK-Auftraegen.';

grant select on public.shop_pds_formteil_gruppen to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select on public.shop_pds_formteil_gruppen to claude_shop;
  end if;
end $$;
