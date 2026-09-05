#!/usr/bin/env bash
# Hinterlegt Benutzer und Passwort fuer einen Lieferanten-Shop in
# /opt/weich-browser/.env — nur auf diesem Host, nur fuer root lesbar.
#
# Das Passwort erscheint nirgends: nicht am Bildschirm (read -s), nicht in der
# Shell-Historie (wird abgefragt, nicht als Argument uebergeben), nicht im Chat.
#
# Aufruf auf dem eigenen Rechner:
#   ssh -t root@187.127.87.15 bash /opt/weich-browser/lieferant-login-setzen.sh frigotechnik
#
# Danach kann produkt.mjs sich bei diesem Lieferanten anmelden.
set -euo pipefail
cd /opt/weich-browser

SLUG="${1:?Aufruf: lieferant-login-setzen.sh <slug>   (z.B. frigotechnik)}"
if ! [[ "$SLUG" =~ ^[a-z0-9-]+$ ]]; then
  echo "Slug darf nur Kleinbuchstaben, Ziffern und Bindestrich enthalten." >&2
  exit 1
fi
PREFIX="LIEFERANT_$(echo "$SLUG" | tr 'a-z-' 'A-Z_')"

read -r -p "Benutzer fuer $SLUG: " BENUTZER
read -r -s -p "Passwort: " PASSWORT; echo
if [ -z "$BENUTZER" ] || [ -z "$PASSWORT" ]; then
  echo "Abbruch: Benutzer oder Passwort leer." >&2
  exit 1
fi

touch .env
chmod 600 .env
# Alte Eintraege dieses Lieferanten entfernen, neue anhaengen.
grep -v -E "^${PREFIX}_(BENUTZER|PASSWORT)=" .env > .env.neu || true
{
  cat .env.neu
  printf '%s_BENUTZER=%s\n' "$PREFIX" "$BENUTZER"
  printf '%s_PASSWORT=%s\n' "$PREFIX" "$PASSWORT"
} > .env
rm -f .env.neu
chmod 600 .env
unset PASSWORT

echo "Zugang fuer $SLUG hinterlegt (${PREFIX}_BENUTZER=$BENUTZER). Passwort-Laenge: $(grep -E "^${PREFIX}_PASSWORT=" .env | cut -d= -f2- | wc -c | xargs expr -1 +)"
echo "Probe: node /opt/weich-browser/produkt.mjs --lieferant $SLUG --login-test"
