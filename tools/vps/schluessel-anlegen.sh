#!/usr/bin/env bash
# Legt die Geheimnisse an, mit denen der VPS die im Shop hinterlegten
# Lieferanten-Zugaenge holen und entschluesseln kann:
#   SUPPLIER_CRED_KEY   32 Byte base64 — AES-256-GCM-Schluessel, identisch in
#                       Supabase (Edge Function lieferant-zugang) und hier
#   VPS_ZUGANG_TOKEN    Kennwort, mit dem der VPS die Chiffre von der Edge
#                       Function abholen darf
# Beides wird hier erzeugt, in /opt/weich-browser/.env geschrieben (root, 600)
# und einmalig als Datei fuer `supabase secrets set --env-file` bereitgelegt.
# Kein Wert wird ausgegeben. Bestehende Werte bleiben unveraendert.
set -euo pipefail
cd /opt/weich-browser
touch .env; chmod 600 .env

wert() { grep -E "^$1=" .env | head -1 | cut -d= -f2- || true; }

KEY="$(wert SUPPLIER_CRED_KEY)"
if [ -z "$KEY" ]; then
  KEY="$(openssl rand -base64 32)"
  printf 'SUPPLIER_CRED_KEY=%s\n' "$KEY" >> .env
  echo "SUPPLIER_CRED_KEY erzeugt."
else
  echo "SUPPLIER_CRED_KEY vorhanden, bleibt."
fi

TOKEN="$(wert VPS_ZUGANG_TOKEN)"
if [ -z "$TOKEN" ]; then
  TOKEN="$(openssl rand -hex 32)"
  printf 'VPS_ZUGANG_TOKEN=%s\n' "$TOKEN" >> .env
  echo "VPS_ZUGANG_TOKEN erzeugt."
else
  echo "VPS_ZUGANG_TOKEN vorhanden, bleibt."
fi

# Fuer die Supabase-Seite: wird per scp geholt, eingespielt und dann geloescht.
umask 077
printf 'SUPPLIER_CRED_KEY=%s\nVPS_ZUGANG_TOKEN=%s\n' "$KEY" "$TOKEN" > /root/supabase-secrets.env
echo "Datei fuer Supabase: /root/supabase-secrets.env (nach dem Einspielen loeschen)."
echo "WICHTIG: SUPPLIER_CRED_KEY in den Passwortmanager sichern — ohne ihn sind hinterlegte Zugaenge unlesbar."
