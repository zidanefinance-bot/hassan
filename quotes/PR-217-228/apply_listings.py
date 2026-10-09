"""Overlay Pakistani online listings (online_listings.txt) on ITEMS.

V = exact item listed online in Pakistan (brand ladder: Licota -> Yato -> other listed brand)
S = listed online but spec / pack / stock differs - read the note
N = not listed online by any brand - estimate only, needs dealer quote
"""
from items import ITEMS

SPEC = {1, 2, 9, 16, 22, 27, 28, 36, 39, 47, 49, 50, 51, 55, 56, 58, 60, 62, 66, 73, 77, 79, 83, 85, 87, 88, 89, 90, 91, 96, 97, 98, 100, 104, 111, 117, 118, 122, 123, 128, 129, 132, 142, 143, 144, 154, 159, 160, 161, 162, 164, 165, 166, 167, 168, 177, 179, 181, 182, 188, 193, 195, 202, 210, 211, 214, 217, 219, 220, 224, 226, 227, 228, 229, 230, 234, 235, 236, 237}

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
