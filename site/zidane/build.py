#!/usr/bin/env python3
"""Builds the Zidane General Supplies site into public/.

Edit page content below, then run:  python3 build.py
Shared header, footer, SEO tags and icons are applied to every page.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "public"
SITE_URL = "https://zidane.com.pk"  # change when the real domain is live
PHONE = "+92 300 1234567"
EMAIL = "sales@zidane.com.pk"
SPRITE = (ROOT / "src_sprite.svg").read_text()

FONTS = "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..800&family=IBM+Plex+Mono:wght@500;600&family=Noto+Nastaliq+Urdu:wght@500&display=swap"

LOGO_MARK = ('<svg class="logo-mark" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="7" fill="{fill}"/>'
             '<path d="M9 25 L22 8 L26 8 L13 25 Z" fill="#ffffff"/><path d="M17 25 L25 14.5 L25 25 Z" fill="#ffffff" opacity=".55"/></svg>')
FAVICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34"><rect width="34" height="34" rx="7" fill="#c8102e"/>'
           '<path d="M9 25 L22 8 L26 8 L13 25 Z" fill="#fff"/><path d="M17 25 L25 14.5 L25 25 Z" fill="#fff" opacity=".55"/></svg>')
ARROW = '<svg class="icon"><use href="#i-arrow-right"/></svg>'
URDU_TAGLINE = '<p class="urdu" lang="ur">بہتر کل کے لیے اچھی غذا</p>'

NAV = [
    ("./", "Home", "home"),
    ("products.html", "Products", "products"),
    ("ration.html", "Ration Program", "ration"),
    ("./#industries", "Industries", None),
    ("about.html", "About", "about"),
    ("contact.html", "Contact", "contact"),
]


def header(active):
    current = ' aria-current="page"'
    links = "\n      ".join(
        f'<a href="{href}"{current if key == active else ""}>{label}</a>' for href, label, key in NAV
    )
    return f"""<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="container">
    <a class="logo" href="./" aria-label="Zidane General Supplies, home">
      {LOGO_MARK.format(fill="var(--red)")}
      <span class="logo-word"><b>Zidane</b><small>GENERAL SUPPLIES</small></span>
    </a>
    <nav class="nav" id="nav" aria-label="Main">
      {links}
    </nav>
    <button class="menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
    <a class="btn btn-primary" href="contact.html">Request a quote {ARROW}</a>
  </div>
</header>"""


FOOTER = f"""<footer>
  <div class="container">
    <div class="f-top">
      <div>
        <a class="logo" href="./" aria-label="Zidane General Supplies, home">
          {LOGO_MARK.format(fill="#c8102e")}
          <span class="logo-word"><b>Zidane</b><small>GENERAL SUPPLIES</small></span>
        </a>
        {URDU_TAGLINE}
      </div>
      <div><h4>Company</h4><ul><li><a href="about.html">About us</a></li><li><a href="./#industries">Industries</a></li><li><a href="./#delivery">Delivery</a></li><li><a href="contact.html">Contact</a></li></ul></div>
      <div><h4>Products</h4><ul><li><a href="products.html#rice">Rice and atta</a></li><li><a href="products.html#oil">Oil and ghee</a></li><li><a href="products.html#pulses">Pulses and spices</a></li><li><a href="ration.html">Ration packs</a></li></ul></div>
      <div><h4>Contact</h4><ul><li class="num" data-cfg="phoneDisplay">{PHONE}</li><li data-cfg="email">{EMAIL}</li><li data-cfg="city">Karachi, Pakistan</li></ul></div>
    </div>
    <div class="f-bottom"><span>&copy; <span id="year">2026</span> Zidane General Supplies</span><span>Food for a better tomorrow</span></div>
  </div>
</footer>"""

CTA_BAND = f"""<section class="cta-band">
  <div class="container">
    <div>
      <h2>Ready to price your next order?</h2>
      <p>Send your list and get itemised rates back from our sales team.</p>
    </div>
    <div class="row"><a class="btn btn-light" href="contact.html">Request a quote {ARROW}</a></div>
  </div>
</section>"""


def page_head(crumb, title, lede):
    return f"""<section class="page-head">
  <div class="container">
    <p class="crumbs"><a href="./">Home</a><span aria-hidden="true">/</span><span>{crumb}</span></p>
    <h1>{title}</h1>
    <p class="lede">{lede}</p>
  </div>
</section>"""


# ---------------------------------------------------------------- content

CATEGORIES = [
    ("rice", "Rice", "cat-rice.jpg", "Bowl of long-grain rice", "Sella, basmati and broken grades",
     "Consistent grain length and cooking quality, bag after bag.", ["Sella basmati", "Super kernel basmati", "Steam rice", "Broken rice"]),
    ("flour", "Flour and atta", "cat-flour.jpg", "Wheat flour with wheat stalks", "Chakki atta, maida and besan",
     "Fresh-milled flour for roti, naan and bakery use.", ["Chakki atta", "Fine atta", "Maida", "Besan", "Suji"]),
    ("sugar", "Sugar and salt", "cat-sugar.jpg", "Bowl of white sugar", "Bulk sacks and retail packs",
     "Refined sugar and iodised salt in sack or pack sizes.", ["White sugar", "Iodised salt", "Pink salt"]),
    ("pulses", "Pulses and lentils", "cat-pulses.jpg", "Bowls of assorted lentils and chickpeas", "Chana, masoor, moong and mash",
     "Cleaned and sorted daal for daily kitchen and ration use.", ["Daal chana", "Masoor", "Moong", "Mash", "White chana", "Kala chana"]),
    ("oil", "Cooking oil and ghee", "cat-oil.jpg", "Bottles of cooking oil", "Bottles, cans and bulk tins",
     "Cooking oil and banaspati from bottles to bulk tins.", ["Cooking oil", "Banaspati ghee", "Canola oil", "Sunflower oil"]),
    ("spices", "Spices", "cat-spices.jpg", "Bowls of ground red chilli, turmeric and other spices", "Whole and ground, loose or packed",
     "Ground and whole spices, loose by the kilo or packed.", ["Red chilli", "Turmeric", "Coriander", "Cumin", "Garam masala", "Whole spices"]),
    ("tea", "Tea and coffee", "cat-tea.jpg", "Cup of milk tea on loose tea leaves", "Loose leaf, packets and sachets",
     "Tea for staff rooms, canteens and hotel service.", ["Loose black tea", "Tea bags", "Green tea", "Instant coffee"]),
    ("dairy", "Dairy and dry goods", "cat-dairy.jpg", "Milk, butter and dairy products", "Milk powder, dates and more",
     "The rest of the pantry, sourced with the same order.", ["Milk powder", "UHT milk", "Dates", "Vermicelli"]),
]

INDUSTRIES = [
    ("factory", "Factories and industrial units", "Staff canteens and monthly worker rations"),
    ("bowl-food", "Hotels and restaurants", "Daily staples in grades that stay consistent"),
    ("first-aid-kit", "Hospitals and healthcare", "Patient and staff meal supplies"),
    ("graduation-cap", "Schools and universities", "Hostel mess and cafeteria stock"),
    ("buildings", "Offices and corporate", "Pantry supplies and employee welfare"),
    ("hand-heart", "NGOs and CSR programs", "Ration drives and relief distributions"),
    ("fork-knife", "Catering services", "Event-scale volume on short notice"),
    ("storefront", "Retail and wholesalers", "Resale stock at trade rates"),
]

PACKS = [
    ("essential", "Essential", 2149, "For small families and basic needs"),
    ("standard", "Standard", 3149, "Balanced staples for everyday meals"),
    ("value", "Value", 5249, "Complete monthly essentials"),
    ("family", "Family", 7249, "Larger family pack with premium items"),
]


def calculator():
    packs = "\n".join(
        f'<label class="pack"><input type="radio" name="pack" id="pack-{k}" value="{n}" data-price="{p}"{" checked" if k == "standard" else ""}>'
        f'<span class="name">{n}</span><span class="price num">PKR {p:,}</span><span class="desc">{d}</span></label>'
        for k, n, p, d in PACKS
    )
    return f"""<form class="calc" id="calc" action="contact.html" aria-labelledby="calc-title" novalidate>
  <div>
    <h3 id="calc-title">Estimate your distribution</h3>
    <p class="sub">Pick a pack and the number of families to see the cost before you ask for a quote.</p>
  </div>
  <fieldset class="packs">
    <legend>Ration pack</legend>
    {packs}
  </fieldset>
  <div class="qty">
    <div class="field">
      <label for="families">Number of families</label>
      <div class="stepper">
        <button type="button" id="minus" aria-label="Fewer families">-</button>
        <input id="families" type="number" inputmode="numeric" min="1" max="100000" step="1" value="250">
        <button type="button" id="plus" aria-label="More families">+</button>
      </div>
    </div>
  </div>
  <div class="total">
    <div><div class="k">Estimated total</div><div class="v num" id="total" aria-live="polite">PKR 787,250</div></div>
    <button class="btn btn-primary" type="submit">Request a quote {ARROW}</button>
  </div>
  <p class="fine">List prices per pack. Large orders and custom contents are quoted separately.</p>
</form>"""


def industries_list():
    return "\n".join(
        f'<li class="ind"><span class="ic"><svg class="icon"><use href="#i-{i}"/></svg></span><h3>{t}</h3><p>{d}</p></li>'
        for i, t, d in INDUSTRIES
    )


HOME = f"""<section class="hero">
  <div class="container">
    <div>
      <p class="eyebrow">B2B food supply across Pakistan</p>
      <h1>Bulk food supply you can <em>plan around.</em></h1>
      <p class="lede">Rice, atta, oil, pulses and ration bags for hotels, factories, schools, hospitals and NGOs, delivered on your schedule.</p>
      <div class="hero-ctas">
        <a class="btn btn-primary" href="contact.html">Request a quote {ARROW}</a>
        <a class="btn btn-outline" href="ration.html">See ration packs</a>
      </div>
    </div>
    <div class="hero-media">
      <div class="frame"><img src="img/warehouse.jpg" width="640" height="598" alt="Zidane team member checking stacked rice and flour sacks in the warehouse" fetchpriority="high"></div>
      <div class="hero-card">
        <svg class="icon"><use href="#i-package"/></svg>
        <div><b>Custom packaging</b><span>Your pack sizes, your branding</span></div>
      </div>
    </div>
  </div>
</section>

<section class="proof" aria-label="Zidane at a glance">
  <div class="container">
    <div>
      <div class="stat"><b class="num">1,200+</b><span>products in stock</span></div>
      <div class="stat"><b class="num">500+</b><span>business clients served</span></div>
      <div class="stat"><b>Nationwide</b><span>delivery from Karachi</span></div>
      <div class="stat"><b>In full</b><span>and on the agreed date</span></div>
    </div>
  </div>
</section>

<section id="products">
  <div class="container">
    <h2>Everything your kitchen orders, from one supplier.</h2>
    <p class="lede">Consistent grades, market-linked rates and pack sizes that match how you cook and store.</p>
    <div class="cats">
      {"".join(f'<a class="cat" href="products.html#{k}"><div class="ph"><img src="img/{img}" width="342" height="255" alt="{alt}"></div><h3>{name}</h3><p>{short}</p></a>' for k, name, img, alt, short, _, _ in CATEGORIES)}
    </div>
  </div>
</section>

<section class="ration" id="ration">
  <div class="container">
    <div>
      <h2>Ration bags for welfare, relief and Ramadan.</h2>
      {URDU_TAGLINE}
      <p class="lede">Packed, sealed and delivered in the quantity you need, for employee welfare, NGO drives and community distribution.</p>
      <ul class="programs"><li>Corporate welfare</li><li>NGOs and charity</li><li>Ramadan hampers</li><li>Monthly household packs</li></ul>
      <div class="ration-photo"><img src="img/ration.jpg" width="660" height="464" alt="Zidane ration sacks with packed groceries, oil, pulses and dates"></div>
    </div>
    {calculator()}
  </div>
</section>

<section id="industries">
  <div class="container">
    <h2>Built for kitchens that feed hundreds.</h2>
    <ul class="inds">
      {industries_list()}
    </ul>
  </div>
</section>

<section class="delivery" id="delivery">
  <div class="container">
    <div class="truck"><img src="img/truck.jpg" width="856" height="268" alt="Zidane delivery truck at the warehouse loading bay"></div>
    <div class="delivery-grid">
      <div>
        <h2>From our warehouse to your storeroom.</h2>
        <ul class="checks">
          <li><svg class="icon"><use href="#i-truck"/></svg>Dedicated delivery fleet</li>
          <li><svg class="icon"><use href="#i-seal-check"/></svg>Safe, hygienic handling</li>
          <li><svg class="icon"><use href="#i-clock-countdown"/></svg>Flexible delivery slots</li>
          <li><svg class="icon"><use href="#i-map-pin"/></svg>Nationwide coverage</li>
        </ul>
      </div>
      <ol class="steps">
        <li class="step"><svg class="icon"><use href="#i-list-checks"/></svg><h3>Send your list</h3><p>Items, quantities and how often you need them.</p></li>
        <li class="step"><svg class="icon"><use href="#i-calculator"/></svg><h3>Get a written quote</h3><p>Itemised rates you can take to your finance team.</p></li>
        <li class="step"><svg class="icon"><use href="#i-clock-countdown"/></svg><h3>Pick a delivery slot</h3><p>One-off, weekly or monthly, to one site or many.</p></li>
        <li class="step"><svg class="icon"><use href="#i-check-circle"/></svg><h3>Receive and check</h3><p>Count it at your door against the delivery note.</p></li>
      </ol>
    </div>
  </div>
</section>

{CTA_BAND}"""


PRODUCTS = page_head("Products", "Food supply categories", "Staples for kitchens, canteens and ration programs, supplied in bulk sacks, tins or retail packs. Ask for anything not listed.") + f"""
<section>
  <div class="container catalog">
    {"".join(f'''<article class="prod" id="{k}">
      <div class="ph"><img src="img/{img}" width="342" height="255" alt="{alt}"></div>
      <div>
        <h2>{name}</h2>
        <p class="lede">{long}</p>
        <ul class="chips">{"".join(f"<li>{i}</li>" for i in items)}</ul>
        <a class="btn btn-outline" href="contact.html" data-item="{name}">Add to my quote {ARROW}</a>
      </div>
    </article>''' for k, name, img, alt, short, long, items in CATEGORIES)}
  </div>
</section>
{CTA_BAND}"""


PROGRAMS = [
    ("buildings", "Corporate welfare", "Monthly or festive ration packs for employees, delivered to one office or every site."),
    ("hand-heart", "NGOs and charity", "Relief and community drives packed to your list, labelled and ready to hand out."),
    ("package", "Ramadan hampers", "Iftar and sehri staples in curated hampers, ordered early and delivered before the first roza."),
    ("calculator", "Monthly household packs", "Recurring packs for households you support, on a fixed delivery date each month."),
]

RATION = page_head("Ration Program", "Ration bags and Ramadan programs", "Nutritious, sealed ration packs for corporate welfare, NGOs and community distribution, at list prices you can budget around.") + f"""
<section>
  <div class="container split">
    <div class="ph"><img src="img/ration.jpg" width="660" height="464" alt="Zidane ration sacks with packed groceries, oil, pulses and dates"></div>
    {calculator()}
  </div>
</section>

<section class="delivery">
  <div class="container">
    <h2>Programs we pack for</h2>
    <div class="prog-grid">
      {"".join(f'<div class="prog"><span class="ic"><svg class="icon"><use href="#i-{i}"/></svg></span><h3>{t}</h3><p>{d}</p></div>' for i, t, d in PROGRAMS)}
    </div>
  </div>
</section>

<section>
  <div class="container split">
    <div class="prose">
      <h2>Need different contents?</h2>
      <p>We build packs to your list and budget, and can print your organisation's name on the bag. Share the items per family and the number of families, and we'll send an itemised quote.</p>
      <a class="btn btn-primary" href="contact.html" style="margin-top:24px">Request a quote {ARROW}</a>
    </div>
    <ul class="checks">
      <li><svg class="icon"><use href="#i-seal-check"/></svg>Sealed, food-grade packing</li>
      <li><svg class="icon"><use href="#i-package"/></svg>Custom contents and branding</li>
      <li><svg class="icon"><use href="#i-truck"/></svg>Delivery to distribution points</li>
      <li><svg class="icon"><use href="#i-list-checks"/></svg>Packing list with every order</li>
    </ul>
  </div>
</section>"""


VALUES = [
    ("seal-check", "Checked quality", "Stock is inspected on arrival and before dispatch."),
    ("calculator", "Fair market rates", "Itemised quotes that track the market, not guesswork."),
    ("clock-countdown", "On time, in full", "The quantity you ordered, on the date we agreed."),
    ("package", "Packed your way", "Pack sizes and branding to suit how you store and share."),
]

ABOUT = page_head("About", "Good food builds stronger businesses.", "Zidane General Supplies is a Karachi-based food supplier serving businesses and institutions across Pakistan.") + f"""
<section>
  <div class="container split">
    <div class="prose">
      <h2>One supplier for the whole pantry</h2>
      <p>Kitchens run on staples: rice, atta, oil, daal, sugar and tea. We keep them in stock at scale, so hotels, factories, schools, hospitals and NGOs can order everything from one place and plan around a delivery date they can trust.</p>
      <p>From daily kitchen orders to thousands of ration bags for a Ramadan drive, we quote clearly, pack carefully and deliver what we promised.</p>
    </div>
    <div class="ph"><img src="img/warehouse.jpg" width="640" height="598" alt="Zidane team member in the warehouse with stacked food sacks"></div>
  </div>
</section>

<section class="delivery">
  <div class="container">
    <h2>How we work</h2>
    <ul class="values">
      {"".join(f'<li><svg class="icon"><use href="#i-{i}"/></svg><h3>{t}</h3><p>{d}</p></li>' for i, t, d in VALUES)}
    </ul>
  </div>
</section>

<section>
  <div class="container">
    <div class="truck"><img src="img/truck.jpg" width="856" height="268" alt="Zidane delivery truck at the warehouse loading bay"></div>
    <h2 style="margin-top:40px">Who we supply</h2>
    <ul class="inds">
      {industries_list()}
    </ul>
  </div>
</section>
{CTA_BAND}"""


CONTACT = f"""<section class="quote" id="quote">
  <div class="container">
    <div>
      <p class="crumbs"><a href="./">Home</a><span aria-hidden="true">/</span><span>Contact</span></p>
      <h1 style="font-size:clamp(34px,4.4vw,52px);font-weight:800;line-height:1.05">Tell us what you need. We'll price it.</h1>
      <p class="lede">Fill in the form and your request opens in WhatsApp, ready to send to our sales team.</p>
      <ul class="contact-list">
        <li><svg class="icon"><use href="#i-whatsapp-logo"/></svg><div><b>WhatsApp and phone</b><span class="num" data-cfg="phoneDisplay">{PHONE}</span></div></li>
        <li><svg class="icon"><use href="#i-envelope-simple"/></svg><div><b>Email</b><span data-cfg="email">{EMAIL}</span></div></li>
        <li><svg class="icon"><use href="#i-map-pin"/></svg><div><b>Warehouse</b><span data-cfg="city">Karachi, Pakistan</span></div></li>
      </ul>
    </div>

    <form class="card" id="quote-form" novalidate>
      <div class="field"><label for="q-name">Your name</label><input class="input" id="q-name" autocomplete="name" placeholder="Ayesha Siddiqui"><p class="err" id="q-name-err"></p></div>
      <div class="field"><label for="q-company">Organisation</label><input class="input" id="q-company" autocomplete="organization" placeholder="Hotel, factory, school or NGO"></div>
      <div class="field"><label for="q-phone">Phone or WhatsApp</label><input class="input num" id="q-phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="03xx xxxxxxx"><p class="err" id="q-phone-err"></p></div>
      <div class="field"><label for="q-industry">Industry</label>
        <select class="input" id="q-industry">
          <option value="">Choose one</option>
          <option>Factory or industrial unit</option><option>Hotel or restaurant</option><option>Hospital or healthcare</option>
          <option>School or university</option><option>Office or corporate</option><option>NGO or CSR program</option>
          <option>Catering service</option><option>Retail or wholesale</option><option>Other</option>
        </select>
      </div>
      <div class="field full"><label for="q-needs">What do you need?</label><textarea class="input" id="q-needs" placeholder="e.g. 20 x 25 kg sella rice, 10 x 16 L oil tins, monthly delivery to Korangi"></textarea><p class="err" id="q-needs-err"></p></div>
      <div class="field"><label for="q-city">Delivery city</label><input class="input" id="q-city" autocomplete="address-level2" placeholder="Karachi"></div>
      <div class="field"><label for="q-freq">How often?</label>
        <select class="input" id="q-freq"><option>One-time order</option><option>Weekly</option><option>Monthly</option><option>Ramadan or seasonal</option></select>
      </div>
      <div class="form-foot full">
        <p class="fine">We only use your details to reply to this request.</p>
        <button class="btn btn-primary" type="submit">Prepare my request {ARROW}</button>
      </div>
      <div class="done" id="done" hidden>
        <h3><svg class="icon"><use href="#i-check-circle"/></svg>Your request is ready</h3>
        <p class="fine">Send it on WhatsApp or by email. Nothing is sent until you do.</p>
        <pre id="msg"></pre>
        <div class="row">
          <a class="btn btn-primary" id="wa-link" href="#" target="_blank" rel="noopener">Open WhatsApp <svg class="icon"><use href="#i-whatsapp-logo"/></svg></a>
          <a class="btn btn-outline" id="mail-link" href="#"><svg class="icon"><use href="#i-envelope-simple"/></svg>Email it</a>
          <button class="btn btn-outline" type="button" id="copy-btn"><svg class="icon"><use href="#i-copy"/></svg>Copy message</button>
          <button class="btn btn-outline" type="button" id="edit-btn">Edit request</button>
        </div>
      </div>
    </form>
  </div>
</section>"""


NOT_FOUND = f"""<section class="notfound">
  <div class="container">
    <h1 style="font-size:clamp(34px,4.4vw,52px);font-weight:800">This page isn't here.</h1>
    <p class="lede">The link may be old or mistyped. Try the home page or send us your list directly.</p>
    <div class="hero-ctas"><a class="btn btn-primary" href="./">Go to home {ARROW}</a><a class="btn btn-outline" href="contact.html">Contact</a></div>
  </div>
</section>"""


PAGES = [
    # file, active nav key, <title>, meta description, body
    ("index.html", "home", "Zidane General Supplies | B2B Food Supply and Ration Bags in Pakistan",
     "Bulk rice, atta, oil, pulses and ration bags for hotels, factories, schools, hospitals and NGOs across Pakistan. Request a quote from Zidane General Supplies.", HOME),
    ("products.html", "products", "Products | Zidane General Supplies",
     "Rice, flour and atta, sugar, pulses, cooking oil and ghee, spices, tea and dairy supplied in bulk by Zidane General Supplies.", PRODUCTS),
    ("ration.html", "ration", "Ration Bags and Ramadan Packages | Zidane General Supplies",
     "Ration packs from PKR 2,149 for corporate welfare, NGOs and Ramadan distribution. Estimate your total and request a quote.", RATION),
    ("about.html", "about", "About Us | Zidane General Supplies",
     "Zidane General Supplies is a Karachi-based B2B food supplier serving businesses and institutions across Pakistan.", ABOUT),
    ("contact.html", "contact", "Request a Quote | Zidane General Supplies",
     "Send your food supply list and get an itemised quote from Zidane General Supplies by WhatsApp or email.", CONTACT),
    ("404.html", None, "Page not found | Zidane General Supplies", "This page could not be found.", NOT_FOUND),
]

JSON_LD = json.dumps({
    "@context": "https://schema.org",
    "@type": "WholesaleStore",
    "name": "Zidane General Supplies",
    "url": SITE_URL + "/",
    "telephone": PHONE,
    "email": EMAIL,
    "slogan": "Food for a better tomorrow",
    "address": {"@type": "PostalAddress", "addressLocality": "Karachi", "addressCountry": "PK"},
    "areaServed": "PK",
}, ensure_ascii=False)


def head_tags(file, title, desc):
    url = SITE_URL + "/" + ("" if file == "index.html" else file)
    ld = f'\n<script type="application/ld+json">{JSON_LD}</script>' if file == "index.html" else ""
    return f"""<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zidane General Supplies">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE_URL}/img/warehouse.jpg">
<meta name="theme-color" content="#c8102e">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="assets/style.css">{ld}"""


def body(active, content):
    return f"""{SPRITE}
{header(active)}
<main id="main">
{content}
</main>
{FOOTER}
<script src="assets/main.js"></script>"""


def build():
    for file, active, title, desc, content in PAGES:
        html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{head_tags(file, title, desc)}
</head>
<body>
{body(active, content)}
</body>
</html>
"""
        (OUT / file).write_text(html)
    (OUT / "favicon.svg").write_text(FAVICON)
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n")
    urls = "".join(f"  <url><loc>{SITE_URL}/{'' if f == 'index.html' else f}</loc></url>\n" for f, *_ in PAGES if f != "404.html")
    (OUT / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')
    # Preview copy of the home page for the claude.ai artifact (no doctype wrapper; the viewer adds its own)
    file, active, title, desc, content = PAGES[0]
    (ROOT / "preview-home.html").write_text(head_tags(file, "Zidane General Supplies", desc) + "\n" + body(active, content) + "\n")
    print("built", len(PAGES), "pages")


if __name__ == "__main__":
    build()
