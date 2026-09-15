-- Fuenf Fehlzuordnungen korrigieren (15.09.2026)
--
-- Beim Einordnen der Formteil-Gruppen fielen Artikel auf, die zwei Gruppen
-- gleichzeitig zugeordnet waren -- ein sicheres Zeichen fuer eine falsche
-- GUT-R+F-Bruecke. Jede Korrektur ist am R+F-Shop belegt (Nummernsuche mit der
-- GUT-Nummer bzw. Ausfuehrungen derselben Produktseite), keine geraten.
--
--   POVT35        1 655 EUR / 148 Stk  zeigte auf 7020900558932
--                 "Prestabo-T-Stueck MIT IG, 35 x 1/2 x 35" -- gesucht ist das
--                 reine T-Stueck. Richtig: 7020900558659 (9,67 EUR).
--   POVT3515         46 EUR /   4 Stk  ebenso: 7020900558741 (9,47 EUR).
--   POVT2815          8 EUR /   1 Stk  ebenso: 7020900558710 (6,35 EUR).
--   COCIUS3525ANL   486 EUR /  56 Stk  zeigte auf 7085472283000
--                 "Uebergangsstueck AG, d = 28" -- das Teil ist 35 x 1".
--                 Richtig: 7085972353000 (9,76 EUR, "SH M ... d = 35 x R 1").
--                 Die SH-V-Reihe endet bei d = 28; 35 mm gibt es nur als SH M.
--   COCIUS3532ANL   122 EUR /  12 Stk  trug seit heute 7085972353000, also
--                 R 1 statt R 1 1/4. Richtig: 7085972354000 (11,25 EUR).
--
-- Gemessene Wirkung: prestabo-stahl / 35mm+ / presse faellt von 7,5651 auf
-- 7,0853 EUR (-6,3 %). Alle anderen Saetze bleiben unveraendert -- auch die
-- Edelstahl-Gruppen: von C-Stahl uebertragen wird das MENGENGERUEST (der
-- Teile-Mix), nicht der Preis, und die Mengen verschiebt diese Korrektur
-- nicht. Die connect-inox-Korrekturen aendern nur die Bewertung der 68 Stueck
-- Eigenverbrauch, der neben dem uebertragenen Satz ohnehin nicht zaehlt.

-- 1. Der eine noch fehlende Artikel.
insert into public.shop_artikel
  (artikelnr, name, preis_netto, preis_quelle, preis_stand, bild_url,
   bild_ist_extern, lieferant, einheit, aktiv, sichtbar_aufmass, bestellbar)
select '7085972354000',
       'OptiSteel simplesta SH M Übergangsstück AG, d = 35 x R 11/4',
       11.25, 'r-f-shop', now(),
       null, false, 'R+F', 'Stk', true, true, false
 where not exists (select 1 from public.shop_artikel where artikelnr = '7085972354000');

-- 2. Die Stammdaten-Bruecke richtigstellen.
with korrektur(gut_nr, rf_nr) as (values
  ('POVT35',        '7020900558659'),
  ('POVT3515',      '7020900558741'),
  ('POVT2815',      '7020900558710'),
  ('COCIUS3525ANL', '7085972353000'),
  ('COCIUS3532ANL', '7085972354000')
)
insert into public.shop_gut_rf_zuordnung
  (gut_artikelnummer, rf_artikelnummer, entscheidung, bemerkung)
select k.gut_nr, k.rf_nr, 'zugeordnet',
       'Fehlzuordnung am Shop belegt und korrigiert (15.09.2026)'
  from korrektur k
on conflict (gut_artikelnummer) do update
   set rf_artikelnummer = excluded.rf_artikelnummer,
       bemerkung = excluded.bemerkung,
       stand = now();

-- 3. Die Verbrauchspositionen mitziehen -- daraus rechnen die Mischsaetze.
with korrektur(gut_nr, rf_nr) as (values
  ('POVT35',        '7020900558659'),
  ('POVT3515',      '7020900558741'),
  ('POVT2815',      '7020900558710'),
  ('COCIUS3525ANL', '7085972353000'),
  ('COCIUS3532ANL', '7085972354000')
)
update public.shop_gut_positionen p
   set rf_artikelnummer = k.rf_nr,
       rf_ek_netto_stueck =
         (select s.preis_netto from public.shop_artikel s where s.artikelnr = k.rf_nr),
       rf_zuordnung_quelle = 'manuell',
       rf_zuordnung_stand = now()
  from korrektur k
 where p.artikelnummer = k.gut_nr;

-- 4. Die drei Prestabo-Artikel gehoeren jetzt eindeutig zur Presse-Klasse
--    (reine T-Stuecke ohne Gewinde) -- die Einordnung der R+F-Artikel folgt.
insert into public.shop_artikel
  (artikelnr, name, preis_netto, preis_quelle, preis_stand,
   bild_ist_extern, lieferant, einheit, aktiv, sichtbar_aufmass, bestellbar)
select v.nr, v.name, v.preis, 'r-f-shop', now(), false, 'R+F', 'Stk', true, true, false
  from (values
    ('7020900558659', 'Prestabo-T-Stück mit SC-Contur, aus unlegiertem Stahl, 35 mm', 9.67),
    ('7020900558741', 'Prestabo-T-Stück mit SC-Contur, aus unlegiertem Stahl, 35 x 15 x 35 mm', 9.47),
    ('7020900558710', 'Prestabo-T-Stück mit SC-Contur, aus unlegiertem Stahl, 28 x 15 x 28 mm', 6.35)
  ) as v(nr, name, preis)
 where not exists (select 1 from public.shop_artikel s where s.artikelnr = v.nr);

update public.shop_artikel set
    formteil_system = 'prestabo-stahl', formteil_preisklasse = 'presse',
    formteil_dimensionsgruppe = case when artikelnr = '7020900558710'
      then '22-28mm' else '35mm und groesser' end,
    updated_at = now()
 where artikelnr in ('7020900558659', '7020900558741', '7020900558710')
   and not formteil_aufmass;

update public.shop_artikel set
    formteil_system = 'connect-inox', formteil_dimensionsgruppe = '35mm und groesser',
    formteil_preisklasse = 'gewinde', updated_at = now()
 where artikelnr in ('7085972353000', '7085972354000') and not formteil_aufmass;

-- Kontrolle: die betroffenen Saetze vorher/nachher vergleicht der Aufrufer;
-- hier nur der neue Stand.
select formteil_system, dimensionsgruppe, preisklasse,
       round(ek_stueck_mengengewichtet, 4) as satz, herkunft, menge_gesamt
  from public.shop_formteil_gruppenpreis_effektiv
 where (formteil_system = 'prestabo-stahl' and dimensionsgruppe = '35mm und groesser')
    or (formteil_system = 'connect-inox')
 order by 1, 2, 3;
