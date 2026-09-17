# Bestellshop — WEICHENERGIE (Weich GmbH)

## Projekt
Interner Bestellshop fuer Verbrauchsmaterial (C-Teile). Monteure/Arbeiter melden Bedarf,
Admins pflegen Katalog, geben Bestellungen frei, KI unterstuetzt bei Anlage und
Bestell-Abwicklung. Vierte App im WEICHENERGIE-App-Oekosystem — shared Supabase mit
Ressourcenplanung, Service-Ticket und Betriebsradar.

## Tech Stack
- React 19 + Vite 8 + Chakra UI v3 (NICHT v2!)
- Supabase (PostgreSQL, RLS, Edge Functions) — shared Instanz
- @tanstack/react-query, react-router-dom v7, lucide-react
- Hosting: Vercel (Auto-Deploy von master)
- Browser-Bestell-Bot (Phase 7+): Node + Playwright auf Hostinger `weich-code`

## Supabase
- Project Ref: mvrbbzqfsphsmkgutegx
- URL: https://mvrbbzqfsphsmkgutegx.supabase.co
- Auth: Email + Passwort (Supabase Auth) — kein PIN im Shop
- App-Access-Check: `employees.berechtigungen.app_access.bestellshop === true`
  (fail-closed) — Pattern uebernommen aus Ressourcenplanung Phase 11/AAC-04
- Shop-Admin-Flag: `berechtigungen.app_access.bestellshop_admin === true` ODER
  `berechtigungen.rolle === 'admin'`
- SQL ausfuehren, wenn Port 5432 gesperrt ist (Fremdnetz, `db query` meldet
  `LegacyDbConfigConnectTempRoleError`): `tools/supabase-sql-https.ps1 -SqlFile x.sql`
  geht ueber die Management-API (HTTPS) mit dem CLI-Token aus dem
  Windows-Anmeldeinformationsspeicher; kann auch DDL. Token wird nie ausgegeben.

## Deploy
- **Auto-Deploy ist aktiv** (Stand 21.08.2026). Das Vercel-Projekt ist mit
  `pawe1307/weich-bestellshop` verbunden; ein Push nach `master` loest ein
  Production-Deployment aus. Die aeltere Notiz „kein Auto-Deploy" vom 19.08.
  ist ueberholt.
- Ablauf: `npx vite build` (Check), commit, `git push` — ab da ist es live.
- **Unfertiges gehoert auf einen Branch**, nicht auf `master`. Branch-Pushes
  erzeugen Vorschau-Deployments und lassen die Produktion unberuehrt.
- `npx vercel --prod` geht weiterhin, deployt aber den **lokalen Ordner** statt
  des Repos — im August hat das bei der Service-Ticket-App vier Monate Arbeit
  aus der Produktion entfernt. Im Zweifel nicht verwenden.
- Das Projekt zieht ins Vercel-Team `weich-team` um; danach gilt fuer die CLI
  `--scope weich-team`.
- `.env` wird via Vercel-Env-Vars gepflegt, `.env.example` im Repo

## Cross-App-Integration
- `employees`-Tabelle ist Single Source of Truth (shared mit den anderen drei Apps)
- SELECT auf employees: explizite Spaltenliste (kein SELECT * wegen Column REVOKE)
- `berechtigungen`-JSON steuert App-Zugriffe und Rollen fuer alle vier Apps
- Realtime-Sync fuer Bestellwuensche & Sammelbestellungen: kommt in Phase 4

## Wichtige Regeln
- Artikel haben **drei** Sichtbarkeiten: `bestellbar` (Shop-Katalog) und
  `nachkalkulation_klima` (Nachkalkulation, Platzhalter in neuen
  Klima-Auftraegen) aus Migration 014, seit 10.09.2026 dazu `sichtbar_aufmass`
  (Artikelkatalog der Aufmass-App). Der Katalog filtert auf `bestellbar`, die
  Nachkalkulation auf `nachkalkulation_klima`. Gepflegt werden alle drei im
  Artikeldialog unter „Sichtbarkeit"; die Admin-Katalogliste zeigt sie als
  Abzeichen. Der Shop ist der **Artikelstamm fuer das Aufmass** auf der
  Baustelle — die Aufmass-App (Repo `weich-aufmass`) liest nie `shop_artikel`
  direkt, sondern die preisfreie Sicht `aufmass_artikel_katalog`, weil Monteure
  kein `has_shop_access()` haben.
- Immer auf Deutsch (UI, Kommentare, KI-Output)
- Chakra v3 Syntax: `Dialog.Root`, `Tabs.Root`, `Select` mit `createListCollection`
- Fail-closed Auth-Check: KEIN `?? true` — nicht gesetzt = kein Zugriff
- User sieht KEINE Preise im Katalog (nur Admin sieht Preise) — bewusste Entscheidung
- Verbrauchsmaterial (C-Teile) — hochwertige B-Teile bleiben im ERP

## Architektur
- `src/main.jsx` — Root: Chakra + Router + Query + Auth + ErrorBoundary
- `src/App.jsx` — Routen: Public LoginPage + Protected Layout mit Nested Routes
- `src/app/contexts/AuthContext.jsx` — Supabase Auth + Access-Check
- `src/app/components/Layout.jsx` — Nav-Bar + Outlet
- `src/app/pages/` — Katalog, Warenkorb, Bestellungen, Bedarf, Favoriten + Admin-Pages
- `src/data/api/` — API-Layer pro Entitaet (kommt ab Phase 2)
- `supabase/migrations/` — SQL-Migrationen (kommt ab Phase 2)

## KI (spaeter)
Neue Edge Function `shop-ai` mit taskbasiertem Routing:
- Vision (Foto→Artikel, Beleg→Positionen): Sonnet 4.6
- Text (Kategorie/Tag/Beschreibung): Haiku 4.5
- Browser-Agent (Phase 7/8): Sonnet 4.6 mit Tool-Use

## PDS-Anbindung (Stand 04.09.2026, in Betrieb)
- Der Shop ist **Anlage-Kanal fuer den PDS-Artikelstamm** — PDS bleibt
  Systemfuehrer. Siehe ADR 0005.
- Nicht ueber den MCP-Server, sondern direkt per Edge Function mit dem Key aus
  `integration_secrets` (Muster: `weich-energie-app/functions/pds-preise`).
- `pds-katalog-sync` schreibt: Whitelist auf vier Katalog-Pfade plus
  `/vorgang/create` fuer das Musterangebot (einziger Weg zum Katalog-VK).
  Trockenlauf ist Standard, Protokoll in `shop_pds_sync_log`. Angelegt wird nur
  bei `pds_katalog_uuid is null` — `/katalog/delete` greift in PDS nur ohne
  Bestand und Verwendung, eine Dublette bleibt fuer immer stehen.
- `pds-auftrag-soll` liest Soll-Werte und Einzelpositionen fuer die
  Nachkalkulation. Rein lesend.
- `pds-auftrag-material` bringt das verbaute Material in den Auftrag (ADR 0007):
  Neue Klima-Auftraege tragen seit Meghs Anlage eine Ebene „Montagematerial
  (Nachkalkulation)" mit Platzhaltern (Menge 0) aus der Sicht
  `shop_pds_montagematerial_platzhalter` (Kennzeichen `nachkalkulation_klima` am
  Artikel). Der Shop setzt dort die Mengen per `/vorgang/updateposition` —
  nur Menge, nur Shop-Artikel. Material ohne Platzhalter und aeltere Auftraege
  gehen als Transportangebot bei der Weich GmbH (`/vorgang/create`, ANGEBOT,
  Praefix `ZZ-TRANSPORT`) zum Kopieren im Client (ADR 0006). Grund fuer beides:
  Die API kann an einen bestehenden Auftrag keine Positionen anhaengen; der
  Nachtragsauftrag war der erste Versuch und ist verworfen. Positionen tragen
  `pds_transport_at`, nichts geht zweimal. Vorgaenge sind per API nicht
  loeschbar. Siehe docs/pds-montagematerial-platzhalter.md.
- Kategorien, Warengruppen und Kalkulationsgruppen sind per API nur lesbar;
  die Klima-Struktur steht seit 01.09.2026 (docs/pds-klima-warengruppen.md).

## Domain-Doku
- [CONTEXT.md](CONTEXT.md) — Domain-Glossar
- [ROADMAP.md](ROADMAP.md) — Phasen 0-9
- [docs/adr/](docs/adr/) — Architektur-Entscheidungen
- [docs/pds-inbetriebnahme.md](docs/pds-inbetriebnahme.md) — Reihenfolge der Inbetriebnahme
- [docs/pds-katalog-mapping.md](docs/pds-katalog-mapping.md) — Feld- und ID-Mapping Shop → PDS
- [docs/pds-klima-warengruppen.md](docs/pds-klima-warengruppen.md) — Klima-Warengruppen und Umzugsliste
- [docs/nachkalkulation-datenmodell.md](docs/nachkalkulation-datenmodell.md) — Soll/Ist-Modell
- [docs/pds-nachtragsauftrag.md](docs/pds-nachtragsauftrag.md) — warum kein Nachtrag: Befund und Test
- [docs/artikelpflege-lieferantendaten.md](docs/artikelpflege-lieferantendaten.md) — Shop als aktuelle Wahrheit fuer C-Teile, Import-Skript, PDS-Abgleich
- [docs/lieferanten-shop-zugaenge.md](docs/lieferanten-shop-zugaenge.md) — Abruf hinter dem Login (VPS), Playbook Frigotechnik, neue Shops anbinden
- [docs/pds-montagematerial-platzhalter.md](docs/pds-montagematerial-platzhalter.md) — Platzhalter-Ebene fuer die Auftragsanlage (an Megh)
- [docs/aufmass-formteil-modell.md](docs/aufmass-formteil-modell.md) — GUT-Export, R+F-Zuordnung, Formteil-Mittelwert je System+Dimension (Ziel-Schritte 1-3)
- [docs/gut-korb-pds-zuordnung.md](docs/gut-korb-pds-zuordnung.md) — GUT-Koerbe → PDS-Auftraege (lesend, `tools/vps/korb-pds-abgleich.mjs`), Abrechnungsstatus, Vergleich alt/neu auf 58 abgerechneten Baustellen
- [docs/aufmass-app-entwurf.md](docs/aufmass-app-entwurf.md) — Entwurf der Aufmass-App (Repo `weich-aufmass`, Ziel-Schritt 4)
- [docs/aufmass-pds-uebergabe-plan.md](docs/aufmass-pds-uebergabe-plan.md) — PDS-Uebergabe aus der Aufmass-App: Function `aufmass-pds-uebergabe`, Katalog-Sync der Kunstartikel, erster Lauf (Ziel-Schritt 5)
- [docs/pds-formteil-platzhalter.md](docs/pds-formteil-platzhalter.md) — Platzhalter-Ebene "Formteile (Aufmass)" fuer neue SHK-Auftraege (an Megh), Sicht `shop_pds_formteil_platzhalter`
- [docs/rf-lagerliste-echte-preise.md](docs/rf-lagerliste-echte-preise.md) — **Richtungswechsel 09.09.2026:** GUT-Koerbe sind nur Kalkulationsbasis, verbaut wurde R+F. Preise kommen aus dem Lagerauszug, Gewichte aus der Historie; Leseskript `tools/lager-auszug-lesen.py`. Abdeckung damit 91,2 %, Baustellen-Vergleich +23,3 %
- [docs/formteil-preisklassen.md](docs/formteil-preisklassen.md) — warum ein Mittelwert je Dimension zu grob ist: Gewindeteile sind 41,7 % der Menge und kosten 1,7x, Vorschlag zwei Preisklassen (`presse` / `gewinde`)
- [docs/strichliste-zuschnitt.md](docs/strichliste-zuschnitt.md) — **Zweck der Historie: Mengengeruest.** Wie viele Zeilen die Strichliste braucht (heute 32 Artikel je Baustelle, Vorschlag 14 Felder), welche Hebel wirklich vereinfachen
- [docs/systemwechsel-35mm-edelstahl.md](docs/systemwechsel-35mm-edelstahl.md) — 35 mm+ Kupfer/C-Stahl ist 48 % des historischen Verbrauchs und wird auf Heizungsedelstahl umgestellt — wichtig fuer die Frage, welche Gruppen ueberhaupt noch gebraucht werden (der Preisvergleich darin ist eine Nebenrechnung, nicht das Projektziel)

## Formteil-Kunstartikel (07.09.2026)
`shop_artikel.formteil_aufmass = true` markiert 57 Kunstartikel „Formteil
<System> <Dimension>" mit dem mengengewichteten R+F-Mittelwert als Preis —
nie `bestellbar`, kein echter Lieferant. Grundlage der kuenftigen
PDS-Uebergabe aus der Aufmass-App. Siehe docs/aufmass-formteil-modell.md.
`shop_gut_positionen.rf_zuordnung_quelle` kennt seit 09.09.2026 drei Stufen:
`automatisch` (Pruefregeln bestanden), `vermutet` (bestplatzierter Kandidat,
Entscheidung Patrick 08.09.) und `manuell`. Auswertungen sollen `vermutet`
herausfiltern koennen — der Mittelwert liegt damit deutlich hoeher.

**Wichtig (09.09.2026):** Die GUT-Warenkoerbe sind **keine Liste des verbauten
Materials**, sondern nur die Kalkulationsbasis — verbaut wurden R+F-Artikel,
erfasst per Strichliste auf GUT-Vordrucken. Preise gehoeren deshalb aus
Patricks R+F-Lagerauszug, nicht aus einer Textsuche; die Historie liefert nur
noch die Mengengewichte. Siehe docs/rf-lagerliste-echte-preise.md.

## Mischsaetze: gemessen oder uebertragen (13.09.2026)
`shop_formteil_gruppenpreis` ist die **gemessene Historie** und bleibt es.
`shop_formteil_gruppenpreis_uebertragen` haelt Saetze, deren Mengengeruest von
einem anderen System kommt, weil die eigene Historie zu duenn ist — seit
13.09.2026 die vier Heizungsedelstahl-Gruppen mit dem Teile-Mix von C-Stahl.
**Gerechnet wird mit `shop_formteil_gruppenpreis_effektiv`**, das beides
uebereinanderlegt; `herkunft` sagt, woher der Satz kommt. Herleitung und
Rueckbau-Regel: `docs/mengengeruest-uebertragen.md`.

Wer einen Mischsatz prueft, misst den **Hebel**: um wie viel aendert sich der
Satz, wenn genau dieser Artikel aus der Gruppe faellt. Ein teures Teil mit einem
Stueck bewegt nichts, ein mittelteures mit 200 Stueck viel. Besonders zu pruefen
sind `vermutet`-Zuordnungen auf R+F-Artikel, die **nicht im Lagerauszug stehen**
— deren Preis laesst sich an nichts abgleichen. Genau dort lag die
Megapress-Fehlzuordnung mit 11 389 EUR.

## Artikelstruktur: wer ist Master (15.09.2026)
**Der Bestellshop ist der Master.** `shop_artikel` ist der Stamm, gepflegt ueber
die Admin-Katalogseite und den Artikeldialog; die drei Sichtbarkeiten
(`bestellbar`, `nachkalkulation_klima`, `sichtbar_aufmass`) entscheiden, wo ein
Artikel auftaucht. Die Aufmass-App liest nur `aufmass_artikel_katalog`. Ein
neuer Nachkalkulationsartikel wird hier angelegt — der Stamm waechst also im
Shop, nicht in Migrationen.

**Die Zuordnung GUT -> R+F ist seit 15.09.2026 ein eigenes Stammdatum:**
`shop_gut_rf_zuordnung` (Migration `20260915120000`). Vorher lebte sie nur in
`shop_gut_positionen.rf_artikelnummer`, also an den Verbrauchszeilen der
Warenkoerbe — und damit nirgends fuer einen Artikel ohne Verbrauch. Das hat
zugeschlagen: von Patricks 36 Zuordnungen liessen sich nur 9 dort schreiben,
27 fielen stillschweigend durch. Die Zaehllisten-Zeilen entstanden trotzdem,
aber ein Neuaufbau haette die Entscheidungen verloren.

- `entscheidung`: `zugeordnet` | `entfaellt` | `offen`. `entfaellt` haelt fest,
  dass ein Artikel bewusst nicht mehr gefuehrt wird (13 Stueck aus Patricks
  Durchsicht) — damit taucht er in Lueckenlisten nicht wieder auf.
- Stand: 399 zugeordnet, 13 entfaellt.
- Bewusst **ohne Fremdschluessel** auf `shop_artikel.artikelnr`: eine Zuordnung
  darf einer Nummer vorausgehen, die noch nicht im Katalog steht.
- **Zuordnungen gehoeren ab jetzt hierhin**, nicht (nur) an die Positionen.
  `shop_gut_positionen.rf_artikelnummer` bleibt fuer die Bewertung der
  Historie, ist aber nicht mehr der Ort der Entscheidung.

Diese Tabelle ist die Voraussetzung fuer die **Mischsatz-Ueberwachung** aus
Einzelaufmassen (Patricks Vorhaben vom 15.09.2026): um aus einer gezaehlten
R+F-Position den Ist-Mischsatz zu rechnen, braucht man ihre Formteil-Gruppe,
und die steht an den GUT-Artikeln in `shop_gut_artikel_klassifikation`. Ueber
die Zuordnung ist sie fuer **182 der 323 Detail-Artikel ableitbar** — genau die
Formteile, um die es bei den Mischsaetzen geht. 61 sind als Ventil, Rohr,
Daemmung oder Schelle klassifiziert (Einzelartikel, brauchen keine Gruppe),
30 haben ein GUT-Gegenstueck ohne Klassifikation, 50 sind Regal-Artikel ohne
Historie. Die Spalten `shop_artikel.formteil_system` /
`formteil_dimensionsgruppe` / `formteil_preisklasse` sind bei diesen Artikeln
noch leer und muessten daraus gefuellt werden.

## Mischsaetze gegenpruefen (15.09.2026)
Patricks Vorhaben: die Sammelansicht der Aufmass-App fuer einige Wochen
sperren, Projekte ueber die Zaehlliste erfassen lassen und danach pruefen, ob
die Mischkostensaetze stimmen. Gesperrt ist seit 15.09.2026
(`aufmass_einstellungen.ansicht_erlaubt = 'detail'`).

- **`shop_mischsatz_ist`** rechnet aus abgeschlossenen Detail-Aufmassen den
  mengengewichteten Ist-Satz je Formteil-Gruppe — dieselbe Formel wie der
  Soll-Satz, nur mit dem Mengengeruest der Stichprobe.
- **`shop_mischsatz_vergleich`** stellt Soll und Ist nebeneinander, mit
  `soll_herkunft` (gemessen oder uebertragen), Abweichung in EUR und Prozent
  und einem `befund`. Der Befund schweigt unter 30 Stueck Stichprobe und nennt
  alles innerhalb von 10 Prozent `bestaetigt`.
- **Am wichtigsten bei `uebertragen`**: die vier Heizungsedelstahl-Gruppen
  tragen das C-Stahl-Mengengeruest, also eine Annahme. Hier wird sie erstmals
  gemessen.
- Nachgestellt mit einem bewusst bogenlastigen Aufmass (294 Stueck, 12 Artikel):
  Edelstahl 22-28 presse kam auf Ist 3,0394 gegen Soll 4,1210 EUR, −26,2 %,
  Befund „Satz zu hoch". Die Probe-Erfassung wurde danach geloescht.

**Voraussetzung war die Formteil-Gruppe an den R+F-Artikeln**
(`shop_artikel.formteil_system` / `formteil_dimensionsgruppe` /
`formteil_preisklasse`, Migrationen `20260915140000` und `20260915150000`).
Sie stand vorher nur an den GUT-Artikeln. 207 der 323 Zaehllisten-Artikel
tragen jetzt eine Gruppe; 60 sind Ventil, Rohr, Daemmung oder Schelle und
gehoeren in keine; 50 sind Regal-Artikel ohne Historie. Fuenf bleiben bewusst
gruppenlos — vier Systemrohre und die Verschraubung Nr. 330, die am 11.09.2026
absichtlich aus den Gruppenpreisen genommen wurde (eine Gruppe waere dort eine
Doppelzaehlung).

**Zwei Fehlzuordnungen dabei gefunden**, beide noch offen:
- `POVT35` (Prestabo-T-Stueck 35 mm, **1 655 EUR / 148 Stueck**) zeigt auf
  `7020900558932` — einen Artikel *mit* Innengewinde. Ein reines T-Stueck ist
  guenstiger, der Satz prestabo-stahl / 35mm+ / presse ist also zu hoch.
- `COCIUS3525ANL` (Uebergangsstueck **35** mm x 1", **486 EUR / 56 Stueck**)
  zeigt auf `7085472283000` — ein Uebergangsstueck in **d = 28**.
Beide brauchen den richtigen R+F-Artikel aus dem Shop; die falsche Nummer
einfach zu loeschen wuerde den Verbrauch unbewertet lassen.

## Geteilte Zuordnungen: ein Teil, ein Artikel (17.09.2026)
Patricks Vorgabe: „Ne brauchen schon einzeln". In der Zaehlliste standen Artikel
doppelt, weil mehrere GUT-Artikel auf denselben R+F-Artikel zeigten --
42 R+F-Artikel waren von 86 GUT-Artikeln belegt.

**Der Befund dahinter: B-press und Profipress sind zwei Hersteller**, nicht zwei
Namen fuer dasselbe Teil. B-press heisst bei R+F „Sudo-Press-Fitting",
Profipress ist Viega. Die GUT-Paare `BP*`/`PP*` waren deshalb keine harmlosen
Doppelnummern, sondern falsch zusammengelegt.

- Aufgeloest ueber die Nummernsuche plus merkmalsgebundenen Abgleich der
  Treffer (Teileart, Anschluss I/I oder I/A, Winkel, AG oder IG, Dimension,
  Gewindegroesse). Uebernommen nur, wo **genau ein** Kandidat widerspruchsfrei
  passt: 25 von 86, dazu 5 ueber den Ausfuehrungs-Reiter. 15 Artikel bleiben
  geteilt (`daten/geteilte-zuordnungen-offen.csv`, 13 288 EUR).
- Groesster Einzelfall: `BPB35` („Bogen B-press 35mm 90 Grad", also **I/I**)
  zeigte auf den Bogen **I/A** -- den mit Einsteckende, der seinem eigenen
  Gegenstueck `BPB35A` gehoert. 8 990 EUR auf 691 Stueck falsch bepreist.
- Fuer CONNECT INOX findet die Nummernsuche **nichts**: R+F hat die
  CONEL-Nummern nicht als Wettbewerbsnummern hinterlegt. Dort fuehrt nur der
  Ausfuehrungs-Reiter derselben Produktseite zum Ziel.
- **Nicht gefunden:** der Bogen 45 I/A (`COCIB2245ELKNL`, `COCIB3545ELNL`). Die
  OptiSteel-Reihe fuehrt 45-Grad-Boegen offenbar nur als I/I.

**Reihenfolge-Falle in Migrationen:** Migration `20260915170000` setzte die
Stueckpreise per Subselect, legte die betroffenen Artikel aber erst im Schritt
danach an -- der Subselect fand sie nicht und schrieb NULL. Vier Positionen mit
1 715 EUR fielen damit aus jeder Bewertung, darunter POVT35 mit 1 655 EUR.
`20260917130000` traegt sie nach. **Artikel immer VOR dem Preis-Update anlegen**,
und danach `rf_ek_netto_stueck is null` gegenpruefen.

Wirkung aller Korrekturen des 17.09. auf die Mischsaetze: elf Saetze zwischen
−0,5 und +7,3 % (b-press 22-28 gewinde 8,46 -> 9,08, prestabo 35mm+ presse
7,09 -> 7,41). Die B-press-Gewindesaetze steigen, weil die Sudo-Press-Teile
teurer sind als die PROFIPRESS-Gegenstuecke, auf die sie zeigten.

## Doku-Regel
Wenn sich eine Kern-Entscheidung aendert: ADR schreiben, CLAUDE.md updaten, CONTEXT.md pflegen.
