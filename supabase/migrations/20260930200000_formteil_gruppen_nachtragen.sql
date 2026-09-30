-- Formteil-Gruppen der Zählliste nachtragen und zwei Fehlzuordnungen räumen
-- (30.09.2026)
--
-- Gefunden beim Ordnen der Zählliste (Migration 20260930190000). Drei Sachen:
--
-- 1. `M T-Stück IG d = 35 x Rp 1/2` trug die Preisklasse **presse**, obwohl es
--    ein Rp-Gewinde hat. Das Gegenstück in d = 28 steht korrekt auf `gewinde`.
-- 2. Zwei Doppelnippel **DN 15** trugen die Gruppe `1" und groesser` —
--    Nachwirkung der Längen-statt-Anschluss-Falle vom 17.09.2026.
-- 3. 19 Formteile hatten **gar keine** Gruppe. Es sind die Zeilen, die nach den
--    Gruppen-Migrationen vom 15.09. dazukamen (Korrekturen des 17.09. und
--    Artikel aus der R+F-Suchleiste). Sie werden im Aufmaß gezählt, fielen aber
--    aus `shop_mischsatz_ist` heraus — die Gegenprüfung der Mischsätze war
--    damit unvollständig, und genau die läuft gerade.
--
-- Die **Soll**-Sätze bleiben unberührt: `shop_formteil_gruppenpreis` rechnet
-- aus `shop_gut_artikel_klassifikation` und `shop_gut_positionen`, also aus der
-- GUT-Historie, nicht aus `shop_artikel`. Hier ändert sich die **Ist**-Seite.
--
-- Nebenwirkung, die gewollt ist: `aufmass_position_pds_topf` entscheidet über
-- `formteil_system is not null`, ob eine Zeile in die Leistung „Rohre und
-- Formteile" oder als eigene Artikelposition in den PDS-Auftrag geht. Die 19
-- wandern damit in die Leistung — dort gehören sie hin.
--
-- Systemrohre bleiben bewusst ohne Gruppe (vier Stück, dazu die Verschraubung
-- Nr. 330): eine Gruppe wäre dort eine Doppelzählung. Das Namensmuster unten
-- fasst sie deshalb nicht an.

-- ─── 1) Preisklasse: Gewinde im Namen heisst gewinde ──────────────────────
update public.shop_artikel a
   set formteil_preisklasse = 'gewinde'
 where a.formteil_system is not null
   and a.formteil_preisklasse = 'presse'
   and a.name ~* '\m(R|Rp)\s*\d|\mIG\M|\mAG\M';

-- ─── 2) Doppelnippel: Gruppe aus der Nennweite, nicht aus der Laenge ──────
update public.shop_artikel a
   set formteil_dimensionsgruppe =
         case when public.aufmass_dimension_mm(a.name) <= 20
              then 'bis 3/4"' else '1" und groesser' end
 where a.formteil_system = 'rotguss-gewinde'
   and a.name ilike '%Doppelnippel%'
   and public.aufmass_dimension_mm(a.name) < 9999
   and a.formteil_dimensionsgruppe is distinct from
         case when public.aufmass_dimension_mm(a.name) <= 20
              then 'bis 3/4"' else '1" und groesser' end;

-- ─── 3) Fehlende Gruppen nachtragen ───────────────────────────────────────
-- System aus der Marke, Gruppe aus der Dimension, Klasse aus dem Gewinde.
-- Geschrieben wird nur, wenn es die Kombination als Preisgruppe **schon gibt**
-- (Join gegen shop_formteil_gruppenpreis_effektiv) — sonst entstuende eine
-- Ist-Gruppe ohne Soll-Satz, die in shop_mischsatz_vergleich ins Leere zeigt.
with kandidat as (
  select distinct
         a.id, a.name,
         case
           when a.name ilike '%OptiSteel%'                                   then 'connect-inox'
           when a.name ilike '%PROFIPRESS%' or a.name ilike '%Sanpress%'
             or a.name ilike '%Sudo%'                                        then 'b-press-kupfer'
           when a.name ilike '%Prestabo%'                                    then 'prestabo-stahl'
           when a.name ilike '%Uponor%'                                      then 'uponor-mlc'
           when a.name ilike '%RG/CuSi%'   or a.name ilike '%Rotguss%'       then 'rotguss-gewinde'
         end as system,
         public.aufmass_dimension_mm(a.name) as dim_mm,
         case when a.name ~* '\m(R|Rp)\s*\d|\mIG\M|\mAG\M'
              then 'gewinde' else 'presse' end as klasse
    from public.aufmass_kategorie_position p
    join public.aufmass_kategorie k on k.id = p.kategorie_id
    join public.shop_artikel a on a.id = p.artikel_id
   where p.aktiv and k.aktiv and k.ansicht = 'detail'
     and a.formteil_dimensionsgruppe is null
     and a.name ~* 'bogen|t-st(ü|ue)ck|muffe|reduzier|(ü|ue|Ü)bergang|nippel'
     and a.name !~* 'systemrohr|gewindemuffe|abflussrohr|silent-pp|comfort pp'
), mit_gruppe as (
  select kandidat.*,
         case
           when system in ('rotguss-gewinde', 'gewinde-schwarz')
             then case when dim_mm <= 20 then 'bis 3/4"' else '1" und groesser' end
           -- Uponor hat eigene Staffelung: 16-20 und 25-32.
           when system = 'uponor-mlc'
             then case when dim_mm <= 20 then '16-20mm' else '25-32mm' end
           when dim_mm <= 18 then 'bis 18mm'
           when dim_mm <= 28 then '22-28mm'
           else                   '35mm und groesser'
         end as gruppe
    from kandidat
   where system is not null and dim_mm < 9999
)
update public.shop_artikel a
   set formteil_system        = m.system,
       formteil_dimensionsgruppe = m.gruppe,
       formteil_preisklasse   = m.klasse
  from mit_gruppe m
 where a.id = m.id
   and exists (
     select 1 from public.shop_formteil_gruppenpreis_effektiv g
      where g.formteil_system = m.system
        and g.dimensionsgruppe = m.gruppe
        and g.preisklasse = m.klasse
   );

-- ─── Kontrolle ────────────────────────────────────────────────────────────
-- Was bleibt: Formteile in der Zaehlliste, die weiter ohne Gruppe stehen.
-- Erwartet sind nur Systeme ohne Mischsatz (Abwasser-PP, Uponor-Sonderteile).
select coalesce(a.formteil_system, '(ohne System)') as system,
       count(*) as ohne_gruppe,
       left(string_agg(a.name, ' | '), 120) as beispiele
  from public.aufmass_kategorie_position p
  join public.aufmass_kategorie k on k.id = p.kategorie_id
  join public.shop_artikel a on a.id = p.artikel_id
 where p.aktiv and k.aktiv and k.ansicht = 'detail'
   and a.formteil_dimensionsgruppe is null
   and a.name ~* 'bogen|t-st(ü|ue)ck|muffe|reduzier|(ü|ue|Ü)bergang|nippel'
   and a.name !~* 'systemrohr|gewindemuffe|abflussrohr|silent-pp|comfort pp'
 group by 1 order by 2 desc;
