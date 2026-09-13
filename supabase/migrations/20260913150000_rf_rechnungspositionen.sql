-- Rechnungspositionen von R+F als Preisquelle.
--
-- Patrick hat am 13.09.2026 neun R+F-Rechnungen exportiert, statt die offenen
-- Zuordnungen von Hand nachzutragen. Das ist die bessere Quelle: eine Rechnung
-- nennt Artikelnummer, Menge und den **tatsaechlich bezahlten** Einkaufspreis.
-- Der Lagerauszug traegt dagegen Standardpreise, der Shop Listenpreise.
--
-- Eingelesen mit tools/rf-rechnungen-lesen.py.
--
-- Beobachtung aus dem ersten Satz: die Rechnungspreise liegen durchweg etwas
-- unter den Preisen des Lagerauszugs (Bogen 90 I/A 35 mm: 8,31 gegen 7,70).
-- Fuer die Mischsaetze zaehlt der Rechnungspreis.

create table if not exists public.shop_rf_rechnungsposition (
  rechnungsnummer text not null,
  position        integer not null,
  rechnungsdatum  date not null,
  artikelnr       text not null,
  bezeichnung     text,
  menge           numeric(12,3) not null,
  einheit         text,
  ek_stueck       numeric(10,4) not null,
  wert            numeric(12,2),
  erfasst_am      timestamptz not null default now(),
  primary key (rechnungsnummer, position)
);

comment on table public.shop_rf_rechnungsposition is
  'Positionen aus R+F-Rechnungen. Bester verfuegbarer Einkaufspreis: '
  'tatsaechlich bezahlt, nicht Liste und nicht Standard. Eingelesen mit '
  'tools/rf-rechnungen-lesen.py.';

create index if not exists shop_rf_rechnungsposition_artikel_idx
  on public.shop_rf_rechnungsposition (artikelnr, rechnungsdatum desc);

alter table public.shop_rf_rechnungsposition enable row level security;

drop policy if exists rf_rechnung_lesen on public.shop_rf_rechnungsposition;
create policy rf_rechnung_lesen on public.shop_rf_rechnungsposition
  for select to authenticated using (public.has_shop_access());

drop policy if exists rf_rechnung_pflegen on public.shop_rf_rechnungsposition;
create policy rf_rechnung_pflegen on public.shop_rf_rechnungsposition
  for all to authenticated using (public.is_shop_admin()) with check (public.is_shop_admin());

insert into public.shop_rf_rechnungsposition
  (rechnungsnummer, position, rechnungsdatum, artikelnr, bezeichnung, menge, einheit, ek_stueck, wert)
values
  ('7092478296', 10, '2026-09-03', '1012100018000', 'PROFIPRESS Bogen 90 Grad I/I aus Kupfer 18 mm  Modell 2416', 30, 'ST', 2.74, 82.2),
  ('7092478296', 20, '2026-09-03', '1012106015000', 'PROFIPRESS Muffe aus Kupfer 15 mm  Modell 2415', 30, 'ST', 2.02, 60.6),
  ('7092478296', 30, '2026-09-03', '1012100122000', 'PROFIPRESS Bogen 90 Grad I/A aus Kupfer 22 mm  Modell 2416.1', 30, 'ST', 3.5, 105),
  ('7092478296', 40, '2026-09-03', '1016735100000', 'IAF Schlauchschelle W2 aus Chromstahl 1.4016 Spannbereich 16 - 25 mm', 50, 'ST', 0.35, 17.5),
  ('7092478296', 50, '2026-09-03', '1036285300000', 'ILW WESA-Kugelhahn aus Pressmessing, PN 32, vernickelt, IG/Ü-Mutter 1x11/4', 19, 'ST', 13, 247),
  ('7092478296', 60, '2026-09-03', '1012102022000', 'PROFIPRESS T-Stück aus Kupfer 22 mm  Modell 2418', 20, 'ST', 5.47, 109.4),
  ('7092478296', 80, '2026-09-03', '1012110318000', 'PROFIPRESS Verschlusskappe aus Kupfer 18 mm  Modell 2456', 20, 'ST', 5.15, 103),
  ('7092478296', 90, '2026-09-03', '1012103281000', 'Viega T-Stück mit SC Sanpress 2217.2 in 28mm x Rp1/2 IGx 28mm Siliziumbronze', 20, 'ST', 16.42, 328.4),
  ('7092478296', 100, '2026-09-03', '1012104283000', 'PROFIPRESS/SANPRESS Übergangsst.a.Rotg. 28 mm x 1 AG,   m. Mehrkant, Modell 2211', 20, 'ST', 7.41, 148.2),
  ('7092478296', 110, '2026-09-03', '1012105182000', 'Viega Übergangsstück mit SC Sanpress 2212 in 18mm x Rp3/4 IG Siliziumbronze', 20, 'ST', 6.99, 139.8),
  ('7092478296', 120, '2026-09-03', '1012104222000', 'PROFIPRESS/SANPRESS Übergangsst.a.Rotg. 22 mm x 3/4 AG, m. Mehrkant, Modell 2211', 30, 'ST', 4.12, 123.6),
  ('7092478296', 130, '2026-09-03', '1012104223000', 'PROFIPRESS/SANPRESS Übergangsst.a.Rotg. 22 mm x 1 AG,   m. Mehrkant, Modell 2211', 50, 'ST', 5.54, 277),
  ('7092478296', 150, '2026-09-03', '1029201070516', 'IE8 Uponor Übergangsmuffe S-Press PLUS 20-Rp1/2"FT', 30, 'ST', 7.89, 236.7),
  ('7092478296', 160, '2026-09-03', '1029201070524', 'IE8 Uponor Winkel S-Press PLUS 20-20', 50, 'ST', 7.62, 381),
  ('7092478296', 170, '2026-09-03', '1014036106000', 'IIB Doppelnippel aus RG/CuSi blank DN 15 (R 1/2) x 60 mm, Modell 3530', 20, 'ST', 2.53, 50.6),
  ('7092478296', 180, '2026-09-03', '7075435300000', 'II0 Verschraubung Nr. 331 I/A-Gew., schwarz DN 25 (R 1), flachdichtend, oh. Dicht.', 50, 'ST', 4.47, 223.5),
  ('7092478296', 190, '2026-09-03', '1029201070577', 'IE8 Uponor T-Stück reduziert S-Press PLUS 25-20-25', 30, 'ST', 13.56, 406.8),
  ('7092478296', 230, '2026-09-03', '1011960150000', 'IG5 SANCO-Kupferrohr blank nach EN 1057 halbhart, 15 x 1 mm, (in 5-m Stück)', 20, 'M', 6.42, 128.4),
  ('7092478298', 70, '2026-09-03', '1014053040000', 'IIB Winkel aus RG/CuSi Nr.3092 R 1/4, mit I/A-Gewinde', 20, 'ST', 2.14, 42.8),
  ('7092478298', 140, '2026-09-03', '1012105221000', 'Viega Übergangsstück mit SC Sanpress 2212 in 22mm x Rp1/2 IG Rotguss', 30, 'ST', 4.16, 124.8),
  ('7092478298', 200, '2026-09-03', '7085402350000', 'HYJ OptiSteel simplesta SH V Bogen 90 I/I d = 35', 60, 'ST', 8.25, 495),
  ('7092478298', 210, '2026-09-03', '7085472353000', 'HYJ OptiSteel simplesta SH V Übergangsstück AG, d = 35   x R 1', 50, 'ST', 8.46, 423),
  ('7092478298', 220, '2026-09-03', '7085430280000', 'HYJ OptiSteel simplesta SH V T-Stück d = 28', 30, 'ST', 6.39, 191.7),
  ('7092505436', 10, '2026-09-08', '1029201059574', 'IE6 Uponor weiß Uni Pipe PLUS S 25x2,5 5m', 50, 'M', 5.28, 264),
  ('7092505436', 20, '2026-09-08', '7078198100000', 'HI8 Optiline Kondensatpumpe Neu mit 6 m PVC- Schlauch, Förderhöhe 3,8 m', 2, 'ST', 100.7, 201.4),
  ('7092505436', 40, '2026-09-08', '7039104301000', 'HZX Optiline Pumpengruppe  DN25 o.Pumpe mit 3-W-Mischer/Stellm, m.PKH, m.Isol.', 2, 'ST', 218.35, 436.7),
  ('7092505436', 50, '2026-09-08', '1005010035036', 'ILF Optiline Kautschuk HT+ Schlauch,100% Rohr:35/33,7mm,DSD:38mm, L:2m, VPE 16m', 16, 'M', 7.05, 112.8),
  ('7092505436', 60, '2026-09-08', '1029201059573', 'IE6 Uponor weiß Uni Pipe PLUS S 20x2,25 5m', 50, 'M', 3.61, 180.5),
  ('7092505438', 30, '2026-09-08', '7085431352000', 'HYJ OptiSteel simplesta SH V T-Stück red. d = 35-22', 20, 'ST', 9.58, 191.6),
  ('7092505438', 50, '2026-09-08', '7085402280000', 'HYJ OptiSteel simplesta SH V Bogen 90 I/I d = 28', 30, 'ST', 4.08, 122.4),
  ('7092505438', 60, '2026-09-08', '7085431281000', 'HYJ OptiSteel simplesta SH V T-Stück red. d = 28-22', 20, 'ST', 6.41, 128.2),
  ('7092505438', 80, '2026-09-08', '7085473221000', 'HYJ OptiSteel simplesta SH V Ü-Muffe IG IG, d = 22 x Rp 1/2', 35, 'ST', 5.88, 205.8),
  ('7092505438', 90, '2026-09-08', '1005520028020', 'IL2 Rockwool Heizungsrohrschale 800 für Rohr 28 mm, Dämmdicke 20 mm,VPE 30m', 48, 'M', 3.71, 178.08),
  ('7092505438', 100, '2026-09-08', '1005520028030', 'IL2 Rockwool Heizungsrohrschale 800 für Rohr 28 mm, Dämmdicke 30 mm,VPE 20m', 30, 'M', 5.69, 170.7),
  ('7092505438', 110, '2026-09-08', '1029201070525', 'IE8 Uponor Winkel S-Press PLUS 25-25', 30, 'ST', 11.09, 332.7),
  ('7092505443', 10, '2026-09-08', '7085402350000', 'HYJ OptiSteel simplesta SH V Bogen 90 I/I d = 35', 50, 'ST', 7.7, 385),
  ('7092505444', 80, '2026-09-08', '7085473221000', 'HYJ OptiSteel simplesta SH V Ü-Muffe IG IG, d = 22 x Rp 1/2', 15, 'ST', 5.88, 88.2),
  ('7092505447', 20, '2026-09-08', '7085407350000', 'HYJ OptiSteel simplesta SH V Bogen 90 I/A d = 35', 50, 'ST', 7.7, 385),
  ('7092505447', 40, '2026-09-08', '7085472353000', 'HYJ OptiSteel simplesta SH V Übergangsstück AG, d = 35   x R 1', 100, 'ST', 7.9, 790),
  ('7092541038', 30, '2026-09-11', '7085420350000', 'HYJ OptiSteel simplesta SH V Bogen 45 I/A d = 35', 30, 'ST', 7.67, 230.1),
  ('7092541039', 50, '2026-09-11', '7085441351000', 'HYJ OptiSteel simplesta SH V Reduzierstück d = 35 x 28', 18, 'ST', 4.12, 74.16)on conflict (rechnungsnummer, position) do update
  set ek_stueck = excluded.ek_stueck,
      menge = excluded.menge,
      bezeichnung = excluded.bezeichnung;

-- Jüngster Rechnungspreis je Artikel.
create or replace view public.shop_rf_rechnungspreis
with (security_invoker = true) as
  select distinct on (artikelnr)
         artikelnr, ek_stueck, einheit, rechnungsdatum, rechnungsnummer,
         bezeichnung
    from public.shop_rf_rechnungsposition
   order by artikelnr, rechnungsdatum desc, rechnungsnummer desc;

comment on view public.shop_rf_rechnungspreis is
  'Der zuletzt bezahlte Preis je R+F-Artikel. Vorrang vor Lager- und '
  'Listenpreis, wo vorhanden.';

grant select on public.shop_rf_rechnungspreis to authenticated;

select count(*) as positionen,
       count(distinct artikelnr) as artikel,
       min(rechnungsdatum) as von, max(rechnungsdatum) as bis
  from public.shop_rf_rechnungsposition;
