-- Fünf Klimarechner-Sammelartikel sind durch echte Artikel ersetzt (30.09.2026)
--
-- Das Klima-Aufmaß bietet unter „Weiteres Material" alles an, was
-- `nachkalkulation_klima` trägt (Sicht `aufmass_klima_katalog`). Darunter
-- standen zwölf Sammelartikel **ohne Artikelnummer** aus dem Klimarechner —
-- Mischpreise und Sets, keine Lagerware.
--
-- Fünf davon decken genau das ab, was die Klima-Strichliste seit 29.09.2026
-- mit **echten** Artikeln (CIN-/ALX-/ELK-Nummern) zählt:
--
--   Kältemittelleitung isoliert (Mischpreis 3 Dim.)  → 11 Zeilen CIN-22xx
--   Kondensatschlauch / -leitung                     → CIN-9930, ALX-22xx
--   Netzzuleitung NYM (zum Sicherungspunkt)          → ELK-3211 (XVB 3G2,5)
--   Steuer-/Verbindungsleitung Innen–Außen           → ELK-4111 (XVB 4G1,5)
--   Wandkonsole Außengerät                           → ALX-6064-306
--
-- Das ist eine Doppelzählung mit Ansage: der Monteur zählt 15 m als echten
-- Artikel und greift zusätzlich den Mischpreis-Sammelposten — die
-- Nachkalkulation addiert beides.
--
-- Warum das Kennzeichen und nicht die Sicht: `aufmass_klima_katalog` liefert
-- auch die Bezeichnungen für den Strichlisten-Join (`aufmass_strichliste`).
-- Ein zusätzlicher Filter dort (etwa auf `sichtbar_aufmass`, das bei **allen**
-- 37 Klima-Artikeln false ist) hätte die 25 Strichlisten-Positionen
-- namenlos gemacht.
--
-- Risikoprüfung vorher: die fünf stehen in 0 Nachkalkulationspositionen, 0
-- Strichlistenzeilen und sind kein PDS-Platzhalter (keine katalog_uuid).
-- Preise in `shop_nachkalkulation_positionen` sind ohnehin kopiert, nicht
-- verknüpft — abgeschlossene Nachkalkulationen verschieben sich nicht.
--
-- Die Artikel bleiben mit ihrem Preis im Stamm: das sind die Ansätze des
-- Klimarechners, und die liegen bewusst über dem EK (Reserve). Sie sollen
-- nachlesbar bleiben, nur nicht mehr zählbar sein.
--
-- Die anderen sieben bleiben unberührt — Kondensatpumpe, Wartungsschalter,
-- Boden- und Dachständer, Antivibrationsdämpfer, Kanal-Formteile und
-- Leitungskanal haben **kein** Gegenstück in der Strichliste. Ohne sie fehlte
-- das Material im Ist.

update public.shop_artikel
   set nachkalkulation_klima = false
 where nachkalkulation_klima
   and coalesce(artikelnr, '') = ''
   and name in (
     'Kältemittelleitung isoliert (Mischpreis 3 Dimensionen)',
     'Kondensatschlauch / -leitung',
     'Netzzuleitung NYM (zum Sicherungspunkt)',
     'Steuer-/Verbindungsleitung Innen–Außen',
     'Wandkonsole Außengerät'
   );

-- Kontrolle: 25 echte Artikel mit Nummer, dazu die 7 Sammelposten ohne
-- Gegenstück = 32 Zeilen im Klima-Katalog.
select coalesce(nullif(artikelnr, ''), '(ohne Nummer)') <> '(ohne Nummer)' as hat_nummer,
       count(*) as artikel
  from public.aufmass_klima_katalog
 group by 1 order by 1 desc;
