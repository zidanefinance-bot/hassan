"""Build the Pak Supplies catalogue page and printable product list from data/*.json.

Usage: python3 build.py            -> writes catalogue/index.html, pdf/product-list.html, pdf/catalogue.html
       node pdf/render.js          -> renders pdf/Pak-Supplies-Product-List.pdf and pdf/Pak-Supplies-Catalogue.pdf
Fill in CONTACT and DETAILS below with the real numbers/address before sending to customers.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).parent
CONTACT = "0339-2639315"
DATE = "November 2026"

# Contact details shown on the cover, every footer and the contact page.
DETAILS = {
    "whatsapp": CONTACT,
    "phone": "+92 339 2639315",
    "email": "sales@paksupplies.com.pk",
    "website": "paksupplies.com.pk",
    "address": "Karachi, Pakistan",
    "delivery": "Same-day delivery in Karachi, nationwide shipping",
}

# Category order, with a short customer-facing intro (English + Roman Urdu line).
CATEGORIES = [
    ("Cleaning Chemicals", "Bleach, acid, phenyl, floor and glass cleaners in 1L, 5L and 20L packs.",
     "Har surface ke liye cleaning chemicals, bulk packing mein."),
    ("Brooms (Hard & Soft)", "Soft phool jharoo for indoor floors, hard tili, coconut and push brooms for outdoor and rough areas.",
     "Andar ke liye soft, bahar ke liye hard jharoo."),
    ("Mops & Cleaning Tools", "Mops, buckets, wipers, squeegees, cloths, scrubbers and spray bottles.",
     "Pocha, wiper aur safai ke auzaar."),
    ("Mop Refills", "Wet cotton refills by weight (250g to 600g), colour-coded wet refills, acrylic dry mop refills and microfiber pads.",
     "Wet aur dry mop refills, har size aur colour mein."),
    ("Dustbins", "Plastic dustbins from 10L to 80L, pedal and swing-lid bins, wheeled bins up to 360L, steel and hospital bins.",
     "Plastic aur steel dustbins, har size mein."),
    ("Garbage Bags", "Garbage bags in every size, heavy-duty bags by the kg, hospital and colour-coded bags.",
     "Kachra bags, chhote se jumbo tak."),
    ("Toiletries", "Soap, shampoo, dental and guest amenity kits for offices, hotels, hostels and hospitals.",
     "Hotels, offices aur hostels ke liye toiletries."),
    ("Washroom Care", "Toilet wash, urinal cubes, naphthalene and washroom tools.",
     "Saaf aur khushbudar washrooms."),
    ("Hand Wash & Hygiene", "Hand wash pumps and refills, branded hand wash and sanitizers.",
     "Haath dhone aur hygiene ka saman."),
    ("Laundry & Dishwash", "Detergent powder and liquid, dishwash liquid and bars.",
     "Kapre aur bartan dhone ka saman."),
    ("Paper & Tissue", "Toilet rolls, jumbo rolls, kitchen towels, N-fold towels and tissue boxes.",
     "Tissue aur paper products."),
    ("Dispensers", "Wall-mounted soap, tissue, towel and air freshener dispensers.",
     "Washroom dispensers, installation ke saath."),
    ("Cleaning Machines & Trolleys", "Wet & dry vacuums, floor scrubbers, polishers, pressure washers and janitor trolleys.",
     "Industrial cleaning machines aur trolleys."),
    ("Safety & PPE", "Gloves, face masks and wet-floor caution signs for your cleaning staff.",
     "Staff ki hifazat ke liye safety saman."),
]
CAT_NAMES = [c[0] for c in CATEGORIES]
# Short order codes per category, e.g. CC-01 = first Cleaning Chemicals product.
CODES = dict(zip(CAT_NAMES, ["CC", "BR", "MT", "MR", "DB", "GB", "TL", "WC", "HW", "LD", "PT", "DS", "CM", "SF"]))
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

LOGO = '<img class="mark" src="../assets/logo.png" alt="Pak Supplies">'

def logo(card=False):
    return (f'<div class="logo{" card" if card else ""}">{LOGO}'
            f'<div><b>PAK SUPPLIES</b><small>Cleaning Solutions</small></div></div>')

cats = [(n, en, ur, [p for p in products if p["c"] == n]) for n, en, ur in CATEGORIES]
cats = [c for c in cats if c[3]]
pages = []

# 1. Cover
chips = "".join(f"<li>{e(n)}</li>" for n, *_ in cats)
pages.append(f'''<section class="page cover"><div class="band"></div><div class="topbar">&#9742;&nbsp; {e(DETAILS["phone"])} &nbsp;·&nbsp; {e(DETAILS["email"])}</div><div class="in">
{logo(True)}
<div class="pill"><i></i>Pakistan's trusted B2B supplier</div>
<h1>Cleaning Supplies, Mops &amp; Janitorial Equipment <em>Delivered Across Pakistan</em></h1>
<p class="lede">Product Catalogue · {DATE}. {len(products)} products across {len(cats)} categories for hotels, hospitals,
offices and facilities nationwide, with same-day delivery in Karachi.</p>
<div class="stats"><div><b>1,200+</b>Products</div><div><b>8+</b>Years experience</div><div><b>Same day</b>Delivery in Karachi</div></div>
<ul class="cats">{chips}</ul>
<div class="bottom"><div><span>WhatsApp / Call</span><strong>{e(DETAILS["whatsapp"])}</strong></div>
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
<div><b>Same-day in Karachi</b><p>Same-day delivery in Karachi and delivery across Pakistan to your office, site or warehouse.</p></div>
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
<div class="note">Fastest way to order. Send your list or a photo of this catalogue.</div></div><div class="wa">WhatsApp</div></div>
<div class="card"><div class="lab">Phone</div><div class="val">{d["phone"]}</div><div class="note">Call for orders and bulk quotes</div></div>
<div class="card"><div class="lab">Email</div><div class="val sm">{d["email"]}</div><div class="note">For POs, invoices and tenders</div></div>
<div class="card"><div class="lab">Website</div><div class="val sm">{d["website"]}</div><div class="note">Browse 1,200+ products online</div></div>
<div class="card"><div class="lab">Based in</div><div class="val sm">{d["address"]}</div><div class="note">{d["delivery"]}</div></div>
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
<div class="thanks">Thank you for choosing <em>Pak Supplies</em><small>Shukriya! Aapki khidmat hamara farz hai.</small></div>
{foot(last)}</section>''')

cat_html = (ROOT / "pdf/catalogue-template.html").read_text().replace("/*PAGES*/", "\n".join(pages))
(ROOT / "pdf/catalogue.html").write_text(cat_html)
print(f"catalogue: {len(pages)} pages")
