# Klima-Warengruppen in PDS — Befund und Umzugsliste

Stand: 22.08.2026. Rein lesend aus dem PDS-Mandanten erhoben. Ergänzt
[pds-katalog-mapping.md](pds-katalog-mapping.md) Abschnitt 4 und 5.

## Befund

Der gesamte Klima-Bereich liegt heute in der Warengruppe `(SHK)Wärmepumpe`
(`2bbf9c2d-08c4-402d-a6fd-1170c21033a5`) — dieselbe Gruppe wie echte
Wärmepumpen. Betroffen sind mindestens 30 Geräte über vier Hersteller:
Daikin (MXM-Außengeräte, Emura- und Split-IG-Innengeräte), Panasonic
(CU-Z-Multisplit), Bosch (CL-Serie) und REMKO (Deckenkassette).

Klima-Zubehör liegt in `(SHK)Installationsmaterial`, Klima-Dienstleistungen und
Rohrpakete in `zn.L Sonstiges` bzw. `zn.L Installationsmaterial`.

Solange das so bleibt, ist keine Auswertung und keine Nachkalkulation des
Geschäftsbereichs Klima möglich — jede Abfrage vermischt ihn mit SHK.

## Anzulegen in PDS (von Hand, API kann es nicht)

Der Bestand zeigt, dass es **fünf** Warengruppen braucht, nicht vier: die
Klima-Dienstleistungen sind als Typ `ARTIKEL` angelegt und würden sonst im
Materialanteil der Nachkalkulation landen.

| Neue Warengruppe | Inhalt |
|---|---|
| `(KLIMA)Außengerät` | Single- und Multisplit-Außeneinheiten |
| `(KLIMA)Innengerät` | Wandgeräte, Truhen, Kanalgeräte, Deckenkassetten |
| `(KLIMA)Installationsmaterial` | Rohrpakete, Kabelkanal, Kabel, Kondensat, C-Teile aus dem Shop |
| `(KLIMA)Zubehör` | Blenden, Fernbedienungen, WLAN-Module |
| `(KLIMA)Dienstleistungen` | Montagestunden, Gerüst, Elektroinstallation, Aufmaß |

Die ersten drei entsprechen genau den Soll-Positionen eines Klima-Auftrags
(Außeneinheit + Inneneinheiten + Montagematerial), sodass die Nachkalkulation
eine Gruppierung über die Warengruppe bleibt.

Dazu der Kategoriezweig `Klima > Handelsware > 1-Außengerät / 2-Innengerät /
3-Installationsmaterial / 4-Zubehör` mit Hersteller-Unterebene, analog zur
bestehenden Struktur unter SHK.

## Umzugsliste — Kandidaten

Erhoben über Stichwortsuchen (`Klima`, `Split`, `Multisplit`, `Daikin`,
`Rohrpaket`). **Keine vollständige Liste** — siehe Vollständigkeit unten. Jede
Zeile ist vor dem Umhängen zu bestätigen.

### → `(KLIMA)Außengerät`

| UUID | Artikel | heute Kategorie |
|---|---|---|
| `46b95bd3-bdb2-4ac2-b153-7610a41dda67` | 2MXM40A9 Multisplit 4,0 kW | Daikin |
| `3e0fcfc2-b958-462d-9b44-61a88696d017` | 2MXM50A8/9 Multisplit 5,0 kW | Daikin |
| `a487c0ef-7561-44e3-8306-178e89894266` | 3MXM40A8/9 Multisplit 4,0 kW | 1-Wärmepumpe |
| `075ffb9a-3cf6-4114-803e-a0c8f145a238` | 3MXM52A8/9 Multisplit 5,2 kW | Daikin |
| `89e26273-9ac3-4dcd-9169-e3da78ea97ca` | 3MXM68A8/9 Multisplit 6,8 kW | Daikin |
| `3c05829f-11fe-4572-a3a4-b74bb66115a3` | 4MXM68A8/9 Multisplit 6,8 kW | Daikin |
| `4b5e4bfb-3b95-4648-b367-d458664bed93` | 4MXM80A8/9 Multisplit 8,0 kW | Daikin |
| `768da29e-3a1e-4739-bc89-831146235f11` | 5MXM90A8/9 Multisplit 9,0 kW | Daikin |
| `868e8742-eb0a-413d-9fd1-1518448a3b0b` | CU-2Z35CBE 3,5 kW | Panasonic |
| `026e0d91-1056-4581-835a-226ce96f332e` | CU-2Z41CBE 4,1 kW | Panasonic |
| `d0f2c4f7-ae5d-421a-9131-ead8f74fbfc5` | CU-2Z50CBE 5,0 kW | Panasonic |
| `ecdcc797-4016-493c-bbe0-fb1d3649d452` | CU-3Z52CBE 5,2 kW | Panasonic |
| `d6d64f77-4f82-4e58-a983-7b5c9b4d2071` | CU-3Z68CBE 6,8 kW | Panasonic |
| `3f1104dd-e519-481f-9612-22e6da94ecb3` | CU-3Z75ABEC PowerHeat 7,5 kW | Panasonic |
| `651f3287-b738-4b03-ae7d-7451bbe63eb7` | CU-4Z68CBE 6,8 kW | Panasonic |
| `1d6c3f0c-db49-4f3e-8719-4156e3d38375` | CU-4Z80CBE 8,0 kW | Panasonic |
| `087adbf9-3a8f-46cd-8ceb-5ac4831ba0f1` | CU-5Z90CBE 9,0 kW | Panasonic |
| `e94a4e83-a8bf-4426-8ec5-6a3ab999c4af` | Bosch CL3000i 35 E Singlesplit | — |
| `53a97f49-2805-484c-b0d0-0c1bea921706` | Bosch CL7000i 35 E Singlesplit | Bosch |
| `e5954410-8d32-4049-9647-5271abfe67b0` | Bosch CL5000M 53/2 E Multisplit | Bosch |
| `7d91b0c0-21a5-4f94-8143-0a81c4824c26` | Bosch CL5000M 79/3 E Multisplit | — |

### → `(KLIMA)Innengerät`

| UUID | Artikel | heute Kategorie |
|---|---|---|
| `6756f93c-54bc-4a5b-b787-66a32e69ba22` | FTXJ20AW9 Emura 2,0 kW weiß | Daikin |
| `5cb60e93-14bb-44be-9b5d-20fc0b213950` | FTXJ35AW9 Emura 3,5 kW weiß | Daikin |
| `6567532c-6b16-458b-9a51-abac340b41cb` | FTXJ35AB9 Emura 3,5 kW mattschwarz | Daikin |
| `896a4c56-060d-419e-a1cd-0ebad4d16070` | FTXJ42AB9 Emura 4,2 kW mattschwarz | Daikin |
| `8f3329e9-80d1-4f8d-aa05-480416f67b87` | FTXA20CB Split IG Wandgerät | Daikin |
| `55bb1664-4e0a-4496-b1ff-ecb88e4108c0` | Bosch CL3000iU W 20 E | Bosch |
| `11c88bb0-b28c-433a-98ad-2b6421b2a4aa` | Bosch CL3000iU W 26 E | Bosch |
| `15a32f5f-eb1c-4545-b96a-8191276f7a23` | Bosch CL3200iU W 35 E | Bosch |
| `c0dfe505-8abb-4dc3-afed-5e6723389edc` | Bosch CL7000iU W 35 E | Bosch |
| `453d6e4d-f43e-4c4e-88b6-66fcaf08d3ba` | REMKO Deckenkassette MXD 204 | 2-Wärmepumpen Zubehör |

### → `(KLIMA)Installationsmaterial`

| UUID | Artikel | Einheit |
|---|---|---|
| `a8b265d6-2d02-4d05-8931-bb09bc89a8e9` | Rohrpaket im Kabelkanal je Innengerät | lfm |
| `fd0961fe-9a35-447c-8dd8-b4f9af15b140` | Rohrpaket ohne Kabelkanal je Innengerät | lfm |

Beide haben zusätzlich Datenmängel: `kategorie` ist null, und bei `a8b265d6`
stehen zwei Lieferanteneinträge mit 8,84 € und 80,00 € EK, einer davon mit dem
vollständigen Artikelnamen im Feld `bestellnummer`. Hier lohnt das Aufräumen im
selben Durchgang.

### → `(KLIMA)Zubehör` (zu prüfen)

| UUID | Artikel | Anmerkung |
|---|---|---|
| `b6f83a11-f805-4769-86ac-6c0ed9699081` | BYCQ140EB Daikin Geräteblende schwarz | Blende für Deckenkassette, dürfte Klima sein |
| `93957b90-a7ee-4cf1-a20e-8e8852d83ca0` | BRC1H52K Fernbedienung Madoka | wird auch bei Wärmepumpen verbaut — Zuordnung offen |

### → `(KLIMA)Dienstleistungen`

| UUID | Artikel |
|---|---|
| `024b3ad3-089c-4611-a50f-3c06453e1ada` | Arbeitsstunden Installation Klima |
| `9606b0c9-466a-4ba1-9ed3-3ff2c51a2961` | Elektroinstallation Klimaanlage |
| `7dbd2ad3-4b1e-41a2-b10f-5fc826516a98` | Gerüststellung Klimaanlage |
| `e465ba02-79ea-4446-915e-c7f784cf600b` | Pauschale für Aufmaß-Service Klima |

## Bewusst nicht umhängen

Die Stichwortsuche `Split` trifft massenhaft Falsches. Diese Artikel bleiben in
`(SHK)Wärmepumpe`, obwohl sie „Split" im Text führen — es sind Wärmepumpen in
Split-Bauweise:

- Daikin Altherma: `599d95f9` ERRA12EW1, `143e5019` EBLA06E3V3, `e44bcd2a`
  EBLA09D3W1, `1e50c9df` EPRA12EW1, `bd2ffef9` ETSX12P50E sowie die
  Brauchwasser-Wärmepumpen `e1f60602`, `673e0743`, `802c8236`, `b01fb14f`
- Panasonic Aquarea: `d1a71a2b`, `bd2ca6ba`, `f0d4de4d`
- Mitsubishi Inverter mit Hydromodul: `16f75d15`, `8332fcbf`, `f6f8e737`
- Bosch Compress CS3400iAWS: `108bc891`

Und zwei Treffer, die gar nichts mit Klima zu tun haben: `216d0781`
„Split, Zierkies" und die Tesla-Artikel `65124297` (Split Core CT) sowie
`ce97da11` (Ferrite Split).

**Daraus die Regel: nicht per Stichwortautomatik umhängen.** Die Liste gehört
einmal von einem Menschen bestätigt, dann per `pds_updateKatalogEintrag`
abgearbeitet.

## Vollständigkeit

Diese Liste ist ein Suchergebnis, kein Vollabzug. `/katalog/listartikel` kann
**nicht nach Warengruppe filtern** — verfügbare Suchfelder sind ausschliesslich
`ALLES, NAME, SUCHWORT, ALTNAME, KURZTEXT, LANGTEXT, BESTELLNUMMER, EANNUMMER,
LIEFERANT, REFERENZ_NUMMER, BARCODE_CONTENT, ARTIKEL_ERSTELLER,
HERSTELLER_NUMMER`.

Für den vollständigen Bestand muss der Katalog abgezogen und clientseitig
gefiltert werden: 1.465 Artikel vom Typ `ARTIKEL`, bei `entriesPerPage: 1000`
also zwei Seiten. Dieser Abzug gehört als erster Schritt in das Sync-Werkzeug,
zusammen mit einer Liste aller Artikel in `(SHK)Wärmepumpe` zur Durchsicht.

## Ablauf

1. Fünf Warengruppen und den Kategoriezweig in PDS von Hand anlegen.
2. UUIDs in [pds-katalog-mapping.md](pds-katalog-mapping.md) Abschnitt 4 und 5
   nachtragen und in `shop_kategorien.pds_warengruppe_uuid` hinterlegen.
3. Vollabzug des Katalogs, Liste aller Artikel in `(SHK)Wärmepumpe` erzeugen.
4. Liste bestätigen — Klima gegen Wärmepumpe, siehe Abgrenzung oben.
5. Umhängen per `pds_updateKatalogEintrag`, im Dry-Run zuerst, protokolliert in
   `shop_pds_sync_log`.
