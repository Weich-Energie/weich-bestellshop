# ADR 0008 — Formteile kommen ohne PDS-Artikelstamm in den Auftrag

Stand: 29.09.2026. Entscheidung von Patrick, hier festgehalten mit den Zahlen,
auf denen sie ruht.

## Frage

Müssen die Formteile des Aufmaßes als Artikel im PDS-Katalog stehen, damit die
Nachkalkulation rechnen kann?

## Entscheidung

**Nein.** Das Aufmaß kommt als **Sammelposition mit Freitext** in den
PDS-Auftrag; die Aufschlüsselung je System, Dimension und Preisklasse bleibt im
Shop. Formteil-Kunstartikel werden **nicht** in den PDS-Artikelstamm
übertragen.

Braucht eine Baustelle doch die Einzelteile in der Akte, werden sie als
Freitextzeilen angehängt — ebenfalls ohne Stammartikel.

## Warum das die Nachkalkulation nicht einschränkt

Der entscheidende Befund steht seit 22.08.2026 in
`docs/nachkalkulation-datenmodell.md`, verifiziert an einem echten
Klima-Auftrag: **das Soll in PDS enthält keinen Materialkostenanteil.** Ein
Vergleich Soll-EK gegen Ist-EK *innerhalb* von PDS ist deshalb von vornherein
nicht möglich. Die festgelegte Vergleichsgröße lautet:

| Zeile | Quelle |
| --- | --- |
| Auftragssumme | PDS (`pds-auftrag-soll`) |
| − Gerätekosten | PDS |
| − **Ist-Materialeinsatz** | **im Shop erfasste Mengen × EK** |
| = Rest für Lohn und Gewinn | ergibt sich |

Der Ist-Materialeinsatz wird also im Shop gerechnet. Für diese Rechnung ist
gleichgültig, ob ein Kunstartikel „Formteil Edelstahl 22-28 Presse" im
PDS-Katalog steht.

## Was dagegen sprach, es doch zu tun

- **Der Stamm wächst um Artikel, die niemand führt.** Die Kunstartikel sind
  keine Lagerware und nicht bestellbar; sie sind Rechengrößen. Der PDS-Katalog
  trägt 1 499 Artikel, davon 2 aus dem Shop.
- **Katalogeinträge sind per API nicht löschbar.** Am 07.09.2026 lief der echte
  Sync: 57 × `/katalog/create` erfolgreich, dazu 57 Lieferanteneinträge.
  Aufräumen musste Patrick von Hand im Client — das tat er am 10.09.2026,
  dokumentiert in `docs/pds-formteil-platzhalter.md`. Die Entscheidung, es
  dabei zu belassen, ist vom 29.09.2026.
- **Die Verbindung ist gerissen.** Nach dem Umbau der Preisgruppen gibt es 29
  Kunstartikel statt 57, und keiner trägt eine `pds_katalog_uuid`. Ein erneuter
  Sync würde sie als **neue Dubletten** anlegen, weil er nur dort anlegt, wo die
  UUID fehlt.

## Folgen

1. **`pds-katalog-sync` sperrt Kunstartikel** (`formteil_aufmass = true`) mit
   HTTP 409 und Begründung. Die Sperre sitzt in der Function, nicht nur in der
   Oberfläche — ein versehentlicher Lauf wäre nicht zurückzunehmen.
2. **`shop_pds_formteil_platzhalter` ist gelöscht** (Migration
   `20260929100000`). Die Sicht beschrieb den aufgegebenen Weg und war ohnehin
   leer. Das Klima-Gegenstück `shop_pds_montagematerial_platzhalter` bleibt:
   dort sind es echte Artikel mit Lagerbezug, **ADR 0007 gilt für Klima
   unverändert**.
3. **`aufmass-pds-uebergabe` muss umgebaut werden.** Sie verlangt heute an jeder
   Stelle eine `pds_katalog_uuid` — auch auf dem Transportangebots-Weg, wo die
   Katalog-UUID als Gruppierungsschlüssel dient. Seit dem Löschen der Einträge
   landet deshalb **jede** Position in „nicht übertragbar". Bis zum Umbau ist
   die Übergabe stillgelegt.
4. Die Formteil-Kunstartikel selbst bleiben. Sie tragen die Mischsatzpreise und
   bewerten das Aufmaß — im Shop.

## Technisch möglich ist der neue Weg

Das Schema von `/vorgang/create` verlangt **kein** `katalogUUID`; eine Position
trägt `name`, `kurztext`, `langtext`, `menge` und `ekPreis` auch ohne
Katalogbezug. Als `positionsTyp` stehen neben `ARTIKEL` unter anderem `TEXT`,
`LEISTUNG` und `SONSTIGES1`–`SONSTIGES4` zur Verfügung.

### Am Testangebot 2026-314 bestätigt (29.09.2026)

Ein Minimal-Angebot bei der Weich GmbH mit je einer Position, 1 €. Beide Typen
gehen durch, **ohne** `katalogUUID`:

| Position | Typ | Ergebnis in PDS |
| --- | --- | --- |
| 01.001 | `LEISTUNG`, `pauschal: true` | `katalogUUID: null`, Kurztext und Langtext stehen, `ekPreis` übernommen |
| 01.002 | `ARTIKEL`, Menge 2 | `katalogUUID: null`, Einzelpreis 0,50 €, Gesamtpreis 1,00 € |

**Der wichtigste Befund:** PDS ordnet den Preisanteil von sich aus als
`OKG_ARTIKEL` ein — bei *beiden* Positionen, auch bei der Leistung. Die
Materialkosten landen damit in der richtigen Kostenart, und die Sorge, eine
Leistungsposition würde die Auswertung verfälschen, ist gegenstandslos.
`SONSTIGES1` ist nicht nötig. Nebenbei: `vkPreis` wird automatisch gleich
`ekPreis` gesetzt — der dokumentierte Normalfall ohne Aufschlag.

**Die Falle, die der Test aufgedeckt hat:** Das Feld `name` darf bei einer
Position ohne Stammartikel **nicht** gesetzt werden. PDS löst es gegen den
Katalog auf und antwortet

    412 ILLEGAL_ARGUMENT — Es konnte kein eindeutiger Katalogeintrag zu dem
    Namen 'Rohre und Formteile' ermittelt werden.

Die Bezeichnung gehört in `kurztext`, die Aufschlüsselung in `langtext`. Die
erste Fassung von `aufmass-pds-uebergabe` setzte `name` und wäre bei der ersten
echten Übergabe gescheitert.

Das Testangebot ist per API nicht löschbar und muss im Client entfernt werden.

## Verworfene Alternativen

- **Kunstartikel in PDS pflegen** (der Weg vom 07.09.): bläht den Stamm mit
  Rechengrößen auf, ist nicht rückholbar und bringt der Nachkalkulation nichts.
- **Nachkalkulation ganz nach PDS verlagern**: scheitert daran, dass das Soll
  keinen Materialanteil hat — das wäre ein Umbau der Angebotskalkulation, nicht
  der Nachkalkulation.
