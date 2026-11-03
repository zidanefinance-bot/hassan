"""Build the Pak Supplies catalogue page and printable product list from data/*.json.

Usage: python3 build.py            -> writes catalogue/index.html, pdf/product-list.html, pdf/catalogue.html
       node pdf/render.js          -> renders pdf/Pak-Supplies-Product-List.pdf and pdf/Pak-Supplies-Catalogue.pdf
Fill in CONTACT and DETAILS below with the real numbers/address before sending to customers.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).parent
CONTACT = "03XX-XXXXXXX"
DATE = "November 2026"

# Contact details shown on the cover, every footer and the contact page.
# Replace the placeholders with the details from paksupplies.com.pk.
DETAILS = {
    "whatsapp": CONTACT,
    "phone": "021-XXXXXXX",
    "email": "info@paksupplies.com.pk",
    "website": "paksupplies.com.pk",
    "address": "Office address, City, Pakistan",
    "hours": "Mon to Sat, 9:00 am to 7:00 pm",
}

# Category order, with a short customer-facing intro (English + Roman Urdu line).
CATEGORIES = [
    ("Cleaning Chemicals", "Bleach, acid, phenyl, floor and glass cleaners in 1L, 5L and 20L packs.",
     "Har surface ke liye cleaning chemicals, bulk packing mein."),
    ("Brooms (Hard & Soft)", "Soft phool jharoo for indoor floors, hard tili and coconut brooms for outdoor and rough areas.",
     "Andar ke liye soft, bahar ke liye hard jharoo."),
    ("Toiletries", "Soap, shampoo, dental and guest amenity kits for offices, hotels, hostels and hospitals.",
     "Hotels, offices aur hostels ke liye toiletries."),
    ("Washroom Care", "Toilet wash, urinal cubes, naphthalene and washroom tools.",
     "Saaf aur khushbudar washrooms."),
    ("Hand Wash & Hygiene", "Hand wash pumps and refills, branded hand wash and sanitizers.",
     "Haath dhone aur hygiene ka saman."),
    ("Laundry & Dishwash", "Detergent powder and liquid, dishwash liquid and bars.",
     "Kapre aur bartan dhone ka saman."),
    ("Mops & Cleaning Tools", "Mops, buckets, wipers, squeegees, cloths, scrubbers and spray bottles.",
     "Pocha, wiper aur safai ke auzaar."),
    ("Paper & Tissue", "Toilet rolls, jumbo rolls, kitchen towels, N-fold towels and tissue boxes.",
     "Tissue aur paper products."),
    ("Garbage Bags & Bins", "Garbage bags in every size, pedal bins, office bins and wheeled bins.",
     "Kachra bags aur dustbins."),
    ("Dispensers", "Wall-mounted soap, tissue, towel and air freshener dispensers.",
     "Washroom dispensers, installation ke saath."),
    ("Safety & PPE", "Gloves, face masks and wet-floor caution signs for your cleaning staff.",
     "Staff ki hifazat ke liye safety saman."),
]
CAT_NAMES = [c[0] for c in CATEGORIES]
# Short order codes per category, e.g. CC-01 = first Cleaning Chemicals product.
CODES = dict(zip(CAT_NAMES, ["CC", "BR", "TL", "WC", "HW", "LD", "MT", "PT", "GB", "DS", "SF"]))
AISLES = {"Janitorial Supplies": CAT_NAMES}

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


# Customer catalogue PDF: cover, contents, one page per category, contact page.
def foot(n):
    return (f'<div class="foot"><span><b>Pak Supplies</b> · Product Catalogue · {DATE}</span>'
            f'<span>WhatsApp {e(DETAILS["whatsapp"])} · Page {n}</span></div>')

LOGO = ('<svg width="{s}" height="{s}" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="{bg}"/>'
        '<path d="M11 17.5 20 13l9 4.5v9.5L20 31.5 11 27z" fill="none" stroke="{fg}" stroke-width="2.2" stroke-linejoin="round"/>'
        '<path d="M11 17.5 20 22l9-4.5M20 22v9.5" fill="none" stroke="{fg}" stroke-width="2.2" stroke-linejoin="round"/>'
        '<circle cx="29.5" cy="11" r="3" fill="#C98A12"/></svg>')

def logo(size=46, bg="#0F6B42", fg="#fff", tag="Janitorial &amp; cleaning supplies"):
    return (f'<div class="logo">{LOGO.format(s=size, bg=bg, fg=fg)}'
            f'<div><b>Pak <span>Supplies</span></b><small>{tag}</small></div></div>')

cats = [(n, en, ur, [p for p in products if p["c"] == n]) for n, en, ur in CATEGORIES]
cats = [c for c in cats if c[3]]
pages = []

# 1. Cover
chips = "".join(f"<li>{e(n)}</li>" for n, *_ in cats)
pages.append(f'''<section class="page cover"><div class="band"></div><div class="in">
{logo(58, "#fff", "#0F6B42")}
<div class="kicker">Product Catalogue · {DATE}</div>
<h1>Everything your<br>building needs<br>to stay clean.</h1>
<p class="lede">{len(products)} janitorial products across {len(cats)} categories, supplied in bulk to offices, hotels,
schools, hospitals and factories. Ek order, poora saman.</p>
<ul class="cats">{chips}</ul>
<div class="bottom"><div><span>Order on WhatsApp</span><strong>{e(DETAILS["whatsapp"])}</strong></div>
<div style="text-align:right"><span>{e(DETAILS["email"])}</span><br><span>{e(DETAILS["website"])}</span></div></div>
</div></section>''')

# 2. Contents
toc = "".join(
    f'<li><span class="no">{i:02d}</span><span class="nm">{e(n)}<small>{e(en)}</small></span>'
    f'<span class="ct">{len(items)} items</span><span class="pg">{i + 2}</span></li>'
    for i, (n, en, ur, items) in enumerate(cats, 1))
pages.append(f'''<section class="page">
<div class="head">{logo()}<div class="ed">Product Catalogue<br>{DATE}</div></div>
<h2 class="title">Contents</h2>
<p class="sub">Each category has its own page. Product codes help you order quickly on WhatsApp.</p>
<ol class="toc">{toc}</ol>
<div class="why">
<div><b>Bulk supply</b><p>Pack sizes from 1L bottles to 20L cans and 25kg bags, for monthly office and site needs.</p></div>
<div><b>Delivery to your door</b><p>We deliver to your office, site or warehouse. Delivery date is confirmed with your quote.</p></div>
<div><b>Quote in hours</b><p>Send your list on WhatsApp and get a price quote the same day. Rates depend on volume.</p></div>
</div>
{foot(2)}</section>''')

# 3+. One page per category
for i, (n, en, ur, items) in enumerate(cats, 1):
    pre = CODES[n]
    rows = "".join(
        f'<tr><td class="sr">{j}</td><td class="code">{pre}-{j:02d}</td>'
        f'<td class="nm">{e(p["n"])}</td><td class="br">{e(p["b"])}</td><td class="q"><span></span></td></tr>'
        for j, p in enumerate(items, 1))
    extra = ""
    if n == "Cleaning Chemicals":
        extra = ('<div class="safety"><b>Safety:</b> acid (tezab) and bleach are delivered in sealed, labelled containers. '
                 'Never mix acid with bleach, because together they release toxic chlorine gas. '
                 'Store chemicals away from food and children.</div>')
    elif n == "Brooms (Hard & Soft)":
        extra = ('<div class="tip"><b>Which broom?</b><span><b style="color:inherit">Soft broom</b> (phool jharoo) for tiles, marble and '
                 'indoor dust. <b style="color:inherit">Hard broom</b> (tili / coconut / push broom) for car parks, yards, '
                 'rough floors and wet areas.</span></div>')
    elif n == "Toiletries":
        extra = ('<div class="tip"><b>For hotels &amp; guest houses</b><span>Amenity kits can be packed to your room count. '
                 'Ask for custom quantities on WhatsApp.</span></div>')
    else:
        extra = (f'<div class="tip"><b>Need something else?</b><span>If an item is not listed, send its name or photo on '
                 f'WhatsApp {e(DETAILS["whatsapp"])} and we will source it.</span></div>')
    pages.append(f'''<section class="page">
<div class="sec"><div class="big">{i:02d}</div><div><div class="k">Category {i} of {len(cats)}</div>
<h2>{e(n)}</h2><p>{e(en)} <i>{e(ur)}</i></p></div></div>
<div class="meta-row"><span>{len(items)} products · brands and pack sizes confirmed in your quote</span><span>Write qty in the box</span></div>
<table><thead><tr><th>#</th><th>Code</th><th>Product</th><th>Brand / Pack</th><th>Qty</th></tr></thead>
<tbody>{rows}</tbody></table>
{extra}
{foot(i + 2)}</section>''')

# Last. Contact page
d = {k: e(v) for k, v in DETAILS.items()}
last = len(cats) + 3
pages.append(f'''<section class="page contact">
<div class="head">{logo()}<div class="ed">Product Catalogue<br>{DATE}</div></div>
<h2 class="title">Contact &amp; ordering</h2>
<p class="sub">Rabta karein, hum aapka order jaldi se jaldi deliver karenge.</p>
<div class="cgrid">
<div class="card hero"><div><div class="lab">WhatsApp orders &amp; quotes</div><div class="val">{d["whatsapp"]}</div>
<div class="note">Fastest way to order. Send your list or a photo of this catalogue.</div></div>{LOGO.format(s=72, bg="#fff", fg="#0F6B42")}</div>
<div class="card"><div class="lab">Phone</div><div class="val">{d["phone"]}</div><div class="note">{d["hours"]}</div></div>
<div class="card"><div class="lab">Email</div><div class="val sm">{d["email"]}</div><div class="note">For POs, invoices and tenders</div></div>
<div class="card"><div class="lab">Website</div><div class="val sm">{d["website"]}</div><div class="note">Latest products and updates</div></div>
<div class="card"><div class="lab">Office / Warehouse</div><div class="val sm">{d["address"]}</div><div class="note">Visits by appointment</div></div>
</div>
<ol class="steps">
<li><b>Choose</b>Pick products and write the quantity next to each code.</li>
<li><b>Send</b>WhatsApp the list or a photo of the pages to us.</li>
<li><b>Get a quote</b>We reply with prices and a delivery date.</li>
<li><b>Delivery</b>Confirm the order and we deliver to your door.</li>
</ol>
<div class="terms">
<p>Prices are not printed because they depend on order volume and brand. Every order gets a written quote.</p>
<p>Brands, pack sizes and availability are confirmed in your quote and may change without notice.</p>
<p>Monthly supply contracts are available for offices, hotels, schools, hospitals and factories.</p>
<p>Chemicals are delivered in sealed, labelled containers. Please check goods on delivery.</p>
</div>
<div class="thanks">Thank you for choosing Pak Supplies<small>Shukriya! Aapki khidmat hamara farz hai.</small></div>
{foot(last)}</section>''')

cat_html = (ROOT / "pdf/catalogue-template.html").read_text().replace("/*PAGES*/", "\n".join(pages))
(ROOT / "pdf/catalogue.html").write_text(cat_html)
print(f"catalogue: {len(pages)} pages")
