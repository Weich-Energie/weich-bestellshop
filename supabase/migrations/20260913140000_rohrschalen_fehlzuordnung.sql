-- Rohrschalen: falsche Daemmdicke zugeordnet.
--
-- Die Textsuche hatte zwei GUT-Rohrschalen auf 1005520089100 gelegt —
-- "Rockwool Heizungsrohrschale 800 fuer Rohr 89 mm, Daemmdicke 100 mm",
-- 33,28 EUR. Gesucht waren Rohr 35 bzw. 28 mm mit Daemmdicke 30 mm.
-- Beide Artikel gibt es bei R+F, auf derselben Produktseite als Ausfuehrung:
--
--   RORS8003530  Rohrschale 800 35/30mm  -> 1005520035030   6,39 EUR
--   RORS8002830  Rohrschale 800 28/30mm  -> 1005520028030   6,08 EUR
--
-- Wirkung: 1124 bzw. 49 Stueck trugen 33,28 EUR statt 6,39 bzw. 6,08 EUR.
-- Das sind 31 557 EUR zu viel im Verbrauchswert der Nachkalkulation — der
-- groesste Einzelfehler im ganzen Datenbestand. Die Mischsaetze beruehrt es
-- nicht, Daemmung bildet keine Formteil-Gruppe.
--
-- Nachgeschlagen am 13.09.2026 direkt im R+F-Shop (Titel und Preis der
-- Produktseite), nicht geschaetzt. Quelle bleibt 'vermutet' auf 'manuell'
-- gesetzt, weil die Zuordnung jetzt von Hand geprueft ist.

update public.shop_gut_positionen
   set rf_artikelnummer = '1005520035030',
       rf_ek_netto_stueck = 6.39,
       rf_zuordnung_quelle = 'manuell',
       rf_zuordnung_stand = now()
 where artikelnummer = 'RORS8003530'
   and rf_artikelnummer = '1005520089100';

update public.shop_gut_positionen
   set rf_artikelnummer = '1005520028030',
       rf_ek_netto_stueck = 6.08,
       rf_zuordnung_quelle = 'manuell',
       rf_zuordnung_stand = now()
 where artikelnummer = 'RORS8002830'
   and rf_artikelnummer = '1005520089100';

select p.artikelnummer,
       regexp_replace(left(max(p.beschreibung1), 40), '[[:space:]]+', ' ', 'g') as text,
       max(p.rf_artikelnummer) as rf_nr,
       round(avg(p.rf_ek_netto_stueck), 2) as ek,
       round(sum(p.menge)) as menge,
       round(sum(p.rf_ek_netto_stueck * p.menge)::numeric, 0) as wert_neu
  from public.shop_gut_positionen p
 where p.artikelnummer in ('RORS8003530', 'RORS8002830')
 group by p.artikelnummer;
