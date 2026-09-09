# R+F-Lagerliste als echte Preisquelle — Richtungswechsel im Formteil-Modell

Stand 09.09.2026. Ergänzt und korrigiert
[aufmass-formteil-modell.md](aufmass-formteil-modell.md), Schritt 2 und 3.

## Was Patrick am 09.09.2026 klargestellt hat

Die GUT-Warenkörbe sind **keine Liste des tatsächlich verbauten Materials**.
Auf der Baustelle wurde per Strichliste auf Vordrucken erfasst, die
GUT-Artikel mit QR-Code und Bild zeigten — weil sich im R+F-Shop keine
solchen Vordrucke erzeugen ließen. Verbaut wurden aber R+F-Artikel. Der
GUT-Warenwert war nur die **Kalkulationsbasis**, das Pendant zum echten
Material. Genau das soll das neue Modell abstellen.

Materialgeschichte der letzten 18 Monate:

| Zeitraum | System | Heute |
|---|---|---|
| anfangs | Kupfer Profipress, viel 35 mm | nur noch kleine Dimensionen als Übergang im Bestand |
| zwischenzeitlich | C-Stahl Prestabo | abgelöst |
| aktuell | **R+F-Heizungsedelstahl** | Hauptsystem |

Große Dimensionen (ab 35 mm) bleiben in Kalkulation und Nachkalkulation
stehen, falls sie doch gebraucht werden.

## Warum das den Kern des Modells trifft

Der Verbrauch der Historie liegt zu **48 % auf Systemen und Dimensionen, die
heute nicht mehr verbaut werden**:

| System und Dimensionsklasse | Anteil am Formteil-Verbrauch |
|---|---|
| Kupfer b-press, ab 35 mm | 34,4 % |
| Uponor MLC, bis 28 mm | 19,2 % |
| C-Stahl Prestabo, ab 35 mm | 13,8 % |
| Rotguss/Gewinde | 12,3 % |
| Kupfer b-press, bis 28 mm | 10,0 % |
| **Heizungsedelstahl (connect-inox)** | **2,2 %** |

Das aktuelle Hauptsystem hat also fast keine Historie. Eine reine
Mengengewichtung über die Vergangenheit bepreist damit das falsche Material.

## Die Lösung: Preise aus dem Lager, Gewichte aus der Historie

Patricks Lagerauszug (Regalcodes mit R+F-Artikelnummer, Listenpreis und EK)
liefert **echte Preise des heute geführten Materials**. Die GUT-Historie
liefert weiterhin das **Mengenverhältnis der Formteil-Arten je Dimension** —
und das ist ein Installationsmuster, kein Materialmerkmal. Nachweis aus 106
Baustellen (Sicht in der Arbeitsmappe, Blatt „Mischung"):

| Bogenart | Anteil innerhalb der Dimension |
|---|---|
| 90 Grad innen/innen | 60–82 % |
| 90 Grad innen/außen | 12–47 % |
| 45 Grad (beide) | 6–12 % |

Die Aufteilung ist bei Kupfer und C-Stahl praktisch gleich, über alle
Dimensionen von 15 bis 35 mm. Sie lässt sich deshalb auf Heizungsedelstahl
übertragen, für das keine Verbrauchshistorie existiert.

## Befund: die Textsuche war der Fehler, nicht der Preis

Von 48 Lagerartikeln hatte die R+F-Textsuche 8 ebenfalls gefunden. Bei allen
acht stimmt der Preis **auf den Cent** mit dem Lagerauszug überein. Die Suche
liefert also korrekte Preise, wenn sie den richtigen Artikel trifft; das
Problem sind ausschließlich die Fehltreffer.

Bögen Profipress, echter Lagerpreis mit der Mischung aus der Historie
gegenüber dem alten GUT-Kalkulationspreis:

| Dimension | Menge | GUT alt | R+F echt | Abweichung |
|---|---|---|---|---|
| 15 mm | 50 | 1,89 € | 2,19 € | +15,9 % |
| 18 mm | 39 | 1,54 € | 2,76 € | +78,7 % |
| 22 mm | 168 | 3,00 € | 3,49 € | +16,4 % |
| 28 mm | 351 | 6,78 € | 7,62 € | +12,4 % |
| **gewichtet** | **608** | **3.037 €** | **3.477 €** | **+14,5 %** |

Dieselben Bögen mit meiner Textsuche: +115 % bis +470 %. Der im
Baustellen-Vergleich gemeldete Sprung auf +50 % ist damit als **Messfehler
der Textsuche** erklärt, nicht als Preisunterschied. Der Ausreißer bei 18 mm
deutet auf einen alten GUT-Sonderpreis hin (1,54 € für einen 18-mm-Bogen).

Bei Armaturen ist R+F sogar deutlich günstiger als die alte GUT-Basis:

| Artikel | R+F echt | GUT alt | Abweichung | Verbrauch |
|---|---|---|---|---|
| WESA-Kugelhahn 1 × 1 1/4 Zoll | 17,57 € | 37,80 € | −53,5 % | 3.440 € |
| WESA-Kugelhahn 1 × 1 Zoll | 12,73 € | 15,83 € | −19,6 % | 2.628 € |
| Rückflussverhinderer DN 25 | 22,52 € | 38,92 € | −42,1 % | 739 € |
| KFR-Vollflutventil DN 25 | 32,30 € | 38,91 € | −17,0 % | 739 € |

Median-Rabatt auf den Listenpreis im Lagerauszug: 61,9 %.

## Konsequenz für das Modell

1. **Quelle `vermutet` verliert ihre Rolle.** Sie war die Notlösung für
   fehlende Preise. Wo ein Lagerpreis vorliegt, ersetzt er sie; die
   PDS-Katalogpreise der Kunstartikel bleiben deshalb weiter auf dem Stand
   vom 07.09., bis die Erfassung durch ist.
2. **Der Mittelwert wird zweistufig:** Preis je Formteil-Art aus der
   Lagerliste, Gewicht je Art aus der Historie, Summe je System und
   Dimension.
3. **Neue Zielsysteme** sind Heizungsedelstahl (Hauptsystem), Uponor MLC
   (Fußbodenheizung, läuft weiter), Rotguss/Gewinde, Kupfer Profipress klein
   (Bestandsübergänge). Kupfer und C-Stahl ab 35 mm bleiben als Reserve
   führbar, gehören aber nicht in den Mittelwert des heutigen Systems.
4. **Der Baustellen-Vergleich alt gegen neu** ist erst nach der Erfassung
   aussagekräftig. Bis dahin gilt die Zahl aus der Textsuche als überzeichnet.

## Ergebnis nach dem zweiten Auszug: 91,2 % (09.09.2026)

Patrick lieferte am 09.09.2026 einen zweiten Regalauszug mit 193 Zeilen —
darunter das komplette Heizungsedelstahl-Programm (OptiSteel simplesta 22/28/35
mm), Uponor S-Press PLUS 16 bis 32 mm, die Rotguss- und
Schwarz-Gewinde-Formteile sowie die fehlenden Profipress-T-Stücke und
-Übergangsstücke. Zusammen mit dem ersten Auszug: **233 eindeutige Artikel**.

Strukturelles Matching über System + Dimension + Formteil-Art (`match2.py` im
Sitzungs-Scratchpad, Systemabbildung OptiSteel → `connect-inox`):

| Schritt | Artikel | Verbrauchswert |
|---|---|---|
| Formteile über System+Dimension+Art | 148 | 45.125 € |
| Armaturen und Schellen über Bauart+Nennweite | 8 | 6.578 € |
| Nachtrag (nackte Zollangaben, geprüft) | 5 | 1.924 € |

| Quelle | Anteil am Verbrauchswert |
|---|---|
| **lager** (echter Preis) | **35,6 %** |
| automatisch (rf24-Suche) | 34,3 % |
| vermutet | 21,3 % |
| **zusammen zugeordnet** | **91,2 %** |
| offen | 8,8 % (13.290 €, 55 Artikel) |

Damit ist das Erfolgskriterium „mindestens 90 % des Verbrauchswerts
zugeordnet" erfüllt. 94 der Zuordnungen korrigierten einen um mehr als 10 %
falschen Preis, 15 Artikel hatten vorher gar keinen.

**Baustellen-Vergleich mit echten Preisen** (58 PDS-bestätigt abgerechnete
Baustellen, 1.769 von 2.001 Formteil-Positionen bepreist = 88 %):

| | Alt (GUT-Kalkulationsbasis) | Neu (echte R+F-Preise) | Abweichung |
|---|---|---|---|
| alle 58 Baustellen | 59.613 € | 73.510 € | **+23,3 %** |
| die fünf größten | 7.990 € | 9.453 € | +18,3 % |
| Median je Baustelle | | | +18,4 % |

53 Baustellen werden teurer, 5 günstiger. Die frühere Zahl von +50 % war ein
Artefakt der Textsuche und ist damit vom Tisch. Der verbleibende Aufschlag von
rund 20 % ist echt und gehört in die Lieferantenentscheidung.

**Zwei Fehltreffer-Fallen beim Nachtrag** (beide erkannt und zurückgenommen):
Ein Muffenpreis ist kein Bogenpreis — wo das Lager für eine Dimension nur die
Muffe führt, darf der Bogen keinen Preis bekommen (traf die 35-mm-Bögen von
Kupfer und C-Stahl, die nicht mehr geführt werden). Und Messtechnik hat zwei
Maße: das Lager führt ein Bimetall-Thermometer mit 63 mm Gehäuse und 100 mm
Tauchlänge; BZT160100 (Gehäuse 160 mm, GUT-EK 20,12 €) hätte damit 4,36 €
bekommen.

## Weg zur 90-Prozent-Schwelle (Stand vor dem zweiten Auszug)

| Größe | Wert |
|---|---|
| Verbrauch gesamt | 150.443 € |
| zugeordnet (automatisch + vermutet) | 123.336 € = 82,0 % |
| Ziel 90 % | 135.399 € |
| **fehlt** | **12.063 €** |
| offen insgesamt | 27.107 € (79 Artikel) |

Die 32 Lager-Zuordnungen heben die Quote **nicht** um ihren vollen
Verbrauchswert: 28 davon korrigieren nur den Preis bereits zugeordneter
Artikel. Neu hinzu kommen die vier Ventile, die vorher gar keinen Preis
hatten (KFR-Ventil DN 15 und DN 20, Freistromventil DN 15 und DN 20,
zusammen 2.835 €). Damit steigt die Quote von 82,0 auf **83,9 %**.

Wo die restlichen offenen 27.107 € liegen:

| Bereich | Artikel | Wert | Kommt aus welchem Auszug |
|---|---|---|---|
| Uponor MLC, Formteile | 13 | 7.599 € | Uponor-Regal |
| Kupfer b-press, Formteile | 9 | 7.192 € | Profipress T-Stücke und Übergänge |
| Ventile ohne System | 14 | 4.888 € | Armaturen-Regal |
| C-Stahl Prestabo, Formteile | 10 | 2.909 € | Reserve, niedrige Priorität |
| Rohre | 5 | 1.956 € | Rohrlager |
| Schellen und Zubehör | 4 | 1.080 € | Befestigungsregal |
| ungeklärt | 8 | 909 € | beim Erfassen klären |
| Rest (Inox, Rotguss, Megapress, Gewinde) | 15 | 474 € | — |

**Folgerung:** Allein der Uponor-Auszug und die Profipress-T-Stücke und
-Übergangsstücke bringen zusammen 14.791 € und damit mehr als die fehlenden
12.063 €. Die 90-Prozent-Schwelle ist mit Patricks kommenden Auszügen
erreichbar, ohne eine einzige weitere Textsuche. Die größten Einzelposten
sind T-Stücke mit Innengewinde-Abgang (BPT3515I 3.197 €, POVT3515I 967 €,
BPT2815I 941 €), Uponor-Übergangsnippel (UCPA2525N 2.888 €, UCPA2520N
1.215 €, UCPA2020N 983 €), das reduzierte Uponor-T-Stück UCPT2515IN
(1.095 €) und das Kupfer-Übergangsstück BPUS3532 (1.784 €).

## Erfassung

Arbeitsmappe `Lagerliste-Erfassung.xlsx` (an Patrick 09.09.2026):

- Blatt **Erfassen** — 166 Kombinationen System × Dimension × Formteil-Art aus
  der Historie, priorisiert. 74 Zeilen Priorität 1 (heute verbaut), 12
  Priorität 2 (hoher Historienanteil), 80 Priorität 3 (Reserve ab 35 mm).
  Eingabespalten für R+F-Nummer und EK.
- Blatt **Einzelartikel** — 36 Ventile, Dämmungen, Rohre und Schellen ab 150 €
  Verbrauchswert; bleiben laut Ziel ungemittelt und brauchen je Artikel eine
  echte Nummer.
- Blatt **Schon belegt** — die 48 Artikel des ersten Auszugs (nach der
  Klassifikation des Repo-Skripts: 20 Formteile, 19 Armaturen, 8 Teile
  Befestigung, 1 Pumpenverschraubung; alle Formteile Profipress Kupfer
  15/18/22/28 mm, nur Bogen und Muffe).
- Blatt **Validierung** — die 8 Treffer als Nachweis.
- Blatt **Mischung** — die Bogen-Aufteilung aus 106 Baustellen.

Benötigt werden je Artikel nur **Artikelnummer, Bezeichnung und EK**. Das
Format des ersten Auszugs (Semikolon, deutsche Dezimalkommas,
`Nr;Menge;Einheit;Text;Liste;EK`) wird von
`tools/lager-auszug-lesen.py` direkt gelesen.
