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

## Der eigentliche Stolperstein: Einkaufspreis gleich Verkaufspreis

Auftrag 2026-127 (belegt 31.03.2026) zeigt, wie neuere Aufträge aussehen. Die
Montagepositionen tragen jetzt einen Katalogbezug — aber sieh auf die Preise:

| Position | Menge | EK | VK |
|---|---|---|---|
| Perfera Außengerät 5,0 kW | 2 Stck | 2.015,14 € | 4.840,00 € |
| Perfera Wandgerät 5,0 kW | 2 Stck | 1.408,54 € | 2.640,00 € |
| Rohrpaket im Kabelkanal | 4 lfm | **320,00 €** | **320,00 €** |
| Zuleitung 230 V inkl. Kanal | 15 lfm | **375,00 €** | **375,00 €** |
| Gerüststellung Klimaanlage | 2 Stck | 0,00 € | 700,00 € |

Bei Rohrpaket und Zuleitung ist der Einkaufspreis gleich dem Verkaufspreis. Die
Ursache steht im Katalog: der Artikel „Zuleitung(230V) inkl. Kanal"
(`24c0ee16-…`) führt `ekEinzelpreis 25.00` gegen `vkEinzelpreis 25`, und sein
einziger Lieferanteneintrag ist `6139e897-1a04-48fa-bdd5-b9ac2e47ebd2` — **die
Weich GmbH selbst**, in PDS als Lieferant mit der Nummer 70022 angelegt.

Diese Positionen sind Eigenleistungen. Ihr ausgewiesener „EK" ist der
Verkaufspreis, kein Einstandspreis. Was das ausmacht, zeigt derselbe Artikel
zweimal: das Rohrpaket steht im Auftrag mit 80 €/lfm als Einkauf, während der
Katalog beim echten Fremdlieferanten **8,84 €/lfm** führt. Bei 4 lfm sind das
35,36 € tatsächliche Kosten gegenüber 320 € ausgewiesenen.

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

Erkannt werden sie an zwei Merkmalen — eigene Firma als `lieferantUUID`, oder
`ekPreis` gleich `vkPreis` bei EK über null. Die Funktion weist sie getrennt als
`positionen.eigenleistung` aus, mit dem Grund je Zeile.

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
