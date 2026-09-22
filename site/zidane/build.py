#!/usr/bin/env python3
"""Builds the Zidane Wholesale Solutions site into public/.

Edit page content below, then run:  python3 build.py
Shared nav, footer, SEO tags and icons are applied to every page.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "public"
SITE_URL = "https://www.zidane.com.pk"  # change when the real domain is live
PHONE = "+92 300 1234567"
EMAIL = "sales@zidane.com.pk"
SPRITE = (ROOT / "src_sprite.svg").read_text()

FONTS = "https://fonts.googleapis.com/css2?family=Montserrat:wght@500..800&family=Lato:wght@400;700&family=Geist+Mono:wght@500;600&family=Noto+Nastaliq+Urdu:wght@500&display=swap"

LOGO = '<svg class="logo-svg" viewBox="0 0 10 4" aria-hidden="true"><use href="#zidane-logo"/></svg>'
FAVICON = (ROOT / "brand" / "zidane-icon.svg").read_text()
TAGLINE = "Your dedicated food service partner"
URDU = '<p class="urdu" lang="ur">بہتر کل کے لیے اچھی غذا</p>'


def icon(name):
    return f'<svg class="icon" aria-hidden="true"><use href="#i-{name}"/></svg>'


def btn(label, href, style="btn-red", ic="arrow-up-right", extra=""):
    return f'<a class="btn {style}" href="{href}"{extra}>{label}<span class="bi">{icon(ic)}</span></a>'


def bezel(inner, cls="", core_cls=""):
    return f'<div class="bezel {cls}"><div class="core {core_cls}">{inner}</div></div>'


NAV = [
    ("./", "Home", "home"),
    ("./#industries", "Industries We Serve", None),
    ("ration.html", "Business Solutions", "ration"),
    ("products.html", "Products & Services", "products"),
    ("about.html", "About Us", "about"),
]


def nav(active):
    cur = ' aria-current="page"'
    small = "".join(f'<a href="{h}"{cur if k == active else ""}>{l}</a>' for h, l, k in NAV)
    big = "".join(f'<a class="big" href="{h}"{cur if k == active else ""}>{l}</a>' for h, l, k in NAV)
    return f"""<a class="sr" href="#main">Skip to content</a>
<div class="nav-wrap">
  <header class="island">
    <a class="logo" href="./" aria-label="Zidane Wholesale Solutions, home">{LOGO}</a>
    <nav class="links" aria-label="Main">{small}</nav>
    <div class="nav-ctas">{btn("Become A Customer", "contact.html#customer", "btn-soft sm", "user")}{btn("Request A Quote", "contact.html", "btn-red sm")}</div>
    <button class="burger" id="burger" type="button" aria-expanded="false" aria-controls="overlay" aria-label="Open menu"><span></span><span></span></button>
  </header>
</div>
<div class="overlay" id="overlay" aria-hidden="true">
  <nav aria-label="Menu">{big}<a class="big" href="contact.html">Contact</a></nav>
  <div class="row">{btn("Request A Quote", "contact.html")}{btn("Become A Customer", "contact.html#customer", "btn-soft", "user")}</div>
</div>"""


FOOTER = f"""<footer>
  <div class="container">
    <div class="f-top">
      <div>
        <a class="logo" href="./" aria-label="Zidane Wholesale Solutions, home">{LOGO}</a>
        <p class="f-tag">{TAGLINE}</p>
      </div>
      <div><h4>Company</h4><ul><li><a href="about.html">About us</a></li><li><a href="./#industries">Industries</a></li><li><a href="./#delivery">Delivery</a></li><li><a href="contact.html">Contact</a></li></ul></div>
      <div><h4>Products</h4><ul><li><a href="products.html#rice">Rice and atta</a></li><li><a href="products.html#oil">Oil and ghee</a></li><li><a href="products.html#pulses">Pulses and spices</a></li><li><a href="ration.html">Ration packs</a></li></ul></div>
      <div><h4>Contact</h4><ul><li class="num" data-cfg="phoneDisplay">{PHONE}</li><li data-cfg="email">{EMAIL}</li><li data-cfg="city">Karachi, Pakistan</li></ul></div>
    </div>
    <div class="f-bottom"><span>&copy; <span id="year">2026</span> Zidane Wholesale Solutions</span><span>{TAGLINE}</span></div>
  </div>
</footer>"""

CTA = f"""<section class="section tight cta">
  <div class="container rv">
    {bezel(f'''<div class="cta-in">
      <div><h2 class="h-lg">Ready to price your next order?</h2><p>Send your list and get itemised rates back from our sales team.</p></div>
      {btn("Request A Quote", "contact.html", "btn-white")}
    </div>''', core_cls="red")}
  </div>
</section>"""


def page_head(crumb, title, lede):
    return f"""<section class="page-head">
  <div class="container">
    <p class="crumbs"><a href="./">Home</a><span aria-hidden="true">/</span><span>{crumb}</span></p>
    <h1 class="h-lg">{title}</h1>
    <p class="lede">{lede}</p>
  </div>
</section>"""


# ---------------------------------------------------------------- content

CATEGORIES = [
    ("rice", "Rice", "real-rice.jpg", "Clear Zidane pack of rice", "Sella and basmati in Zidane packs",
     "Consistent grain and cooking quality, packed in Zidane pouches or supplied in bulk sacks.", ["Sella basmati", "Super kernel basmati", "Steam rice", "Broken rice"]),
    ("flour", "Flour and atta", "p/atta.jpg", "M.P Flour Mill chakki atta sack", "Chakki atta, maida and besan",
     "Fresh-milled atta in 10 kg bags, with maida, besan and suji.", ["Chakki atta", "Fine atta", "Maida", "Besan", "Suji"]),
    ("sugar", "Sugar and salt", "p/salt.jpg", "Pack of National iodized salt", "Zidane sugar, National salt",
     "Refined sugar in Zidane packs and iodised salt, in pack or sack sizes.", ["White sugar", "Iodised salt", "Pink salt"]),
    ("pulses", "Pulses and lentils", "p/moong.jpg", "Zidane pack of moong daal", "Chana, moong, masoor, kala chana",
     "Cleaned and sorted daal in Zidane packs for kitchens and ration bags.", ["Chana daal", "Moong daal", "Masoor", "Mash", "Kala chana", "White chana"]),
    ("spices", "Spices", "p/chilli.jpg", "Pack of red chilli powder", "Whole and ground",
     "Ground and whole spices, loose by the kilo or packed.", ["Red chilli", "Turmeric", "Coriander", "Cumin", "Garam masala", "Whole spices"]),
    ("oil", "Cooking oil and ghee", "p/oil.jpg", "Kausar fortified canola oil, 3 litre carton", "Kausar canola, oil and ghee",
     "Canola and cooking oil in cartons, bottles and tins, plus banaspati ghee.", ["Canola oil", "Cooking oil", "Banaspati ghee", "Sunflower oil"]),
    ("tea", "Tea and drinks", "p/tea.jpg", "Box of Shahzada special tea", "Shahzada tea, Rooh Afza",
     "Tea for staff rooms and canteens, and sherbet for Ramadan packs.", ["Loose black tea", "Tea bags", "Sherbet", "Instant coffee"]),
    ("dry", "Dry goods", "p/vermicelli.jpg", "Zidane vermicelli pack", "Zidane vermicelli and more",
     "The rest of the pantry, sourced with the same order.", ["Vermicelli", "Dates", "Milk powder", "Custard"]),
]
SHOWCASE = [
    ("bag", "Zidane ration bag", "Red woven, reusable"), ("atta", "Chakki atta", "M.P Flour Mill"),
    ("moong", "Moong daal", "Zidane pack"), ("kala-chana", "Kala chana", "Zidane pack"),
    ("chilli", "Red chilli powder", "Sealed pack"), ("salt", "Iodised salt", "National"),
    ("oil", "Canola oil, 3 L", "Kausar"), ("tea", "Special tea", "Shahzada"),
    ("vermicelli", "Vermicelli", "Zidane"), ("rooh-afza", "Sherbet", "Rooh Afza"),
]
RATION_ITEMS = ["Chakki atta, 10 kg", "Rice", "Sugar", "Chana daal", "Moong daal", "Kala chana", "Besan",
                "Canola oil", "Red chilli powder", "Iodised salt", "Tea", "Vermicelli", "Sherbet"]
# Bento sizes, in CATEGORIES order: 2x2 hero tile, four singles, one wide, two singles = 12 cells on 4 columns
BENTO = ["big", "", "", "", "", "wide", "", ""]

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
    packs = "".join(
        f'<label class="pack"><input type="radio" name="pack" id="pack-{k}" value="{n}" data-price="{p}"{" checked" if k == "standard" else ""}>'
        f'<span class="name">{n}</span><span class="price num">PKR {p:,}</span><span class="desc">{d}</span></label>'
        for k, n, p, d in PACKS
    )
    return f"""<form class="calc bezel calc-shell" id="calc" action="contact.html" aria-labelledby="calc-title" novalidate>
  <div class="core pad">
    <div><h3 id="calc-title">Estimate your distribution</h3><p class="sub">Pick a pack and the number of families to see the cost first.</p></div>
    <fieldset class="packs"><legend class="sr">Ration pack</legend>{packs}</fieldset>
    <div class="field">
      <label for="families">Number of families</label>
      <div class="stepper">
        <button type="button" id="minus" aria-label="Fewer families">-</button>
        <input id="families" type="number" inputmode="numeric" min="1" max="100000" step="1" value="250">
        <button type="button" id="plus" aria-label="More families">+</button>
      </div>
    </div>
    <div class="total">
      <div><div class="k">Estimated total</div><div class="v num" id="total" aria-live="polite">PKR 787,250</div></div>
      <button class="btn btn-red" type="submit">Request A Quote<span class="bi">{icon("arrow-up-right")}</span></button>
    </div>
    <p class="fine">List prices per pack. Large orders and custom contents are quoted separately.</p>
  </div>
</form>"""


def industries_block():
    items = "".join(f'<li class="ind">{icon(i)}<h3>{t}</h3><p>{d}</p></li>' for i, t, d in INDUSTRIES)
    return bezel(f'<ul class="inds">{items}</ul>')


def pic(img, alt):
    w, h = (800, 800) if img.startswith("p/") else (720, 540)
    return f'<img src="img/{img}" width="{w}" height="{h}" alt="{alt}">'


def studio(img):
    return " studio" if img.startswith("p/") else ""


def bento():
    tiles = []
    for (k, name, img, alt, short, _, _), size in zip(CATEGORIES, BENTO):
        tiles.append(f'<a class="tile bezel rv {size}{studio(img)}" href="products.html#{k}"><div class="core">'
                     f'<div class="photo">{pic(img, alt)}</div>'
                     f'<div class="cap"><div><h3>{name}</h3><p>{short}</p></div><span class="go">{icon("arrow-up-right")}</span></div>'
                     f'</div></a>')
    return f'<div class="bento">{"".join(tiles)}</div>'


VALUES = [
    ("seal-check", "Premium commodities", "Stock is checked on arrival and again before dispatch."),
    ("calculator", "Transparent wholesale pricing", "Itemised quotes that track the market, with no hidden margins."),
    ("clock-countdown", "On time, in full", "The quantity you ordered, on the date we agreed."),
    ("package", "Packed in Zidane bags", "Sealed, labelled packs in the sizes you store and share."),
]

FLOW = [
    ("list-checks", "Send your list", "Items, quantities and how often you need them."),
    ("calculator", "Get a written quote", "Itemised rates you can take to your finance team."),
    ("clock-countdown", "Pick a delivery slot", "One-off, weekly or monthly, to one site or many."),
    ("check-circle", "Receive and check", "Count it at your door against the delivery note."),
]

HOME = f"""<section class="hero">
  <div class="container">
    <div>
      <span class="tag">Wholesale food supply across Pakistan</span>
      <h1 class="h-xl">Your dedicated <em class="red">food service partner.</em></h1>
      <p class="lede">Join the Zidane Wholesale network for premium commodities, transparent wholesale pricing and a supply chain built for your success.</p>
      <div class="ctas">{btn("Become Our Customer", "contact.html#customer")}{btn("Request A Quote", "contact.html", "btn-soft", "arrow-right")}</div>
    </div>
    <div class="cascade">
      {bezel('<div class="photo" style="height:100%"><img src="img/zidane-bag.jpg" width="1100" height="1596" alt="Red Zidane Wholesale Solutions ration bag with atta, rice, daal, sugar, oil and tea" fetchpriority="high"></div>', "c1")}
      {bezel('<div class="photo" style="height:100%"><img src="img/p/bag.jpg" width="800" height="800" alt="Red woven Zidane Wholesale Solutions bag"></div>', "c2 studio")}
      {bezel('<div class="photo" style="height:100%"><img src="img/real-rice.jpg" width="720" height="540" alt="Clear Zidane pack of rice"></div>', "c3")}
      <div class="chip"><span class="dot">{icon("package")}</span>Packed in Zidane bags</div>
    </div>
  </div>
</section>

<section class="stats" aria-label="Zidane at a glance">
  <div class="container">
    {bezel('''<div class="stat"><b class="num">1,200+</b><span>products in stock</span></div>
      <div class="stat"><b class="num">500+</b><span>business clients served</span></div>
      <div class="stat"><b>Nationwide</b><span>delivery from Karachi</span></div>
      <div class="stat"><b>In full</b><span>on the agreed date</span></div>''')}
  </div>
</section>

<section class="section" style="padding-bottom:0">
  <div class="container">
    <h2 class="h-lg rv">Core value <em class="red">propositions.</em></h2>
    <ul class="values">
      {"".join(f'<li class="bezel rv"><div class="core">{icon(i)}<h3 class="h-sm">{t}</h3><p class="body">{d}</p></div></li>' for i, t, d in VALUES)}
    </ul>
  </div>
</section>

<section class="section" id="products">
  <div class="container">
    <h2 class="h-lg rv">Everything your kitchen orders, <em class="red">from one supplier.</em></h2>
    <p class="lede rv">Consistent grades, market-linked rates and pack sizes that match how you cook and store.</p>
    {bento()}
  </div>
</section>

<section class="ration" id="ration">
  <div class="container rv">
    {bezel(f'''<div class="ration-grid">
      <div>
        <span class="tag on-red">Business Solutions</span>
        <h2 class="h-lg">Ration bags for welfare, relief and Ramadan.</h2>
        {URDU}
        <p class="lede">A typical Zidane ration bag holds these staples. Contents and quantities vary by pack.</p>
        <ul class="pills">{"".join(f"<li>{i}</li>" for i in RATION_ITEMS)}</ul>
        <div class="bezel inset"><div class="core photo"><img src="img/zidane-pack.jpg" width="1500" height="1021" alt="Zidane ration bag contents: atta, rice, sugar, daal, besan, oil, tea, salt, chilli and vermicelli"></div></div>
      </div>
      {calculator()}
    </div>''', core_cls="red")}
  </div>
</section>

<section class="section" id="industries">
  <div class="container split">
    <div class="sticky rv">
      <h2 class="h-lg">Built for kitchens that feed hundreds.</h2>
      <p class="lede">From a single hotel kitchen to every canteen across a factory group.</p>
      <div style="margin-top:34px">{btn("Request A Quote", "contact.html", "btn-soft")}</div>
    </div>
    <div class="rv">{industries_block()}</div>
  </div>
</section>

<section class="section tight" id="delivery">
  <div class="container">
    <div class="truck rv">{bezel('<div class="photo" style="height:100%"><img src="img/truck.jpg" width="856" height="268" alt="Zidane delivery truck at the warehouse loading bay"></div>')}</div>
    <div class="del-grid">
      <div class="rv">
        <h2 class="h-md">From our warehouse to your storeroom.</h2>
        <ul class="checks">
          <li>{icon("truck")}Dedicated delivery fleet</li>
          <li>{icon("seal-check")}Safe, hygienic handling</li>
          <li>{icon("clock-countdown")}Flexible delivery slots</li>
          <li>{icon("map-pin")}Nationwide coverage</li>
        </ul>
      </div>
      <ol class="flow rv">
        {"".join(f'<li><span class="ic">{icon(i)}</span><div><h3>{t}</h3><p class="body">{d}</p></div></li>' for i, t, d in FLOW)}
      </ol>
    </div>
  </div>
</section>

{CTA}"""


def prod_card(k, name, img, alt, short, long, items):
    chips = "".join(f"<li>{i}</li>" for i in items)
    add = btn("Add to quote", "contact.html", "btn-soft sm", "arrow-up-right", ' data-item="' + name + '"')
    return (f'<article class="prod bezel rv{studio(img)}" id="{k}"><div class="core">'
            f'<div class="photo">{pic(img, alt)}</div>'
            f'<div class="txt"><h2 class="h-sm" style="font-size:24px">{name}</h2><p class="body">{long}</p>'
            f'<ul class="chips">{chips}</ul>{add}</div></div></article>')


PRODUCTS = page_head("Products", "Food supply <em class=\"red\">categories.</em>", "Staples for kitchens, canteens and ration programs, in bulk sacks, tins or retail packs. Ask for anything not listed.") + f"""
<section class="section tight" style="padding-top:0">
  <div class="container catalog">
    {"".join(prod_card(*c) for c in CATEGORIES)}
  </div>
</section>
{CTA}"""


PROGRAMS = [
    ("buildings", "Corporate welfare", "Monthly or festive ration packs for employees, delivered to one office or every site.", ""),
    ("hand-heart", "NGOs and charity", "Relief and community drives packed to your list, labelled and ready to hand out.", "tint"),
    ("package", "Ramadan hampers", "Iftar and sehri staples in curated hampers, delivered before the first roza.", "ink"),
    ("calculator", "Monthly household packs", "Recurring packs for the households you support, on a fixed date each month.", ""),
]

RATION = page_head("Business Solutions", "Ration bags and <em class=\"red\">Ramadan programs.</em>", "Sealed ration packs for corporate welfare, NGOs and community distribution, at list prices you can budget around.") + f"""
<section class="ration" style="padding-bottom:0">
  <div class="container rv">
    {bezel(f'''<div class="ration-grid">
      <div>
        <h2 class="h-md" style="color:#fff">What goes in a Zidane ration bag.</h2>
        {URDU}
        <ul class="pills">{"".join(f"<li>{i}</li>" for i in RATION_ITEMS)}</ul>
        <div class="bezel inset"><div class="core photo"><img src="img/zidane-pack.jpg" width="1500" height="1021" alt="Zidane ration bag contents: atta, rice, sugar, daal, besan, oil, tea, salt, chilli and vermicelli"></div></div>
      </div>
      {calculator()}
    </div>''', core_cls="red")}
  </div>
</section>

<section class="section" style="padding-bottom:0">
  <div class="container">
    <h2 class="h-lg rv">Inside a <em class="red">Zidane ration bag.</em></h2>
    <p class="lede rv">Trusted brands and Zidane-packed staples, sealed in one red bag. Contents vary by pack.</p>
    <ul class="showcase">
      {"".join(f'<li class="bezel rv studio"><div class="core"><div class="photo"><img src="img/p/{k}.jpg" width="800" height="800" alt="{n}, {b}" loading="lazy"></div><div class="cap"><h3>{n}</h3><p>{b}</p></div></div></li>' for k, n, b in SHOWCASE)}
    </ul>
  </div>
</section>

<section class="section">
  <div class="container">
    <h2 class="h-lg rv">Programs we pack for.</h2>
    <div class="prog-bento">
      {"".join(f'<div class="prog bezel rv {c}"><div class="core">{icon(i)}<h3 class="h-sm">{t}</h3><p class="body">{d}</p></div></div>' for i, t, d, c in PROGRAMS)}
    </div>
  </div>
</section>

<section class="section tight" style="padding-top:0">
  <div class="container split">
    <div class="rv">
      <h2 class="h-md">Need different contents?</h2>
      <p class="lede">We build packs to your list and budget, and can print your organisation's name on the bag.</p>
      <div style="margin-top:30px">{btn("Request A Quote", "contact.html")}</div>
    </div>
    <ul class="checks rv">
      <li>{icon("seal-check")}Sealed, food-grade packing</li>
      <li>{icon("package")}Custom contents and branding</li>
      <li>{icon("truck")}Delivery to distribution points</li>
      <li>{icon("list-checks")}Packing list with every order</li>
    </ul>
  </div>
</section>"""



ABOUT = page_head("About", "Good food builds <em class=\"red\">stronger businesses.</em>", "Zidane Wholesale Solutions is a Karachi-based food supplier serving businesses and institutions across Pakistan.") + f"""
<section class="section tight" style="padding-top:0">
  <div class="container split" style="align-items:center">
    <div class="prose rv">
      <h2 class="h-md">One supplier for the whole pantry.</h2>
      <p>Kitchens run on staples: rice, atta, oil, daal, sugar and tea. We keep them in stock at scale, so hotels, factories, schools, hospitals and NGOs can order everything from one place and plan around a delivery date they can trust.</p>
      <p>From daily kitchen orders to thousands of ration bags for a Ramadan drive, we quote clearly, pack carefully and deliver what we promised.</p>
    </div>
    <div class="rv">{bezel('<div class="photo"><img src="img/zidane-bag.jpg" width="1100" height="1596" alt="Red Zidane Wholesale Solutions bag with packed staples"></div>')}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    <h2 class="h-lg rv">How we work.</h2>
    <ul class="values">
      {"".join(f'<li class="bezel rv"><div class="core">{icon(i)}<h3 class="h-sm">{t}</h3><p class="body">{d}</p></div></li>' for i, t, d in VALUES)}
    </ul>
  </div>
</section>

<section class="section tight" style="padding-top:0">
  <div class="container split">
    <div class="sticky rv"><h2 class="h-lg">Who we supply.</h2>
      <div class="truck" style="margin-top:34px">{bezel('<div class="photo" style="height:100%"><img src="img/truck.jpg" width="856" height="268" alt="Zidane delivery truck at the warehouse loading bay"></div>')}</div>
    </div>
    <div class="rv">{industries_block()}</div>
  </div>
</section>
{CTA}"""


CONTACT = f"""<section class="section tight">
  <div class="container split">
    <div>
      <p class="crumbs"><a href="./">Home</a><span aria-hidden="true">/</span><span>Contact</span></p>
      <h1 class="h-lg" id="c-title">Tell us what you need. <em class="red">We'll price it.</em></h1>
      <p class="lede">Fill in the form and your request opens in WhatsApp, ready to send to our sales team.</p>
      <ul class="contact-list">
        <li><span class="ic">{icon("whatsapp-logo")}</span><div><small>WhatsApp and phone</small><span class="num" data-cfg="phoneDisplay">{PHONE}</span></div></li>
        <li><span class="ic">{icon("envelope-simple")}</span><div><small>Email</small><span data-cfg="email">{EMAIL}</span></div></li>
        <li><span class="ic">{icon("map-pin")}</span><div><small>Warehouse</small><span data-cfg="city">Karachi, Pakistan</span></div></li>
      </ul>
    </div>

    <form class="quote-card bezel" id="quote-form" novalidate><div class="core">
      <fieldset class="seg full field"><legend class="sr">What would you like to do?</legend>
        <label><input type="radio" name="q-type" id="q-type-quote" value="quote" checked><span>Request A Quote</span></label>
        <label><input type="radio" name="q-type" id="q-type-customer" value="customer"><span>Become A Customer</span></label>
      </fieldset>
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
      <div class="field full"><label for="q-needs" id="q-needs-label">What do you need?</label><textarea class="input" id="q-needs" placeholder="e.g. 20 x 25 kg sella rice, 10 x 16 L oil tins, monthly delivery to Korangi"></textarea><p class="err" id="q-needs-err"></p></div>
      <div class="field"><label for="q-city">Delivery city</label><input class="input" id="q-city" autocomplete="address-level2" placeholder="Karachi"></div>
      <div class="field"><label for="q-freq">How often?</label>
        <select class="input" id="q-freq"><option>One-time order</option><option>Weekly</option><option>Monthly</option><option>Ramadan or seasonal</option></select>
      </div>
      <div class="form-foot full">
        <p class="fine">We only use your details to reply to this request.</p>
        <button class="btn btn-red" type="submit">Prepare my request<span class="bi">{icon("arrow-up-right")}</span></button>
      </div>
      <div class="done" id="done" hidden>
        <h3>{icon("check-circle")}Your request is ready</h3>
        <p class="fine">Send it on WhatsApp or by email. Nothing is sent until you do.</p>
        <pre id="msg"></pre>
        <div class="row">
          <a class="btn btn-red" id="wa-link" href="#" target="_blank" rel="noopener">Open WhatsApp<span class="bi">{icon("whatsapp-logo")}</span></a>
          <a class="btn btn-soft" id="mail-link" href="#">Email it<span class="bi">{icon("envelope-simple")}</span></a>
          <button class="btn btn-soft btn-plain" type="button" id="copy-btn">Copy message</button>
          <button class="btn btn-soft btn-plain" type="button" id="edit-btn">Edit request</button>
        </div>
      </div>
    </div></form>
  </div>
</section>"""


NOT_FOUND = f"""<section class="notfound">
  <div class="container">
    <h1 class="h-lg">This page <em class="red">isn't here.</em></h1>
    <p class="lede">The link may be old or mistyped. Try the home page or send us your list directly.</p>
    <div class="ctas" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:34px">{btn("Go to home", "./")}{btn("Contact", "contact.html", "btn-soft", "arrow-right")}</div>
  </div>
</section>"""


PAGES = [
    # file, active nav key, <title>, meta description, body
    ("index.html", "home", "Zidane Wholesale Solutions | B2B Food Supply and Ration Bags in Pakistan",
     "Bulk rice, atta, oil, pulses and ration bags for hotels, factories, schools, hospitals and NGOs across Pakistan. Request a quote from Zidane Wholesale Solutions.", HOME),
    ("products.html", "products", "Products | Zidane Wholesale Solutions",
     "Rice, flour and atta, sugar, pulses, cooking oil and ghee, spices, tea and dairy supplied in bulk by Zidane Wholesale Solutions.", PRODUCTS),
    ("ration.html", "ration", "Ration Bags and Ramadan Packages | Zidane Wholesale Solutions",
     "Ration packs from PKR 2,149 for corporate welfare, NGOs and Ramadan distribution. Estimate your total and request a quote.", RATION),
    ("about.html", "about", "About Us | Zidane Wholesale Solutions",
     "Zidane Wholesale Solutions is a Karachi-based B2B food supplier serving businesses and institutions across Pakistan.", ABOUT),
    ("contact.html", "contact", "Request a Quote | Zidane Wholesale Solutions",
     "Send your food supply list and get an itemised quote from Zidane Wholesale Solutions by WhatsApp or email.", CONTACT),
    ("404.html", None, "Page not found | Zidane Wholesale Solutions", "This page could not be found.", NOT_FOUND),
]

JSON_LD = json.dumps({
    "@context": "https://schema.org",
    "@type": "WholesaleStore",
    "name": "Zidane Wholesale Solutions",
    "url": SITE_URL + "/",
    "telephone": PHONE,
    "email": EMAIL,
    "slogan": TAGLINE,
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
<meta property="og:site_name" content="Zidane Wholesale Solutions">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE_URL}/img/warehouse.jpg">
<meta name="theme-color" content="#d0112b">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="assets/style.css">{ld}"""


def body(active, content):
    return f"""{SPRITE}
{nav(active)}
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
    (ROOT / "preview-home.html").write_text(head_tags(file, "Zidane Wholesale Solutions", desc) + "\n" + body(active, content) + "\n")
    print("built", len(PAGES), "pages")


if __name__ == "__main__":
    build()
