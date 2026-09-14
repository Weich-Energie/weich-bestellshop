-- 32 R+F-Artikel aus den Zähllisten in den Katalog.
--
-- Sie sind einem GUT-Artikel der Vordrucke zugeordnet, standen aber noch nicht
-- im Katalog — sie kamen weder im Lagerauszug noch in einer Rechnung vor.
-- Gebraucht werden sie für die Detail-Ansicht, die jede Vordruck-Position als
-- eigene Zeile zeigt.

with neu(artikelnr, name, preis, bild) as (values
  ('0000101131904', 'OPTILINE Kugelhahn MS 1" IG/AG PN32 mit Flügelgriff', 28.37, 'https://prd-cc.rf24.de/medias/152b3e0892f4ad1254bafa0ba4aeea17.jpg?context=bWFzdGVyfGltYWdlc3w3MDczfGltYWdlL2pwZWd8YURNM0wyZzNNUzg1TVRBME5qZ3lNREkwT1Rrd0x6Y3dNelV4TURBMk1UazNNak5mT0RBd0xtcHdad3w3M2Y5MjYzYjNlZmVkMDIwMWRmNTA4YjdkNTg3MmJjYzZlNDI5YzFkNjJkMzc0ODNmMzI5ZDM3MDM3YWViMDk1'),
  ('1005060450020', 'Optiline Endmanschettenband aus ALU 20 mm breit, Alu-blank, 10 m-Rolle', 21.85, 'https://prd-cc.rf24.de/medias/ce359837c581ba3ab7b6718ca00ba5f8.jpg?context=bWFzdGVyfGltYWdlc3wxNjk4NjJ8aW1hZ2UvanBlZ3xhREF5TDJobVpTODVNVEF3T1RNeE5qSTVNRGcyTHpjek5UVTBYMFZMUVV4SlZGOUJiSFZmWW14aGJtdGZNekF3WkhCcFh6Z3dNQzVxY0djfDNhNzQ4MGRkZDM5Zjk2MzEyZWE3ZWFhNjVjMzg3MjIyYjI4M2IxMWM1NDAyMTAxOTc1ZTcwOWU4NmUwMmQyMDg'),
  ('1005060450030', 'Optiline Endmanschettenband aus ALU 30 mm breit, Alu-blank, 10 m-Rolle', 24.75, 'https://prd-cc.rf24.de/medias/ce359837c581ba3ab7b6718ca00ba5f8.jpg?context=bWFzdGVyfGltYWdlc3wxNjk4NjJ8aW1hZ2UvanBlZ3xhREF5TDJobVpTODVNVEF3T1RNeE5qSTVNRGcyTHpjek5UVTBYMFZMUVV4SlZGOUJiSFZmWW14aGJtdGZNekF3WkhCcFh6Z3dNQzVxY0djfDNhNzQ4MGRkZDM5Zjk2MzEyZWE3ZWFhNjVjMzg3MjIyYjI4M2IxMWM1NDAyMTAxOTc1ZTcwOWU4NmUwMmQyMDg'),
  ('1009505050015', 'GE Silent-PP Bogen 15Gr d50', 3, null),
  ('1009505050030', 'GE Silent-PP Bogen 30Gr d50', 2.97, null),
  ('1009505050045', 'GE Silent-PP Bogen 45Gr d50', 2.97, null),
  ('1012100435000', 'PROFIPRESS Bogen 45 Grad I/A aus Kupfer 35 mm Modell 2426.1', 14.78, null),
  ('1012105353000', 'Viega Übergangsstück mit SC Sanpress 2212 in 35mm x Rp1 IG Siliziumbronze', 21.25, null),
  ('1012113151000', 'PROFIPRESS-G Übergangsstück a. Rotguss 15 mm x R 1/2 AG, Modell 2611', 2.83, null),
  ('1012113353000', 'PROFIPRESS-G Übergangsstück a. Rotguss 35 mm x R 1 AG, Modell 2611', 20.29, null),
  ('1012641351000', 'Viega Reduzierstück mit SC Sanpress 2215.1 in 35x28mm Siliziumbronze', 13.91, null),
  ('1014036315000', 'Doppelnippel aus RG/CuSi blank DN 25 (R 1) x 150 mm, Modell 3530', 13.44, 'https://prd-cc.rf24.de/medias/c67b430b669eeb66a27595043028c0de.jpg?context=bWFzdGVyfGltYWdlc3w3OTk2OHxpbWFnZS9qcGVnfGFEUmtMMmhsTmk4eE5UVTVNRFk0TlRFM09Ua3pOQzgzTWpRd04xOTJhV0pmWVY4eU5qY3lPVEpmWkY4eE1WOHhYemd3TUM1cWNHY3wwNjdiMzhkNDZjYWEzYTk0NWMxYTMyZjExNDZhMmJiNjBmZDM0MGJhYThlOTQzMjhlYjllYzc3OThjMjRkYTg0'),
  ('1015115110000', 'Walraven Stockschraube ev M10x100 SW8 TX25', 0.47, 'https://prd-cc.rf24.de/medias/fbd43a2a3962374cd02c5158ea91c50a.jpg?context=bWFzdGVyfGltYWdlc3w0MTk4fGltYWdlL2pwZWd8YUdaakwyZzBaaTg1TVRFM05URXlOak13TXpBeUx6QXdNREE1WHpFd01UVXhNVFV3TmpZd01EQmZPREF3TG1wd1p3fDE2ZDUyMzU0YmY0Mjk4N2RkYzI3MzVhOTNiYzMxYmRmYjY0ZjNiZWM3MmRjOTQ3MDRhNDNkMDBjNDIwZDc0ODM'),
  ('1015160458830', 'Walraven Gewindemuffe BUP 30x11x11 M8 x 30 mm', 0.69, null),
  ('1027100204676', 'Sudo-Press-Fitting aus Cu f.Wasser 35 mm, Bogen 90 Grad I/A, VC001A', 17.1, 'https://prd-cc.rf24.de/medias/ea10b147ca12f4c4df091e9cd83ccc99.jpg?context=bWFzdGVyfGltYWdlc3wyNjE0NHxpbWFnZS9qcGVnfGFHRTBMMmd6T1M4NE9UQXlORGs1TWpjd05qZzJMMlF4TmpBd01ERXZaR1Z5YVhaaGRHVnpMell2TURBeEx6TTFOeTgxT0Rnd01DQXRJREV3TWpjeE1EQXllSGg0ZUhoZk9EQXdMbXB3Wnd8ZmIzNGMzOGNhNTAxNjQ2ZDUyNGZkMWVjYzllMzVlMTA4YjYxNTEwNjcwZTBmYjUxNTFhYjRlYzJkYzEyMGE0OA'),
  ('1027100204799', 'Sudo-Press-Fitting aus Cu f.Wasser 35 mm, Bogen 45 Grad I/A, VC040', 16.67, 'https://prd-cc.rf24.de/medias/7131ef361600df2e21e4f7c28965e301.jpg?context=bWFzdGVyfGltYWdlc3wyNzAwNnxpbWFnZS9qcGVnfGFEa3hMMmczTWk4NU1UQTROVEE1TVRNd056Z3lMekV3TWpjeE1EQXlNSGg0ZUhoZk9EQXdMbXB3Wnd8NTBjOTFmZjEyYzk1N2RhOTdhNGQzMGM4M2NiZjg4NTliM2FjZDY2NjQ2MDMyMGM5ODg0MjJjY2E1ZWI3MjllNw'),
  ('2023230979902', 'alre Tauchhülse THK-2-200x17', 30.45, 'https://prd-cc.rf24.de/medias/4675b31bbd2262257b8a19bbff5a040d.jpg?context=bWFzdGVyfGltYWdlc3wyMTU2N3xpbWFnZS9qcGVnfGFETTNMMmd3T1M4NU1URTROVGcwTVRFeE1UTTBMek15T0RJeFgzUm9hMTgyTWpWZmIzSnBaMmx1WVd4Zk9EQXdMbXB3Wnd8NjZmNzk2M2RjY2M0MWMyNWM2YjhiYmJlOWQzYTllMmQ1MWJmMzYxYjMxN2FmMjU1YjE3MjJlMGYyYmYyMWNkNg'),
  ('2024900003000', 'Optiline Aluminium-Klebeband 50 mm breit, Rolle 45 m lang', 7.2, 'https://prd-cc.rf24.de/medias/26e0c5348256847c5b5600cfb78120c7.jpg?context=bWFzdGVyfGltYWdlc3wyNjA0NHxpbWFnZS9qcGVnfGFHRmtMMmhtWVM4eE1EWTRPVEF5TXpJeE16VTVPQzh5TURJME9UQXdNREF6TURBd1h6Z3dNQzVxY0djfGY1NmM5NDU1M2NhNmZjOWNlNWQ4Y2E2MzlhOWQ3YWFhMjYwNjU5NjQyNjVkNzhlNzNjYjIzYjE2Y2NlNWUwZmQ'),
  ('3059050000000', 'Optiline Röhrensifon DN 32, 50 mm höhenverst., chrom /10', 9.55, 'https://prd-cc.rf24.de/medias/4ecd408a795c8edc03181edad569a6ec.jpg?context=bWFzdGVyfGltYWdlc3w4MDU2fGltYWdlL2pwZWd8YURnekwyZ3pZeTg1TVRBM01USXhNalF5TVRReUx6QXdNREE1WHpNd05Ua3dOVEJmT0RBd0xtcHdad3w2MzU2N2Y0OGNlYTFjNWNiNmJiNmJmMzYyOWQyZTBlNzM2NmU5ZDA3NWM2M2IxNDkyNGVmY2IzN2FkMzY1NmFj'),
  ('7020900558017', 'Prestabo-Muffe mit SC-Contur aus unlegiertem Stahl, 28 mm', 2.23, null),
  ('7020900558147', 'Prestabo-Bogen 90 G mit SC-Contur aus unlegiertem Stahl, 22 mm', 2.79, null),
  ('7020900558161', 'Prestabo-Bogen 90 G mit SC-Contur aus unlegiertem Stahl, 35 mm', 7.72, null),
  ('7020900558284', 'Prestabo-Bogen 45 G mit SC-Contur aus unlegiertem Stahl, 22 mm', 2.92, null),
  ('7020900558307', 'Prestabo-Bogen 45 G mit SC-Contur aus unlegiertem Stahl, 35 mm', 7.81, null),
  ('7020900558567', 'Prestabo-Reduzierstück mit SC-Contur aus unlegiertem Stahl, 35 x 28 mm', 2.73, null),
  ('7020900558734', 'Prestabo-T-Stück mit SC-Contur, aus unlegiertem Stahl, 28 x 22 x 28 mm', 6.52, null),
  ('7036601078371', 'OVENTROP-Pumpenkugelhahn Optibal P, Ms. o.Sperrvtl.,DN25, Rp 1, G 1 1/2', 17.98, 'https://prd-cc.rf24.de/medias/f933c790c7915bd127a603343dfac8a0.jpg?context=bWFzdGVyfGltYWdlc3wxMDU2MjV8aW1hZ2UvanBlZ3xhRGMzTDJneE1DODVNVFV5TkRreU1UQTVPRFUwTHpVd01EZzRYMjkyWWw5a01UQTNPRE0zTVMweFh6Z3dNQzVxY0djfDA4NDk4ODAyNTViNDNmYzVkYzAxMjg2OGJiMjRiNzMwODAxMTI1ODdiMzczYjQ2MGE4MzBlOThiM2IzOTkzZjk'),
  ('7076585100000', 'FL KFE-Kugelhahn Eck G1/2a PN16 MS vern. m. Schlauchverschr.', 11.57, 'https://prd-cc.rf24.de/medias/8c7fb76d0b738dba65eed7e990be96d1.jpg?context=bWFzdGVyfGltYWdlc3w4OTYzNXxpbWFnZS9qcGVnfGFESXhMMmczTlM4NU1UVXhPRGd6TmpBNE1EazBMekl3TkRBMFgyWnNZbDlrWDNNMk1ESXpNVjg0TURBdWFuQm58ZjdjYWM2OGZiOWE5ZWE2NmIzYmU5ZDU1MDBiYWNiNTcwODcxOTBiMjdhN2JmNGFkOWM4NGQ3Yjg4OWJhZDg4Zg'),
  ('7085929351000', 'OptiSteel simplesta SH M T-Stück IG d = 35 x Rp 1/2', 14.55, 'https://prd-cc.rf24.de/medias/e5511cc4152627a8980ca2a48a033a00.jpg?context=bWFzdGVyfGltYWdlc3wyNjk1NHxpbWFnZS9qcGVnfGFESTBMMmhpTnk4NU56VTNPVEEwTVRjMU1UTTBMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFRdFUzUjFaV05yWDBsSFh6Z3dNQzVxY0djfDE2MzYyZTBhMzk0NWQzYWEzNmNkZGM0NDJhNWU1MThiOTU2OTkyODMzNTlmMzVjYWE1ZDUzZmM3YmJiYzhiYjI'),
  ('7085930280000', 'OptiSteel simplesta SH M T-Stück d = 28', 8.65, 'https://prd-cc.rf24.de/medias/2b69f1ac602857271ba12d8b54642349.jpg?context=bWFzdGVyfGltYWdlc3wzMTk1MXxpbWFnZS9qcGVnfGFHVXhMMmhtTWk4NU56VTNPVEF6TnpFMk16Z3lMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFRdFUzUjFaV05yWHpnd01DNXFjR2N8YmQwMTllZWVkZDNhYWVlMjQwNWI5NmUyNGIzNDEyMjY5ZDc4ODNlMzRhMmZmYjAzMTQ3OWVhOWJiN2EzZjc5Ng'),
  ('7085941351000', 'OptiSteel simplesta SH M Reduzierstück d = 35 x 28', 5.89, 'https://prd-cc.rf24.de/medias/76ae13460ad612e8f560f3b657f9e471.jpg?context=bWFzdGVyfGltYWdlc3wyNzg4MXxpbWFnZS9qcGVnfGFHVmxMMmc0TkM4NU56Y3lPREU0T1RVMk16RTRMekU1TURBd1gzTnBiWEJzWlhOMFlWOVRTRjlOWDFKbFpIVjZhV1Z5TFZOMGRXVmphMTg0TURBdWFuQm58MGRmYjJiOWVkNTMwYzBjOGY1MWY2ZWYxODZhNzM1NTE3MTNiZGE5Mzc4OTU4YjU3Nzc0MGFmY2IzZjcyMmFmMA'),
  ('7086230350000', 'GE Mapress Kupfer T-Stück egal d35-35-35', 18.86, null))
insert into public.shop_artikel
  (artikelnr, name, kategorie_id, lieferant, einheit, preis_netto,
   bild_url, bild_ist_extern, aktiv, bestellbar, sichtbar_aufmass)
select n.artikelnr, n.name,
       'a82bfe28-e672-4979-88f0-f8e977fb9f6b'::uuid, 'R+F', 'Stück',
       n.preis, n.bild, n.bild is not null, true, false,
       n.name !~* '(pumpe|gefäss|gefaess|rückspülfilter|rueckspuelfilter|heizkörper|heizkoerper)'
  from neu n
 where not exists (select 1 from public.shop_artikel a where a.artikelnr = n.artikelnr);

select count(*) as katalog_gesamt,
       count(*) filter (where sichtbar_aufmass) as sichtbar
  from public.shop_artikel where lieferant = 'R+F';
