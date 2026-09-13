"""Liest R+F-Rechnungen (PDF) und zieht die Positionen heraus.

Eine Rechnung ist die beste Preisquelle, die es gibt: echte Artikelnummer,
echte Menge, echter Einkaufspreis nach Abzug. Besser als der Listenpreis aus
dem Shop und unvergleichlich viel besser als eine Textsuche.

Aufbau einer Position im PDF-Text:

    Pos. 10          30 ST 1012100018000
    ID6 PROFIPRESS Bogen 90 Grad I/I aus Kupfer
    18 mm  Modell 2416
    Zwischensumme Position        2,74        82,20 Netto

Also: Positionsnummer, Menge, Einheit, Artikelnummer, dann ein bis drei Zeilen
Bezeichnung, dann Einzelpreis und Wert.

Aufruf: python tools/rf-rechnungen-lesen.py <pdf> [<pdf> ...] --out positionen.json
"""
import argparse
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

# "Pos. 10          30 ST 1012100018000"  — Menge kann Nachkommastellen haben.
POS = re.compile(
    r"^Pos\.\s+(\d+)\s+([\d.,]+)\s+([A-ZÄÖÜ]{1,4})\s+(\d{10,14})\s*$")
# "Zwischensumme Position        2,74        82,20 Netto"
SUMME = re.compile(
    r"^Zwischensumme Position\s+([\d.,]+)\s+([\d.,]+)\s+\w+\s*$")
RECHNUNGSNR = re.compile(r"^(\d{10})\s+(\d{2}\.\d{2}\.\d{4})\s*$")


def zahl(s):
    """Deutsche Zahl in float. '1.234,56' -> 1234.56"""
    return float(s.replace(".", "").replace(",", "."))


def reparieren(s):
    """pypdf liefert bei diesen PDFs kaputte Umlaute. Die haeufigen ersetzen."""
    for falsch, richtig in (
        ("Ã¼", "ü"), ("Ã¶", "ö"), ("Ã¤", "ä"), ("ÃŸ", "ß"),
        ("Ãœ", "Ü"), ("Ã–", "Ö"), ("Ã„", "Ä"),
    ):
        s = s.replace(falsch, richtig)
    return s


def rechnung_lesen(pfad):
    reader = PdfReader(pfad)
    zeilen = []
    for seite in reader.pages:
        zeilen.extend((seite.extract_text() or "").splitlines())

    nummer, datum = None, None
    for i, z in enumerate(zeilen):
        if z.strip() == "Rechnungsnummer Datum" and i + 1 < len(zeilen):
            m = RECHNUNGSNR.match(zeilen[i + 1].strip())
            if m:
                nummer, datum = m.group(1), m.group(2)
            break

    positionen = []
    i = 0
    while i < len(zeilen):
        m = POS.match(zeilen[i].strip())
        if not m:
            i += 1
            continue
        pos, menge, einheit, artikelnr = m.groups()
        text = []
        j = i + 1
        while j < len(zeilen) and j < i + 6:
            s = zeilen[j].strip()
            ms = SUMME.match(s)
            if ms:
                positionen.append({
                    "rechnung": nummer, "datum": datum,
                    "position": int(pos),
                    "artikelnr": artikelnr,
                    "menge": zahl(menge),
                    "einheit": einheit,
                    "bezeichnung": reparieren(" ".join(text)).strip(),
                    "ek_stueck": zahl(ms.group(1)),
                    "wert": zahl(ms.group(2)),
                })
                break
            if s and not s.startswith("Pos."):
                # "ID6 " ist ein interner Kennzeichner vor der Bezeichnung.
                text.append(re.sub(r"^ID\d+\s+", "", s))
            j += 1
        i = j + 1
    return positionen


def main():
    p = argparse.ArgumentParser()
    p.add_argument("pdf", nargs="+")
    p.add_argument("--out", default=None)
    a = p.parse_args()

    alle = []
    for pfad in a.pdf:
        pos = rechnung_lesen(pfad)
        alle.extend(pos)
        print(f"{Path(pfad).name}: {len(pos)} Positionen", file=sys.stderr)

    if a.out:
        Path(a.out).write_text(json.dumps(alle, ensure_ascii=False, indent=2),
                               encoding="utf-8")
        print(f"{len(alle)} Positionen -> {a.out}", file=sys.stderr)
    else:
        for z in alle:
            print(f"{z['artikelnr']}  {z['menge']:>6} {z['einheit']:<3} "
                  f"{z['ek_stueck']:>8.2f}  {z['bezeichnung'][:60]}")


if __name__ == "__main__":
    main()
