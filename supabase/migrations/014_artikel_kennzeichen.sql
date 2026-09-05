-- 014_artikel_kennzeichen.sql
-- Zwei fachliche Kennzeichen am Artikel: bestellbar und Nachkalkulation Klima.
--
-- Der Bestellshop ist nicht nur Bestellwerkzeug, sondern der Artikelstamm fuer
-- das Aufmass auf der Baustelle. Die Aufmass-App (eigene App, eigene Optik,
-- greift auf diesen Stamm zu) und die Nachkalkulation brauchen Artikel, die im
-- Shop nicht bestellt werden — weil sie anderweitig eingekauft werden, z. B.
-- Geraete ueber den Grosshandel oder Lagerware. Umgekehrt sind nicht alle
-- Bestellartikel Klima-Material.
--
--   aktiv                 — der Artikel existiert fachlich (bisher; bleibt)
--   bestellbar            — sichtbar und bestellbar im Shop-Katalog
--   nachkalkulation_klima — sichtbar in Nachkalkulation und Aufmass Klima;
--                           mit PDS-UUID zugleich Platzhalter (Menge 0) in der
--                           Ebene "Montagematerial (Nachkalkulation)" jedes
--                           neuen Klima-Auftrags (ADR 0007)
--
-- Vorgabe bestellbar = true, damit sich fuer die vorhandenen Artikel nichts
-- aendert. nachkalkulation_klima bewusst false: welche Artikel in die Ebene
-- jedes Klima-Auftrags gehoeren, entscheidet ein Admin je Artikel.

alter table public.shop_artikel
  add column if not exists bestellbar            boolean not null default true,
  add column if not exists nachkalkulation_klima boolean not null default false;

comment on column public.shop_artikel.bestellbar is
  'Sichtbar und bestellbar im Shop-Katalog. False: der Artikel dient nur der '
  'Kalkulation bzw. dem Aufmass und wird anderweitig beschafft.';

comment on column public.shop_artikel.nachkalkulation_klima is
  'Sichtbar in Nachkalkulation und Aufmass Klima. Mit pds_katalog_uuid zugleich '
  'Platzhalter (Menge 0) in der Ebene "Montagematerial (Nachkalkulation)" jedes '
  'neuen Klima-Auftrags — ADR 0007.';

create index if not exists shop_artikel_bestellbar_idx
  on public.shop_artikel (bestellbar) where bestellbar;

create index if not exists shop_artikel_nachkalkulation_klima_idx
  on public.shop_artikel (nachkalkulation_klima) where nachkalkulation_klima;

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
  where a.nachkalkulation_klima
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
