-- Korrektur meiner eigenen Korrektur von eben.
--
-- Bei den sieben Gebinde-Artikeln habe ich nicht nur ek_netto_stueck, sondern
-- auch ek_netto_gesamt durch 100 geteilt. Das war falsch.
--
-- Nachgesehen: GUT exportiert zwei Felder, und nur eines war ein Gebindewert.
--   netPrice  -> ek_netto_stueck   = Preis je BEUTEL   (60,78 fuer CCLRST37)
--   netValue  -> ek_netto_gesamt   = Wert der Position je STUECK (12,00 fuer 20)
-- 12,00 / 20 = 0,60 je Schelle, und das passt zum R+F-Preis.
--
-- Folge: ek_netto_gesamt war von Anfang an richtig und wird zurueckgedreht.
-- ek_netto_stueck bleibt umgerechnet, dort war der Gebindepreis drin.
--
-- Und die wichtigere Folge fuer alles, was ich heute berichtet habe: der
-- historische Verbrauchswert von 150 443 EUR war immer richtig, er rechnet mit
-- ek_netto_gesamt. Meine Lueckenlisten haben dagegen ek_netto_stueck * menge
-- gerechnet und die sieben Gebinde-Artikel damit um das Hundertfache zu hoch
-- ausgewiesen. Die 35 689 EUR fuer die CONEL-Schellen waren in Wahrheit rund
-- 357 EUR.

update public.shop_gut_positionen
   set ek_netto_gesamt = round(ek_netto_gesamt * 100.0, 2)
 where gebindegroesse = 100;

select round(sum(ek_gesamt)::numeric, 0) as verbrauchswert_gesamt
  from public.shop_gut_verbrauch_je_artikel;
