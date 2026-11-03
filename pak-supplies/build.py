"""Build the Pak Supplies catalogue page and printable product list from data/*.json.

Usage: python3 build.py            -> writes catalogue/index.html and pdf/product-list.html
       node pdf/render.js          -> renders pdf/Pak-Supplies-Product-List.pdf
Change CONTACT below to the real WhatsApp number before sending to customers.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).parent
CONTACT = "03XX-XXXXXXX"
DATE = "November 2026"

AISLES = {
    "Janitorial Supplies": ["Cleaning Chemicals", "Washroom Care", "Hand Wash & Hygiene",
                            "Laundry & Dishwash", "Mops, Brooms & Tools", "Paper & Tissue",
                            "Garbage Bags & Bins", "Dispensers", "Safety & PPE"],
}

products = json.loads((ROOT / "data/janitorial.json").read_text())

# Catalogue page
tpl = (ROOT / "catalogue/template.html").read_text()
page = tpl.replace("/*PRODUCTS*/", json.dumps(products, ensure_ascii=False, separators=(",", ":"))) \
          .replace("/*CONTACT*/", CONTACT)
(ROOT / "catalogue/index.html").write_text(page)

# Printable list
e = html.escape
parts = []
for i, (aisle, cats) in enumerate(AISLES.items()):
    items = [p for p in products if p["c"] in cats]
    cls = ''
    new = ''
    parts.append(f'<h2 class="aisle{cls}">{e(aisle)}<small>{len(items)} products</small>{new}</h2>')
    if True:
        parts.append('<div class="safety"><b>Safety:</b> acid (tezab) and bleach are delivered in sealed, labelled '
                     'containers. Never mix acid with bleach, because together they release toxic chlorine gas. '
                     'Store chemicals away from food and children.</div>')
    for c in cats:
        rows = [p for p in items if p["c"] == c]
        if not rows:
            continue
        r = "".join(
            f'<div class="row"><i></i><span class="n">{e(p["n"])}</span>'
            f'<span class="b">{e(p["b"])}</span><span class="q"></span></div>' for p in rows)
        parts.append(f'<section class="cat"><h3>{e(c)}<span>{len(rows)} · write qty in the box</span></h3>'
                     f'<div class="rows">{r}</div></section>')

pdf = (ROOT / "pdf/template.html").read_text() \
    .replace("/*BODY*/", "\n".join(parts)) \
    .replace("/*CONTACT*/", e(CONTACT)) \
    .replace("/*DATE*/", DATE) \
    .replace("/*COUNT*/", str(len(products)))
(ROOT / "pdf/product-list.html").write_text(pdf)
print(f"{len(products)} janitorial products")
