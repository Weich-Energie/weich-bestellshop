# ADR 0006 — Verbautes Material geht als Nachtragsauftrag nach PDS

Datum: 04.09.2026
Status: angenommen
Ersetzt teilweise: die Festlegung aus ADR 0005 und dem Projektziel, dass in
Kundenaufträge in PDS nie geschrieben wird.

## Kontext

Die Nachkalkulation der Klima-Aufträge war bisher als eigenes Auswertungs-
werkzeug gedacht: Soll aus PDS und Reonic, Ist aus dem Shop, beides in
Shop-Tabellen, der Kundenauftrag in PDS unberührt. Der Grund war Vorsicht —
ein Kundenauftrag ist ein Dokument mit Rechnungswirkung.

Im Betrieb zeigt sich ein anderer Bedarf. Das verbaute Material soll nicht in
einer Nebenbuchhaltung liegen, sondern **im Auftrag selbst** stehen, damit die
Kalkulation in PDS vollständig ist und der Kunde daraus bedient werden kann.
Der Bestellshop ist inzwischen der Anlage-Kanal für die C-Teile im
PDS-Katalog (ADR 0005); die Artikel existieren dort mit UUID, Einkaufspreis
und Aufschlag. Es fehlt nur der Weg vom „das haben wir verbaut" in den Auftrag.

Die Vorgangs-API kann bestehende Aufträge nicht um Positionen ergänzen. Sie
kann aber einen **Nachtragsauftrag** anlegen (`/vorgang/createnachtragsauftrag`):
ein eigener Vorgang mit der Nummer des Hauptauftrags und Suffix `-N1`, mit
eigener Ebenenstruktur. Der Hauptauftrag bleibt dabei unverändert — am
04.09.2026 an Testauftrag 2026-314 nachgewiesen (docs/pds-nachtragsauftrag.md).

## Entscheidung

Das verbaute Material eines Auftrags wird aus dem Bestellshop als
**Nachtragsauftrag mit eigener Ebene** nach PDS geschrieben.

- Der Hauptauftrag wird nie verändert. Weder Positionen noch Preise noch
  Ebenen. Das ist keine Selbstbeschränkung, sondern eine Eigenschaft des
  gewählten Endpunkts.
- Je Auftrag entsteht höchstens ein Nachtrag aus dem Shop. Die Antwort (UUID,
  Nummer) wird gespeichert; ein zweiter Versuch wird abgewiesen, solange der
  erste in PDS existiert.
- Übertragen werden nur Artikel mit PDS-Katalog-UUID. Freitext und
  Schätzungen bleiben in der Shop-Nachkalkulation und kommen nicht in den
  Auftrag. Was in PDS steht, muss im PDS-Katalog existieren.
- Die Ebene trägt eine sprechende Bezeichnung mit Datum, damit sie im Client
  sofort als Shop-Import erkennbar ist.
- Die Aufbereitung für den Kunden — Preise, Zusammenfassen, Streichen der
  von PDS eingefügten Nullmengen — bleibt Handarbeit im PDS-Client. Das
  Werkzeug stellt zusammen, es kalkuliert nicht fertig.

## Was sich am Projektziel ändert

Das Ausschlusskriterium „Kundenaufträge in PDS umschreiben" bleibt in der
Sache bestehen: Es wird nichts umgeschrieben. Es wird ein Nachtrag angelegt,
den PDS selbst als eigenständigen Vorgang führt. Die Formulierung „in den
Kundenauftrag wird nie geschrieben" in CLAUDE.md und ADR 0005 ist damit
präzisiert: nicht **in** den Auftrag, sondern **neben** ihn.

## Konsequenzen

- Die Whitelist der schreibenden Edge Function wächst um
  `/vorgang/createnachtragsauftrag`. Sie bleibt eine Positivliste; `update`,
  `delete` und alle anderen Vorgangspfade bleiben gesperrt.
- Ein Nachtrag lässt sich per API nicht löschen. Ein Fehlgriff ist im Client
  zu bereinigen. Deshalb Trockenlauf als Standard, Übertragen nur mit
  ausdrücklichem Klick, und die Vorschau zeigt vorher genau die Ebene, die
  entstehen wird.
- Die Auftragssuche filtert Nachträge (`-N…`) heraus, damit kein Nachtrag auf
  einen Nachtrag entsteht.
- Die Shop-Nachkalkulation bleibt als Arbeitsliste erhalten: Dort wird
  gesammelt, hier wird übertragen. Ihre Kennzahlen (Soll, Ist, Deckung)
  bleiben nützlich, sind aber nicht mehr das Ziel.

## Verworfene Alternativen

- **Positionen direkt in den Auftrag** — kein API-Weg vorhanden.
- **Neuer eigenständiger Auftrag** über `createVorgang` — verliert die
  Zuordnung zum Hauptauftrag; PDS würde ihn nicht als Nachtrag führen.
- **Nur Auswertung im Shop** (bisheriger Plan) — erfüllt den Bedarf nicht:
  Die Kalkulation soll in PDS vollständig sein, nicht in einer zweiten Ablage.
