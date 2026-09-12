-- Nachlese zur Bildkorrektur: die Faelle, die die Punkteregel nicht sicher
-- entscheiden konnte, von Hand durchgesehen (12.09.2026).
--
-- Zwei Einsichten aus der Durchsicht:
-- 1. „bestaetigt" hiess in der Reihenpruefung nur „das Beste auf dieser Seite",
--    nicht „richtig". Sieben Artikel trugen danach immer noch ein falsches Bild.
-- 2. Die Punkteregel ist auf Viega-Fittings zugeschnitten. Bei Zubehoer
--    (Rohrschellen, Dichtungen, Thermostatkoepfe) faellt sie ins Minus, obwohl
--    das Bild stimmt — dort entscheidet allein der Teiletyp im alt-Text.
--
-- Grundsatz: lieber gar kein Bild als das Bild eines anderen Teils. Auf der
-- Strichliste zaehlt der Monteur nach dem Bild.

-- ─── Bilder, die auf ihrer Seite ein passendes Gegenstueck haben ──────────
with neu(artikelnr, url) as (values
  ('1012103151000', 'https://prd-cc.rf24.de/medias/3e35f11b07f3c336de592a820fc6fa38.jpg?context=bWFzdGVyfGltYWdlc3w0MzE2fGltYWdlL2pwZWd8YURFekwyZzFaaTh4TlRVNU1UYzFNamMyTVRNM05DOHhNVFV5TURaZk1qQXlOakEzTURKZmRtbGlYMlJmY0hCdE1qSXhOekpwTVRFMU9UUTBkakF4WHpFeFh6SXdNQzVxY0djfDg4YzExMTljODFjMWQxODI4ZjQ1ZmVlYWE0MTNlNGIwM2JiZmE0Zjg3MDZjMDE2ODY5NDdhMWM2MzBiYzU2NjA'),
  ('1012103181000', 'https://prd-cc.rf24.de/medias/3e35f11b07f3c336de592a820fc6fa38.jpg?context=bWFzdGVyfGltYWdlc3w0MzE2fGltYWdlL2pwZWd8YURFekwyZzFaaTh4TlRVNU1UYzFNamMyTVRNM05DOHhNVFV5TURaZk1qQXlOakEzTURKZmRtbGlYMlJmY0hCdE1qSXhOekpwTVRFMU9UUTBkakF4WHpFeFh6SXdNQzVxY0djfDg4YzExMTljODFjMWQxODI4ZjQ1ZmVlYWE0MTNlNGIwM2JiZmE0Zjg3MDZjMDE2ODY5NDdhMWM2MzBiYzU2NjA'),
  ('1012103221000', 'https://prd-cc.rf24.de/medias/3e35f11b07f3c336de592a820fc6fa38.jpg?context=bWFzdGVyfGltYWdlc3w0MzE2fGltYWdlL2pwZWd8YURFekwyZzFaaTh4TlRVNU1UYzFNamMyTVRNM05DOHhNVFV5TURaZk1qQXlOakEzTURKZmRtbGlYMlJmY0hCdE1qSXhOekpwTVRFMU9UUTBkakF4WHpFeFh6SXdNQzVxY0djfDg4YzExMTljODFjMWQxODI4ZjQ1ZmVlYWE0MTNlNGIwM2JiZmE0Zjg3MDZjMDE2ODY5NDdhMWM2MzBiYzU2NjA'),
  ('1012104283000', 'https://prd-cc.rf24.de/medias/dd40d8c34a71a080d3cedf706efa3db8.jpg?context=bWFzdGVyfGltYWdlc3wxMjU1OXxpbWFnZS9qcGVnfGFHUXdMMmhoWlM4eE5UVTVNRFF3TXpVM01UYzBNaTgzTWpRd04xOTJhV0pmYlY4eU1qRXhYMlJmTVRGZk0xOHlNREF1YW5Cbnw4MTFkYjRmMDIwMWIwZWJjNDUwOTFlZDQ1ZDA0MGQwYmRkM2RiOThmZjA1ZTYyYzJmMGRhMmRlNWQ3YWJiNDk3'),
  ('7020900558642', 'https://prd-cc.rf24.de/medias/069b1626b9d13ddba9f3af708b505e8b.jpg?context=bWFzdGVyfGltYWdlc3w4MzY2fGltYWdlL2pwZWd8YUdRNUwyaGpPQzh4TlRVNU1EQTRNemcxTkRNMk5pODNNalF3TjE5MmFXSmZiVjh4TVRFM01sOWtYekV4WHpWZk1qQXdMbXB3Wnd8YTEyYWQ3OTgwMzMxYjhjODYyMzYyYmQwMjEyZDMzYTIzNjZiMDE2MjY1OGQ2YTBlZjdkMDliYjk1Mzc1YmFhZA'))
update public.shop_artikel a
   set bild_url = n.url, bild_ist_extern = true
  from neu n
 where a.artikelnr = n.artikelnr;

-- ─── Bilder ohne passendes Gegenstueck: entfernen ─────────────────────────
-- Auf diesen Produktseiten liegt kein Bild des richtigen Teils. Was hing:
--   1012102015000  T-Stueck 15 mm      -> Sanpress-Uebergangsstueck
--   1012102018000  T-Stueck 18 mm      -> Profipress-Bogen
--   1012102022000  T-Stueck 22 mm      -> Profipress-Muffe
--   1012102028000  T-Stueck 28 mm      -> Profipress-Bogen
--   1012102286000  T-Stueck 28x22x28   -> Sanpress-Uebergangsstueck
--   1012106035000  Muffe 35 mm         -> Profipress-Bogen
--   1012103281000  Sanpress-T-Stueck 28 mm -> nur ein Profipress-T-Stueck (Kupfer statt Bronze)
update public.shop_artikel
   set bild_url = null, bild_ist_extern = false
 where artikelnr in ('1012102015000', '1012102018000', '1012102022000',
                     '1012102028000', '1012102286000', '1012106035000',
                     '1012103281000');

select count(*) filter (where bild_url is not null) as mit_bild,
       count(*) as gesamt
  from public.shop_artikel where sichtbar_aufmass;
