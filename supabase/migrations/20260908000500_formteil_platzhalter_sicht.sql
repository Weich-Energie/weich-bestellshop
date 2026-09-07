-- 20260908000500_formteil_platzhalter_sicht.sql
-- Sicht fuer die Platzhalter-Ebene "Formteile (Aufmass)" in neuen SHK-Auftraegen,
-- Gegenstueck zu shop_pds_montagematerial_platzhalter (Klima, ADR 0007).
-- Wer einen SHK-Auftrag anlegt (Megh, PDS-Client oder Vorlage), nimmt diese
-- 57 Kunstartikel als Positionen mit Menge 0 in eine eigene Ebene auf. Dann
-- setzt aufmass-pds-uebergabe die Mengen direkt im Auftrag (mengen_setzen)
-- statt ueber ein Transportangebot.

create or replace view public.shop_pds_formteil_platzhalter
with (security_invoker = true) as
  select
    a.pds_katalog_uuid as katalog_uuid,
    a.name,
    a.artikelnr,
    a.formteil_system,
    a.formteil_dimension,
    a.einheit,
    a.preis_netto as ek_netto
  from public.shop_artikel a
  where a.formteil_aufmass = true
    and a.pds_katalog_uuid is not null
  order by a.formteil_system, a.formteil_dimension;

comment on view public.shop_pds_formteil_platzhalter is
  'Alle Formteil-Kunstartikel mit PDS-Katalog-UUID — Positionsliste (Menge 0) fuer '
  'die Ebene "Formteile (Aufmass)" in neuen SHK-Auftraegen. Siehe '
  'docs/pds-formteil-platzhalter.md.';

grant select on public.shop_pds_formteil_platzhalter to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select on public.shop_pds_formteil_platzhalter to claude_shop;
  end if;
end $$;
