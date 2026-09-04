# ADR 0006 — Verbautes Material geht als Transportangebot nach PDS

Datum: 04.09.2026 (Fassung 2, ersetzt die Fassung vom Vormittag)
Status: angenommen
Präzisiert: die Festlegung aus ADR 0005 und dem Projektziel, dass in
Kundenaufträge in PDS nie geschrieben wird.

## Kontext

Das verbaute Material eines Klima-Auftrags soll **im Kundenauftrag** stehen,
als eigene Ebene unter den kalkulierten Positionen, damit die Kalkulation in
PDS vollständig ist. Der Bestellshop ist Anlage-Kanal für die C-Teile im
PDS-Katalog (ADR 0005); die Artikel existieren dort mit UUID, Einkaufspreis
und Aufschlag. Es fehlt der Weg vom „das haben wir verbaut" in den Auftrag.

Die Vorgangs-API kann das nicht. Geprüft am 04.09.2026 gegen die
OpenAPI-Spezifikation des Mandanten (`/pds/rest/api/openapi.yaml`, 25 Pfade
unter `/vorgang`):

- `updateposition` erwartet je Eintrag eine vorhandene Positions-UUID und kennt
  weder `katalogUUID` noch Preise. Es ändert, es legt nicht an.
- `updatevorgang` ändert nur Kopfdaten (Status, Anschriften, Zahlungsbedingung,
  Liefertermin). Keine Ebenen, keine Positionen.
- `createnachtragsauftrag` legt einen **eigenen Vorgang** neben dem Auftrag an
  (`2026-314-N1`, getestet). Der Auftrag selbst bleibt leer. Das war die erste
  Fassung dieses ADR und ist verworfen: gewollt ist das Material im Auftrag,
  nicht daneben.
- `/service/createposition` kann Positionen anlegen, aber nur an
  Serviceaufträgen. Die Klima-Vorgänge sind Aufträge.

Der Betrieb kennt dafür seit Jahren einen Handgriff: Im PDS-Client werden
Positionen aus einem Musterangebot („Muster", enthält alle Artikel) in den
Kundenauftrag kopiert. Das funktioniert, ist aber Sucharbeit mit Mengen aus
dem Kopf.

## Entscheidung

Das Werkzeug legt je Auftrag ein **Transportangebot** an:

- Typ ANGEBOT über `/vorgang/create`, Kunde ist die **Weich GmbH** (wie beim
  Musterangebot für den Katalog-VK, ADR 0005 Nachtrag). Kein echter Kunde
  bekommt ein Dokument.
- Bezeichnung `ZZ-TRANSPORT verbautes Material fuer Auftrag <Nummer> — nach
  Kopieren loeschen`. Eine Ebene `Verbautes Material fuer <Nummer> —
  Bestellshop <Datum>` mit genau den verbauten Positionen: Katalogbezug, Menge,
  EK aus dem Shop, VK über die Aufschlagsklasse mit `vkFix`.
- Im PDS-Client wird die Ebene in den Kundenauftrag kopiert, dort werden die
  Kundenpreise angepasst, dann wird das Transportangebot gelöscht. Das ist der
  Handgriff, den der Betrieb schon kennt, nur ohne Suchen und Abzählen.
- Jede übertragene Position trägt `pds_transport_at`. Ein zweiter Transport
  nimmt nur Positionen ohne diese Markierung mit. Wer ein Angebot löscht, ohne
  zu kopieren, hebt die Markierung im Shop wieder auf.
- Übertragen werden nur Artikel mit PDS-Katalog-UUID. Freitext bleibt im Shop.

## Was sich am Projektziel ändert

Nichts an der Sache: In den Kundenauftrag schreibt weiterhin kein Programm,
sondern ein Mensch im Client, der sieht, was er kopiert. Das Werkzeug schreibt
ausschließlich in Vorgänge der eigenen Firma.

## Konsequenzen

- Die Whitelist der Function `pds-auftrag-transport` enthält `/vorgang/details`
  (Prüfung, dass der Zielauftrag existiert) und `/vorgang/create`. Kein
  `update`, kein Nachtrag, kein `delete`.
- Vorgänge lassen sich per API nicht löschen. Das Transportangebot ist
  Handarbeit im Client — genau wie beim Musterangebot für den Katalog-VK.
- Trockenlauf (Vorschau) ist Standard; das Anlegen fragt im Frontend nach.
- Migration 012 (Nachtrag-Spalten) bleibt eingespielt; Migration 013 benennt
  die Spalten um und ergänzt `pds_transport_at` an der Position.

## Verworfene Alternativen

- **Nachtragsauftrag** — eigener Vorgang neben dem Auftrag, siehe oben.
- **Positionen direkt in den Auftrag** — kein API-Weg vorhanden.
- **Ein statisches Musterangebot mit allen Shop-Artikeln pflegen** — wäre nur
  Meghs heutiger Weg mit anderem Inhalt; Mengen und Auswahl blieben Handarbeit.
- **Datei-Import (GAEB/Datanorm) in den Auftrag** — nicht geprüft, weil der
  Client-Handgriff „kopieren" schon eingeübt ist.
- **PDS um `createposition` für Vorgänge bitten** — bleibt als Wunsch offen;
  für Serviceaufträge existiert der Endpunkt bereits.
