-- Die 25 neu zugeordneten Artikel einordnen (15.09.2026)
--
-- Patricks 36 Zuordnungen vom 15.09.2026 betreffen GUT-Artikel ohne Verbrauch,
-- die deshalb nie klassifiziert wurden -- ihre R+F-Gegenstuecke trugen keine
-- Formteil-Gruppe. Fuer die kalkulierten Mischsaetze ist das ohne Folge (kein
-- Verbrauch, kein Gewicht), fuer den Ist-Satz aus einem Einzelaufmass aber
-- entscheidend: zaehlt ein Monteur einen Bogen 90 d=28, muss er in
-- "Edelstahl / 22-28mm / presse" einfliessen.
--
-- Jede Zeile ist am R+F-Artikelnamen abgelesen und gegen die vorhandenen
-- Gruppen des Systems geprueft (b-press-kupfer hat zusaetzlich "bis 18mm",
-- Gewinde schwarz und Rotguss kennen nur Zollgruppen, Uponor 16-20 und 25-32).
--
-- Fuenf Artikel bleiben BEWUSST ohne Gruppe:
--   COCIR22NL: Systemrohr, kein Formteil -- Rohre sind Einzelartikel
--   COCIR28NL: Systemrohr, kein Formteil -- Rohre sind Einzelartikel
--   COCIR35NL: Systemrohr, kein Formteil -- Rohre sind Einzelartikel
--   CUS18H: Kupferrohr, kein Formteil -- Rohre sind Einzelartikel
--   330S15: Verschraubung: am 11.09.2026 bewusst aus den Gruppenpreisen genommen (zog gewinde-schwarz von 2,36 auf 1,42 EUR). Eine Gruppe hier waere eine Doppelzaehlung.

with einordnung(rf_nr, system, dimensionsgruppe, preisklasse) as (values
  ('1014056400000', 'rotguss-gewinde', '1" und groesser', 'gewinde'),   -- 330132
  ('7085402280000', 'connect-inox', '22-28mm', 'presse'),   -- COCIB28KNL
  ('7085907280000', 'connect-inox', '22-28mm', 'presse'),   -- COCIB28ELKNL
  ('7085922280000', 'connect-inox', '22-28mm', 'presse'),   -- COCIB2845KNL
  ('7085470220000', 'connect-inox', '22-28mm', 'presse'),   -- COCIM22NL
  ('7085470280000', 'connect-inox', '22-28mm', 'presse'),   -- COCIM28NL
  ('7085430220000', 'connect-inox', '22-28mm', 'presse'),   -- COCIT22NL
  ('7085430280000', 'connect-inox', '22-28mm', 'presse'),   -- COCIT28NL
  ('7085429221000', 'connect-inox', '22-28mm', 'gewinde'),   -- COCIT2215INL
  ('7085429281000', 'connect-inox', '22-28mm', 'gewinde'),   -- COCIT2815INL
  ('7085972221000', 'connect-inox', '22-28mm', 'gewinde'),   -- COCIUS2215ANL
  ('7085972222000', 'connect-inox', '22-28mm', 'gewinde'),   -- COCIUS2220ANL
  ('7085472223000', 'connect-inox', '22-28mm', 'gewinde'),   -- COCIUS2225ANL
  ('7085973222000', 'connect-inox', '22-28mm', 'gewinde'),   -- COCIUS2220INL
  ('7085973223000', 'connect-inox', '22-28mm', 'gewinde'),   -- COCIUS2225INL
  ('7085973283000', 'connect-inox', '22-28mm', 'gewinde'),   -- COCIUS2825INL
  ('7085973284000', 'connect-inox', '22-28mm', 'gewinde'),   -- COCIUS2832INL
  ('7085973354000', 'connect-inox', '35mm und groesser', 'gewinde'),   -- COCIUS3532INL
  ('1012102183000', 'b-press-kupfer', 'bis 18mm', 'presse'),   -- BPT1815
  ('1012102227000', 'b-press-kupfer', '22-28mm', 'presse'),   -- BPT222215
  ('1012103151000', 'b-press-kupfer', 'bis 18mm', 'gewinde'),   -- BPT1515I
  ('1012105284000', 'b-press-kupfer', '22-28mm', 'gewinde'),   -- BPUS2832I
  ('7075430100000', 'gewinde-schwarz', 'bis 3/4"', 'gewinde'),   -- 300S15
  ('1029201070550', 'uponor-mlc', '25-32mm', 'presse'),   -- UCPK32N
  ('1029201070595', 'uponor-mlc', '16-20mm', 'gewinde')   -- UCPT1615IN
)
update public.shop_artikel a
   set formteil_system = e.system,
       formteil_dimensionsgruppe = e.dimensionsgruppe,
       formteil_preisklasse = e.preisklasse,
       updated_at = now()
  from einordnung e
 where a.artikelnr = e.rf_nr and not a.formteil_aufmass;

-- Kontrolle: Zeilen der Zaehlliste mit und ohne Gruppe, nach Lage getrennt.
select case
         when a.formteil_system is not null then 'Gruppe gesetzt'
         when kl.kategorie is not null then 'kein Formteil (' || kl.kategorie || ')'
         when z.gut_artikelnummer is null then 'Regal-Artikel ohne Historie'
         else 'OFFEN' end as lage,
       count(distinct a.id) as artikel
  from public.aufmass_kategorie_position p
  join public.aufmass_kategorie k on k.id = p.kategorie_id
  join public.shop_artikel a on a.id = p.artikel_id
  left join public.shop_gut_rf_zuordnung z on z.rf_artikelnummer = a.artikelnr
  left join public.shop_gut_artikel_klassifikation kl on kl.artikelnummer = z.gut_artikelnummer
 where k.ansicht = 'detail' and p.aktiv
 group by 1 order by 2 desc;
