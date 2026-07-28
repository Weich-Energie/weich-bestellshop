-- 005_belege.sql
-- Beleg-Import fuer Katalog-Bootstrap (Phase 6a).
-- Admin laedt PDF-Rechnungen hoch, KI extrahiert Meta + Positionen,
-- Admin sichtet und uebernimmt einzelne Positionen als Katalog-Artikel.

create table public.shop_belege (
  id uuid primary key default gen_random_uuid(),
  pdf_url text not null,           -- Pfad in shop-belege Bucket
  original_name text,              -- Original-Dateiname
  lieferant text,                  -- KI-extrahiert
  rechnungsnr text,                -- KI-extrahiert
  rechnungsdatum date,             -- KI-extrahiert
  gesamtbetrag numeric(10,2),      -- KI-extrahiert
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'error')),
  error_msg text,
  imported_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shop_belege_status_idx on public.shop_belege(status);
create index shop_belege_lieferant_idx on public.shop_belege(lieferant);

create trigger shop_belege_touch before update on public.shop_belege
  for each row execute function public.tg_touch_updated_at();

create table public.shop_beleg_positionen (
  id uuid primary key default gen_random_uuid(),
  beleg_id uuid not null references public.shop_belege(id) on delete cascade,
  seitennr int,
  raw_beschreibung text not null,
  raw_menge numeric(10,3),
  raw_einzelpreis numeric(10,2),
  raw_artikelnr text,
  ki_kategorie text,
  ki_tags text[],
  ki_einheit text,
  duplikat_artikel_id uuid references public.shop_artikel(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'uebernommen', 'ignoriert', 'spaeter', 'duplikat')),
  uebernommen_artikel_id uuid references public.shop_artikel(id) on delete set null,
  ignore_grund text,
  created_at timestamptz not null default now()
);

create index shop_beleg_pos_beleg_idx on public.shop_beleg_positionen(beleg_id);
create index shop_beleg_pos_status_idx on public.shop_beleg_positionen(status);

alter table public.shop_belege enable row level security;
alter table public.shop_beleg_positionen enable row level security;

-- Nur Admin darf Beleg-Import
create policy shop_belege_admin on public.shop_belege for all
  using (public.is_shop_admin()) with check (public.is_shop_admin());

create policy shop_belege_pos_admin on public.shop_beleg_positionen for all
  using (public.is_shop_admin()) with check (public.is_shop_admin());

-- Storage-Bucket fuer PDFs (privat, Admin-only)
insert into storage.buckets (id, name, public) values ('shop-belege', 'shop-belege', false)
on conflict (id) do nothing;

create policy shop_belege_bucket_all on storage.objects for all
  using (bucket_id = 'shop-belege' and public.is_shop_admin())
  with check (bucket_id = 'shop-belege' and public.is_shop_admin());
