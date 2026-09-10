-- Individualisierung der Aufmaß-App (Patrick 10.09.2026):
--   * Artikelverwaltung laeuft ueber den Bestellshop, dort ein Flag
--     "Sichtbar in Aufmass" — kein zweiter Artikelstamm.
--   * Kategorien (die Rubriken der Strichliste) sollen umbenennbar, loeschbar
--     und neu anlegbar sein, mit eigenen Artikeln darin.
--   * Wer das darf, steuert das Zugriffsrecht aus der Ressourcenplanung.

-- ─── 1) Dritte Sichtbarkeit am Artikel ────────────────────────────────────
-- Muster wie `bestellbar` (Shop-Katalog) und `nachkalkulation_klima`.
alter table public.shop_artikel
  add column if not exists sichtbar_aufmass boolean not null default false;

comment on column public.shop_artikel.sichtbar_aufmass is
  'Artikel erscheint im Katalog der Aufmass-App und laesst sich dort einer '
  'Kategorie zuordnen. Dritte Sichtbarkeit neben bestellbar (Shop-Katalog) '
  'und nachkalkulation_klima. Gepflegt in der Artikelverwaltung des Shops.';

create index if not exists shop_artikel_sichtbar_aufmass_idx
  on public.shop_artikel (sichtbar_aufmass) where sichtbar_aufmass;

-- Die Formteil-Kunstartikel sind im Aufmass ohnehin sichtbar.
update public.shop_artikel set sichtbar_aufmass = true where formteil_aufmass = true;

-- ─── 2) Kategorien der Strichliste ────────────────────────────────────────
-- Eine Kategorie ist eine Rubrik im Vordruck. Die neun aus der GUT-Historie
-- abgeleiteten werden als Vorgabe angelegt; Patrick kann sie umbenennen,
-- ausblenden und eigene dazunehmen.
create table if not exists public.aufmass_kategorie (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Zeigt auf das Materialsystem der Klassifikation, wenn die Kategorie aus
  -- der Historie stammt. Eigene Kategorien haben hier null.
  formteil_system text,
  farbe text not null default '#3182ce',
  sortierung integer not null default 100,
  aktiv boolean not null default true,
  -- Vorgabe-Kategorien lassen sich ausblenden, aber nicht loeschen: an ihnen
  -- haengen die Gruppenpreise aus der Verbrauchshistorie.
  ist_vorgabe boolean not null default false,
  hinweis text,
  erstellt_von uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.aufmass_kategorie is
  'Rubriken der digitalen Strichliste. Die aus der GUT-Historie abgeleiteten '
  'tragen ist_vorgabe = true und ein formteil_system; eigene Kategorien legt '
  'der Aufmass-Admin an. Reihenfolge ueber sortierung, Ausblenden ueber aktiv.';

create unique index if not exists aufmass_kategorie_name_uniq
  on public.aufmass_kategorie (lower(name));

-- ─── 3) Positionen einer Kategorie ────────────────────────────────────────
-- Zwei Arten: eine Formteil-Gruppe (bepreist ueber den Gruppenmittelwert) oder
-- ein einzelner Artikel aus dem Shop-Stamm.
create table if not exists public.aufmass_kategorie_position (
  id uuid primary key default gen_random_uuid(),
  kategorie_id uuid not null references public.aufmass_kategorie(id) on delete cascade,
  art text not null check (art in ('gruppe', 'artikel')),
  -- bei art = 'gruppe'
  dimensionsgruppe text,
  hat_presse boolean not null default false,
  hat_gewinde boolean not null default false,
  hat_rohr boolean not null default false,
  -- bei art = 'artikel'
  artikel_id uuid references public.shop_artikel(id) on delete cascade,
  -- Anzeige
  bezeichnung text,
  sortierung integer not null default 100,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  constraint aufmass_position_inhalt check (
    (art = 'gruppe' and dimensionsgruppe is not null)
    or (art = 'artikel' and artikel_id is not null))
);

comment on table public.aufmass_kategorie_position is
  'Zeilen innerhalb einer Kategorie. art = gruppe: eine Formteil-Gruppe, '
  'bepreist ueber shop_formteil_gruppenpreis, mit den Feldern die es gibt '
  '(hat_presse/hat_gewinde/hat_rohr). art = artikel: ein einzelner Artikel aus '
  'shop_artikel (sichtbar_aufmass), mit eigenem Zaehler.';

create index if not exists aufmass_position_kategorie_idx
  on public.aufmass_kategorie_position (kategorie_id, sortierung);

-- ─── 4) Vorgabe-Kategorien aus der Historie anlegen ───────────────────────
insert into public.aufmass_kategorie (name, formteil_system, farbe, sortierung, ist_vorgabe, hinweis)
values
  ('Heizungsedelstahl',   'connect-inox',       '#3f6fb5',  10, true, 'Aktuelles System für die Verteilung'),
  ('Uponor MLC',          'uponor-mlc',         '#1c9a94',  20, true, 'Flächenheizung'),
  ('Rotguss / Gewinde',   'rotguss-gewinde',    '#a8791f',  30, true, 'Anschlüsse, wird geschraubt'),
  ('Gewinde schwarz',     'gewinde-schwarz',    '#4a5560',  40, true, 'Anschlüsse, wird geschraubt'),
  ('Kupfer Profipress',   'b-press-kupfer',     '#b1602f',  50, true, 'Übergänge im Bestand'),
  ('C-Stahl Prestabo',    'prestabo-stahl',     '#6b7480',  60, true, 'Abgelöst, für Bestandsarbeiten'),
  ('Megapress',           'megapress-stahl',    '#5c6470',  70, true, null),
  ('MaxiPro (Kälte)',     'maxipro-kupfer',     '#9a6a45',  80, true, null),
  ('Sonstige Formteile',  'unbekanntes_system', '#8a8f98',  90, true, 'Sammelposten')
on conflict (lower(name)) do update set
  formteil_system = excluded.formteil_system,
  farbe = excluded.farbe,
  sortierung = excluded.sortierung,
  hinweis = excluded.hinweis;

-- Positionen der Vorgabe-Kategorien aus der Strichlisten-Sicht fuellen.
insert into public.aufmass_kategorie_position (
  kategorie_id, art, dimensionsgruppe, hat_presse, hat_gewinde, hat_rohr,
  bezeichnung, sortierung)
select k.id, 'gruppe', s.dimensionsgruppe, s.hat_presse, s.hat_gewinde, s.hat_rohr,
       s.dimensionsgruppe, s.sortierung * 10
from public.shop_formteil_strichliste s
join public.aufmass_kategorie k on k.formteil_system = s.formteil_system
where not exists (
  select 1 from public.aufmass_kategorie_position p
  where p.kategorie_id = k.id and p.dimensionsgruppe = s.dimensionsgruppe);

-- ─── 5) Rechte ────────────────────────────────────────────────────────────
-- Lesen darf jeder mit Zugang zur App; aendern nur der Aufmass-Admin.
-- Muster wie is_shop_admin(), aber mit eigenem Schluessel, damit sich Aufmass
-- und Bestellshop getrennt vergeben lassen.
-- Verbindung ueber die E-Mail, genau wie is_shop_admin() — employees.auth_uuid
-- ist nicht bei allen Mitarbeitern gefuellt.
create or replace function public.is_aufmass_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.employees e
    join auth.users u on lower(u.email) = lower(e.email)
    where u.id = auth.uid()
      and (
        e.berechtigungen ->> 'rolle' = 'admin'
        or (e.berechtigungen -> 'app_access' ->> 'aufmass_admin')::boolean = true
      )
  );
$$;

comment on function public.is_aufmass_admin is
  'true fuer employees.berechtigungen.app_access.aufmass_admin = true oder '
  'rolle = admin. Fail-closed: ohne Eintrag kein Recht. Vergeben wird das '
  'Recht im Mitarbeiterbereich der Ressourcenplanung.';

alter table public.aufmass_kategorie enable row level security;
alter table public.aufmass_kategorie_position enable row level security;

drop policy if exists aufmass_kategorie_lesen on public.aufmass_kategorie;
create policy aufmass_kategorie_lesen on public.aufmass_kategorie
  for select to authenticated using (true);

drop policy if exists aufmass_kategorie_pflegen on public.aufmass_kategorie;
create policy aufmass_kategorie_pflegen on public.aufmass_kategorie
  for all to authenticated using (public.is_aufmass_admin())
  with check (public.is_aufmass_admin());

drop policy if exists aufmass_position_lesen on public.aufmass_kategorie_position;
create policy aufmass_position_lesen on public.aufmass_kategorie_position
  for select to authenticated using (true);

drop policy if exists aufmass_position_pflegen on public.aufmass_kategorie_position;
create policy aufmass_position_pflegen on public.aufmass_kategorie_position
  for all to authenticated using (public.is_aufmass_admin())
  with check (public.is_aufmass_admin());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select, insert, update, delete on public.aufmass_kategorie to claude_shop;
    grant select, insert, update, delete on public.aufmass_kategorie_position to claude_shop;
  end if;
end $$;

-- ─── 6) Sicht fuer die App: Kategorien mit ihren Zeilen ───────────────────
create or replace view public.aufmass_strichliste
with (security_invoker = true) as
  select k.id as kategorie_id, k.name as kategorie, k.farbe, k.sortierung as kategorie_sortierung,
         k.hinweis, k.formteil_system, k.ist_vorgabe,
         p.id as position_id, p.art, p.sortierung as position_sortierung,
         coalesce(p.bezeichnung, p.dimensionsgruppe, a.name) as bezeichnung,
         p.dimensionsgruppe, p.hat_presse, p.hat_gewinde, p.hat_rohr,
         p.artikel_id, a.artikelnr, a.einheit, a.bild_url
  from public.aufmass_kategorie k
  join public.aufmass_kategorie_position p on p.kategorie_id = k.id and p.aktiv
  left join public.shop_artikel a on a.id = p.artikel_id
  where k.aktiv
  order by k.sortierung, p.sortierung;

comment on view public.aufmass_strichliste is
  'Was die Aufmass-App anzeigt: Kategorien mit ihren Zeilen, ohne Preise. '
  'Ersetzt shop_formteil_strichliste in der App — jene bleibt als Quelle fuer '
  'das Anlegen der Vorgaben. Preise stehen in shop_formteil_gruppenpreis und '
  'shop_artikel, beides nur fuer Admins auswertbar.';

grant select on public.aufmass_strichliste to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select on public.aufmass_strichliste to claude_shop;
  end if;
end $$;
