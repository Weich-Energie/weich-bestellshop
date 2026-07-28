-- 004_varianten_gebinde.sql
-- Artikel-Varianten (z.B. Handschuh-Groesse 8/10/12) und Gebinde (z.B. Pack à 10 Stück).
-- Beides erscheint als EIN Katalog-Artikel; User waehlt beim Bestellen.

create table public.shop_artikel_varianten (
  id uuid primary key default gen_random_uuid(),
  artikel_id uuid not null references public.shop_artikel(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index shop_varianten_artikel_idx on public.shop_artikel_varianten(artikel_id);

create table public.shop_artikel_gebinde (
  id uuid primary key default gen_random_uuid(),
  artikel_id uuid not null references public.shop_artikel(id) on delete cascade,
  name text not null,
  stueckzahl int not null default 1 check (stueckzahl >= 1),
  ist_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index shop_gebinde_artikel_idx on public.shop_artikel_gebinde(artikel_id);

alter table public.shop_order_requests
  add column variante_id uuid references public.shop_artikel_varianten(id) on delete set null,
  add column gebinde_id uuid references public.shop_artikel_gebinde(id) on delete set null;

alter table public.shop_artikel_varianten enable row level security;
alter table public.shop_artikel_gebinde enable row level security;

create policy shop_var_read on public.shop_artikel_varianten for select using (public.has_shop_access());
create policy shop_var_write on public.shop_artikel_varianten for all using (public.is_shop_admin()) with check (public.is_shop_admin());

create policy shop_geb_read on public.shop_artikel_gebinde for select using (public.has_shop_access());
create policy shop_geb_write on public.shop_artikel_gebinde for all using (public.is_shop_admin()) with check (public.is_shop_admin());
