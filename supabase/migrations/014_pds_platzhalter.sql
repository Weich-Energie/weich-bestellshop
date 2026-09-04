-- 014_pds_platzhalter.sql
-- Platzhalter fuer die Montagematerial-Ebene neuer Klima-Auftraege (ADR 0007).
--
-- Die PDS-API kann an einen bestehenden Auftrag keine Positionen anhaengen,
-- wohl aber die Menge vorhandener Positionen aendern. Neue Klima-Auftraege
-- bekommen deshalb schon beim Anlegen eine Ebene "Montagematerial
-- (Nachkalkulation)" mit den ueblichen C-Teilen als Katalogpositionen mit
-- Menge 0. Nach dem Bauen setzt der Bestellshop die verbauten Mengen.
--
-- Welche Artikel Platzhalter sind, entscheidet ein Admin am Artikel. Bewusst
-- kein Automatismus ueber Kategorie oder Warengruppe: In "Klima" liegen auch
-- Geraete und Einzelstuecke, die in keinen Standard-Auftrag gehoeren.

alter table public.shop_artikel
  add column if not exists pds_platzhalter boolean not null default false;

comment on column public.shop_artikel.pds_platzhalter is
  'Artikel gehoert als Platzhalter (Menge 0) in die Ebene "Montagematerial '
  '(Nachkalkulation)" jedes neuen Klima-Auftrags. Wirkt nur mit pds_katalog_uuid.';

create index if not exists shop_artikel_pds_platzhalter_idx
  on public.shop_artikel (pds_platzhalter)
  where pds_platzhalter;

-- Sicht fuer die Auftragsanlage (Meghs Reonic-nach-PDS-Weg). Liefert genau das,
-- was in die Ebene gehoert: Katalog-UUID und Anzeige. Reihenfolge nach Name,
-- damit die Ebene in PDS lesbar sortiert ist.
create or replace view public.shop_pds_montagematerial_platzhalter
with (security_invoker = true) as
  select
    a.pds_katalog_uuid  as katalog_uuid,
    a.name,
    a.einheit,
    a.aufschlagsklasse,
    a.id                as shop_artikel_id
  from public.shop_artikel a
  where a.pds_platzhalter
    and a.aktiv
    and a.pds_katalog_uuid is not null
  order by a.name;

comment on view public.shop_pds_montagematerial_platzhalter is
  'Quelle fuer die Ebene "Montagematerial (Nachkalkulation)" bei der Anlage neuer '
  'Klima-Auftraege in PDS. Jede Zeile wird eine Position: positionsTyp ARTIKEL, '
  'katalogUUID = katalog_uuid, menge 0. Siehe docs/pds-montagematerial-platzhalter.md.';

grant select on public.shop_pds_montagematerial_platzhalter to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select on public.shop_pds_montagematerial_platzhalter to claude_shop;
  end if;
end $$;
