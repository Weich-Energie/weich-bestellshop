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

## Baustellen-Vergleich auf PDS-bestätigt abgeschlossenen Baustellen (Stand 08.09.2026)

Am 08.09.2026 wurden alle 106 Korbnamen lesend gegen PDS abgeglichen
(`tools/vps/korb-pds-abgleich.mjs`, Details und vollständige Tabelle in
[gut-korb-pds-zuordnung.md](gut-korb-pds-zuordnung.md)). 74 Körbe treffen
genau eine Projektakte mit SHK-Auftrag, **58 davon haben eine Schlussrechnung
mit Status „Abgerechnet"** und gelten als abgeschlossen. Die fünf
abgeschlossenen Baustellen mit der größten vergleichbaren Datenbasis:

| Korb | PDS-Auftrag | Formteil-Pos. mit Preis | Alt (GUT) | Neu (Formteil-Mittel) | Abweichung |
|---|---|---|---|---|---|
| Nachkalk Bandl | 2025-10030 | 22/42 | 1.548,95 € | 1.870,68 € | +20,8 % |
| NK Görlich | 2025-10180 | 27/46 | 1.382,31 € | 1.793,72 € | +29,8 % |
| NK Klügl | 2025-10348 | 31/53 | 1.348,97 € | 1.828,30 € | +35,5 % |
| Nachkalk Mäschl | 2025-10023 | 22/38 | 1.292,79 € | 1.571,35 € | +21,5 % |
| Nachkalk Danzl | 2025-10017 | 18/32 | 1.256,50 € | 1.435,47 € | +14,2 % |
| **Summe fünf** | | **120/211** | **6.829,52 €** | **8.499,52 €** | **+24,5 %** |

Über alle 58 abgeschlossenen Körbe: 1097/2001 Formteil-Positionen
vergleichbar (55 %), alt 44.969,39 € → neu 54.770,66 € (**+21,8 %**). Median
je Korb +20,8 %; 45 Körbe werden teurer, 13 günstiger.

**Erklärung der Abweichung** (gilt weiter, aber breiter belegt): Der
Mittelwert je System+Dimension glättet innerhalb einer Gruppe — teure
Formteile (T-Stücke, Übergänge) und billige (Muffen, Kappen) bekommen
denselben Preis. Körbe mit vielen billigen Teilen werden im Modell teurer,
Körbe mit vielen teuren günstiger (z. B. NK Mühleisen −6 %, NK Kührlings
−14 %). Der systematische Aufschlag von rund einem Fünftel kommt aus dem
Preisniveau der R+F-Treffer gegenüber der alten GUT-Kondition und aus der
Markenlastigkeit der bisher „sicher" zugeordneten Artikel (51 % des
Verbrauchswerts). Er ist damit eine Aussage über die Datenbasis, nicht über
die Baustellen — er wird sich bewegen, wenn die Prüfliste abgearbeitet ist.

### Ursprünglicher Vergleich vom 07.09.2026 (vor dem PDS-Abgleich)

Damals war PDS in der Sitzung nicht erreichbar; genommen wurden die fünf
Körbe mit der besten Preisabdeckung, ohne Abschlussnachweis. Von diesen
fünf sind inzwischen NK Klügl (2025-10348) und NK Richter (2025-10212)
PDS-bestätigt abgerechnet; NK Schmidt, NK Bauer Peschk und NK Kohl Auto
bleiben mehrdeutig (Nachnamen mit 23–29 Projektakten).

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

**PDS-Verknüpfung der fünf Körbe (Versuch 07.09.2026 über den lokalen
MCP-Weg):** Die Korbnamen tragen nur Nachnamen, und die sind in PDS
mehrdeutig — „Schmidt" 25 Projektakten, „Kohl" 23, „Richter" 6, „Peschk" keine
(vermutlich anders geschrieben). Einzig „Klügl" ist eindeutig: zwei
Projektakten an derselben Adresse (Kolpingstraße 1, Ammerthal); Auftrag
`2025-10348` (Belegdatum 27.11.2025, ohne PV-Module) dürfte der SHK-Auftrag
zum Korb „NK Klügl" sein. Für die anderen vier muss Patrick den Auftrag
nennen — automatisch ist das nicht sauber zuzuordnen, und zu raten wäre gegen
die Vorgabe des Ziels. Erst mit den Auftrags-UUIDs lässt sich über
`/vorgang/listrechnungen` prüfen, ob abgerechnet.

**Abrechnungsstatus Klügl (geprüft 08.09.2026, `pds_getListRechnungen`):**
Auftrag `2025-10348` („WP Panasonic", Gewerk SHK, Projektakte
`ac73500c-6d09-415a-a677-bd8f23699e70`) hat die Rechnung `202630115`
(Rechnungsart „Rechnung", Status „Abgerechnet", externe Nummer „bezahlt").
Damit ist NK Klügl die erste **PDS-bestätigt abgeschlossene** Baustelle im
Vergleich. Der Auftrag selbst steht in PDS weiter auf „Offen" — der
Vorgangsstatus taugt also nicht als Abschlusskriterium, der Rechnungsstatus
schon. Rechnungssuche nach der Auftragsnummer liefert nichts; gesucht wird
über den Kundennamen, dann über `projektakteUUID` dem Auftrag zugeordnet.
Die drei weiteren Klügl-Rechnungen (202630013, 202630174, 202630366) sind
PV-Abschläge einer anderen Projektakte und gehören nicht zum Korb.

**Vor einer Entscheidung Richtung R+F als neuer Lieferant sollte dieser
Preisunterschied mit Patrick besprochen werden** — die Umstellung wuerde nach
aktuellem (unvollstaendigem) Stand die Materialkosten fuer Formteile spuerbar
erhoehen, nicht nur die Erfassung vereinfachen.

## Warum die Herstellernummer nicht weiterhilft (geprüft 08.09.2026)

Das Ziel nennt „Herstellernummer bzw. Bezeichnung" als Suchweg. Alle 260
noch offenen Artikel tragen im GUT-Export eine `herstellernummer` — aber
das Feld ist ein **Herstellerkürzel** (VIAT01 = Viega, BAGI01, UNHA02 =
Uponor, KAOS01, DEGL01), keine Werks- oder Herstellerartikelnummer. Ein
exakter Abgleich gegen die R+F-„Werks-Nr." ist damit unmöglich. Es bleibt
bei Text-Zuordnung (51,1 % sicher) plus manueller Prüfliste; die offenen
260 Artikel entsprechen 73.506,47 € (48,9 % des Verbrauchswerts).

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

## Verbrauchsanteil je Kategorie (Stand 08.09.2026, alle 106 Körbe)

| Kategorie | Artikel | EK gesamt | Anteil |
|---|---|---|---|
| Formteil (in die Mittelwertbildung) | 285 | 102.795 € | 68,3 % |
| Ventil (Einzelartikel) | 37 | 25.959 € | 17,3 % |
| Dämmung (Einzelartikel) | 20 | 13.757 € | 9,1 % |
| Rohr (Einzelartikel) | 12 | 3.952 € | 2,6 % |
| ungeklärt | 22 | 1.589 € | 1,1 % |
| Schelle/Zubehör | 14 | 1.537 € | 1,0 % |
| Sonstiges | 3 | 854 € | 0,6 % |

Folgerung für die offene Rohrmeter-Frage: Rohre sind 2,6 % des Verbrauchs —
ob sie einen eigenen Kunstartikel je System bekommen oder als bestehende
Katalogartikel referenziert werden, ist finanziell nachrangig. Ventile und
Dämmung wiegen deutlich mehr; sie bleiben laut Ziel Einzelartikel und brauchen
in der App perspektivisch eine Artikelbindung statt Freitext.

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
