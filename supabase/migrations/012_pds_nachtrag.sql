-- 012_pds_nachtrag.sql
-- Verbautes Material geht als Nachtragsauftrag nach PDS (ADR 0006).
--
-- Die Nachkalkulation merkt sich, welcher Nachtrag aus ihr entstanden ist.
-- Grund: Ein Nachtrag laesst sich per API nicht loeschen, und PDS legt bei
-- jedem Aufruf einen weiteren an (-N1, -N2, ...). Solange hier eine UUID
-- steht, weist die Function einen zweiten Versuch ab.
--
-- soll_positionen haelt die Einzelpositionen des PDS-Auftrags aus dem letzten
-- Soll-Import. Bisher wurden nur Summen gespeichert; fuer die Zusammenstellung
-- des Nachtrags muss sichtbar sein, was bereits kalkuliert war.

alter table public.shop_nachkalkulation
  add column if not exists pds_nachtrag_uuid       uuid,
  add column if not exists pds_nachtrag_nummer     text,
  add column if not exists pds_nachtrag_at         timestamptz,
  add column if not exists pds_nachtrag_positionen integer,
  add column if not exists soll_positionen         jsonb;

comment on column public.shop_nachkalkulation.pds_nachtrag_uuid is
  'UUID des Nachtragsauftrags in PDS, der aus dieser Nachkalkulation entstanden ist. '
  'Solange gesetzt, legt die Function keinen zweiten an. Zuruecksetzen nur, wenn der '
  'Nachtrag im PDS-Client geloescht wurde.';

comment on column public.shop_nachkalkulation.pds_nachtrag_nummer is
  'Vorgangsnummer des Nachtrags, z. B. 2026-298-N1. Die API liefert kein Feld, das '
  'vom Nachtrag auf den Hauptauftrag zeigt — die Zuordnung steckt in der Nummer.';

comment on column public.shop_nachkalkulation.soll_positionen is
  'Einzelpositionen des PDS-Auftrags aus dem letzten Soll-Import, gruppiert nach '
  'geraete/leistungen/eigenleistung/montage. Nur Anzeige — der Hauptauftrag wird '
  'nie veraendert.';

create unique index if not exists shop_nachkalkulation_nachtrag_uidx
  on public.shop_nachkalkulation (pds_nachtrag_uuid)
  where pds_nachtrag_uuid is not null;
