-- 003_bedarfsmeldungen.sql
-- Bedarfsmeldungen (Phase 3): User meldet einen noch nicht katalogisierten Wunsch;
-- Admin verwandelt daraus einen Katalog-Artikel ODER lehnt ab.

create table public.shop_bedarfsmeldungen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  beschreibung text not null,
  bild_url text,
  lieferant_url text,
  menge int not null default 1 check (menge > 0),
  status text not null default 'offen'
    check (status in ('offen', 'in_katalog', 'abgelehnt')),
  admin_notiz text,
  resolved_artikel_id uuid references public.shop_artikel(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shop_bedarf_status_idx on public.shop_bedarfsmeldungen(status);
create index shop_bedarf_user_idx on public.shop_bedarfsmeldungen(user_id);

create trigger shop_bedarf_touch before update on public.shop_bedarfsmeldungen
  for each row execute function public.tg_touch_updated_at();

alter table public.shop_bedarfsmeldungen enable row level security;

-- User sieht/schreibt eigene Meldungen; Admin sieht alle
create policy shop_bedarf_read on public.shop_bedarfsmeldungen for select
  using (user_id = auth.uid() or public.is_shop_admin());
create policy shop_bedarf_insert on public.shop_bedarfsmeldungen for insert
  with check (user_id = auth.uid() and public.has_shop_access());
create policy shop_bedarf_update_own on public.shop_bedarfsmeldungen for update
  using (user_id = auth.uid() and status = 'offen') with check (user_id = auth.uid());
create policy shop_bedarf_delete_own on public.shop_bedarfsmeldungen for delete
  using (user_id = auth.uid() and status = 'offen');
create policy shop_bedarf_admin_all on public.shop_bedarfsmeldungen for all
  using (public.is_shop_admin()) with check (public.is_shop_admin());

-- Storage-Bucket fuer Bedarfs-Fotos
insert into storage.buckets (id, name, public) values ('shop-bedarf', 'shop-bedarf', false)
on conflict (id) do nothing;

create policy shop_bedarf_bucket_read on storage.objects for select
  using (bucket_id = 'shop-bedarf' and (public.has_shop_access() or public.is_shop_admin()));

create policy shop_bedarf_bucket_insert on storage.objects for insert
  with check (bucket_id = 'shop-bedarf' and public.has_shop_access());

create policy shop_bedarf_bucket_update on storage.objects for update
  using (bucket_id = 'shop-bedarf' and public.is_shop_admin());

create policy shop_bedarf_bucket_delete on storage.objects for delete
  using (bucket_id = 'shop-bedarf' and (public.is_shop_admin() or (owner = auth.uid())));
