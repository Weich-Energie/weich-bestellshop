-- Nachkalkulation: Kalkulationsart, Stunden, und der Foto-Weg fuer Aufmasszettel.
-- Hergeleitet aus docs/nachkalkulation-datenmodell.md und Patricks Vorgabe vom
-- 30.09.2026: die Altauftraege wurden in zwei Versionen kalkuliert - einmal mit
-- ausgewiesenen Montagestunden, einmal mit den Montagezeiten im Artikelpreis.
-- Beide muessen gleichzeitig nachkalkulierbar sein.

-- --- 1) Kalkulationsart ----------------------------------------------------
-- Ohne dieses Kennzeichen liest sich jeder Auftrag gleich, obwohl dieselbe Zahl
-- Verschiedenes bedeutet: bei 'zeit_im_artikel' steckt der Montageerloes im
-- Geraete-VK, bei 'stunden_ausgewiesen' steht er als eigene Position daneben.
-- Wer beides in einen Topf wirft, vergleicht Geraetemargen mit Mischpreisen.
alter table public.shop_nachkalkulation
  add column if not exists kalkulationsart text not null default 'unbekannt';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_nk_kalkulationsart_check') then
    alter table public.shop_nachkalkulation
      add constraint shop_nk_kalkulationsart_check check (kalkulationsart in
        ('unbekannt', 'stunden_ausgewiesen', 'zeit_im_artikel', 'material_in_leistung'));
  end if;
end $$;

comment on column public.shop_nachkalkulation.kalkulationsart is
  'Wie der Auftrag seinerzeit kalkuliert wurde. stunden_ausgewiesen = Montage '
  'steht als eigene Position (Muster A und der heutige Weg). zeit_im_artikel = '
  'die Montagezeit steckt im Verkaufspreis des Geraets, es gibt keine '
  'Montageposition (Muster B). material_in_leistung = eine Leistungsposition '
  'sammelt das Material mit echtem Einstandspreis (Muster C), das Ist steht '
  'dann schon in PDS. Vorbelegt beim Soll-Import, per Hand korrigierbar.';

-- --- 2) Stunden -----------------------------------------------------------
-- Der Grund, warum die Stunden hier gebraucht werden, steht im Datenmodell:
-- "rest_fuer_lohn" sagt nur, wieviel Geld fuer Lohn uebrig blieb - nicht, ob es
-- gereicht hat. Erst die Ist-Stunden machen daraus einen erreichten Stundensatz,
-- und genau den braucht der Klimarechner fuer seine Standardzeiten.
alter table public.shop_nachkalkulation
  add column if not exists soll_stunden           numeric(8,2),
  add column if not exists ist_stunden_techniker  numeric(8,2),
  add column if not exists ist_stunden_monteur    numeric(8,2),
  add column if not exists stundensatz_techniker  numeric(8,2) not null default 75.00,
  add column if not exists stundensatz_monteur    numeric(8,2) not null default 69.00,
  add column if not exists stunden_quelle         text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_nk_stunden_quelle_check') then
    alter table public.shop_nachkalkulation
      add constraint shop_nk_stunden_quelle_check check (
        stunden_quelle is null or stunden_quelle in ('zettel', 'zeiterfassung', 'schaetzung'));
  end if;
end $$;

comment on column public.shop_nachkalkulation.soll_stunden is
  'Kalkulierte Stunden, sofern der Auftrag sie ausweist. Bei kalkulationsart = '
  'zeit_im_artikel bleibt der Wert leer - dort gibt es keine Soll-Stunde, das '
  'ist kein Datenfehler, sondern die Kalkulationsart selbst.';

comment on column public.shop_nachkalkulation.stundensatz_techniker is
  'Verrechnungssatz aus dem Klimarechner (Techniker 75, Monteur 69 EUR/h), am '
  'Auftrag eingefroren. Aendert sich der Satz spaeter, darf eine abgeschlossene '
  'Nachkalkulation sich nicht rueckwirkend verschieben.';

comment on column public.shop_nachkalkulation.stunden_quelle is
  'zettel = vom Aufmass- oder Montagebericht abgeschrieben, zeiterfassung = aus '
  'der Zeiterfassung, schaetzung = geschaetzt. Ohne die Trennung liest sich eine '
  'Schaetzung spaeter wie eine gemessene Zahl.';

-- --- 3) Aufmasszettel als Foto --------------------------------------------
-- Die Uebergangsloesung, bis das Aufmass digital in der App erfasst wird
-- (Gewerk klima in weich-aufmass, live seit 30.09.2026). Der Zettel wird
-- fotografiert, die KI liest die Zeilen, ein Mensch bestaetigt. Das Papier
-- bleibt erlaubt - nur das Abtippen faellt weg.
create table if not exists public.shop_aufmass_foto (
  id                 uuid primary key default gen_random_uuid(),
  nachkalkulation_id uuid not null
    references public.shop_nachkalkulation(id) on delete cascade,

  -- Pfad im Bucket shop-belege unter dem Praefix aufmass/. Bewusst derselbe
  -- Bucket: die Policy dort steht schon auf is_shop_admin().
  bild_pfad      text not null,
  original_name  text,
  seitennr       int,

  status      text not null default 'neu',
  fehler_text text,
  gelesen_am  timestamptz,
  created_at  timestamptz not null default now(),
  erfasst_von uuid references auth.users(id),

  constraint shop_aufmass_foto_status_check
    check (status in ('neu', 'laeuft', 'gelesen', 'uebernommen', 'fehler'))
);

comment on table public.shop_aufmass_foto is
  'Ein Foto eines ausgefuellten Aufmass- oder Montageberichts. Uebergangsloesung '
  'bis zum durchgaengigen Aufmass in der App; danach bleibt sie fuer Altauftraege '
  'stehen.';

create index if not exists shop_aufmass_foto_nk_idx
  on public.shop_aufmass_foto (nachkalkulation_id);

-- --- 4) Die gelesenen Zeilen ----------------------------------------------
-- Getrennt von shop_nachkalkulation_positionen, weil eine gelesene Zeile noch
-- keine Zahl ist, der man trauen kann: Handschrift wird verwechselt, und der
-- Vordruck traegt gedruckte Mengen, die NICHT gelten. Erst die Bestaetigung
-- macht daraus eine Position.
create table if not exists public.shop_aufmass_foto_zeile (
  id       uuid primary key default gen_random_uuid(),
  foto_id  uuid not null references public.shop_aufmass_foto(id) on delete cascade,

  -- Was auf dem Zettel steht, unveraendert.
  roh_artikelnr   text,
  roh_bezeichnung text,
  roh_menge       numeric(12,3),
  roh_einheit     text,
  -- Wie sicher die KI die Handschrift gelesen hat, 0 bis 1. Unter 0,8 gehoert
  -- die Zeile angesehen, bevor sie uebernommen wird.
  sicherheit      numeric(3,2),

  -- Der gefundene Shop-Artikel. Bleibt leer, wenn es ihn noch nicht gibt -
  -- diese Zeilen sind die Arbeitsliste fuer den Artikelstamm der Aufmass-App.
  artikel_id  uuid references public.shop_artikel(id) on delete set null,
  treffer_art text,

  status text not null default 'offen',
  -- Die entstandene Position, damit ein zweiter Lauf nichts doppelt anlegt.
  position_id uuid references public.shop_nachkalkulation_positionen(id) on delete set null,
  notiz       text,
  created_at  timestamptz not null default now(),

  constraint shop_aufmass_zeile_treffer_check
    check (treffer_art is null or treffer_art in ('artikelnr', 'name', 'keiner')),
  constraint shop_aufmass_zeile_status_check
    check (status in ('offen', 'uebernommen', 'verworfen'))
);

comment on column public.shop_aufmass_foto_zeile.roh_menge is
  'Die HANDSCHRIFTLICHE Menge. Der Vordruck ist ein Shop-Ausdruck und traegt in '
  'der Spalte Anzahl ueberall eine gedruckte 1 - ein Kopierrest, der nicht gilt. '
  'Steht neben der Zeile nichts, bleibt der Wert leer und die Zeile faellt weg.';

comment on column public.shop_aufmass_foto_zeile.artikel_id is
  'Zeilen ohne Artikel sind die Arbeitsliste fuer den Artikelstamm: was hier '
  'auftaucht, wurde in den letzten Monaten verbaut und gehoert damit in den '
  'Katalog der Aufmass-App (Kennzeichen nachkalkulation_klima, sichtbar_aufmass).';

create index if not exists shop_aufmass_foto_zeile_foto_idx
  on public.shop_aufmass_foto_zeile (foto_id);

-- --- 5) RLS ---------------------------------------------------------------
-- Wie bei der Nachkalkulation: Shop-Admins. Die Zeilen fuehren zwar keine
-- Preise, haengen aber an einem Vorgang mit Margen.
alter table public.shop_aufmass_foto enable row level security;
alter table public.shop_aufmass_foto_zeile enable row level security;

drop policy if exists shop_aufmass_foto_rw on public.shop_aufmass_foto;
create policy shop_aufmass_foto_rw on public.shop_aufmass_foto
  for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

drop policy if exists shop_aufmass_foto_zeile_rw on public.shop_aufmass_foto_zeile;
create policy shop_aufmass_foto_zeile_rw on public.shop_aufmass_foto_zeile
  for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

-- --- 6) Das Soll kommt oft aus dem Reonic-Angebot, nicht aus PDS ----------
-- Patrick, 30.09.2026: "auftrag holen muss aber im prinzip das reonic angebot
-- holen weil oft der auftrag noch nicht gefuellt ist". Der PDS-Vorgang ist
-- damit nicht mehr Voraussetzung, sondern einer von zwei Wegen.
--
-- Die Reonic-API ist aus der Cloud nur eingeschraenkt erreichbar, deshalb
-- kommt das Angebot zunaechst als PDF herein und wird gelesen wie ein Zettel.
-- Eine spaetere API-Strecke aendert nur die Herkunft, nicht dieses Schema.
alter table public.shop_nachkalkulation
  alter column pds_vorgang_uuid drop not null;

alter table public.shop_nachkalkulation
  add column if not exists soll_quelle text not null default 'pds',
  add column if not exists reonic_projekt_id text,
  add column if not exists soll_beleg_pfad text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_nk_soll_quelle_check') then
    alter table public.shop_nachkalkulation
      add constraint shop_nk_soll_quelle_check
      check (soll_quelle in ('pds', 'reonic_angebot', 'hand'));
  end if;
end $$;

comment on column public.shop_nachkalkulation.soll_quelle is
  'Woher die Soll-Werte stammen. pds = aus dem Auftrag gelesen. reonic_angebot '
  '= aus dem hochgeladenen Angebots-PDF, weil der PDS-Auftrag noch leer war. '
  'hand = eingetragen. Die Zahlen sehen gleich aus, sind aber verschieden '
  'belastbar - ein Angebot ist noch kein Auftrag.';

comment on column public.shop_nachkalkulation.soll_beleg_pfad is
  'Das gelesene Angebots-PDF im Bucket shop-belege. Damit bleibt nachvollziehbar, '
  'woher eine Soll-Zahl kam, die nicht aus PDS stammt.';

-- Der eindeutige Schluessel gilt jetzt nur noch fuer echte PDS-Vorgaenge.
-- Mehrere Nachkalkulationen ohne Vorgang muessen nebeneinander existieren
-- koennen, sonst liesse sich nur ein einziges Angebot erfassen.
do $$
begin
  if exists (select 1 from pg_constraint
             where conname = 'shop_nachkalkulation_pds_vorgang_uuid_key') then
    alter table public.shop_nachkalkulation
      drop constraint shop_nachkalkulation_pds_vorgang_uuid_key;
  end if;
end $$;

create unique index if not exists shop_nk_pds_vorgang_uidx
  on public.shop_nachkalkulation (pds_vorgang_uuid)
  where pds_vorgang_uuid is not null;

-- --- 7) Welche Sorte Blatt liegt vor ---------------------------------------
-- Es kommen drei Sorten herein, und sie werden alle gleich fotografiert:
-- die Materialliste, der Stundenzettel und das Angebot. Die KI schlaegt vor,
-- was sie vor sich hat; bestaetigt wird es von Hand, weil eine falsch
-- einsortierte Seite still in die falschen Felder laufen wuerde.
alter table public.shop_aufmass_foto
  add column if not exists blatt_art text not null default 'unbekannt',
  -- Was auf einem Stundenzettel steht: Zeilen je Person und Tag, plus Summen.
  -- Als jsonb, weil die Zettel unterschiedlich aussehen und die Summe zaehlt.
  add column if not exists stunden_gelesen jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_aufmass_foto_blatt_check') then
    alter table public.shop_aufmass_foto
      add constraint shop_aufmass_foto_blatt_check
      check (blatt_art in ('unbekannt', 'material', 'stunden', 'angebot'));
  end if;
end $$;

comment on column public.shop_aufmass_foto.blatt_art is
  'material = Aufmass- oder Montagebericht mit Mengen. stunden = Stundenzettel. '
  'angebot = Reonic-Angebot als Soll-Quelle. Von der KI vorgeschlagen, vom '
  'Menschen bestaetigt.';

comment on column public.shop_aufmass_foto.stunden_gelesen is
  'Rohergebnis eines Stundenzettels: { zeilen: [{name, datum, stunden, rolle}], '
  'summe_techniker, summe_monteur }. Rolle heisst techniker oder monteur - wer '
  'welche ist, weiss nur der Betrieb, deshalb ist die Zuordnung bestaetigungs- '
  'pflichtig, bevor sie in die Stundenfelder laeuft.';
