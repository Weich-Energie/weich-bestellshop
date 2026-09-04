# Verbautes Material als Nachtragsauftrag in PDS

Stand 04.09.2026. Ergebnis eines Tests am eigenen Haus, nicht an einem
Kundenauftrag.

## Fragestellung

Der Bestellshop soll das tatsächlich verbaute Material eines Klima-Auftrags
nach PDS schreiben — als eigene, klar getrennte Ebene, ohne die bestehenden
Positionen des Auftrags anzufassen. Die Aufbereitung für den Kunden bleibt
Handarbeit im PDS-Client.

Die Vorgangs-API kennt keinen Endpunkt, der eine Ebene oder Position in einen
bestehenden Vorgang einhängt. `updatePosition` ändert nur vorhandene Positionen
(Menge, Kurztext, Lieferant, Termin — kein Preis), `createVorgang` legt neu an.
Übrig bleibt `/vorgang/createnachtragsauftrag`.

## Test

| Schritt | Ergebnis |
|---|---|
| `createVorgang` AUFTRAG bei der Weich GmbH, eine Position ZZ-TEST-002, Menge 1 | Auftrag **2026-314**, UUID `b4e7aca1-40fc-4757-8677-77b0ebed4a50` |
| `createAuftragNachtrag` mit `uuid` des Auftrags und `rootEbene.ebenen[0]` = „Verbautes Material (Nachkalkulation Bestellshop)", zwei Katalogpositionen (Menge 5 und 2, EK/VK mitgegeben, `vkFix`) | Neuer Vorgang **2026-314-N1**, UUID `b14fca92-2ae1-40b1-a2e9-3da149bfc3ff`, Typ AUFTRAG, Status Offen |
| `details` des Hauptauftrags 2026-314 danach | Unverändert: eine Position, Menge 1, keine zusätzliche Ebene |

## Was der Nachtrag ist

- Ein **eigener Vorgang** vom Typ AUFTRAG mit der Nummer des Hauptauftrags
  plus Suffix `-N1` (weitere Nachträge vermutlich `-N2` …). Er erscheint in
  `listauftraege` als eigener Treffer; die API liefert kein Feld, das auf den
  Hauptauftrag zeigt — die Zuordnung steckt in der Nummer.
- Die neue Ebene kommt genau so an, wie sie übergeben wurde: eigene
  Bezeichnung, Positionen mit Katalogbezug, Menge, EK und VK, Preisanteile
  `OKG_ARTIKEL`. Positionsnummern vergibt PDS, `nummer` also weglassen.
- PDS kopiert zusätzlich **alle Positionen des Hauptauftrags mit Menge 0** in
  die Wurzelebene des Nachtrags (Gesamtpreis 0). So führt PDS einen Nachtrag
  als Differenz zum Hauptauftrag. Für die Nachkalkulation ist das unschädlich,
  im Client aber sichtbar.
- Der Hauptauftrag bleibt bytegleich stehen. Damit ist die Anforderung „lässt
  die bestehenden Positionen so wie sie sind" nicht nur eingehalten, sondern
  technisch garantiert.

## Was das für das Werkzeug bedeutet

1. Auftrag wählen (Suche wie in der Nachkalkulation, Nachträge `-N…` aus der
   Auswahl herausfiltern, damit kein Nachtrag auf einen Nachtrag entsteht).
2. Vorhandene Positionen des Auftrags anzeigen — sie sind das, was kalkuliert
   war. Sie werden **nicht** noch einmal übertragen.
3. Verbaute Artikel aus dem Shop-Katalog hinzufügen. Übertragbar sind nur
   Artikel mit `pds_katalog_uuid`; alle anderen müssen zuerst über den
   Katalog-Sync nach PDS. Menge frei, EK aus dem Shop, VK über die
   Aufschlagsklasse.
4. „Übertragen" ruft `createAuftragNachtrag` genau einmal auf. Der Nachtrag
   trägt eine Ebene mit sprechender Bezeichnung und Datum. Antwort (UUID,
   Nummer) wird in `shop_nachkalkulation` gespeichert, damit derselbe Auftrag
   nicht versehentlich zweimal einen Nachtrag bekommt.
5. Alles Weitere — Preise für den Kunden, Zusammenfassen, Löschen der
   Nullmengen — geschieht im PDS-Client.

## Nicht per API

- Nachtrag löschen oder zurückziehen. Wie alle Vorgänge nur im Client.
- Positionen des Hauptauftrags verändern oder ergänzen.
- Den Nachtrag später um weitere Positionen erweitern — dafür entsteht ein
  neuer Nachtrag (`-N2`).

## Aufzuräumen

Testauftrag 2026-314 und Nachtrag 2026-314-N1 hängen an der Weich GmbH als
Kunde und sind im Client zu löschen, sobald der Nachtrag dort begutachtet ist.
