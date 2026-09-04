# Montagematerial-Ebene in neuen Klima-Aufträgen — Anleitung für die Auftragsanlage

Stand 04.09.2026. Adressat: wer den PDS-Auftrag aus dem Reonic-Projekt anlegt
(heute Meghs Anlage über `/vorgang/create`).

## Worum es geht

Die PDS-API kann an einen bestehenden Auftrag **keine Positionen anhängen**.
Sie kann aber die **Menge vorhandener Positionen ändern**
(`/vorgang/updateposition`, geprüft am 04.09.2026: Menge 1 → 3, Gesamtpreis
folgt; Menge 0 → 2 ebenfalls möglich).

Deshalb bekommt jeder neue Klima-Auftrag beim Anlegen eine zusätzliche Ebene
mit den üblichen C-Teilen als **Platzhalter mit Menge 0**. Nach dem Bauen setzt
der Bestellshop die verbauten Mengen per API. Niemand muss dafür in den Client.

## Was die Anlage ergänzen muss

In `vorgangsdaten.rootEbene.ebenen` eine weitere Ebene, **nach** den
Hauptkomponenten:

```json
{
  "bezeichnung": "Montagematerial (Nachkalkulation)",
  "ebeneArt": "NORMAL",
  "positionen": [
    { "positionsTyp": "ARTIKEL", "positionsArt": "NORMAL",
      "katalogUUID": "<katalog_uuid aus der Sicht>", "menge": 0 },
    { "positionsTyp": "ARTIKEL", "positionsArt": "NORMAL",
      "katalogUUID": "<nächste>", "menge": 0 }
  ]
}
```

- **Keine** `nummer` mitgeben, PDS nummeriert selbst (sonst 412).
- **Keine** Preise mitgeben. PDS zieht EK und VK aus dem Katalog; der VK ist
  dort über die Musterangebot-Übernahme gepflegt. Der Kundenpreis wird ohnehin
  im Client angepasst.
- Die Bezeichnung der Ebene genau so schreiben. Der Bestellshop findet die
  Positionen über die Katalog-UUID, die Bezeichnung dient den Menschen.

## Woher die Liste kommt

Aus der Supabase-Sicht `shop_pds_montagematerial_platzhalter` (Projekt
`mvrbbzqfsphsmkgutegx`, Migration 014):

| Spalte | Bedeutung |
|---|---|
| `katalog_uuid` | UUID des Katalogeintrags in PDS — geht als `katalogUUID` in die Position |
| `name` | Artikelname im Shop, nur zur Kontrolle |
| `einheit` | Einheit im Shop |
| `aufschlagsklasse` | haupt / fest / verbrauch, nur Information |
| `shop_artikel_id` | ID im Shop |

Die Liste pflegen Shop-Admins über das Kennzeichen „Platzhalter in neuen
Klima-Aufträgen" am Artikel. Nur aktive Artikel mit PDS-UUID erscheinen. Wer
einen Artikel neu über den Shop nach PDS anlegt und das Kennzeichen setzt, hat
ihn ab dem nächsten Auftrag automatisch in der Ebene.

Abfrage mit dem Supabase-Client (anon oder authenticated, RLS greift auf die
zugrunde liegende Tabelle):

```js
const { data } = await supabase
  .from('shop_pds_montagematerial_platzhalter')
  .select('katalog_uuid, name')
```

## Was der Bestellshop danach tut

1. Auftrag in der Nachkalkulation holen. Die Positionen der Ebene erscheinen
   als Platzhalter mit Menge 0.
2. Verbaute Mengen eintragen.
3. „Mengen nach PDS übertragen" ruft `/vorgang/updateposition` mit
   `positionsDaten: [{ uuid, menge }]` auf — nur für Positionen, deren
   Katalog-UUID zu einem Shop-Artikel gehört. Alles andere im Auftrag bleibt
   unangetastet.
4. Positionen, die Menge 0 behalten, bleiben im Auftrag stehen. Ob sie im
   Kundendokument stören, entscheidet der Druck in PDS; sonst im Client löschen.

## Grenzen

- Material, das **nicht** in der Ebene steht, kann nachträglich nicht
  angehängt werden. Dafür bleibt das Transportangebot (ADR 0006) als
  Ausweichweg, oder der Artikel wird als Platzhalter markiert und ist ab dem
  nächsten Auftrag dabei.
- Bestehende Aufträge ohne die Ebene lassen sich nicht nachrüsten.
