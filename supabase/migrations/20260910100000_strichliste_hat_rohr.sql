-- Patrick am 10.09.2026: "Es gibt nicht bei allen überhaupt Gewinde, press und
-- Längen." Richtig — die Strichliste zeigte bisher bei jeder Zeile ein Feld
-- fuer Rohrmeter, auch bei den Gewindesystemen. Ein Winkel Nr. 92 aus Rotguss
-- ist ein Fitting; Rohr wird dort nicht in Metern gezaehlt.
--
-- Befund aus der Historie (12 Rohr-Artikel):
--   Kupferrohr Sanco 15/22/28/35 mm   -> Kupfer Profipress
--   Uni Pipe PLUS 16/20/25/32 mm      -> Uponor MLC
--   Prestabo-Rohr 35 mm               -> C-Stahl Prestabo
--   Silent PP / CONEL DRAIN           -> Abfluss, kein Heizungssystem
-- Heizungsedelstahl hat in der Historie kein Rohr, weil das System neu ist —
-- gebaut wird damit natuerlich in Metern.
--
-- Regel: Rohrmeter gibt es, wo die Dimensionsgruppe in Millimetern gefuehrt
-- wird. Zollgruppen sind Gewindefittings.
drop view if exists public.shop_formteil_strichliste;

create view public.shop_formteil_strichliste
with (security_invoker = true) as
  select
    k.formteil_system,
    k.dimensionsgruppe,
    case k.dimensionsgruppe
      when 'bis 18mm' then 1
      when '16-20mm' then 1
      when '22-28mm' then 2
      when '25-32mm' then 2
      when '35mm und groesser' then 3
      when 'bis 3/4"' then 4
      when '1" und groesser' then 5
      else 9
    end as sortierung,
    count(distinct k.artikelnummer) as artikel_dahinter,
    bool_or(k.preisklasse = 'presse') as hat_presse,
    bool_or(k.preisklasse = 'gewinde') as hat_gewinde,
    -- Rohrmeter nur bei mm-Gruppen: das sind die Pressfitting-Systeme.
    (k.dimensionsgruppe like '%mm%') as hat_rohr
  from public.shop_gut_artikel_klassifikation k
  where k.kategorie = 'formteil'
    and k.formteil_system is not null
    and k.dimensionsgruppe is not null
    and k.dimensionsgruppe <> 'ohne Mass'
  group by k.formteil_system, k.dimensionsgruppe
  having count(distinct k.artikelnummer) >= 2
  order by k.formteil_system, 3;

comment on view public.shop_formteil_strichliste is
  'Zeilen der digitalen Strichliste: Materialsystem x Rohrdimensionsgruppe, '
  'ohne Preise. hat_presse / hat_gewinde / hat_rohr sagen, welche Felder die '
  'Zeile ueberhaupt braucht — Gewindesysteme haben kein Presse-Feld und keine '
  'Meter. Gruppen mit nur einem Artikel dahinter bleiben weg. Preise in '
  'shop_formteil_gruppenpreis. Zuschnitt: docs/strichliste-zuschnitt.md.';

grant select on public.shop_formteil_strichliste to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select on public.shop_formteil_strichliste to claude_shop;
  end if;
end $$;
