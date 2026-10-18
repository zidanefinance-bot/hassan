# Zidane Books ko online kaise daalein (Railway)

Railway par app 24 ghante chalta rahega, aur team kahin se bhi phone ya laptop par login kar sakegi.
Kharcha takreeban **$5 mahina** hai (Railway Hobby plan). Railway ki website par current price zaroor check kar lein.

## Ek dafa ka setup (15–20 minute)

1. **Account banayein:** <https://railway.com> par jaayein → **Login** → **Login with GitHub**. Wahi GitHub account use karein jahan `zidanefinance-bot/hassan` hai.
2. **Plan:** Hobby plan lein aur card add karein.
3. **Project banayein:** **New Project** → **Deploy from GitHub repo** → `zidanefinance-bot/hassan` chunein. Agar repo list mein na dikhe toh **Configure GitHub App** se Railway ko us repo ki ijazat dein.
4. **Service settings** (service par click karein → **Settings**):
   - **Source → Branch:** `ccr-52506c1f-ufvep1`. Agar yeh kaam `main` mein merge ho chuka ho toh `main` chunein.
   - **Source → Root Directory:** `zidane-books`
   - Railway khud `Dockerfile` aur `railway.json` utha lega.
5. **Data ke liye disk (zaroori!):** project canvas par service par right-click karein (ya **+ New**) → **Volume** → service se jodein → mount path: **`/data`**.
   Is ke bagair har update par saara data mit jaayega.
6. **Variables** (service → **Variables**) mein yeh daalein:

   | Name | Value |
   |---|---|
   | `ADMIN_EMAIL` | aapki email, jaise `hassan@zidane.com.pk` |
   | `ADMIN_PASSWORD` | ek mazboot password (kam az kam 8 characters) |

   Baaki sab (`PORT`, `DB_FILE`, `UPLOAD_DIR`) Dockerfile mein pehle se set hain.
7. **Link banayein:** service → **Settings → Networking → Generate Domain**. Aapko `https://kuch-naam.up.railway.app` jaisa link milega.
   Apna domain lagana ho (jaise `books.zidane.com.pk`) toh wahin **Custom Domain** add karein. Railway jo CNAME record bataye, woh apne domain ke DNS mein daal dein.
8. **Deploy:** Railway khud build karega (2–4 minute). **Deployments** tab mein "Success" aaye toh link kholein aur
   `ADMIN_EMAIL` / `ADMIN_PASSWORD` se login karein.

## Pehle din ka kaam
1. **Settings → Company:** NTN, STRN aur address check karein.
2. **Settings → Team → + Add user:** Sales, Operations, Purchaser aur Accounts walon ke logins banayein.
3. **Items → Import CSV:** Zoho Books se items export karke yahan daal dein.
4. Customers aur suppliers add karein, saath mein unka **opening balance** (purana baqi), **payment terms** aur **credit limit**.
5. **Settings → Backup → Download backup:** har hafte kam az kam ek dafa download karke Google Drive par rakh dein.

## Update kaise hoga
Jab bhi is branch par naya code push hoga, Railway khud dobara deploy kar dega. Data `/data` volume mein safe rehta hai.

## Agar kuch na chale
- **Deployments → View logs** mein error dikhega.
- `https://aapka-link/api/health` kholein. `{"ok":true}` aana chahiye.
- Login na ho raha ho toh `ADMIN_EMAIL` aur `ADMIN_PASSWORD` check karein. Yeh sirf pehli dafa, jab database khaali ho, director banate hain.
  Baad mein password **Settings → Change my password** se badlein.
- Logs mein "made by an older version" aaye toh volume mein purani test file hai. Volume ki file delete karein ya naya volume lagayein. Yeh sirf testing ke dauran ho sakta hai, asli data aane ke baad nahi.

## Note
Database abhi SQLite hai: ek file, jo `/data` mein rehti hai. Ek company aur 2–10 users ke liye yeh kaafi hai. Blueprint ke
mutabiq baad mein PostgreSQL par shift kar sakte hain.
