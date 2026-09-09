-- Nach dem Loeschen der 57 Kunstartikel je Einzeldimension (Patrick hat sie am
-- 09.09.2026 in PDS entfernt, danach aus dem Shop) liefert
-- shop_pds_formteil_platzhalter keine Zeile mehr. Sie zeigte auf genau diese
-- Artikel.
--
-- Die Sicht bleibt unter ihrem Namen bestehen, weil docs und die Anleitung an
-- Megh sie nennen — sie speist sich jetzt aber aus den 29 Gruppen-Artikeln.
-- Inhaltlich ist das die richtige Grundlage: die Platzhalter-Ebene in neuen
-- SHK-Auftraegen soll die Zeilen der Strichliste abbilden, nicht die alte
-- feine Dimension.
-- Neu anlegen statt ersetzen: die Spaltenfolge aendert sich, und
-- "create or replace" erlaubt nur identische Spaltennamen.
drop view if exists public.shop_pds_formteil_platzhalter;

create view public.shop_pds_formteil_platzhalter
with (security_invoker = true) as
  select a.id, a.pds_katalog_uuid, a.name, a.artikelnr, a.einheit,
         a.preis_netto as ek_netto,
         a.formteil_system, a.formteil_dimensionsgruppe as dimension,
         a.formteil_preisklasse as preisklasse
  from public.shop_artikel a
  where a.formteil_aufmass = true
    and a.formteil_dimensionsgruppe is not null
  order by a.formteil_system, a.formteil_dimensionsgruppe, a.formteil_preisklasse;

comment on view public.shop_pds_formteil_platzhalter is
  'Quelle fuer die Platzhalter-Ebene "Formteile (Aufmass)" in neuen '
  'SHK-Auftraegen: ein Eintrag je Zeile der Strichliste (System x '
  'Rohrdimensionsgruppe x Presse/Gewinde). Seit 10.09.2026 auf die '
  'Gruppen-Kunstartikel umgestellt; die frueheren 57 Artikel je '
  'Einzeldimension sind geloescht. pds_katalog_uuid ist null, solange der '
  'Katalog-Sync nicht gelaufen ist. Siehe docs/pds-formteil-platzhalter.md.';

grant select on public.shop_pds_formteil_platzhalter to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select on public.shop_pds_formteil_platzhalter to claude_shop;
  end if;
end $$;
