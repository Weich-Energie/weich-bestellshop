# PDS-Katalog-Mapping — Shop-Artikel nach PDS übertragen

Stand: 22.08.2026. Alle UUIDs live aus dem PDS-Mandanten gelesen (nur lesende
Operationen). Grundlage für den Sync `shop_artikel` → PDS-Katalogeintrag.

## 1. Die Schreib-Operationen (Whitelist)

| Reihenfolge | Operation | Pfad | Zweck |
|---|---|---|---|
| 1 | `pds_createKatalogEintrag` | `POST /katalog/create` | Artikel anlegen, liefert `uuid` |
| 2 | `pds_createLieferantEintrag` | `POST /katalog/addlieferanteneintrag` | Bestellnummer, EK-Preis, Gebinde |
| 3 | `pds_updateKatalogEintragAbbildung` | `POST /katalog/updateAbbildung` | Produktbild — **braucht multipart, siehe unten** |
| 4 | `pds_updateKatalogEintrag` | `POST /katalog/update` | Bestandsartikel korrigieren und umhängen, siehe 5. |

Pflichtfelder: `create` braucht nur `name` + `typ`. `addlieferanteneintrag`
braucht `katalogUUID` + `lieferantUUID`. `update` braucht `uuid`.

**Seit 01.09.2026 freigegeben.** `api_details` meldet für die schreibenden
Operationen `deaktiviert: false`. Der MCP-Server kennt zusätzlich das Feld
`loeschoperation`; bei `/katalog/delete` steht es auf `true`, die Sperre dafür
ist aber standardmäßig aus — Löschen wäre also technisch möglich und bleibt
Handarbeit im PDS-Client.

**`/katalog/update` ist ein echtes Teilupdate.** Am 01.09.2026 verifiziert: Ein
Aufruf mit nur `uuid`, `warengruppeUUID` und `kategorieUUID` lässt alle übrigen
Felder unverändert — Langtext mit mehrzeiliger Leistungsbeschreibung,
Einkaufs- und Verkaufspreis, Maßeinheit, MwSt-Typ und sämtliche
Lieferanteneinträge. Für Massenänderungen genügt deshalb ein Aufruf je Artikel;
die Felder vorher zu lesen und mitzusenden ist nicht nötig.

## 2. Feld-Mapping `shop_artikel` → `/katalog/create`

| PDS-Feld | Quelle im Shop | Anmerkung |
|---|---|---|
| `name` | `shop_artikel.name` | |
| `typ` | fest `ARTIKEL` | |
| `suchwort` | `shop_artikel.name` | Hauspraxis: identisch mit kurztext |
| `kurztext` | `shop_artikel.name` | |
| `langtext` | `shop_artikel.beschreibung` | |
| `massEinheit` | `shop_artikel.einheit`, normalisiert | **String, nicht UUID** — siehe 3. |
| `preisEinheit` | fest `1` | |
| `kategorieUUID` | Mapping-Tabelle | siehe 4. |
| `mwstTypUUID` | fest `67ea2b65-ba85-4023-9296-a53ad35a5865` | „Allgemein" = 19 %. **Nicht** die PV-0-%-Gruppe |
| `warengruppeUUID` | Mapping-Tabelle | siehe 5. |
| `erloesgruppeUUID` | Hersteller oder `627ce5ee-…` | Erlösgruppe = Herstellerdimension, siehe 6. |
| `kostengruppeUUID` | **leer lassen** | im Mandanten durchgängig ungepflegt |
| `kalkulationsgruppeUUID` | aus `shop_artikel.aufschlagsklasse` | siehe 12. — ohne Gruppe setzt PDS VK = EK |
| `kostenart*UUID` | **leer lassen** | durchgängig ungepflegt |
| `gewicht` | — | Shop führt es nicht |

## 3. Maßeinheiten — Normalisierung nötig

Der Mandant führt vier Stück- und vier Meter-Varianten parallel:

| Bezeichnung (String für die API) | UUID | dbid |
|---|---|---|
| `Stck` | `a41d7bb2-4f47-4e54-9fb6-e9e798d8d831` | 68802 |
| `Stück` | `20209a97-d94d-4cdd-9da5-db4361b4d50f` | 927201 |
| `Stk` | `59a91a75-1c37-48a1-b971-f50929fcf8d7` | 6651002 |
| `PCE` | `8095e004-a4b1-49c5-81d2-04cbcc6d2d21` | 7902201 |
| `m` | `de9e3758-c933-47cd-8e74-64f37d8b9077` | 68804 |
| `lfdm` | `19522612-d60f-40bb-849a-46e4acaf1093` | 68805 |
| `lfm` | `597869b4-936d-45fb-8c82-665269cefeaa` | 6651001 |
| `MTR` | `82d5a24b-13a1-4963-86c3-fa0ce4b0c961` | 7902202 |
| `Rolle` | `4194ce3e-e095-4fbe-824c-02b659ad4671` | 2950402 |
| `Geb` | `84fd815c-3de6-40bf-97f5-fe7c42da4f26` | 68811 |

**Festlegung für den Sync.** Der Shop behält seine Konvention — der
Artikel-Dialog normalisiert Eingaben auf die ausgeschriebene deutsche Form
(„Im Katalog soll durchgehend die korrekte deutsche Schreibweise stehen",
`src/app/components/ArtikelDialog.jsx`). Übersetzt wird erst beim Übertragen,
über `shop_pds_einheiten`:

| Shop | PDS |
|---|---|
| Stück | `Stck` |
| Meter | `m` |
| Laufmeter | `lfm` |
| Packung, Karton, Beutel | `Geb` |
| Rolle | `Rolle` |
| Kilogramm | `kg` |
| Satz | `SET` |

Liter, Dose, Kanister und Paar kennt der Shop ebenfalls, PDS hat dafür keine
Maßeinheit. Sie bleiben ohne Zuordnung, damit der Sync eine Lücke meldet statt
auf `Stck` auszuweichen und die Menge zu verfälschen.

Migration 010 hält dieselbe Zuordnung als Trigger auf `shop_artikel` vor, mit
den Schreibweisen aus Lieferantenrechnungen (`ST`, `STK`, `MTR`, `lfdm`) als
Aliasse — für alle Anlagewege, die den Dialog nicht durchlaufen.

## 4. Kategorien — es gibt keine Klima-Kategorie

Baum, Stand heute:

```
Kategorien (efa7bec0-1a74-43b3-a44b-182b4d7b8472)
├── PV                             2ce9e895-e208-483a-9cc5-36227096a209
├── SHK                            75d209ad-7271-4705-ae9b-219b9d5ac7cd
│   └── Handelsware                5ca45614-4f68-43d9-9ac2-6aa4df5a4b74
│       ├── 1-Wärmepumpe           f10944ab-c6e6-4a2d-838a-abbe5d969148
│       ├── 2-Wärmepumpen Zubehör  6db38b3d-22e2-483d-8cfe-f920d34324f8
│       ├── 3-                     5183cfb4-7cda-45f4-8f14-2c0b1c879bc4   ← frei
│       ├── 4-SHK-Zubehör          9c454c8d-73d1-4aad-a86c-a259417c2a23
│       ├── 5-SHK-Dienstleistungen 1b1c6ae5-e1bd-44fc-8956-8e4358280134
│       ├── 6-                     639f5e8b-d214-4bee-ade9-40d987eb666a   ← frei
│       ├── 8-SHK-Installationsmat 4e84d95e-3881-4733-8444-56eea6f6f71c
│       ├── 9-                     659cb6e9-56d8-4c43-bde6-d3c8f7fd47f8   ← frei
│       └── 10-SHK-Sonstiges       cd58e67d-7fc9-473e-ac77-61f1677a3f2c
├── Dienstleistungen & Fahrtkosten 6d397907-705a-4a57-8cc7-031137faccfa
├── Produktionsmaterial            1704d3c1-bb7b-4b9d-8aa6-79cfca42fc57
└── Sonstiges                      7f9df04f-67f4-4547-bf77-9d4b13c669fb
```

Unter `1-Wärmepumpe` liegt eine Hersteller-Ebene: `Bosch`
`e567b31b-0f32-4707-ab58-e8553c22001f`, `Daikin`
`f8011f15-ff83-49fd-b947-204c9e84fe35`, `Panasonic`, `Buderus`, `Kermi`. Das
Muster ist also **Bereich > Handelsware > Produktgruppe > Hersteller**, während
die Warengruppe die kalkulatorische Dimension trägt.

Die Daikin-Klimageräte hängen heute in dieser Kategorie `Daikin` unter
`1-Wärmepumpe` — sie sind damit auch in der Kategoriestruktur als Wärmepumpe
eingeordnet.

**Die Katalog-API kann keine Kategorien anlegen** — es gibt nur
`listkategorien` und `kategoriedetails`. Die Klima-Struktur wurde deshalb am
30.08.2026 von Hand in PDS erstellt:

```
Klima                        a9809a4d-bf51-439d-936e-1f4e76be6606
└── Handelsware              1b8ee957-5fb0-4ed6-8f48-d91868f1945c
    ├── 1-Außengerät         5f0f5b0f-…   → Daikin / Panasonic / Bosch
    ├── 2-Innengerät         9b7fa267-…   → Daikin / Panasonic / Bosch / Remko
    ├── 3-Installationsmaterial  899522b5-…
    ├── 4-Zubehör            902aab52-…   → Daikin / Panasonic / Bosch
    └── 5-Dienstleistungen   215db8a6-…
```

Vollständig mit allen Hersteller-UUIDs in
[pds-klima-warengruppen.md](pds-klima-warengruppen.md), maschinenlesbar in
[pds-klima-umzug.json](pds-klima-umzug.json).

## 5. Warengruppen — eigener Klima-Bereich nötig

26 Warengruppen, durchgängig mit Präfix `(PV)`, `(SHK)` oder `zn.L`. Bestehende,
für Klima heute genutzte Gruppen:

| Bezeichnung | UUID |
|---|---|
| `(SHK)Wärmepumpe` | `2bbf9c2d-08c4-402d-a6fd-1170c21033a5` |
| `(SHK)Installationsmaterial` | `dca773ae-4c27-4195-8243-a7c1252f4efb` |
| `zn.L Installationsmaterial` | `f9a0b411-c77f-4063-a205-77e0d07ef5fb` |
| `zn.L SHK Installationsmaterial` | `28d4bbc1-5ad3-4f3e-a723-7fa7c9f31554` |
| `zn.L Sonstiges` | `40c85994-6814-45b9-b217-cd349dbcef14` |

### Das Problem

Klimageräte liegen heute in `(SHK)Wärmepumpe` — dieselbe Warengruppe wie echte
Wärmepumpen. Beispiele: `FTXJ35AB9` (Daikin Emura Wandgerät 3,5 kW),
`FTXA20CB` (Split IG Wandgerät) stehen neben `EBLA06E3V3` (Altherma 3 M
Außengerät) und `ERRA12EW1` (Altherma 3 R MT). Klima-Zubehör wie `BRC1H52K`
(Fernbedienung Madoka) und `BYCQ140EB` (Geräteblende) liegt in
`(SHK)Installationsmaterial`.

Solange das so ist, lässt sich der Geschäftsbereich Klima weder auswerten noch
nachkalkulieren — jede Abfrage vermischt ihn mit SHK.

### Vorschlag: vier Klima-Warengruppen

Der Schnitt folgt bewusst der Struktur der Soll-Werte aus Reonic bzw. dem
PDS-Vorgang (Außeneinheit + Inneneinheiten + Montagematerial-Pauschale). Dann
ist die Nachkalkulation eine Gruppierung über die Warengruppe, ohne Sonderlogik:

| Neue Warengruppe | Inhalt |
|---|---|
| `(KLIMA)Außengerät` | Außeneinheiten Split und Multisplit |
| `(KLIMA)Innengerät` | Wandgeräte, Truhen, Kanalgeräte, Kassetten |
| `(KLIMA)Installationsmaterial` | Kabelkanal, Kabel, Rohrpakete, Kondensatleitung, Wandhalter, C-Teile aus dem Shop |
| `(KLIMA)Zubehör` | Fernbedienungen, Blenden, WLAN-Module |

Die drei ersten Gruppen entsprechen genau den drei Soll-Positionen. Die vierte
trennt Zubehör ab, das sonst die Materialquote verfälscht.

Warengruppen sind per API **nur lesbar**. Die fünf wurden am 30.08.2026 von Hand
angelegt:

| Warengruppe | UUID |
|---|---|
| `(KLIMA)Außengerät` | `481913dd-4d65-4948-ad77-46c5e3d0092b` |
| `(KLIMA)Innengerät` | `7c3c5a86-b1e9-40fa-bf31-2a3482d2e417` |
| `(KLIMA)Installationsmaterial` | `2b2e46ea-de62-4d8f-b694-04355bf4d3dc` |
| `(KLIMA)Zubehör` | `d82c6990-55eb-46ae-9ca3-4c3bb8b60f67` |
| `(KLIMA)Dienstleistungen` | `36d66850-2d4a-4402-8754-f0c770108fc6` |

Für neue C-Teile aus dem Shop ist `(KLIMA)Installationsmaterial` die Zielgruppe.

### Bestand umhängen: geht per API

`pds_updateKatalogEintrag` (`POST /katalog/update`) kann `warengruppeUUID` und
`kategorieUUID` setzen. Die vorhandenen Klima-Artikel lassen sich damit nach dem
Anlegen der Gruppen automatisiert umhängen, statt von Hand. Voraussetzung ist
eine geprüfte Liste, welcher Artikel Klima ist und welcher Wärmepumpe —
`Emura`, `Split`, `Sky Air` gegen `Altherma`. Diese Liste gehört vor dem
ersten Update-Aufruf einmal durchgesehen, denn `update` überschreibt ohne
Rückfrage.

Damit umfasst die Whitelist aus Abschnitt 1 eine vierte Operation.

## 6. Erlösgruppen sind Hersteller

Von 63 Erlösgruppen sind praktisch alle Herstellernamen (AIKO, Sungrow, Kostal,
Fega & Schmidt …). Für Klima relevant:

| Bezeichnung | UUID |
|---|---|
| `Daikin` | `cc49f71d-1400-4168-8b26-5f122ff502fc` |
| `Weich GmbH` | `627ce5ee-bddf-4a05-a377-668b50ae8910` |
| `0 Allgemein` | `e1c0f458-50db-4185-a93f-d52e10e2761b` |

Regel: Markenartikel auf den Hersteller, eigene Leistungen und namenlose
C-Teile auf `Weich GmbH`.

## 7. Sonstige Stammdaten

MwSt-Typen: `Allgemein` `67ea2b65-…`, `Ermäßigt` `2427c06a-…`, `Frei`
`8dc0d509-…`, `13b UStG` `15b9d99e-…`, `PV 0,00 % USt.` `0080ff24-…`.

Kostengruppen: nur `Dienstleistungen` `e017fc1f-…` und `0 Allgemein`
`43e714e1-…`. Kalkulationsgruppen: nur `0 Allgemein` `243897cf-…`.

## 8. Lieferanten

| Shop-Slug | PDS-Person | Lieferantennummer |
|---|---|---|
| `frigotechnik` | `abafc5f5-4182-40b0-8448-26020180eef5` | 70101 |

Weitere Shop-Lieferanten (Conrad, Reichelt) sind in PDS noch nicht als
Lieferant geprüft. `shop_lieferanten` braucht eine Spalte für die PDS-UUID.

## 9. Feld-Mapping `/katalog/addlieferanteneintrag`

| PDS-Feld | Quelle im Shop |
|---|---|
| `katalogUUID` | Rückgabe aus Schritt 1 |
| `lieferantUUID` | `shop_lieferanten.pds_person_uuid` |
| `bestellnummer` | `shop_artikel.artikelnr` |
| `eanNummer` | — (Shop führt es noch nicht) |
| `herstellernummer` | — (Shop führt es noch nicht) |
| `verpackungsmenge` | `shop_artikel_gebinde.stueckzahl` (Default-Gebinde) |
| `mindestbestellmenge` | — |
| `einkaufspreis.standardpreis` | `shop_artikel.preis_netto` |
| `einkaufspreis.preiseinheit` | fest `1` |
| `standard` | `true` beim ersten Eintrag |

## 10. Was die API nicht kann

- **Kein VK-Preis, und keine Preisstrategie.** Weder `create` noch `update`
  haben ein Preisfeld. Der EK geht ausschließlich über `einkaufspreis` am
  Lieferanteneintrag.

  Am 01.09.2026 am Testartikel `ZZ-TEST Kabelkanal 60x40 weiß`
  (`1f2f1b0a-2e45-40b5-b1f8-cfea3134e711`) nachgemessen: Nach `create` **und**
  `addlieferanteneintrag` mit 4,85 € Einkaufspreis bleibt `preisStrategien` am
  Artikel **leer**. Bei gepflegten Bestandsartikeln steht dort ein Paar aus
  `ekEinzelpreis` und `vkEinzelpreis` (Beispiel Bosch CL5000M: 1.140,35 gegen
  1.520,43). Der Lieferanten-EK wandert also nicht von selbst in die
  Preisstrategie des Artikels.

  Folge für den Sync: Ein per API angelegter Artikel ist **bestellbar**, aber
  **nicht verkaufsfähig kalkuliert**. Die Preisstrategie muss in PDS gesetzt
  werden. Für C-Teile, die nur im Montagematerial aufgehen, ist das
  verschmerzbar — für alles, was als eigene Angebotsposition erscheinen soll,
  nicht. Das gehört in die Übergabe an den Betrieb.
- **Keine Kategorien und Warengruppen anlegen.** Siehe 4. und 5.
- **Löschen nur eingeschränkt.** `/katalog/delete` greift laut Beschreibung nur
  ohne Bestand und ohne andere Verwendung. Eine falsch angelegte Dublette
  bleibt also im Stamm stehen — deshalb ist Idempotenz Pflicht, nicht Komfort.

## 11. Referenzbeispiele aus dem Mandanten

Sauber gepflegt — `Fensterbankkanal PFB 60110`
(`de97aeb4-d6ce-4940-a3d8-3d955bbc6691`): Kategorie
`8-PV-Installationsmaterial`, Warengruppe `zn.L Installationsmaterial`,
Erlösgruppe `Fega & Schmidt`, `massEinheit: m`, Lieferanteneintrag mit
Bestellnummer `050471` und EK 6,83 €.

Klima-Dummy — `Rohrpaket im Kabelkanal je Innengerät (pro laufendem Meter)`
(`a8b265d6-2d02-4d05-8931-bb09bc89a8e9`): `kategorie: null`, zwei
Lieferanteneinträge mit widersprüchlichen EK-Preisen (8,84 € und 80,00 €), einer
davon mit dem vollständigen Artikelnamen im Feld `bestellnummer`. Das ist der
Zustand, den dieser Sync ersetzen soll.


## 12. Aufschlag: die Kalkulationsgruppe

PDS erzeugt die Preisstrategie aus dem Standard-Lieferanteneintrag und setzt
dabei **VK = EK**. Ein per API angelegter Artikel ist also bestellbar, aber ohne
Aufschlag kalkuliert.

Der Klimarechner rechnet `VK = EK × (1 + Aufschlag)`, ausdrücklich als Markup und
nicht als Handelsspanne
([kalkulationslogik.md](../../klimarechner/docs/kalkulationslogik.md)):

| Klasse im Shop | Aufschlag | Inhalt |
|---|---|---|
| `haupt` | 30 % | Geräte — der Kunde vergleicht online |
| `fest` | 35 % | Konsole, Pumpe, Reparaturschalter, Ständer, Dämpfer |
| `verbrauch` | 100 % | Leitungen, Kanal, Schutzschlauch, Fittings — deckt Verschnitt |

Migration 011 legt `shop_pds_kalkulationsgruppen` an und ergänzt
`shop_artikel.aufschlagsklasse`. Im Artikel-Dialog steht dafür ein Auswahlfeld;
ohne Angabe wird keine Gruppe mitgegeben und es bleibt bei VK = EK.

Die Klasse hängt **am Artikel, nicht an der Kategorie** — in „Klima" liegen sowohl
der Dämpfungssockel (`fest`) als auch Kabelkanal (`verbrauch`).

### In PDS angelegt (02.09.2026)

Die drei Kalkulationsgruppen existieren, als **Aufschlag** auf den EK angelegt —
nicht als Spanne. Der Unterschied ist bei gleichen Prozentzahlen erheblich:
30 % Aufschlag auf 100 € ergibt 130 €, 30 % Spanne dagegen 142,86 €.

| Klasse | PDS-Bezeichnung | UUID |
|---|---|---|
| `haupt` | `(KLIMA)Haupt 30%` | `f0e86848-108f-4d24-8565-6c8ef51f1ed2` |
| `fest` | `(KLIMA)Fest` | `ee1b48a0-3b06-40a8-965c-d2158c70af43` |
| `verbrauch` | `(KLIMA)Verbrauch` | `9cb6fc8d-7332-4fb9-b189-2574fd57c185` |

Die UUIDs stehen in `shop_pds_kalkulationsgruppen.pds_uuid`; der Sync gibt sie
seit dem an `create` mit. Die API konnte die Gruppen weder anlegen noch ihre
Sätze lesen — `listkalkulationsgruppen` liefert nur Bezeichnungen.

### Die Gruppe rechnet nicht in den Katalog-VK

Am 02.09.2026 am Testartikel geprüft: Nach dem Setzen von `(KLIMA)Verbrauch`
(100 %) blieb `vkEinzelpreis` auf dem EK. Auch eine anschliessende Änderung des
Lieferanten-EK von 4,85 auf 4,86 ergab `ekEinzelpreis 4.86 / vkEinzelpreis 4.86`
— kein Aufschlag.

Die Kalkulationsgruppe wirkt also **nicht auf die Preisstrategie am Artikel**.
Zwei Erklärungen sind möglich, und die API kann sie nicht unterscheiden:

1. Die Gruppe greift erst beim Einsetzen in einen Vorgang — dann rechnet PDS den
   Positions-VK aus EK und Gruppe, während der Katalog-VK unberührt bleibt.
2. In der Gruppe ist kein Aufschlagssatz hinterlegt, nur die Bezeichnung.

**Im PDS-Client geprüft (02.09.2026): Im Testangebot steht 4,86 €.** Die Gruppe
wirkt also auch beim Einsetzen in einen Vorgang nicht. Erklärung 1 ist damit
ausgeschlossen.

Offen ist, warum. Zwei Möglichkeiten, beide nur im PDS-Client zu klären:

- In der Gruppe ist kein Aufschlagssatz hinterlegt, nur die Bezeichnung.
- Die Preisstrategie „Nettopreis" am Artikel ist ein Festpreis und übersteuert
  die Gruppe. Dann bräuchte der Artikel eine andere Strategie oder gar keine,
  damit PDS aus EK und Gruppe rechnet.

**Gegenprobe mit umgekehrter Reihenfolge (02.09.2026):** Der Dämpfungssockel
hatte die Gruppe `(KLIMA)Fest` (35 %) **bevor** sein erster EK kam. Nach dem
Öffnen im PDS-Client entstand die Preisstrategie — `ekEinzelpreis 10.00 /
vkEinzelpreis 10.00`. Kein Aufschlag. Die Reihenfolge ist also nicht die
Ursache.

Nebenbefund: Die Preisstrategie entsteht offenbar erst beim **Öffnen des
Artikels im Client**, nicht zeitgesteuert. Beide Artikel hatten sie erst nach
dem Öffnen.

Bis geklärt ist, warum die Gruppe nicht rechnet, gilt für per API angelegte
Artikel VK = EK, und der Verkaufspreis wird beim Einsetzen in den Vorgang von
Hand gesetzt — wie bisher. Der Sync gibt die Gruppe trotzdem mit; sollte PDS sie
später auswerten, greift das rückwirkend.

Der eigentliche Gewinn liegt nicht im gefüllten Verkaufspreis: Die Aufschläge
stehen damit im Artikelstamm, an der Stelle, wo auch das Angebot sie hernimmt.
Heute existiert die Logik zweimal — im Rechner und im Kopf dessen, der das
Angebot schreibt.


## 13. Wege zum Verkaufspreis — vollständig geprüft am 02.09.2026

Der Katalog-VK ist per API **nicht setzbar**. Alle 16 Katalog-Operationen
geprüft, dazu eine Suche über die gesamte API nach Preis, Preisstrategie,
Preisliste, Rabatt und Personenvertrag.

| Weg | Ergebnis |
|---|---|
| `create` / `update` am Artikel | kein Preisfeld, nur `preisEinheit` (Bezugsmenge) |
| Lieferanteneintrag | nur `einkaufspreis` |
| Preisstrategie (`ekEinzelpreis` / `vkEinzelpreis`) | nur lesend in `/katalog/details`; entsteht beim ersten Öffnen im Client mit VK = EK |
| Kalkulationsgruppe | zuweisbar, rechnet aber nicht — zweifach geprüft, in beiden Reihenfolgen (Gruppe vor EK, EK vor Gruppe), im Katalog wie im Angebot |
| Personenvertrag | nur als `personenvertragUUID` am Vorgang referenzierbar, nicht per API anlegbar |
| Kassenpreis (`kasseFlourDaten.kassenpreis`) | Kassenschnittstelle flour; `changeentry` hat kein Preisfeld |
| **`createVorgang`** | **einziger Schreibweg**: je Position `vkPreis.einzelPreis`, `ekPreis.einzelPreis`, `vkFix`, dazu `rabatt` mit `TEUERUNGSZUSCHLAG` / `VERSCHNITT` in Prozent |
| `updatePosition` | **kein Preisfeld** — nur Menge, Kurztext, Lager, Bestellnummer, Lieferant, Liefertermin |

Der VK lässt sich also **ausschliesslich beim Anlegen eines Vorgangs** setzen,
nicht am Artikel und nicht nachträglich an einer Position.

Konsequenz für den Klimarechner: Er kennt EK und Aufschlagsklasse aus dem Shop
und kann den VK beim Erzeugen des Angebots direkt in `vkPreis.einzelPreis`
schreiben, mit `vkFix: true`, damit PDS ihn nicht aus dem Katalog überschreibt.
Damit wandert die Aufschlagslogik nicht in den Artikelstamm, sondern in den
Moment, in dem das Angebot entsteht — und dort greift sie zuverlässig.
