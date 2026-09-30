-- Korrektur eines Fehlers aus 20260930120000.
--
-- Dort wurde der Unique-Constraint auf pds_vorgang_uuid durch einen PARTIELLEN
-- Index ersetzt (where pds_vorgang_uuid is not null), damit mehrere Zeilen ohne
-- PDS-Vorgang nebeneinander stehen koennen. Das hat pds-auftrag-soll zerlegt:
--
--   HTTP 500 - there is no unique or exclusion constraint matching the
--   ON CONFLICT specification
--
-- Postgres nimmt einen partiellen Index fuer "on conflict (spalte)" nur an,
-- wenn dasselbe Praedikat mitgegeben wird. Der Supabase-Client kann das nicht
-- ausdruecken - er sendet blosses onConflict: "pds_vorgang_uuid".
--
-- Das Praedikat war ohnehin ueberfluessig: ein gewoehnlicher Unique-Index
-- behandelt NULL-Werte als voneinander verschieden und laesst beliebig viele
-- davon zu. Er leistet also genau dasselbe und bleibt fuer ON CONFLICT
-- brauchbar.
drop index if exists public.shop_nk_pds_vorgang_uidx;

create unique index if not exists shop_nk_pds_vorgang_uidx
  on public.shop_nachkalkulation (pds_vorgang_uuid);

comment on index public.shop_nk_pds_vorgang_uidx is
  'Ein PDS-Auftrag wird nicht zweimal nachkalkuliert. Bewusst OHNE Praedikat: '
  'NULL zaehlt hier als verschieden, mehrere Baustellen ohne PDS-Vorgang stehen '
  'also nebeneinander - und ON CONFLICT (pds_vorgang_uuid) findet den Index.';
