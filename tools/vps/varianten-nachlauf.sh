#!/usr/bin/env bash
# varianten-nachlauf.sh — nachholen, was der erste Preisvergleich vom 07.09.2026
# uebersehen hat: R+F fuehrt Dimensionen und Groessen als Ausfuehrungen eines
# Produkts, nicht als eigene Artikel. Die Suche liefert nur eine davon.
# Siehe docs/lieferanten-shop-zugaenge.md, Abschnitt "R+F Varianten".
#
# Aufruf auf dem VPS: bash /opt/weich-browser/varianten-nachlauf.sh
# Ergebnisse in /tmp/var-*.json, danach per scp abholen.
cd /opt/weich-browser || exit 1

echo "=== 1. Kaeltemittelleitungen: Ausfuehrungen der R+F-Produkte ==="
# ECUTHERM II Twin (guenstigster Fund, 1/4+3/8) — hier stecken die anderen
# Dimensionen drin, u. a. 1/4+1/2 (2029835141220, per Screenshot bestaetigt).
node rf-varianten.mjs \
  https://rf24.de/produkt/2029835143820 \
  https://rf24.de/produkt/2020650706120 \
  https://rf24.de/produkt/2020650710160 \
  https://rf24.de/produkt/2020650516000 \
  https://rf24.de/produkt/2026091613181 \
  https://rf24.de/produkt/2021433701501 \
  --out /tmp/var-leitungen.json 2>&1 | tail -40

echo "=== 2. Standardzubehoer: Ausfuehrungen der R+F-Treffer ==="
# Dieselbe Luecke: Wand-, Boden-, Dachkonsole, Kabelkanal und Kondensatpumpe
# gibt es in vielen Groessen; die Suche hat je drei beliebige geliefert.
node rf-varianten.mjs \
  https://rf24.de/produkt/7080538300300 \
  https://rf24.de/produkt/2026091613127 \
  https://rf24.de/produkt/7078561107020 \
  https://rf24.de/produkt/7000602484206 \
  https://rf24.de/produkt/7078198100000 \
  https://rf24.de/produkt/2026291630160 \
  --out /tmp/var-zubehoer.json 2>&1 | tail -40

echo "=== 3. Gegenprobe: Suche mit Variantenschritt ==="
cat > /tmp/var-begriffe.json <<'JSONENDE'
[
 {"begriff": "Kupferrohr isoliert", "name": "isoliertes Kupferrohr", "quelle": "klimarechner", "ek": 9.22},
 {"begriff": "Doppelrohr", "name": "Doppelrohr isoliert", "quelle": "klimarechner", "ek": 9.22}
]
JSONENDE
node abgleich.mjs --begriffe /tmp/var-begriffe.json --shops r-f --max 4 --locker --varianten --out /tmp/var-gegenprobe.json 2>&1 | tail -20

ls -la /tmp/var-*.json
