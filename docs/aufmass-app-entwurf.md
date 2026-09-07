# Aufmaß-App — erster Entwurf (Ziel-Schritt 4)

Stand 06.09.2026, vor Umsetzung. Ziel: Monteur erfasst mobil je Baustelle
Rohrmeter und Formteil-Anzahl je Dimension statt jeden Formteil-Typ einzeln
zu zählen. Skizze, kein bindender Plan — mit Patrick abzustimmen, bevor ein
Repo/Vercel-Projekt entsteht.

## Einordnung ins App-Ökosystem

Eigene App unter `/aufmass/`, analog zu Bestellshop/Ressourcenplanung: eigenes
Repo `weich-aufmass`, eigenes Vercel-Projekt, Einhängung in die Dach-App
(siehe [[dach-app-weich-energie]] in der Erinnerung), Zugriff über
`employees.berechtigungen.app_access.aufmass` (fail-closed, Muster aus
[app-zugriffs-system]). Nutzt den Bestellshop **nicht** als Backend, sondern
nur als Artikel-/Formteil-Referenz (geteilte Supabase, cross-schema Read auf
`shop_gut_artikel_klassifikation` / `shop_formteil_mittelwert` bzw. deren
Nachfolger, sobald der Katalog auf R+F umgestellt ist).

## Datenmodell (Entwurf)

```
aufmass_erfassung
  id, pds_vorgang_uuid (Bezug zum Auftrag, wie shop_nachkalkulation),
  baustelle_text, erfasst_von, erfasst_am, status (entwurf|abgeschlossen|uebertragen)

aufmass_rohrmeter
  erfassung_id, materialsystem, dimension, meter

aufmass_formteile
  erfassung_id, materialsystem, dimension, anzahl
  -- Preis kommt NICHT von hier, sondern zur Abfragezeit aus
  -- shop_formteil_mittelwert — Erfassung bleibt preisfrei, wie gefordert.

aufmass_einzelartikel
  erfassung_id, artikelnummer (R+F oder Katalog-Artikel), menge
  -- Ventile, Schellen, Rohre ausserhalb der Formteil-Gruppen
```

## UI-Skizze (mobil, mind. Anforderung)

1. Baustelle/PDS-Auftrag waehlen (Suchfeld, juengste zuerst).
2. Je Materialsystem eine Zeile: Dimension waehlen (Chips: 15/18/20/22/25/28/32/35...),
   Rohrmeter-Eingabe, Formteil-Zaehler (+/-) daneben — kein Unterschied
   zwischen Bogen/T-Stück/Übergangsstück mehr.
3. Einzelartikel (Ventile etc.) separat, wie im Bestellshop-Katalog gesucht.
3. „Abschliessen" — Buero sieht EK-Summe (Formteile ueber den Mittelwert,
   Rest über den echten Preis), Uebertragung ins PDS folgt Schritt 5.

Erfolgskriterium aus dem Ziel: Testerfassung unter 5 Minuten am Handy.

## Offene Entscheidungen

- Neues Repo/Vercel-Projekt erst nach Patricks Freigabe anlegen (Repo-Anlage
  ist eine nach aussen wirkende Aktion).
- Tech-Stack: vermutlich Chakra UI (wie Bestellshop/Ressourcenplanung), aber
  mobil-first anders als deren Desktop-Layouts — ggf. eigenes, schlankeres
  UI ohne Chakra-Overhead. Zu klaeren.
- Offline-Toleranz („offline-tolerant" laut Ziel): lokale Zwischenspeicherung
  (IndexedDB) mit Sync bei Verbindung — Umfang und Grenzfaelle noch offen.
