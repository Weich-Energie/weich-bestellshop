# Lieferanten-Shops hinter dem Login — Preise für den Artikelstamm

Stand 05.09.2026. Gewerbe-Shops zeigen Netto-Preise nur angemeldet. Damit
Patrick den Bestellshop mit Links füttern kann und daraus Artikel mit echtem
Einkaufspreis entstehen, gibt es auf dem VPS `weich-code` einen Abruf hinter
dem Login. Das ist der erste Baustein des Meilensteins „Zugänge zu den Shops";
weitere Lieferanten kommen als Playbook dazu.

## Bausteine auf dem VPS (`/opt/weich-browser`)

| Datei | Aufgabe |
|---|---|
| `lieferant-login-setzen.sh <slug>` | Notweg ohne Shop: fragt Benutzer und Passwort ab und legt sie als `LIEFERANT_<SLUG>_BENUTZER/_PASSWORT` in `.env`. Normalfall ist das Hinterlegen im Shop, siehe unten. |
| `schluessel-anlegen.sh` | erzeugt einmalig `SUPPLIER_CRED_KEY` (AES-256-GCM) und `VPS_ZUGANG_TOKEN`, schreibt sie in `.env` und legt eine Datei für `supabase secrets set --env-file` bereit. Am 05.09.2026 ausgeführt; beide stehen als Supabase-Secrets. **Den Key in den Passwortmanager sichern.** |
| `produkt.mjs` | meldet sich mit diesen Daten an, speichert die Sitzung unter `state/<slug>.json`, öffnet eine Produkt-URL und gibt JSON aus: Titel, Artikelnummer, Herstellernummer, Matchcode, Verkaufseinheit, alle Preisangaben, Seitentext, Screenshot. |
| `shop-lib.mjs` | gemeinsamer Unterbau: Playbooks, Login, Sitzung, Auslesen einer Produktseite, Blättern durch Trefferlisten. |
| `sammeln.mjs` | ganze Suche oder Warengruppe: sammelt alle Produkt-URLs über alle Seiten (`--suche "Kabelkanal"` oder `--liste <kategorie-url>`), ruft jede Seite in einer Sitzung ab, schreibt ein JSON mit allen Produkten (`--out`). `--max` begrenzt, `--nur-urls` listet nur. |
| `test-frigo.sh` | Probe: Login-Test und öffentliche Produktseite. |

Lokal (`~/.weich-db`): `shop-zu-eingabe.mjs <roh.json> --klasse fest|verbrauch|auto --nachkalk --out <eingabe.json>` übersetzt das Sammelergebnis in die Eingabedatei für `artikel-import.mjs`. Preise werden nur übernommen, wenn eine Netto-Zahl eindeutig erkannt ist; alles andere bleibt leer und wird aufgelistet.

Aufrufe (immer über das PowerShell-Werkzeug, SSH-Key liegt im Windows-Agent):

```
ssh -t root@187.127.87.15 bash /opt/weich-browser/lieferant-login-setzen.sh frigotechnik   # einmalig, Patrick selbst
node produkt.mjs --lieferant frigotechnik --login-test
node produkt.mjs --lieferant frigotechnik --shot /tmp/x.png <produkt-url>
node produkt.mjs --lieferant frigotechnik --ohne-login <produkt-url>        # nur öffentliche Daten
```

Vorsicht bei Remote-Kommandos aus PowerShell: Backslash-Escapes (`\r`) kommen
zerlegt an; `sed 's/\r$//'` löscht dann Buchstaben „r". Skripte lokal schreiben,
per `scp` hochladen, nur `bash <datei>` remote aufrufen.

## Zugänge im Shop hinterlegen (Normalfall)

Admin → Lieferanten → „Zugang hinterlegen". Die Edge Function `lieferant-zugang`
verschlüsselt Benutzer und Passwort mit `SUPPLIER_CRED_KEY` und speichert nur
die Chiffre in `shop_lieferanten.zugang_chiffre`; auslesen kann sie kein
Nutzer (Spalten-REVOKE). Der VPS holt die Chiffre über dieselbe Function mit
dem Header `x-vps-token` (= `VPS_ZUGANG_TOKEN`, Aktion `chiffre`, `slug`) und
entschlüsselt sie lokal mit demselben Key (`shop-lib.mjs`, `zugang()`).
Klartext gibt es nur im Speicher des Abrufprozesses. Reihenfolge der Suche:
erst `.env` (Notweg), dann Shop.

Dafür stehen in `/opt/weich-browser/.env`: `SUPPLIER_CRED_KEY`,
`VPS_ZUGANG_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (der anon-Key ist
öffentlich, er dient nur dem Gateway; die eigentliche Prüfung ist der Token).

## Playbook Frigotechnik (`frigotechnik.de`, OXID eShop mit B2B-Portal)

- Login-Seite: `https://www.frigotechnik.de/mein-konto/`. Der Knopf „Zum
  Kundenportal" (`a[data-info="login"]`) öffnet ein Popup.
- Formular: `input[name="username"]`, `input[name="password"]`, Checkbox
  `login_cookie`, Knopf „Anmelden"; geht per Ajax an
  `cl=tc_b2b_ajax_login&fnc=login`. Nach Erfolg lädt die Seite neu, der
  Kundenportal-Knopf verschwindet.
- Produkt-URLs: `https://www.frigotechnik.de/<slug>-<artikelnummer>.html`, die
  Artikelnummer ist siebenstellig am Ende (z. B. `…-2032030.html`).
- Öffentlich sichtbar: Titel, „Artikelnummer: 2032030OEM-Nummer: MS257 105"
  (ohne Trenner, deshalb Regex mit Vorausschau), „Ausgabe: 1 Stück"
  (Verkaufseinheit), Matchcode, Verpackungsgröße, Beschreibung, und der Satz
  „Bitte loggen Sie sich ein, um den Preis zu sehen".
- Suche: `https://www.frigotechnik.de/?cl=search&searchparam=<begriff>`, Blättern mit `&pgNr=N` (0-basiert, 24 Treffer je Seite).
- Warengruppen haben feste URLs: `https://www.frigotechnik.de/Installationsmaterial/Konsolen-Profile/`, Blättern mit `/2/`, `/3/` …; Unterkategorien von Installationsmaterial u. a. Befestigungsmaterial, Isoliermaterialien, Isoliertes-Kupferrohr, Kabelschutz, Konsolen-Profile, Kunststoffrohr-Systeme, Kupferrohr, Loetfittings, Schellen, Schlaeuche, Verschraubungen. Probe am 05.09.2026: Konsolen & Profile = 123 Produkte auf 6 Seiten.
- Kategorie „Installationsmaterial / Konsolen & Profile" ist der Einstieg für
  die Klima-C-Teile.
- Angemeldet (Kunde 10108920, Weich GmbH) steht im Produktkopf „Nettopreis:
  31,93 €" (Element `.h1.primary`) und „Bruttopreis: 53,21 €", dahinter der
  Bestand „91 Stück". `shop-lib.mjs` liefert das als `netto_preis`,
  `brutto_preis`, `bestand`. Achtung: Alternativ- und Empfehlungsartikel weiter
  unten tragen „Nettopreis 30,21 €" ohne Doppelpunkt — deshalb nur der erste
  Treffer mit Doppelpunkt. Erster Abruf mit Preis am 05.09.2026.
- Login-Erfolg erst nach dem Neuladen prüfen: auf den Link „Abmelden" warten,
  `networkidle` kommt zu früh (Fehlersuche mit `login-debug.mjs <slug>`).

## Von der Warengruppe zum Artikelstamm (Ziel: „Warengruppe + Shop nennen, Rest läuft")

```
ssh: node sammeln.mjs --lieferant frigotechnik --liste <kategorie-url> --out /tmp/x.json
scp zurück nach ~/.weich-db/eingaben/roh/
node shop-zu-eingabe.mjs eingaben/roh/x.json --klasse auto --nachkalk --out eingaben/<datum>-frigotechnik-<gruppe>.json
node artikel-import.mjs eingaben/<datum>-frigotechnik-<gruppe>.json          # Trockenlauf
node artikel-import.mjs eingaben/<datum>-frigotechnik-<gruppe>.json --schreiben
```

## Vom Link zum Artikel

1. Patrick gibt eine oder mehrere Produkt-URLs (oder eine Suchseite).
2. `produkt.mjs` holt die Daten hinter dem Login.
3. Daraus entsteht eine Eingabedatei für `~/.weich-db/artikel-import.mjs`
   (siehe docs/artikelpflege-lieferantendaten.md) mit `lieferant: Frigotechnik`,
   `artikelnr`, `lieferant_url`, `preis_netto`, `preis_stand` = heute,
   `quelle: frigotechnik-shop`.
4. Trockenlauf, dann `--schreiben`. Die Preishistorie führt der Trigger.

## Neuen Lieferanten anbinden

1. Shop im Browser anschauen: Login-Seite, Formularfelder, Produkt-URL-Muster,
   wo Preis, Artikelnummer und Einheit stehen.
2. Playbook in `produkt.mjs` unter `PLAYBOOKS[slug]` ergänzen (`loginUrl`,
   `login()`, `istAngemeldet()`, `pruefUrl`).
3. Zeile in `shop_lieferanten` (slug, name, login_url, produkt_url_muster).
4. Patrick hinterlegt den Zugang mit `lieferant-login-setzen.sh <slug>`.
5. `--login-test`, dann ein Produkt.

## Abgrenzung zum Bestell-Bot (ADR 0004)

Dieser Abruf liest nur. Er kauft nicht, legt nichts in Warenkörbe, ändert
nichts im Kundenkonto. Der Bestell-Bot mit `bot_jobs`, verschlüsselten
Zugängen in `shop_lieferanten.zugang_chiffre` und `SUPPLIER_CRED_KEY` ist ein
eigener Schritt; der Master-Key existiert bis heute weder auf dem VPS noch als
Supabase-Secret. Der Abruf hier braucht ihn nicht.
