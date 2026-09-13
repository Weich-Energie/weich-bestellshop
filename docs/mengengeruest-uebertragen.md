# Mengengerüst übertragen — Mischsätze für ein neues System

**Stand 13.09.2026.** Betrifft die vier Heizungsedelstahl-Gruppen.

## Das Problem

Ein Mischsatz ist ein mengengewichteter Mittelwert. Ein Artikel ohne Verbrauch
hat Gewicht null und fließt nicht ein. Heizungsedelstahl trägt aber nur **2,9 %
des Mengengerüsts** (296 von 10 191 Stück), weil das System neu ist; 15 der 24
Edelstahl-Regalartikel haben gar keinen Verbrauch.

Die Mischsätze beschrieben damit das Material, das abgelöst wird — Kupfer
(39,3 %), Uponor (23,0 %) und C-Stahl (18,4 %) — nicht das, was heute verbaut
wird.

## Warum die Übertragung zulässig ist

Der Teile-Mix ist über die Systeme hinweg fast gleich:

| Teileart | Kupfer | C-Stahl | Uponor | Edelstahl |
| --- | --- | --- | --- | --- |
| Bogen | 43,4 % | 53,4 % | 52,7 % | 45,3 % |
| Übergang | 37,5 % | 28,3 % | 34,6 % | 26,7 % |
| T-Stück | 9,8 % | 10,6 % | 7,5 % | 17,2 % |
| Reduzierung | 5,7 % | 5,8 % | — | 6,4 % |
| Muffe | 3,1 % | 2,0 % | 5,1 % | 4,4 % |

Wie oft ein Bogen gebraucht wird, hängt an der Installation, nicht am
Werkstoff. Also: **Anteile je Teileart aus C-Stahl, Preise aus dem
Edelstahl-Regal.** C-Stahl als Basis, weil es das letzte Pressystem vor dem
Edelstahl war — die Bauweise ist näher dran als bei Kupfer.

## Die vier Sätze

| Gruppe | vorher | jetzt | Zusammensetzung |
| --- | --- | --- | --- |
| 22–28 mm Presse | 3,81 € | **4,25 €** | Bogen 83 % à 3,90 · T-Stück 12,7 % à 6,92 · Reduzierung 4,2 % à 3,08 |
| 22–28 mm Gewinde | 6,92 € | **6,63 €** | Übergang 100 % à 6,63 |
| 35 mm+ Presse | 9,07 € | **8,48 €** | Bogen 79,6 % à 8,30 · T-Stück 16,7 % à 10,33 · Muffe 3,7 % à 4,17 |
| 35 mm+ Gewinde | 6,92 € | **9,58 €** | Übergang 100 % à 9,58 |

## Aufbau

- `shop_formteil_gruppenpreis` bleibt **unverändert die gemessene Historie**.
- `shop_formteil_gruppenpreis_uebertragen` hält die übertragenen Sätze, mit
  `zusammensetzung` als jsonb (Anteil und Preis je Teileart), damit der Satz
  nachgerechnet werden kann.
- `shop_formteil_gruppenpreis_effektiv` legt beides übereinander und sagt in
  `herkunft`, woher der Satz kommt. **Damit rechnet `aufmass_ek_summe`.**
- Die vier Kunstartikel `FORMTEIL-G-CONNECT_INOX-*` tragen den wirksamen Satz,
  weil `shop_pds_formteil_gruppen` den Preis vom Artikel liest.

## Wann die Übertragung wieder weg soll

Faustregel: **ab etwa 300 Stück je Gruppe** trägt die eigene Historie. Dann die
Zeile aus `shop_formteil_gruppenpreis_uebertragen` löschen, der effektive Satz
fällt automatisch auf die Historie zurück.

Die Historie wächst aber **nicht von selbst** aus den neuen Aufmaßen:
`shop_formteil_gruppenpreis` liest ausschließlich `shop_gut_positionen`, also
die alten GUT-Warenkörbe. Wer die Aufmaß-Mengen einfließen lassen will, muss
die Sicht erweitern. Patricks Plan ist stattdessen, von Zeit zu Zeit neue
Nachkalkulationen zu ziehen.

## Nebenbefund: Megapress statt Prestabo

Beim Prüfen fiel eine objektiv falsche Zuordnung auf. Die Textsuche hatte drei
Prestabo-Übergangsstücken ein **Megapress-T-Stück** zugewiesen
(R+F 1017314020200, 25,65 €) — anderes System, anderes Teil:

| GUT-Artikel | Menge |
| --- | --- |
| POVUS3525A Prestabo-Übergangsstück 35 mm × 1" AG | 400 |
| POVUS3525I Prestabo-Übergangsstück 35 mm × 1" IG | 39 |
| POVUS2825I Prestabo-Übergangsstück 28 mm × 1" IG | 5 |

444 Stück zu 25,65 € sind 11 389 € — das 28er Prestabo-Übergangsstück kostet im
Regal 6,35 €. Zurückgenommen mit Migration `20260913120000`. Folgen:

- `prestabo-stahl / 35mm und groesser / gewinde` bestand nur aus diesen beiden
  Artikeln und hat jetzt **keinen Satz mehr**. Im Regal gibt es kein 35er
  Prestabo-Übergangsstück, ein Ersatz lässt sich nicht sauber herleiten.
  C-Stahl ist abgelöst und die Rubrik in der Aufmaß-App ausgeblendet.
- `prestabo-stahl / 22-28mm / gewinde` fällt von 8,55 € auf 7,56 €.
- Der Kunstartikel für die 35er Gewindegruppe trägt keinen Preis mehr.
