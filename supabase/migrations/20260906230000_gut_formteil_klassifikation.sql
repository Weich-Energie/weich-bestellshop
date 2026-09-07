-- 20260906230000_gut_formteil_klassifikation.sql
-- Klassifikation je GUT-Artikel: Kategorie (Formteil/Rohr/Ventil/Daemmung/...)
-- und, nur fuer Formteile, Materialsystem + Dimension. Grundlage fuer Ziel-
-- Schritt 3 (Formteil-Mittelwert je System und Dimension) — siehe
-- docs/aufmass-formteil-modell.md.
--
-- Regelbasiert (Artikelnummer-Praefix + Beschreibungstext), nicht aus PDS oder
-- GUT selbst uebernommen — beide fuehren diese Unterscheidung nicht. Deshalb
-- eigene, kleine Tabelle statt Spalten direkt an shop_gut_positionen: die
-- Klassifikation ist eine Eigenschaft des Artikels (einmal je Artikelnummer),
-- nicht der einzelnen Position.

create table public.shop_gut_artikel_klassifikation (
  artikelnummer   text primary key,
  kategorie       text not null
    check (kategorie in ('formteil', 'rohr', 'ventil', 'daemmung', 'schelle_zubehoer', 'sonstiges', 'ungeklaert')),
  formteil_system text
    check (formteil_system in (
      'b-press-kupfer', 'maxipro-kupfer', 'prestabo-stahl', 'connect-inox',
      'megapress-stahl', 'uponor-mlc', 'gewinde-schwarz', 'rotguss-gewinde',
      'unbekanntes_system'
    )),
  dimension       text,  -- "35" (mm) oder "1 1/2\"" (Zoll) — je nach System unterschiedliche Einheit
  quelle          text not null default 'regelbasiert-automatisch',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint shop_gut_klass_system_nur_bei_formteil
    check (kategorie = 'formteil' or formteil_system is null)
);

comment on table public.shop_gut_artikel_klassifikation is
  'Kategorie und Materialsystem je GUT-Artikelnummer, regelbasiert aus '
  'Artikelnummer-Praefix und Beschreibung ermittelt (formteil-klassifizieren.mjs, '
  'lokal ausgefuehrt). "Rohre, Ventile, Schellen bleiben Einzelartikel" — nur '
  'kategorie = ''formteil'' geht in die Formteil-Mittelwertbildung ein.';

comment on column public.shop_gut_artikel_klassifikation.formteil_system is
  'Nur gesetzt bei kategorie=formteil. unbekanntes_system = ist ein '
  'Verbindungsstueck (T-Stueck/Winkel/Bogen/...), aber keinem der bekannten '
  'Systeme zugeordnet — braucht manuelle Pruefung vor der Mittelwertbildung.';

comment on column public.shop_gut_artikel_klassifikation.dimension is
  'Groesste erkannte mm-Angabe, sonst die Zollangabe als Text. Bei '
  'Uebergangsstuecken mit zwei Groessen bewusst die groessere (Pressseite) — '
  'die Anschlussseite variiert staerker und waere kein stabiler Gruppenschluessel.';

create trigger shop_gut_klass_touch
  before update on public.shop_gut_artikel_klassifikation
  for each row execute function public.tg_touch_updated_at();

create index shop_gut_klass_formteil_idx
  on public.shop_gut_artikel_klassifikation (formteil_system, dimension)
  where kategorie = 'formteil';

alter table public.shop_gut_artikel_klassifikation enable row level security;

create policy shop_gut_klass_read on public.shop_gut_artikel_klassifikation
  for select to authenticated using (public.is_shop_admin());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select, insert, update, delete on public.shop_gut_artikel_klassifikation to claude_shop;
    create policy claude_shop_gut_klass on public.shop_gut_artikel_klassifikation
      for all to claude_shop using (true) with check (true);
  end if;
end $$;

-- ─── Formteil-Mittelwert je System+Dimension, mengengewichtet ──────────────
-- Grundlage: Verbrauch aus shop_gut_verbrauch_je_artikel, R+F-Nettopreis aus
-- der Zuordnung (Migration 016). Nur Artikel mit rf_artikelnummer gehen ein —
-- ohne Zuordnung gibt es keinen R+F-Preis zum Mitteln.
create or replace view public.shop_formteil_mittelwert
with (security_invoker = true) as
  select
    k.formteil_system,
    k.dimension,
    count(distinct v.artikelnummer) as anzahl_artikel_mit_rf_preis,
    sum(v.menge_gesamt) as menge_gesamt,
    sum(v.menge_gesamt * v.rf_ek_stueck_mengengewichtet) / nullif(sum(v.menge_gesamt), 0) as ek_stueck_mengengewichtet,
    min(v.rf_ek_stueck_mengengewichtet) as ek_stueck_min,
    max(v.rf_ek_stueck_mengengewichtet) as ek_stueck_max
  from public.shop_gut_artikel_klassifikation k
  join (
    select p.artikelnummer, sum(p.menge) as menge_gesamt,
           avg(p.rf_ek_netto_stueck) as rf_ek_stueck_mengengewichtet
    from public.shop_gut_positionen p
    where p.rf_ek_netto_stueck is not null
    group by p.artikelnummer
  ) v on v.artikelnummer = k.artikelnummer
  where k.kategorie = 'formteil' and k.formteil_system is not null and k.dimension is not null
  group by k.formteil_system, k.dimension
  order by k.formteil_system, k.dimension;

comment on view public.shop_formteil_mittelwert is
  'Mengengewichteter R+F-Nettopreis je Formteil-Materialsystem und Dimension — '
  'die Zielgroesse aus Ziel-Schritt 3. min/max zeigen die Streuung innerhalb '
  'der Gruppe (Warnsignal, wenn die Spanne zu weit ist, um einen Mittelwert '
  'zu rechtfertigen).';

grant select on public.shop_formteil_mittelwert to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select on public.shop_formteil_mittelwert to claude_shop;
  end if;
end $$;
