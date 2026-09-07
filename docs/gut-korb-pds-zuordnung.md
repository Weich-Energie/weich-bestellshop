# GUT-Körbe → PDS-Aufträge: Zuordnung und Abrechnungsstatus

Stand 08.09.2026, erzeugt mit `tools/vps/korb-pds-abgleich.mjs` (rein lesend,
lokaler MCP-Weg auf dem VPS). Grundlage für den Baustellen-Vergleich in
[aufmass-formteil-modell.md](aufmass-formteil-modell.md).

## Regel

Ein Korb gilt nur dann als zugeordnet, wenn der bereinigte Korbname (ohne
„NK", „Nachkalk", „Aufmaß", Initialen, Zahlen) in PDS **genau eine
Projektakte mit mindestens einem SHK-Auftrag** trifft. Mehrdeutige Namen
bleiben offen — raten ist laut Ziel nicht erlaubt.

„Abgeschlossen" heißt: zur Projektakte des Auftrags existiert eine Rechnung,
die keine Abschlagsrechnung ist und den Status „Abgerechnet" trägt. Der
Auftragsstatus selbst bleibt in PDS auch nach Zahlung „Offen" und taugt nicht
als Kriterium. Die Rechnungssuche findet nichts über die Auftragsnummer, nur
über den Kundennamen; der Abgleich läuft dann über `projektakteUUID`.

## Ergebnis

| Status | Körbe |
|---|---|
| abgerechnet (Schlussrechnung „Abgerechnet") | 58 |
| ohne_rechnung (Auftrag eindeutig, noch keine Rechnung) | 13 |
| nur_abschlaege (bisher nur Abschlagsrechnungen) | 3 |
| mehrdeutig_shk (2 Projektakten mit SHK-Auftrag) | 8 |
| mehrdeutig_zu_viele (>15 Projektakten zum Namen) | 10 |
| kein_shk_auftrag (Projektakte da, kein SHK-Auftrag) | 8 |
| keine_projektakte | 4 |
| kein_suchwort (TEST, 263987736) | 2 |

## Zugeordnete Körbe (74)

| Korb | SHK-Auftrag | Status | Rechnungen |
|---|---|---|---|
| Aufmaß Nerb Teil 2 | 2025-10044 | nur_abschlaege | 202530418 (Abschlagsrechnung, Abgerechnet) |
| Blank NK | 2025-10178 | abgerechnet | 202530580 (Rechnung, Abgerechnet, bezahlt) |
| Frey NK | 2025-10078 | abgerechnet | 202530533 (Rechnung, Abgerechnet) |
| Glaser NK | 2025-10374, 2025-10106 | abgerechnet | 202530522 (Rechnung, Abgerechnet, bezahlt); 202530581 (Rechnung, Abgerechnet, bezahlt); 202630120 (Rechnung, Abgerechnet, bezahlt) |
| HV Schiegerl | 2025-10159 | abgerechnet | 202530590 (Rechnung, Abgerechnet, bezahlt) |
| Lichtenauer | 2025-10408 | abgerechnet | 202530591 (Rechnung, Abgerechnet, bezahlt) |
| M Treutel NK | 2025-10228 | abgerechnet | 202630301 (Rechnung, Abgerechnet, bezahlt) |
| Nachk. Albrecht | 2025-10025 | abgerechnet | 202530483 (Rechnung, Abgerechnet) |
| Nachkalk Aures | 2025-10150 | abgerechnet | 202530510 (Rechnung, Abgerechnet) |
| Nachkalk Bandl | 2025-10030 | abgerechnet | 202530532 (Rechnung, Abgerechnet); 202630278 (Rechnung, Storno); 202630279 (Schlussrechnung, Storno) |
| Nachkalk Danzl | 2025-10017 | abgerechnet | 202530529 (Rechnung, Storno, Storno); 202530543 (Rechnung, Abgerechnet, bezahlt) |
| Nachkalk Koller | 2025-10048 | abgerechnet | 202530571 (Rechnung, Abgerechnet, bezahlt) |
| Nachkalk Kroher | 2025-10014 | abgerechnet | 202530414 (Rechnung, Abgerechnet) |
| Nachkalk Mandelkow | 2025-10152 | abgerechnet | 202530490 (Rechnung, Abgerechnet) |
| Nachkalk Mäschl | 2025-10023 | abgerechnet | 202530503 (Rechnung, Storno, Storno); 202530505 (Rechnung, Abgerechnet) |
| Nachkalk Maurer | 2025-10031 | abgerechnet | 202530517 (Rechnung, Abgerechnet) |
| Nachkalk Raith | 2025-10021 | abgerechnet | 202530516 (Rechnung, Abgerechnet, bezahlt) |
| Nachkalk Traßl | 2025-10095 | abgerechnet | 202530574 (Rechnung, Abgerechnet, bezahlt) |
| Neidl NK | 2025-10096 | ohne_rechnung |  |
| NK Andreas Tockhorn | 2026-70 | ohne_rechnung |  |
| NK Backes Auto | 2025-10131 | abgerechnet | 202630227 (Rechnung, Abgerechnet, bezahlt) |
| NK Bauer Karl | 2025-10339 | abgerechnet | 202630197 (Rechnung, Abgerechnet, bezahlt) |
| NK Biesinger | 2025-10224 | abgerechnet | 202530594 (Rechnung, Abgerechnet, bezahlt) |
| NK Brand Sonja | 2025-10076 | abgerechnet | 202630199 (Rechnung, Abgerechnet, bezahlt) |
| NK Bühler neu | 2025-10350 | abgerechnet | 202630368 (Rechnung, Abgerechnet, bezahlt) |
| NK Eichenseer | 2025-10362 | abgerechnet | 202630373 (Rechnung, Abgerechnet, bezahlt) |
| NK Engelmann | 2025-10024 | abgerechnet | 202530535 (Rechnung, Abgerechnet) |
| NK Göbl | 2025-10345 | abgerechnet | 202630088 (Rechnung, Abgerechnet, bezahlt) |
| NK Görlich | 2025-10180 | abgerechnet | 202530572 (Rechnung, Abgerechnet, bezahlt) |
| NK Haberstumpf | 2025-10133 | ohne_rechnung |  |
| NK Haller | 2025-10177 | abgerechnet | 202630232 (Rechnung, Abgerechnet, bezahlt) |
| NK Hammerl | 2025-10066 | abgerechnet | 202530563 (Rechnung, Abgerechnet, bezahlt) |
| NK Herbert Reiß | 2025-10343 | abgerechnet | 202630378 (Rechnung, Abgerechnet, bezahlt) |
| NK Hoffmann | 2025-10043 | abgerechnet | 202630327 (Rechnung, Abgerechnet, bezahlt) |
| NK Jochen | 2025-10373 | ohne_rechnung |  |
| NK Johann Bayer | 2025-10344 | abgerechnet | 202630374 (Rechnung, Abgerechnet, bezahlt) |
| NK Joseph | 2026-54 | ohne_rechnung |  |
| NK Joseph auto | 2026-54 | ohne_rechnung |  |
| NK Klinger | 2026-4 | abgerechnet | 202630328 (Rechnung, Abgerechnet, bezahlt) |
| NK Klügl | 2025-10348 | abgerechnet | 202630115 (Rechnung, Abgerechnet, bezahlt) |
| NK Kühlbrandt | 2025-10229 | ohne_rechnung |  |
| NK Kührlings | 2026-71 | abgerechnet | 202630228 (Rechnung, Storno); 202630229 (Rechnung, Abgerechnet, bezahlt) |
| NK M. Reuß | 2025-10274 | ohne_rechnung |  |
| NK März | 2025-10069 | abgerechnet | 202530577 (Rechnung, Abgerechnet, bezahlt); 202630280 (Rechnung, Storno, bezahlt); 202630281 (Schlussrechnung, Storno, bezahlt) |
| NK Melanie Koch | 2026-1 | abgerechnet | 202630343 (Rechnung, Abgerechnet, bezahlt -630,-) |
| NK Moninder | 2025-10346 | abgerechnet | 202630162 (Rechnung, Abgerechnet, bezahlt) |
| NK Moosburger | 2025-10068 | ohne_rechnung |  |
| NK Mühleisen | 2025-10221 | abgerechnet | 202630152 (Rechnung, Abgerechnet, bezahlt) |
| NK Nagler Birgit | 2025-10252 | nur_abschlaege | null (Rechnung, Offen) |
| NK Nerb | 2025-10044 | nur_abschlaege | 202530418 (Abschlagsrechnung, Abgerechnet) |
| NK Pawlik | 2025-10182 | ohne_rechnung |  |
| NK Rattke | 2025-10181 | abgerechnet | 202530555 (Rechnung, Abgerechnet, bezahlt) |
| NK Richter | 2025-10212 | abgerechnet | 202630179 (Rechnung, Storno); 202630196 (Rechnung, Abgerechnet, bezahlt) |
| NK Richthammer | 2025-10272 | ohne_rechnung |  |
| NK Scheibel | 2025-10403, 2025-10015 | abgerechnet | 202530506 (Rechnung, Abgerechnet); 202530587 (Rechnung, Abgerechnet, bezahlt) |
| NK Schimmel | 2025-10260 | abgerechnet | 202630379 (Rechnung, Abgerechnet, bezahlt) |
| NK Schluttenhofer | 2025-10363 | abgerechnet | 202630294 (Rechnung, Abgerechnet, bezahlt) |
| NK Schmid Sing | 2025-10368 | abgerechnet | 202630040 (Rechnung, Abgerechnet, bezahlt); 202630377 (Rechnung, Abgerechnet, bezahlt) |
| NK Schorner | 2025-10070 | abgerechnet | 202530561 (Rechnung, Abgerechnet, bezahlt) |
| NK Schwendner | 2025-10056 | abgerechnet | 202530496 (Rechnung, Abgerechnet) |
| NK Seebauer | 2025-10115 | abgerechnet | 202630226 (Rechnung, Abgerechnet, bezahlt) |
| NK Seebauer 1 | 2025-10115 | abgerechnet | 202630226 (Rechnung, Abgerechnet, bezahlt) |
| NK Seliger neu | 2025-10366 | abgerechnet | 202630049 (Rechnung, Abgerechnet, Patrick offen bis fertig); 202630180 (Rechnung, Abgerechnet, bezahlt) |
| NK Vergnon | 2025-10369 | abgerechnet | 202630230 (Rechnung, Abgerechnet, bezahlt) |
| NK Vogt | 2025-10386 | abgerechnet | 202630375 (Rechnung, Abgerechnet, bezahlt) |
| NK Weber | 2024-10271 | abgerechnet | 202430582 (Abschlagsrechnung, Abgerechnet); 202430583 (Abschlagsrechnung, Abgerechnet); 202430634 (Rechnung, Abgerechnet); 202430635 (Schlussrechnung, Abgerechnet); 202430636 (Schlussrechnung, Abgerechnet) |
| NK Wesnitzer | 2025-10222 | abgerechnet | 202630233 (Rechnung, Abgerechnet, bezahlt) |
| NK Wiesgickl | 2026-34 | abgerechnet | 202630198 (Rechnung, Abgerechnet, bezahlt) |
| NK Zahn Leonie | 2025-10183 | ohne_rechnung |  |
| NK Zahn Petra M | 2025-10264 | ohne_rechnung |  |
| NK Ziebel | 2025-10176 | abgerechnet | 202630161 (Rechnung, Abgerechnet, bezahlt) |
| Pretzlaf NK | 2025-10149 | abgerechnet | 202530507 (Rechnung, Abgerechnet) |
| Weich Matthias | 2025-10065 | abgerechnet | 202530542 (Rechnung, Abgerechnet, bezahlt) |
| Zitzmann NK | 2025-10238, 2025-10208 | abgerechnet | 202530569 (Rechnung, Abgerechnet, bezahlt); 202530570 (Rechnung, Abgerechnet, bezahlt) |

## Ohne Zuordnung (32) — nur mit Auftragsnummer von Patrick lösbar

- 263987736: kein_suchwort
- Aufmaß Weich Ru: kein_shk_auftrag (Suchwort „Weich Ru", 6 Projektakten, 0 mit SHK-Auftrag)
- Aufmaß Winkler: mehrdeutig_shk (Suchwort „Winkler", 9 Projektakten, 2 mit SHK-Auftrag)
- Autohaus Stiebitz: kein_shk_auftrag (Suchwort „Autohaus Stiebitz", 1 Projektakten, 0 mit SHK-Auftrag)
- Epp Neu NK: kein_shk_auftrag (Suchwort „Epp", 3 Projektakten, 0 mit SHK-Auftrag)
- Frank A. NK: mehrdeutig_zu_viele (Suchwort „Frank", 19 Projektakten)
- Heubeck Sabine Mühlhausen: kein_shk_auftrag (Suchwort „Heubeck Sabine Mühlhausen", 1 Projektakten, 0 mit SHK-Auftrag)
- Maier Nachkalk: mehrdeutig_shk (Suchwort „Maier", 6 Projektakten, 2 mit SHK-Auftrag)
- Nachkalk Jezierowski: keine_projektakte (Suchwort „Jezierowski", 0 Projektakten)
- Nachkalk Paul: mehrdeutig_zu_viele (Suchwort „Paul", 20 Projektakten)
- Nachkalk Stanke: mehrdeutig_shk (Suchwort „Stanke", 5 Projektakten, 2 mit SHK-Auftrag)
- Nachkalk Traßl2: keine_projektakte (Suchwort „Traßl2", 0 Projektakten)
- NK Bauer Peschk: mehrdeutig_zu_viele (Suchwort „Bauer", 23 Projektakten)
- NK Epp A.: kein_shk_auftrag (Suchwort „Epp", 3 Projektakten, 0 mit SHK-Auftrag)
- NK Fuchs No.: mehrdeutig_zu_viele (Suchwort „Fuchs", 21 Projektakten)
- NK Gadomski: mehrdeutig_shk (Suchwort „Gadomski", 4 Projektakten, 2 mit SHK-Auftrag)
- NK Kodalle: mehrdeutig_shk (Suchwort „Kodalle", 7 Projektakten, 2 mit SHK-Auftrag)
- NK Kohl Auto: mehrdeutig_zu_viele (Suchwort „Kohl", 23 Projektakten)
- NK PeterJM: keine_projektakte (Suchwort „PeterJM", 0 Projektakten)
- NK Roidl: kein_shk_auftrag (Suchwort „Roidl", 2 Projektakten, 0 mit SHK-Auftrag)
- NK Schäfer B.: kein_shk_auftrag (Suchwort „Schäfer", 4 Projektakten, 0 mit SHK-Auftrag)
- NK Schmidt: mehrdeutig_zu_viele (Suchwort „Schmidt", 29 Projektakten)
- NK Weich W: mehrdeutig_zu_viele (Suchwort „Weich", 71 Projektakten)
- NK Weiß: mehrdeutig_zu_viele (Suchwort „Weiß", 23 Projektakten)
- NK West P.: mehrdeutig_shk (Suchwort „West", 4 Projektakten, 2 mit SHK-Auftrag)
- NK Winkler K.: mehrdeutig_shk (Suchwort „Winkler", 9 Projektakten, 2 mit SHK-Auftrag)
- NKGrillenberger: keine_projektakte (Suchwort „NKGrillenberger", 0 Projektakten)
- Paulus: mehrdeutig_shk (Suchwort „Paulus", 6 Projektakten, 2 mit SHK-Auftrag)
- Popp NK: mehrdeutig_zu_viele (Suchwort „Popp", 68 Projektakten)
- Schminke: kein_shk_auftrag (Suchwort „Schminke", 2 Projektakten, 0 mit SHK-Auftrag)
- Schultzt Hirschau: mehrdeutig_zu_viele (Suchwort „Hirschau", 113 Projektakten)
- TEST: kein_suchwort

## Vergleich alt/neu auf den 58 abgerechneten Körben

| Korb | PDS-Auftrag | Formteil-Pos. mit Preis | Alt (GUT) | Neu (Formteil-Mittel) | Abweichung |
|---|---|---|---|---|---|
| Nachkalk Bandl | 2025-10030 | 22/42 | 1.548,95 € | 1.870,68 € | 20,8 % |
| NK Görlich | 2025-10180 | 27/46 | 1.382,31 € | 1.793,72 € | 29,8 % |
| NK Klügl | 2025-10348 | 31/53 | 1.348,97 € | 1.828,30 € | 35,5 % |
| Nachkalk Mäschl | 2025-10023 | 22/38 | 1.292,79 € | 1.571,35 € | 21,5 % |
| Nachkalk Danzl | 2025-10017 | 18/32 | 1.256,50 € | 1.435,47 € | 14,2 % |
| **Summe fünf** | | **120/211** | **6.829,52 €** | **8.499,52 €** | **24,5 %** |

Alle 58 abgerechneten Körbe zusammen: 1097/2001 Formteil-Positionen vergleichbar (55 %), alt 44.969,39 € → neu 54.770,66 € (21,8 %). Median der Abweichung je Korb 20,8 %, 45 von 58 Körben werden teurer, 13 günstiger.

Alle 58 im Einzelnen (sortiert nach vergleichbarem Altwert):

| Korb | PDS-Auftrag | Pos. mit Preis | Alt | Neu | Abweichung |
|---|---|---|---|---|---|
| Nachkalk Bandl | 2025-10030 | 22/42 | 1.548,95 € | 1.870,68 € | 20,8 % |
| NK Görlich | 2025-10180 | 27/46 | 1.382,31 € | 1.793,72 € | 29,8 % |
| NK Klügl | 2025-10348 | 31/53 | 1.348,97 € | 1.828,30 € | 35,5 % |
| Nachkalk Mäschl | 2025-10023 | 22/38 | 1.292,79 € | 1.571,35 € | 21,5 % |
| Nachkalk Danzl | 2025-10017 | 18/32 | 1.256,50 € | 1.435,47 € | 14,2 % |
| Nachkalk Aures | 2025-10150 | 19/34 | 1.252,15 € | 1.488,40 € | 18,9 % |
| Nachkalk Kroher | 2025-10014 | 24/40 | 1.242,21 € | 1.730,66 € | 39,3 % |
| Nachkalk Maurer | 2025-10031 | 30/48 | 1.192,54 € | 1.534,98 € | 28,7 % |
| NK Schorner | 2025-10070 | 26/41 | 1.180,06 € | 1.557,85 € | 32,0 % |
| Nachkalk Mandelkow | 2025-10152 | 22/36 | 1.162,32 € | 1.420,05 € | 22,2 % |
| NK Rattke | 2025-10181 | 23/44 | 1.112,59 € | 1.441,72 € | 29,6 % |
| Pretzlaf NK | 2025-10149 | 20/41 | 1.103,77 € | 1.329,37 € | 20,4 % |
| Frey NK | 2025-10078 | 19/29 | 1.101,98 € | 1.350,71 € | 22,6 % |
| NK Schluttenhofer | 2025-10363 | 19/35 | 1.093,92 € | 1.307,61 € | 19,5 % |
| M Treutel NK | 2025-10228 | 22/46 | 1.080,32 € | 1.306,71 € | 21,0 % |
| Blank NK | 2025-10178 | 24/40 | 1.066,32 € | 1.381,94 € | 29,6 % |
| NK März | 2025-10069 | 27/52 | 1.024,22 € | 1.646,62 € | 60,8 % |
| Nachkalk Koller | 2025-10048 | 26/41 | 1.022,11 € | 1.311,50 € | 28,3 % |
| Glaser NK | 2025-10374, 2025-10106 | 23/45 | 985,77 € | 1.129,90 € | 14,6 % |
| Nachkalk Raith | 2025-10021 | 16/30 | 914,76 € | 1.196,49 € | 30,8 % |
| NK Johann Bayer | 2025-10344 | 14/24 | 912,84 € | 1.234,56 € | 35,2 % |
| NK Moninder | 2025-10346 | 22/39 | 873,60 € | 1.128,53 € | 29,2 % |
| NK Vergnon | 2025-10369 | 19/28 | 830,21 € | 1.010,76 € | 21,7 % |
| Zitzmann NK | 2025-10238, 2025-10208 | 20/40 | 805,96 € | 959,51 € | 19,1 % |
| NK Göbl | 2025-10345 | 16/30 | 799,23 € | 935,02 € | 17,0 % |
| NK Engelmann | 2025-10024 | 25/41 | 784,38 € | 1.100,15 € | 40,3 % |
| NK Ziebel | 2025-10176 | 18/25 | 782,67 € | 896,46 € | 14,5 % |
| NK Mühleisen | 2025-10221 | 16/31 | 767,39 € | 721,38 € | -6,0 % |
| NK Scheibel | 2025-10403, 2025-10015 | 16/22 | 751,41 € | 994,97 € | 32,4 % |
| NK Vogt | 2025-10386 | 26/54 | 718,96 € | 732,04 € | 1,8 % |
| NK Seliger neu | 2025-10366 | 23/45 | 705,41 € | 667,78 € | -5,3 % |
| NK Hoffmann | 2025-10043 | 17/27 | 694,17 € | 886,04 € | 27,6 % |
| NK Brand Sonja | 2025-10076 | 14/24 | 690,11 € | 609,06 € | -11,7 % |
| NK Melanie Koch | 2026-1 | 28/53 | 666,25 € | 693,43 € | 4,1 % |
| NK Bühler neu | 2025-10350 | 23/51 | 665,09 € | 706,72 € | 6,3 % |
| NK Schwendner | 2025-10056 | 22/42 | 654,06 € | 1.115,80 € | 70,6 % |
| NK Herbert Reiß | 2025-10343 | 20/32 | 643,71 € | 797,95 € | 24,0 % |
| NK Richter | 2025-10212 | 30/52 | 630,75 € | 771,44 € | 22,3 % |
| NK Hammerl | 2025-10066 | 26/44 | 630,58 € | 878,85 € | 39,4 % |
| Nachk. Albrecht | 2025-10025 | 21/30 | 617,95 € | 821,84 € | 33,0 % |
| NK Wesnitzer | 2025-10222 | 23/41 | 594,44 € | 570,69 € | -4,0 % |
| NK Klinger | 2026-4 | 21/54 | 590,07 € | 623,30 € | 5,6 % |
| NK Backes Auto | 2025-10131 | 15/27 | 577,89 € | 552,11 € | -4,5 % |
| NK Schimmel | 2025-10260 | 19/34 | 570,47 € | 663,04 € | 16,2 % |
| NK Wiesgickl | 2026-34 | 8/14 | 551,19 € | 509,19 € | -7,6 % |
| NK Eichenseer | 2025-10362 | 22/39 | 550,46 € | 622,34 € | 13,1 % |
| NK Kührlings | 2026-71 | 21/41 | 534,55 € | 461,98 € | -13,6 % |
| Weich Matthias | 2025-10065 | 12/14 | 512,59 € | 682,98 € | 33,2 % |
| NK Schmid Sing | 2025-10368 | 11/22 | 366,20 € | 337,23 € | -7,9 % |
| NK Biesinger | 2025-10224 | 13/24 | 356,25 € | 663,11 € | 86,1 % |
| NK Haller | 2025-10177 | 10/20 | 344,20 € | 323,86 € | -5,9 % |
| NK Seebauer 1 | 2025-10115 | 10/22 | 316,20 € | 317,14 € | 0,3 % |
| NK Weber | 2024-10271 | 9/33 | 289,89 € | 296,32 € | 2,2 % |
| NK Seebauer | 2025-10115 | 6/18 | 233,92 € | 213,02 € | -8,9 % |
| NK Bauer Karl | 2025-10339 | 7/18 | 175,34 € | 165,62 € | -5,5 % |
| HV Schiegerl | 2025-10159 | 4/7 | 166,97 € | 157,00 € | -6,0 % |
| Nachkalk Traßl | 2025-10095 | 7/22 | 140,72 € | 128,48 € | -8,7 % |
| Lichtenauer | 2025-10408 | 3/4 | 108,75 € | 186,93 € | 71,9 % |
