-- Patricks R+F-Nummern zu den offenen Zaehllisten-Positionen (15.09.2026)
--
-- Zu den 49 Positionen aus daten/zaehllisten-offene-positionen.csv, fuer die
-- keine R+F-Zuordnung gefunden wurde, hat Patrick entschieden: 36 bekommen
-- eine Nummer, 13 entfallen. Das ist seine Entscheidung, keine Vermutung --
-- Quelle deshalb 'manuell', die hoechste Stufe der Rangfolge.
--
-- Drei Eintraege sind korrigiert, jede Korrektur am Shop belegt:
--   COCIB2845KNL: 7,08592E+12 -> 7085922280000
--   COCIB28ELKNL: 7085907540000 -> 7085907280000
--   COCIT22NL: 7085429221000 -> 7085430220000
--   COCIB2845KNL: Excel hatte die Nummer zu 7,08592E+12 gerundet. Rekonstruiert
--     als 7085922280000 = "OptiSteel simplesta SH M Bogen 45 I/I d = 28" --
--     passt zur Rundung und zum gesuchten Teil.
--   COCIB28ELKNL: 7085907540000 ist der Bogen 90 I/A in d = 54. Gesucht sind
--     28 mm, und 54 mm wird nicht verbaut. Das Gegenstueck 7085907280000
--     (5,32 EUR) steht in den Ausfuehrungen derselben Produktseite.
--   COCIT22NL: trug dieselbe Nummer wie COCIT2215INL, naemlich das T-Stueck
--     MIT Innengewinde. Das reine "T-Stueck 22mm" ist 7085430220000 (4,81 EUR)
--     -- analog zu COCIT28NL, das Patrick selbst auf das reine T-Stueck d = 28
--     gesetzt hat.
--
-- Gemessen vor dem Schreiben: die vier connect-inox-Artikel mit Verbrauch
-- stecken in Mischsaetzen, aber die Edelstahl-Saetze aendern sich NICHT
-- (22-28 Presse 4,1210 / Gewinde 6,4450, 35+ Presse 7,6443 / Gewinde 8,8133
-- vor und nach dem Schreiben). Sie kommen aus dem uebertragenen
-- C-Stahl-Mengengeruest in shop_formteil_gruppenpreis_uebertragen, nicht aus
-- dem Edelstahl-Verbrauch.

-- 1. Die 21 Artikel, die im Katalog noch fehlten. Preise sind Shop-Listenpreise
--    (preis_quelle 'r-f-shop') und damit schlechter als Lager- oder
--    Rechnungspreise -- bestehende Preise werden deshalb nicht angetastet.
with neu(artikelnr, name, preis, bild) as (values
  ('7085470220000', 'OptiSteel simplesta SH V Muffe d = 22', 2.26, 'https://prd-cc.rf24.de/medias/50eda7439216fc54c11bed845f65c050.jpg?context=bWFzdGVyfGltYWdlc3wyNDk0NHxpbWFnZS9qcGVnfGFEVTNMMmhqT1M4NU9Ea3dNRGMzTnpZNU56VTRMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlXWDAxMVptWmxYemd3TUM1cWNHY3w0ZWJjYzVjNTZlYzJmYjQyNTY0OTI1NTU0NTBjZDVhOTEwOGE1ZTRlNjZjMzY2YTAwMzgyYjAzZmMxZjliYWEz'),
  ('7085992220000', 'OptiSteel simplesta SH Systemrohr 1.4520, 22 x 1,20 mm Stange= 6 m', 3.78, 'https://prd-cc.rf24.de/medias/a65a34690e7d284805567c99e7fbcdff.jpg?context=bWFzdGVyfGltYWdlc3wyMDgyMHxpbWFnZS9qcGVnfGFETTRMMmc0Tmk4NU56VTNPVEF5TmpZM09EQTJMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlUZVhOMFpXMXliMmh5WDBWa1pXeHpkR0ZvYkY4eExqUTFNakJmT0RBd0xtcHdad3w0YjZjZTQxOGM2M2JmODZmZjA4MmI3NjM1MzdlN2U3MTgwMmNkODA0YmM5YmRmMjJiNDI0OTI4ZWU4NmRjYTI4'),
  ('7085992280000', 'OptiSteel simplesta SH Systemrohr 1.4520, 28 x 1,20 mm Stange = 6 m', 4.55, 'https://prd-cc.rf24.de/medias/a65a34690e7d284805567c99e7fbcdff.jpg?context=bWFzdGVyfGltYWdlc3wyMDgyMHxpbWFnZS9qcGVnfGFETTRMMmc0Tmk4NU56VTNPVEF5TmpZM09EQTJMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlUZVhOMFpXMXliMmh5WDBWa1pXeHpkR0ZvYkY4eExqUTFNakJmT0RBd0xtcHdad3w0YjZjZTQxOGM2M2JmODZmZjA4MmI3NjM1MzdlN2U3MTgwMmNkODA0YmM5YmRmMjJiNDI0OTI4ZWU4NmRjYTI4'),
  ('7085973223000', 'OptiSteel simplesta SH M ÜbergangsMuffe IG, d = 22 x Rp 1', 5.28, 'https://prd-cc.rf24.de/medias/9eb4c7fad9d77eaf3942617e5c2cb7fd.jpg?context=bWFzdGVyfGltYWdlc3wyNzY5N3xpbWFnZS9qcGVnfGFHUTNMMmhoTlM4NU56VTNPVEEwTmprNU5ESXlMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOdGRXWm1aVjlKUjE4NE1EQXVhbkJufDY0MTRhNzVhYTRmYjI1MDdkMmY3OWU1OWM1NTRjMzMxYjljYzMyZTQxYzNjYzc5MTNlMTllMWI0MzdjNTNlNjI'),
  ('7085972221000', 'OptiSteel simplesta SH M Übergangsstück AG, d = 22 x R 1/2', 5.28, 'https://prd-cc.rf24.de/medias/11285befcd70a802c680b4971115407b.jpg?context=bWFzdGVyfGltYWdlc3wyNzAwNHxpbWFnZS9qcGVnfGFHSTFMMmc1Wmk4NU56VTNPVEEwT0RNd05EazBMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOemRIVmxZMnRmUVVkZk9EQXdMbXB3Wnd8MGYwZGEyODJmYmUwNDQxNDI2YzI5ZmIzYTNkZDk3YWM3NjA2ZTcyNTE5M2UxMTNiZWNiNzVkYmIxN2FhMDdlYg'),
  ('7085973221000', 'OptiSteel simplesta SH M ÜbergangsMuffe IG, d = 22 x Rp 1/2', 5.28, 'https://prd-cc.rf24.de/medias/9eb4c7fad9d77eaf3942617e5c2cb7fd.jpg?context=bWFzdGVyfGltYWdlc3wyNzY5N3xpbWFnZS9qcGVnfGFHUTNMMmhoTlM4NU56VTNPVEEwTmprNU5ESXlMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOdGRXWm1aVjlKUjE4NE1EQXVhbkJufDY0MTRhNzVhYTRmYjI1MDdkMmY3OWU1OWM1NTRjMzMxYjljYzMyZTQxYzNjYzc5MTNlMTllMWI0MzdjNTNlNjI'),
  ('7085972222000', 'OptiSteel simplesta SH M Übergangsstück AG, d = 22 x R 3/4', 5.28, 'https://prd-cc.rf24.de/medias/11285befcd70a802c680b4971115407b.jpg?context=bWFzdGVyfGltYWdlc3wyNzAwNHxpbWFnZS9qcGVnfGFHSTFMMmc1Wmk4NU56VTNPVEEwT0RNd05EazBMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOemRIVmxZMnRmUVVkZk9EQXdMbXB3Wnd8MGYwZGEyODJmYmUwNDQxNDI2YzI5ZmIzYTNkZDk3YWM3NjA2ZTcyNTE5M2UxMTNiZWNiNzVkYmIxN2FhMDdlYg'),
  ('7085973222000', 'OptiSteel simplesta SH M ÜbergangsMuffe IG, d = 22 x Rp 3/4', 5.28, 'https://prd-cc.rf24.de/medias/9eb4c7fad9d77eaf3942617e5c2cb7fd.jpg?context=bWFzdGVyfGltYWdlc3wyNzY5N3xpbWFnZS9qcGVnfGFHUTNMMmhoTlM4NU56VTNPVEEwTmprNU5ESXlMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOdGRXWm1aVjlKUjE4NE1EQXVhbkJufDY0MTRhNzVhYTRmYjI1MDdkMmY3OWU1OWM1NTRjMzMxYjljYzMyZTQxYzNjYzc5MTNlMTllMWI0MzdjNTNlNjI'),
  ('7085973283000', 'OptiSteel simplesta SH M ÜbergangsMuffe IG, d = 28 x Rp 1', 7.93, 'https://prd-cc.rf24.de/medias/9eb4c7fad9d77eaf3942617e5c2cb7fd.jpg?context=bWFzdGVyfGltYWdlc3wyNzY5N3xpbWFnZS9qcGVnfGFHUTNMMmhoTlM4NU56VTNPVEEwTmprNU5ESXlMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOdGRXWm1aVjlKUjE4NE1EQXVhbkJufDY0MTRhNzVhYTRmYjI1MDdkMmY3OWU1OWM1NTRjMzMxYjljYzMyZTQxYzNjYzc5MTNlMTllMWI0MzdjNTNlNjI'),
  ('7085973282000', 'OptiSteel simplesta SH M ÜbergangsMuffe IG, d = 28 x Rp 3/4', 7.55, 'https://prd-cc.rf24.de/medias/9eb4c7fad9d77eaf3942617e5c2cb7fd.jpg?context=bWFzdGVyfGltYWdlc3wyNzY5N3xpbWFnZS9qcGVnfGFHUTNMMmhoTlM4NU56VTNPVEEwTmprNU5ESXlMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOdGRXWm1aVjlKUjE4NE1EQXVhbkJufDY0MTRhNzVhYTRmYjI1MDdkMmY3OWU1OWM1NTRjMzMxYjljYzMyZTQxYzNjYzc5MTNlMTllMWI0MzdjNTNlNjI'),
  ('7085973284000', 'OptiSteel simplesta SH M ÜbergangsMuffe IG, d = 28 x Rp 11/4', 11.98, 'https://prd-cc.rf24.de/medias/9eb4c7fad9d77eaf3942617e5c2cb7fd.jpg?context=bWFzdGVyfGltYWdlc3wyNzY5N3xpbWFnZS9qcGVnfGFHUTNMMmhoTlM4NU56VTNPVEEwTmprNU5ESXlMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOdGRXWm1aVjlKUjE4NE1EQXVhbkJufDY0MTRhNzVhYTRmYjI1MDdkMmY3OWU1OWM1NTRjMzMxYjljYzMyZTQxYzNjYzc5MTNlMTllMWI0MzdjNTNlNjI'),
  ('7085973353000', 'OptiSteel simplesta SH M ÜbergangsMuffe IG, d = 35 x Rp 1', 10.83, 'https://prd-cc.rf24.de/medias/9eb4c7fad9d77eaf3942617e5c2cb7fd.jpg?context=bWFzdGVyfGltYWdlc3wyNzY5N3xpbWFnZS9qcGVnfGFHUTNMMmhoTlM4NU56VTNPVEEwTmprNU5ESXlMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOdGRXWm1aVjlKUjE4NE1EQXVhbkJufDY0MTRhNzVhYTRmYjI1MDdkMmY3OWU1OWM1NTRjMzMxYjljYzMyZTQxYzNjYzc5MTNlMTllMWI0MzdjNTNlNjI'),
  ('7085972353000', 'OptiSteel simplesta SH M Übergangsstück AG, d = 35 x R 1', 9.76, 'https://prd-cc.rf24.de/medias/11285befcd70a802c680b4971115407b.jpg?context=bWFzdGVyfGltYWdlc3wyNzAwNHxpbWFnZS9qcGVnfGFHSTFMMmc1Wmk4NU56VTNPVEEwT0RNd05EazBMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOemRIVmxZMnRmUVVkZk9EQXdMbXB3Wnd8MGYwZGEyODJmYmUwNDQxNDI2YzI5ZmIzYTNkZDk3YWM3NjA2ZTcyNTE5M2UxMTNiZWNiNzVkYmIxN2FhMDdlYg'),
  ('7085973354000', 'OptiSteel simplesta SH M ÜbergangsMuffe IG, d = 35 x Rp 11/4', 11.83, 'https://prd-cc.rf24.de/medias/9eb4c7fad9d77eaf3942617e5c2cb7fd.jpg?context=bWFzdGVyfGltYWdlc3wyNzY5N3xpbWFnZS9qcGVnfGFHUTNMMmhoTlM4NU56VTNPVEEwTmprNU5ESXlMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFWbFltVnlaMkZ1WjNOdGRXWm1aVjlKUjE4NE1EQXVhbkJufDY0MTRhNzVhYTRmYjI1MDdkMmY3OWU1OWM1NTRjMzMxYjljYzMyZTQxYzNjYzc5MTNlMTllMWI0MzdjNTNlNjI'),
  ('1011950180000', 'SANCO-Kupferrohr blank nach EN 1057 18 x 1 mm, (im 25 m-Ring)', 5.75, 'https://prd-cc.rf24.de/medias/fc8d3ea8441595f83a67ffa1a521cd2d.jpg?context=bWFzdGVyfGltYWdlc3wxOTk1N3xpbWFnZS9qcGVnfGFEbGtMMmc1TWk4eE1EQTVPRFU1T0RBeE9URXdNaTgzTmpZME5pQXRJREV3TVRFNU5qQjRlREF3ZUhoZk9EQXdMbXB3Wnd8N2IxMmQyYTg2MWFiMWYwYjc0MGNjNWVlYWQ5MmU1Nzc4YjVmMTdlNmZmYTdhZTg2NjQ5NjYxYzVlMjY4YzZjZg'),
  ('1012102227000', 'PROFIPRESS T-Stück aus Kupfer 22x22x15 mm Modell 2418', 10.11, null),
  ('1012103351000', 'Viega T-Stück mit SC Sanpress 2217.2 in 35mm x Rp1/2 x 35mm Siliziumbronze', 26.99, null),
  ('1012105354000', 'Viega Übergangsstück mit SC Sanpress 2212 in 35mm x Rp1 1/4 IG Siliziumbronze', 20.87, null),
  ('7085922280000', 'OptiSteel simplesta SH M Bogen 45 I/I d = 28', 6.43, 'https://prd-cc.rf24.de/medias/147c7031743d92c84c975cca16640507.jpg?context=bWFzdGVyfGltYWdlc3wyMzAzN3xpbWFnZS9qcGVnfGFEZzFMMmhrWWk4NU56VTNPVEF6TURZeE1ESXlMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDBKdloyVnVYelExWDBrdFNWODRNREF1YW5CbnwyNDhhOWFlOGM0ZDU3Y2NkMmQyMjc2MzVmNWIyYzY1YjJkNmY5MjhkYmUyOTg1MTdkOThmN2E2NDBmZWRlNjkw'),
  ('7085430220000', 'OptiSteel simplesta SH V T-Stück d = 22', 4.81, 'https://prd-cc.rf24.de/medias/05cc28871ed34ab501b7cbc94223f177.jpg?context=bWFzdGVyfGltYWdlc3wzMjExNXxpbWFnZS9qcGVnfGFEa3pMMmhrTnk4NU9Ea3dNRGMzTXpFeE1EQTJMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlXWDFRdFUzUjFaV05yWHpnd01DNXFjR2N8NGVmY2I3ZmE1OTY5ZTg4ODk1OGI4MzhiYTgzODIwNzA1MjI0MGI0Yzc4MjEwMTAzODE3ODk3MjZkODMzY2Q3ZA'),
  ('7085907280000', 'OptiSteel simplesta SH M Bogen 90 I/A d = 28', 5.32, 'https://prd-cc.rf24.de/medias/5d7c07100175b34578bbad9decaa3f26.jpg?context=bWFzdGVyfGltYWdlc3wyMTA2NHxpbWFnZS9qcGVnfGFEQTNMMmc1TUM4NU56VTNPVEF5T1RJNU9UVXdMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDBKdloyVnVYemt3WDBrdFFWODRNREF1YW5CbnxmNDcwZDU4NzU4OGRiNTBhYmE5MThlNWM4MWJlZDBhNzcyNmNiNmZjMDdmOTkyNjUzZDU1MzBjZGVmM2YzOWFj')
)
insert into public.shop_artikel
  (artikelnr, name, preis_netto, preis_quelle, preis_stand, bild_url,
   bild_ist_extern, lieferant, einheit, aktiv, sichtbar_aufmass, bestellbar)
select n.artikelnr, n.name, n.preis, 'r-f-shop', now(), n.bild,
       n.bild is not null, 'R+F', 'Stk', true, true, false
  from neu n
 where not exists (select 1 from public.shop_artikel s where s.artikelnr = n.artikelnr);

-- 2. Die 36 Zuordnungen auf die GUT-Positionen.
with zuordnung(gut_nr, rf_nr) as (values
  ('COCIB2845KNL', '7085922280000'),
  ('COCIB28KNL', '7085402280000'),
  ('COCIB28ELKNL', '7085907280000'),
  ('COCIM22NL', '7085470220000'),
  ('COCIM28NL', '7085470280000'),
  ('COCIR22NL', '7085992220000'),
  ('COCIR28NL', '7085992280000'),
  ('COCIR35NL', '7085992350000'),
  ('COCIT22NL', '7085430220000'),
  ('COCIT2215INL', '7085429221000'),
  ('COCIT28NL', '7085430280000'),
  ('COCIT2815INL', '7085429281000'),
  ('COCIUS2225ANL', '7085472223000'),
  ('COCIUS2225INL', '7085973223000'),
  ('COCIUS2215ANL', '7085972221000'),
  ('COCIUS2215INL', '7085973221000'),
  ('COCIUS2220ANL', '7085972222000'),
  ('COCIUS2220INL', '7085973222000'),
  ('COCIUS2825INL', '7085973283000'),
  ('COCIUS2820INL', '7085973282000'),
  ('COCIUS2832INL', '7085973284000'),
  ('COCIUS3525INL', '7085973353000'),
  ('COCIUS3532ANL', '7085972353000'),
  ('COCIUS3532INL', '7085973354000'),
  ('300S15', '7075430100000'),
  ('330132', '1014056400000'),
  ('CUS18H', '1011950180000'),
  ('UCPK32N', '1029201070550'),
  ('UCPT1615IN', '1029201070595'),
  ('BPT1515I', '1012103151000'),
  ('BPT1815', '1012102183000'),
  ('BPT222215', '1012102227000'),
  ('BPT3515I', '1012103351000'),
  ('BPUS2832I', '1012105284000'),
  ('BPUS3532I', '1012105354000'),
  ('330S15', '7075433100000')
)
update public.shop_gut_positionen p
   set rf_artikelnummer = z.rf_nr,
       rf_ek_netto_stueck = coalesce(
         (select s.preis_netto from public.shop_artikel s where s.artikelnr = z.rf_nr),
         p.rf_ek_netto_stueck),
       rf_zuordnung_quelle = 'manuell',
       rf_zuordnung_stand = now()
  from zuordnung z
 where p.artikelnummer = z.gut_nr;

-- 3. Die 13 Positionen, die entfallen. nicht_relevant_grund haelt die
--    Entscheidung fest, damit sie nicht wieder in Lueckenlisten auftaucht.
--    Wo noch keine Klassifikation existiert, wird eine angelegt.
with entfaellt(gut_nr, text) as (values
  ('COCIT3522NL', 'CONNECT INOX HEAT T-Stück 35x22x35mm 1.4307 CONEL'),
  ('COCIT3528NL', 'CONNECT INOX HEAT T-Stück 35x28x35mm 1.4307 CONEL'),
  ('CSBLTH100', 'COSMO Tauchhülse DN15 L=100mm Messing vernickelt'),
  ('CSBLTH150', 'COSMO Tauchhülse DN15 L=150mm Messing vernickelt'),
  ('CCLGWST880', 'Gewindebolzen KLICK M8x80 Form A DIN 976 galv. verz. CONEL'),
  ('POVB2245', 'Prestabo-Bogen 45 Grad, 22mm Stahl unlegiert,verzinkt, Pressanschluss'),
  ('POVM22', 'Prestabo-Muffe 22mm Stahl unlegiert,verzinkt, Pressanschluss'),
  ('POVR22', 'Prestabo-Rohr 22 x 1,5 mm, Stange a 6m Stahl unlegiert, außen verzinkt'),
  ('POVR28', 'Prestabo-Rohr 28 x 1,5 mm, Stange a 6m Stahl unlegiert, außen verzinkt'),
  ('POVT22', 'Prestabo-T-Stück 22mm Stahl unlegiert,verzinkt, Pressanschluss'),
  ('CCLSTS8150', 'Stockschraube KLICK M8x150 I-Stern galv. verz. CONEL'),
  ('BZTTHCU200', 'Tauchhuelse 1/2" x 200mm aus Cu-Leg. f.Bimetall-Thermometer'),
  ('BPT282815', 'T-Stueck B-press 28 x 28 x 15mm Kupfer P5130')
)
insert into public.shop_gut_artikel_klassifikation
  (artikelnummer, kategorie, quelle, nicht_relevant_grund)
select e.gut_nr, 'sonstiges', 'manuell',
       'Entfaellt laut Patrick 15.09.2026 (Zaehllisten-Durchsicht)'
  from entfaellt e
 on conflict (artikelnummer) do update
    set nicht_relevant_grund = 'Entfaellt laut Patrick 15.09.2026 (Zaehllisten-Durchsicht)',
        updated_at = now();

-- Kontrolle
select 'Artikel neu' as was, count(*) as n from public.shop_artikel
 where preis_quelle = 'r-f-shop' and preis_stand::date = current_date
union all
select 'Positionen zugeordnet', count(*) from public.shop_gut_positionen
 where rf_zuordnung_quelle = 'manuell' and rf_zuordnung_stand::date = current_date
union all
select 'entfaellt markiert', count(*) from public.shop_gut_artikel_klassifikation
 where nicht_relevant_grund like 'Entfaellt laut Patrick 15.09.2026%';
