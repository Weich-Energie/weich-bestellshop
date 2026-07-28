-- 001_bestellshop_schema.sql
-- Kern-Datenmodell fuer WEICHENERGIE Bestellshop.
-- Prefix "shop_" um Kollision mit anderen Apps zu vermeiden.

-- ─── Helper: Ist der aktuelle User Shop-Admin? ─────────────────────────
create or replace function public.is_shop_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    join auth.users u on lower(u.email) = lower(e.email)
    where u.id = auth.uid()
      and (
        e.berechtigungen ->> 'rolle' = 'admin'
        or (e.berechtigungen -> 'app_access' ->> 'bestellshop_admin')::boolean = true
      )
  );
$$;

-- Hat der aktuelle User Shop-Zugriff (user oder admin)?
create or replace function public.has_shop_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    join auth.users u on lower(u.email) = lower(e.email)
    where u.id = auth.uid()
      and (e.berechtigungen -> 'app_access' ->> 'bestellshop')::boolean = true
  );
$$;

-- ─── Tabellen ───────────────────────────────────────────────────────────

create table public.shop_kategorien (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.shop_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.shop_artikel (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  beschreibung text,
  kategorie_id uuid references public.shop_kategorien(id) on delete restrict,
  bild_url text,
  bild_ist_extern boolean not null default false,
  lieferant text,
  lieferant_url text,
  preis_netto numeric(10,2),
  einheit text,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.shop_artikel_tags (
  artikel_id uuid not null references public.shop_artikel(id) on delete cascade,
  tag_id uuid not null references public.shop_tags(id) on delete cascade,
  primary key (artikel_id, tag_id)
);

create table public.shop_favoriten (
  user_id uuid not null references auth.users(id) on delete cascade,
  artikel_id uuid not null references public.shop_artikel(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artikel_id)
);

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  lieferant text not null,
  bestell_datum timestamptz,
  versandkosten numeric(10,2),
  gesamtbetrag numeric(10,2),
  extern_bestell_nr text,
  freigabe_user uuid references auth.users(id),
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'received')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_order_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  artikel_id uuid not null references public.shop_artikel(id) on delete restrict,
  menge int not null default 1 check (menge > 0),
  notiz text,
  projekt_ref text,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'ordered', 'received', 'closed', 'cancelled')),
  reject_grund text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_order_positions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  order_request_id uuid not null unique references public.shop_order_requests(id) on delete restrict,
  menge int not null check (menge > 0),
  einzelpreis_netto numeric(10,2),
  created_at timestamptz not null default now()
);

-- ─── Indexe ─────────────────────────────────────────────────────────────
create index shop_artikel_kategorie_idx on public.shop_artikel(kategorie_id);
create index shop_artikel_aktiv_idx on public.shop_artikel(aktiv);
create index shop_order_requests_user_status_idx on public.shop_order_requests(user_id, status);
create index shop_order_requests_status_idx on public.shop_order_requests(status);
create index shop_order_positions_order_idx on public.shop_order_positions(order_id);

-- ─── Trigger: updated_at ────────────────────────────────────────────────
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger shop_artikel_touch before update on public.shop_artikel
  for each row execute function public.tg_touch_updated_at();
create trigger shop_orders_touch before update on public.shop_orders
  for each row execute function public.tg_touch_updated_at();
create trigger shop_order_requests_touch before update on public.shop_order_requests
  for each row execute function public.tg_touch_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────
alter table public.shop_kategorien enable row level security;
alter table public.shop_tags enable row level security;
alter table public.shop_artikel enable row level security;
alter table public.shop_artikel_tags enable row level security;
alter table public.shop_favoriten enable row level security;
alter table public.shop_order_requests enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_positions enable row level security;

create policy shop_kat_read on public.shop_kategorien for select using (public.has_shop_access());
create policy shop_kat_write on public.shop_kategorien for all using (public.is_shop_admin()) with check (public.is_shop_admin());

create policy shop_tag_read on public.shop_tags for select using (public.has_shop_access());
create policy shop_tag_write on public.shop_tags for all using (public.is_shop_admin()) with check (public.is_shop_admin());

create policy shop_art_read on public.shop_artikel for select using (public.has_shop_access());
create policy shop_art_write on public.shop_artikel for all using (public.is_shop_admin()) with check (public.is_shop_admin());

create policy shop_at_read on public.shop_artikel_tags for select using (public.has_shop_access());
create policy shop_at_write on public.shop_artikel_tags for all using (public.is_shop_admin()) with check (public.is_shop_admin());

create policy shop_fav_own on public.shop_favoriten for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy shop_req_read on public.shop_order_requests for select
  using (user_id = auth.uid() or public.is_shop_admin());
create policy shop_req_insert on public.shop_order_requests for insert
  with check (user_id = auth.uid() and public.has_shop_access());
create policy shop_req_update_own on public.shop_order_requests for update
  using (user_id = auth.uid() and status in ('draft','pending','cancelled'))
  with check (user_id = auth.uid());
create policy shop_req_admin_all on public.shop_order_requests for all
  using (public.is_shop_admin()) with check (public.is_shop_admin());
create policy shop_req_delete_own on public.shop_order_requests for delete
  using (user_id = auth.uid() and status = 'draft');

create policy shop_ord_admin on public.shop_orders for all
  using (public.is_shop_admin()) with check (public.is_shop_admin());

create policy shop_pos_admin on public.shop_order_positions for all
  using (public.is_shop_admin()) with check (public.is_shop_admin());
create policy shop_pos_read_own on public.shop_order_positions for select
  using (exists (
    select 1 from public.shop_order_requests r
    where r.id = order_request_id and r.user_id = auth.uid()
  ));
