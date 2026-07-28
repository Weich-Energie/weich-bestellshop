-- 002_bestellshop_storage.sql
-- Storage-Bucket fuer Artikel-Bilder (privat, RLS-geschuetzt).

insert into storage.buckets (id, name, public) values ('shop-artikel', 'shop-artikel', false)
on conflict (id) do nothing;

-- Lesen: alle Shop-User
create policy shop_artikel_bucket_read on storage.objects for select
  using (bucket_id = 'shop-artikel' and public.has_shop_access());

-- Schreiben: nur Admins
create policy shop_artikel_bucket_insert on storage.objects for insert
  with check (bucket_id = 'shop-artikel' and public.is_shop_admin());

create policy shop_artikel_bucket_update on storage.objects for update
  using (bucket_id = 'shop-artikel' and public.is_shop_admin());

create policy shop_artikel_bucket_delete on storage.objects for delete
  using (bucket_id = 'shop-artikel' and public.is_shop_admin());
