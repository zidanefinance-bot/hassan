# Janitorial Supplies Website

Static bilingual (English + اردو) business website. No database, no server — sirf ek HTML file.
Isliye ye kabhi crash nahi hoti aur hosting hamesha free rehti hai.

---

## Kya kya hai site mein

| Section | Kya hai |
|---|---|
| Hero | Business ka main message + "Get a Quote" button |
| Products | 6 categories, har ek mein 5 items |
| Why Us | 4 selling points |
| About | Company intro + "Who We Serve" list |
| Contact | Phone, email, address, hours + WhatsApp button |
| Quote form | Bhar ke submit karo → WhatsApp khud khul jata hai, message tayyar |
| Language toggle | Header mein "اردو" button — poori site switch, RTL support ke saath |

---

## ⚠️ Pehle ye 5 cheezein badlo (abhi placeholder hain)

Sab kuch `index.html` mein hai.

### 1. WhatsApp number
File ke bilkul neeche, `<script>` ke andar:

```js
const WHATSAPP_NUMBER = "923000000000";   // country code + number, no + or spaces
```

Example: agar number `0300 1234567` hai → `"923001234567"` likho.

### 2. Business ka naam
Usi jagah:
```js
const BUSINESS_NAME = "Janitorial Supplies Co.";
```

Aur `Ctrl+H` (find & replace) se `Janitorial Supplies Co.` ko apne naam se badal do — 3 jagah aata hai
(header, footer, copyright). Urdu naam ke liye `جینیٹوریل سپلائیز` search karo.

### 3. Phone number (clickable link)
`+92 300 0000000` search karo — 2 jagah hai. Dono badlo.
Saath hi `tel:+920000000000` bhi 2 jagah hai.

### 4. Email
`info@example.com` search karo — 2 jagah.

### 5. Address aur hours
`Your shop address, City` aur `Mon – Sat, 9:00 AM – 7:00 PM` search karke badal do.

---

## Products add / remove karna

Har category aisi dikhti hai:

```html
<div class="cat">
  <div class="cat-ico">🧪</div>
  <h3><span class="lang-en">Cleaning Chemicals</span><span class="lang-ur">صفائی کے کیمیکلز</span></h3>
  <ul>
    <li><span class="lang-en">Floor cleaner</span><span class="lang-ur">فلور کلینر</span></li>
  </ul>
</div>
```

- **Item add karna:** ek `<li>...</li>` line copy karke neeche paste karo, text badal do
- **Item hatana:** poori `<li>` line delete kar do
- **Nayi category:** poora `<div class="cat">...</div>` block copy karo

Har cheez ke do version hain — `lang-en` (English) aur `lang-ur` (Urdu). **Dono badalna zaroori hai**,
warna language toggle par khali dikhega.

---

## Hosting — Cloudflare Pages (free, hamesha ke liye)

1. [dash.cloudflare.com](https://dash.cloudflare.com) par account banao (free)
2. Left sidebar → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. GitHub connect karo → ye repo select karo → branch select karo
4. Build settings:
   - **Framework preset:** `None`
   - **Build command:** khali chhod do
   - **Build output directory:** `/`
5. **Save and Deploy**

2 minute mein live ho jayegi: `your-project.pages.dev`

**Aage se:** jab bhi is repo mein commit push hoga, site khud update ho jayegi. Koi manual upload nahi.

### Custom domain (optional, ~PKR 3,000–4,000/saal)
Cloudflare Pages → project → **Custom domains** → **Set up a domain** → apna domain daalo.
SSL certificate Cloudflare khud free mein laga deta hai.

---

## Local par test karna

`index.html` par double-click karo — browser mein khul jayegi. Bas.
Koi install, koi command, kuch nahi chahiye.

---

## Baad mein add kar sakte hain

- Product photos (abhi emoji icons hain)
- Alag product pages har category ke liye
- Price list / downloadable PDF catalog
- Google Maps embed
- Simple admin panel (Decap CMS) — taakay code ko haath lagaye bagair content edit ho sake
