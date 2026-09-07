# Formteil-Modell: von GUT-Einzelartikeln zu R+F-Mittelwerten je System und Dimension

Stand 06.09.2026. Hintergrund und Ziel stehen im Goal-Prompt „Digitales
Aufmaß mit Formteil-Preisen (GUT → R+F)". Dieses Dokument beschreibt, wie
Schritt 1–3 davon technisch umgesetzt sind.

## Warum überhaupt ein Mittelwert statt Einzelpreise

Bisher wurde auf der Baustelle jeder einzelne Formteil-Typ separat erfasst
(Bogen, T-Stück, Übergangsstück, Reduzierung — je nach Rohrdimension und
Anschlussart oft ein Dutzend verschiedene Artikelnummern). Das Aufmaß soll
künftig nur noch **Materialsystem + Rohrdimension + Anzahl Formteile** erfassen,
ohne dass der Monteur zwischen Bogen/T-Stück/Übergangsstück unterscheiden muss.
Der Preis dafür ist ein mengengewichteter Mittelwert aus der historischen
GUT-Verbrauchsmischung, neu bepreist mit R+F-Nettopreisen. **Rohre, Ventile und
Schellen bleiben Einzelartikel** — nur Verbindungs-Formteile werden gemittelt.

## Schritt 1 — Export (erledigt 06.09.2026)

`tools/vps/gut-export-koerbe.mjs` liest alle GUT-Warenkörbe über die
JSON-API der App (nicht per DOM-Scraping, siehe
[docs/lieferanten-shop-zugaenge.md](lieferanten-shop-zugaenge.md)) und schreibt
sie nach `shop_gut_koerbe` / `shop_gut_positionen`
(Migration `20260906221500_gut_export.sql`). Ergebnis: 106 Körbe, 4.893
Positionen, 393 eindeutige Artikelnummern, ~150.443 € EK-Summe über alle
Körbe.

## Schritt 2 — Stand 07.09.2026

Automatisch sicher zugeordnet: 133 von 393 Artikeln, das sind **51 % des
Verbrauchswerts** (76.937 € von 150.443 €). Erfolgskriterium (90 %) damit
noch nicht erreicht. Zwei Automatikläufe:
1. Erstlauf, Top-3-Kandidaten je Artikel: 109 sicher.
2. Zweitlauf, Top-12 statt Top-3 Kandidaten, nur für die zuvor „unsicher"
   eingestuften 226 Artikel: 24 weitere sicher.

**Warum nicht weiter automatisieren:** Die verbleibenden 259 Artikel in der
Prüfliste sind Fälle, in denen R+F entweder die exakte Variante nicht führt
(anderes Gewinde, andere Anschlussgröße — siehe BPUS3525-Beispiel unten) oder
mehrere ähnliche Kandidaten ohne eindeutigen Gewinner liefert. Die Heuristik
bewusst nicht weiter gelockert, um keine falschen Formteile (falsches
Gewinde/falsche Dimension) in die Preisbildung einzuspeisen — das wäre
schlimmer als eine unvollständige Automatik. Der Rest ist die geforderte
manuelle Prüfliste (259 Artikel, CSV mit bis zu 5 Kandidaten je Artikel).

**Fund zur Session-Stabilität:** Die R+F-Sitzung verfällt nach 1–2 Stunden
Dauerbetrieb. Ein Abbruch per `kill` mitten im Lauf lässt das Skript die
Restschleife mit lauter „kein_treffer" durchlaufen (der Fehler wird pro
Artikel abgefangen, nicht als Abbruch erkannt) — beim Zusammenführen von
Ergebnisdateien Einträge mit gesetztem `fehler`-Feld immer ausschließen.

## Baustellen-Vergleich (Stand 07.09.2026, vorläufig)

PDS-Verbindung war beim Erstellen dieses Vergleichs nicht erreichbar
(Sitzungsfehler, siehe unten) — deshalb **keine PDS-bestätigten „abgeschlossenen"
Baustellen**, sondern die fünf GUT-Körbe mit der besten Formteil-Preisabdeckung
(meiste Positionen, deren Materialsystem+Dimension bereits einen
R+F-Mittelwert hat). Sobald PDS wieder erreichbar ist, gegen echten
Auftragsstatus prüfen und ggf. ersetzen.

| Korb | Positionen mit Preis | Alt (GUT) | Neu (Formteil-Mittel) | Abweichung |
|---|---|---|---|---|
| NK Klügl | 31/53 | 1.348,97 € | 1.828,30 € | +35,5 % |
| NK Bauer Peschk | 32/57 | 914,40 € | 1.011,25 € | +10,6 % |
| NK Richter | 30/52 | 630,75 € | 771,44 € | +22,3 % |
| NK Schmidt | 42/71 | 578,20 € | 963,95 € | +66,7 % |
| NK Kohl Auto | 32/61 | 508,96 € | 1.002,50 € | +97,0 % |
| **Summe** | **167/294 (57 %)** | **3.981,28 €** | **5.577,44 €** | **+40,1 %** |

**Wichtiger Befund:** Der neue Formteil-Mittelwert liegt in allen fünf
Stichproben über dem historischen GUT-Preis, im Schnitt 40 % höher. Mögliche
Ursachen, noch nicht abschließend geklärt:
- R+F-Listenpreise/Konditionen könnten für Weich schlicht höher liegen als
  die bestehende GUT-Vereinbarung.
- Die automatische Zuordnung (Schritt 2) fand bevorzugt Markenware
  (z. B. Viega) mit eindeutigem Text-Treffer — ein guenstigeres, aber
  schwerer text-eindeutiges Aequivalent koennte in der Pruefliste stecken statt
  im Mittelwert.
- Nur 57 % Abdeckung selbst in diesen guenstigsten fuenf Koerben — der
  Vergleich kann sich noch verschieben, sobald die Pruefliste weiter bearbeitet
  ist.

**Vor einer Entscheidung Richtung R+F als neuer Lieferant sollte dieser
Preisunterschied mit Patrick besprochen werden** — die Umstellung wuerde nach
aktuellem (unvollstaendigem) Stand die Materialkosten fuer Formteile spuerbar
erhoehen, nicht nur die Erfassung vereinfachen.

## Ursprüngliche Beschreibung des Vorgehens

`tools/vps/rf-zuordnung.mjs` sucht jeden der 393 Artikel per Volltext
(Beschreibung) im R+F-Shop (Playbook `r-f`, Trefferstruktur siehe
lieferanten-shop-zugaenge.md) und bewertet die Top-3-Treffer automatisch:

- **Zahlenvergleich**: jede Zahl aus der GUT-Beschreibung muss im R+F-Text
  vorkommen (Zollmaße wie „1 1/2"" als ein Token, nicht zwei einzelne
  Ziffern — sonst gilt ein 1"-Fitting faelschlich als Treffer für 1 1/2").
- **Gewinderichtung**: „AG"/„IG"/„I/A" auf beiden Seiten muss sich
  überschneiden, wenn beide Seiten überhaupt eine Richtung nennen — ein
  Innengewinde-Fund für ein Außengewinde-Teil gilt nie als sicher.
- **Fachbegriff**: Bauart (T-Stück/Winkel/Bogen/...) muss übereinstimmen.
- GUT-interne Zeichnungscodes (**„P4243G", „P5002"**-Muster) werden vor dem
  Vergleich entfernt — die kommen bei R+F nie vor und würden sonst einen
  sonst perfekten Treffer als „unsicher" markieren.

Einschätzung `sicher` nur, wenn alle drei Kriterien beim besten Kandidaten
erfüllt sind; alles andere `unsicher` (Prüfliste) oder `kein_treffer`. Das
Ergebnis ist bewusst konservativ — lieber ein Artikel zu viel in der
Prüfliste als eine falsche Automatik-Zuordnung, die Formteile mit dem
falschen Gewinde einpreist.

Aufruf (Batch, kann Stunden dauern — läuft als Hintergrundprozess auf dem
VPS):
```
node rf-zuordnung.mjs <artikel.json> <ausgabe.json> [--start N] [--limit N]
```
`<artikel.json>` kommt aus `shop_gut_verbrauch_je_artikel` (Artikelnummer,
Beschreibung, Verbrauchswert). Die Ausgabe wird nach jedem Artikel neu
geschrieben — ein Abbruch verliert nichts Bisheriges.

## Schritt 3 — Materialsystem-Klassifikation

`tools/vps` … eigentlich lokal: `formteil-klassifizieren.mjs` (Skript liegt
im Scratchpad, noch nicht ins Repo übernommen — Kandidat für
`tools/klassifikation/`) ordnet jeden Artikel regelbasiert einer Kategorie
zu:

| Kategorie | Bedeutung | Beispiel |
|---|---|---|
| `formteil` | geht in die Mittelwertbildung ein | Bogen, T-Stück, Übergangsstück, Winkel, Reduzierstück, Verschraubung, Muffe, Stopfen, Nippel, Kupplung |
| `rohr` | bleibt Einzelartikel | Kupferrohr, Verbundrohr |
| `ventil` | bleibt Einzelartikel | Kugelhahn, KFE-/KFR-Ventil, Rückflussverhinderer |
| `daemmung` | bleibt Einzelartikel (pro Meter, kein Stückpreis) | Rohrschale, Isolierschale, Klebeband |
| `schelle_zubehoer` | bleibt Einzelartikel | Rohrschelle, Tauchhülse |
| `sonstiges` | kein Montagematerial im engeren Sinn | Flachheizkörper, Stellmotor |
| `ungeklaert` | manuell prüfen | Exoten ohne klaren Begriff |

Formteile bekommen zusätzlich ein `formteil_system`:

- `b-press-kupfer` (Viega B-press/Profipress, Kupfer)
- `maxipro-kupfer` (Viega/IBP Maxipro, Kupfer)
- `prestabo-stahl` (Viega Prestabo, unlegierter Stahl verzinkt)
- `connect-inox` (CONNECT INOX HEAT, Edelstahl)
- `megapress-stahl` (Viega Megapress, Stahl)
- `uponor-mlc` (Uponor S-Press/MLC, Verbundrohr)
- `gewinde-schwarz` (klassische Gewindefittings „schwarz", Nr.92/130/290/330/331/23-Serie)
- `rotguss-gewinde` (Gewindefittings aus Rotguss/Messing)
- `unbekanntes_system` (ist ein Formteil, aber keinem der obigen zugeordnet — Prüfliste)

**Dimension — wichtiger Korrekturlauf 06.09.2026:** Übergangsstücke und
Reduzierstücke sind 35 % des gesamten Formteil-Werts (107 von 393 Artikeln),
haben aber zwei (T-Stück reduziert: drei) verschiedene Größen — „35mm x 1"AG"
und „35mm x 1 1/4"AG" sind unterschiedliche Teile mit vermutlich
unterschiedlichem R+F-Preis. Die erste Fassung nahm nur die größere Seite und
hätte beide in einen Topf geworfen. Jetzt trägt `dimension` **alle** erkannten
Größen in Erscheinungsreihenfolge, mit „×" verbunden: `35mm×1"AG`,
`35mm×22mm`, `25mm×20mm×25mm` (reduziertes T-Stück), `1 1/2"×1"`. Einfache
Formteile (Bogen, Winkel, gerades T-Stück) haben weiterhin nur eine Größe,
weil im Text nur eine vorkommt.

Stand 06.09.2026 (nach diesem Korrekturlauf): 285 von 393 Artikeln als
Formteil erkannt, verteilt auf acht Systeme; 18 Formteile ohne
Systemzuordnung und 22 ganz ungeklärt bleiben für die manuelle Prüfliste.

**Offene Frage an Patrick:** Soll die Aufmaß-App bei Übergangsstücken/
Reduzierstücken beide Größen abfragen (Monteur wählt „von X nach Y"), oder
reicht eine vereinfachte Erfassung mit nur der Hauptgröße und einem
groben Mittelwert über alle Anschlussvarianten? Die feine Aufschlüsselung
ist jetzt in den Daten vorhanden — die Entscheidung betrifft nur die
Vereinfachung in der Erfassungs-UI (Ziel-Schritt 4).

## Der Mittelwert selbst

Die View `shop_formteil_mittelwert` (Migration
`20260906230000_gut_formteil_klassifikation.sql`) verknüpft Klassifikation,
GUT-Verbrauch und R+F-Preis: `ek_stueck_mengengewichtet` ist der
mengengewichtete R+F-Nettopreis je System+Dimension, `ek_stueck_min/max`
zeigen die Streuung als Warnsignal, wenn eine Gruppe zu grob geschnitten ist.
Erst befüllt, sobald Schritt 2 (R+F-Zuordnung) für genug Artikel steht.

## Offene Punkte für den Feinschliff

- 40 Artikel ohne (sichere) Kategorie/System — Liste bei Bedarf aus
  `shop_gut_artikel_klassifikation where kategorie in ('ungeklaert')
  or formteil_system = 'unbekanntes_system'`.
- Zwei-Dimensions-Formteile (Reduzierstücke, Übergangsstücke): aktuell zählt
  die größere Seite als Gruppenschlüssel — ob das für die Aufmaß-Erfassung
  reicht oder beide Seiten gebraucht werden, ist mit Patrick zu klären.
- `formteil-klassifizieren.mjs` ins Repo übernehmen (aktuell nur im
  Scratchpad), sobald der Klassifikationsschlüssel sich nicht mehr ändert.
