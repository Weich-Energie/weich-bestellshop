-- Zweiter Satz R+F-Rechnungen (fünf Stück, 44 Positionen, 43 Artikel).
--
-- Bringt unter anderem die echten Preise fuer Rohrschalen, Rotguss-Stopfen und
-- Rueckflussverhinderer — alles Artikel, die vorher ueber eine Textsuche
-- bepreist waren und in der Auffaelligkeitsliste standen.

insert into public.shop_rf_rechnungsposition
  (rechnungsnummer, position, rechnungsdatum, artikelnr, bezeichnung, menge, einheit, ek_stueck, wert)
values
  ('7092372415', 10, '2026-08-24', '1012100022000', 'PROFIPRESS Bogen 90 Grad I/I aus Kupfer 22 mm  Modell 2416', 30, 'ST', 3.53, 105.9),
  ('7092372415', 20, '2026-08-24', '1012100015000', 'PROFIPRESS Bogen 90 Grad I/I aus Kupfer 15 mm  Modell 2416', 30, 'ST', 2.17, 65.1),
  ('7092372415', 30, '2026-08-24', '1012100115000', 'PROFIPRESS Bogen 90 Grad I/A aus Kupfer 15 mm  Modell 2416.1', 30, 'ST', 2.05, 61.5),
  ('7092372415', 40, '2026-08-24', '1012100315000', 'PROFIPRESS Bogen 45 Grad I/I aus Kupfer 15 mm  Modell 2426', 20, 'ST', 2.55, 51),
  ('7092372415', 50, '2026-08-24', '1012100415000', 'PROFIPRESS Bogen 45 Grad I/A aus Kupfer 15 mm  Modell 2426.1', 20, 'ST', 1.94, 38.8),
  ('7092372415', 60, '2026-08-24', '1016023200000', 'IM0 DVGW-Freistromventil DIN 3502, messing DN 20 (Rp 3/4)  m. E., OT nichtsteigend', 20, 'ST', 12.5, 250),
  ('7092372415', 70, '2026-08-24', '7076160300000', 'ILZ Rückflussverhinderer, Messing DN 25 (R 1) IG, PN 16, o.E., DIN-DVGW', 20, 'ST', 17.59, 351.8),
  ('7092372415', 80, '2026-08-24', '7076160200000', 'ILZ Rückflussverhinderer, Messing DN 20 (R 3/4) IG, PN 16, o.E., DIN-DVGW', 20, 'ST', 13.91, 278.2),
  ('7092372415', 90, '2026-08-24', '1014049430000', 'IIB Reduzierstück aus RG/CuSi Nr.3241 R 11/4 x 1, mit A/I-Gewinde', 30, 'ST', 2.94, 88.2),
  ('7092372415', 100, '2026-08-24', '1014049310000', 'IIB Reduzierstück aus RG/CuSi Nr.3241 R 1 x 1/2, mit A/I-Gewinde', 30, 'ST', 2.28, 68.4),
  ('7092372415', 110, '2026-08-24', '1014049210000', 'IIB Reduzierstück aus RG/CuSi Nr.3241 R 3/4 x 1/2, mit A/I-Gewinde', 20, 'ST', 1.31, 26.2),
  ('7092372415', 120, '2026-08-24', '1014048300000', 'IIB Rohrverschraubung aus RG/CuSi Nr.3331 R 1, flachdichtend, mit I/A-Gewinde', 30, 'ST', 21.11, 633.3),
  ('7092372415', 130, '2026-08-24', '1014048100000', 'IIB Rohrverschraubung aus RG/CuSi Nr.3331 R 1/2, flachdichtend, mit I/A-Gewinde', 30, 'ST', 9.82, 294.6),
  ('7092372415', 140, '2026-08-24', '1014048200000', 'IIB Rohrverschraubung aus RG/CuSi Nr.3331 R 3/4, flachdichtend, mit I/A-Gewinde', 30, 'ST', 9.58, 287.4),
  ('7092372415', 150, '2026-08-24', '1014060200000', 'IIB Stopfen aus RG/CuSi Nr.3290 R 3/4, mit Aussengewinde', 20, 'ST', 1.89, 37.8),
  ('7092372415', 160, '2026-08-24', '1014060500000', 'IIB Stopfen aus RG/CuSi Nr.3290 R 1 1/2, mit Aussengewinde', 20, 'ST', 6.83, 136.6),
  ('7092372415', 170, '2026-08-24', '1029201070518', 'IE8 Uponor Übergangsmuffe S-Press PLUS 20-Rp1"FT', 20, 'ST', 10.56, 211.2),
  ('7092372415', 180, '2026-08-24', '1005520035030', 'IL2 Rockwool Heizungsrohrschale 800 für Rohr 35 mm, Dämmdicke 30 mm,VPE 16m', 64, 'M', 5.99, 383.36),
  ('7092372415', 190, '2026-08-24', '1005520035020', 'IL2 Rockwool Heizungsrohrschale 800 für Rohr 35 mm, Dämmdicke 20 mm,VPE 25m', 50, 'M', 4.33, 216.5),
  ('7092372415', 200, '2026-08-24', '1005520018020', 'IL2 Rockwool Heizungsrohrschale 800 für Rohr 18 mm, Dämmdicke 20 mm,VPE 42m', 42, 'M', 3.34, 140.28),
  ('7092372415', 210, '2026-08-24', '7085992350000', 'HYZ OptiSteel simplesta SH Systemrohr 1.4520, 35 x 1,50 mm Stange= 6 m', 120, 'M', 6.4, 768),
  ('7092372415', 220, '2026-08-24', '1029201059581', 'IE6 Uponor weiß Uni Pipe PLUS 25x2,5 50m', 50, 'M', 5.23, 261.5),
  ('7092372415', 230, '2026-08-24', '1007612300000', 'IG3 Optiline Rückspülfilter 2.0 mit Druckminderer DN 25 (1)', 10, 'ST', 129.6, 1296),
  ('7092372415', 240, '2026-08-24', '0000100052225', 'HKR Optiline Membrandruck-AD-Gefäss Heizung 35 Liter, Vordruck 1,5 bar, R 3/4, 2025', 10, 'ST', 28.5, 285),
  ('7092346436', 180, '2026-08-20', '7085429281000', 'HYJ OptiSteel simplesta SH V T-Stück IG d = 28 x Rp 1/2', 30, 'ST', 7.5, 225),
  ('7092291721', 170, '2026-08-13', '7085473353000', 'HYJ OptiSteel simplesta SH V Ü-Muffe IG IG, d = 35   x Rp   1', 18, 'ST', 7.9, 142.2),
  ('7092249303', 10, '2026-08-07', '7085420350000', 'HYJ OptiSteel simplesta SH V Bogen 45 I/A d = 35', 44, 'ST', 7.67, 337.48),
  ('7092249303', 20, '2026-08-07', '7085430350000', 'HYJ OptiSteel simplesta SH V T-Stück d = 35', 19, 'ST', 9.55, 181.45),
  ('7092200695', 10, '2026-07-31', '1007612300000', 'IG3 Optiline Rückspülfilter 2.0 mit Druckminderer DN 25 (1)', 5, 'ST', 129.6, 648),
  ('7092200695', 20, '2026-07-31', '7038517302000', 'HZL Optiline Pumpenkugelhahn m. Sperrventil, DN 25, 1 IG, Messing', 20, 'ST', 14.26, 285.2),
  ('7092200695', 30, '2026-07-31', '7071197989100', 'H2A GRUNDFOS Zirkulationspumpe COMFORT 15-14 B 1x230V Rp1/2 DACH', 8, 'ST', 100.99, 807.92),
  ('7092200695', 50, '2026-07-31', '1029201070616', 'IE8 Uponor Übergang auf Kupfer S-Press PLUS 20-18CU', 20, 'ST', 9.31, 186.2),
  ('7092200695', 60, '2026-07-31', '1029201070618', 'IE8 Uponor Übergang auf Kupfer S-Press PLUS 25-22CU', 19, 'ST', 11.45, 217.55),
  ('7092200695', 80, '2026-07-31', '1012110322000', 'PROFIPRESS Verschlusskappe aus Kupfer 22 mm  Modell 2456', 20, 'ST', 7.9, 158),
  ('7092200695', 90, '2026-07-31', '7076568100000', 'HH5 FL Luftstopfen C EXCLUSIV G1/2a MS vern. metall. Ausl., schwenkb.', 30, 'ST', 1.48, 44.4),
  ('7092200695', 100, '2026-07-31', '7023906256020', 'HPA Optiline Öko Plus 2.0 Heizungspumpe 25/1-6,Rp 1, BL 180mm, 230V, EEI 020', 10, 'ST', 109.72, 1097.2),
  ('7092200695', 110, '2026-07-31', '7078198100000', 'HI8 Optiline Kondensatpumpe Neu mit 6 m PVC- Schlauch, Förderhöhe 3,8 m', 2, 'ST', 99.49, 198.98),
  ('7092200695', 120, '2026-07-31', '1014049530000', 'IIB Reduzierstück aus RG/CuSi Nr.3241 R 11/2 x 1,  mit A/I-Gewinde', 20, 'ST', 6.55, 131),
  ('7092200695', 130, '2026-07-31', '1012303160000', 'IA3 Henkel Gewindedichtfaden Tangit Unilock 45x55x97 160 Meter', 20, 'ST', 11.5, 230),
  ('7092200695', 140, '2026-07-31', '1016361325000', 'IAO Optiline Hahnverlängerung a. RG/CuSi DN 25  (R 1), 25 mm', 20, 'ST', 5.82, 116.4),
  ('7092200695', 150, '2026-07-31', '1015900080800', 'IK9 Optiline Stockschraube verzinkt m. TORX-Kopf, M8 x 80 mm, Pack a 100 St.', 3, 'ST', 7.19, 21.57),
  ('7092200695', 180, '2026-07-31', '1015900081200', 'IK9 Optiline Stockschraube verzinkt m. TORX-Kopf, M8 x 120 mm, Pack a 100St.', 3, 'ST', 10.68, 32.04),
  ('7092200695', 190, '2026-07-31', '1015900081500', 'IK9 Optiline Stockschraube verzinkt m. TORX-Kopf, M8 x 150 mm, Pack a 100St.', 2, 'ST', 15.94, 31.88),
  ('7092200695', 200, '2026-07-31', '1015160313810', 'IK1 Walraven Gewindestift DIN 976-1 ev M8 x 100 mm', 50, 'ST', 0.28, 14)on conflict (rechnungsnummer, position) do update
  set ek_stueck = excluded.ek_stueck, menge = excluded.menge,
      bezeichnung = excluded.bezeichnung;

select count(*) as positionen, count(distinct artikelnr) as artikel,
       min(rechnungsdatum) as von, max(rechnungsdatum) as bis
  from public.shop_rf_rechnungsposition;
