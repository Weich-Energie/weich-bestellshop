-- Preisfreie Sicht fuer die Aufmass-App: die Zeilen der Strichliste.
-- Der Monteur sieht keine Preise (Ziel-Vorgabe), nur System und
-- Dimensionsgruppe. Je Zeile trägt er zwei Zahlen ein (Presse / Gewinde).
create or replace view public.shop_formteil_strichliste
with (security_invoker = true) as
  select
    k.formteil_system,
    k.dimensionsgruppe,
    -- Sortierung fuer die Anzeige: klein vor gross, Gewindemasse hinten
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
    -- Kennzeichen, ob die Gruppe ueberhaupt einen Preis hat; steuert nicht die
    -- Anzeige, hilft aber dem Buero bei der Bewertung
    bool_or(k.preisklasse = 'presse') as hat_presse,
    bool_or(k.preisklasse = 'gewinde') as hat_gewinde
  from public.shop_gut_artikel_klassifikation k
  where k.kategorie = 'formteil'
    and k.formteil_system is not null
    and k.dimensionsgruppe is not null
    and k.dimensionsgruppe <> 'ohne Mass'
  group by k.formteil_system, k.dimensionsgruppe
  having count(distinct k.artikelnummer) >= 2   -- Einzelfaelle nicht auf den Vordruck
  order by k.formteil_system, 3;

comment on view public.shop_formteil_strichliste is
  'Zeilen der digitalen Strichliste: Materialsystem x Rohrdimensionsgruppe, '
  'ohne Preise. Gruppen mit nur einem Artikel dahinter bleiben weg, sie waren '
  'Einzelfaelle der Historie. Preise liegen in shop_formteil_gruppenpreis '
  '(nur fuer Shop-Admins auswertbar). Zuschnitt: docs/strichliste-zuschnitt.md.';

grant select on public.shop_formteil_strichliste to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select on public.shop_formteil_strichliste to claude_shop;
  end if;
end $$;
