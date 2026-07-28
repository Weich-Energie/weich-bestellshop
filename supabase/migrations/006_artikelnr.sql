-- 006_artikelnr.sql
-- Artikel-/Bestellnummer des Lieferanten am Katalog-Artikel.
-- Kommt aus drei Quellen: Shop-Link-Import, Screenshot-Import und
-- Beleg-Positionen (raw_artikelnr). Wird fuer Suche und spaeter fuer den
-- Bestell-Bot gebraucht (Nummer ist im Lieferanten-Shop der schnellste Weg
-- zum richtigen Produkt).

alter table public.shop_artikel
  add column if not exists artikelnr text;

comment on column public.shop_artikel.artikelnr is
  'Artikel-/Bestellnummer beim Lieferanten. Frei und NICHT eindeutig — derselbe '
  'Artikel kann bei mehreren Lieferanten unterschiedliche Nummern haben.';

-- Index fuer Nachschlagen per Nummer (Bot, Duplikat-Erkennung im Beleg-Import).
create index if not exists shop_artikel_artikelnr_idx
  on public.shop_artikel (artikelnr)
  where artikelnr is not null;
