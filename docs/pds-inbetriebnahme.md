# PDS-Anbindung in Betrieb nehmen

Reihenfolge ist bindend. Jeder Schritt ist einzeln prüfbar, und bis Schritt 4
wird nichts nach PDS geschrieben.

Alles liegt auf dem Branch `feature/pds-katalog-sync`. **Nicht nach `master`
mergen, bevor Schritt 1 gelaufen ist** — die Sync-Seite fragt Spalten ab, die
erst die Migration anlegt. Der Katalog selbst bleibt davon unberührt (siehe
`listArtikel` in `src/data/api/artikel.js`), aber „Nach PDS übertragen" zeigt bis
dahin nur einen Fehlerhinweis.

## 1. Migrationen einspielen

**Der einfache Weg:** [docs/sql/inbetriebnahme-komplett.sql](sql/inbetriebnahme-komplett.sql)
enthält alle drei Migrationen in einer Transaktion, dazu das Hinterlegen der
Klima-UUIDs und die Prüfabfragen. In Supabase Studio → SQL Editor einfügen und
ausführen. Bricht etwas ab, ist nichts geschrieben.

Vor dem Ausführen eine Zeile anpassen: im Abschnitt „Klima-Ziele im Shop
hinterlegen" den Namen der Shop-Kategorie eintragen, unter der die Klima-C-Teile
laufen, und die drei Zeilen einkommentieren.

Einzeln geht auch, in dieser Reihenfolge:

```
supabase/migrations/008_pds_katalog_sync.sql
supabase/migrations/009_nachkalkulation.sql
supabase/migrations/010_artikel_pds_fertig.sql
```

Prüfen danach:

```sql
-- muss 4 Zeilen liefern
select column_name from information_schema.columns
 where table_name = 'shop_artikel'
   and column_name in ('pds_katalog_uuid','pds_sync_status','pds_sync_at','lieferant_id');

-- muss 9 Einheiten zeigen, Stück -> Stck
select shop_einheit, pds_bezeichnung, aliasse from public.shop_pds_einheiten order by 1;

-- Frigotechnik muss die PDS-UUID tragen
select slug, pds_person_uuid, pds_lieferanten_nummer from public.shop_lieferanten;

-- Trigger muss greifen: gibt 'Stück' zurück
select public.normalisiere_einheit('STK');
```

## 2. In PDS von Hand anlegen — ERLEDIGT am 30.08.2026

Die API kann Kategorien und Warengruppen nur lesen. Ohne diesen Schritt bricht
jede Übertragung mit einer Meldung ab, welche Angabe fehlt. Struktur und alle
UUIDs stehen in [pds-klima-warengruppen.md](pds-klima-warengruppen.md).

Offen bleibt nur das Hinterlegen im Shop — dafür braucht es Schritt 1. Für die
Kategorie, unter der die Klima-C-Teile im Shop laufen:

```sql
update public.shop_kategorien
   set pds_kategorie_uuid   = '899522b5-fc11-41df-94a3-1a587eb93544',  -- 3-Installationsmaterial
       pds_warengruppe_uuid = '2b2e46ea-de62-4d8f-b694-04355bf4d3dc'   -- (KLIMA)Installationsmaterial
 where name = '<Name der Shop-Kategorie>';
```

Die folgende Auflistung ist damit erledigt und bleibt nur als Beleg stehen.

**Fünf Warengruppen** (Begründung des Schnitts in
[pds-klima-warengruppen.md](pds-klima-warengruppen.md)):

```
(KLIMA)Außengerät
(KLIMA)Innengerät
(KLIMA)Installationsmaterial
(KLIMA)Zubehör
(KLIMA)Dienstleistungen
```

**Kategoriezweig**, parallel zu PV und SHK:

```
Klima
└── Handelsware
    ├── 1-Außengerät
    ├── 2-Innengerät
    ├── 3-Installationsmaterial
    └── 4-Zubehör
```

Danach die UUIDs im Shop hinterlegen. Sie stehen in PDS nicht sichtbar; sie
lassen sich über die lesenden Operationen holen (`/katalog/listwarengruppen`,
`/katalog/listkategorien`) oder über den MCP-Server abfragen. Eintragen:

```sql
update public.shop_kategorien
   set pds_kategorie_uuid   = '<UUID von 3-Installationsmaterial>',
       pds_warengruppe_uuid = '<UUID von (KLIMA)Installationsmaterial>'
 where name = '<Name der Shop-Kategorie>';
```

Ohne diesen Eintrag steht die Kategorie auf der Sync-Seite oben als Warnung.

## 3. Functions deployen

```bash
npx supabase functions deploy pds-auftrag-soll --project-ref mvrbbzqfsphsmkgutegx
```

`pds-auftrag-soll` liest nur — die kann ohne weitere Prüfung live gehen. Danach
ist die Nachkalkulation sofort nutzbar: Auftrag suchen, „Soll holen", und die
Kennzahlen stehen mit echten Zahlen da.

Die schreibende Funktion erst danach:

```bash
npx supabase functions deploy pds-katalog-sync --project-ref mvrbbzqfsphsmkgutegx
```

Beide brauchen den PDS-Zugang in `integration_secrets` unter dem Schlüssel `pds`
(`{"api_key": "...", "base_url": "..."}`) — dieselbe Zeile, die
`weich-energie-app/functions/pds-preise` schon benutzt.

## 4. Erster Schreibversuch

**Es gibt keinen Testmandanten** — am 02.09.2026 geklärt. Die API kennt kein
Mandanten-Konzept: Es existiert keine Operation für Mandant, Firma oder
Niederlassung, und welche Instanz der Zugang anspricht, entscheidet allein der
API-Key. Dass es die Produktion ist, belegen die Daten selbst — 1.465 Artikel,
51 Klima-Aufträge mit echten Kundendaten, ein Auftrag im Status „Abgerechnet".

Der `webLink` in jeder Antwort zeigt auf `127.0.0.1:8090` und sieht deshalb wie
eine lokale Testinstanz aus. Das ist er nicht: Es ist der Deeplink in den
PDS-Windows-Client auf dem Rechner des jeweiligen Anwenders.

Jeder Schreibversuch geht also gegen den Echtbetrieb. Deshalb einen Artikel
wählen, dessen Dublette verkraftbar wäre — keinen, der schon in Aufträgen steckt.

Ablauf auf der Seite „Nach PDS übertragen":

1. **Probe** klicken. Es wird nichts gesendet; angezeigt wird die vollständige
   Nutzlast beider Aufrufe. Prüfen: Einheit, Warengruppe, Lieferant,
   Bestellnummer, EK-Preis.
2. Erst wenn die Probe stimmt: **Übertragen**. Es folgt eine Rückfrage, weil
   `/katalog/delete` in PDS nur bei Einträgen ohne Bestand und ohne Verwendung
   greift — eine Dublette bleibt dauerhaft im Stamm.
3. In PDS nachsehen: steht der Artikel in der richtigen Warengruppe, hat er den
   Lieferanteneintrag mit Bestellnummer und EK?
4. Im Shop erscheint der Status `gesynct` mit den ersten Zeichen der PDS-UUID.
   Ein zweiter Klick ist ab dann nicht mehr möglich.

Was schiefgehen kann und was es bedeutet:

| Meldung | Ursache |
|---|---|
| `mapping_unvollstaendig` mit Lückenliste | Warengruppe, Einheit oder Lieferant fehlt — nichts wurde gesendet |
| `403` | Konto hat kein `bestellshop_admin` in `employees.berechtigungen` |
| `503 Keine PDS-Zugangsdaten` | `integration_secrets` Schlüssel `pds` fehlt |
| `PDS 401/403` | Der API-Key darf nicht schreiben — das ist die offene Frage aus Schritt 4 |
| Artikel angelegt, Warnung zum Lieferanteneintrag | Der Artikel steht in PDS, ist aber noch nicht nachbestellbar. Nicht erneut übertragen, sondern den Lieferanteneintrag in PDS nachtragen |

Jeder Aufruf, auch die Probe, steht danach in `shop_pds_sync_log` mit Anfrage,
Antwort und HTTP-Status.

## 5. Bestand nachziehen

Erst wenn ein einzelner Artikel nachweislich richtig in PDS steht, den Rest
übertragen. Es gibt bewusst keinen Batch-Knopf: bei rund 60 Artikeln ist
einzelnes Übertragen mit Blick auf das Ergebnis der sicherere Weg, und ein
Fehler im Mapping würde sich sonst sechzigfach fortschreiben.

## Was danach noch offen ist

- **Klima-Bestand umhängen.** Rund 60 Artikel liegen in `(SHK)Wärmepumpe` und
  gehören in die neuen Gruppen. Liste in
  [pds-klima-warengruppen.md](pds-klima-warengruppen.md); nicht per
  Stichwortautomatik, die Abgrenzung zu Wärmepumpen in Split-Bauweise ist dort
  begründet.
- **Muster C verifizieren.** Ob Leistungspositionen tatsächlich den
  Materialeinstand tragen, ist noch an keinem Auftrag geprüft.
- **Stunden erfassen?** Der Klimarechner hält seine Standardzeiten für
  Platzhalter, die aus echter Nachkalkulation kommen sollen. Offene Entscheidung,
  siehe [nachkalkulation-datenmodell.md](nachkalkulation-datenmodell.md).
