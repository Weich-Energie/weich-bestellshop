# Nachkalkulation Klima — Datenmodell

Stand: 22.08.2026. Struktur an einem echten Klima-Auftrag in PDS verifiziert
(Vorgang 2025-10263, rein lesend über `/vorgang/details`). Keine Kundendaten in
diesem Dokument.

## Ausgangsbefund: das Soll enthält keine Materialkosten

Ein Klima-Auftrag ist in PDS so aufgebaut:

```
rootEbene "Leistungsverzeichnis"
└── Ebene "01  Daikin Klima"
    ├── 01.001  Außengerät 2 kW          katalogUUID gesetzt   EK 749,28   VK   999,02   1 Stck
    ├── 01.002  Wandgerät 1,5 kW         katalogUUID gesetzt   EK 462,11   VK   710,96   1 Stck
    ├── 01.003  Rohrpaket im Kabelkanal  katalogUUID NULL      EK   0,00   VK 1.280,00   4 ×
    └── 01.004  Zuleitung im Schachtkanal katalogUUID NULL     EK   0,00   VK 2.500,00  10 ×
```

Die beiden Geräte tragen `katalogUUID`, `masseinheit` und einen echten
Einkaufspreis — sie sind nachkalkulierbar. Die beiden Montagematerial-Positionen
tragen **`katalogUUID: null`, `masseinheit: null` und EK 0,00 €**. Sie sind freie
Textpositionen, keine Katalogbezüge.

Das ist die eigentliche Ursache: Bei einem Auftragsvolumen von 3.780 € Erlös für
Montagematerial steht ein geplanter Materialeinsatz von 0 € gegenüber. Jede
Auswertung zeigt dort 100 % Marge, obwohl Kabelkanal, Kabel, Rohrpakete und
Kleinteile tatsächlich verbaut und bezahlt wurden.

Es fehlt also nicht nur die Ist-Erfassung — auch das Soll hat keinen
Materialkostenanteil. Ein Vergleich Soll-EK gegen Ist-EK wäre deshalb
bedeutungslos.

Nebenbefund: Im Katalog existiert ein Artikel „Rohrpaket im Kabelkanal je
Innengerät (pro laufendem Meter)" (`a8b265d6-…`, EK 8,84 €). Die Auftragsposition
verweist nicht darauf, obwohl der Text bis auf die Gross-/Kleinschreibung von
„meter" identisch ist. Der Katalogbezug wurde beim Anlegen nicht gesetzt.

## Zweites Muster: Montage im Geräte-Verkaufspreis

Auftrag 2025-10313 — der **einzige abgerechnete** der 51 Klima-Aufträge — sieht
völlig anders aus. Er hat gar keine Montageposition:

| Position | katalogUUID | EK | VK |
|---|---|---|---|
| 001 Comfora Außengerät 5,0 kW | gesetzt | 832,07 € | 2.420,00 € |
| 002 Perfera Wandgerät 5,0 kW | gesetzt | 704,27 € | 1.320,00 € |
| **Summe** | | **1.536,34 €** | **3.740,00 €** |

Beim Außengerät stehen 832 € Einkauf gegen 2.420 € Verkauf. Dieser Aufschlag ist
keine Gerätemarge, sondern enthält die Montage — es gibt keine andere Position,
die sie tragen könnte.

## Drittes Muster: Material in einer Leistungsposition

Der Grund für die Unterschiede ist eine geänderte Kalkulationsstruktur (Auskunft
des Betriebs, 22.08.2026):

**Früher** lagen Arbeitszeiten im Gerät — das erklärt Muster B: 832 € Einkauf,
2.420 € Verkauf, ohne dass irgendwo Montage steht.

**Der Workaround** war eine Leistungsposition „Vielen Dank für Ihren Auftrag".
Dahinter standen die tatsächlich verbrauchten Materialien, mit EK als
Einstandspreis des Materials und VK als Verkaufspreis. Damit war ablesbar, wie
der Auftrag gelaufen ist.

**Heute** bekommt der Kunde einen klassischen Aufschlag aufs Produkt und rechnet
Montagestunden und Material getrennt ab. Das Material läuft weiterhin als
Leistungsposition, die alles sammelt, was nicht als eigene Angebotszeile steht.

Damit gibt es drei Erfassungsarten:

| | Kennzeichen | Materialeinstand |
|---|---|---|
| **A** (2025-10263) | freie Textpositionen ohne `katalogUUID` | fehlt, EK 0 |
| **B** (2025-10313) | nur Gerätepositionen | im Geräte-VK versteckt |
| **C** (Workaround) | Position `positionsTyp: LEISTUNG` | **steht im `ekPreis` der Leistung** |

Muster C ist der Glücksfall: dort ist das Ist bereits in PDS erfasst und muss
nicht nachgetragen werden. `pds-auftrag-soll` weist es als
`soll.ist_bereits_erfasst` aus und sagt im Hinweis, welcher Art der Auftrag folgt.

Eine Katalogsuche nach einer Leistung „Vielen Dank" liefert allerdings null
Treffer. Muster C ist an keinem Auftrag belegt; die Logik hängt an `positionsTyp`
und deckt den Fall ab, falls er auftritt.

## Einkaufspreis gleich Verkaufspreis — der Normalfall, nicht der Fehler

Auftrag 2026-127 (belegt 31.03.2026) zeigt, wie neuere Aufträge aussehen. Die
Montagepositionen tragen jetzt einen Katalogbezug — aber sieh auf die Preise:

| Position | Menge | EK | VK |
|---|---|---|---|
| Perfera Außengerät 5,0 kW | 2 Stck | 2.015,14 € | 4.840,00 € |
| Perfera Wandgerät 5,0 kW | 2 Stck | 1.408,54 € | 2.640,00 € |
| Rohrpaket im Kabelkanal | 4 lfm | **320,00 €** | **320,00 €** |
| Zuleitung 230 V inkl. Kanal | 15 lfm | **375,00 €** | **375,00 €** |
| Gerüststellung Klimaanlage | 2 Stck | 0,00 € | 700,00 € |

Bei Rohrpaket und Zuleitung ist der Einkaufspreis gleich dem Verkaufspreis.

**Korrektur vom 02.09.2026:** Daraus wurde hier zunächst geschlossen, der
ausgewiesene Einkaufspreis sei unecht — jemand habe den Verkaufspreis in das
EK-Feld geschrieben. Das war falsch. Am Testartikel nachgemessen: Ein per API mit
4,85 € Einkaufspreis angelegter Artikel erhält die Preisstrategie
`ekEinzelpreis 4.85` gegen `vkEinzelpreis 4.85`. Der Einkaufspreis ist dabei
völlig korrekt — es fehlt nur der Aufschlag.

**`EK = VK` ist in PDS also der Normalzustand jedes Artikels ohne Aufschlag.**
Der Klimarechner rechnet `VK = EK × (1 + Aufschlag)` als Markup, nicht als
Handelsspanne: 30 % auf Geräte, 35 % auf feste Materialien, 100 % auf Verbrauch
und Meterware. Wo diese Aufschläge in PDS nicht als Kalkulationsgruppe
hinterlegt sind, bleibt der Verkaufspreis auf dem Einkaufspreis stehen.

Belastbar bleibt ein anderes Merkmal: Rohrpaket und Zuleitung tragen
`6139e897-1a04-48fa-bdd5-b9ac2e47ebd2` als Lieferanten — **die Weich GmbH
selbst**, in PDS mit der Lieferantennummer 70022. Das sind Eigenleistungen, und
dort ist der „Einkaufspreis" ein interner Satz. Beim Rohrpaket stehen 80 €/lfm,
während der echte Fremdlieferant im Katalog **8,84 €/lfm** führt.

Diese Preisführung ist Vergangenheit (Auskunft des Betriebs, 30.08.2026) — die
alten Angebote wurden so erstellt, und sie bleibt stehen. Für die Nachkalkulation
der Altaufträge folgt daraus die eigentliche Einschränkung: **bei diesen
Positionen ist der Materialeinsatz aus PDS grundsätzlich nicht ableitbar.** Er
muss von den Aufzeichnungen der Monteure oder aus den Lieferantenrechnungen
kommen.

Für die Kennzahl heisst das: Eigenleistungs-Positionen dürfen nicht als
Materialkosten abgezogen werden. Täte man es, würde die Deckung um genau ihren
eigenen Erlös gekürzt und der Auftrag zu schlecht dargestellt. Sie sind als
„Kosten unbekannt" zu führen, nicht als „Kosten gleich Erlös".

Erkannt werden sie an **einem** Merkmal: der eigenen Firma als `lieferantUUID`.
Die Preisgleichheit taugt dafür nicht — sie würde korrekt erfasste
Einkaufspreise verwerfen. Positionen mit echtem Fremdeinkauf und ohne Aufschlag
weist die Funktion getrennt als `positionen.ohne_aufschlag` aus: eine
Kalkulationslücke, kein Datenfehler.

Für 2026-127 ergibt das:

| Grösse | Betrag |
|---|---|
| Auftrag gesamt (VK) | 8.875,00 € |
| − echter Fremdeinkauf (die zwei Geräte) | 3.423,68 € |
| **= nach Fremdeinkauf übrig** | **5.451,32 €** |
| davon als Eigenleistung ausgewiesen | 1.395,00 € Erlös |
| − Ist-Materialeinsatz | zu erfassen |

## Zielbild: der Klimarechner

Der [Klimarechner](../../klimarechner/docs/kalkulationslogik.md) bildet die
Struktur ab, auf die die Aufträge zulaufen sollen: Arbeitszeit getrennt nach
Techniker (75 €/h) und Monteur (69 €/h), Anfahrt nach Zone, vier Pauschalen, und
Material mit **VK = EK × (1 + Aufschlag)** — 30 % auf Hauptkomponenten, 35 % auf
feste Materialien, 100 % auf Verbrauch und Meterware. Material über 40 € VK wird
eigene Zeile, darunter läuft es im Sammelposten „Montagematerial".

Zwei Dinge folgen daraus für dieses Werkzeug:

1. Der Sammelposten „Montagematerial" ist die Fortsetzung von Muster C. Die
   Nachkalkulation muss ihn genauso behandeln.
2. Der Klimarechner hält seine **Standardzeiten je Arbeitspaket ausdrücklich für
   Platzhalter, die „aus echter Nachkalkulation" kommen sollen.** Diese
   Nachkalkulation ist also nicht nur Rückschau, sondern der Datenlieferant für
   die künftige Angebotskalkulation. Das spricht dafür, neben dem Material auch
   die tatsächlichen Stunden je Auftrag zu erfassen.

Bis die Aufträge dem Klimarechner folgen, bleibt es beim Workaround — das
Werkzeug muss deshalb alle drei Muster gleichzeitig aushalten.

## Daraus folgt die Vergleichsgrösse

Eine Kennzahl, die nur die Positionen ohne `katalogUUID` summiert, ist bei den
Mustern B und C null und damit unbrauchbar. Belastbar über alle drei ist:

| Grösse | Quelle | 2025-10313 |
|---|---|---|
| Auftrag gesamt (VK) | Summe aller `vkPreis.gesamtPreis` | 3.740,00 € |
| Geräteeinkauf | `ekPreis` der Positionen mit `katalogUUID` | 1.536,34 € |
| **Nach Geräteeinkauf übrig** | Differenz der beiden | **2.203,66 €** |
| Ist-Materialeinsatz | im Shop erfasste Mengen × EK | zu erfassen |
| **Rest für Lohn und Gewinn** | übrig − Ist | ergibt sich |

„Nach Geräteeinkauf übrig" ist der Betrag, aus dem Material, Lohn und Gewinn
bezahlt werden. Ihm steht der tatsächliche Materialeinsatz gegenüber. Was
bleibt, muss die Arbeitsstunden decken — wird die Zahl negativ, hat allein das
Material den Auftrag aufgezehrt.

Der Montageerlös aus Muster A wird weiter mitgeführt (`soll_erloes_montage`),
aber als Zusatzinformation, nicht als Leitgrösse.

## Status: „abgeschlossen" ist nicht am Status erkennbar

Von den 51 Klima-Aufträgen steht **einer** auf `Abgerechnet` (2025-10313), die
übrigen 50 auf `Offen` — auch solche von Anfang 2025. Der Vorgangsstatus wird
nach dem Bau offenbar nicht durchgängig nachgezogen.

Für das Werkzeug heisst das: die Auswahl „abgeschlossener Auftrag" kann nicht
über `vorgangStatus` laufen. Die Nachkalkulation muss jeden Auftrag zulassen und
den Status nur anzeigen.

Nebenbefund: viele Aufträge sind Mischaufträge — „Klima Daikin (+PV-Anlage mit
Speicher)", „WP Kermi (+Daikin Klima)". Dort enthält der Gesamt-VK auch PV- und
Wärmepumpenanteile, und „nach Geräteeinkauf übrig" ist entsprechend zu lesen.
Diese Aufträge gehören nicht als erste nachkalkuliert.

## Soll-Werte lesen

`POST /vorgang/details` mit `{ uuid, vorgangstyp: "AUFTRAG" }`. Die Positionen
liegen rekursiv in `rootEbene.ebenen[].positionen[]` — bei Klima-Aufträgen
bislang eine Ebene, verlassen darf man sich darauf nicht. Das Sammeln muss
rekursiv über `ebenen` laufen, wie in
`weich-energie-app/supabase/functions/pds-preise` bereits umgesetzt.

Je Position relevant: `nummer`, `kurztext`, `menge`, `masseinheit.bezeichnung`,
`ekPreis.gesamtPreis`, `vkPreis.gesamtPreis`, `katalogUUID`, `positionsTyp`.

Aufträge finden: `POST /vorgang/listauftraege` mit `suchwort`. Eine Suche nach
`Klima` liefert derzeit **51 Aufträge** — das ist der nachzukalkulierende
Bestand, davon einer abgerechnet. Alle tragen das Selektionskriterium `Gewerk: SHK`; ein eigenes Gewerk
Klima gibt es nicht. Filtern lässt sich nur über `suchwort` und `statusUUIDs`,
nicht über Warengruppe oder Gewerk, deshalb bleibt die Trefferliste über den
Auftragstitel eine Heuristik und gehört einmal bestätigt.

Reonic als zweite Soll-Quelle ist noch nicht geprüft. Der PDS-Auftrag trägt die
Soll-Werte bereits vollständig, insofern ist Reonic nicht Voraussetzung.

## Nachweis: Soll gegen Ist an einem abgerechneten Auftrag

Am 31.08.2026 rein lesend an Auftrag **2025-10313** durchgerechnet — dem einzigen
abgerechneten der 51 Klima-Aufträge, Rechnung bezahlt. Ohne Schreibrechte, ohne
Handerfassung, allein aus PDS.

Die Belegkette zur Projektakte:

| Vorgang | Nummer | Datum | Inhalt |
|---|---|---|---|
| Auftrag | 2025-10313 | 04.11.2025 | 2 Geräte, EK 1.536,34 / VK 3.740,00 |
| Bestellung | 2025-50445 | 13.11.2025 | 1 × Comfora Außengerät, **EK 1.650,00** |
| Wareneingang | 2025-60525 | 13.11.2025 | dasselbe Gerät, EK 1.650,00, erledigt |
| Rechnung | 202530582 | 27.12.2025 | VK 3.740,00, bezahlt — **EK weiterhin 832,07** |

### Das Ergebnis

| | kalkuliert | belegt | Abweichung |
|---|---|---|---|
| Comfora Außengerät RXP50N8 | 832,07 € | **1.650,00 €** | **+817,93 €** |
| Perfera Wandgerät FTXM50A | 704,27 € | kein Beleg | offen |
| Erlös (fakturiert und bezahlt) | 3.740,00 € | 3.740,00 € | 0 |
| **Deckung für Montage, Lohn, Gewinn** | **2.203,66 €** | **1.385,73 €** | **−817,93 €** |

Das Außengerät hat fast das Doppelte des kalkulierten Einkaufs gekostet. 37 % der
geplanten Deckung sind damit weg — und in PDS ist das nirgends sichtbar, weil der
`ekPreis` an der Position beim Anlegen kopiert und nie nachgezogen wird. Die
bezahlte Rechnung führt bis heute 832,07 €.

### Wie die Zuordnung funktioniert

`kopplungsID.superKID` ist über die gesamte Kette identisch. Für die
Außengerät-Position lautet er in allen vier Vorgängen
`39468c90-fb76-4f1b-b397-c905d283c6f8`; `kopplungsID` selbst und `kidUrsprung`
wandern mit jedem Beleg weiter, `superKID` bleibt. Damit lässt sich positionsgenau
vergleichen, nicht nur summarisch.

`pds-auftrag-soll` holt deshalb beim Import zusätzlich alle Bestellungen und
Wareneingänge zur `projektakteUUID` und ordnet sie über `superKID` zu. Der
Wareneingang überschreibt die Bestellung, weil er sagt, was tatsächlich geliefert
wurde. Ausgegeben wird je Position `ek_belegt`, `ek_quelle`, `ek_beleg` und
`abweichung`, dazu die Summen als `ist.deckung_ist` und
`ist.abweichung_material`.

### Was das Verfahren nicht sieht

Das Wandgerät hat keine Bestellung zur Projektakte — entweder Lagerware oder
separat ohne Projektaktenbezug beschafft. Solche Positionen behalten den
kalkulierten Wert und werden als `nicht belegt` markiert. Der wahre
Materialeinsatz kann also nur höher liegen, nie niedriger. Diese Positionen sind
die Arbeitsliste für die Handerfassung.

## Ist-Werte erfassen

Eigene Tabellen im Shop, nicht in PDS. Der Kundenauftrag darf nicht verändert
werden: dort steht eine Pauschale, und einzelne Materialpositionen im
Kundendokument wären eine Änderung am Verkaufsdokument.

```
shop_nachkalkulation
  id, pds_vorgang_uuid, pds_vorgangs_nummer, bezeichnung,
  soll_vk_gesamt, soll_ek_geraete, soll_vk_geraete, soll_erloes_montage,
  status (offen | erfasst | geprueft), erfasst_von, erfasst_am

shop_nachkalkulation_positionen
  id, nachkalkulation_id,
  artikel_id  -> shop_artikel      (Katalogbezug, der Regelfall)
  freitext                          (nur wenn es den Artikel im Shop nicht gibt)
  menge, einheit, ek_einzel, ek_gesamt, quelle (monteur | beleg | schaetzung)
```

`ek_einzel` wird beim Erfassen aus `shop_artikel.preis_netto` kopiert, nicht
verknüpft. Ändert sich der Einkaufspreis später, darf eine abgeschlossene
Nachkalkulation sich nicht rückwirkend verschieben.

`quelle` trennt das, was ein Monteur aufgeschrieben hat, von dem, was aus einem
Lieferantenbeleg kommt, und von Schätzungen. Ohne diese Unterscheidung wird eine
grobe Schätzung später wie eine belegte Zahl gelesen.

## Reihenfolge

Die Nachkalkulation setzt den Katalog-Sync voraus: solange die C-Teile nicht als
Artikel im Shop stehen, gibt es nichts auszuwählen. Deshalb:

1. Klima-Warengruppen in PDS anlegen (siehe
   [pds-klima-warengruppen.md](pds-klima-warengruppen.md))
2. Katalog-Sync in Betrieb nehmen (siehe
   [pds-katalog-mapping.md](pds-katalog-mapping.md))
3. Soll-Import je Auftrag, lesend — kann parallel zu 1 und 2 entstehen
4. Ist-Erfassung mit Schnellauswahl aus dem Shop-Katalog
5. Gegenüberstellung Erlös gegen Ist-Materialeinsatz

Schritt 3 ist der einzige, der ohne Schreibrechte und ohne Handarbeit in PDS
sofort gebaut werden kann.

## Offene Entscheidung

Sollen die Montagematerial-Positionen künftig mit Katalogbezug und echtem EK im
Auftrag stehen, statt als Textposition mit EK 0? Das würde die Nachkalkulation
langfristig in PDS selbst möglich machen, ändert aber die Angebotserstellung —
und die Pauschale gegenüber dem Kunden soll bleiben. Betrifft nur neue Aufträge,
nicht die 51 bestehenden.


## Die Klammer zwischen Auftrag und Bestellung: kopplungsID

Am 02.09.2026 gefunden und der Schlüssel zur Automatisierung. Eine
Bestellposition trägt in `kopplungsID.kidUrsprung` **dieselbe ID wie die
Auftragsposition**, aus der sie entstanden ist.

Belegt an Auftrag 2025-10313 und Bestellung 2025-50445:

```
Auftragsposition 001   kopplungsID.kopplungsID  = 39468c90-fb76-4f1b-b397-c905d283c6f8
Bestellposition  001   kopplungsID.kidUrsprung  = 39468c90-fb76-4f1b-b397-c905d283c6f8
```

Damit ist das Ist exakt auf das Soll zuordenbar — Position für Position, ohne
über Namen oder `katalogUUID` zu raten. Die `katalogUUID` taugt dafür nicht: Ein
Artikel kann in einem Auftrag mehrfach vorkommen, und dieselbe Bestellung kann
Material für mehrere Aufträge enthalten (siehe Bestellung 2025-50170, „Für
Stanke, Neubauer, Danzl, Yüzbasioglu, Federer").

Der Weg für den automatischen Ist-Import:

1. Auftrag lesen, Positionen mit ihrer `kopplungsID` merken
2. Bestellungen zur `projektakteUUID` suchen — `/vorgang/listbestellungen` kann
   **nicht** nach Projektakte filtern (nur `suchwort`, `suchfelder`,
   `statusUUIDs`), die Trefferliste muss deshalb clientseitig auf die Projektakte
   eingeschränkt werden
3. Bestellpositionen über `kidUrsprung` den Auftragspositionen zuordnen
4. `ekPreis` der Bestellposition ist der belegte Einkauf, `quelle = 'bestellung'`

## Erstes Ergebnis

| Auftrag 2025-10313, Status Abgerechnet | |
|---|---|
| Erlös | 3.740,00 € |
| Einkauf kalkuliert | 1.536,34 € |
| Deckung kalkuliert | 2.203,66 € |
| Einkauf belegt, Bestellung 2025-50445 | 1.650,00 € |
| davon im Auftrag kalkuliert | 832,07 € |
| **Abweichung** | **+817,93 €** |
| **Deckung tatsächlich** | **1.385,73 €** |

Das Außengerät RXP50N8 war mit 832,07 € kalkuliert und kostete 1.650,00 €. 37 %
der geplanten Deckung sind damit verloren, ohne dass es in PDS auffällt — der
Einkaufspreis an der Auftragsposition wird beim Anlegen kopiert und nie
nachgezogen.

Offen bei diesem Auftrag: Für das Wandgerät FTXM50A (Soll-EK 704,27 €) liegt
keine Bestellposition vor, vermutlich Lagerware. Sein Ist ist unbelegt und in
der Rechnung oben mit dem Soll-Wert angesetzt.

## Die zwei alten Kalkulationsarten, und wie sie vergleichbar werden

Stand 30.09.2026, Vorgabe des Betriebs: Die Altauftraege wurden in **zwei
Versionen** kalkuliert — einmal mit **ausgewiesenen Montagestunden**, einmal mit
den **Montagezeiten im Artikelpreis**. Beide muessen gleichzeitig
nachkalkulierbar sein.

Das ist kein neuer Befund, sondern die Erfassungsmuster oben aus Sicht der
Arbeitszeit. `shop_nachkalkulation.kalkulationsart` haelt es jetzt am Auftrag
fest:

| Wert | Muster | Woran erkennbar | Soll-Stunde |
|---|---|---|---|
| `stunden_ausgewiesen` | A und der heutige Weg | Montageposition ohne `katalogUUID`, oder Eigenleistung | ablesbar |
| `zeit_im_artikel` | B | nur Geraetepositionen, keine Montage | **existiert nicht** |
| `material_in_leistung` | C | Leistungsposition mit echtem `ekPreis` | ablesbar |

Vorbelegt wird der Wert beim Soll-Import aus der Form der Positionen. Ein
erneuter Import ueberschreibt eine von Hand gesetzte Art **nicht** — wie damals
gerechnet wurde, weiss nur der Betrieb.

Die leere Soll-Stunde bei `zeit_im_artikel` ist kein Pflegefehler, sondern die
Kalkulationsart selbst. Die Oberflaeche sperrt das Feld dort, statt es leer
stehen zu lassen.

### Die Bruecke ist der erreichte Stundensatz

Vergleichbar ueber beide Versionen ist nur eine Groesse: **was je geleisteter
Stunde uebrig blieb.** Ob die Montage ausgewiesen war oder im Geraetepreis
steckte — gearbeitet wurde so oder so.

```
Ist-Stunden       = ist_stunden_techniker + ist_stunden_monteur
Lohnkosten        = Stunden x eingefrorener Satz (75 / 69 EUR/h, Klimarechner)
Ergebnis          = rest_fuer_lohn - Lohnkosten
erreicht je Std   = rest_fuer_lohn / Ist-Stunden
```

`rest_fuer_lohn` allein sagt nur, wieviel Geld nach dem Material uebrig war —
nicht, ob es gereicht hat. Erst mit den Stunden wird daraus eine Aussage. Und
genau diese Zahl ist der Ruecklauf in die Angebotskalkulation: der Klimarechner
haelt seine Standardzeiten ausdruecklich fuer Platzhalter, die „aus echter
Nachkalkulation" kommen sollen.

Die Saetze werden am Auftrag **eingefroren**, aus demselben Grund wie `ek_einzel`
an der Position: eine spaetere Satzaenderung darf eine abgeschlossene
Nachkalkulation nicht rueckwirkend verschieben.

`stunden_quelle` trennt `zettel` von `zeiterfassung` und `schaetzung`. Ohne die
Trennung liest sich eine Schaetzung spaeter wie eine gemessene Zahl.

## Aufmasszettel als Foto — die Uebergangsloesung

Bis das Aufmass durchgaengig in der App erfasst wird (Gewerk `klima` in
`weich-aufmass`, live seit 30.09.2026), bleiben die Altauftraege auf Papier. Der
Zettel wird fotografiert, `shop-ai` liest ihn mit dem Task `extract_aufmass`, ein
Mensch bestaetigt.

```
shop_aufmass_foto        eine Seite: bild_pfad (Bucket shop-belege, Praefix aufmass/),
                         status neu | laeuft | gelesen | uebernommen | fehler
shop_aufmass_foto_zeile  was gelesen wurde: roh_artikelnr, roh_bezeichnung,
                         roh_menge, sicherheit, artikel_id, treffer_art,
                         status offen | uebernommen | verworfen, position_id
```

Drei Dinge, die den Ausschlag geben:

1. **Nur die Handschrift zaehlt.** Der Vordruck ist ein Shop-Ausdruck und traegt
   in jeder Mengenzeile eine gedruckte 1 — ein Kopierrest. Der Prompt sagt das
   ausdruecklich; eine ungeprueft uebernommene Seite saehe sonst vollstaendig aus
   und waere falsch.
2. **Der Bestaetigungsschritt bleibt.** Handschrift wird verwechselt (1/7, 4/9,
   0/6). Die KI gibt je Zeile eine Lesesicherheit an; unter 0,8 wird die Zeile
   markiert. Deshalb liegen die gelesenen Zeilen in einer eigenen Tabelle und
   nicht gleich in `shop_nachkalkulation_positionen`.
3. **Der Katalog wird mitgegeben.** Die Artikel mit `nachkalkulation_klima` gehen
   als Abgleichliste in den Prompt. Das Modell muss die Nummer dann nicht raten,
   sondern wiedererkennen.

### Nebenprodukt: der Artikelstamm waechst mit

Zeilen ohne `artikel_id` sind kein Fehler, sondern die **Arbeitsliste fuer den
Artikelstamm der Aufmass-App**: was dort auftaucht, wurde in den letzten Monaten
verbaut und fehlt im Katalog. Sie gehen als Freitext in die Nachkalkulation, damit
die Summe stimmt, und bleiben sichtbar, bis der Artikel angelegt ist
(`nachkalkulation_klima` + `sichtbar_aufmass`). Ueber die nachkalkulierten
Altauftraege entsteht so nebenbei der Stamm, den die App braucht.

## Nachtrag 30.09.2026: das Soll kommt oft aus dem Reonic-Angebot

Patricks Vorgabe: „auftrag holen muss aber im prinzip das reonic angebot holen
weil oft der auftrag noch nicht gefuellt ist". Der Satz weiter oben — „Der
PDS-Auftrag traegt die Soll-Werte bereits vollstaendig, insofern ist Reonic nicht
Voraussetzung" — ist damit **ueberholt**.

`soll_quelle` haelt fest, woher die Zahlen kommen: `pds`, `reonic_angebot` oder
`hand`. Sie sehen gleich aus und sind verschieden belastbar; ein Angebot ist noch
kein Auftrag. `pds_vorgang_uuid` ist dafuer **nullable** geworden, der
Eindeutigkeitsschluessel ein partieller Index — mehrere Baustellen ohne
PDS-Vorgang muessen nebeneinander stehen koennen.

### Warum das Angebot als PDF hereinkommt und nicht per API

Die Reonic-API ist aus der Cloud nur eingeschraenkt erreichbar. `weich-api` auf
dem VPS haelt die Schluessel und macht die lesenden Aufrufe; so laeuft es beim
BzA-Assistenten (`weich-energie-app/supabase/functions/bza-reonic`). Dieselbe
Function schreibt die KfW-Nummer allerdings **direkt** gegen `api.reonic.de` —
entweder ist die Sperre also nicht durchgaengig, oder der Kommentar ist aelter
als der Code. Das gehoert geprueft, bevor jemand die VPS-Kette baut.

Bis dahin: Angebot als PDF hochladen, dieselbe Strecke wie die Zettel. Kein
neuer Dienst, heute einsetzbar. `uebernimmAngebot()` setzt daraus die
Soll-Werte und leitet die Kalkulationsart ab — stehen ausser Geraeten noch
Montage- oder Materialpositionen darin, waren die Stunden ausgewiesen; stehen
nur Geraete darin, steckte die Zeit im Geraetepreis.

**Was das Angebot nicht hergibt, sind die Einkaufspreise.** Geraetepositionen
ohne `ek_gesamt` werden gezaehlt und angezeigt, nicht als 0 gefuehrt — sonst
faellt die Deckung zu hoch aus.

## Drei Sorten Blatt, ein Upload

`shop_aufmass_foto.blatt_art` unterscheidet `material`, `stunden` und `angebot`.
Die KI bestimmt die Art selbst und fuellt nur den passenden Abschnitt ihres
Schemas; bestaetigt wird von Hand, weil eine falsch einsortierte Seite still in
die falschen Felder liefe.

Beim **Stundenzettel** bleibt eine Zuordnung uebrig, die kein Blatt hergibt: wer
Techniker ist und wer Monteur. Der Unterschied sind 6 EUR die Stunde. Die
gelesenen Zeilen liegen deshalb als `stunden_gelesen` (jsonb) am Foto und laufen
erst nach der Zuordnung in `ist_stunden_techniker` / `ist_stunden_monteur` —
addiert, weil ein Auftrag mehrere Zettel hat.

## Erfassen und Pruefen sind getrennt

`/zettel` ist die Handy-Seite: Baustelle waehlen (oder neu anlegen),
fotografieren, fertig. `capture="environment"` bringt auf dem Telefon direkt die
Kamera statt der Galerie. Gelesen wird sofort — ein unscharfes Foto faellt so auf
der Baustelle auf und nicht drei Wochen spaeter.

Das Durchgehen der Zeilen bleibt auf `/admin/nachkalkulation`, wo man beim
Nachkalkulieren ohnehin sitzt. Die Tabellen dort haben 680 bis 860 Pixel
Mindestbreite und sind auf dem Telefon nicht zu bedienen — das ist der Grund fuer
die Trennung, nicht Geschmack.
