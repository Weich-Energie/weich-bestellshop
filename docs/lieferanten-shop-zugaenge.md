# Lieferanten-Shops hinter dem Login — Preise für den Artikelstamm

Stand 05.09.2026. Gewerbe-Shops zeigen Netto-Preise nur angemeldet. Damit
Patrick den Bestellshop mit Links füttern kann und daraus Artikel mit echtem
Einkaufspreis entstehen, gibt es auf dem VPS `weich-code` einen Abruf hinter
dem Login. Das ist der erste Baustein des Meilensteins „Zugänge zu den Shops";
weitere Lieferanten kommen als Playbook dazu.

## Bausteine auf dem VPS (`/opt/weich-browser`)

| Datei | Aufgabe |
|---|---|
| `lieferant-login-setzen.sh <slug>` | fragt Benutzer und Passwort ab und legt sie als `LIEFERANT_<SLUG>_BENUTZER/_PASSWORT` in `.env` (root, 600). Nichts erscheint im Klartext, nichts läuft durch den Chat. |
| `produkt.mjs` | meldet sich mit diesen Daten an, speichert die Sitzung unter `state/<slug>.json`, öffnet eine Produkt-URL und gibt JSON aus: Titel, Artikelnummer, Herstellernummer, Matchcode, Verkaufseinheit, alle Preisangaben, Seitentext, Screenshot. |
| `test-frigo.sh` | Probe: Login-Test und öffentliche Produktseite. |

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
- Suche: `https://www.frigotechnik.de/?cl=search&searchparam=<begriff>`.
- Kategorie „Installationsmaterial / Konsolen & Profile" ist der Einstieg für
  die Klima-C-Teile.
- Der Preis-Selektor nach Login ist noch nicht bekannt; `produkt.mjs` sammelt
  vorerst alle Textstellen mit €-Zeichen und deren CSS-Klassen. Nach dem ersten
  angemeldeten Abruf den Selektor hier eintragen und im Skript festziehen.

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
