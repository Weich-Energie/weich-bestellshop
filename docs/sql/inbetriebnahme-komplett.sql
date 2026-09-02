-- inbetriebnahme-komplett.sql
-- Alle drei Migrationen der PDS-Anbindung in einem Block, plus das Hinterlegen
-- der Klima-UUIDs und die Prüfabfragen. Erzeugt am 31.08.2026 aus den
-- Einzelmigrationen — inhaltlich identisch, nur zusammengefasst, damit die
-- Inbetriebnahme ein Einfügen statt vier ist.
--
-- Anwenden: Supabase Studio → SQL Editor → alles einfügen → Run.
--
-- Der ganze Block läuft in einer Transaktion. Bricht irgendetwas ab, ist nichts
-- geschrieben — kein halb migrierter Zustand.
--
-- Die Migrationen sind so gebaut, dass ein erneuter Lauf nicht scheitert
-- (add column if not exists, DO-Block für den Constraint). Die create-table- und
-- create-policy-Anweisungen sind es nicht; ein zweiter Lauf bricht dort ab, und
-- die Transaktion nimmt dann alles zurück.

begin;

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 008 — PDS-Katalog-Sync: Sync-Zustand, Einheiten-Mapping, Audit-Log
-- Quelle: supabase/migrations/008_pds_katalog_sync.sql
-- ═══════════════════════════════════════════════════════════════════════

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
-- welche davon beim Übertragen benutzt wird, statt den Wildwuchs zu vergrössern.
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

-- Die Schlüssel sind die Schreibweisen, die der Shop bereits benutzt. Der
-- Artikel-Dialog normalisiert Eingaben über EINHEIT_ALIASE auf die
-- ausgeschriebene deutsche Form ("Im Katalog soll durchgehend die korrekte
-- deutsche Schreibweise stehen", src/app/components/ArtikelDialog.jsx). Diese
-- Tabelle übersetzt sie nach PDS und ändert die Shop-Konvention nicht.
insert into public.shop_pds_einheiten (shop_einheit, pds_bezeichnung, pds_uuid, notiz) values
  ('Stück',     'Stck',  'a41d7bb2-4f47-4e54-9fb6-e9e798d8d831', 'PDS führt daneben Stück, Stk und PCE — wir schreiben Stck'),
  ('Meter',     'm',     'de9e3758-c933-47cd-8e74-64f37d8b9077', 'Meterware wie Kabelkanal'),
  ('Laufmeter', 'lfm',   '597869b4-936d-45fb-8c82-665269cefeaa', 'Praxis bei Rohrpaketen'),
  ('Packung',   'Geb',   '84fd815c-3de6-40bf-97f5-fe7c42da4f26', 'Gebinde bzw. Verpackungseinheit'),
  ('Karton',    'Geb',   '84fd815c-3de6-40bf-97f5-fe7c42da4f26', 'wie Packung'),
  ('Beutel',    'Geb',   '84fd815c-3de6-40bf-97f5-fe7c42da4f26', 'wie Packung'),
  ('Rolle',     'Rolle', '4194ce3e-e095-4fbe-824c-02b659ad4671', 'Kabel und Kabelkanal kommen oft als Rolle'),
  ('Kilogramm', 'kg',    '4b81f74b-7cb3-404a-870a-1800c12fba51', null),
  ('Satz',      'SET',   '3ebaeb49-2040-4029-a207-f13faaf9ba15', null)
on conflict (shop_einheit) do nothing;

-- Liter, Dose, Kanister und Paar kennt der Shop ebenfalls, PDS hat dafür keine
-- Maßeinheit. Sie bleiben absichtlich ohne Zuordnung: der Sync meldet dann eine
-- Lücke, statt auf Stck auszuweichen und die Menge zu verfälschen.

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

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 009 — Nachkalkulation: Kopf- und Positionstabellen
-- Quelle: supabase/migrations/009_nachkalkulation.sql
-- ═══════════════════════════════════════════════════════════════════════

-- 009_nachkalkulation.sql
-- Nachkalkulation von Klima-Aufträgen: Erlös gegen tatsächlichen Materialeinsatz.
-- Hergeleitet in docs/nachkalkulation-datenmodell.md.
--
-- Die Ist-Werte liegen bewusst hier und nicht in PDS. Gegenüber dem Kunden steht
-- im Auftrag eine Pauschale für Montagematerial; einzelne Materialpositionen
-- dort einzutragen wäre eine Änderung am Verkaufsdokument.
--
-- Warum nicht Soll-EK gegen Ist-EK: die Montagematerial-Positionen in PDS sind
-- freie Textpositionen mit EK 0,00. Ein geplanter Materialeinsatz existiert also
-- nicht.
--
-- Und warum nicht nur der Erlös dieser Textpositionen: die Aufträge folgen zwei
-- Mustern. Bei 2025-10263 stehen Rohrpaket und Zuleitung als eigene Positionen
-- mit 3.780 € Erlös. Bei 2025-10313 — dem einzigen abgerechneten Klima-Auftrag —
-- gibt es überhaupt keine Montageposition: dort sind nur zwei Geräte erfasst,
-- 1.536,34 € EK gegen 3.740,00 € VK, die Montage steckt im Geräte-Verkaufspreis.
-- Eine Kennzahl, die nur die Textpositionen summiert, wäre dort null und damit
-- unbrauchbar.
--
-- Belastbar über beide Muster ist deshalb: Gesamterlös des Auftrags minus
-- Geräte-Einkauf. Das ist der Betrag, aus dem Montagematerial, Lohn und Gewinn
-- bezahlt werden. Ihm wird der tatsächliche Materialeinsatz gegenübergestellt.

create table public.shop_nachkalkulation (
  id                   uuid primary key default gen_random_uuid(),
  pds_vorgang_uuid     uuid not null unique,
  pds_vorgangs_nummer  text not null,
  bezeichnung          text not null,
  -- Klammer zum Materialeinkauf: Bestellungen tragen dieselbe projektakteUUID
  -- wie der Auftrag. Darüber kommt das Ist aus PDS statt vom Zettel.
  pds_projektakte_uuid uuid,

  -- Aus PDS übernommene Soll-Werte, zum Zeitpunkt des Imports eingefroren.
  soll_vk_gesamt       numeric(12,2),   -- alle Positionen, die Leitgrösse
  soll_ek_geraete      numeric(12,2),   -- Positionen mit katalogUUID
  soll_vk_geraete      numeric(12,2),
  soll_erloes_montage  numeric(12,2),   -- Positionen ohne katalogUUID, nur Muster A
  -- Materialeinstand, der im Auftrag schon erfasst ist: der ekPreis der
  -- Leistungspositionen (Muster C). Zaehlt als Ist, nicht als Soll.
  soll_ek_leistungen   numeric(12,2),
  soll_vk_leistungen   numeric(12,2),
  soll_stand           timestamptz,

  -- Ist aus PDS-Bestellungen zur selben Projektakte, eingefroren beim Import.
  ist_ek_bestellungen  numeric(12,2),
  ist_bestellungen_stand timestamptz,

  status               text not null default 'offen'
    check (status in ('offen', 'erfasst', 'geprueft')),
  notiz                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  erfasst_von          uuid references auth.users(id)
);

comment on table public.shop_nachkalkulation is
  'Eine Zeile je nachkalkuliertem PDS-Auftrag. pds_vorgang_uuid ist unique — ein '
  'Auftrag wird nicht zweimal nachkalkuliert.';

comment on column public.shop_nachkalkulation.soll_vk_gesamt is
  'Summe aller vkPreis.gesamtPreis des Auftrags. Zusammen mit soll_ek_geraete '
  'ergibt sich der Betrag, aus dem Montagematerial, Lohn und Gewinn bezahlt '
  'werden — die einzige Grösse, die über beide Auftragsmuster hinweg trägt.';

comment on column public.shop_nachkalkulation.soll_erloes_montage is
  'Summe der Positionen ohne katalogUUID. Bei Aufträgen, die Montage separat '
  'ausweisen, ist das der Montageerlös; wo die Montage im Geräte-VK steckt, ist '
  'der Wert null. Deshalb Zusatzinformation und nicht Leitgrösse.';

comment on column public.shop_nachkalkulation.soll_stand is
  'Zeitpunkt des Soll-Imports. Die Werte werden eingefroren, damit eine '
  'abgeschlossene Nachkalkulation sich nicht rückwirkend verschiebt.';

create trigger shop_nachkalkulation_touch
  before update on public.shop_nachkalkulation
  for each row execute function public.tg_touch_updated_at();

-- ─── Ist-Positionen ────────────────────────────────────────────────────────
create table public.shop_nachkalkulation_positionen (
  id                  uuid primary key default gen_random_uuid(),
  nachkalkulation_id  uuid not null
    references public.shop_nachkalkulation(id) on delete cascade,

  -- Regelfall ist der Bezug auf einen Shop-Artikel. Freitext nur, solange es
  -- den Artikel im Shop noch nicht gibt — das ist gleichzeitig die Liste der
  -- Artikel, die im Shop und damit in PDS noch fehlen.
  artikel_id          uuid references public.shop_artikel(id) on delete restrict,
  freitext            text,

  menge               numeric(12,3) not null check (menge > 0),
  einheit             text,

  -- Kopiert, nicht verknüpft: ein spätere Preisänderung am Artikel darf eine
  -- abgeschlossene Nachkalkulation nicht verändern.
  ek_einzel           numeric(10,2),
  ek_gesamt           numeric(12,2),

  quelle              text not null default 'monteur'
    check (quelle in ('monteur', 'beleg', 'bestellung', 'schaetzung')),
  notiz               text,
  created_at          timestamptz not null default now(),

  constraint shop_nk_pos_artikel_oder_freitext
    check (artikel_id is not null or freitext is not null)
);

comment on column public.shop_nachkalkulation_positionen.quelle is
  'bestellung = aus einer PDS-Bestellung zur selben Projektakte übernommen, das '
  'ist die belastbarste Quelle. monteur = vom Zettel abgeschrieben, beleg = aus '
  'einem Lieferantenbeleg, schaetzung = geschätzt. Ohne diese Trennung liest sich '
  'eine Schätzung später wie eine belegte Zahl.';

comment on column public.shop_nachkalkulation.soll_ek_leistungen is
  'Einkaufspreis der Leistungspositionen. Wo der Betrieb das Material in einer '
  'Leistung sammelt (Muster C), steht hier der Einstandspreis — das ist bereits '
  'eine Ist-Zahl und wird nicht erneut von Hand erfasst.';

comment on column public.shop_nachkalkulation.ist_ek_bestellungen is
  'Summe der Einkaufspreise aus PDS-Bestellungen zur Projektakte. Deckt das ab, '
  'was bestellt wurde; Lagerware und Kleinteile ohne eigene Bestellung fehlen '
  'darin und gehören von Hand ergänzt.';

comment on column public.shop_nachkalkulation_positionen.freitext is
  'Nur wenn der Artikel im Shop fehlt. Diese Zeilen sind die Arbeitsliste für '
  'den Katalog-Sync — siehe docs/pds-katalog-mapping.md.';

create index shop_nk_pos_nk_idx
  on public.shop_nachkalkulation_positionen (nachkalkulation_id);

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Nachkalkulation zeigt Einkaufspreise und Margen. Im Katalog sieht ein normaler
-- Nutzer bewusst keine Preise (siehe CLAUDE.md), also bleibt auch das hier bei
-- den Shop-Admins.
alter table public.shop_nachkalkulation enable row level security;
alter table public.shop_nachkalkulation_positionen enable row level security;

create policy shop_nk_read on public.shop_nachkalkulation
  for select to authenticated
  using (public.is_shop_admin());

create policy shop_nk_write on public.shop_nachkalkulation
  for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

create policy shop_nk_pos_read on public.shop_nachkalkulation_positionen
  for select to authenticated
  using (public.is_shop_admin());

create policy shop_nk_pos_write on public.shop_nachkalkulation_positionen
  for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 010 — Artikel PDS-tauglich: Einheiten-Aliasse und Trigger
-- Quelle: supabase/migrations/010_artikel_pds_fertig.sql
-- ═══════════════════════════════════════════════════════════════════════

-- 010_artikel_pds_fertig.sql
-- Macht jeden neu angelegten Shop-Artikel PDS-tauglich, unabhaengig davon, über
-- welchen Weg er entsteht: Beleg-Import, KI aus Link oder Screenshot, oder von
-- Hand im Katalog-Dialog.
--
-- Anlass: Der Beleg-Import uebernimmt die Einheit unveraendert aus der Rechnung
-- (src/app/pages/AdminImportPage.jsx: einheit: pos.ki_einheit). Lieferanten
-- schreiben dort "ST", "STK", "MTR", "lfdm" — der Katalog soll aber durchgehend
-- die deutsche Langform fuehren, und nur eine eindeutige Einheit laesst sich
-- ueber shop_pds_einheiten nach PDS uebersetzen. Und lieferant_id bleibt leer,
-- obwohl der Beleg den Lieferanten vom Rechnungskopf kennt.
--
-- Beides hier per Trigger zu loesen statt in jeder Oberflaeche einzeln: es gibt
-- drei Anlagewege, und ein vierter kommt bestimmt. Die Regel gehoert an die
-- Tabelle, nicht dreifach ins Frontend.

-- ─── Aliasse: wie Lieferanten Einheiten schreiben ──────────────────────────
alter table public.shop_pds_einheiten
  add column if not exists aliasse text[] not null default '{}';

comment on column public.shop_pds_einheiten.aliasse is
  'Schreibweisen aus Lieferantenrechnungen, die auf diese Einheit abgebildet '
  'werden. Vergleich ohne Gross-/Kleinschreibung und ohne Punkte.';

-- Die Zielwerte sind die Shop-Schreibweisen aus Migration 008, nicht die
-- PDS-Kuerzel: der Katalog fuehrt weiter "Stück" und "Meter", uebersetzt wird
-- erst beim Uebertragen. Die Aliasse sind das, was auf Rechnungen steht.
update public.shop_pds_einheiten set aliasse = '{stueck,stuck,stk,st,stck,pce,pcs,pc,piece,pieces,stg}' where shop_einheit = 'Stück';
update public.shop_pds_einheiten set aliasse = '{meter,mtr,mt,m,m1}'                                    where shop_einheit = 'Meter';
update public.shop_pds_einheiten set aliasse = '{lfm,lfdm,laufender meter,lfd m,laufender-meter}'        where shop_einheit = 'Laufmeter';
update public.shop_pds_einheiten set aliasse = '{pack,pck,pkg,ve,gebinde,geb}'                           where shop_einheit = 'Packung';
update public.shop_pds_einheiten set aliasse = '{ktn,kt,kart}'                                           where shop_einheit = 'Karton';
update public.shop_pds_einheiten set aliasse = '{btl,btlv}'                                              where shop_einheit = 'Beutel';
update public.shop_pds_einheiten set aliasse = '{rol,rll,ring,spule}'                                    where shop_einheit = 'Rolle';
update public.shop_pds_einheiten set aliasse = '{kg,kilo}'                                               where shop_einheit = 'Kilogramm';
update public.shop_pds_einheiten set aliasse = '{set,satz,sortiment}'                                    where shop_einheit = 'Satz';

-- Dieselbe Zuordnung steht als EINHEIT_ALIASE auch im Artikel-Dialog. Sie ist
-- dort naeher am Nutzer (er sieht die Korrektur sofort im Formular), hier greift
-- sie fuer alle Wege, die den Dialog nicht durchlaufen.

-- ─── Normalisierung ────────────────────────────────────────────────────────
create or replace function public.normalisiere_einheit(roh text)
returns text
language sql
stable
as $$
  with kandidat as (
    select shop_einheit, aliasse,
           lower(btrim(replace(coalesce(roh, ''), '.', ''))) as gesucht
      from public.shop_pds_einheiten
  )
  select shop_einheit from kandidat
   where gesucht <> ''
     and (lower(shop_einheit) = gesucht or gesucht = any (aliasse))
   -- Exakter Treffer auf shop_einheit schlaegt einen Alias-Treffer, damit 'm'
   -- nicht ueber den lfm-Alias landet.
   order by (lower(shop_einheit) = gesucht) desc, shop_einheit
   limit 1;
$$;

comment on function public.normalisiere_einheit(text) is
  'Bildet eine Einheit aus einer Lieferantenrechnung auf den festen Satz ab. '
  'Gibt NULL zurueck, wenn nichts passt — dann bleibt der Rohwert stehen und der '
  'PDS-Sync meldet die Luecke, statt eine falsche Einheit zu setzen.';

-- ─── Trigger auf shop_artikel ──────────────────────────────────────────────
create or replace function public.tg_artikel_pds_felder()
returns trigger
language plpgsql
as $$
declare
  normiert text;
begin
  -- 1. Einheit auf den festen Satz bringen. Passt nichts, bleibt der Rohwert
  --    stehen: er ist die Information, was in der Rechnung stand, und die
  --    Sync-Pruefung macht die Luecke sichtbar. Stilles Ueberschreiben mit
  --    einem Standardwert waere schlimmer als eine sichtbare Luecke.
  if new.einheit is not null and btrim(new.einheit) <> '' then
    normiert := public.normalisiere_einheit(new.einheit);
    if normiert is not null then
      new.einheit := normiert;
    end if;
  end if;

  -- 2. Lieferantenbezug aus dem Freitext herstellen, solange keiner gesetzt ist.
  --    Der Beleg-Import kennt den Lieferanten nur als Text vom Rechnungskopf.
  if new.lieferant_id is null and new.lieferant is not null and btrim(new.lieferant) <> '' then
    select l.id into new.lieferant_id
      from public.shop_lieferanten l
     where lower(btrim(l.name)) = lower(btrim(new.lieferant))
        or lower(btrim(l.slug)) = lower(btrim(new.lieferant))
     limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists shop_artikel_pds_felder on public.shop_artikel;
create trigger shop_artikel_pds_felder
  before insert or update of einheit, lieferant, lieferant_id
  on public.shop_artikel
  for each row execute function public.tg_artikel_pds_felder();

-- ─── Bestand nachziehen ────────────────────────────────────────────────────
-- Einmalig fuer die Artikel, die vor diesem Trigger entstanden sind.
update public.shop_artikel a
   set einheit = public.normalisiere_einheit(a.einheit)
 where a.einheit is not null
   and public.normalisiere_einheit(a.einheit) is not null
   and public.normalisiere_einheit(a.einheit) <> a.einheit;

update public.shop_artikel a
   set lieferant_id = l.id
  from public.shop_lieferanten l
 where a.lieferant_id is null
   and a.lieferant is not null
   and lower(btrim(a.lieferant)) = lower(btrim(l.name));

-- ═══════════════════════════════════════════════════════════════════════
-- Klima-Ziele im Shop hinterlegen
-- ═══════════════════════════════════════════════════════════════════════
-- Die UUIDs stammen aus der am 30.08.2026 in PDS angelegten Struktur, lesend
-- geholt: docs/pds-klima-warengruppen.md.
--
-- WICHTIG: Den Namen der Shop-Kategorie eintragen, unter der die Klima-C-Teile
-- laufen. Ohne diesen Eintrag bricht jede Übertragung mit einer Meldung ab,
-- welche Angabe fehlt — das ist Absicht, geraten wird nicht.

-- update public.shop_kategorien
--    set pds_kategorie_uuid   = '899522b5-fc11-41df-94a3-1a587eb93544',  -- Klima > Handelsware > 3-Installationsmaterial
--        pds_warengruppe_uuid = '2b2e46ea-de62-4d8f-b694-04355bf4d3dc'   -- (KLIMA)Installationsmaterial
--  where name = 'HIER DEN NAMEN DER SHOP-KATEGORIE EINTRAGEN';

commit;

-- ═══════════════════════════════════════════════════════════════════════
-- Prüfen (nach dem commit einzeln ausführen)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Muss 4 Zeilen liefern
-- select column_name from information_schema.columns
--  where table_name = 'shop_artikel'
--    and column_name in ('pds_katalog_uuid','pds_sync_status','pds_sync_at','lieferant_id');

-- 2. Muss die Einheiten mit Aliassen zeigen, Stück -> Stck
-- select shop_einheit, pds_bezeichnung, aliasse from public.shop_pds_einheiten order by 1;

-- 3. Frigotechnik muss die PDS-UUID abafc5f5-4182-40b0-8448-26020180eef5 tragen
-- select slug, pds_person_uuid, pds_lieferanten_nummer from public.shop_lieferanten;

-- 4. Trigger muss greifen: gibt 'Stück' zurück
-- select public.normalisiere_einheit('STK');

-- 5. Die vier neuen Tabellen müssen existieren
-- select table_name from information_schema.tables
--  where table_schema = 'public'
--    and table_name in ('shop_pds_einheiten','shop_pds_sync_log',
--                       'shop_nachkalkulation','shop_nachkalkulation_positionen');
