-- 016_gut_export.sql
-- Rohexport der GUT-Warenkoerbe (gutonlineplus.de) als Verbrauchsbasis fuer
-- das Formteil-Modell und die kuenftige Aufmass-App. Siehe
-- docs/lieferanten-shop-zugaenge.md (Abschnitt GUT Online Plus) und
-- docs/aufmass-formteil-modell.md.
--
-- Auf Baustellen wurde Verbrauch per QR-Code in GUT-Warenkoerbe getippt statt
-- digital erfasst. Diese Tabellen sind die eingefrorene Momentaufnahme dieser
-- 106 Koerbe zum Zeitpunkt des Exports — Grundlage fuer die R+F-Zuordnung
-- (Migration folgt) und die mengengewichteten Formteil-Preise. Kein Bezug zu
-- shop_artikel: GUT-Artikelnummern sind ein Fremdsystem, das nach der Umstellung
-- auf R+F nicht weitergepflegt wird.

create table public.shop_gut_koerbe (
  id                    uuid primary key default gen_random_uuid(),
  cart_number           text not null unique,
  name                  text not null,
  prozessart            integer,
  positionen_erwartet   integer,
  positionen_gefunden   integer,
  exportiert_am         timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

comment on table public.shop_gut_koerbe is
  'Ein Korb je Baustelle/Kunde aus dem GUT-Shop, Stand des Exports. '
  'positionen_erwartet vs. -gefunden zeigt unvollstaendige Exporte (Nachladen '
  'fehlgeschlagen).';

comment on column public.shop_gut_koerbe.name is
  'Korbname aus GUT, z. B. "NK Haberstumpf", "Nachkalk Traßl", "Aufmaß Weich Ru". '
  'Kein einheitliches Schema — manuell vergeben.';

create table public.shop_gut_positionen (
  id                    uuid primary key default gen_random_uuid(),
  korb_id               uuid not null references public.shop_gut_koerbe(id) on delete cascade,
  artikelnummer         text not null,
  beschreibung1         text,
  beschreibung2         text,
  menge                 numeric(12,3) not null,
  einheit               text,
  ek_netto_stueck       numeric(12,4),
  ek_netto_gesamt       numeric(12,2),
  listenpreis_stueck    numeric(12,4),
  bestand               numeric(12,3),
  herstellernummer      text,
  discount_group        text,

  -- Zuordnung zu R+F (rf24.de) — Phase 2. Bleibt bis dahin leer.
  rf_artikelnummer       text,
  rf_ek_netto_stueck     numeric(12,4),
  rf_zuordnung_stand     date,
  rf_zuordnung_quelle    text
    check (rf_zuordnung_quelle in ('automatisch', 'manuell', 'kein_treffer')),

  created_at            timestamptz not null default now()
);

comment on table public.shop_gut_positionen is
  'Eine Zeile je Position eines GUT-Korbs. Menge x ek_netto_stueck = '
  'ek_netto_gesamt (GUT liefert beides direkt, keine eigene Berechnung). '
  'rf_* wird in Phase 2 (R+F-Zuordnung) befuellt.';

comment on column public.shop_gut_positionen.rf_zuordnung_quelle is
  'automatisch = ueber Herstellernummer/Bezeichnung im R+F-Shop gefunden, '
  'manuell = von Hand zugeordnet, kein_treffer = R+F fuehrt den Artikel nicht.';

create index shop_gut_positionen_korb_idx on public.shop_gut_positionen (korb_id);
create index shop_gut_positionen_artikelnr_idx on public.shop_gut_positionen (artikelnummer);
create index shop_gut_positionen_ohne_rf_idx
  on public.shop_gut_positionen (artikelnummer)
  where rf_artikelnummer is null;

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Traegt Einkaufspreise wie shop_nachkalkulation — gleiche Regel: nur Shop-Admins.
alter table public.shop_gut_koerbe enable row level security;
alter table public.shop_gut_positionen enable row level security;

create policy shop_gut_koerbe_read on public.shop_gut_koerbe
  for select to authenticated using (public.is_shop_admin());

create policy shop_gut_positionen_read on public.shop_gut_positionen
  for select to authenticated using (public.is_shop_admin());

-- claude_shop schreibt den Export und pflegt spaeter die R+F-Zuordnung.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select, insert, update, delete on public.shop_gut_koerbe to claude_shop;
    grant select, insert, update, delete on public.shop_gut_positionen to claude_shop;
    create policy claude_shop_gut_koerbe on public.shop_gut_koerbe
      for all to claude_shop using (true) with check (true);
    create policy claude_shop_gut_positionen on public.shop_gut_positionen
      for all to claude_shop using (true) with check (true);
  end if;
end $$;

-- ─── Auswertung: Verbrauch je Artikel ueber alle Koerbe ────────────────────
-- Grundlage fuer die R+F-Zuordnung (welcher Artikel lohnt die manuelle Pruefung
-- zuerst) und fuer den mengengewichteten Formteil-Mittelwert (Phase 3).
create or replace view public.shop_gut_verbrauch_je_artikel
with (security_invoker = true) as
  select
    artikelnummer,
    max(beschreibung1) as beschreibung1,
    max(beschreibung2) as beschreibung2,
    max(herstellernummer) as herstellernummer,
    count(*) as anzahl_positionen,
    sum(menge) as menge_gesamt,
    sum(ek_netto_gesamt) as ek_gesamt,
    avg(ek_netto_stueck) as ek_stueck_einfacher_schnitt,
    sum(ek_netto_gesamt) / nullif(sum(menge), 0) as ek_stueck_mengengewichtet,
    max(rf_artikelnummer) as rf_artikelnummer
  from public.shop_gut_positionen
  group by artikelnummer
  order by sum(ek_netto_gesamt) desc nulls last;

comment on view public.shop_gut_verbrauch_je_artikel is
  'Verbrauch je GUT-Artikelnummer ueber alle exportierten Koerbe, absteigend '
  'nach Einkaufswert. ek_stueck_mengengewichtet ist die Grundlage fuer den '
  'Formteil-Mittelwert in Phase 3 — Gewicht ist die tatsaechliche Menge, nicht '
  'die Anzahl Koerbe.';

grant select on public.shop_gut_verbrauch_je_artikel to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'claude_shop') then
    grant select on public.shop_gut_verbrauch_je_artikel to claude_shop;
  end if;
end $$;
