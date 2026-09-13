-- 82 Zuordnungen über die R+F-Nummernsuche aufgelöst.
--
-- Grundlage ist Patricks Hinweis: R+F hat die Wettbewerbsnummern intern
-- hinterlegt. Die GUT-Nummer in die Suche gegeben liefert den R+F-Artikel.
--
-- Belastbarkeit gemessen, nicht behauptet: von den zwölf Nummern, die Patrick
-- am 13.09.2026 von Hand eingetragen hat, findet das Verfahren neun — und
-- stimmt bei allen neun **exakt** überein, bei null Abweichungen. Die übrigen
-- drei liefert die Suche nicht.
--
-- Übernommen wird nur, was genau einen Treffer hat (82 von 158 geprüften).
-- Keine dieser 82 rührt eine belegte Zuordnung an:
--   39 füllen eine leere Stelle
--   31 ersetzen eine geratene (`vermutet`)
--   12 bestätigen eine geratene
--
-- Die Preise stammen aus dem Shop. Wo ein Artikel schon im Katalog steht,
-- bleibt sein Preis unangetastet — Rechnungs- und Lagerpreise sind besser als
-- Listenpreise. Der WESA-Kugelhahn etwa steht im Shop mit 17,57 €, laut
-- Rechnung kostet er 13,00 €.

-- ─── Neue Quelle fuer die Zuordnung ───────────────────────────────────────
-- 'nummernsuche' steht fuer: ueber die R+F-Suche mit der GUT-Nummer gefunden.
-- Belastbarer als 'vermutet' (Textsuche), schwaecher als 'manuell' (Patrick)
-- und 'lager' (Patricks Lagerauszug).
alter table public.shop_gut_positionen
  drop constraint if exists shop_gut_positionen_rf_zuordnung_quelle_check;
alter table public.shop_gut_positionen
  add constraint shop_gut_positionen_rf_zuordnung_quelle_check
  check (rf_zuordnung_quelle = any (array[
    'lager', 'automatisch', 'nummernsuche', 'vermutet', 'manuell', 'kein_treffer'
  ]));

-- ─── Neue Artikel in den Katalog ──────────────────────────────────────────
with neu(artikelnr, name, preis, bild) as (values
  ('1036285300000', 'WESA-Kugelhahn aus Pressmessing, PN 32, vernickelt, IG/Ü-Mutter 1x11/4', 17.57, 'https://prd-cc.rf24.de/medias/62637b29cb226ec5f4820238604ada46.jpg?context=bWFzdGVyfGltYWdlc3w1Nzk3MHxpbWFnZS9qcGVnfGFEWm1MMmcxWmk4NU1UQTBOakU0TVRreU9USTJMekV3TXpZeU9EVjRlREF3TURCZk9EQXdMbXB3Wnd8MjI1ZDJkNzM0NjliNDgwMjdiMWU4ODY4NjYyZWYzOTAxOGQ2MGRkYzQ3ODQ3MDBkOGJjMTJlNDA4YmU4N2MxYQ'),
  ('7020900704803', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 35 mm x 1 AG', 8.21, null),
  ('1011960350012', 'SANCO-Kupferrohr blank nach EN 1057 hart, 35 x 1,2 mm, (in 5-m Stück)', 20.62, 'https://prd-cc.rf24.de/medias/fc8d3ea8441595f83a67ffa1a521cd2d.jpg?context=bWFzdGVyfGltYWdlc3wxOTk1N3xpbWFnZS9qcGVnfGFEbGtMMmc1TWk4eE1EQTVPRFU1T0RBeE9URXdNaTgzTmpZME5pQXRJREV3TVRFNU5qQjRlREF3ZUhoZk9EQXdMbXB3Wnd8N2IxMmQyYTg2MWFiMWYwYjc0MGNjNWVlYWQ5MmU1Nzc4YjVmMTdlNmZmYTdhZTg2NjQ5NjYxYzVlMjY4YzZjZg'),
  ('7076526110639', 'FL KFE-Kugelhahn Durchgang, DVGW G1/2a PN16 MS vern.', 10.16, 'https://prd-cc.rf24.de/medias/31c7ddfd3b9386f874d9c716e3b8ffd1.jpg?context=bWFzdGVyfGltYWdlc3w2ODM1OTZ8aW1hZ2UvanBlZ3xhR0kwTDJobVlpODRPRFl5TnpjMU9UQXlNak00TDJReE5qQXdNREV2WkdWeWFYWmhkR1Z6THpZdk1EQXhMek0wT0M4Mk1ETTNNQ0F0SURjd056WTFNall4TVRBMk16bGZSakV3TmpNNUlHNWxkVjg0TURBdWFuQm58NWJkYTYzYTZmOTRmODE4ZmY5MTdlYjhiNGI1OTU4ODJiYzc2Zjc1NDc3MjkwMmNmODMyNGYwOTUyMzM5MTcxNA'),
  ('7020900558932', 'Prestabo-T-Stück mit SC-Contur, mit IG aus unlegiertem Stahl, 35 x 1/2 x 35 mm', 10.51, null),
  ('1014054310000', 'T-Stück aus RG/CuSi Nr.3130 in Rp1 x Rp1/2 x Rp1', 12.16, 'https://prd-cc.rf24.de/medias/520075f1769dbfa32da52903ebefd9d5.jpg?context=bWFzdGVyfGltYWdlc3w3MzYwMHxpbWFnZS9qcGVnfGFESXlMMmhsWXk4eE5UVTVNakF5TURnek5qTTRNaTh4TVRVeU1EWmZNakF5TlRFeE1USmZkbWxpWDJSZmNIQmZiVE14TXpCZmFUTTJNalV4TlY4eE1WODRNREF1YW5CbnxiYzYyYWNmOTgwZWRlMDQxOTAwZDA2NGUyODMwYmUyMjIyODM2ZDNkYjlmNTZhMDJhNWFiYTFkYTRlOTE0YWEy'),
  ('1029201070504', 'Uponor Übergangsnippel S-Press PLUS 20-R1/2"MT', 7.24, 'https://prd-cc.rf24.de/medias/b969767ccc5a1723d711ba6913a89ebf.jpg?context=bWFzdGVyfGltYWdlc3w0NTM5M3xpbWFnZS9qcGVnfGFEZzBMMmczTUM4NU1UQXdOVE0wTWpFNE56Z3lMemN4TkRBM1gzVndZbDl3TVRBM01EVXdNVjg0TURBdWFuQm58ODI1YjE2ZjljNDNhMGE2YWNlOGUyZjJmMGQyZmU4ZDVlMmU3OGZiM2UzZWIzMjUyYWMxMzI5N2RlZmQ0MWUxYg'),
  ('7089233910000', 'Kermi x2 Profil-V T33 900x155x1000 QN3023, RAL9016, 10bar, Vent.li,m.Abd,BK', 391.39, null),
  ('7020900641986', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x 1/2 AG', 6.25, null),
  ('1005520035020', 'Rockwool Heizungsrohrschale 800 für Rohr 35 mm, Dämmdicke 20 mm,VPE 25m', 4.62, 'https://prd-cc.rf24.de/medias/585e846c453de7635e40ed07171c8be1.jpg?context=bWFzdGVyfGltYWdlc3wzMTkyOXxpbWFnZS9qcGVnfGFEWTJMMmhpT1M4NU1USTRORFU0TWpnNU1UZ3lMekF3TURBNVh6RXdNRFUxTWpBd01UVXdNakI0WHpnd01DNXFjR2N8NTZiZGNiMjFjYzY0NThhNzY4OGQyMmUzMGZmMzI2NmZjZDY3ODJmODY1NjY5NDZiNWIyMzI1NDYzNTViY2RlYw'),
  ('7020900704766', 'Viega Übergangsstück mit SC Prestabo 1112 in 35mm x Rp1 Stahl verzinkt', 8.21, null),
  ('1029201059576', 'Uponor weiß Uni Pipe PLUS 16x2,0 100m', 1.72, 'https://prd-cc.rf24.de/medias/95c1e59225324c58d6ecfdefac62b7b2.jpg?context=bWFzdGVyfGltYWdlc3wxNjMxMHxpbWFnZS9qcGVnfGFEUTBMMmc0WWk4NU1USTFOemt4T0RJMU9UVXdMekF3TURBNVh6RXdNamt5TURFd05UazFOelpmT0RBd0xtcHdad3wwYjBmYzRhYzUzNjJhMzFlNjJmMWNhMTRhNmQ5ZjFiOTdlZGZkMmQyNjc2Nzg4OGEyMmQwYTY1ZjdjODhhNjA4'),
  ('1014048400000', 'Rohrverschraubung aus RG/CuSi Nr.3331 R 11/4,flachdichtend, mit I/A-Gewinde', 40.8, 'https://prd-cc.rf24.de/medias/cf36f4d2c2fbf0c813817278e0cf03ef.jpg?context=bWFzdGVyfGltYWdlc3wxNzM1MDJ8aW1hZ2UvanBlZ3xhR0ZoTDJoaU9TOHhOVFU1TVRBNE1qazRNelExTkM4M01qUXdOMTkyYVdKZmJWOHpNek14WDJSZk1URmZNMTg0TURBdWFuQm58NGQ3YzQ3OTY0NjQ0NGM5NTkwZDJiY2FkOGMwMzU4NjVkMDVhNTliODllYjA3MjE5ODhhODkyZTFkM2Y3MDk5ZA'),
  ('7020900559496', 'Prestabo-Rohr aus unlegiertem Stahl, 35 mm x 1,5, Modell 1103', 5.54, null),
  ('1029201070618', 'Uponor Übergang auf Kupfer S-Press PLUS 25-22CU', 11.54, 'https://prd-cc.rf24.de/medias/cb9cc14166bda2f5f8f37b01f1c3e0f1.jpg?context=bWFzdGVyfGltYWdlc3wzMTM2N3xpbWFnZS9qcGVnfGFEQTVMMmhrTnk4NU1UQXdOVE16TXpBeE1qYzRMemN4TkRBM1gzVndZbDl3TVRBM01EY3dOVjg0TURBdWFuQm58ZjVhOTkyYzI2NWUyMTQ4NzRkZjQzODFlMWExMGY0NDNhYTM4ZjhmNmRhNzIwZjQxNjZiMDhlY2EyOTc3MDYwZg'),
  ('7084560100000', 'Vorlauf-Regulierventil m.Therm.-Oberteil Durchgangsform m.Muffen-IG DN 15-R 1/2', 21.41, 'https://prd-cc.rf24.de/medias/d39285554680f37b9442b92bf66e2718.jpg?context=bWFzdGVyfGltYWdlc3wzMjAxOTF8aW1hZ2UvanBlZ3xhR1V3TDJnNFl5ODVNVFV5TVRJMk1EVTROVEkyTHpJNE5UWXpYMmhsWWw5a01UTXdNaTB3TWkwd01EQXROR010YUdsZk9EQXdMbXB3Wnd8ZjMyMWFlYmE1ZjFiMjA1M2ZlNDNjYmUyYWJjODM0MTQ1MjUzMDc3Y2Y4Nzg2MzA3N2NlM2Y0NWIwMjA0ZDU2Nw'),
  ('7089233608000', 'Kermi x2 Profil-V T33 600x155x800 QN1789, RAL9016, 10bar, Vent.li,m.Abd,BK', 228.75, null),
  ('7075720300500', 'Pumpenverschraubungs-Set a. Temperguss schwarz, DN 25 IG x DN 40 IG', 3.99, 'https://prd-cc.rf24.de/medias/1dc5680423ea0f55e4bc696fd82a888c.jpg?context=bWFzdGVyfGltYWdlc3wyMDU3MnxpbWFnZS9qcGVnfGFHWTVMMmd5WXk4eE1EQTVPRFU1TURRME9UWTVOQzh3TURBd09WODNNRGMxTnpJd1dEQXdXRmhZSUZSbGJYQmxjbWN1SUhOamFIY3VJRWxIZUVsSFh6Z3dNQzVxY0djfDczYmYxZWViZDEyOTExY2UyMThjYWM1ZmZiYzZjYTFmZGRmZTI3OThjNDlkNzYyZjc2NjM4ODVjNjZmNmQzYTQ'),
  ('7020900558550', 'Prestabo-Reduzierstück mit SC-Contur aus unlegiertem Stahl, 35 x 22 mm', 2.69, null),
  ('1029201070509', 'Uponor Übergangsnippel S-Press PLUS 32-R1"MT', 12, 'https://prd-cc.rf24.de/medias/b969767ccc5a1723d711ba6913a89ebf.jpg?context=bWFzdGVyfGltYWdlc3w0NTM5M3xpbWFnZS9qcGVnfGFEZzBMMmczTUM4NU1UQXdOVE0wTWpFNE56Z3lMemN4TkRBM1gzVndZbDl3TVRBM01EVXdNVjg0TURBdWFuQm58ODI1YjE2ZjljNDNhMGE2YWNlOGUyZjJmMGQyZmU4ZDVlMmU3OGZiM2UzZWIzMjUyYWMxMzI5N2RlZmQ0MWUxYg'),
  ('7020900559052', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 35 mm x 11/4 AG', 8.88, null),
  ('7076110130000', 'ESBE Stellmotor ARA 661, 230 VAC, 50 Hz 2 min,ohne Mikroschalter,3-Punkt-Steuer.', 129.48, 'https://prd-cc.rf24.de/medias/8cfe18cb4074942f430c21a045d7aaa8.jpg?context=bWFzdGVyfGltYWdlc3wyMTczMHxpbWFnZS9qcGVnfGFEa3dMMmd4WVM4NU1UVTJOVFkyTXpVeE9UQXlMekF3TURBNVh6Y3dOell4UVZKQk5qQXdYemd3TUM1cWNHY3w4YTgzZGY2N2U5NDI4ZTJkYzY2NDU4YjQ0OTJjM2YwMDFlMTFmMTE0OTM4M2QyYjVlMzFjODM2MmMzYzZjZDc0'),
  ('7089322904000', 'Kermi x2 Profil-V T22 900x100x400 QN918, RAL9016, 10bar, Vent.li, m.Abd,BK', 153.57, null),
  ('1011960220000', 'SANCO-Kupferrohr blank nach EN 1057 halbhart, 22 x 1 mm, (in 5-m Stück)', 10.43, 'https://prd-cc.rf24.de/medias/fc8d3ea8441595f83a67ffa1a521cd2d.jpg?context=bWFzdGVyfGltYWdlc3wxOTk1N3xpbWFnZS9qcGVnfGFEbGtMMmc1TWk4eE1EQTVPRFU1T0RBeE9URXdNaTgzTmpZME5pQXRJREV3TVRFNU5qQjRlREF3ZUhoZk9EQXdMbXB3Wnd8N2IxMmQyYTg2MWFiMWYwYjc0MGNjNWVlYWQ5MmU1Nzc4YjVmMTdlNmZmYTdhZTg2NjQ5NjYxYzVlMjY4YzZjZg'),
  ('1013006300000', 'Doppelnippel schwarz DN 25 (R 1) 60 mm', 0.82, 'https://prd-cc.rf24.de/medias/79f3346fc0a74b9456a13819d52ddd98.jpg?context=bWFzdGVyfGltYWdlc3w5NzcxM3xpbWFnZS9qcGVnfGFEVTJMMmhtTkM4eE1EUXdOekU0TVRjeE16UXpPQzgyTkRNeU9WOHlNMTl6ZDE4NE1EQXVhbkJufDA2YTZmNmE1ZjMyZDIxNmFkMmM1MGJmNzFlNWJkMWNlNDFiNDYzYzAwOWY5MmIxYjZlNmY3YTJmMWUzOTJmZTE'),
  ('7020900558765', 'Prestabo-T-Stück mit SC-Contur, aus unlegiertem Stahl, 35 x 22 x 35 mm', 9.74, 'https://prd-cc.rf24.de/medias/42c3eea7892f9e836c1718f4184aa40c.jpg?context=bWFzdGVyfGltYWdlc3w4OTU0fGltYWdlL2pwZWd8YUdGa0wyZ3lZaTh4TlRVNU1Ua3hNelU0TmpjeE9DODNNalF3TjE5MmFXSmZiVjh4TVRFNFgyUmZNVEZmTTE4eU1EQXVhbkJufGMxNzI2NWQ2OWEyOTUwODUxZWEzZTNmMjI4ZmRjNDkxZTZjM2YxNjI3NTY2YjI1M2IwNjk5ZGI3ZjdhNmYwMDI'),
  ('1011960281000', 'SANCO-Kupferrohr blank nach EN 1057 halbhart, 28 x 1 mm, (in 5-m Stück)', 13.71, 'https://prd-cc.rf24.de/medias/fc8d3ea8441595f83a67ffa1a521cd2d.jpg?context=bWFzdGVyfGltYWdlc3wxOTk1N3xpbWFnZS9qcGVnfGFEbGtMMmc1TWk4eE1EQTVPRFU1T0RBeE9URXdNaTgzTmpZME5pQXRJREV3TVRFNU5qQjRlREF3ZUhoZk9EQXdMbXB3Wnd8N2IxMmQyYTg2MWFiMWYwYjc0MGNjNWVlYWQ5MmU1Nzc4YjVmMTdlNmZmYTdhZTg2NjQ5NjYxYzVlMjY4YzZjZg'),
  ('1029201070615', 'Uponor Übergang auf Kupfer S-Press PLUS 16-15CU', 7.08, 'https://prd-cc.rf24.de/medias/cb9cc14166bda2f5f8f37b01f1c3e0f1.jpg?context=bWFzdGVyfGltYWdlc3wzMTM2N3xpbWFnZS9qcGVnfGFEQTVMMmhrTnk4NU1UQXdOVE16TXpBeE1qYzRMemN4TkRBM1gzVndZbDl3TVRBM01EY3dOVjg0TURBdWFuQm58ZjVhOTkyYzI2NWUyMTQ4NzRkZjQzODFlMWExMGY0NDNhYTM4ZjhmNmRhNzIwZjQxNjZiMDhlY2EyOTc3MDYwZg'),
  ('7076801900000', 'Einschraub-Schutzrohr Typ SWT52G G1/2B - 10,0*0,75 U1=100 MS SW27', 5.55, 'https://prd-cc.rf24.de/medias/0844964eba2d1bbce1c251f5b92855a1.jpg?context=bWFzdGVyfGltYWdlc3wzMDQ5N3xpbWFnZS9qcGVnfGFEZ3dMMmcyTlM4eE1EWXhORFl6TkRrd05UWXpNQzgzTmpRNE9WOVRWMVExTWtkZk9EQXdMbXB3Wnd8YWViZDIyMDkyNzRkOWI1ZGZjYzE1NGZhNjFjNjAwMDUwYzk4ODViZTNjNzhkMzQ3YmZlZjg0MmI0NGVmNjE2NQ'),
  ('7020900559038', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x 3/4 AG', 4.86, null),
  ('1013015300000', 'Doppelnippel schwarz DN 25 (R 1) 150 mm', 1.63, 'https://prd-cc.rf24.de/medias/79f3346fc0a74b9456a13819d52ddd98.jpg?context=bWFzdGVyfGltYWdlc3w5NzcxM3xpbWFnZS9qcGVnfGFEVTJMMmhtTkM4eE1EUXdOekU0TVRjeE16UXpPQzgyTkRNeU9WOHlNMTl6ZDE4NE1EQXVhbkJufDA2YTZmNmE1ZjMyZDIxNmFkMmM1MGJmNzFlNWJkMWNlNDFiNDYzYzAwOWY5MmIxYjZlNmY3YTJmMWUzOTJmZTE'),
  ('7020900642204', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 35 mm x 11/4 IG', 10.04, null),
  ('7076111601000', 'ESBE 3-Wege-Mischer TYP VRG 131-6,3 DN 25, IG, Rp 1, 6,3 Kvs', 54.98, 'https://prd-cc.rf24.de/medias/a59fd123c13e9fc5fa42f3c29a69024a.jpg?context=bWFzdGVyfGltYWdlc3wyMTYwMHxpbWFnZS9qcGVnfGFERXlMMmcwT1M4NU1USXpPVFEzTVRVeE16a3dMemN3TnpZeE1URTJNREI0ZUhoZk9EQXdMbXB3Wnd8YjY2NzEwMTMxYzZmYjAyYTJkN2YyZGUwNjUwODYxNzg0YzdmMjQwMGQ1YTA4ZTgwZWJhOTNmYTg2YzMxYmZmZQ'),
  ('7020900558918', 'Prestabo-T-Stück mit SC-Contur, mit IG aus unlegiertem Stahl, 28 x 1/2 x 28 mm', 7.24, 'https://prd-cc.rf24.de/medias/42c3eea7892f9e836c1718f4184aa40c.jpg?context=bWFzdGVyfGltYWdlc3w4OTU0fGltYWdlL2pwZWd8YUdGa0wyZ3lZaTh4TlRVNU1Ua3hNelU0TmpjeE9DODNNalF3TjE5MmFXSmZiVjh4TVRFNFgyUmZNVEZmTTE4eU1EQXVhbkJufGMxNzI2NWQ2OWEyOTUwODUxZWEzZTNmMjI4ZmRjNDkxZTZjM2YxNjI3NTY2YjI1M2IwNjk5ZGI3ZjdhNmYwMDI'),
  ('2029415160300', 'Wickelfalzrohr DIN EN 12237, verzinkt d 160 mm,Lieferlänge 3 m, Enden verschl.', 8.12, 'https://prd-cc.rf24.de/medias/c23aa414deef130db4c5a96f74800cfe.jpg?context=bWFzdGVyfGltYWdlc3wzNDA3MDV8aW1hZ2UvanBlZ3xhREJpTDJnd05pODVNVE0yTWprNU16UXpPVEF5THpVMk1EZ3hYMU5TUlU1WVgyMWxYemd3TUM1cWNHY3w4MzRlMDEyNzViYTFiZTQ3OTE2YzBhYWI5ZTVlYzQ4N2ViYmFlODIzYzJjOGQ4ZDBjZjgyZGQxNWU3M2NlNmQy'),
  ('1029201070616', 'Uponor Übergang auf Kupfer S-Press PLUS 20-18CU', 9.38, 'https://prd-cc.rf24.de/medias/cb9cc14166bda2f5f8f37b01f1c3e0f1.jpg?context=bWFzdGVyfGltYWdlc3wzMTM2N3xpbWFnZS9qcGVnfGFEQTVMMmhrTnk4NU1UQXdOVE16TXpBeE1qYzRMemN4TkRBM1gzVndZbDl3TVRBM01EY3dOVjg0TURBdWFuQm58ZjVhOTkyYzI2NWUyMTQ4NzRkZjQzODFlMWExMGY0NDNhYTM4ZjhmNmRhNzIwZjQxNjZiMDhlY2EyOTc3MDYwZg'),
  ('7021573400000', 'Megapress Übergangsstück IG mit SC 4212in11/4ZollxRp11/4 StahlZn-Ni besch.', 13.69, null),
  ('7020900642167', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x 1 IG', 6.29, null),
  ('1013010300000', 'Doppelnippel schwarz DN 25 (R 1) 100 mm', 1.01, 'https://prd-cc.rf24.de/medias/79f3346fc0a74b9456a13819d52ddd98.jpg?context=bWFzdGVyfGltYWdlc3w5NzcxM3xpbWFnZS9qcGVnfGFEVTJMMmhtTkM4eE1EUXdOekU0TVRjeE16UXpPQzgyTkRNeU9WOHlNMTl6ZDE4NE1EQXVhbkJufDA2YTZmNmE1ZjMyZDIxNmFkMmM1MGJmNzFlNWJkMWNlNDFiNDYzYzAwOWY5MmIxYjZlNmY3YTJmMWUzOTJmZTE'),
  ('1014036406000', 'Doppelnippel aus RG/CuSi blank DN 32 (R 11/4) x 60 mm, Modell 3530', 10.22, 'https://prd-cc.rf24.de/medias/369ad0986b81926ba1b1993615718f3f.jpg?context=bWFzdGVyfGltYWdlc3w3OTk2OHxpbWFnZS9qcGVnfGFESmxMMmhoWmk4eE5UVTVNRGMwTmpneE5qVTBNaTgzTWpRd04xOTJhV0pmWVY4ek1UZzBPREpmWkY4eE1WOHhYemd3TUM1cWNHY3w5MTRmM2MyNmFlMjA2ZmM3M2FlMjllNzZkOWU2NDViNWEwZTIwNzljZDYwNzYxZWJkMTMxNWU3NjVmMTRhYTFh'),
  ('1013012300000', 'Doppelnippel schwarz DN 25 (R 1) 120 mm', 1.36, 'https://prd-cc.rf24.de/medias/79f3346fc0a74b9456a13819d52ddd98.jpg?context=bWFzdGVyfGltYWdlc3w5NzcxM3xpbWFnZS9qcGVnfGFEVTJMMmhtTkM4eE1EUXdOekU0TVRjeE16UXpPQzgyTkRNeU9WOHlNMTl6ZDE4NE1EQXVhbkJufDA2YTZmNmE1ZjMyZDIxNmFkMmM1MGJmNzFlNWJkMWNlNDFiNDYzYzAwOWY5MmIxYjZlNmY3YTJmMWUzOTJmZTE'),
  ('7020900642150', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x 1/2 IG', 6.25, null),
  ('7020900559120', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 28 mm x 1 IG', 7.18, null),
  ('7021572300000', 'Megapress Übergangsstück AG mit SC 4211 in 1ZollxR1 Stahl Zn-Ni besch.', 12.22, null),
  ('1011960150000', 'SANCO-Kupferrohr blank nach EN 1057 halbhart, 15 x 1 mm, (in 5-m Stück)', 6.47, 'https://prd-cc.rf24.de/medias/fc8d3ea8441595f83a67ffa1a521cd2d.jpg?context=bWFzdGVyfGltYWdlc3wxOTk1N3xpbWFnZS9qcGVnfGFEbGtMMmc1TWk4eE1EQTVPRFU1T0RBeE9URXdNaTgzTmpZME5pQXRJREV3TVRFNU5qQjRlREF3ZUhoZk9EQXdMbXB3Wnd8N2IxMmQyYTg2MWFiMWYwYjc0MGNjNWVlYWQ5MmU1Nzc4YjVmMTdlNmZmYTdhZTg2NjQ5NjYxYzVlMjY4YzZjZg'),
  ('7087901109002', 'Serviceventil K6/9 Geeignet f. Kermi Ventil-Flachheizkörper', 33.66, 'https://prd-cc.rf24.de/medias/d8b0e794f315116c1122f1f5a777d3f4.jpg?context=bWFzdGVyfGltYWdlc3w0ODAzNnxpbWFnZS9qcGVnfGFERXlMMmd5TUM4eE5UYzJNVFk1TkRReU5URXhPQzh6TlRFeU1WOXJhWE5mZW5aZmRtVnVkR2xzWDNZeGExOHhPVGt4TFRFNU9UTmZPREF3TG1wd1p3fGJmNzdiYWIyNGU3MGZjYWYzNzEzZjIwM2EzOWI3ZmUyMzZkMzJkYWVmNzJjNzQzZDk2ZTQ5ZDI3Y2FiODNkNzg'),
  ('1009503050100', 'GE Silent-PP Rohr mit Muffe d50x2 L:100cm', 4.77, null),
  ('1029201070617', 'Uponor Übergang auf Kupfer S-Press PLUS 20-22CU', 9.54, 'https://prd-cc.rf24.de/medias/cb9cc14166bda2f5f8f37b01f1c3e0f1.jpg?context=bWFzdGVyfGltYWdlc3wzMTM2N3xpbWFnZS9qcGVnfGFEQTVMMmhrTnk4NU1UQXdOVE16TXpBeE1qYzRMemN4TkRBM1gzVndZbDl3TVRBM01EY3dOVjg0TURBdWFuQm58ZjVhOTkyYzI2NWUyMTQ4NzRkZjQzODFlMWExMGY0NDNhYTM4ZjhmNmRhNzIwZjQxNjZiMDhlY2EyOTc3MDYwZg'),
  ('1005520022030', 'Rockwool Heizungsrohrschale 800 für Rohr 22 mm, Dämmdicke 30 mm,VPE 20m', 5.39, 'https://prd-cc.rf24.de/medias/585e846c453de7635e40ed07171c8be1.jpg?context=bWFzdGVyfGltYWdlc3wzMTkyOXxpbWFnZS9qcGVnfGFEWTJMMmhpT1M4NU1USTRORFU0TWpnNU1UZ3lMekF3TURBNVh6RXdNRFUxTWpBd01UVXdNakI0WHpnd01DNXFjR2N8NTZiZGNiMjFjYzY0NThhNzY4OGQyMmUzMGZmMzI2NmZjZDY3ODJmODY1NjY5NDZiNWIyMzI1NDYzNTViY2RlYw'),
  ('1012963200000', 'Gebo Temperguss-KLV Serie 150, Abzweig Typ T 3/4" für Stahlrohr', 22.57, 'https://prd-cc.rf24.de/medias/1377281f3597cf2e548f9222c915728f.jpg?context=bWFzdGVyfGltYWdlc3w0ODQ0fGltYWdlL2pwZWd8YURNM0wyZzRNeTg1TVRBek1UQTNORGc1T0RJeUx6RXdNVEk1TmpONGVIZ3dNREJmT0RBd0xtcHdad3xkYWJkM2JlNTAyYzkxZjYzNmVlNzg0YjYxYTU0MTJiODEzYTUxODAzMmU4MTAzYWQ0ZGNmMjg5MjI0ZDk5NDNm'),
  ('1014049410000', 'Reduzierstück aus RG/CuSi Nr.3241 R 11/4 x 1/2, mit A/I-Gewinde', 6.21, 'https://prd-cc.rf24.de/medias/40054cbc5c17ba4eac795b5c4870a264.jpg?context=bWFzdGVyfGltYWdlc3wxODIyMDh8aW1hZ2UvanBlZ3xhRE13TDJnNU9DOHhOVFU1TVRFMk1EYzBNVGt4T0M4M01qUXdOMTkyYVdKZllWOHlOamMxT0RKZlpGOHhNVjh4WHpnd01DNXFjR2N8YzQ2Njc5NzdkYjY4NDQyZjUzMDgxYTdhZTBkMmFjNjRlZjM5ODdkN2VkMzdiNTc0YTZhODJlMzY0YjdmMTEzMQ'),
  ('1014057430000', 'Reduzier-Nippel aus RG/CuSi Nr.3245 11/4 AG x 1 AG', 6.14, 'https://prd-cc.rf24.de/medias/6bfa1f3e572b2ba0feec214af1639321.jpg?context=bWFzdGVyfGltYWdlc3w5NzM1NHxpbWFnZS9qcGVnfGFETmpMMmd5WXk4eE5UVTVNREV4TVRVM05qQTVOQzgzTWpRd04xOTJhV0pmYlY4ek1qUTFYMlJmTVRGZk0xODRNREF1YW5CbnxlYjBjNDY1NjI1MjkwMzdkYmNkMjY4YTczMzI0NDVjNGRmZTIzNWFlNjcxMzgwYjQxY2E4M2E2MWQxNzRiNzgw'),
  ('1029201070639', 'Uponor Wandscheibe S-Press PLUS 16-Rp1/2"FT', 9.24, 'https://prd-cc.rf24.de/medias/4a92ddf9ef4aa1eb1768923021cee2d5.jpg?context=bWFzdGVyfGltYWdlc3w0MTU1MnxpbWFnZS9qcGVnfGFEVXpMMmd3Tmk4NU1UQXdOVE13TnpRMU16YzBMemN4TkRBM1gzVndZbDl3TVRBM01EWXpPRjg0TURBdWFuQm58Y2I3YjEwY2VlNTUxNzhhZWY4OTE0ZTk3ODQ2NmQ3ZTc1ZmNiMTJiYmEwMmM3Zjg2MTM5NWRjNGY2YjU1YWI5MA'),
  ('7021573300000', 'Megapress Übergangsstück IG mit SC 4212 in 1ZollxRp1 Stahl Zn-Ni besch.', 11.72, null),
  ('1014036108000', 'Doppelnippel aus RG/CuSi blank DN 15 (R 1/2) x 80 mm, Modell 3530', 3.85, 'https://prd-cc.rf24.de/medias/1e621042403e45e52d0a629ee93d00c6.jpg?context=bWFzdGVyfGltYWdlc3w3OTk2OHxpbWFnZS9qcGVnfGFETTBMMmhoWXk4eE5UVTVNRFl3TnpnNE1ESXlNaTgzTWpRd04xOTJhV0pmWVY4eU5qY3pNakpmWkY4eE1WOHhYemd3TUM1cWNHY3w3ZDEyZjk5NGNhMTE3ZGViM2U1NzZkZDM4YzFjNDI4OTc5NzRlOGRiNjMwZjMzZTdiNDhjMzMyZmIxYWRmYzkw'),
  ('7020900704797', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x1 AG', 4.65, null),
  ('1029201070563', 'Uponor T-Stück S-Press PLUS 32-32-32', 22.44, 'https://prd-cc.rf24.de/medias/9f5640acf7f6873cd7a2534129f1bce8.jpg?context=bWFzdGVyfGltYWdlc3w1MTIzOXxpbWFnZS9qcGVnfGFHRTBMMmcxTWk4NU1UQXdOVE14TWpZNU5qWXlMemN4TkRBM1gzVndZbDl3TVRBM01EVTJNRjg0TURBdWFuQm58NDFjYThlZTEzMmUzZDUyZTg5ZWY1YTUxOWVjYmExOTMyYTgzYjVlZTk2MzY0N2E3OGNjMjBmZjkwOTYwNzA1ZQ'),
  ('1016376400000', 'Oberteil, kurz Spindel steigend, DN 32 (R 11/4)', 20.03, 'https://prd-cc.rf24.de/medias/03fa07f5b15ae8b19031a70a761f8f47.jpg?context=bWFzdGVyfGltYWdlc3wyODk1MHxpbWFnZS9qcGVnfGFEWmtMMmhtWmk4eE5qWTFNemN5TnpBM01qSTROaTh4TXpjNE56TmZhbk5pWDJRd01ERTRNREV6TWpBd01qRXdYemd3TUM1cWNHY3xhOGRiODhmZDI5NzRhZWMxMTBhMTEzMDk0YTNhNmM1MTc3YjRiYjYzM2VhMTA2NmFlZDRkZTIzNDQxNTQ4ZDRi'),
  ('1029201070599', 'Uponor T-Stück m. Innengew. S-Press PLUS 25-Rp3/4"FT-25', 18.62, 'https://prd-cc.rf24.de/medias/7786cb45754674f2a4f096ca4f97179d.jpg?context=bWFzdGVyfGltYWdlc3w0NjI4N3xpbWFnZS9qcGVnfGFEQmlMMmhqTXk4NU1UQXdOVE15TkRRNU16RXdMemN4TkRBM1gzVndZbDl3TVRBM01EVTVOVjg0TURBdWFuQm58MDE5NTdlYjU2MzZlOTVjNzNmYWE5MGE0MDMyNTU4MzM3MDk5ZTM1OGU0M2IzZTUyZjcxZDE5ZGRiNzUxODE5NQ'),
  ('7020900559113', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x 3/4 IG', 5.29, null),
  ('7021573500000', 'Megapress Übergangsstück IG mit SC 4212 in11/2ZollxRp11/2 StahlZn-Ni besch.', 16.1, null),
  ('1005520018030', 'Rockwool Heizungsrohrschale 800 für Rohr 18 mm, Dämmdicke 30 mm,VPE 25m', 5.08, 'https://prd-cc.rf24.de/medias/585e846c453de7635e40ed07171c8be1.jpg?context=bWFzdGVyfGltYWdlc3wzMTkyOXxpbWFnZS9qcGVnfGFEWTJMMmhpT1M4NU1USTRORFU0TWpnNU1UZ3lMekF3TURBNVh6RXdNRFUxTWpBd01UVXdNakI0WHpnd01DNXFjR2N8NTZiZGNiMjFjYzY0NThhNzY4OGQyMmUzMGZmMzI2NmZjZDY3ODJmODY1NjY5NDZiNWIyMzI1NDYzNTViY2RlYw'),
  ('1027100206908', 'Sudo-Press-Fitting aus Rg. f.Wasser 18 x R 1/2 IG x 18, T-Stück ,VC130G', 19.93, 'https://prd-cc.rf24.de/medias/42631aabbe664cd93b8631f8385908fe.jpg?context=bWFzdGVyfGltYWdlc3wyNDA1MHxpbWFnZS9qcGVnfGFHUmxMMmd3Tmk4NU1URTROelUwT1RZek5EZzJMekF3TURBNVh6UXhNekJIVmxjeE1qRXlNVEpmT0RBd0xtcHdad3wwNTYxMzc5YTY5MDQ0ZDE2YzJlYjg0YzA1ZDkxYzU3YWY4OGNiZmE2ODcwNzIxZmYyMmU3MTYxYmRhOTU4ZWFk'),
  ('1009505050088', 'GE Silent-PP Bogen 87,5Gr d50', 2.97, null),
  ('7075461410000', 'Reduktionsnippel Nr. 241, schwarz DN 32x15 (R 11/4x1/2) mit A/I-Gewinde', 2.16, 'https://prd-cc.rf24.de/medias/50c1b8fead92cd62aef4299ab2ad343a.jpg?context=bWFzdGVyfGltYWdlc3wxMDM2NjZ8aW1hZ2UvanBlZ3xhRFU0TDJnMVlpOHhOVGt4T1RFMk1qRTVOVGs1T0M4M016QTBPVjlHUmw4eU5ERXRNbDg0TURBdWFuQm58OTQ1MzBmMGRkNTYzZWY3NzlkZjVlMGNlMTU2NTVjMTQ1M2I2NjU4MjZmZmJjYmI1Nzc0YThlNmFiMGJjMTI1Ng'),
  ('2029301169000', 'Bogen mit Lippendichtung, gepresst d 160 mm, 90 Grad', 7.94, 'https://prd-cc.rf24.de/medias/71125cd72db3b024c7994d71763d6839.jpg?context=bWFzdGVyfGltYWdlc3w4MTMwOXxpbWFnZS9qcGVnfGFEVXdMMmd5Tmk4NU1UTTBPRFU1TWpVMU9ETTRMelUyTURneFgwSkVYemt3WHpnd01DNXFjR2N8ZTUzZjdiYzQ2NGI1YTg2YzdjMjViYjI4MDkxNzNlYTNmY2EzMTFmY2M5ZWYzZTgxMDZmZjFkNzkxYmIyOTY2OQ'),
  ('1029201070535', 'Uponor Winkelnippel S-Press PLUS 25-R3/4"MT', 13.37, 'https://prd-cc.rf24.de/medias/a4276742cf16b9b8e2676bd6d3482aaf.jpg?context=bWFzdGVyfGltYWdlc3w1NjkzOHxpbWFnZS9qcGVnfGFHRmhMMmcyTmk4NU1UQXdOVE14T0RJMk56RTRMemN4TkRBM1gzVndZbDl3TVRBM01EVXpNVjg0TURBdWFuQm58ZTkzMjE3YmIzZmNmMzFlNjA5Y2Q4MWJkMGU0ZWU1ZDgwMjAwNDQzZjA0YTUyMzAwNjE4ZmI5M2NiNDU5MjE2Zg'),
  ('7079056106000', 'CALEFFI Sicherheitsventil 253 Solar 1/2 IGx3/4 IGx6 bar,Ms-Gehäuse verchr.', 21.81, 'https://prd-cc.rf24.de/medias/cf96f6bf26636c1edbff9a799cdfc234.jpg?context=bWFzdGVyfGltYWdlc3w2MDE0NnxpbWFnZS9qcGVnfGFHUm1MMmcwWXk4NU1UQTFNVEkwTlRVMk9ETXdMekV6Tmpnd0xUY3dOemt3TlRZeFdGZ3dNREJmT0RBd0xtcHdad3w5ZTQ1YmVkMmU1YmJhYTQ2NWUxY2IyNWU1YjAwNDEwODBmZTRhYzlkMDlhMGUwNTlhMThkZjE4NTM2ZjFhZjY0'),
  ('1029201070576', 'Uponor T-Stück reduziert S-Press PLUS 25-20-20', 13.66, 'https://prd-cc.rf24.de/medias/8d043c6eab428b22c85318992dc13c29.jpg?context=bWFzdGVyfGltYWdlc3w1NzY1OHxpbWFnZS9qcGVnfGFETmtMMmhpT1M4NU1UQXdOVE15TVRnM01UWTJMemN4TkRBM1gzVndZbDl3TVRBM01EVTJObDg0TURBdWFuQm58ZGYzYThhNmVhMzk1MTFjMTA3NDVjNTNhZjg2MWY2MGY5ZjUyYmNjOWI1MjFhODU3OTkxZTJjNDUwZDRkN2I3Nw'),
  ('7075741100300', 'Pumpenverschraubungs-Set Kupferleg.CuSi G 1/2 IG x G 1 IG', 18.57, 'https://prd-cc.rf24.de/medias/a8d65a65d825920338504a34fcb3a0fc.jpg?context=bWFzdGVyfGltYWdlc3w2NjEwfGltYWdlL2pwZWd8YUdaaEwyaGlZaTg1TVRBMU56Z3lPRGs0TnpFNEx6QXdNREE1WHpjd056VTNOREY0TURCNE1EQmZPREF3TG1wd1p3fDUwMzlkYmRmZjA1ODg0YzM2MjUzYWJjYzA4ZTI2MzBkMDhhNmFjZTRkYTI5NzY0ODc0NTg3MGUwZTE5MzcwODY'),
  ('1014053200000', 'Winkel aus RG/CuSi Nr.3092 R 3/4, mit I/A-Gewinde', 3.46, 'https://prd-cc.rf24.de/medias/523492556c963854f375230809b62710.jpg?context=bWFzdGVyfGltYWdlc3w3NTA2OXxpbWFnZS9qcGVnfGFEUTNMMmhtTUM4eE5UVTVNVGsxTXpRMk5UTTNOQzh4TVRVeU1EWmZNakF5TlRFeE1USmZkbWxpWDJSZmNIQmZiVE13T1RKZmFUSTJOREF3TUY4eE1WODRNREF1YW5Cbnw3ZjYxYmQwZTIxY2U3MTIwMDdiMTVlYzE4MzgwYWI2OGI5NGViZmZhMjU2ZjBjNDc3OGJhYjBmNTBkNDk5YzAy'),
  ('7076802084094', 'Bimetall-Thermometer, Kl. 1 aus CrNiSt, 0 - +120 C, d 100 mm, Tauchlänge 160 mm', 23.55, 'https://prd-cc.rf24.de/medias/a7d9e6046b19808a660da3ac76153f23.jpg?context=bWFzdGVyfGltYWdlc3w3MDIxMnxpbWFnZS9qcGVnfGFEWmxMMmd4WkM4NU1UQXlORFF4T1RNNE9UYzBMemMyTkRnNVgwSnBiR1JmTWpCZlFUVXlYemd3TUM1cWNHY3w0NDQ0NGZlYjhlZjE5MmM5MmQ2MjU1ZmU0OWFmMjgyOWVjODE0ZDVlMWU2ZDM5ZWU4MGJiMWUxMjliYzU0NjA5'),
  ('1029201070569', 'Uponor T-Stück reduziert S-Press PLUS 20-20-16', 9.77, 'https://prd-cc.rf24.de/medias/8d043c6eab428b22c85318992dc13c29.jpg?context=bWFzdGVyfGltYWdlc3w1NzY1OHxpbWFnZS9qcGVnfGFETmtMMmhpT1M4NU1UQXdOVE15TVRnM01UWTJMemN4TkRBM1gzVndZbDl3TVRBM01EVTJObDg0TURBdWFuQm58ZGYzYThhNmVhMzk1MTFjMTA3NDVjNTNhZjg2MWY2MGY5ZjUyYmNjOWI1MjFhODU3OTkxZTJjNDUwZDRkN2I3Nw'),
  ('1016376200000', 'Oberteil, kurz Spindel steigend, DN 20 (R 3/4)', 8.24, 'https://prd-cc.rf24.de/medias/8fdcf104a02a2c5ccb84870cc72eb5a5.jpg?context=bWFzdGVyfGltYWdlc3wyMzQ0MnxpbWFnZS9qcGVnfGFEWTNMMmd5TUM4NU1UQXhOakF6T1RNd01UUXlMekV3TVRZek56WXdNREF3TUY4NE1EQXVhbkJufDY1NTk3ZWNlZjc2NDNlN2M0OTIzODFjMGIxYjYxNzI1OGIxODcxYmZmYjhjZTg2MWQwZTJmOTk0NGFlZGJiZjc'),
  ('1009503050200', 'GE Silent-PP Rohr mit Muffe d50x2 L:200cm', 9.77, null),
  ('7084055343401', 'HU Verlängerung G3/4 IGxG 3/4 AG Eurokonus selbstdicht., Ms vern.', 7.51, null),
  ('2024900000160', 'Optiline Lüftungsrohrschelle (M8) d 160 mm, mit grauer Schallschutzeinlage', 2.04, 'https://prd-cc.rf24.de/medias/bffa0a43773cc283894860beb8cd7e14.jpg?context=bWFzdGVyfGltYWdlc3wxNzIwNDN8aW1hZ2UvanBlZ3xhRFEyTDJnd015OHhNREUyTlRreU5USTBPVEExTkM4d056SXdNMTlQY0hScGJHbHVaVjlNZFdWbWRIVnVaM056WTJobGJHeGxYemd3TUM1cWNHY3w0ZGE2NTQxNGY1NmVhYThiNTVkNDI1YjNiYjJiMGJmN2MwZDZhMmJjYmQ4ZmVhMjJkM2E2MDAwOGJiY2I0MzMz'),
  ('1016358447182', 'Hahnverlängerung aus Rotguss, verchromt DN 15 (R 1/2), 25 mm, Mod.3526', 2.82, null),
  ('2029304163000', 'Reduzierung, symmetrisch mit Lippendichtung, d 160 x d 125 mm', 5.01, 'https://prd-cc.rf24.de/medias/907d944fb908c165490d7e11a952eb54.jpg?context=bWFzdGVyfGltYWdlc3w5NDYyNHxpbWFnZS9qcGVnfGFHSmlMMmc1WkM4eE1EUTRNalUwTkRNME5URXhPQzgxTmpBNE1WOVZSRjg0TURBdWFuQm58NjJmNmUzNjhhMmRjNmU0MWQyZTVmMDYwMDYxNjU1ZDY5ZGE2NTQ4OWI4YTYyMjE2YWEzMWMxY2E0OTI0YTdlOQ'),
  ('1014049540000', 'Reduzierstück aus RG/CuSi Nr.3241 R 11/2 x 11/4, mit A/I-Gewinde', 4.6, 'https://prd-cc.rf24.de/medias/1f399bc565443768175fea3189f08d47.jpg?context=bWFzdGVyfGltYWdlc3wxODIyMDh8aW1hZ2UvanBlZ3xhREE1TDJoaE9DOHhOVFU1TVRFM05qUXpOemM1TUM4M01qUXdOMTkyYVdKZllWOHlOamMzTURSZlpGOHhNVjh4WHpnd01DNXFjR2N8Yjk5MmNhYmZmZjBkYzFhM2Q0MjljMDZmNjlhOWQ5ZDY0NzE0N2NmM2Y4MTlmYzRlZTQ1YzIxZmJmNjlkYjdhZQ'),
  ('7075461430000', 'Reduktionsnippel Nr. 241, schwarz DN 32x25 (R 11/4x1) mit A/I-Gewinde', 1.42, 'https://prd-cc.rf24.de/medias/50c1b8fead92cd62aef4299ab2ad343a.jpg?context=bWFzdGVyfGltYWdlc3wxMDM2NjZ8aW1hZ2UvanBlZ3xhRFU0TDJnMVlpOHhOVGt4T1RFMk1qRTVOVGs1T0M4M016QTBPVjlHUmw4eU5ERXRNbDg0TURBdWFuQm58OTQ1MzBmMGRkNTYzZWY3NzlkZjVlMGNlMTU2NTVjMTQ1M2I2NjU4MjZmZmJjYmI1Nzc0YThlNmFiMGJjMTI1Ng'),
  ('1016735200000', 'Schlauchschelle W2 aus Chromstahl 1.4016 Spannbereich 20 - 32 mm', 0.96, 'https://prd-cc.rf24.de/medias/097c0bc065f2d07a07007bd048180733.jpg?context=bWFzdGVyfGltYWdlc3wyMjk4MnxpbWFnZS9qcGVnfGFEZ3pMMmcwTXk4NU1UQXlPREUxT1RJd01UVTRMekV3TVRZM016VjRNREF3TURCZk9EQXdMbXB3Wnd8YTllNTgwNWIwYzJjOTBlOTViZTk3OWNiYTBmZjk4N2VkMzE3NDYwNWI1ODFhM2U1ZWIxNWZhMzgwZjM4YTU0Ng'))
insert into public.shop_artikel
  (artikelnr, name, kategorie_id, lieferant, einheit, preis_netto,
   bild_url, bild_ist_extern, aktiv, bestellbar, sichtbar_aufmass)
select n.artikelnr, n.name,
       'a82bfe28-e672-4979-88f0-f8e977fb9f6b'::uuid, 'R+F', 'Stück',
       n.preis, n.bild, n.bild is not null, true, false,
       -- Geraete gehoeren nicht auf die Strichliste.
       n.name !~* '(pumpe|gefäss|gefaess|rückspülfilter|rueckspuelfilter|heizkörper|heizkoerper)'
  from neu n
 where not exists (select 1 from public.shop_artikel a where a.artikelnr = n.artikelnr);

-- Bilder auch dort nachtragen, wo der Artikel schon stand und keines hatte.
with neu(artikelnr, name, preis, bild) as (values
  ('1036285300000', 'WESA-Kugelhahn aus Pressmessing, PN 32, vernickelt, IG/Ü-Mutter 1x11/4', 17.57, 'https://prd-cc.rf24.de/medias/62637b29cb226ec5f4820238604ada46.jpg?context=bWFzdGVyfGltYWdlc3w1Nzk3MHxpbWFnZS9qcGVnfGFEWm1MMmcxWmk4NU1UQTBOakU0TVRreU9USTJMekV3TXpZeU9EVjRlREF3TURCZk9EQXdMbXB3Wnd8MjI1ZDJkNzM0NjliNDgwMjdiMWU4ODY4NjYyZWYzOTAxOGQ2MGRkYzQ3ODQ3MDBkOGJjMTJlNDA4YmU4N2MxYQ'),
  ('7020900704803', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 35 mm x 1 AG', 8.21, null),
  ('1011960350012', 'SANCO-Kupferrohr blank nach EN 1057 hart, 35 x 1,2 mm, (in 5-m Stück)', 20.62, 'https://prd-cc.rf24.de/medias/fc8d3ea8441595f83a67ffa1a521cd2d.jpg?context=bWFzdGVyfGltYWdlc3wxOTk1N3xpbWFnZS9qcGVnfGFEbGtMMmc1TWk4eE1EQTVPRFU1T0RBeE9URXdNaTgzTmpZME5pQXRJREV3TVRFNU5qQjRlREF3ZUhoZk9EQXdMbXB3Wnd8N2IxMmQyYTg2MWFiMWYwYjc0MGNjNWVlYWQ5MmU1Nzc4YjVmMTdlNmZmYTdhZTg2NjQ5NjYxYzVlMjY4YzZjZg'),
  ('7076526110639', 'FL KFE-Kugelhahn Durchgang, DVGW G1/2a PN16 MS vern.', 10.16, 'https://prd-cc.rf24.de/medias/31c7ddfd3b9386f874d9c716e3b8ffd1.jpg?context=bWFzdGVyfGltYWdlc3w2ODM1OTZ8aW1hZ2UvanBlZ3xhR0kwTDJobVlpODRPRFl5TnpjMU9UQXlNak00TDJReE5qQXdNREV2WkdWeWFYWmhkR1Z6THpZdk1EQXhMek0wT0M4Mk1ETTNNQ0F0SURjd056WTFNall4TVRBMk16bGZSakV3TmpNNUlHNWxkVjg0TURBdWFuQm58NWJkYTYzYTZmOTRmODE4ZmY5MTdlYjhiNGI1OTU4ODJiYzc2Zjc1NDc3MjkwMmNmODMyNGYwOTUyMzM5MTcxNA'),
  ('7020900558932', 'Prestabo-T-Stück mit SC-Contur, mit IG aus unlegiertem Stahl, 35 x 1/2 x 35 mm', 10.51, null),
  ('1014054310000', 'T-Stück aus RG/CuSi Nr.3130 in Rp1 x Rp1/2 x Rp1', 12.16, 'https://prd-cc.rf24.de/medias/520075f1769dbfa32da52903ebefd9d5.jpg?context=bWFzdGVyfGltYWdlc3w3MzYwMHxpbWFnZS9qcGVnfGFESXlMMmhsWXk4eE5UVTVNakF5TURnek5qTTRNaTh4TVRVeU1EWmZNakF5TlRFeE1USmZkbWxpWDJSZmNIQmZiVE14TXpCZmFUTTJNalV4TlY4eE1WODRNREF1YW5CbnxiYzYyYWNmOTgwZWRlMDQxOTAwZDA2NGUyODMwYmUyMjIyODM2ZDNkYjlmNTZhMDJhNWFiYTFkYTRlOTE0YWEy'),
  ('1029201070504', 'Uponor Übergangsnippel S-Press PLUS 20-R1/2"MT', 7.24, 'https://prd-cc.rf24.de/medias/b969767ccc5a1723d711ba6913a89ebf.jpg?context=bWFzdGVyfGltYWdlc3w0NTM5M3xpbWFnZS9qcGVnfGFEZzBMMmczTUM4NU1UQXdOVE0wTWpFNE56Z3lMemN4TkRBM1gzVndZbDl3TVRBM01EVXdNVjg0TURBdWFuQm58ODI1YjE2ZjljNDNhMGE2YWNlOGUyZjJmMGQyZmU4ZDVlMmU3OGZiM2UzZWIzMjUyYWMxMzI5N2RlZmQ0MWUxYg'),
  ('7089233910000', 'Kermi x2 Profil-V T33 900x155x1000 QN3023, RAL9016, 10bar, Vent.li,m.Abd,BK', 391.39, null),
  ('7020900641986', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x 1/2 AG', 6.25, null),
  ('1005520035020', 'Rockwool Heizungsrohrschale 800 für Rohr 35 mm, Dämmdicke 20 mm,VPE 25m', 4.62, 'https://prd-cc.rf24.de/medias/585e846c453de7635e40ed07171c8be1.jpg?context=bWFzdGVyfGltYWdlc3wzMTkyOXxpbWFnZS9qcGVnfGFEWTJMMmhpT1M4NU1USTRORFU0TWpnNU1UZ3lMekF3TURBNVh6RXdNRFUxTWpBd01UVXdNakI0WHpnd01DNXFjR2N8NTZiZGNiMjFjYzY0NThhNzY4OGQyMmUzMGZmMzI2NmZjZDY3ODJmODY1NjY5NDZiNWIyMzI1NDYzNTViY2RlYw'),
  ('7020900704766', 'Viega Übergangsstück mit SC Prestabo 1112 in 35mm x Rp1 Stahl verzinkt', 8.21, null),
  ('1029201059576', 'Uponor weiß Uni Pipe PLUS 16x2,0 100m', 1.72, 'https://prd-cc.rf24.de/medias/95c1e59225324c58d6ecfdefac62b7b2.jpg?context=bWFzdGVyfGltYWdlc3wxNjMxMHxpbWFnZS9qcGVnfGFEUTBMMmc0WWk4NU1USTFOemt4T0RJMU9UVXdMekF3TURBNVh6RXdNamt5TURFd05UazFOelpmT0RBd0xtcHdad3wwYjBmYzRhYzUzNjJhMzFlNjJmMWNhMTRhNmQ5ZjFiOTdlZGZkMmQyNjc2Nzg4OGEyMmQwYTY1ZjdjODhhNjA4'),
  ('1014048400000', 'Rohrverschraubung aus RG/CuSi Nr.3331 R 11/4,flachdichtend, mit I/A-Gewinde', 40.8, 'https://prd-cc.rf24.de/medias/cf36f4d2c2fbf0c813817278e0cf03ef.jpg?context=bWFzdGVyfGltYWdlc3wxNzM1MDJ8aW1hZ2UvanBlZ3xhR0ZoTDJoaU9TOHhOVFU1TVRBNE1qazRNelExTkM4M01qUXdOMTkyYVdKZmJWOHpNek14WDJSZk1URmZNMTg0TURBdWFuQm58NGQ3YzQ3OTY0NjQ0NGM5NTkwZDJiY2FkOGMwMzU4NjVkMDVhNTliODllYjA3MjE5ODhhODkyZTFkM2Y3MDk5ZA'),
  ('7020900559496', 'Prestabo-Rohr aus unlegiertem Stahl, 35 mm x 1,5, Modell 1103', 5.54, null),
  ('1029201070618', 'Uponor Übergang auf Kupfer S-Press PLUS 25-22CU', 11.54, 'https://prd-cc.rf24.de/medias/cb9cc14166bda2f5f8f37b01f1c3e0f1.jpg?context=bWFzdGVyfGltYWdlc3wzMTM2N3xpbWFnZS9qcGVnfGFEQTVMMmhrTnk4NU1UQXdOVE16TXpBeE1qYzRMemN4TkRBM1gzVndZbDl3TVRBM01EY3dOVjg0TURBdWFuQm58ZjVhOTkyYzI2NWUyMTQ4NzRkZjQzODFlMWExMGY0NDNhYTM4ZjhmNmRhNzIwZjQxNjZiMDhlY2EyOTc3MDYwZg'),
  ('7084560100000', 'Vorlauf-Regulierventil m.Therm.-Oberteil Durchgangsform m.Muffen-IG DN 15-R 1/2', 21.41, 'https://prd-cc.rf24.de/medias/d39285554680f37b9442b92bf66e2718.jpg?context=bWFzdGVyfGltYWdlc3wzMjAxOTF8aW1hZ2UvanBlZ3xhR1V3TDJnNFl5ODVNVFV5TVRJMk1EVTROVEkyTHpJNE5UWXpYMmhsWWw5a01UTXdNaTB3TWkwd01EQXROR010YUdsZk9EQXdMbXB3Wnd8ZjMyMWFlYmE1ZjFiMjA1M2ZlNDNjYmUyYWJjODM0MTQ1MjUzMDc3Y2Y4Nzg2MzA3N2NlM2Y0NWIwMjA0ZDU2Nw'),
  ('7089233608000', 'Kermi x2 Profil-V T33 600x155x800 QN1789, RAL9016, 10bar, Vent.li,m.Abd,BK', 228.75, null),
  ('7075720300500', 'Pumpenverschraubungs-Set a. Temperguss schwarz, DN 25 IG x DN 40 IG', 3.99, 'https://prd-cc.rf24.de/medias/1dc5680423ea0f55e4bc696fd82a888c.jpg?context=bWFzdGVyfGltYWdlc3wyMDU3MnxpbWFnZS9qcGVnfGFHWTVMMmd5WXk4eE1EQTVPRFU1TURRME9UWTVOQzh3TURBd09WODNNRGMxTnpJd1dEQXdXRmhZSUZSbGJYQmxjbWN1SUhOamFIY3VJRWxIZUVsSFh6Z3dNQzVxY0djfDczYmYxZWViZDEyOTExY2UyMThjYWM1ZmZiYzZjYTFmZGRmZTI3OThjNDlkNzYyZjc2NjM4ODVjNjZmNmQzYTQ'),
  ('7020900558550', 'Prestabo-Reduzierstück mit SC-Contur aus unlegiertem Stahl, 35 x 22 mm', 2.69, null),
  ('1029201070509', 'Uponor Übergangsnippel S-Press PLUS 32-R1"MT', 12, 'https://prd-cc.rf24.de/medias/b969767ccc5a1723d711ba6913a89ebf.jpg?context=bWFzdGVyfGltYWdlc3w0NTM5M3xpbWFnZS9qcGVnfGFEZzBMMmczTUM4NU1UQXdOVE0wTWpFNE56Z3lMemN4TkRBM1gzVndZbDl3TVRBM01EVXdNVjg0TURBdWFuQm58ODI1YjE2ZjljNDNhMGE2YWNlOGUyZjJmMGQyZmU4ZDVlMmU3OGZiM2UzZWIzMjUyYWMxMzI5N2RlZmQ0MWUxYg'),
  ('7020900559052', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 35 mm x 11/4 AG', 8.88, null),
  ('7076110130000', 'ESBE Stellmotor ARA 661, 230 VAC, 50 Hz 2 min,ohne Mikroschalter,3-Punkt-Steuer.', 129.48, 'https://prd-cc.rf24.de/medias/8cfe18cb4074942f430c21a045d7aaa8.jpg?context=bWFzdGVyfGltYWdlc3wyMTczMHxpbWFnZS9qcGVnfGFEa3dMMmd4WVM4NU1UVTJOVFkyTXpVeE9UQXlMekF3TURBNVh6Y3dOell4UVZKQk5qQXdYemd3TUM1cWNHY3w4YTgzZGY2N2U5NDI4ZTJkYzY2NDU4YjQ0OTJjM2YwMDFlMTFmMTE0OTM4M2QyYjVlMzFjODM2MmMzYzZjZDc0'),
  ('7089322904000', 'Kermi x2 Profil-V T22 900x100x400 QN918, RAL9016, 10bar, Vent.li, m.Abd,BK', 153.57, null),
  ('1011960220000', 'SANCO-Kupferrohr blank nach EN 1057 halbhart, 22 x 1 mm, (in 5-m Stück)', 10.43, 'https://prd-cc.rf24.de/medias/fc8d3ea8441595f83a67ffa1a521cd2d.jpg?context=bWFzdGVyfGltYWdlc3wxOTk1N3xpbWFnZS9qcGVnfGFEbGtMMmc1TWk4eE1EQTVPRFU1T0RBeE9URXdNaTgzTmpZME5pQXRJREV3TVRFNU5qQjRlREF3ZUhoZk9EQXdMbXB3Wnd8N2IxMmQyYTg2MWFiMWYwYjc0MGNjNWVlYWQ5MmU1Nzc4YjVmMTdlNmZmYTdhZTg2NjQ5NjYxYzVlMjY4YzZjZg'),
  ('1013006300000', 'Doppelnippel schwarz DN 25 (R 1) 60 mm', 0.82, 'https://prd-cc.rf24.de/medias/79f3346fc0a74b9456a13819d52ddd98.jpg?context=bWFzdGVyfGltYWdlc3w5NzcxM3xpbWFnZS9qcGVnfGFEVTJMMmhtTkM4eE1EUXdOekU0TVRjeE16UXpPQzgyTkRNeU9WOHlNMTl6ZDE4NE1EQXVhbkJufDA2YTZmNmE1ZjMyZDIxNmFkMmM1MGJmNzFlNWJkMWNlNDFiNDYzYzAwOWY5MmIxYjZlNmY3YTJmMWUzOTJmZTE'),
  ('7020900558765', 'Prestabo-T-Stück mit SC-Contur, aus unlegiertem Stahl, 35 x 22 x 35 mm', 9.74, 'https://prd-cc.rf24.de/medias/42c3eea7892f9e836c1718f4184aa40c.jpg?context=bWFzdGVyfGltYWdlc3w4OTU0fGltYWdlL2pwZWd8YUdGa0wyZ3lZaTh4TlRVNU1Ua3hNelU0TmpjeE9DODNNalF3TjE5MmFXSmZiVjh4TVRFNFgyUmZNVEZmTTE4eU1EQXVhbkJufGMxNzI2NWQ2OWEyOTUwODUxZWEzZTNmMjI4ZmRjNDkxZTZjM2YxNjI3NTY2YjI1M2IwNjk5ZGI3ZjdhNmYwMDI'),
  ('1011960281000', 'SANCO-Kupferrohr blank nach EN 1057 halbhart, 28 x 1 mm, (in 5-m Stück)', 13.71, 'https://prd-cc.rf24.de/medias/fc8d3ea8441595f83a67ffa1a521cd2d.jpg?context=bWFzdGVyfGltYWdlc3wxOTk1N3xpbWFnZS9qcGVnfGFEbGtMMmc1TWk4eE1EQTVPRFU1T0RBeE9URXdNaTgzTmpZME5pQXRJREV3TVRFNU5qQjRlREF3ZUhoZk9EQXdMbXB3Wnd8N2IxMmQyYTg2MWFiMWYwYjc0MGNjNWVlYWQ5MmU1Nzc4YjVmMTdlNmZmYTdhZTg2NjQ5NjYxYzVlMjY4YzZjZg'),
  ('1029201070615', 'Uponor Übergang auf Kupfer S-Press PLUS 16-15CU', 7.08, 'https://prd-cc.rf24.de/medias/cb9cc14166bda2f5f8f37b01f1c3e0f1.jpg?context=bWFzdGVyfGltYWdlc3wzMTM2N3xpbWFnZS9qcGVnfGFEQTVMMmhrTnk4NU1UQXdOVE16TXpBeE1qYzRMemN4TkRBM1gzVndZbDl3TVRBM01EY3dOVjg0TURBdWFuQm58ZjVhOTkyYzI2NWUyMTQ4NzRkZjQzODFlMWExMGY0NDNhYTM4ZjhmNmRhNzIwZjQxNjZiMDhlY2EyOTc3MDYwZg'),
  ('7076801900000', 'Einschraub-Schutzrohr Typ SWT52G G1/2B - 10,0*0,75 U1=100 MS SW27', 5.55, 'https://prd-cc.rf24.de/medias/0844964eba2d1bbce1c251f5b92855a1.jpg?context=bWFzdGVyfGltYWdlc3wzMDQ5N3xpbWFnZS9qcGVnfGFEZ3dMMmcyTlM4eE1EWXhORFl6TkRrd05UWXpNQzgzTmpRNE9WOVRWMVExTWtkZk9EQXdMbXB3Wnd8YWViZDIyMDkyNzRkOWI1ZGZjYzE1NGZhNjFjNjAwMDUwYzk4ODViZTNjNzhkMzQ3YmZlZjg0MmI0NGVmNjE2NQ'),
  ('7020900559038', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x 3/4 AG', 4.86, null),
  ('1013015300000', 'Doppelnippel schwarz DN 25 (R 1) 150 mm', 1.63, 'https://prd-cc.rf24.de/medias/79f3346fc0a74b9456a13819d52ddd98.jpg?context=bWFzdGVyfGltYWdlc3w5NzcxM3xpbWFnZS9qcGVnfGFEVTJMMmhtTkM4eE1EUXdOekU0TVRjeE16UXpPQzgyTkRNeU9WOHlNMTl6ZDE4NE1EQXVhbkJufDA2YTZmNmE1ZjMyZDIxNmFkMmM1MGJmNzFlNWJkMWNlNDFiNDYzYzAwOWY5MmIxYjZlNmY3YTJmMWUzOTJmZTE'),
  ('7020900642204', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 35 mm x 11/4 IG', 10.04, null),
  ('7076111601000', 'ESBE 3-Wege-Mischer TYP VRG 131-6,3 DN 25, IG, Rp 1, 6,3 Kvs', 54.98, 'https://prd-cc.rf24.de/medias/a59fd123c13e9fc5fa42f3c29a69024a.jpg?context=bWFzdGVyfGltYWdlc3wyMTYwMHxpbWFnZS9qcGVnfGFERXlMMmcwT1M4NU1USXpPVFEzTVRVeE16a3dMemN3TnpZeE1URTJNREI0ZUhoZk9EQXdMbXB3Wnd8YjY2NzEwMTMxYzZmYjAyYTJkN2YyZGUwNjUwODYxNzg0YzdmMjQwMGQ1YTA4ZTgwZWJhOTNmYTg2YzMxYmZmZQ'),
  ('7020900558918', 'Prestabo-T-Stück mit SC-Contur, mit IG aus unlegiertem Stahl, 28 x 1/2 x 28 mm', 7.24, 'https://prd-cc.rf24.de/medias/42c3eea7892f9e836c1718f4184aa40c.jpg?context=bWFzdGVyfGltYWdlc3w4OTU0fGltYWdlL2pwZWd8YUdGa0wyZ3lZaTh4TlRVNU1Ua3hNelU0TmpjeE9DODNNalF3TjE5MmFXSmZiVjh4TVRFNFgyUmZNVEZmTTE4eU1EQXVhbkJufGMxNzI2NWQ2OWEyOTUwODUxZWEzZTNmMjI4ZmRjNDkxZTZjM2YxNjI3NTY2YjI1M2IwNjk5ZGI3ZjdhNmYwMDI'),
  ('2029415160300', 'Wickelfalzrohr DIN EN 12237, verzinkt d 160 mm,Lieferlänge 3 m, Enden verschl.', 8.12, 'https://prd-cc.rf24.de/medias/c23aa414deef130db4c5a96f74800cfe.jpg?context=bWFzdGVyfGltYWdlc3wzNDA3MDV8aW1hZ2UvanBlZ3xhREJpTDJnd05pODVNVE0yTWprNU16UXpPVEF5THpVMk1EZ3hYMU5TUlU1WVgyMWxYemd3TUM1cWNHY3w4MzRlMDEyNzViYTFiZTQ3OTE2YzBhYWI5ZTVlYzQ4N2ViYmFlODIzYzJjOGQ4ZDBjZjgyZGQxNWU3M2NlNmQy'),
  ('1029201070616', 'Uponor Übergang auf Kupfer S-Press PLUS 20-18CU', 9.38, 'https://prd-cc.rf24.de/medias/cb9cc14166bda2f5f8f37b01f1c3e0f1.jpg?context=bWFzdGVyfGltYWdlc3wzMTM2N3xpbWFnZS9qcGVnfGFEQTVMMmhrTnk4NU1UQXdOVE16TXpBeE1qYzRMemN4TkRBM1gzVndZbDl3TVRBM01EY3dOVjg0TURBdWFuQm58ZjVhOTkyYzI2NWUyMTQ4NzRkZjQzODFlMWExMGY0NDNhYTM4ZjhmNmRhNzIwZjQxNjZiMDhlY2EyOTc3MDYwZg'),
  ('7021573400000', 'Megapress Übergangsstück IG mit SC 4212in11/4ZollxRp11/4 StahlZn-Ni besch.', 13.69, null),
  ('7020900642167', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x 1 IG', 6.29, null),
  ('1013010300000', 'Doppelnippel schwarz DN 25 (R 1) 100 mm', 1.01, 'https://prd-cc.rf24.de/medias/79f3346fc0a74b9456a13819d52ddd98.jpg?context=bWFzdGVyfGltYWdlc3w5NzcxM3xpbWFnZS9qcGVnfGFEVTJMMmhtTkM4eE1EUXdOekU0TVRjeE16UXpPQzgyTkRNeU9WOHlNMTl6ZDE4NE1EQXVhbkJufDA2YTZmNmE1ZjMyZDIxNmFkMmM1MGJmNzFlNWJkMWNlNDFiNDYzYzAwOWY5MmIxYjZlNmY3YTJmMWUzOTJmZTE'),
  ('1014036406000', 'Doppelnippel aus RG/CuSi blank DN 32 (R 11/4) x 60 mm, Modell 3530', 10.22, 'https://prd-cc.rf24.de/medias/369ad0986b81926ba1b1993615718f3f.jpg?context=bWFzdGVyfGltYWdlc3w3OTk2OHxpbWFnZS9qcGVnfGFESmxMMmhoWmk4eE5UVTVNRGMwTmpneE5qVTBNaTgzTWpRd04xOTJhV0pmWVY4ek1UZzBPREpmWkY4eE1WOHhYemd3TUM1cWNHY3w5MTRmM2MyNmFlMjA2ZmM3M2FlMjllNzZkOWU2NDViNWEwZTIwNzljZDYwNzYxZWJkMTMxNWU3NjVmMTRhYTFh'),
  ('1013012300000', 'Doppelnippel schwarz DN 25 (R 1) 120 mm', 1.36, 'https://prd-cc.rf24.de/medias/79f3346fc0a74b9456a13819d52ddd98.jpg?context=bWFzdGVyfGltYWdlc3w5NzcxM3xpbWFnZS9qcGVnfGFEVTJMMmhtTkM4eE1EUXdOekU0TVRjeE16UXpPQzgyTkRNeU9WOHlNMTl6ZDE4NE1EQXVhbkJufDA2YTZmNmE1ZjMyZDIxNmFkMmM1MGJmNzFlNWJkMWNlNDFiNDYzYzAwOWY5MmIxYjZlNmY3YTJmMWUzOTJmZTE'),
  ('7020900642150', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x 1/2 IG', 6.25, null),
  ('7020900559120', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 28 mm x 1 IG', 7.18, null),
  ('7021572300000', 'Megapress Übergangsstück AG mit SC 4211 in 1ZollxR1 Stahl Zn-Ni besch.', 12.22, null),
  ('1011960150000', 'SANCO-Kupferrohr blank nach EN 1057 halbhart, 15 x 1 mm, (in 5-m Stück)', 6.47, 'https://prd-cc.rf24.de/medias/fc8d3ea8441595f83a67ffa1a521cd2d.jpg?context=bWFzdGVyfGltYWdlc3wxOTk1N3xpbWFnZS9qcGVnfGFEbGtMMmc1TWk4eE1EQTVPRFU1T0RBeE9URXdNaTgzTmpZME5pQXRJREV3TVRFNU5qQjRlREF3ZUhoZk9EQXdMbXB3Wnd8N2IxMmQyYTg2MWFiMWYwYjc0MGNjNWVlYWQ5MmU1Nzc4YjVmMTdlNmZmYTdhZTg2NjQ5NjYxYzVlMjY4YzZjZg'),
  ('7087901109002', 'Serviceventil K6/9 Geeignet f. Kermi Ventil-Flachheizkörper', 33.66, 'https://prd-cc.rf24.de/medias/d8b0e794f315116c1122f1f5a777d3f4.jpg?context=bWFzdGVyfGltYWdlc3w0ODAzNnxpbWFnZS9qcGVnfGFERXlMMmd5TUM4eE5UYzJNVFk1TkRReU5URXhPQzh6TlRFeU1WOXJhWE5mZW5aZmRtVnVkR2xzWDNZeGExOHhPVGt4TFRFNU9UTmZPREF3TG1wd1p3fGJmNzdiYWIyNGU3MGZjYWYzNzEzZjIwM2EzOWI3ZmUyMzZkMzJkYWVmNzJjNzQzZDk2ZTQ5ZDI3Y2FiODNkNzg'),
  ('1009503050100', 'GE Silent-PP Rohr mit Muffe d50x2 L:100cm', 4.77, null),
  ('1029201070617', 'Uponor Übergang auf Kupfer S-Press PLUS 20-22CU', 9.54, 'https://prd-cc.rf24.de/medias/cb9cc14166bda2f5f8f37b01f1c3e0f1.jpg?context=bWFzdGVyfGltYWdlc3wzMTM2N3xpbWFnZS9qcGVnfGFEQTVMMmhrTnk4NU1UQXdOVE16TXpBeE1qYzRMemN4TkRBM1gzVndZbDl3TVRBM01EY3dOVjg0TURBdWFuQm58ZjVhOTkyYzI2NWUyMTQ4NzRkZjQzODFlMWExMGY0NDNhYTM4ZjhmNmRhNzIwZjQxNjZiMDhlY2EyOTc3MDYwZg'),
  ('1005520022030', 'Rockwool Heizungsrohrschale 800 für Rohr 22 mm, Dämmdicke 30 mm,VPE 20m', 5.39, 'https://prd-cc.rf24.de/medias/585e846c453de7635e40ed07171c8be1.jpg?context=bWFzdGVyfGltYWdlc3wzMTkyOXxpbWFnZS9qcGVnfGFEWTJMMmhpT1M4NU1USTRORFU0TWpnNU1UZ3lMekF3TURBNVh6RXdNRFUxTWpBd01UVXdNakI0WHpnd01DNXFjR2N8NTZiZGNiMjFjYzY0NThhNzY4OGQyMmUzMGZmMzI2NmZjZDY3ODJmODY1NjY5NDZiNWIyMzI1NDYzNTViY2RlYw'),
  ('1012963200000', 'Gebo Temperguss-KLV Serie 150, Abzweig Typ T 3/4" für Stahlrohr', 22.57, 'https://prd-cc.rf24.de/medias/1377281f3597cf2e548f9222c915728f.jpg?context=bWFzdGVyfGltYWdlc3w0ODQ0fGltYWdlL2pwZWd8YURNM0wyZzRNeTg1TVRBek1UQTNORGc1T0RJeUx6RXdNVEk1TmpONGVIZ3dNREJmT0RBd0xtcHdad3xkYWJkM2JlNTAyYzkxZjYzNmVlNzg0YjYxYTU0MTJiODEzYTUxODAzMmU4MTAzYWQ0ZGNmMjg5MjI0ZDk5NDNm'),
  ('1014049410000', 'Reduzierstück aus RG/CuSi Nr.3241 R 11/4 x 1/2, mit A/I-Gewinde', 6.21, 'https://prd-cc.rf24.de/medias/40054cbc5c17ba4eac795b5c4870a264.jpg?context=bWFzdGVyfGltYWdlc3wxODIyMDh8aW1hZ2UvanBlZ3xhRE13TDJnNU9DOHhOVFU1TVRFMk1EYzBNVGt4T0M4M01qUXdOMTkyYVdKZllWOHlOamMxT0RKZlpGOHhNVjh4WHpnd01DNXFjR2N8YzQ2Njc5NzdkYjY4NDQyZjUzMDgxYTdhZTBkMmFjNjRlZjM5ODdkN2VkMzdiNTc0YTZhODJlMzY0YjdmMTEzMQ'),
  ('1014057430000', 'Reduzier-Nippel aus RG/CuSi Nr.3245 11/4 AG x 1 AG', 6.14, 'https://prd-cc.rf24.de/medias/6bfa1f3e572b2ba0feec214af1639321.jpg?context=bWFzdGVyfGltYWdlc3w5NzM1NHxpbWFnZS9qcGVnfGFETmpMMmd5WXk4eE5UVTVNREV4TVRVM05qQTVOQzgzTWpRd04xOTJhV0pmYlY4ek1qUTFYMlJmTVRGZk0xODRNREF1YW5CbnxlYjBjNDY1NjI1MjkwMzdkYmNkMjY4YTczMzI0NDVjNGRmZTIzNWFlNjcxMzgwYjQxY2E4M2E2MWQxNzRiNzgw'),
  ('1029201070639', 'Uponor Wandscheibe S-Press PLUS 16-Rp1/2"FT', 9.24, 'https://prd-cc.rf24.de/medias/4a92ddf9ef4aa1eb1768923021cee2d5.jpg?context=bWFzdGVyfGltYWdlc3w0MTU1MnxpbWFnZS9qcGVnfGFEVXpMMmd3Tmk4NU1UQXdOVE13TnpRMU16YzBMemN4TkRBM1gzVndZbDl3TVRBM01EWXpPRjg0TURBdWFuQm58Y2I3YjEwY2VlNTUxNzhhZWY4OTE0ZTk3ODQ2NmQ3ZTc1ZmNiMTJiYmEwMmM3Zjg2MTM5NWRjNGY2YjU1YWI5MA'),
  ('7021573300000', 'Megapress Übergangsstück IG mit SC 4212 in 1ZollxRp1 Stahl Zn-Ni besch.', 11.72, null),
  ('1014036108000', 'Doppelnippel aus RG/CuSi blank DN 15 (R 1/2) x 80 mm, Modell 3530', 3.85, 'https://prd-cc.rf24.de/medias/1e621042403e45e52d0a629ee93d00c6.jpg?context=bWFzdGVyfGltYWdlc3w3OTk2OHxpbWFnZS9qcGVnfGFETTBMMmhoWXk4eE5UVTVNRFl3TnpnNE1ESXlNaTgzTWpRd04xOTJhV0pmWVY4eU5qY3pNakpmWkY4eE1WOHhYemd3TUM1cWNHY3w3ZDEyZjk5NGNhMTE3ZGViM2U1NzZkZDM4YzFjNDI4OTc5NzRlOGRiNjMwZjMzZTdiNDhjMzMyZmIxYWRmYzkw'),
  ('7020900704797', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x1 AG', 4.65, null),
  ('1029201070563', 'Uponor T-Stück S-Press PLUS 32-32-32', 22.44, 'https://prd-cc.rf24.de/medias/9f5640acf7f6873cd7a2534129f1bce8.jpg?context=bWFzdGVyfGltYWdlc3w1MTIzOXxpbWFnZS9qcGVnfGFHRTBMMmcxTWk4NU1UQXdOVE14TWpZNU5qWXlMemN4TkRBM1gzVndZbDl3TVRBM01EVTJNRjg0TURBdWFuQm58NDFjYThlZTEzMmUzZDUyZTg5ZWY1YTUxOWVjYmExOTMyYTgzYjVlZTk2MzY0N2E3OGNjMjBmZjkwOTYwNzA1ZQ'),
  ('1016376400000', 'Oberteil, kurz Spindel steigend, DN 32 (R 11/4)', 20.03, 'https://prd-cc.rf24.de/medias/03fa07f5b15ae8b19031a70a761f8f47.jpg?context=bWFzdGVyfGltYWdlc3wyODk1MHxpbWFnZS9qcGVnfGFEWmtMMmhtWmk4eE5qWTFNemN5TnpBM01qSTROaTh4TXpjNE56TmZhbk5pWDJRd01ERTRNREV6TWpBd01qRXdYemd3TUM1cWNHY3xhOGRiODhmZDI5NzRhZWMxMTBhMTEzMDk0YTNhNmM1MTc3YjRiYjYzM2VhMTA2NmFlZDRkZTIzNDQxNTQ4ZDRi'),
  ('1029201070599', 'Uponor T-Stück m. Innengew. S-Press PLUS 25-Rp3/4"FT-25', 18.62, 'https://prd-cc.rf24.de/medias/7786cb45754674f2a4f096ca4f97179d.jpg?context=bWFzdGVyfGltYWdlc3w0NjI4N3xpbWFnZS9qcGVnfGFEQmlMMmhqTXk4NU1UQXdOVE15TkRRNU16RXdMemN4TkRBM1gzVndZbDl3TVRBM01EVTVOVjg0TURBdWFuQm58MDE5NTdlYjU2MzZlOTVjNzNmYWE5MGE0MDMyNTU4MzM3MDk5ZTM1OGU0M2IzZTUyZjcxZDE5ZGRiNzUxODE5NQ'),
  ('7020900559113', 'Prestabo-Übergang mit SC-Contur aus unlegiertem Stahl, 22 mm x 3/4 IG', 5.29, null),
  ('7021573500000', 'Megapress Übergangsstück IG mit SC 4212 in11/2ZollxRp11/2 StahlZn-Ni besch.', 16.1, null),
  ('1005520018030', 'Rockwool Heizungsrohrschale 800 für Rohr 18 mm, Dämmdicke 30 mm,VPE 25m', 5.08, 'https://prd-cc.rf24.de/medias/585e846c453de7635e40ed07171c8be1.jpg?context=bWFzdGVyfGltYWdlc3wzMTkyOXxpbWFnZS9qcGVnfGFEWTJMMmhpT1M4NU1USTRORFU0TWpnNU1UZ3lMekF3TURBNVh6RXdNRFUxTWpBd01UVXdNakI0WHpnd01DNXFjR2N8NTZiZGNiMjFjYzY0NThhNzY4OGQyMmUzMGZmMzI2NmZjZDY3ODJmODY1NjY5NDZiNWIyMzI1NDYzNTViY2RlYw'),
  ('1027100206908', 'Sudo-Press-Fitting aus Rg. f.Wasser 18 x R 1/2 IG x 18, T-Stück ,VC130G', 19.93, 'https://prd-cc.rf24.de/medias/42631aabbe664cd93b8631f8385908fe.jpg?context=bWFzdGVyfGltYWdlc3wyNDA1MHxpbWFnZS9qcGVnfGFHUmxMMmd3Tmk4NU1URTROelUwT1RZek5EZzJMekF3TURBNVh6UXhNekJIVmxjeE1qRXlNVEpmT0RBd0xtcHdad3wwNTYxMzc5YTY5MDQ0ZDE2YzJlYjg0YzA1ZDkxYzU3YWY4OGNiZmE2ODcwNzIxZmYyMmU3MTYxYmRhOTU4ZWFk'),
  ('1009505050088', 'GE Silent-PP Bogen 87,5Gr d50', 2.97, null),
  ('7075461410000', 'Reduktionsnippel Nr. 241, schwarz DN 32x15 (R 11/4x1/2) mit A/I-Gewinde', 2.16, 'https://prd-cc.rf24.de/medias/50c1b8fead92cd62aef4299ab2ad343a.jpg?context=bWFzdGVyfGltYWdlc3wxMDM2NjZ8aW1hZ2UvanBlZ3xhRFU0TDJnMVlpOHhOVGt4T1RFMk1qRTVOVGs1T0M4M016QTBPVjlHUmw4eU5ERXRNbDg0TURBdWFuQm58OTQ1MzBmMGRkNTYzZWY3NzlkZjVlMGNlMTU2NTVjMTQ1M2I2NjU4MjZmZmJjYmI1Nzc0YThlNmFiMGJjMTI1Ng'),
  ('2029301169000', 'Bogen mit Lippendichtung, gepresst d 160 mm, 90 Grad', 7.94, 'https://prd-cc.rf24.de/medias/71125cd72db3b024c7994d71763d6839.jpg?context=bWFzdGVyfGltYWdlc3w4MTMwOXxpbWFnZS9qcGVnfGFEVXdMMmd5Tmk4NU1UTTBPRFU1TWpVMU9ETTRMelUyTURneFgwSkVYemt3WHpnd01DNXFjR2N8ZTUzZjdiYzQ2NGI1YTg2YzdjMjViYjI4MDkxNzNlYTNmY2EzMTFmY2M5ZWYzZTgxMDZmZjFkNzkxYmIyOTY2OQ'),
  ('1029201070535', 'Uponor Winkelnippel S-Press PLUS 25-R3/4"MT', 13.37, 'https://prd-cc.rf24.de/medias/a4276742cf16b9b8e2676bd6d3482aaf.jpg?context=bWFzdGVyfGltYWdlc3w1NjkzOHxpbWFnZS9qcGVnfGFHRmhMMmcyTmk4NU1UQXdOVE14T0RJMk56RTRMemN4TkRBM1gzVndZbDl3TVRBM01EVXpNVjg0TURBdWFuQm58ZTkzMjE3YmIzZmNmMzFlNjA5Y2Q4MWJkMGU0ZWU1ZDgwMjAwNDQzZjA0YTUyMzAwNjE4ZmI5M2NiNDU5MjE2Zg'),
  ('7079056106000', 'CALEFFI Sicherheitsventil 253 Solar 1/2 IGx3/4 IGx6 bar,Ms-Gehäuse verchr.', 21.81, 'https://prd-cc.rf24.de/medias/cf96f6bf26636c1edbff9a799cdfc234.jpg?context=bWFzdGVyfGltYWdlc3w2MDE0NnxpbWFnZS9qcGVnfGFHUm1MMmcwWXk4NU1UQTFNVEkwTlRVMk9ETXdMekV6Tmpnd0xUY3dOemt3TlRZeFdGZ3dNREJmT0RBd0xtcHdad3w5ZTQ1YmVkMmU1YmJhYTQ2NWUxY2IyNWU1YjAwNDEwODBmZTRhYzlkMDlhMGUwNTlhMThkZjE4NTM2ZjFhZjY0'),
  ('1029201070576', 'Uponor T-Stück reduziert S-Press PLUS 25-20-20', 13.66, 'https://prd-cc.rf24.de/medias/8d043c6eab428b22c85318992dc13c29.jpg?context=bWFzdGVyfGltYWdlc3w1NzY1OHxpbWFnZS9qcGVnfGFETmtMMmhpT1M4NU1UQXdOVE15TVRnM01UWTJMemN4TkRBM1gzVndZbDl3TVRBM01EVTJObDg0TURBdWFuQm58ZGYzYThhNmVhMzk1MTFjMTA3NDVjNTNhZjg2MWY2MGY5ZjUyYmNjOWI1MjFhODU3OTkxZTJjNDUwZDRkN2I3Nw'),
  ('7075741100300', 'Pumpenverschraubungs-Set Kupferleg.CuSi G 1/2 IG x G 1 IG', 18.57, 'https://prd-cc.rf24.de/medias/a8d65a65d825920338504a34fcb3a0fc.jpg?context=bWFzdGVyfGltYWdlc3w2NjEwfGltYWdlL2pwZWd8YUdaaEwyaGlZaTg1TVRBMU56Z3lPRGs0TnpFNEx6QXdNREE1WHpjd056VTNOREY0TURCNE1EQmZPREF3TG1wd1p3fDUwMzlkYmRmZjA1ODg0YzM2MjUzYWJjYzA4ZTI2MzBkMDhhNmFjZTRkYTI5NzY0ODc0NTg3MGUwZTE5MzcwODY'),
  ('1014053200000', 'Winkel aus RG/CuSi Nr.3092 R 3/4, mit I/A-Gewinde', 3.46, 'https://prd-cc.rf24.de/medias/523492556c963854f375230809b62710.jpg?context=bWFzdGVyfGltYWdlc3w3NTA2OXxpbWFnZS9qcGVnfGFEUTNMMmhtTUM4eE5UVTVNVGsxTXpRMk5UTTNOQzh4TVRVeU1EWmZNakF5TlRFeE1USmZkbWxpWDJSZmNIQmZiVE13T1RKZmFUSTJOREF3TUY4eE1WODRNREF1YW5Cbnw3ZjYxYmQwZTIxY2U3MTIwMDdiMTVlYzE4MzgwYWI2OGI5NGViZmZhMjU2ZjBjNDc3OGJhYjBmNTBkNDk5YzAy'),
  ('7076802084094', 'Bimetall-Thermometer, Kl. 1 aus CrNiSt, 0 - +120 C, d 100 mm, Tauchlänge 160 mm', 23.55, 'https://prd-cc.rf24.de/medias/a7d9e6046b19808a660da3ac76153f23.jpg?context=bWFzdGVyfGltYWdlc3w3MDIxMnxpbWFnZS9qcGVnfGFEWmxMMmd4WkM4NU1UQXlORFF4T1RNNE9UYzBMemMyTkRnNVgwSnBiR1JmTWpCZlFUVXlYemd3TUM1cWNHY3w0NDQ0NGZlYjhlZjE5MmM5MmQ2MjU1ZmU0OWFmMjgyOWVjODE0ZDVlMWU2ZDM5ZWU4MGJiMWUxMjliYzU0NjA5'),
  ('1029201070569', 'Uponor T-Stück reduziert S-Press PLUS 20-20-16', 9.77, 'https://prd-cc.rf24.de/medias/8d043c6eab428b22c85318992dc13c29.jpg?context=bWFzdGVyfGltYWdlc3w1NzY1OHxpbWFnZS9qcGVnfGFETmtMMmhpT1M4NU1UQXdOVE15TVRnM01UWTJMemN4TkRBM1gzVndZbDl3TVRBM01EVTJObDg0TURBdWFuQm58ZGYzYThhNmVhMzk1MTFjMTA3NDVjNTNhZjg2MWY2MGY5ZjUyYmNjOWI1MjFhODU3OTkxZTJjNDUwZDRkN2I3Nw'),
  ('1016376200000', 'Oberteil, kurz Spindel steigend, DN 20 (R 3/4)', 8.24, 'https://prd-cc.rf24.de/medias/8fdcf104a02a2c5ccb84870cc72eb5a5.jpg?context=bWFzdGVyfGltYWdlc3wyMzQ0MnxpbWFnZS9qcGVnfGFEWTNMMmd5TUM4NU1UQXhOakF6T1RNd01UUXlMekV3TVRZek56WXdNREF3TUY4NE1EQXVhbkJufDY1NTk3ZWNlZjc2NDNlN2M0OTIzODFjMGIxYjYxNzI1OGIxODcxYmZmYjhjZTg2MWQwZTJmOTk0NGFlZGJiZjc'),
  ('1009503050200', 'GE Silent-PP Rohr mit Muffe d50x2 L:200cm', 9.77, null),
  ('7084055343401', 'HU Verlängerung G3/4 IGxG 3/4 AG Eurokonus selbstdicht., Ms vern.', 7.51, null),
  ('2024900000160', 'Optiline Lüftungsrohrschelle (M8) d 160 mm, mit grauer Schallschutzeinlage', 2.04, 'https://prd-cc.rf24.de/medias/bffa0a43773cc283894860beb8cd7e14.jpg?context=bWFzdGVyfGltYWdlc3wxNzIwNDN8aW1hZ2UvanBlZ3xhRFEyTDJnd015OHhNREUyTlRreU5USTBPVEExTkM4d056SXdNMTlQY0hScGJHbHVaVjlNZFdWbWRIVnVaM056WTJobGJHeGxYemd3TUM1cWNHY3w0ZGE2NTQxNGY1NmVhYThiNTVkNDI1YjNiYjJiMGJmN2MwZDZhMmJjYmQ4ZmVhMjJkM2E2MDAwOGJiY2I0MzMz'),
  ('1016358447182', 'Hahnverlängerung aus Rotguss, verchromt DN 15 (R 1/2), 25 mm, Mod.3526', 2.82, null),
  ('2029304163000', 'Reduzierung, symmetrisch mit Lippendichtung, d 160 x d 125 mm', 5.01, 'https://prd-cc.rf24.de/medias/907d944fb908c165490d7e11a952eb54.jpg?context=bWFzdGVyfGltYWdlc3w5NDYyNHxpbWFnZS9qcGVnfGFHSmlMMmc1WkM4eE1EUTRNalUwTkRNME5URXhPQzgxTmpBNE1WOVZSRjg0TURBdWFuQm58NjJmNmUzNjhhMmRjNmU0MWQyZTVmMDYwMDYxNjU1ZDY5ZGE2NTQ4OWI4YTYyMjE2YWEzMWMxY2E0OTI0YTdlOQ'),
  ('1014049540000', 'Reduzierstück aus RG/CuSi Nr.3241 R 11/2 x 11/4, mit A/I-Gewinde', 4.6, 'https://prd-cc.rf24.de/medias/1f399bc565443768175fea3189f08d47.jpg?context=bWFzdGVyfGltYWdlc3wxODIyMDh8aW1hZ2UvanBlZ3xhREE1TDJoaE9DOHhOVFU1TVRFM05qUXpOemM1TUM4M01qUXdOMTkyYVdKZllWOHlOamMzTURSZlpGOHhNVjh4WHpnd01DNXFjR2N8Yjk5MmNhYmZmZjBkYzFhM2Q0MjljMDZmNjlhOWQ5ZDY0NzE0N2NmM2Y4MTlmYzRlZTQ1YzIxZmJmNjlkYjdhZQ'),
  ('7075461430000', 'Reduktionsnippel Nr. 241, schwarz DN 32x25 (R 11/4x1) mit A/I-Gewinde', 1.42, 'https://prd-cc.rf24.de/medias/50c1b8fead92cd62aef4299ab2ad343a.jpg?context=bWFzdGVyfGltYWdlc3wxMDM2NjZ8aW1hZ2UvanBlZ3xhRFU0TDJnMVlpOHhOVGt4T1RFMk1qRTVOVGs1T0M4M016QTBPVjlHUmw4eU5ERXRNbDg0TURBdWFuQm58OTQ1MzBmMGRkNTYzZWY3NzlkZjVlMGNlMTU2NTVjMTQ1M2I2NjU4MjZmZmJjYmI1Nzc0YThlNmFiMGJjMTI1Ng'),
  ('1016735200000', 'Schlauchschelle W2 aus Chromstahl 1.4016 Spannbereich 20 - 32 mm', 0.96, 'https://prd-cc.rf24.de/medias/097c0bc065f2d07a07007bd048180733.jpg?context=bWFzdGVyfGltYWdlc3wyMjk4MnxpbWFnZS9qcGVnfGFEZ3pMMmcwTXk4NU1UQXlPREUxT1RJd01UVTRMekV3TVRZM016VjRNREF3TURCZk9EQXdMbXB3Wnd8YTllNTgwNWIwYzJjOTBlOTViZTk3OWNiYTBmZjk4N2VkMzE3NDYwNWI1ODFhM2U1ZWIxNWZhMzgwZjM4YTU0Ng'))
update public.shop_artikel a
   set bild_url = n.bild, bild_ist_extern = true
  from neu n
 where a.artikelnr = n.artikelnr and n.bild is not null and a.bild_url is null;

-- ─── Zuordnungen setzen ───────────────────────────────────────────────────
with zuordnung(gut_nr, rf_nr) as (values
  ('KHHM2532IVFGP', '1036285300000'),
  ('POVUS3525A', '7020900704803'),
  ('CUS3512', '1011960350012'),
  ('KHDVGW15D', '7076526110639'),
  ('POVT3515I', '7020900558932'),
  ('31302515', '1014054310000'),
  ('UCPA2015N', '1029201070504'),
  ('KV3390100L', '7089233910000'),
  ('POVUS2215A', '7020900641986'),
  ('RORS8003520', '1005520035020'),
  ('POVUS3525I', '7020900704766'),
  ('UPRPL16100', '1029201059576'),
  ('333132', '1014048400000'),
  ('POVR35', '7020900559496'),
  ('UCUEK2522N', '1029201070618'),
  ('HTDRJ15', '7084560100000'),
  ('KV336080L', '7089233608000'),
  ('PV25IO', '7075720300500'),
  ('POVRS3522', '7020900558550'),
  ('UCPA3225N', '1029201070509'),
  ('POVUS3532A', '7020900559052'),
  ('ESSM661', '7076110130000'),
  ('KV229040L', '7089322904000'),
  ('CUS22H', '1011960220000'),
  ('NIPS256', '1013006300000'),
  ('POVT3522', '7020900558765'),
  ('CUS281H', '1011960281000'),
  ('UCUEK1615N', '1029201070615'),
  ('BZTTHCU100', '7076801900000'),
  ('POVUS2220A', '7020900559038'),
  ('NIPS2515', '1013015300000'),
  ('POVUS3532I', '7020900642204'),
  ('ESVRG1312563', '7076111601000'),
  ('POVT2815I', '7020900558918'),
  ('WFREN1603', '2029415160300'),
  ('UCUEK2018N', '1029201070616'),
  ('MPRVUS32I', '7021573400000'),
  ('POVUS2225I', '7020900642167'),
  ('NIPS2510', '1013010300000'),
  ('3530326R', '1014036406000'),
  ('NIPS2512', '1013012300000'),
  ('POVUS2215I', '7020900642150'),
  ('POVUS2825I', '7020900559120'),
  ('MPRVUS25A', '7021572300000'),
  ('CUS15H', '1011960150000'),
  ('KKVV1K', '7087901109002'),
  ('SPPR50100', '1009503050100'),
  ('UCUEK2022N', '1029201070617'),
  ('RORS8002230', '1005520022030'),
  ('GEBOT20', '1012963200000'),
  ('32413215', '1014049410000'),
  ('32453225', '1014057430000'),
  ('UCPWS1615N', '1029201070639'),
  ('MPRVUS25I', '7021573300000'),
  ('3530158R', '1014036108000'),
  ('POVUS2225A', '7020900704797'),
  ('UCPT32N', '1029201070563'),
  ('OTSSV32', '1016376400000'),
  ('UCPT2520IN', '1029201070599'),
  ('POVUS2220I', '7020900559113'),
  ('MPRVUS40I', '7021573500000'),
  ('RORS8001830', '1005520018030'),
  ('BPT1815I', '1027100206908'),
  ('SPPB5088', '1009505050088'),
  ('241S3215', '7075461410000'),
  ('WFBD16090', '2029301169000'),
  ('UCPW2520N', '1029201070535'),
  ('CASSV156', '7079056106000'),
  ('UCPTR252020N', '1029201070576'),
  ('PVB15IO', '7075741100300'),
  ('309220', '1014053200000'),
  ('BZT100160', '7076802084094'),
  ('UCPTR202016N', '1029201070569'),
  ('OTSSV20', '1016376200000'),
  ('SPPR50200', '1009503050200'),
  ('HVAA2020', '7084055343401'),
  ('CCWFRS160', '2024900000160'),
  ('HVR1525DC', '1016358447182'),
  ('WFUDK160125', '2029304163000'),
  ('32414032', '1014049540000'),
  ('241S3225', '7075461430000'),
  ('SCHLSCH2032', '1016735200000'))
update public.shop_gut_positionen p
   set rf_artikelnummer = z.rf_nr,
       rf_ek_netto_stueck = a.preis_netto,
       rf_zuordnung_quelle = 'nummernsuche',
       rf_zuordnung_stand = now()
  from zuordnung z
  join public.shop_artikel a on a.artikelnr = z.rf_nr
 where p.artikelnummer = z.gut_nr
   -- Von Hand vergebene Zuordnungen bleiben unangetastet.
   and coalesce(p.rf_zuordnung_quelle, 'keine') in ('keine', 'vermutet');

select coalesce(rf_zuordnung_quelle, 'keine') as quelle,
       count(distinct artikelnummer) as artikel,
       round(sum(ek_netto_gesamt)::numeric, 0) as wert
  from public.shop_gut_positionen
 group by 1 order by wert desc;
