# Matching beider Lagerauszuege gegen alle 393 GUT-Artikel.
# Der Suchraum ist geschlossen (233 Artikel), verglichen wird strukturell:
# System + kanonische Dimension + Formteil-Art. Keine Freitextsuche.
import json, os, re, collections
from pathlib import Path

S = Path(os.environ["SCRATCH"])
def js(n):
    t = (S / n).read_text(encoding="utf-8-sig").strip(); return json.loads(t[t.index("["):])
def fl(v, standard=0.0):
    try: return float(v) if v not in (None, "") else standard
    except (TypeError, ValueError): return standard

lager = json.loads((S / "lager-alle.json").read_text(encoding="utf-8"))
gut = js("gut-alle.out.txt")
print(f"Lager {len(lager)} · GUT {len(gut)}")

# ---------------------------------------------------------------- System
def system(t):
    tl = t.lower()
    if "optisteel" in tl or "simplesta" in tl: return "connect-inox"       # R+F-Heizungsedelstahl
    if "prestabo" in tl: return "prestabo-stahl"
    if "megapress" in tl: return "megapress-stahl"
    if "maxipro" in tl: return "maxipro-kupfer"
    if "uponor" in tl: return "uponor-mlc"
    if "profipress" in tl or "sanpress" in tl: return "b-press-kupfer"
    if "rg/cusi" in tl or "rotg" in tl: return "rotguss-gewinde"
    if "schwarz" in tl: return "gewinde-schwarz"
    return None

# ---------------------------------------------------------------- Art
def art(t):
    tl = t.lower()
    if "bogen" in tl:
        w = "45" if "45" in tl else "90"
        a = "I/A" if re.search(r"i\s*[x/]\s*a|i/a", tl) else "I/I"
        return f"bogen-{w}-{a}"
    if "t-stück" in tl or "t-stueck" in tl:
        return "t-stueck-red" if ("red" in tl or "reduziert" in tl) else ("t-stueck-ig" if ("rp" in tl or "innengew" in tl or " ig" in tl) else "t-stueck")
    if "übergangsnippel" in tl or "uebergangsnippel" in tl: return "uebergang-ag"
    if "übergangsmuffe" in tl or "uebergangsmuffe" in tl or "ü-muffe" in tl: return "uebergang-ig"
    if "übergang" in tl or "uebergang" in tl:
        if re.search(r"\bag\b|\bmt\b|x\s*r\s*\d", tl): return "uebergang-ag"
        if re.search(r"\big\b|\bft\b|rp", tl): return "uebergang-ig"
        if "auf kupfer" in tl or "cu" in tl: return "uebergang-cu"
        return "uebergang"
    if "reduzier" in tl: return "reduzierung"
    if "kupplung" in tl: return "kupplung"
    if "winkel" in tl: return "winkel"
    if "muffe" in tl: return "muffe"
    if "verschlusskappe" in tl or "kappe" in tl: return "kappe"
    if "stopfen" in tl: return "stopfen"
    if "verschraubung" in tl: return "verschraubung"
    if "doppelnippel" in tl or "rohrdoppelnippel" in tl or "nippel" in tl: return "nippel"
    return None

# ---------------------------------------------------------------- Dimension
ZOLL = r"1\s*1/2|1\s*1/4|11/2|11/4|3/4|1/2|3/8|1"
def zoll_norm(z):
    z = z.replace(" ", "")
    return {"11/2": '1 1/2"', "11/4": '1 1/4"'}.get(z, z + '"')

def dimension(t):
    """Kanonische Dimension im GUT-Format: '35mm', '35mm×1\"AG', '25mm×20mm×25mm', '1\"'."""
    tl = t.replace(" ", " ")
    # Uponor: "16-16", "20-20-16", "16-Rp1/2FT-16", "16-R1/2MT", "20-22CU"
    m = re.search(r"\b(\d{2})-(?:Rp|R)\s?(" + ZOLL + r")\"?(FT|MT)?-?(\d{2})?", tl)
    if m and "uponor" in tl.lower():
        gew = "IG" if (m.group(3) == "FT" or "Rp" in m.group(0)) else "AG"
        return f"{m.group(1)}mm×{zoll_norm(m.group(2))}{gew}"
    m = re.search(r"\b(\d{2})-(\d{2})-(\d{2})\b", tl)
    if m:
        a, b, c = m.groups()
        return f"{a}mm" if a == b == c else f"{a}mm×{b}mm×{c}mm"
    m = re.search(r"\b(\d{2})-(\d{2})(CU)?\b", tl)
    if m and "uponor" in tl.lower():
        a, b = m.group(1), m.group(2)
        return f"{a}mm" if a == b else f"{a}mm×{b}mm"
    # OptiSteel: "d = 35", "d = 35 x Rp 1/2", "d = 35 x R 1", "d = 35-22", "d = 28 x 22"
    m = re.search(r"d\s*=\s*(\d{2})\s*(?:[x-]\s*(?:(Rp|R)\s*(" + ZOLL + r")|(\d{2})))?", tl)
    if m:
        haupt = f"{m.group(1)}mm"
        if m.group(3):
            return f"{haupt}×{zoll_norm(m.group(3))}{'IG' if m.group(2) == 'Rp' else 'AG'}"
        if m.group(4):
            return f"{haupt}×{m.group(4)}mm"
        return haupt
    # Profipress/Sanpress/Prestabo: "18x15x18 mm", "22x15 mm", "15 mm x 3/4 AG",
    # "15mm x Rp1/2", "28 mm x 11/4 AG", "12 mm x R 1/2 AG"
    m = re.search(r"\b(\d{2})x(\d{2})x(\d{2})\s*mm", tl)
    if m:
        a, b, c = m.groups()
        return f"{a}mm×{b}mm×{c}mm"
    m = re.search(r"\b(\d{2})\s*mm\s*x\s*(?:Rp\s*(" + ZOLL + r")|R?\s*(" + ZOLL + r")\s*(AG|IG)?)", tl)
    if m:
        haupt = f"{m.group(1)}mm"
        if m.group(2):
            return f"{haupt}×{zoll_norm(m.group(2))}IG"
        gew = m.group(4) or ("IG" if "rp" in tl.lower() else "AG")
        return f"{haupt}×{zoll_norm(m.group(3))}{gew}"
    m = re.search(r"\b(\d{2})x(\d{2})\s*mm", tl)
    if m:
        return f"{m.group(1)}mm×{m.group(2)}mm"
    m = re.search(r"\b(\d{2})\s*mm\b", tl)
    if m:
        return f"{m.group(1)}mm"
    # Rotguss/Gewinde: "R 1", "R 1 x 1/2", "R 11/4", "DN 25 (R 1) x 100 mm"
    m = re.search(r"\bR\s*(" + ZOLL + r")\s*x\s*(" + ZOLL + r")\b", tl)
    if m:
        return f"{zoll_norm(m.group(1))}×{zoll_norm(m.group(2))}"
    m = re.search(r"\bRp?\s*(" + ZOLL + r")\b", tl)
    if m:
        return zoll_norm(m.group(1))
    m = re.search(r"\bDN\s*(\d+)", tl)
    if m:
        return {15: '1/2"', 20: '3/4"', 25: '1"', 32: '1 1/4"', 40: '1 1/2"', 50: '2"'}.get(int(m.group(1)))
    return None

for a in lager:
    a["sys2"] = system(a["text"]); a["dim2"] = dimension(a["text"]); a["art2"] = art(a["text"])

ft = [a for a in lager if a["sys2"] and a["dim2"] and a["art2"]]
print(f"Lager-Formteile mit vollstaendigem Schluessel: {len(ft)}")
print("\nJe System:")
for k, n in collections.Counter(a["sys2"] for a in ft).most_common():
    print(f"  {k:20} {n:4}")

# ---------------------------------------------------------------- Matching
# Ein GUT-Artikel bekommt einen Lagerartikel, wenn System und Dimension exakt
# stimmen. Die Art wird zusaetzlich verglichen; stimmt sie auch, ist es sicher.
lager_nach = collections.defaultdict(list)
for a in ft:
    lager_nach[(a["sys2"], a["dim2"])].append(a)

sicher, unsicher, ohne = [], [], []
for g in gut:
    if g.get("kategorie") != "formteil" or not g.get("system") or not g.get("dimension"):
        continue
    kand = lager_nach.get((g["system"], g["dimension"]), [])
    if not kand:
        ohne.append(g); continue
    gart = art((g["text"] or "") + " " + (g["text2"] or ""))
    exakt = [a for a in kand if a["art2"] == gart]
    eintrag = lambda a, grund, ist_sicher: {
        "gut_nr": g["artikelnummer"], "gut_text": g["text"], "gut_ek": fl(g["gut_ek"]),
        "verbrauch": fl(g["verbrauch"]), "quelle_bisher": g["quelle_bisher"],
        "rf_ek_bisher": fl(g["rf_ek_bisher"], None) if g["rf_ek_bisher"] else None,
        "rf_nr": a["rf_nr"], "rf_text": a["text"], "rf_ek": a["ek"],
        "system": g["system"], "dimension": g["dimension"], "art": a["art2"], "grund": grund,
    }
    if len(exakt) == 1:
        sicher.append(eintrag(exakt[0], f"System+Dimension+Art ({gart})", True))
    elif exakt:
        exakt.sort(key=lambda a: a["ek"])
        mittel = sum(a["ek"] for a in exakt) / len(exakt)
        e = eintrag(exakt[0], f"System+Dimension+Art, {len(exakt)} Varianten — Mittel {mittel:.2f}", True)
        e["rf_ek"] = round(mittel, 2); e["rf_nr"] = exakt[0]["rf_nr"]
        sicher.append(e)
    else:
        # Keine passende Art im Lager: KEIN Preis. Ein Muffenpreis ist kein
        # Bogenpreis — der Mittelwert ueber fremde Arten waere frei erfunden.
        # (Fund 09.09.2026: so bekamen die 35-mm-Boegen den Muffenpreis.)
        g = dict(g); g["fehlende_art"] = gart
        g["lager_arten"] = sorted(set(a["art2"] for a in kand))
        ohne.append(g)

sicher.sort(key=lambda x: -x["verbrauch"]); unsicher.sort(key=lambda x: -x["verbrauch"]); ohne.sort(key=lambda x: -fl(x["verbrauch"]))

def zeig(titel, zeilen, n=30):
    wert = sum(z["verbrauch"] for z in zeilen)
    print(f"\n=== {titel}: {len(zeilen)} Artikel, {wert:,.2f} EUR")
    for z in zeilen[:n]:
        vor = f"{z['rf_ek_bisher']:.2f}" if z.get("rf_ek_bisher") else "-"
        print(f"  {z['gut_nr']:15}{(z['gut_text'] or '')[:40]:42}{z['dimension']:16}"
              f"GUT {z['gut_ek']:7.2f} neu {z['rf_ek']:7.2f} vorher {vor:>7}  {z['verbrauch']:9.2f}")
    if len(zeilen) > n: print(f"  … und {len(zeilen)-n} weitere")

zeig("SICHER", sicher, 20)
print(f"\n=== OHNE LAGERPREIS: {len(ohne)} Artikel, {sum(fl(o['verbrauch']) for o in ohne):,.2f} EUR")
for o in ohne[:15]:
    grund = f"Art {o.get('fehlende_art')} fehlt (Lager: {', '.join(o.get('lager_arten', []))[:34]})" if o.get("lager_arten") else "Dimension nicht im Lager"
    print(f"  {o['artikelnummer']:15}{(o['text'] or '')[:38]:40}{o['dimension'] or '-':17}{fl(o['verbrauch']):9.2f}  {grund}")

(S / "match2-sicher.json").write_text(json.dumps(sicher, ensure_ascii=False, indent=1), encoding="utf-8")
(S / "match2-unsicher.json").write_text(json.dumps(unsicher, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"\n-> match2-sicher.json ({len(sicher)}), match2-unsicher.json ({len(unsicher)})")
