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

## Daraus folgt die Vergleichsgrösse

Nicht Soll-EK gegen Ist-EK, sondern **Erlös gegen tatsächlichen Materialeinsatz**:

| Grösse | Quelle | Beispiel oben |
|---|---|---|
| Erlös Montagematerial | Summe `vkPreis.gesamtPreis` der Positionen ohne `katalogUUID` | 3.780,00 € |
| Ist-Materialeinsatz | Summe der im Shop erfassten Mengen × EK | zu erfassen |
| Deckungsbeitrag Montage | Erlös − Ist | ergibt sich |
| Gerätemarge | `vkPreis` − `ekPreis` der Positionen mit `katalogUUID` | 498,59 € |

Die Gerätemarge steht bereits belastbar in PDS. Der Montageteil ist das, was das
Werkzeug beitragen muss.

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
Bestand. Alle tragen das Selektionskriterium `Gewerk: SHK`; ein eigenes Gewerk
Klima gibt es nicht. Filtern lässt sich nur über `suchwort` und `statusUUIDs`,
nicht über Warengruppe oder Gewerk, deshalb bleibt die Trefferliste über den
Auftragstitel eine Heuristik und gehört einmal bestätigt.

Reonic als zweite Soll-Quelle ist noch nicht geprüft. Der PDS-Auftrag trägt die
Soll-Werte bereits vollständig, insofern ist Reonic nicht Voraussetzung.

## Ist-Werte erfassen

Eigene Tabellen im Shop, nicht in PDS. Der Kundenauftrag darf nicht verändert
werden: dort steht eine Pauschale, und einzelne Materialpositionen im
Kundendokument wären eine Änderung am Verkaufsdokument.

```
shop_nachkalkulation
  id, pds_vorgang_uuid, pds_vorgangs_nummer, bezeichnung,
  soll_erloes_montage, soll_ek_geraete, soll_vk_geraete,
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
