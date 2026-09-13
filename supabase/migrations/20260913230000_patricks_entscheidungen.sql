-- Vier Entscheidungen von Patrick, 13.09.2026.
--
-- 1. CONEL-Rohrschellen werden durch die R+F-Rohrschellen ersetzt.
-- 2. Trinkwasser-Dichtungen ebenso.
-- 3. Megapress einzeln fuehren, nicht ueber die Formteil-Gruppen.
-- 4. B-press 35 mm ist nicht mehr relevant, 35er Kupfer wird nicht mehr verbaut.

-- ─── 1. CONEL-Rohrschellen -> Walraven KSB1 ───────────────────────────────
-- Groessen eins zu eins, der Spannbereich passt jeweils:
--   15-19 -> 15-18   20-25 -> 20-23   25-30 -> 25-28   33-37 -> 32-35
--
-- ACHTUNG, offene Frage an Patrick: GUT fuehrt diese Schellen mit
-- Mengeneinheit "Stueck", berechnet aber 50,90 bis 60,78 EUR je Stueck. Eine
-- KLICK-Top-Schelle kostet keine 60 EUR — die Verpackungseinheit im Vordruck
-- ist "Beutel". Vermutlich ist der GUT-Preis je Beutel und die Menge je Stueck.
-- Dann waeren rund 35 000 EUR des historischen Verbrauchswerts Phantom.
-- Hier wird Stueck auf Stueck abgebildet; das ist die Wahrheit auf der
-- R+F-Seite. Die GUT-Seite bleibt, wie sie ist, bis die Beutelgroesse geklaert
-- ist.
update public.shop_gut_positionen set
  rf_artikelnummer = '1015197018000', rf_ek_netto_stueck = 0.61,
  rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
 where artikelnummer = 'CCLRST19';

update public.shop_gut_positionen set
  rf_artikelnummer = '1015197023000', rf_ek_netto_stueck = 0.38,
  rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
 where artikelnummer = 'CCLRST25';

update public.shop_gut_positionen set
  rf_artikelnummer = '1015197028000', rf_ek_netto_stueck = 0.71,
  rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
 where artikelnummer = 'CCLRST30';

update public.shop_gut_positionen set
  rf_artikelnummer = '1015197035000', rf_ek_netto_stueck = 0.43,
  rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
 where artikelnummer = 'CCLRST37';

-- ─── 2. Trinkwasser-Dichtungen ────────────────────────────────────────────
-- Die 32 x 44 gab es im Katalog noch nicht; im Shop als Ausfuehrung derselben
-- Produktseite gefunden.
insert into public.shop_artikel
  (artikelnr, name, kategorie_id, lieferant, einheit, preis_netto,
   aktiv, bestellbar, sichtbar_aufmass)
select '1012549300000',
       'Trinkwasser-Verschraubungsdichtung, OHA-Press, 32 x 44 x 1,8 mm',
       'a82bfe28-e672-4979-88f0-f8e977fb9f6b'::uuid, 'R+F', 'Stück', 0.53,
       true, false, true
 where not exists (select 1 from public.shop_artikel where artikelnr = '1012549300000');

update public.shop_gut_positionen set
  rf_artikelnummer = '1012549100000', rf_ek_netto_stueck = 0.44,
  rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
 where artikelnummer = 'DTWFV2434';

update public.shop_gut_positionen set
  rf_artikelnummer = '1012549300000', rf_ek_netto_stueck = 0.53,
  rf_zuordnung_quelle = 'manuell', rf_zuordnung_stand = now()
 where artikelnummer = 'DTWFV3234';

-- ─── 3. Megapress raus aus den Formteil-Gruppen ───────────────────────────
-- Die einzige Megapress-Position der Historie (MPRVT25, Megapress-T-Stueck
-- DN 25, 2 Stueck) hing an R+F 1017314020200 — das ist laut Produktseite ein
-- "EW UP-fix Ersatzteil Pressanschluss 22x1", also kein Megapress-Teil.
-- Zuordnung zurueckgenommen und aus der Gruppenbildung entfernt.
update public.shop_gut_positionen set
  rf_artikelnummer = null, rf_ek_netto_stueck = null,
  rf_zuordnung_quelle = null, rf_zuordnung_stand = now()
 where artikelnummer = 'MPRVT25';

update public.shop_gut_artikel_klassifikation set
  formteil_system = null, dimensionsgruppe = null, preisklasse = null,
  rohrdimension = null, kategorie = 'sonstiges', quelle = 'manuell',
  updated_at = now()
 where artikelnummer = 'MPRVT25' and kategorie = 'formteil';

-- ─── 4. Nicht mehr relevante Artikel kennzeichnen ─────────────────────────
-- Damit sie nicht immer wieder als offene Luecke auftauchen.
alter table public.shop_gut_artikel_klassifikation
  add column if not exists nicht_relevant_grund text;

comment on column public.shop_gut_artikel_klassifikation.nicht_relevant_grund is
  'Gesetzt, wenn zu diesem GUT-Artikel bewusst keine R+F-Entsprechung gesucht '
  'wird — etwa weil das Material nicht mehr verbaut wird. Auswertungen ueber '
  'offene Zuordnungen filtern darauf.';

update public.shop_gut_artikel_klassifikation set
  nicht_relevant_grund = '35er Kupfer wird nicht mehr verbaut '
                       || '(Entscheidung Patrick 13.09.2026)'
 where artikelnummer in ('BPT3515I', 'BPUS3532I');

select k.artikelnummer, k.kategorie, k.formteil_system, k.nicht_relevant_grund
  from public.shop_gut_artikel_klassifikation k
 where k.artikelnummer in ('MPRVT25', 'BPT3515I', 'BPUS3532I')
 order by 1;
