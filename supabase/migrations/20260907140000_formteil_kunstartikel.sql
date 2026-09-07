-- 20260907140000_formteil_kunstartikel.sql
-- Formteil-Kunstartikel: ein shop_artikel je Materialsystem+Dimension mit dem
-- mengengewichteten R+F-Mittelwert als Preis. Ziel-Schritt 3 ("Je Gruppe ein
-- Kunstartikel 'Formteil <System> <Dimension>'"), Grundlage fuer die
-- PDS-Uebergabe in Ziel-Schritt 5 (Platzhalter-Ebene analog Klima/ADR 0007).
--
-- Bewusst eigenes Kennzeichen statt Wiederverwendung von nachkalkulation_klima:
-- Formteil-Kunstartikel sind nie bestellbar (kein realer Lieferant, nur ein
-- Rechenwert) und gehoeren nicht in die Klima-Nachkalkulation, sondern in die
-- kuenftige Aufmass-Uebergabe.

alter table public.shop_artikel
  add column if not exists formteil_aufmass boolean not null default false,
  add column if not exists formteil_system text,
  add column if not exists formteil_dimension text;

comment on column public.shop_artikel.formteil_aufmass is
  'true = Kunstartikel "Formteil <System> <Dimension>", Preis ist der '
  'mengengewichtete R+F-Mittelwert aus shop_formteil_mittelwert, kein echter '
  'Lieferantenartikel. Nie bestellbar. Grundlage der PDS-Uebergabe (Ziel-Schritt 5).';

create unique index if not exists shop_artikel_formteil_system_dimension_uidx
  on public.shop_artikel (formteil_system, formteil_dimension)
  where formteil_aufmass = true;

-- ─── Kunstartikel aus dem aktuellen Formteil-Mittelwert anlegen ────────────
-- Idempotent: bestehende Kunstartikel (gleiches System+Dimension) werden im
-- Preis aktualisiert statt dupliziert, sollte diese Migration erneut mit
-- frischeren shop_formteil_mittelwert-Daten laufen.
insert into public.shop_artikel (
  name, artikelnr, einheit, preis_netto, preis_stand, preis_quelle,
  bestellbar, formteil_aufmass, formteil_system, formteil_dimension, lieferant
)
select
  'Formteil ' || fm.formteil_system || ' ' || fm.dimension,
  'FORMTEIL-' || upper(replace(fm.formteil_system, '-', '_')) || '-' || fm.dimension,
  'Stück',
  round(fm.ek_stueck_mengengewichtet::numeric, 4),
  current_date,
  'formteil-mittelwert',
  false,
  true,
  fm.formteil_system,
  fm.dimension,
  'R+F (Mittelwert)'
from public.shop_formteil_mittelwert fm
where fm.ek_stueck_mengengewichtet is not null
on conflict (formteil_system, formteil_dimension) where formteil_aufmass = true
do update set
  preis_netto = excluded.preis_netto,
  preis_stand = excluded.preis_stand,
  name = excluded.name;
