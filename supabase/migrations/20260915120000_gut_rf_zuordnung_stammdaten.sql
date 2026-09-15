-- Die GUT-R+F-Zuordnung wird Stammdatum (15.09.2026)
--
-- Bisher lebte die Zuordnung ausschliesslich in
-- shop_gut_positionen.rf_artikelnummer -- also an den Verbrauchszeilen der
-- Warenkoerbe. Fuer einen GUT-Artikel ohne Verbrauch gibt es dort keine Zeile
-- und damit keinen Ort fuer die Entscheidung. Heute hat genau das zugeschlagen:
-- von Patricks 36 Nummern liessen sich nur 9 in shop_gut_positionen schreiben,
-- die anderen 27 (Verbrauch 0) fielen stillschweigend durch. Die
-- Zaehllisten-Zeilen sind entstanden, aber die Zuordnung selbst war nirgends
-- gespeichert -- ein Neuaufbau der Detailansicht haette Patricks Arbeit
-- verloren.
--
-- Deshalb eine eigene Stammtabelle. Der Artikelstamm bleibt der Bestellshop
-- (shop_artikel mit dem Kennzeichen sichtbar_aufmass, gepflegt ueber die
-- Admin-Katalogseite); diese Tabelle haelt nur die Bruecke "welcher
-- GUT-Artikel entspricht welchem R+F-Artikel" und die Entscheidung, dass ein
-- Artikel entfaellt.
--
-- Sie ist ausserdem die Voraussetzung fuer die Mischsatz-Ueberwachung: um aus
-- einem Einzelaufmass einen Ist-Mischsatz zu rechnen, muss jede gezaehlte
-- R+F-Position ihrer Formteil-Gruppe zugeordnet werden -- und die steht an den
-- GUT-Artikeln in shop_gut_artikel_klassifikation.

create table if not exists public.shop_gut_rf_zuordnung (
  gut_artikelnummer text primary key,
  gut_bezeichnung   text,
  rf_artikelnummer  text,
  entscheidung      text not null
    check (entscheidung in ('zugeordnet', 'entfaellt', 'offen')),
  bemerkung         text,
  stand             timestamptz not null default now(),
  entschieden_von   uuid references auth.users (id)
);

comment on table public.shop_gut_rf_zuordnung is
  'Bruecke GUT-Artikel -> R+F-Artikel als Stammdatum, unabhaengig davon, ob '
  'der Artikel Verbrauch hatte. entscheidung=entfaellt haelt fest, dass ein '
  'Artikel bewusst nicht mehr gefuehrt wird. Der Artikelstamm selbst bleibt '
  'shop_artikel im Bestellshop.';

comment on column public.shop_gut_rf_zuordnung.rf_artikelnummer is
  'Zeigt auf shop_artikel.artikelnr. Absichtlich ohne Fremdschluessel: eine '
  'Zuordnung darf einer Nummer vorausgehen, die noch nicht im Katalog steht.';

create index if not exists shop_gut_rf_zuordnung_rf_idx
  on public.shop_gut_rf_zuordnung (rf_artikelnummer);

alter table public.shop_gut_rf_zuordnung enable row level security;

drop policy if exists shop_gut_rf_zuordnung_lesen on public.shop_gut_rf_zuordnung;
create policy shop_gut_rf_zuordnung_lesen on public.shop_gut_rf_zuordnung
  for select to authenticated using (public.has_shop_access());

drop policy if exists shop_gut_rf_zuordnung_schreiben on public.shop_gut_rf_zuordnung;
create policy shop_gut_rf_zuordnung_schreiben on public.shop_gut_rf_zuordnung
  for all to authenticated
  using (public.is_shop_admin()) with check (public.is_shop_admin());

-- 1. Patricks 49 Entscheidungen vom 15.09.2026 -- die eigentliche Rettung.
--    36 Zuordnungen und 13 'entfaellt', so wie er sie in
--    daten/zaehllisten-offene-positionen-beantwortet.csv eingetragen hat.
insert into public.shop_gut_rf_zuordnung
  (gut_artikelnummer, gut_bezeichnung, rf_artikelnummer, entscheidung, bemerkung)
values
  ('COCIB2845KNL', 'CONNECT INOX HEAT Bogen 28mm 45 Grad KR 1.4307 CONEL', '7085922280000', 'zugeordnet', 'Patricks Eintrag am Shop geprueft und korrigiert (15.09.2026)'),
  ('COCIB28KNL', 'CONNECT INOX HEAT Bogen 28mm 90 Grad KR 1.4307 CONEL', '7085402280000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIB28ELKNL', 'CONNECT INOX HEAT Bogen 28mm 90 Grad KR m. eins. Einschublänge 1.4307 CONEL', '7085907280000', 'zugeordnet', 'Patricks Eintrag am Shop geprueft und korrigiert (15.09.2026)'),
  ('COCIM22NL', 'CONNECT INOX HEAT Muffe 22mm 1.4307 CONEL', '7085470220000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIM28NL', 'CONNECT INOX HEAT Muffe 28mm 1.4307 CONEL', '7085470280000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIR22NL', 'CONNECT INOX HEAT Rohr 22 x 1,2mm Stange 6 mtr 1.4307 CONEL', '7085992220000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIR28NL', 'CONNECT INOX HEAT Rohr 28 x 1,2mm Stange 6 mtr 1.4307 CONEL', '7085992280000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIR35NL', 'CONNECT INOX HEAT Rohr 35 x 1,5mm Stange 6 mtr 1.4307 CONEL', '7085992350000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIT22NL', 'CONNECT INOX HEAT T-Stück 22mm 1.4307 CONEL', '7085430220000', 'zugeordnet', 'Patricks Eintrag am Shop geprueft und korrigiert (15.09.2026)'),
  ('COCIT2215INL', 'CONNECT INOX HEAT T-Stück 22x1/2"x22mm 1.4307 CONEL', '7085429221000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIT28NL', 'CONNECT INOX HEAT T-Stück 28mm 1.4307 CONEL', '7085430280000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIT2815INL', 'CONNECT INOX HEAT T-Stück 28x1/2"x28mm 1.4307 CONEL', '7085429281000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIT3522NL', 'CONNECT INOX HEAT T-Stück 35x22x35mm 1.4307 CONEL', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('COCIT3528NL', 'CONNECT INOX HEAT T-Stück 35x28x35mm 1.4307 CONEL', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS2225ANL', 'CONNECT INOX HEAT Übergangsstück 22 x 1" AG 1.4307 CONEL', '7085472223000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS2225INL', 'CONNECT INOX HEAT Übergangsstück 22 x 1" IG 1.4307 CONEL', '7085973223000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS2215ANL', 'CONNECT INOX HEAT Übergangsstück 22 x 1/2" AG 1.4307 CONEL', '7085972221000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS2215INL', 'CONNECT INOX HEAT Übergangsstück 22 x 1/2" IG 1.4307 CONEL', '7085973221000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS2220ANL', 'CONNECT INOX HEAT Übergangsstück 22 x 3/4" AG 1.4307 CONEL', '7085972222000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS2220INL', 'CONNECT INOX HEAT Übergangsstück 22 x 3/4" IG 1.4307 CONEL', '7085973222000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS2825INL', 'CONNECT INOX HEAT Übergangsstück 28 x 1" IG 1.4307 CONEL', '7085973283000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS2820INL', 'CONNECT INOX HEAT Übergangsstück 28 x 3/4" IG 1.4307 CONEL', '7085973282000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS2832INL', 'CONNECT INOX HEAT Übergangsstück 28x1 1/4" IG 1.4307 CONEL', '7085973284000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS3525INL', 'CONNECT INOX HEAT Übergangsstück 35 x 1" IG 1.4307 CONEL', '7085973353000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS3532ANL', 'CONNECT INOX HEAT Übergangsstück 35x1 1/4" AG 1.4307 CONEL', '7085972353000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('COCIUS3532INL', 'CONNECT INOX HEAT Übergangsstück 35x1 1/4" IG 1.4307 CONEL', '7085973354000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('CSBLTH100', 'COSMO Tauchhülse DN15 L=100mm Messing vernickelt', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('CSBLTH150', 'COSMO Tauchhülse DN15 L=150mm Messing vernickelt', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('CCLGWST880', 'Gewindebolzen KLICK M8x80 Form A DIN 976 galv. verz. CONEL', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('300S15', 'Kappe Nr.300 1/2" schwarz', '7075430100000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('330132', 'Kappe Rotguss 1 1/4" 3301', '1014056400000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('CUS18H', 'Kupferrohr Sanco-DVGW EN 1057 18 x 1.0mm halbhart in Stangen R250', '1011950180000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('UCPK32N', 'Kupplung Uponor S-Press PLUS MLC 32 x 32mm', '1029201070550', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('POVB2245', 'Prestabo-Bogen 45 Grad, 22mm Stahl unlegiert,verzinkt, Pressanschluss', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('POVM22', 'Prestabo-Muffe 22mm Stahl unlegiert,verzinkt, Pressanschluss', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('POVR22', 'Prestabo-Rohr 22 x 1,5 mm, Stange a 6m Stahl unlegiert, außen verzinkt', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('POVR28', 'Prestabo-Rohr 28 x 1,5 mm, Stange a 6m Stahl unlegiert, außen verzinkt', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('POVT22', 'Prestabo-T-Stück 22mm Stahl unlegiert,verzinkt, Pressanschluss', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('CCLSTS8150', 'Stockschraube KLICK M8x150 I-Stern galv. verz. CONEL', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('BZTTHCU200', 'Tauchhuelse 1/2" x 200mm aus Cu-Leg. f.Bimetall-Thermometer', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('UCPT1615IN', 'T-Stück Uponor mit IG S-Press PLUS MLC 16mmx1/2"x16mm', '1029201070595', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('BPT1515I', 'T-Stueck B-press 15mm x 1/2" IG x 15mm Rotguss P4130G', '1012103151000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('BPT1815', 'T-Stueck B-press 18 x 15 x 18mm Kupfer P5130', '1012102183000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('BPT222215', 'T-Stueck B-press 22 x 22 x 15mm Kupfer P5130', '1012102227000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('BPT282815', 'T-Stueck B-press 28 x 28 x 15mm Kupfer P5130', null, 'entfaellt', 'Entscheidung Patrick 15.09.2026'),
  ('BPT3515I', 'T-Stueck B-press 35mm x 1/2" IG x 35mm Rotguss P4130G', '1012103351000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('BPUS2832I', 'Uebergangsstueck B-press 28mm x 1 1/4"IG Rotguss P4270G', '1012105284000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('BPUS3532I', 'Uebergangsstueck B-press 35mm x 1 1/4"IG Rotguss P4270G', '1012105354000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026'),
  ('330S15', 'Verschraubung Nr.330 i/i 1/2" flachdichtend schwarz', '7075433100000', 'zugeordnet', 'Entscheidung Patrick 15.09.2026')
on conflict (gut_artikelnummer) do update
   set rf_artikelnummer = excluded.rf_artikelnummer,
       entscheidung = excluded.entscheidung,
       gut_bezeichnung = excluded.gut_bezeichnung,
       bemerkung = coalesce(excluded.bemerkung, public.shop_gut_rf_zuordnung.bemerkung),
       stand = now();

-- 2. Die bereits gefundenen Zuordnungen aus den Warenkoerben nachziehen, damit
--    die Tabelle vollstaendig ist. Patricks Eintraege bleiben unangetastet
--    (do nothing), denn 'manuell' steht in der Rangfolge ueber allem anderen.
insert into public.shop_gut_rf_zuordnung
  (gut_artikelnummer, gut_bezeichnung, rf_artikelnummer, entscheidung, bemerkung)
select p.artikelnummer,
       max(p.beschreibung1),
       max(p.rf_artikelnummer),
       'zugeordnet',
       'aus den Warenkoerben uebernommen, Quelle ' || max(p.rf_zuordnung_quelle)
  from public.shop_gut_positionen p
 where p.rf_artikelnummer is not null
 group by p.artikelnummer
on conflict (gut_artikelnummer) do nothing;

-- 3. Die als nicht relevant markierten Artikel als 'entfaellt' festhalten.
insert into public.shop_gut_rf_zuordnung
  (gut_artikelnummer, gut_bezeichnung, rf_artikelnummer, entscheidung, bemerkung)
select k.artikelnummer, null, null, 'entfaellt', k.nicht_relevant_grund
  from public.shop_gut_artikel_klassifikation k
 where k.nicht_relevant_grund is not null
on conflict (gut_artikelnummer) do nothing;

select entscheidung, count(*) as artikel,
       count(*) filter (where rf_artikelnummer is not null) as mit_nummer
  from public.shop_gut_rf_zuordnung group by 1 order by 2 desc;
