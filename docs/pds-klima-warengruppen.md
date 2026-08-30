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

## In PDS angelegt (30.08.2026)

Fünf Warengruppen, nicht vier: die Klima-Dienstleistungen sind als Typ `ARTIKEL`
angelegt und würden sonst im Materialanteil der Nachkalkulation landen.

| Warengruppe | UUID | Inhalt |
|---|---|---|
| `(KLIMA)Außengerät` | `481913dd-4d65-4948-ad77-46c5e3d0092b` | Single- und Multisplit-Außeneinheiten |
| `(KLIMA)Innengerät` | `7c3c5a86-b1e9-40fa-bf31-2a3482d2e417` | Wandgeräte, Truhen, Kanalgeräte, Deckenkassetten |
| `(KLIMA)Installationsmaterial` | `2b2e46ea-de62-4d8f-b694-04355bf4d3dc` | Rohrpakete, Kabelkanal, Kabel, C-Teile aus dem Shop |
| `(KLIMA)Zubehör` | `d82c6990-55eb-46ae-9ca3-4c3bb8b60f67` | Blenden, Fernbedienungen, WLAN-Module |
| `(KLIMA)Dienstleistungen` | `36d66850-2d4a-4402-8754-f0c770108fc6` | Montagestunden, Gerüst, Elektroinstallation, Aufmaß |

Die ersten drei entsprechen den Soll-Positionen eines Klima-Auftrags
(Außeneinheit + Inneneinheiten + Montagematerial), sodass die Nachkalkulation
eine Gruppierung über die Warengruppe bleibt.

Der Kategoriezweig dazu, mit Hersteller-Unterebene analog zu SHK:

```
Klima                        a9809a4d-bf51-439d-936e-1f4e76be6606
└── Handelsware              1b8ee957-5fb0-4ed6-8f48-d91868f1945c
    ├── 1-Außengerät         5f0f5b0f-1bb6-4ec4-a7a5-a5cb11056cf4
    │   ├── Daikin           58d0dae9-44e5-45f9-8a43-d2d2487441bd
    │   ├── Panasonic        e3fac48f-44a9-408c-af1e-b229f07c1ef2
    │   └── Bosch            58bdbe82-4855-47c1-8de2-d97e18817c4d
    ├── 2-Innengerät         9b7fa267-ceb1-4d4c-b190-0bb0635d4e59
    │   ├── Daikin           d87fab7e-9bcf-4a7e-99f4-5cb1a6a88161
    │   ├── Panasonic        10df8b73-a520-40fc-91fa-073f348f9160
    │   ├── Bosch            2dbb98de-d55c-4594-a818-24c3f377c028
    │   └── Remko            de09c6d7-596d-4fc9-a64f-ac365b1e9400
    ├── 3-Installationsmaterial  899522b5-fc11-41df-94a3-1a587eb93544
    ├── 4-Zubehör            902aab52-df81-4842-9de0-f9c4037f0ab6
    │   ├── Daikin           d9329d62-6ce5-4c24-ba7e-fdee1e7eae4e
    │   ├── Panasonic        f70f1bdd-7aba-4898-bb02-6b0ac567ffe2
    │   └── Bosch            787ff467-553e-4af0-a40e-fa369c6617ca
    └── 5-Dienstleistungen   215db8a6-703d-4466-a2ed-69ea0d3e9a9d
```

Unter `Klima` liegen zusätzlich `Dienstleistungen & Fahrtkosten`,
`Produktionsmaterial` und `Sonstiges` — aus der Anlagevorlage übernommen, für den
Umzug ohne Bedeutung.

**Die maschinenlesbare Zuordnung aller 62 Artikel auf diese Ziele steht in
[pds-klima-umzug.json](pds-klima-umzug.json).**

## Umzugsliste — Kandidaten

Erhoben über Stichwortsuchen (`Klima`, `Split`, `Multisplit`, `Daikin`,
`Rohrpaket`, `Wandgerät`). **Vom Betrieb bestätigt am 30.08.2026** —
einschliesslich der beiden Zubehörzeilen, die vorher offen waren. Die Liste ist
damit freigegeben; sie ist aber weiterhin kein Vollabzug, siehe unten.

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

Aus der Suche nach `Wandgerät` (30 Treffer) kommen weitere 24 Innengeräte hinzu,
alle in `(SHK)Wärmepumpe`, Kategorie `Daikin` bzw. `Panasonic`:

Daikin Stylish — `5b2d78e9-ff8e-46f9-ae15-4677b5b7c2ad` FTXA25CW,
`d90c5980-920f-4f4f-9f2e-434acb3bd5be` FTXA20CW,
`47251e7c-0e39-4fc9-b036-f396eadfecc0` FTXA35CW,
`f639ac0c-6eba-4086-ab5a-ee997c0535de` FTXA42CW,
`65bde86a-75bb-4f1c-af6f-298ba161f1fa` FTXA50CW,
`29e84e57-ed01-493b-8640-a96fe29fdd18` FTXA25CB,
`5f40d5dd-9dde-4b0e-b0c8-ce9a3700a289` FTXA35CB,
`f7cc2135-d62e-434f-a45d-da2cc062bca3` FTXA50CB,
`8c006251-e977-42e6-a49b-ccad27db6ec9` FTXA25CS,
`543af989-46c3-43a4-bd0c-ef8c5aa50ba3` CTXA15CW,
`368c2da8-dd77-4fc8-8e4c-ad5956584d4b` CTXA15CB

Daikin Perfera — `ea29930b-5303-4fad-ba30-90fff6e69d32` FTXM20A,
`38faaa24-d11d-46ff-bc26-f2d75f206c42` FTXM25A,
`e9e2c7dc-b2a4-45d7-837b-a9a8bfbd27cc` FTXM35A,
`6c0f966a-f9be-4ea3-9b0b-eb5bfd7e56d2` FTXM42A,
`4cca5a1d-78e3-4875-a6dc-2eb80adc0e10` FTXM50A,
`24bcb21c-947c-4b71-a99f-f751410ed8d6` FTXM60A,
`870f49eb-3ab8-4569-93dc-e2fb47167637` CTXM15A

Panasonic Etherea — `36732089-6e8a-4b3e-bbcd-0454d99fc5a3` CS-Z20CKEW,
`08888c37-0c99-4c95-a719-a1306a544de8` CS-Z25CKEW,
`b7f2fe27-ae70-451c-af3a-3a8a426a1a38` CS-Z35CKEW,
`9be059e8-2e15-4997-b4cb-c1349afae58b` CS-Z50CKEW,
`a47f7b23-7349-401e-b8c4-91c0c8d1c09b` CS-XZ35CKEW-H

Zwei Treffer derselben Suche sind **keine** Klimageräte, sondern Wärmepumpen-
Innengeräte und bleiben, wo sie sind: `b9d26329-5a44-4a10-85ab-d1197dc2de36`
ELBX12E9W und `fb7e3e54-f0a8-4bc1-a508-9eba3e0334ad` ETBH12E9W (beide Altherma).

Damit umfasst die Umzugsliste rund 60 Artikel.

### → `(KLIMA)Installationsmaterial`

| UUID | Artikel | Einheit |
|---|---|---|
| `a8b265d6-2d02-4d05-8931-bb09bc89a8e9` | Rohrpaket im Kabelkanal je Innengerät | lfm |
| `fd0961fe-9a35-447c-8dd8-b4f9af15b140` | Rohrpaket ohne Kabelkanal je Innengerät | lfm |

Bei beiden ist `kategorie` null, und `a8b265d6` trägt zwei Lieferanteneinträge
mit 8,84 € und 80,00 € EK. **Das ist Vergangenheit und bleibt so** (Auskunft des
Betriebs, 30.08.2026): die alten Angebote wurden auf dieser Grundlage erstellt.
Die Preise nachträglich zu ändern würde die Historie verwischen, ohne einem
Altauftrag zu helfen — die Preise sind beim Anlegen ohnehin in die Position
kopiert worden. Beim Umhängen also nur Warengruppe und Kategorie setzen, die
Lieferanteneinträge unberührt lassen.

### → `(KLIMA)Zubehör`

Am 30.08.2026 bestätigt — beide gehören zu Klima.

| UUID | Artikel |
|---|---|
| `b6f83a11-f805-4769-86ac-6c0ed9699081` | BYCQ140EB Daikin Geräteblende schwarz |
| `93957b90-a7ee-4cf1-a20e-8e8852d83ca0` | BRC1H52K Fernbedienung Madoka |

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

1. ~~Fünf Warengruppen und den Kategoriezweig in PDS anlegen.~~ **Erledigt am
   30.08.2026.** Die API kann das nicht: im Katalog-Bereich gibt es für
   Warengruppen nur `listwarengruppen`, für Kategorien nur `listkategorien` und
   `kategoriedetails` — kein `create`, auch nicht in der Administration.
2. ~~UUIDs nachtragen.~~ **Erledigt**, siehe oben und
   [pds-klima-umzug.json](pds-klima-umzug.json). Offen bleibt das Hinterlegen in
   `shop_kategorien.pds_warengruppe_uuid` — das braucht Migration 008.
3. Vollabzug des Katalogs, Liste aller Artikel in `(SHK)Wärmepumpe` erzeugen.
4. Liste bestätigen — Klima gegen Wärmepumpe, siehe Abgrenzung oben.
5. Umhängen per `pds_updateKatalogEintrag`, im Dry-Run zuerst, protokolliert in
   `shop_pds_sync_log`.
