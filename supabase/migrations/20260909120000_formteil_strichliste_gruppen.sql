-- Zuschnitt der Strichliste (Entscheidung Patrick 09.09.2026, Herleitung in
-- docs/strichliste-zuschnitt.md): der Monteur zaehlt je Materialsystem und
-- Rohrdimensionsgruppe zwei Zahlen — Presse-Formteile und Gewindeteile.
--
-- Zwei neue Achsen an der Klassifikation:
--   preisklasse      'presse' | 'gewinde'   — Gewindeteile kosten 1,1x bis 4x
--   dimensionsgruppe z. B. '22-28mm'        — fasst benachbarte Dimensionen zusammen
-- Das Gewindemass entfaellt bewusst: es verdoppelt die Gruppenzahl und kostet
-- nur rund 12 % Genauigkeit.

alter table public.shop_gut_artikel_klassifikation
  add column if not exists preisklasse text
    check (preisklasse in ('presse', 'gewinde')),
  add column if not exists dimensionsgruppe text,
  add column if not exists rohrdimension text;

comment on column public.shop_gut_artikel_klassifikation.preisklasse is
  'presse = reine Pressverbindung (Bogen, Muffe, Kupplung, Winkel, Reduzierung, '
  'glatter Abzweig, Verschluss); gewinde = alles mit Gewindeanschluss '
  '(Uebergang AG/IG, Verschraubung, Nippel, T-Stueck mit Innengewinde). '
  'Gewindeteile brauchen Rotguss/Siliziumbronze und kosten deshalb mehr.';
comment on column public.shop_gut_artikel_klassifikation.dimensionsgruppe is
  'Zeile der Strichliste: fasst benachbarte Rohrdimensionen zusammen, deren '
  'Preise nahe beieinander liegen. 35 mm bleibt eigen (Verbinder kostet dort '
  'mehr als das Doppelte von 28 mm).';
comment on column public.shop_gut_artikel_klassifikation.rohrdimension is
  'Fuehrende Rohrdimension ohne Gewindemass, z. B. 35mm aus "35mm x 1\"AG".';

-- ─── Preisklasse aus der Artikelbeschreibung ableiten ──────────────────────
update public.shop_gut_artikel_klassifikation k
set preisklasse = case
      when b.text ilike '%verschraubung%' or b.text ilike '%nippel%'
        or b.text ilike '%uebergang%' or b.text ilike '%übergang%'
        or (b.text ilike '%t-st%' and (b.text ilike '%ig%' or b.text ilike '%rp%'))
        then 'gewinde'
      else 'presse'
    end
from (
  select artikelnummer, max(beschreibung1) as text
  from public.shop_gut_positionen group by artikelnummer
) b
where b.artikelnummer = k.artikelnummer and k.kategorie = 'formteil';

-- ─── Rohrdimension ohne Gewindemass ───────────────────────────────────────
update public.shop_gut_artikel_klassifikation
set rohrdimension = coalesce(substring(dimension from '^(\d+mm)'), dimension)
where kategorie = 'formteil' and dimension is not null;

-- ─── Dimensionsgruppe je System ───────────────────────────────────────────
-- Pressfitting-Systeme in mm: bis 18 / 22-28 / 35 und groesser.
-- Uponor: 16-20 / 25-32 (die Flaechenheizung arbeitet mit anderen Spruengen).
-- Gewindesysteme in Zoll: bis 3/4 / 1 Zoll und groesser.
update public.shop_gut_artikel_klassifikation
set dimensionsgruppe = case
      when formteil_system = 'uponor-mlc' then
        case when rohrdimension in ('16mm', '20mm') then '16-20mm'
             when rohrdimension in ('25mm', '32mm') then '25-32mm'
             else coalesce(rohrdimension, 'ohne Mass') end
      when formteil_system in ('rotguss-gewinde', 'gewinde-schwarz') then
        case when rohrdimension ~ '^(1/2|3/8|3/4)' then 'bis 3/4"'
             else '1" und groesser' end
      when rohrdimension ~ '^(12|15|16|18)mm' then 'bis 18mm'
      when rohrdimension ~ '^(20|22|25|28)mm' then '22-28mm'
      when rohrdimension ~ '^(32|35|42|54)mm' then '35mm und groesser'
      when rohrdimension ~ '^(1/2|3/8|3/4)' then 'bis 3/4"'
      when rohrdimension is not null then '1" und groesser'
      else 'ohne Mass'
    end
where kategorie = 'formteil';

create index if not exists shop_gut_klass_strichliste_idx
  on public.shop_gut_artikel_klassifikation (formteil_system, dimensionsgruppe, preisklasse);

-- ─── Mittelwert je Zeile der Strichliste ──────────────────────────────────
-- Ersetzt shop_formteil_mittelwert nicht, sondern tritt daneben: die feine
-- Sicht bleibt fuer die Kontrolle der Streuung.
create or replace view public.shop_formteil_gruppenpreis
with (security_invoker = true) as
  select
    k.formteil_system,
    k.dimensionsgruppe,
    k.preisklasse,
    count(distinct v.artikelnummer) as anzahl_artikel,
    sum(v.menge_gesamt) as menge_gesamt,
    sum(v.menge_gesamt * v.rf_ek) / nullif(sum(v.menge_gesamt), 0) as ek_stueck_mengengewichtet,
    min(v.rf_ek) as ek_stueck_min,
    max(v.rf_ek) as ek_stueck_max,
    count(distinct v.artikelnummer) filter (where v.quelle = 'lager') as davon_echter_lagerpreis
  from public.shop_gut_artikel_klassifikation k
  join (
    select p.artikelnummer, sum(p.menge) as menge_gesamt,
           avg(p.rf_ek_netto_stueck) as rf_ek,
           max(p.rf_zuordnung_quelle) as quelle
    from public.shop_gut_positionen p
    where p.rf_ek_netto_stueck is not null
    group by p.artikelnummer
  ) v on v.artikelnummer = k.artikelnummer
  where k.kategorie = 'formteil'
    and k.formteil_system is not null
    and k.dimensionsgruppe is not null
    and k.preisklasse is not null
  group by k.formteil_system, k.dimensionsgruppe, k.preisklasse
  order by k.formteil_system, k.dimensionsgruppe, k.preisklasse;

comment on view public.shop_formteil_gruppenpreis is
  'Eine Zeile je Feld der Strichliste: Materialsystem x Rohrdimensionsgruppe x '
  'Preisklasse, mit dem mengengewichteten R+F-Nettopreis aus der '
  'Verbrauchshistorie. min/max zeigen die Streuung innerhalb der Gruppe, '
  'davon_echter_lagerpreis wie viele Artikel einen echten Lagerpreis tragen. '
  'Herleitung des Zuschnitts in docs/strichliste-zuschnitt.md.';

grant select on public.shop_formteil_gruppenpreis to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select on public.shop_formteil_gruppenpreis to claude_shop;
  end if;
end $$;
