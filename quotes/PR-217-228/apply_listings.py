"""Overlay Pakistani online listings (online_listings.txt) on ITEMS.

V = exact item listed online in Pakistan (brand ladder: Licota -> Yato -> other listed brand)
S = listed online but spec / pack / stock differs - read the note
N = not listed online by any brand - estimate only, needs dealer quote
"""
from items import ITEMS

SPEC = {1, 9, 16, 36, 39, 60, 62, 73, 97, 110, 111, 122, 160, 164, 165, 166, 177, 202, 230, 234, 235, 237}

def load():
    d = {}
    for line in open("online_listings.txt"):
        if line.startswith("#") or not line.strip():
            continue
        p = line.rstrip("\n").split("|")
        d[int(p[0])] = p
    return d

def overlay():
    d = load()
    out = []
    for it in ITEMS:
        it = dict(it)
        p = d[it["sr"]]
        if p[1].startswith("NOT FOUND"):
            it["conf"] = "N"
            extra = p[1][len("NOT FOUND"):].strip(" ()")
            it["note"] = ("Online nahi mila - dealer quote chahiye. " + extra).strip()
        else:
            price = float(p[2])
            it["brand"], it["low"], it["high"], it["src"] = p[1], price, price, p[3]
            it["conf"] = "S" if it["sr"] in SPEC else "V"
            it["note"] = "Spec/pack/stock farq - source dekho" if it["conf"] == "S" else ""
        out.append(it)
    return out

ITEMS_ONLINE = overlay()
