# Zuschnitt der Strichliste: wie viele Zeilen braucht der Monteur?

Stand 09.09.2026. Zweck der alten Nachkalkulationen ist das **Mengengerüst** —
sie zeigen, wie sich der Verbrauch auf Systeme, Dimensionen und Bauformen
verteilt, und daraus lässt sich ableiten, wie man Gruppenartikel schneidet.
Es geht nicht um einen Preisvergleich zwischen Materialien.

## Wie lang die Strichliste heute ist

Aus 105 Körben mit Formteilen:

| Zuschnitt | Zeilen je Baustelle | Gruppen insgesamt |
|---|---|---|
| **heute: jeder Artikel eine Zeile** | **32,2** (max 64) | 270 |
| System + Dimension + Gewindemaß + Preisklasse | 26,8 | 169 |
| System + Dimension + Gewindemaß | 25,4 | 162 |
| System + Rohrdimension + Preisklasse | 20,8 (max 37) | 100 |
| System + Rohrdimension | 15,2 | 81 |
| System + Dimensionsklasse + Preisklasse | 11,6 | 32 |
| System + Dimensionsklasse | 7,0 | 18 |

Der wichtigste Befund: **„je Rohrdimension ein Formteil" allein bringt kaum
Vereinfachung** — von 32,2 auf 25,4 Zeilen. Der Grund ist nicht die Zahl der
Bauformen, sondern dass eine Baustelle im Schnitt **4,5 Materialsysteme** und
darin je mehrere Dimensionen berührt.

## Wo die Vereinfachung wirklich herkommt

Drei Hebel, in der Reihenfolge ihrer Wirkung:

**1. Das Gewindemaß weglassen (26,8 → 20,8 Zeilen).** Heute ist
„35 mm × 1 Zoll AG" eine andere Gruppe als „35 mm × 1 1/4 Zoll AG". Für den
Monteur bedeutet das, beim Zählen auf die Gewindegröße zu achten. Preislich
kostet es wenig: bei Heizungsedelstahl 35 mm liegt der Übergang auf 1 Zoll bei
8,52 €, die Übergangsmuffe auf 1 1/4 Zoll bei 10,64 €. Ein Mittelwert über
beide trifft auf 12 % genau. **Empfehlung: Gewindemaß raus, nur Rohrdimension
zählt.**

**2. Weniger Systeme gleichzeitig (Selbstläufer).** Die 4,5 Systeme je
Baustelle sind ein Artefakt der Umstellungsphase — anfangs Kupfer, dann
C-Stahl, jetzt Heizungsedelstahl. Künftig sind es typisch drei:
Heizungsedelstahl für die Verteilung, Uponor MLC für die Flächenheizung,
Rotguss und Gewinde für Anschlüsse. Damit sinkt die Zeilenzahl ohne jeden
Modelleingriff auf etwa 14.

**3. Dimensionen zusammenfassen (20,8 → 11,6 Zeilen).** Der größte Sprung,
aber auch der teuerste an Genauigkeit. Preise bei Heizungsedelstahl:

| Dimension | Verbinder | Gewindeteil | Abzweig |
|---|---|---|---|
| 22 mm | 3,07 € | 5,15 € | 6,92 € |
| 28 mm | 3,85 € | 7,38 € | 7,51 € |
| 35 mm | 8,00 € | 8,52 € | 10,98 € |

22 und 28 zusammenzufassen kostet rund 12 % Genauigkeit und ist vertretbar.
35 mm dazu zu nehmen nicht: der Verbinder kostet dort mehr als das Doppelte.
**Empfehlung: 35 mm bleibt eigen, 22 und 28 dürfen zusammen.**

## Vorschlag für die Strichliste

Je Materialsystem eine Spalte, je Rohrdimension eine Zeile, zwei Zähler:

```
Heizungsedelstahl        Presse-Formteile   Gewindeteile
  bis 18 mm                    ___              ___
  22 bis 28 mm                 ___              ___
  35 mm                        ___              ___
Uponor MLC
  16 / 20 mm                   ___              ___
  25 / 32 mm                   ___              ___
Rotguss und Gewinde
  1/2 bis 3/4 Zoll             ___              ___
  1 Zoll und größer            ___              ___
```

Das sind **14 Felder auf dem Vordruck**, von denen eine typische Baustelle
etwa acht bis zehn füllt — gegenüber heute 32 verschiedenen Artikelnummern.
Rohrmeter kommen je Dimension dazu, Ventile und Armaturen bleiben Einzelzeilen.

Warum zwei Zähler statt einem: Gewindeteile sind 41,7 % der Menge und kosten
je nach System 1,1× bis 2,2× den Verbinder — bei Kupfer und Sanpress bis 4×,
weil dort Siliziumbronze im Spiel ist. Eine gemeinsame Zahl wäre der einzige
Vereinfachungsschritt, der die Kalkulation wirklich unsicher macht. Der
Aufwand dafür ist ein zweites Kästchen in derselben Zeile. Herleitung in
[formteil-preisklassen.md](formteil-preisklassen.md).

## Was das Mengengerüst noch hergibt

- **Bogenaufteilung:** 90 Grad innen/innen 60 bis 82 %, 90 Grad innen/außen
  12 bis 47 %, 45 Grad 6 bis 12 % — über alle Systeme und Dimensionen fast
  gleich. Diese Mischung ist ein Installationsmuster und lässt sich auf jedes
  neue System übertragen, auch ohne eigene Historie.
- **Klassenmix:** Verbinder 46,0 %, Gewindeteile 41,7 %, glatte Abzweige
  6,9 %, Verschlüsse 5,4 %.
- **Mengenschwerpunkt:** Die 30 größten Gruppen tragen 76,5 % der Menge, die
  10 größten nur 49,5 %. Ein langer Schwanz aus Einzelstücken — ein weiteres
  Argument, nicht zu fein zu gruppieren.
