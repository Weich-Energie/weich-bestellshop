#!/usr/bin/env python3
"""Liest einen R+F-Lagerauszug (Regalcodes) und klassifiziert die Artikel.

Format je Zeile, Semikolon getrennt, deutsche Dezimalkommas:
    Artikelnummer;Menge;Einheit;Bezeichnung;Listenpreis;EK

Aufruf:
    python tools/lager-auszug-lesen.py <auszug.csv> [weitere.csv ...] [--json ziel.json]

Hintergrund in docs/rf-lagerliste-echte-preise.md: Die Lagerliste ist die
Preisquelle fuer das heute verbaute Material, die GUT-Historie liefert nur noch
die Mengengewichte. Erkannt werden System, Kategorie, Dimension und
Formteil-Art, damit sich Preise mit der Historie verrechnen lassen.
"""
import argparse
import collections
import csv
import json
import re
import sys
from pathlib import Path


def zahl(s):
    """Deutsche Zahl ('1.234,56 ') als float, sonst None."""
    s = (s or "").strip().replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def system(text):
    t = text.lower()
    if "profipress" in t:
        return "profipress-kupfer"
    if "prestabo" in t:
        return "prestabo-stahl"
    if "megapress" in t:
        return "megapress-stahl"
    if "maxipro" in t:
        return "maxipro-kupfer"
    if "uponor" in t or "mlc" in t:
        return "uponor-mlc"
    if "sanpress" in t and "inox" in t:
        return "sanpress-inox"
    # Heizungsedelstahl laeuft bei R+F unter optiline OptiSteel / simplesta.
    if "optisteel" in t or "simplesta" in t or "inox" in t:
        return "heizungsedelstahl"
    if "rotguss" in t or "rg/cusi" in t:
        return "rotguss-gewinde"
    return None


FORMTEIL_WORTE = (
    "bogen", "muffe", "t-stück", "t-stueck", "übergangsstück", "uebergangsstueck",
    "übergangs", "uebergangs", "winkel", "reduzier", "kupplung", "nippel", "stopfen", "kappe",
)
ARMATUR_WORTE = (
    "kugelhahn", "ventil", "rückfluss", "rueckfluss", "schieber", "kfe", "kfr",
    "manometer", "entlüfter", "entlueft", "luftstopfen", "thermometer",
)


def kategorie(text):
    t = text.lower()
    if "pumpenverschraubung" in t or ("verschraubung" in t and "rohrverschraubung" not in t):
        return "verschraubung"
    if any(w in t for w in ARMATUR_WORTE):
        return "ventil_armatur"
    if any(w in t for w in ("schelle", "gewindestift", "gewindemuffe", "profilschiene")):
        return "schelle_befestigung"
    if any(w in t for w in ("dämm", "daemm", "isolier", "rohrschale")):
        return "daemmung"
    if any(w in t for w in FORMTEIL_WORTE):
        return "formteil"
    if "rohr" in t:
        return "rohr"
    return "sonstiges"


def dimension(text):
    m = re.search(r"\b(\d{2})\s*mm\b", text)
    if m:
        return m.group(1) + "mm"
    m = re.search(r"\bDN\s*(\d+)", text)
    if m:
        return "DN" + m.group(1)
    m = re.search(r"\b(\d\s+\d/\d|\d/\d|\d)\s*(?:IG|AG|a\b|i\b)", text)
    if m:
        return m.group(1).replace(" ", "") + '"'
    return None


def art(text):
    t = text.lower()
    if "bogen" in t:
        winkel = "45" if "45" in t else "90"
        anschluss = "I/A" if "i/a" in t else "I/I"
        return f"bogen-{winkel}-{anschluss}"
    if "gewindemuffe" in t:
        return None
    if "muffe" in t:
        return "muffe"
    if "t-stück" in t or "t-stueck" in t:
        return "t-stueck"
    if "übergangs" in t or "uebergangs" in t:
        return "uebergang"
    if "reduzier" in t:
        return "reduzierung"
    if "kupplung" in t:
        return "kupplung"
    if "winkel" in t:
        return "winkel"
    if "nippel" in t:
        return "nippel"
    return None


def lesen(pfade):
    """Liest alle Auszuege, dedupliziert nach Artikelnummer, klassifiziert."""
    artikel = {}
    doppelt = 0
    for pfad in pfade:
        with open(pfad, encoding="utf-8-sig", newline="") as fh:
            for reihe in csv.reader(fh, delimiter=";"):
                if len(reihe) < 6 or not reihe[0].strip():
                    continue
                nr = reihe[0].strip()
                if nr in artikel:
                    doppelt += 1
                    continue
                text = reihe[3].strip()
                artikel[nr] = {
                    "rf_nr": nr,
                    "einheit": reihe[2].strip(),
                    "text": text,
                    "listenpreis": zahl(reihe[4]),
                    "ek": zahl(reihe[5]),
                    "quelle": Path(pfad).name,
                    "system": system(text),
                    "kategorie": kategorie(text),
                    "dimension": dimension(text),
                    "art": art(text),
                }
    return list(artikel.values()), doppelt


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("dateien", nargs="+", help="CSV-Auszuege aus dem R+F-Shop")
    p.add_argument("--json", help="Ergebnis als JSON schreiben")
    args = p.parse_args()

    artikel, doppelt = lesen(args.dateien)
    if not artikel:
        print("Keine Zeilen gelesen — Format pruefen (Semikolon, 6 Spalten).", file=sys.stderr)
        return 1

    print(f"Artikel: {len(artikel)} eindeutig, {doppelt} Doppelte uebersprungen")

    print("\nKategorien:")
    for k, n in collections.Counter(a["kategorie"] for a in artikel).most_common():
        print(f"  {k:22} {n:4}")

    print("\nSysteme (soweit erkennbar):")
    for k, n in collections.Counter(a["system"] for a in artikel if a["system"]).most_common():
        print(f"  {k:22} {n:4}")
    ohne = sum(1 for a in artikel if not a["system"])
    if ohne:
        print(f"  {'(kein System erkannt)':22} {ohne:4}")

    formteile = [a for a in artikel if a["kategorie"] == "formteil" and a["system"] and a["dimension"]]
    if formteile:
        print("\nFormteil-Preise je System, Dimension und Art:")
        gruppen = collections.defaultdict(list)
        for a in formteile:
            gruppen[(a["system"], a["dimension"], a["art"] or "?")].append(a["ek"])
        for (sy, di, ar), preise in sorted(gruppen.items()):
            preise = [x for x in preise if x is not None]
            if not preise:
                continue
            print(f"  {sy:22} {di:8} {ar:16} n={len(preise)} "
                  f"Mittel {sum(preise) / len(preise):7.2f}  min {min(preise):7.2f}  max {max(preise):7.2f}")

    rabatte = sorted(a["ek"] / a["listenpreis"] for a in artikel
                     if a["ek"] and a["listenpreis"])
    if rabatte:
        median = rabatte[len(rabatte) // 2]
        print(f"\nMedian-Rabatt auf Liste: {100 * (1 - median):.1f} % "
              f"(Faktor {median:.3f}, Spanne {min(rabatte):.2f} bis {max(rabatte):.2f})")

    ohne_preis = [a for a in artikel if a["ek"] is None]
    if ohne_preis:
        print(f"\nWarnung: {len(ohne_preis)} Artikel ohne EK — diese Zeilen nachtragen:")
        for a in ohne_preis[:10]:
            print(f"  {a['rf_nr']}  {a['text'][:60]}")

    if args.json:
        Path(args.json).write_text(json.dumps(artikel, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"\n-> {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
