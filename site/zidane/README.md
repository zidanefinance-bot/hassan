# Zidane General Supplies website

Static multi-page site: Home, Products, Ration Program, About, Contact, 404.
No framework, no server. Everything that goes live is in `public/`.

## Edit
- **Page text, products, prices, industries:** `build.py`, then run `python3 build.py`
- **Phone, WhatsApp, email:** `CONFIG` at the top of `public/assets/main.js`, plus `PHONE` / `EMAIL` in `build.py`
- **Domain for SEO (canonical links, sitemap):** `SITE_URL` in `build.py`
- **Styles:** `public/assets/style.css`
- **Photos:** replace files in `public/img/` with the same names (current ones are interim crops from the mockup)

## Preview locally
    cd public && python3 -m http.server 8000   # open http://localhost:8000

## Deploy (pick one, all free for a site this size)
- **Netlify:** app.netlify.com > Add new site > Deploy manually > drag the `public` folder in.
- **Vercel:** import this GitHub repo, set Root Directory to `site/zidane/public`, framework "Other", no build command.
- **Cloudflare Pages:** connect the repo, build output directory `site/zidane/public`, no build command.

Then add your domain (e.g. zidane.com.pk) in the host's Domains settings and point the DNS records it shows you.

## Files
- `build.py` generates every page in `public/` from shared header, footer and SEO tags
- `src_sprite.svg` icons (Phosphor Icons, MIT)
- `preview-home.html` home page variant used for the claude.ai preview link
