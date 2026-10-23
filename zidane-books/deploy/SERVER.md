# Zidane Books ko apne server (zidane.com.pk wala VPS) par lagana

zidane.com.pk ek Ubuntu server par nginx ke saath chal rahi hai (IP `187.52.116.144`). Zidane Books usi server par
**books.zidane.com.pk** par chalegi. Website ko koi farq nahi padega: app alag port par chalti hai aur nginx mein
uski alag file banti hai.

Yeh kaam woh banda kare jiske paas server ka login (SSH) hai: aap khud, aapka developer, ya hosting company.
Kul waqt: takreeban 20 minute.

## Qadam 1: Subdomain banayein (DNS)
Domain jahan register hai (PKNIC, ya jis company se domain liya), wahan DNS settings mein ek record add karein:

| Type | Name / Host | Value |
|---|---|---|
| A | `books` | `187.52.116.144` |

5–30 minute mein `books.zidane.com.pk` server par pahunchne lagega.

> Note: abhi sirf `www.zidane.com.pk` chal raha hai. Bina www ke `zidane.com.pk` ka DNS record nahi mila. Chahein toh
> usi waqt `@` ka A record bhi `187.52.116.144` par laga dein, taake bina www wala address bhi khule.

## Qadam 2: GitHub token banayein (code download karne ki ijazat)
Code private repo mein hai, isliye server ko ek **read-only token** chahiye:
1. GitHub par login → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Repository access:** Only select repositories → `zidanefinance-bot/hassan`
3. **Permissions → Contents:** Read-only
4. Generate karke token copy karein (`github_pat_...` se shuru hota hai)

## Qadam 3: Server par ek command chalayein
Server mein SSH se login karein. Phone se bhi ho jaata hai, jaise **Termius** app se. Phir yeh chalayein. Apni email aur token daal dein:

```bash
curl -fsSL -H "Authorization: Bearer GITHUB_TOKEN_YAHAN" \
  https://raw.githubusercontent.com/zidanefinance-bot/hassan/ccr-52506c1f-ufvep1/zidane-books/deploy/install-on-server.sh -o install-zb.sh

sudo DOMAIN=books.zidane.com.pk ADMIN_EMAIL=aapki@email.com GITHUB_TOKEN=GITHUB_TOKEN_YAHAN bash install-zb.sh
```

Script password poochegi. Yeh Director ka password hoga, kam az kam 8 characters. Phir yeh sab khud ho jaayega:
- Node.js 22 (agar pehle se na ho)
- Code download aur build
- App ko **service** bana dena, taake server restart par bhi khud chal jaaye
- nginx mein `books.zidane.com.pk` ki nayi file
- **HTTPS (SSL) certificate** (free, Let's Encrypt)
- **Roz raat 2:30 baje backup** (database + attachments), 30 din tak rakhe jaate hain (`/var/lib/zidane-books/backups`). Google Drive par encrypted copy ke liye: **[BACKUP.md](BACKUP.md)**

Aakhir mein likha aayega: `Done. Open https://books.zidane.com.pk`

## Qadam 4: Login aur shuru
1. `https://books.zidane.com.pk` kholein aur apni email aur password se login karein
2. **Settings → Company:** NTN, STRN aur address
3. **Settings → Team:** Sales, Operations, Purchaser aur Accounts walon ke logins
4. **Items → Import CSV:** Zoho se items
5. Customers aur suppliers, saath mein opening balance, payment terms aur credit limit

## Auto-update (ek dafa ka setup, phir sab khud)
Server har 10 minute mein GitHub check karta hai. Naya version aaye to khud backup leta hai, update karta hai aur
restart karta hai. Naya version sahi na chale to purana version aur data khud wapas laga deta hai.
```bash
sudo GITHUB_TOKEN=github_pat_... bash deploy/enable-auto-update.sh
```
Token: GitHub → Settings → Developer settings → Fine-grained tokens → sirf `zidanefinance-bot/hassan` → **Contents: Read-only**.
Log dekhna: `sudo journalctl -u zidane-books-update -n 50` · Abhi update: `sudo systemctl start zidane-books-update`

## Naya update kaise lagega (bina auto-update ke)
Jab main naya kaam push karun, server par bas yeh chalayein:
```bash
sudo bash /opt/zidane-books-src/zidane-books/deploy/update-on-server.sh
```
Yeh pehle backup leta hai, phir naya code laga kar app restart kar deta hai. Data safe rehta hai.

## Kuch na chale toh
| Masla | Kya karein |
|---|---|
| App ka haal dekhna | `sudo systemctl status zidane-books` |
| Error dekhna | `sudo journalctl -u zidane-books -n 100` |
| Site nahi khulti | DNS check karein (Qadam 1), phir `sudo nginx -t` |
| SSL nahi laga | DNS lagne ke baad: `sudo certbot --nginx -d books.zidane.com.pk` |
| Port 3200 busy hai | Install dobara `PORT=3300` ke saath chalayein |

## Kahan kya hai
- Code: `/opt/zidane-books-src`
- Data (database aur uploads): `/var/lib/zidane-books`. **Yahi sab se qeemti folder hai.**
- Settings aur password: `/etc/zidane-books.env` (sirf root parh sakta hai)
- nginx file: `/etc/nginx/sites-available/zidane-books`
