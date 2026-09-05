-- 015_preishistorie.sql
-- Tagesaktuelle Einkaufspreise mit Stand, Quelle und Historie.
--
-- Der Bestellshop wird die aktuelle Wahrheit fuer C-Teile: Preise kommen
-- laufend aus den Lieferanten-Shops (Frigotechnik, saukalt, ...) und aus
-- Belegen; PDS wird im Nachgang gegen den Shop abgeglichen, weil PDS nicht
-- aktuell ist. Dafuer muss am Artikel stehen, von wann und woher der Preis
-- ist, und jede Aenderung muss nachvollziehbar bleiben.

alter table public.shop_artikel
  add column if not exists preis_stand  date,
  add column if not exists preis_quelle text;

comment on column public.shop_artikel.preis_stand is
  'Datum, von dem der Einkaufspreis stammt (Shop-Abruf, Belegdatum). Null bei Altbestand.';
comment on column public.shop_artikel.preis_quelle is
  'Woher der Preis kommt: frigotechnik-shop, saukalt, beleg, klimarechner, manuell, pds.';

create table if not exists public.shop_artikel_preise (
  id           uuid primary key default gen_random_uuid(),
  artikel_id   uuid not null references public.shop_artikel(id) on delete cascade,
  preis_netto  numeric(12,4),
  preis_stand  date,
  quelle       text,
  quelle_url   text,
  notiz        text,
  erfasst_von  text,
  created_at   timestamptz not null default now()
);

comment on table public.shop_artikel_preise is
  'Preishistorie je Artikel. Eine Zeile je Preisaenderung, geschrieben vom Trigger '
  'auf shop_artikel. Grundlage fuer den Abgleich mit PDS und fuer die Nachkalkulation '
  'zum Preis am Tag der Baustelle.';

create index if not exists shop_artikel_preise_artikel_idx
  on public.shop_artikel_preise (artikel_id, created_at desc);

-- Trigger: jede Aenderung von preis_netto (oder ein neuer Artikel mit Preis)
-- landet in der Historie. Bewusst am Artikel und nicht in der Anwendung, damit
-- auch Direktpflege ueber die Datenbank protokolliert ist.
create or replace function public.tg_artikel_preis_historie()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.preis_netto is not null
     or tg_op = 'UPDATE' and new.preis_netto is distinct from old.preis_netto then
    insert into public.shop_artikel_preise
      (artikel_id, preis_netto, preis_stand, quelle, quelle_url, erfasst_von)
    values
      (new.id, new.preis_netto, coalesce(new.preis_stand, current_date),
       new.preis_quelle, new.lieferant_url, current_user);
  end if;
  return new;
end $$;

drop trigger if exists tg_artikel_preis_historie on public.shop_artikel;
create trigger tg_artikel_preis_historie
  after insert or update of preis_netto on public.shop_artikel
  for each row execute function public.tg_artikel_preis_historie();

alter table public.shop_artikel_preise enable row level security;

create policy shop_artikel_preise_read on public.shop_artikel_preise
  for select to authenticated using (public.is_shop_admin());

-- Schreiben nur ueber den Trigger (laeuft mit den Rechten des Aendernden) —
-- authenticated braucht dafuer Insert, aber keine eigene Policy fuer Direktschreiben.
grant select, insert on public.shop_artikel_preise to authenticated;
create policy shop_artikel_preise_insert on public.shop_artikel_preise
  for insert to authenticated with check (public.is_shop_admin());

-- Abgleichsliste: Artikel, deren Shop-Preis juenger ist als der letzte PDS-Sync,
-- oder die in PDS stehen, aber im Shop keinen Preisstand tragen.
create or replace view public.shop_pds_abgleich_offen
with (security_invoker = true) as
  select a.id, a.name, a.artikelnr, a.lieferant, a.preis_netto, a.preis_stand,
         a.preis_quelle, a.pds_katalog_uuid, a.pds_sync_at
  from public.shop_artikel a
  where a.pds_katalog_uuid is not null
    and (a.pds_sync_at is null or a.preis_stand > a.pds_sync_at::date)
  order by a.preis_stand desc nulls last, a.name;

comment on view public.shop_pds_abgleich_offen is
  'Artikel, deren Einkaufspreis im Shop neuer ist als der letzte Abgleich mit PDS. '
  'Ziel des Abgleichs: /katalog/updatelieferanteneintrag mit dem Shop-Preis.';

grant select on public.shop_pds_abgleich_offen to authenticated;

-- Rolle claude_shop: Historie lesen und schreiben (Trigger), Lieferanten lesen
-- (fuer die Zuordnung lieferant_id beim Import), Abgleichsliste lesen.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select, insert on public.shop_artikel_preise to claude_shop;
    create policy claude_shop_preise on public.shop_artikel_preise
      for all to claude_shop using (true) with check (true);
    grant select on public.shop_lieferanten to claude_shop;
    create policy claude_shop_lieferanten_read on public.shop_lieferanten
      for select to claude_shop using (true);
    grant select on public.shop_pds_abgleich_offen to claude_shop;
  end if;
end $$;
