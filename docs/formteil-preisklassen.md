# Preisklassen statt eines Mittelwerts je Dimension

Stand 09.09.2026. Antwort auf Patricks Frage vom 09.09.2026: „Wir sollten
abgrenzen, welche Artikel die billigsten und die teuersten sind, damit sie den
Mittelwert nicht zu stark beeinflussen." Grundlage sind erstmals **echte
R+F-Preise** aus den Lagerauszügen, siehe
[rf-lagerliste-echte-preise.md](rf-lagerliste-echte-preise.md).

## Die Sorge ist berechtigt

Ein Mittelwert über alle Formteile einer Dimension streut weit:

| Gruppierung | Median-Spanne max/min | schlimmster Fall |
|---|---|---|
| eine Gruppe je System und Dimension (heutiges Modell) | 2,6× | 6,5× |
| vier Klassen je System und Dimension | 1,6× | 4,0× |

Schlimmster Einzelfall im heutigen Modell: Kupfer Profipress 18 mm reicht von
2,64 € (Bogen) bis 17,23 € (T-Stück mit Innengewinde-Abzweig aus
Siliziumbronze). Ein gemeinsamer Mittelwert von 4,89 € trifft keinen der
beiden.

## Der Preistreiber ist das Gewinde, nicht die Bauform

Der Vergleich derselben Bauform in verschiedenen Werkstoffen zeigt es:

| Dimension | T-Stück Presse-Werkstoff | T-Stück mit Innengewinde | Faktor |
|---|---|---|---|
| 15 mm | 3,21 € (Kupfer) | 10,23 € (Siliziumbronze) | 3,2× |
| 18 mm | 4,29 € (Kupfer) | 17,23 € (Siliziumbronze) | 4,0× |
| 22 mm | 5,51 € (Kupfer) | 13,89 € (Siliziumbronze) | 2,5× |
| 28 mm | 10,42 € (Kupfer) | 17,46 € (Siliziumbronze) | 1,7× |

Sobald ein Gewindeanschluss dazukommt, braucht das Teil Rotguss oder
Siliziumbronze (trinkwassertauglich) und kostet ein Mehrfaches. Das ist keine
Streuung, sondern ein anderes Produkt.

## Und es ist kein Randfall

Mengenanteil der Klassen in der echten Verbrauchshistorie (alle 106 Körbe,
11.660 Formteile):

| Klasse | Menge | Anteil | GUT-EK je Stück |
|---|---|---|---|
| **Verbinder** (Bogen, Muffe, Kupplung, Winkel, Reduzierung) | 5.365 | 46,0 % | 7,91 € |
| **Gewindeteil** (Übergang AG/IG, Verschraubung, Nippel, T-Stück mit IG) | 4.857 | **41,7 %** | 10,10 € |
| **Abzweig glatt** (T-Stück, T-Stück reduziert) | 807 | 6,9 % | 12,00 € |
| **Verschluss** (Kappe, Stopfen) | 628 | 5,4 % | 2,53 € |

Gewindeteile sind **41,7 % der Menge**. Sie in einen Topf mit den Verbindern
zu werfen, verzerrt jede Baustelle, deren Gewindeanteil vom Durchschnitt
abweicht — und der schwankt stark, weil er von der Zahl der Verteiler,
Anbindungen und Armaturenanschlüsse abhängt, nicht von der Leitungslänge.

Faktoren gegenüber dem Verbinder derselben Dimension (echte R+F-Preise):

| Klasse | im Schnitt | Spanne |
|---|---|---|
| Abzweig glatt | 2,14× | 1,37× bis 3,99× |
| Verschluss | 2,07× | 1,50× bis 2,40× |
| Gewindeteil | 1,73× | 1,07× bis 2,21× |

## Empfehlung: zwei Zahlen je Dimension, nicht eine und nicht vier

**Vorschlag für die Aufmaß-App:** Der Monteur trägt je Materialsystem und
Dimension zwei Anzahlen ein statt einer.

1. **Presse-Formteile** — Verbinder, glatte Abzweige, Verschlüsse. Alles, was
   nur gepresst wird. 58,3 % der Menge.
2. **Gewindeteile** — alles mit Gewinde, gleich ob Außen- oder Innengewinde,
   Übergang, Verschraubung oder T-Stück mit Abzweig. 41,7 % der Menge.

Warum nicht vier Klassen: Abzweig glatt (6,9 %) und Verschluss (5,4 %) wiegen
mengenmäßig kaum, und ihre Preisabweichungen gehen in verschiedene Richtungen
(Abzweig 2,1× teurer, Verschluss bei 2,53 € deutlich billiger als der
Verbinder-Durchschnitt) — im Mittel heben sie sich weitgehend auf. Jede
zusätzliche Zahl kostet den Monteur Zeit, und das Erfolgskriterium verlangt
ein Aufmaß in unter fünf Minuten.

Warum nicht eine Zahl: Bei einem Gewindeanteil von 41,7 % und Faktor 1,7
liegt der Fehler bei einer Baustelle mit überdurchschnittlich vielen
Gewindeteilen im zweistelligen Prozentbereich.

## Was gar nicht gemittelt werden darf

Diese Artikel gehören als Einzelartikel erfasst, nie in einen Formteil-Mittelwert:

- **Armaturen und Ventile** — Kugelhähne, KFR- und Freistromventile,
  Rückflussverhinderer, Sicherheitsventile, Entlüfter. Schon laut Ziel
  Einzelartikel.
- **Messtechnik** — Manometer, Thermometer, Tauchhülsen, Schutzrohre.
- **Heizkörperanbindung** — Thermostat-Ventilunterteile (15–17 €),
  Rücklaufverschraubungen, Thermostatköpfe.
- **Pumpengruppen und Verschraubungs-Sets** (18 €).
- **Sanitär-Zubehör** — im Auszug etwa ein Grohe-Absperrgriff mit 160,26 € und
  eine Grohe-Kappe mit 26,80 €. Solche Teile sind als „Kappe" klassifizierbar
  und würden jeden Verschluss-Mittelwert zerstören.
- **Speicher, Zylinder, Wärmepumpen, Heizkörper** — gehören ohnehin ins ERP.

**Als Regel für die Klassifikation:** Ein Formteil, dessen EK über dem
Zweifachen des Verbinder-Mittelwerts derselben Dimension liegt, ist verdächtig
und gehört geprüft, statt automatisch in den Mittelwert zu laufen. Im
Lagerauszug betrifft das 10 der 25 Artikel ab 15 €.

## Umsetzung, falls freigegeben

1. `shop_gut_artikel_klassifikation` bekommt eine Spalte `preisklasse`
   (`presse` / `gewinde` / ausgeschlossen als `einzelartikel`).
2. `shop_formteil_mittelwert` gruppiert zusätzlich nach `preisklasse`; die
   Streuungsspalten min/max bleiben als Warnsignal.
3. Die Kunstartikel heißen dann „Formteil &lt;System&gt; &lt;Dimension&gt;
   Presse" und „… Gewinde"; die 57 bestehenden PDS-Katalogeinträge bleiben
   stehen (nicht löschbar) und werden zur Presse-Variante.
4. Die App zeigt je Dimensionszeile zwei Zähler statt einem.

Schritt 1 und 2 sind Schemaänderungen und warten auf Patricks Entscheidung.
