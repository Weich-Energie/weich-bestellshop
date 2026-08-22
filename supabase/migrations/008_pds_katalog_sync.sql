-- 008_pds_katalog_sync.sql
-- Grundlage, um Shop-Artikel als echte Katalogartikel nach PDS zu übertragen.
-- Feld- und ID-Mapping ist in docs/pds-katalog-mapping.md dokumentiert.
--
-- Kern der Migration ist die Rückschreibung der PDS-UUID an den Shop-Artikel.
-- Sie ist nicht Komfort, sondern die einzige Absicherung gegen Dubletten:
-- /katalog/delete greift in PDS nur bei Einträgen ohne Bestand und ohne
-- Verwendung, ein zweimal angelegter Artikel bleibt also dauerhaft im Stamm
-- stehen. Der Sync darf deshalb ausschliesslich Artikel anlegen, bei denen
-- pds_katalog_uuid noch null ist.

-- ─── Artikel: Sync-Zustand ─────────────────────────────────────────────────
alter table public.shop_artikel
  add column if not exists pds_katalog_uuid uuid,
  add column if not exists pds_sync_status  text not null default 'offen',
  add column if not exists pds_sync_at      timestamptz,
  add column if not exists pds_sync_fehler  text;

-- Postgres kennt kein "add constraint if not exists" — der DO-Block hält die
-- Migration im gleichen Sinne wiederholbar wie die add-column-Zeilen darüber.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'shop_artikel_pds_sync_status_check'
       and conrelid = 'public.shop_artikel'::regclass
  ) then
    alter table public.shop_artikel
      add constraint shop_artikel_pds_sync_status_check
      check (pds_sync_status in ('offen', 'bereit', 'gesynct', 'fehler'));
  end if;
end $$;

-- Ein PDS-Katalogeintrag gehört zu genau einem Shop-Artikel. Der Unique-Index
-- ist die technische Sperre gegen doppelte Anlage; die fachliche Prüfung
-- (pds_katalog_uuid is null) passiert vorher im Sync.
create unique index if not exists shop_artikel_pds_katalog_uuid_key
  on public.shop_artikel (pds_katalog_uuid)
  where pds_katalog_uuid is not null;

comment on column public.shop_artikel.pds_katalog_uuid is
  'UUID des Katalogeintrags in PDS, zurückgeschrieben aus /katalog/create. '
  'Gesetzt = dieser Artikel wurde übertragen und darf nicht erneut angelegt werden.';

comment on column public.shop_artikel.pds_sync_status is
  'offen = noch nicht für PDS vorgesehen, bereit = Mapping vollständig und zur '
  'Übertragung freigegeben, gesynct = in PDS angelegt, fehler = Übertragung '
  'abgebrochen, Grund in pds_sync_fehler.';

-- ─── Lieferanten: Bezug zur PDS-Person ─────────────────────────────────────
alter table public.shop_lieferanten
  add column if not exists pds_person_uuid       uuid,
  add column if not exists pds_lieferanten_nummer text;

comment on column public.shop_lieferanten.pds_person_uuid is
  'Person in PDS mit Lieferantenrolle. Wird als lieferantUUID an '
  '/katalog/addlieferanteneintrag übergeben — ohne diesen Wert ist ein Artikel '
  'in PDS nicht nachbestellbar.';

-- Migration 007 hat auf shop_lieferanten ein Spalten-Whitelist-GRANT gesetzt
-- (revoke all, danach select nur auf die unkritischen Spalten). Neue Spalten
-- sind dadurch standardmässig unsichtbar. Beide sind keine Zugangsdaten,
-- sondern Stammdatenbezüge, und werden in der Admin-Oberfläche gebraucht.
grant select (pds_person_uuid, pds_lieferanten_nummer)
  on public.shop_lieferanten to authenticated;

update public.shop_lieferanten
   set pds_person_uuid        = 'abafc5f5-4182-40b0-8448-26020180eef5',
       pds_lieferanten_nummer = '70101'
 where slug = 'frigotechnik'
   and pds_person_uuid is null;

-- ─── Artikel: Lieferant als Bezug statt Freitext ───────────────────────────
-- shop_artikel.lieferant ist Freitext. Für PDS wird aber eine lieferantUUID
-- gebraucht, und die hängt an shop_lieferanten. Ohne diesen Bezug müsste der
-- Sync zur Laufzeit über Namensgleichheit raten.
--
-- Die Freitextspalte bleibt zunächst erhalten: sie enthält Werte, für die es
-- noch keinen Lieferantendatensatz gibt (Conrad, Reichelt). Sie zu löschen wäre
-- Datenverlust, solange diese Lieferanten nicht angelegt sind.
alter table public.shop_artikel
  add column if not exists lieferant_id uuid
    references public.shop_lieferanten(id) on delete set null;

comment on column public.shop_artikel.lieferant_id is
  'Lieferant als Bezug auf shop_lieferanten — Voraussetzung für den PDS-Sync. '
  'Die alte Freitextspalte lieferant bleibt vorerst bestehen, weil dort noch '
  'Lieferanten ohne eigenen Datensatz stehen.';

-- Backfill über Namensgleichheit. Trifft heute Frigotechnik; alles andere
-- bleibt null und wird beim Sync als fehlendes Mapping sichtbar.
update public.shop_artikel a
   set lieferant_id = l.id
  from public.shop_lieferanten l
 where a.lieferant_id is null
   and a.lieferant is not null
   and lower(btrim(a.lieferant)) = lower(btrim(l.name));

-- ─── Kategorien: Ziel in PDS ───────────────────────────────────────────────
-- Eine Shop-Kategorie bestimmt beides in PDS: die Katalogkategorie und die
-- Warengruppe. So bleiben die zwei Dimensionen konsistent, statt je Artikel
-- getrennt gepflegt zu werden.
alter table public.shop_kategorien
  add column if not exists pds_kategorie_uuid   uuid,
  add column if not exists pds_warengruppe_uuid uuid;

comment on column public.shop_kategorien.pds_kategorie_uuid is
  'Zielkategorie in PDS. Kategorien sind per API nur lesbar und müssen dort von '
  'Hand angelegt werden — siehe docs/pds-katalog-mapping.md Abschnitt 4.';

comment on column public.shop_kategorien.pds_warengruppe_uuid is
  'Zielwarengruppe in PDS, kalkulatorische Dimension der Nachkalkulation. '
  'Ebenfalls nur lesbar per API — siehe Abschnitt 5. Für den Klima-Bereich sind '
  'vier eigene Warengruppen vorgesehen, weil Klimageräte heute in '
  '(SHK)Wärmepumpe liegen und damit nicht von Wärmepumpen zu trennen sind.';

-- ─── Maßeinheiten: Shop-Wert auf PDS-Bezeichnung ───────────────────────────
-- PDS erwartet in massEinheit eine Zeichenkette, die exakt einer vorhandenen
-- Maßeinheit entspricht. Der Mandant führt vier Stück- und vier Meter-Varianten
-- parallel (Stck, Stück, Stk, PCE / m, lfdm, lfm, MTR). Diese Tabelle legt fest,
-- welche davon der Shop benutzt, statt den Wildwuchs zu vergrössern.
--
-- Bewusst als Mapping-Tabelle und nicht als CHECK auf shop_artikel.einheit:
-- ein Constraint würde Bestandsdaten brechen. So bleiben ungemappte Einheiten
-- erhalten und werden beim Sync als Lücke sichtbar.
create table if not exists public.shop_pds_einheiten (
  shop_einheit     text primary key,
  pds_bezeichnung  text not null,
  pds_uuid         uuid,
  notiz            text
);

comment on table public.shop_pds_einheiten is
  'Übersetzt shop_artikel.einheit in den String, den PDS in massEinheit erwartet. '
  'Fehlt ein Eintrag, wird der Artikel nicht übertragen statt mit falscher Einheit.';

insert into public.shop_pds_einheiten (shop_einheit, pds_bezeichnung, pds_uuid, notiz) values
  ('Stk', 'Stck', 'a41d7bb2-4f47-4e54-9fb6-e9e798d8d831', 'Stückgut; PDS führt zusätzlich Stück, Stk und PCE'),
  ('m',   'm',    'de9e3758-c933-47cd-8e74-64f37d8b9077', 'Meterware wie Kabelkanal'),
  ('lfm', 'lfm',  '597869b4-936d-45fb-8c82-665269cefeaa', 'laufender Meter, Praxis bei Rohrpaketen'),
  ('Pkg', 'Geb',  '84fd815c-3de6-40bf-97f5-fe7c42da4f26', 'Gebinde bzw. Verpackungseinheit')
on conflict (shop_einheit) do nothing;

alter table public.shop_pds_einheiten enable row level security;

create policy shop_pds_einheiten_read on public.shop_pds_einheiten
  for select to authenticated
  using (true);

create policy shop_pds_einheiten_write on public.shop_pds_einheiten
  for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

-- ─── Audit-Log der Schreibzugriffe auf PDS ─────────────────────────────────
-- Jeder Aufruf einer schreibenden Katalog-Operation wird protokolliert, auch
-- der Dry-Run. Ohne dieses Protokoll ist bei einem Fehlschlag nicht mehr
-- feststellbar, was in PDS angekommen ist und was nicht.
create table if not exists public.shop_pds_sync_log (
  id           uuid primary key default gen_random_uuid(),
  artikel_id   uuid references public.shop_artikel(id) on delete set null,
  operation    text not null,
  dry_run      boolean not null default false,
  request      jsonb,
  response     jsonb,
  http_status  int,
  erfolg       boolean not null,
  fehler       text,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id)
);

comment on table public.shop_pds_sync_log is
  'Protokoll aller Schreibzugriffe auf den PDS-Katalog. artikel_id bleibt bei '
  'gelöschtem Shop-Artikel null, das Protokoll selbst wird nie gelöscht.';

comment on column public.shop_pds_sync_log.operation is
  'Whitelist: katalog/create, katalog/addlieferanteneintrag, '
  'katalog/updateAbbildung, katalog/update. Nichts anderes darf geschrieben werden.';

create index if not exists shop_pds_sync_log_artikel_idx
  on public.shop_pds_sync_log (artikel_id, created_at desc);

alter table public.shop_pds_sync_log enable row level security;

create policy shop_pds_sync_log_read on public.shop_pds_sync_log
  for select to authenticated
  using (public.is_shop_admin());

-- Kein Insert-Policy für authenticated: geschrieben wird nur aus der Edge
-- Function mit service_role. Damit kann kein Client das Protokoll fälschen.
