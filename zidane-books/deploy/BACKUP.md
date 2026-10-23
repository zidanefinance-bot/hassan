# Backup aur restore

Books ka saara data do jagah hota hai: **database** (`/var/lib/zidane-books/zidane-books.db`) aur **attachments**
(`/var/lib/zidane-books/uploads`: signed DC, bill ki photos, payment proof). Roz raat 2:30 baje `deploy/backup.sh`
dono ko ek file mein pack karta hai:

```
/var/lib/zidane-books/backups/zidane-books-2026-10-23.tar.gz     (14 din tak rakhi jaati hain; disk mein 5 GB se kam jagah bache to purani pehle hat jaati hain, kam az kam 3 rehti hain)
```

Settings → Backup mein director ko dikhta hai ke aakhri backup kab hua, aur off-site gaya ya nahi.

## Off-site copy (zaroori)

Server par pada backup server ke saath hi chala jata hai (server kharab, hack ya hosting band). Isliye roz ki copy
**encrypted** ho kar Google Drive (ya Dropbox / doosre server) par bhi jaani chahiye. Ek dafa setup:

### 1. rclone install karein
```bash
sudo -v ; curl https://rclone.org/install.sh | sudo bash
```
(sirf ek program add hota hai; website ya doosri apps ko kuch nahi hota)

### 2. Google Drive jodein
Server par:
```bash
sudo rclone config
```
- `n` (new remote) → name: **gdrive**
- Storage: **drive** (Google Drive)
- client_id / client_secret: khali chhor dein (Enter)
- scope: **2** (`drive.file`: rclone sirf apni banayi files dekh sakta hai, aap ki baaqi Drive nahi)
- baaqi sawal: Enter, aur "Use auto config?" par **n**
- Woh ek command dega `rclone authorize "drive" "..."`. Isay apne **computer** par chalayein (wahan bhi rclone
  install karein: rclone.org/downloads), browser mein company ki Google account se allow karein, jo code mile woh
  server par paste karein → `y` → `q`

### 3. Settings file mein do lines
```bash
sudo nano /etc/zidane-books.env
```
```
BACKUP_REMOTE=gdrive:Zidane-Books-Backups
BACKUP_PASSPHRASE=koi lamba jumla jo sirf aap ko pata ho 2026
```
> ⚠️ **Passphrase ko kaghaz par likh kar mehfooz jagah rakhein, aur password manager mein bhi.** Off-site backup isi se
> khulta hai. Passphrase gum hua to Google Drive wali copies bekaar hain. Server ke saath gum na ho, isliye sirf server
> par na rakhein.

Optional: `BACKUP_KEEP_DAYS=90` (Drive par kitne din ki copies rahein, default 90).

### 4. Abhi chala kar check karein
```bash
sudo bash /opt/zidane-books-src/zidane-books/deploy/backup.sh
```
Aakhir mein `Backup done (done off-site).` aana chahiye, aur Google Drive mein **Zidane-Books-Backups** folder mein
`zidane-books-YYYY-MM-DD.tar.gz.gpg` file. Settings → Backup mein hara ✓ "copied off-site".

## Restore

**Har mahine ek drill karein** (kuch nahi badalta, sirf check karta hai ke backup sahi khulta hai):
```bash
sudo bash /opt/zidane-books-src/zidane-books/deploy/restore.sh --test zidane-books-2026-10-23.tar.gz.gpg
```
Woh documents, Jobs, payments ki ginti aur aakhri entry ki date dikhata hai, aur `Test passed` likhta hai.

**Asli restore** (data ghalti se mit gaya, ya naye server par le jaana ho):
```bash
sudo bash /opt/zidane-books-src/zidane-books/deploy/restore.sh --apply zidane-books-2026-10-23.tar.gz
```
- File ka naam server wali backup ka ho sakta hai, ya `.gpg` wali (to Google Drive se khud download hoti hai).
- `RESTORE` likh kar confirm karna hota hai.
- Restore se pehle aaj ka data `backups/before-restore-<time>` mein rakh diya jata hai, taake restore bhi wapas ho sake.

**Naya server:** pehle `install-on-server.sh` se Books install karein, rclone + `/etc/zidane-books.env` wali do lines
dobara lagayein, phir `restore.sh --apply <Drive wali .gpg file>`.
