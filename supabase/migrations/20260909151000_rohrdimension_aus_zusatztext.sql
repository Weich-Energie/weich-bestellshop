-- Nachtrag zu 20260909150000: bei Connect-Inox steht die Rohrdimension im
-- ZWEITEN Beschreibungsfeld ("CONNECT INOX HEAT Uebergangsstueck" /
-- "35 x 1\" AG 1.4307 CONEL"). Die erste Korrektur durchsuchte nur
-- beschreibung1 und lief daher ins Leere.
update public.shop_gut_artikel_klassifikation k
set rohrdimension = m.mm,
    dimension = m.mm || '×' || k.dimension
from (
  select b.artikelnummer,
         (regexp_match(b.text, '\y(1[2-9]|2[0-9]|3[0-9]|4[0-9]|5[0-4])\s*(?:mm)?\s*[x×]'))[1] || 'mm' as mm
  from (select artikelnummer,
               max(beschreibung1) || ' ' || max(coalesce(beschreibung2, '')) as text
        from public.shop_gut_positionen group by artikelnummer) b
) m
where m.artikelnummer = k.artikelnummer
  and k.kategorie = 'formteil'
  and m.mm is not null
  and k.dimension is not null
  and k.dimension !~ 'mm'
  and k.formteil_system not in ('rotguss-gewinde', 'gewinde-schwarz');

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
