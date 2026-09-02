-- 011_aufschlagsklassen.sql
-- Aufschlagsklasse je Artikel, damit PDS den Verkaufspreis selbst rechnet.
--
-- Ausgangslage: PDS erzeugt die Preisstrategie eines Artikels aus dem
-- Standard-Lieferanteneintrag und setzt dabei VK = EK. Am Testartikel
-- ZZ-TEST Kabelkanal nachgemessen: 4,85 € Einkaufspreis ergeben
-- ekEinzelpreis 4.85 gegen vkEinzelpreis 4.85. Ein per API angelegter Artikel
-- ist damit bestellbar, aber ohne jeden Aufschlag kalkuliert.
--
-- Der Klimarechner rechnet dagegen VK = EK × (1 + Aufschlag), ausdrücklich als
-- Markup und nicht als Handelsspanne (klimarechner/docs/kalkulationslogik.md):
--   Haupt      30 %  Geräte — der Kunde vergleicht online, deshalb niedrig
--   Fest       35 %  Konsole, Pumpe, Reparaturschalter, Ständer, Dämpfer
--   Verbrauch 100 %  Leitungen, Kanal, Schutzschlauch, Fittings — deckt Verschnitt
--
-- Diese Logik lebt heute zweimal: im Rechner und im Kopf dessen, der das Angebot
-- schreibt. Über eine Kalkulationsgruppe am Katalogartikel wandert sie an die
-- Stelle, wo auch das Angebot sie hernimmt — und greift dann auch bei späteren
-- Einkaufspreisänderungen, ohne dass jemand nachrechnet.
--
-- Die API kann Kalkulationsgruppen weder anlegen noch ihre Sätze lesen;
-- listkalkulationsgruppen liefert nur Bezeichnungen. Die drei Gruppen müssen
-- deshalb einmalig von Hand in PDS entstehen, danach kommen ihre UUIDs hier
-- hinein. Bis dahin bleibt pds_uuid null und der Sync gibt keine Gruppe mit —
-- das Verhalten ist dann wie bisher, VK = EK.

create table public.shop_pds_kalkulationsgruppen (
  klasse            text primary key
    check (klasse in ('haupt', 'fest', 'verbrauch')),
  bezeichnung       text not null,
  aufschlag_prozent numeric(5,2) not null,
  pds_uuid          uuid,
  pds_bezeichnung   text,
  notiz             text
);

comment on table public.shop_pds_kalkulationsgruppen is
  'Übersetzt die Aufschlagsklassen des Klimarechners auf PDS-Kalkulationsgruppen. '
  'aufschlag_prozent ist dokumentarisch — gerechnet wird in PDS anhand der dort '
  'hinterlegten Gruppe. Weichen die Werte auseinander, gilt PDS, und diese Zeile '
  'ist nachzuziehen.';

comment on column public.shop_pds_kalkulationsgruppen.pds_uuid is
  'UUID der Kalkulationsgruppe in PDS. Solange null, gibt der Sync keine Gruppe '
  'mit und PDS setzt den Verkaufspreis gleich dem Einkaufspreis.';

insert into public.shop_pds_kalkulationsgruppen
  (klasse, bezeichnung, aufschlag_prozent, notiz) values
  ('haupt',     'Hauptkomponenten und Geräte',  30.00,
   'Kunde vergleicht online, deshalb bewusst niedrig'),
  ('fest',      'Feste Materialien',            35.00,
   'Konsole, Pumpe, Reparaturschalter, Ständer, Dämpfer'),
  ('verbrauch', 'Verbrauch und Meterware',     100.00,
   'Leitungen, Kanal, Schutzschlauch, Fittings — deckt Verschnitt und Reste')
on conflict (klasse) do nothing;

alter table public.shop_pds_kalkulationsgruppen enable row level security;

create policy shop_pds_kalk_read on public.shop_pds_kalkulationsgruppen
  for select to authenticated using (true);

create policy shop_pds_kalk_write on public.shop_pds_kalkulationsgruppen
  for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

-- ─── Klasse am Artikel ─────────────────────────────────────────────────────
-- Bewusst am Artikel und nicht an der Kategorie: In „Klima" liegen sowohl der
-- Dämpfungssockel (fest, 35 %) als auch Kabelkanal (verbrauch, 100 %).
alter table public.shop_artikel
  add column if not exists aufschlagsklasse text
    references public.shop_pds_kalkulationsgruppen(klasse) on delete set null;

comment on column public.shop_artikel.aufschlagsklasse is
  'Bestimmt die Kalkulationsgruppe, die beim Übertragen nach PDS mitgegeben wird. '
  'Leer heisst: keine Gruppe, PDS setzt VK = EK. Kein Default, weil eine falsche '
  'Klasse den Verkaufspreis dauerhaft verzerrt — lieber gar keine als die falsche.';

create index if not exists shop_artikel_aufschlagsklasse_idx
  on public.shop_artikel (aufschlagsklasse)
  where aufschlagsklasse is not null;

-- Zugang der Rolle claude_shop auf die neue Tabelle, analog zu den übrigen
-- shop_*-Tabellen. Ohne eigene Policy sieht die Rolle nichts, weil die
-- bestehenden nur für anon und authenticated gelten.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select, insert, update on public.shop_pds_kalkulationsgruppen to claude_shop;
    create policy claude_shop_rw on public.shop_pds_kalkulationsgruppen
      for all to claude_shop using (true) with check (true);
  end if;
end $$;
