-- Bereinigung der Klassifikation, gefunden beim Zuschnitt der Strichliste
-- (09.09.2026). Drei Muster:
--
-- 1) Modellnummer in der Dimension: "Stopfen Nr.290 1/2\"" wurde als Dimension
--    "290 1/2\"" gelesen. Dadurch landete ein 1/2-Zoll-Stopfen in der Gruppe
--    "1\" und groesser".
-- 2) Sanpress-Artikel lagen unter 'rotguss-gewinde'. Sanpress ist die
--    Trinkwasser-Linie derselben Pressfitting-Familie wie Profipress und
--    gehoert zu 'b-press-kupfer'.
-- 3) Lueftungs- und Abflussteile (Wickelfalz, VALL-Isolierbogen, CONEL DRAIN,
--    Silent-PP) waren als 'formteil' klassifiziert. Sie sind kein
--    Heizungs-Verbindungsmaterial und haben in der Mittelwertbildung nichts
--    verloren.

-- ─── 1) Modellnummer aus der Dimension entfernen ──────────────────────────
update public.shop_gut_artikel_klassifikation
set dimension = trim(regexp_replace(dimension, '^\d{3,4}\s+', '')),
    rohrdimension = trim(regexp_replace(coalesce(rohrdimension, dimension), '^\d{3,4}\s+', ''))
where kategorie = 'formteil' and dimension ~ '^\d{3,4}\s';

-- ─── 2) Sanpress gehoert zur Kupfer-Pressfitting-Familie ──────────────────
update public.shop_gut_artikel_klassifikation k
set formteil_system = 'b-press-kupfer'
from (select artikelnummer, max(beschreibung1) as text
      from public.shop_gut_positionen group by artikelnummer) b
where b.artikelnummer = k.artikelnummer
  and k.kategorie = 'formteil'
  and k.formteil_system <> 'b-press-kupfer'
  and (b.text ilike '%sanpress%' or b.text ilike '%profipress%');

-- ─── 3) Lueftung und Abfluss sind keine Heizungs-Formteile ────────────────
update public.shop_gut_artikel_klassifikation k
set kategorie = 'sonstiges', formteil_system = null, dimension = null,
    dimensionsgruppe = null, rohrdimension = null, preisklasse = null
from (select artikelnummer, max(beschreibung1) as text
      from public.shop_gut_positionen group by artikelnummer) b
where b.artikelnummer = k.artikelnummer
  and k.kategorie = 'formteil'
  and (b.text ilike '%wickelfalz%' or b.text ilike '%vall %' or b.text ilike '%iso-bogen%'
    or b.text ilike '%conel drain%' or b.text ilike '%silent pp%' or b.text ilike '%silent-pp%'
    or b.text ilike '%dämpfungssockel%' or b.text ilike '%daempfungssockel%');

-- ─── Dimensionsgruppe nach der Bereinigung neu setzen ─────────────────────
update public.shop_gut_artikel_klassifikation
set rohrdimension = coalesce(substring(dimension from '(\d+mm)'), dimension)
where kategorie = 'formteil' and dimension is not null;

update public.shop_gut_artikel_klassifikation
set dimensionsgruppe = case
      when formteil_system = 'uponor-mlc' then
        case when rohrdimension in ('16mm', '20mm') then '16-20mm'
             when rohrdimension in ('25mm', '32mm') then '25-32mm'
             else coalesce(rohrdimension, 'ohne Mass') end
      when formteil_system in ('rotguss-gewinde', 'gewinde-schwarz') then
        case when rohrdimension ~ '^(1/2|3/8|3/4)' then 'bis 3/4"'
             else '1" und groesser' end
      when rohrdimension ~ '^(12|15|16|18)mm' then 'bis 18mm'
      when rohrdimension ~ '^(20|22|25|28)mm' then '22-28mm'
      when rohrdimension ~ '^(32|35|42|54)mm' then '35mm und groesser'
      when rohrdimension ~ '^(1/2|3/8|3/4)' then 'bis 3/4"'
      when rohrdimension is not null then '1" und groesser'
      else 'ohne Mass'
    end
where kategorie = 'formteil';
