-- Formteil-Gruppe an die R+F-Artikel schreiben (15.09.2026)
--
-- Zweck: die Mischkostensaetze gegen echte Einzelaufmasse pruefen. Dazu muss
-- jede gezaehlte R+F-Position wissen, welcher Formteil-Gruppe sie angehoert --
-- sonst laesst sich aus einem Aufmass kein Ist-Satz rechnen. Bisher stand die
-- Gruppe nur an den GUT-Artikeln (shop_gut_artikel_klassifikation); ueber
-- shop_gut_rf_zuordnung ist sie jetzt auf die R+F-Seite uebertragbar.
--
-- Die Spalten formteil_system / formteil_dimensionsgruppe /
-- formteil_preisklasse gibt es an shop_artikel schon -- sie tragen bei den
-- 29 Kunstartikeln (formteil_aufmass = true) deren Gruppe. Die bleiben
-- unberuehrt: hier werden nur echte Artikel eingeordnet.

-- 1. Die eindeutigen Faelle. Eindeutig heisst: alle GUT-Artikel, die auf
--    diesen R+F-Artikel zeigen, nennen dieselbe Gruppe.
with gruppe as (
  select z.rf_artikelnummer,
         min(kl.formteil_system)   as system,
         min(kl.dimensionsgruppe)  as dimensionsgruppe,
         min(kl.preisklasse)       as preisklasse
    from public.shop_gut_rf_zuordnung z
    join public.shop_gut_artikel_klassifikation kl
      on kl.artikelnummer = z.gut_artikelnummer
   where z.rf_artikelnummer is not null
     and kl.kategorie = 'formteil'
     and kl.formteil_system is not null
     and kl.dimensionsgruppe is not null
     and kl.preisklasse is not null
   group by z.rf_artikelnummer
  having count(distinct kl.formteil_system || '|' || kl.dimensionsgruppe
                        || '|' || kl.preisklasse) = 1
)
update public.shop_artikel a
   set formteil_system = g.system,
       formteil_dimensionsgruppe = g.dimensionsgruppe,
       formteil_preisklasse = g.preisklasse,
       updated_at = now()
  from gruppe g
 where a.artikelnr = g.rf_artikelnummer
   and not a.formteil_aufmass;

-- 2. Die drei mehrdeutigen Faelle, jeder am R+F-Artikelnamen entschieden --
--    nicht per Automatik, weil die Mehrdeutigkeit aus falschen GUT-Zuordnungen
--    stammt und nicht aus einer echten Doppelnatur des Artikels:
--
--    7020900558918 "Prestabo-T-Stueck ... mit IG", 28 mm -> gewinde.
--      POVT2815I (mit IG) passt, POVT2815 (ohne IG) ist dort falsch zugeordnet.
--    7020900558932 "Prestabo-T-Stueck ... mit IG", 35 mm -> gewinde.
--      POVT3515I passt; POVT35 und POVT3515 (ohne IG) sind falsch zugeordnet.
--    7085472283000 "OptiSteel Uebergangsstueck AG, d = 28" -> 22-28mm.
--      Die 28er GUT-Artikel passen; COCIUS3525ANL (35 mm) ist falsch zugeordnet.
--
--    Die falschen Zuordnungen selbst sind NICHT hier korrigiert -- dafuer muss
--    erst der richtige R+F-Artikel gefunden werden. Hebel: POVT35 1 655 EUR /
--    148 Stueck, COCIUS3525ANL 486 EUR / 56 Stueck.
update public.shop_artikel set
    formteil_system = 'prestabo-stahl',
    formteil_dimensionsgruppe = '22-28mm',
    formteil_preisklasse = 'gewinde', updated_at = now()
 where artikelnr = '7020900558918' and not formteil_aufmass;

update public.shop_artikel set
    formteil_system = 'prestabo-stahl',
    formteil_dimensionsgruppe = '35mm und groesser',
    formteil_preisklasse = 'gewinde', updated_at = now()
 where artikelnr = '7020900558932' and not formteil_aufmass;

update public.shop_artikel set
    formteil_system = 'connect-inox',
    formteil_dimensionsgruppe = '22-28mm',
    formteil_preisklasse = 'gewinde', updated_at = now()
 where artikelnr = '7085472283000' and not formteil_aufmass;

-- Kontrolle: wie viele Zeilen der Zaehlliste tragen jetzt eine Gruppe?
select case
         when a.formteil_system is not null and a.formteil_dimensionsgruppe is not null
           then 'Gruppe gesetzt'
         else 'ohne Gruppe' end as stand,
       count(distinct a.id) as artikel
  from public.aufmass_kategorie_position p
  join public.aufmass_kategorie k on k.id = p.kategorie_id
  join public.shop_artikel a on a.id = p.artikel_id
 where k.ansicht = 'detail' and p.aktiv
 group by 1 order by 2 desc;
