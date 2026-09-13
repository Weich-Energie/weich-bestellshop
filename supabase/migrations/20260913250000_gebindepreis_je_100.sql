-- Gebindepreis auf Stückpreis umrechnen: Schellen und Dichtungen.
--
-- Patrick, 13.09.2026: "die schellen und dichtungen sind denke ich pro 100".
-- Das passt zu den Zahlen. GUT fuehrt diese Artikel mit Mengeneinheit "Stueck"
-- und Verpackungseinheit "Beutel", der Preis gilt aber offenbar je Beutel zu
-- 100 Stueck:
--
--   Artikel         GUT je Stueck   /100     R+F je Stueck
--   CCLRST19             50,90      0,509         0,61
--   CCLRST25             52,07      0,521         0,38
--   CCLRST30             57,79      0,578         0,71
--   CCLRST37             60,78      0,608         0,43
--   CCLR35               53,94      0,539         0,43
--   DTWFV2434            24,61      0,246         0,44
--   DTWFV3234            30,24      0,302         0,53
--
-- Nach der Division liegen alle in derselben Groessenordnung wie der
-- R+F-Preis. Vorher war der GUT-Preis das 56- bis 141-fache.
--
-- ek_netto_stueck wird zum echten Stueckpreis, damit alle bestehenden
-- Auswertungen ohne Aenderung richtig rechnen. Der Originalwert und die
-- Gebindegroesse bleiben in zwei neuen Spalten erhalten.

alter table public.shop_gut_positionen
  add column if not exists ek_netto_stueck_original numeric(12,4),
  add column if not exists gebindegroesse integer;

comment on column public.shop_gut_positionen.ek_netto_stueck_original is
  'Der Preis, wie GUT ihn exportiert hat. Gesetzt, wo er nachweislich ein '
  'Gebindepreis war und ek_netto_stueck deshalb umgerechnet wurde.';
comment on column public.shop_gut_positionen.gebindegroesse is
  'Stueck je Gebinde, wenn der GUT-Preis ein Gebindepreis war. NULL heisst: '
  'Preis gilt je Stueck.';

update public.shop_gut_positionen
   set ek_netto_stueck_original = ek_netto_stueck,
       gebindegroesse = 100,
       ek_netto_stueck = round(ek_netto_stueck / 100.0, 4),
       ek_netto_gesamt = round(ek_netto_gesamt / 100.0, 2)
 where artikelnummer in ('CCLRST19', 'CCLRST25', 'CCLRST30', 'CCLRST37',
                         'CCLR35', 'DTWFV2434', 'DTWFV3234')
   and gebindegroesse is null;

select p.artikelnummer,
       round(avg(p.ek_netto_stueck_original), 2) as vorher,
       round(avg(p.ek_netto_stueck), 3) as jetzt,
       round(avg(p.rf_ek_netto_stueck), 2) as rf,
       round(sum(p.menge)) as menge,
       round(sum(p.ek_netto_stueck * p.menge)::numeric, 0) as wert_neu
  from public.shop_gut_positionen p
 where p.gebindegroesse = 100
 group by p.artikelnummer order by 1;
