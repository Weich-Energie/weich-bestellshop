-- Anfahrt, Pauschalen und Gerüst für das Regieaufmaß.
--
-- Patrick, 30.09.2026: Die Stunden laufen über den Katalogartikel ARB-REG
-- (UUID 05e63c9d-b8d9-44ef-8915-8f0626955c08, EK 45 / VK 69, Einheit Std).
-- Dazu gehören die Dinge, die bei jedem Auftrag anfallen und bisher nirgends
-- standen: Anfahrten nach Zone, die Allgemeinkosten-Pauschalen des
-- Klimarechners und das Gerüst.
--
-- Alle Beträge werden AM AUFTRAG eingefroren, dieselbe Regel wie bei
-- ek_einzel und den Stundensätzen: ändert sich ein Satz später, darf eine
-- abgeschlossene Nachkalkulation sich nicht rückwirkend verschieben.

-- --- Anfahrt ---------------------------------------------------------------
-- Zonenmodell des Klimarechners (docs/kalkulationslogik.md §3): je Fahrt und
-- Fahrzeug, NICHT pro Person. Z1 0-15 min 45 EUR, Z2 >15-30 min 90 EUR,
-- Z3 >30-45 min 145 EUR, Z4 >45-60 min 200 EUR.
alter table public.shop_nachkalkulation
  add column if not exists anfahrt_zone      text,
  add column if not exists anfahrt_fahrten   int,
  add column if not exists anfahrt_satz      numeric(10,2),
  add column if not exists baustelle_adresse text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_nk_anfahrt_zone_check') then
    alter table public.shop_nachkalkulation
      add constraint shop_nk_anfahrt_zone_check
      check (anfahrt_zone is null or anfahrt_zone in ('Z1', 'Z2', 'Z3', 'Z4'));
  end if;
end $$;

comment on column public.shop_nachkalkulation.anfahrt_fahrten is
  'Wie oft tatsächlich angefahren wurde. Vorgeschlagen aus den Daten auf den '
  'fotografierten Blättern - jeder Tag, an dem jemand vor Ort war, ist eine '
  'Fahrt. Der Vorschlag kann zu niedrig sein: ein Tag ohne Zettel hinterlässt '
  'keine Spur.';

comment on column public.shop_nachkalkulation.anfahrt_satz is
  'Zonenpreis zum Zeitpunkt der Nachkalkulation, am Auftrag eingefroren. '
  'Enthält Fahrzeitanteil und Fahrzeugaufwand und gilt je Fahrt, nicht je '
  'Person.';

comment on column public.shop_nachkalkulation.baustelle_adresse is
  'Für die Zonenermittlung. Die Zone kommt aus der Fahrzeit ab Amberg '
  '(Fuggerstraße 23), gerechnet wie im Klimarechner.';

-- --- Pauschalen und Gerüst -------------------------------------------------
-- Die Allgemeinkosten, die bei jedem Auftrag anfallen (Klimarechner §4):
-- PAU-KLIMA 119 EUR (Disposition, Rüsten, Nachbereitung, Doku),
-- PAU-WZ 90 EUR (Werkzeug, Messmittel, Verbrauch),
-- PAU-KLEIN 50 EUR (Kleinmaterial).
--
-- Als jsonb, weil ihre Zahl und ihre Namen sich ändern werden - eine Spalte je
-- Pauschale hieße, das Schema bei jeder Änderung anzufassen. Form:
--   [{ "schluessel": "PAU-WZ", "text": "Werkzeug und Messmittel", "betrag": 90 }]
alter table public.shop_nachkalkulation
  add column if not exists pauschalen     jsonb,
  add column if not exists geruest        boolean not null default false,
  add column if not exists geruest_betrag numeric(10,2);

comment on column public.shop_nachkalkulation.pauschalen is
  'Die Allgemeinkosten dieses Auftrags, mit Betrag eingefroren. Leer heißt '
  'nicht "keine angefallen", sondern "noch nicht entschieden" - deshalb fragt '
  'die Oberfläche danach, statt stillschweigend nichts zu berechnen.';

comment on column public.shop_nachkalkulation.geruest is
  'Ob ein Gerüst gestellt wurde. Steht in keinem Beleg und auf keinem Zettel; '
  'es weiß nur, wer dabei war. Deshalb eine ausdrückliche Frage.';

-- --- Was davon schon in PDS steht ------------------------------------------
-- Dieselbe Begründung wie bei stunden_transport_at: ein zweites
-- Transportangebot für nachgetragenes Material darf Anfahrt, Pauschalen und
-- Gerüst nicht ein zweites Mal in den Auftrag bringen.
alter table public.shop_nachkalkulation
  add column if not exists nebenkosten_transport_at timestamptz;

comment on column public.shop_nachkalkulation.nebenkosten_transport_at is
  'Wann Anfahrt, Pauschalen und Gerüst in ein Transportangebot gegangen sind. '
  'Gesetzt heißt: kein weiteres Angebot nimmt sie noch einmal mit. Wird beim '
  'Zurücksetzen geleert.';
