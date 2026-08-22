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

  -- Aus PDS übernommene Soll-Werte, zum Zeitpunkt des Imports eingefroren.
  soll_vk_gesamt       numeric(12,2),   -- alle Positionen, die Leitgrösse
  soll_ek_geraete      numeric(12,2),   -- Positionen mit katalogUUID
  soll_vk_geraete      numeric(12,2),
  soll_erloes_montage  numeric(12,2),   -- Positionen ohne katalogUUID, nur Muster A
  soll_stand           timestamptz,

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
    check (quelle in ('monteur', 'beleg', 'schaetzung')),
  notiz               text,
  created_at          timestamptz not null default now(),

  constraint shop_nk_pos_artikel_oder_freitext
    check (artikel_id is not null or freitext is not null)
);

comment on column public.shop_nachkalkulation_positionen.quelle is
  'monteur = vom Bautagebuch abgeschrieben, beleg = aus einem Lieferantenbeleg, '
  'schaetzung = geschätzt. Ohne diese Trennung liest sich eine Schätzung später '
  'wie eine belegte Zahl.';

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
