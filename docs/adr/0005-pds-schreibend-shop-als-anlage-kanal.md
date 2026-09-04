# ADR 0005 — Der Shop schreibt in den PDS-Artikelstamm

Datum: 22.08.2026
Status: angenommen, nicht in Betrieb

## Kontext

Klimaanlagen sind erst 2026 ins Portfolio gekommen. Die Monteure notieren
verbautes Material, das für eine Nachkalkulation als Artikel in PDS stehen
müsste. Von Hand ist das zu aufwendig, deshalb existieren dort nur Dummies ohne
Katalogverknüpfung — nachweisbar an Auftrag 2025-10263, wo 3.780 € Erlös für
Montagematerial einem geplanten Materialeinsatz von 0 € gegenüberstehen.

Der Shop kann Artikel aus Link oder Screenshot per KI erkennen, benennen und
bepreisen. PDS kann das nicht. Damit ist der Shop der bessere Anlage-Kanal, auch
wenn PDS Systemführer für Stamm und Kalkulation bleibt.

Bisher war die Linie eindeutig: ADR 0003 und die Funktion `pds-preise` in der
weich-energie-app lesen aus PDS, schreiben aber nie. Dort steht ausdrücklich,
Angebote anlegen verlange „Berechtigungsprüfung, Audit und UI-Bestätigung".

## Entscheidung

Der Shop schreibt in den PDS-Katalog — begrenzt auf den Artikelstamm, mit den
drei Sicherungen, die `pds-preise` gefordert hat.

**Nicht über den MCP-Server.** Der PDS/Reonic-MCP-Server ist ein Werkzeug für
die Arbeit mit Claude, kein Produktionsweg. Der Shop ruft die PDS-API direkt aus
einer Edge Function, mit dem Key aus `integration_secrets` — dasselbe Muster wie
`pds-preise`. Ob im MCP-Server `ALLOW_WRITES` gesetzt wird, ist davon unabhängig
und betrifft nur die Erkundung.

Die Sicherungen in `pds-katalog-sync`:

1. **Whitelist** auf vier Pfade: `/katalog/create`,
   `/katalog/addlieferanteneintrag`, `/katalog/updateAbbildung`,
   `/katalog/update`. `/katalog/delete` steht nicht darin.
2. **Idempotenz** über `shop_artikel.pds_katalog_uuid`. Angelegt wird nur, wenn
   die Spalte null ist; die UUID wird sofort nach dem `create` zurückgeschrieben,
   noch vor dem Lieferanteneintrag.
3. **Protokoll** in `shop_pds_sync_log`, einschliesslich Trockenlauf. Der
   Trockenlauf ist der Standard, Schreiben muss mit `dry_run: false` verlangt
   werden.

Fehlt ein Mapping — Warengruppe, Maßeinheit oder Lieferant — bricht die Funktion
mit 422 ab und nennt die Lücke, statt einen Standardwert zu setzen.

## Begründung der Idempotenz

`/katalog/delete` greift laut API-Beschreibung nur bei Katalogeinträgen ohne
Bestand und ohne andere Verwendung. Eine falsch oder doppelt angelegte Position
bleibt damit dauerhaft im Artikelstamm stehen. Ein Sync ohne Rückschreibung der
UUID würde bei jedem zweiten Klick eine Dublette erzeugen, die niemand mehr
entfernen kann. Deshalb ist die UUID-Rückschreibung nicht Komfort, sondern
Voraussetzung.

## Was die API nicht kann

- **Kein VK-Preis.** Weder `create` noch `update` haben ein Preisfeld. Der EK
  geht nur über `einkaufspreis` am Lieferanteneintrag.
- **Keine Kategorien und Warengruppen anlegen.** Beides ist per API nur lesbar.
  Die fünf Klima-Warengruppen und der Kategoriezweig müssen einmalig von Hand in
  PDS entstehen.
- **Kein Filter nach Warengruppe** in `/katalog/listartikel`. Für einen
  Vollabzug müssen alle 1.465 Artikel geholt und clientseitig gefiltert werden.

## Folgen

Der Shop wird von einem Bestellwerkzeug zu einer Quelle für den Artikelstamm.
Das verschiebt Verantwortung: ein im Shop schlampig benannter Artikel steht
anschliessend im ERP. Deshalb bleibt die Übertragung eine ausdrückliche
Admin-Aktion und wird nicht automatisch beim Anlegen ausgelöst.

Die Ist-Erfassung der Nachkalkulation liegt in eigenen Shop-Tabellen. In den
Kundenauftrag in PDS wird nichts geschrieben — dort steht bewusst eine Pauschale.

## Verworfene Alternativen

**Weiter von Hand in PDS anlegen.** Der Grund, warum es die Dummies gibt. Der
Aufwand ist der eigentliche Auslöser dieses ADR.

**Schreiben über den MCP-Server.** Hängt an einer interaktiven Claude-Sitzung,
hat kein Audit im Shop und keine Berechtigungsprüfung gegen `employees`. Als
Produktionsweg untauglich.

**Globales `ALLOW_WRITES`.** Öffnet auch `/katalog/delete`, Personen, Vorgänge
und Lager. Für das Anlegen von C-Teilen ist das eine unnötig grosse Fläche.


## Nachtrag 04.09.2026 — fünfter Pfad: `/vorgang/create`

Die Whitelist wächst um `/vorgang/create`. Der Grund liegt in einer Grenze der
Katalog-API, die erst im Betrieb sichtbar wurde:

Kein Katalog-Endpunkt schreibt einen Verkaufspreis. `create` und `update` kennen
nur `preisEinheit`, der Lieferanteneintrag nur `einkaufspreis`, die
Preisstrategie ist ausschliesslich lesbar. Die Kalkulationsgruppe — der von der
API vorgesehene indirekte Weg — rechnet im Mandanten nicht, in beiden
Reihenfolgen geprüft (Gruppe vor EK, EK vor Gruppe), im Katalog wie im Angebot.
Ein per Sync angelegter Artikel stand damit mit VK = EK im Stamm.

Der einzige API-Schreibweg für einen VK ist die Angebotsposition
(`vkPreis.einzelPreis` mit `vkFix`). Der PDS-Client kann eine solche Position
per „in Katalog übernehmen" in den Artikel zurückschreiben — am Dämpfungssockel
belegt: 10,00 → 13,50 €.

Der Sync legt deshalb nach erfolgreichem Anlegen ein **Musterangebot** an, wenn
Einkaufspreis und Aufschlagsklasse vorhanden sind. Kunde ist die Weich GmbH
selbst (Kundennummer 10039), damit kein echter Kunde ein Angebot erhält. Die
Bezeichnung beginnt mit `ZZ-MUSTER`. Übernahme und Löschen bleiben Handarbeit
im Client — für beides gibt es keinen API-Weg; `updatePosition` hat kein
Preisfeld, Vorgänge lassen sich nicht per API löschen.

Was sich damit **nicht** ändert: Kundenaufträge bleiben unberührt,
`/katalog/delete` bleibt gesperrt, und ohne Einkaufspreis oder Aufschlagsklasse
entsteht kein Angebot — der Artikel steht dann wie bisher mit VK = EK.

Der Bestand brauchte diesen Weg nicht: 59 von 62 Klima-Artikeln tragen
bereits gepflegte Verkaufspreise mit rund 33 % Aufschlag, die drei mit VK = EK
sind bewusst so.
