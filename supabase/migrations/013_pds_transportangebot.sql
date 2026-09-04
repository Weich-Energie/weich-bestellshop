-- 013_pds_transportangebot.sql
-- Aus dem Nachtrag wird ein Transportangebot (ADR 0006, Fassung 2).
--
-- Der Nachtragsauftrag aus Migration 012 ist verworfen: Er ist in PDS ein
-- eigener Vorgang neben dem Kundenauftrag, gewollt ist aber das Material IM
-- Kundenauftrag. Die API kann dort nichts einfuegen. Der Betrieb kopiert
-- deshalb im PDS-Client Positionen aus einem Musterangebot in den Auftrag —
-- das Werkzeug liefert dieses Musterangebot jetzt je Auftrag und mit genau den
-- verbauten Mengen.
--
-- Die Spalten aus 012 werden umbenannt statt neu angelegt, damit nichts
-- verloren geht. Neu ist pds_transport_at an der Position: Damit ein zweiter
-- Transport nur das mitnimmt, was noch nicht im Auftrag ist.

alter table public.shop_nachkalkulation
  rename column pds_nachtrag_uuid to pds_transport_uuid;
alter table public.shop_nachkalkulation
  rename column pds_nachtrag_nummer to pds_transport_nummer;
alter table public.shop_nachkalkulation
  rename column pds_nachtrag_at to pds_transport_at;
alter table public.shop_nachkalkulation
  rename column pds_nachtrag_positionen to pds_transport_positionen;

comment on column public.shop_nachkalkulation.pds_transport_uuid is
  'UUID des zuletzt angelegten Transportangebots (ZZ-TRANSPORT) bei der Weich GmbH. '
  'Nur Merkzettel — jede Uebertragung legt ein neues Angebot an, das im Client nach '
  'dem Kopieren geloescht wird.';

comment on column public.shop_nachkalkulation.pds_transport_nummer is
  'Vorgangsnummer des zuletzt angelegten Transportangebots.';

drop index if exists public.shop_nachkalkulation_nachtrag_uidx;

alter table public.shop_nachkalkulation_positionen
  add column if not exists pds_transport_at timestamptz;

comment on column public.shop_nachkalkulation_positionen.pds_transport_at is
  'Zeitpunkt, zu dem diese Position in ein Transportangebot geschrieben wurde. '
  'Gesetzt heisst: ist auf dem Weg in den Kundenauftrag oder schon dort. Die '
  'Function nimmt beim naechsten Transport nur Positionen ohne diesen Wert mit.';

create index if not exists shop_nk_pos_offen_idx
  on public.shop_nachkalkulation_positionen (nachkalkulation_id)
  where pds_transport_at is null;
