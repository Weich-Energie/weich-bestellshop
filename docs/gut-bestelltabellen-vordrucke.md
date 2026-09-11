# GUT-Bestelltabellen — die echten Strichlisten-Vordrucke

**Stand 11.09.2026.** Werkzeug: `tools/vps/gut-bestelltabellen.mjs` (rein lesend),
Rohdaten `/tmp/gut-bestelltabellen.json` auf dem VPS.

## Was sie sind, und warum sie im ersten Export fehlten

Der GUT-Shop führt zwei getrennte Bereiche:

| Bereich | API | Inhalt |
| --- | --- | --- |
| Warenkörbe | `/api/carts/list` | 106 Körbe `NK <Kunde>`, 4893 Positionen — die Nachkalkulation je Baustelle |
| Bestelltabellen | `/api/orderingtables/getOrderingTables` | 8 eigene Tabellen nach Material gruppiert, 296 Positionen |

Der Export vom 06.09.2026 (`gut-export-koerbe.mjs`) holt die **Korbliste**
vollständig — die Bestelltabellen liegen aber nicht darin. Sie waren deshalb in
der ganzen Formteil-Analyse nie enthalten. Aufgefallen ist das erst am
11.09.2026, als Patrick einen Screenshot dieser Liste schickte.

Abruf einer Tabelle ist ein **POST**:
`/api/orderingtables/getOrderingTable` mit
`{"tableNumber":"<id>","companyId":"551","company":false,"pageNumber":1}`.
Der `crsfKey` in der Query wechselt je Aufruf, deshalb wartet das Werkzeug eine
echte Anfrage der App ab und verwendet deren URL als Vorlage.

## Die acht Rubriken

Nach Verbrauchswert der Historie, nicht nach Anzahl:

| Rubrik | Positionen | davon in der Historie | EK der Historie |
| --- | --- | --- | --- |
| CU Fittinge & Rohre | 77 | 71 | 51 390 € |
| Uponor, Isoliermaterial Mineralwolle | 46 | 44 | 36 323 € |
| Sonstiges Zubehör & Ventile | 20 | 20 | 24 568 € |
| C-Stahl Fittinge & Rohre | 33 | 28 | 15 528 € |
| Übergänge & Verschraubungen & Reduzierungen | 33 | 32 | 13 103 € |
| HZ Edelstahlsystem | 46 | 24 | 2 025 € |
| HT Rohr & Zubehör, Tauchhülsen, Rohrschellen, Befestigung | 22 | 20 | 2 007 € |
| Schwarz | 19 | 17 | 1 972 € |

Dass **HZ Edelstahlsystem** trotz 46 Positionen nur 2 025 € Historie trägt,
passt zum Systemwechsel: die Rubrik ist neu, verbaut wurde in der Historie
Kupfer und C-Stahl (siehe `systemwechsel-35mm-edelstahl.md`).

## Deckung gegen die Verbrauchshistorie

| | Artikel | EK |
| --- | --- | --- |
| in der Historie (`shop_gut_verbrauch_je_artikel`) | 393 | 150 443 € |
| davon auf einem Vordruck | 255 | 142 484 € |
| nicht auf einem Vordruck | 138 | 7 959 € |

**Die acht Vordrucke decken 94,7 % des Verbrauchswerts.** Die 138 Artikel
daneben sind Einzelfälle mit 5,3 % — im Schnitt 58 € über eineinhalb Jahre.

## Was das für die Rubriken der Aufmaß-App bedeutet

Die neun Kategorien in `aufmass_kategorie` sind aus der
Materialsystem-Klassifikation der Historie abgeleitet. Patricks Vordrucke
schneiden anders, und sie sind die Struktur, die die Monteure kennen:

- **Er hat keine Rubrik für Megapress und MaxiPro** — die App hat beide.
- **„Übergänge & Verschraubungen & Reduzierungen" ist bei ihm eine eigene
  Rubrik quer über alle Systeme.** Das Preismodell steckt sie dagegen je System
  in den Gewinde-Zähler. Das ist ein echter Unterschied im Zuschnitt, nicht nur
  eine andere Benennung.
- **Für Dämmung, Ventile, HT-Rohr, Tauchhülsen, Rohrschellen und Befestigung hat
  er Rubriken** — im Modell sind das bewusst Einzelartikel ohne Rubrik. Diese
  Zeilen fehlen der App deshalb ganz; sie machen zusammen 62 688 € der Historie
  aus (Uponor/Isolier, Sonstiges Zubehör & Ventile, HT/Schellen).

Offen und Patricks Entscheidung: ob die App auf diesen Zuschnitt umgestellt
wird. Die Daten liegen dafür bereit — jede Rubrik mit ihrer Artikelliste.
