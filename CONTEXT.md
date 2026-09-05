# weich-bestellshop — Domain-Glossar

Interner Bestellshop fuer WEICHENERGIE (Weich GmbH). Verbrauchsmaterial (C-Teile) —
Lagergefuehrte B-Teile bleiben im ERP. Vierte App im Oekosystem (nach Ressourcenplanung,
Service-Ticket, Betriebsradar), shared Supabase.

## Kern-Entitaeten

### Katalog-Artikel
Ein im Shop hinterlegter, bestellbarer Artikel. Hat genau eine Kategorie, beliebig
viele Tags, optional Bild (Supabase Storage oder externe URL), optional Bestell-Link
zum Lieferanten. Wird von Admins angelegt (manuell mit KI-Vorschlaegen, aus
Bedarfsmeldungen materialisiert, oder aus dem Beleg-Import promotet).

### Sichtbarkeit eines Artikels
Zwei unabhaengige Kennzeichen, seit Migration 014:
- **bestellbar** — der Artikel erscheint im Shop-Katalog und kann in den Warenkorb.
- **Nachkalkulation Klima** — der Artikel erscheint in der Nachkalkulation und im
  Aufmass; steht er in PDS, ist er zugleich Platzhalter (Menge 0) in der Ebene
  „Montagematerial (Nachkalkulation)" jedes neuen Klima-Auftrags (ADR 0007).
Ein Artikel kann beides, eines oder keines sein. Geraete werden kalkuliert, aber
ueber den Grosshandel beschafft: Nachkalkulation ja, bestellbar nein.

### Aufmass (geplant)
Der Shop ist der Artikelstamm fuer das Aufmass auf der Baustelle. Die Aufmass-App
wird eine eigene App mit eigener Optik und Haptik fuer diesen Einsatzzweck; sie
greift auf den Artikelstamm des Shops zu und liefert das verbaute Material an die
Nachkalkulation.

### Bedarfsmeldung
Ein noch nicht katalogisierter Wunsch eines Mitarbeiters. Enthaelt Kurzbeschreibung,
optional Foto vom Handy und Lieferanten-Link. Ist NICHT bestellbar — dient dem Admin
als Backlog-Input, um daraus einen Katalog-Artikel zu machen (oder abzulehnen).

### Bestellwunsch (order_request)
Was ein User bestellen moechte: (user, katalog_artikel, menge, optional projekt_ref,
optional notiz). Durchlaeuft den Zustands-Zyklus (siehe unten). Ein User-Warenkorb ist
die Menge seiner Bestellwuensche im State `draft`.

### Sammelbestellung (order)
Eine tatsaechliche Bestellung bei einem Lieferanten. Fasst mehrere Bestellwuensche
zusammen (via `order_position`). Hat Lieferant, Bestell-Datum, Versandkosten,
Gesamtbetrag, externe Bestell-Nr. Der Admin (oder KI-Bot) bildet Sammelbestellungen aus
freigegebenen Bestellwuenschen.

### Beleg
Eine hochgeladene Rechnung/Bestellbestaetigung (PDF, Bild). Wird per Vision-KI
extrahiert zu **Beleg-Positionen**, die wiederum zu Katalog-Artikel-Kandidaten
werden koennen. Zweck: Katalog-Bootstrap aus historischen DATEV-Rechnungen.

### Kategorie / Tag
- **Kategorie**: eine flache Liste, ein Artikel gehoert zu genau einer. Strukturiert
  die Navigation ("klassische Shop-Kategorien").
- **Tag**: freie Textmarker, beliebig viele pro Artikel. Strukturiert die Suche.

### Favorit
Verknuepfung `(user_id, katalog_artikel_id)`. Simple Merkliste, keine Gruppen v1.0.

## Rollen

- **admin**: verwaltet Katalog, gibt Bestellwuensche frei, sieht alle Bestellungen,
  verwaltet Beleg-Import, konfiguriert KI-Regeln, benennt weitere Admins.
- **user**: bestellt, meldet Bedarf, sieht eigene Bestellungen + Favoriten. Sieht
  keine Preise.

Rollen werden ueber das **App-Zugriffs-System** (`app_access(user_id, app, role)`)
gefuehrt — geteilt mit den anderen drei Apps.

## Zustands-Zyklus eines Bestellwunsches

```
draft            → im Warenkorb (kann bearbeitet werden)
  ↓
pending          → abgeschickt, wartet auf Admin-Freigabe
  ↓
approved         → freigegeben, wartet auf Ausfuehrung
  ↓ (via Sammelbestellung)
ordered          → Sammelbestellung beim Lieferanten platziert
  ↓
received         → Ware angekommen (Admin markiert Sammelbestellung → alle Positionen)
  ↓
closed           → User hat abgeholt

Terminierungen:
  rejected       → Admin abgelehnt (mit Grund)
  cancelled      → User zurueckgezogen (nur aus draft/pending moeglich)
```

## Prozess-Modi fuer Bestell-Ausfuehrung (Browser-Automation)

Zwei Modi, je nach Lieferant:

- **Playbook-Modus (Modus A)** — fuer 2-4 Frequenz-Champion-Lieferanten. KI loggt
  ein, fuellt Warenkorb, User bestaetigt Vorschau, KI klickt "Kaufen".
- **Ad-hoc-Modus (Modus B)** — fuer alle anderen Shops. KI bereitet Warenkorb-Link
  vor, User klickt final selbst.

## Sprachregeln

- **Bestellaufruf** (aus Umgangssprache) = Bedarfsmeldung. Immer den offiziellen
  Begriff im Code/UI verwenden.
- **Bestellung** ist immer die Sammelbestellung — nie der einzelne Bestellwunsch.
- **Artikel** ist immer der Katalog-Artikel. Ein Element im Warenkorb ist ein
  Bestellwunsch, kein Artikel.
- **Verbrauchsmaterial** = alles was der Shop verwaltet (C-Teile, teils B-Teile).
  Lagergefuehrte hochwertige Ware bleibt im ERP — der Shop verwaltet die nicht.
