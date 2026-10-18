# AI, email aur Telegram on karna

Yeh sab features app mein mojood hain, lekin jab tak server par keys na daali jayen, band rehte hain:

| Feature | Kya karta hai | Kya chahiye |
|---|---|---|
| **AI reading** | PO/order message aur bill ki photo parh kar draft bana deta hai | Claude API key |
| **Email inbox** | Orders wali email ko har 5 minute check karta hai | Us mailbox ka IMAP login |
| **Email bhejna** | Invoice/DC ka PDF customer ko email karta hai | Usi mailbox ka SMTP login |
| **Telegram** | Alerts phone par aate hain, bill ki photo bot ko bhejo to inbox mein chali jati hai | Telegram bot token |

Saari settings ek hi file mein jaati hain: `/etc/zidane-books.env`. Har badlaav ke baad app restart karna hota hai.

```bash
sudo nano /etc/zidane-books.env        # neeche wali lines add karein, Ctrl+O se save, Ctrl+X se bahar
sudo systemctl restart zidane-books
sudo journalctl -u zidane-books -n 30  # check karein: "Orders inbox: checking email" / "Telegram bot: on"
```

> Yeh file sirf root parh sakta hai. Keys kabhi WhatsApp ya chat mein share na karein. Woh seedha server par hi daalein.

## 1. AI (Claude API key)
1. <https://console.anthropic.com> par account banayein. Billing mein card add karein aur **monthly limit** laga dein, maslan $20.
2. **API Keys → Create Key**, phir key copy karein (`sk-ant-...` se shuru hoti hai).
3. File mein yeh line add karein:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
Kharcha usage ke hisaab se hota hai: har PO ya bill parhne par chand rupay. Console mein **Usage** par roz ka kharcha dikhta hai.

## 2. Email inbox aur email bhejna
Behtar hai ek alag mailbox bana lein, jaise **orders@zidane.com.pk**, aur customers se kahein ke PO wahan bhejein.

**Agar email Google Workspace / Gmail par hai:**
1. Us account mein **2-Step Verification** on karein.
2. <https://myaccount.google.com/apppasswords> par jaa kar ek **App password** banayein (16 letters).
3. File mein:
   ```
   IMAP_HOST=imap.gmail.com
   IMAP_USER=orders@zidane.com.pk
   IMAP_PASSWORD=app-password-yahan
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=orders@zidane.com.pk
   SMTP_PASSWORD=app-password-yahan
   ```

**Agar email hosting (cPanel) par hai:** hosting panel mein **Email Accounts → Connect Devices** par IMAP/SMTP ki details milti hain. Aam taur par:
```
IMAP_HOST=mail.zidane.com.pk
IMAP_USER=orders@zidane.com.pk
IMAP_PASSWORD=mailbox-password
SMTP_HOST=mail.zidane.com.pk
SMTP_PORT=465
SMTP_USER=orders@zidane.com.pk
SMTP_PASSWORD=mailbox-password
```

**Optional settings:**
```
MAIL_FROM=Zidane Wholesale Solutions <orders@zidane.com.pk>   # emails par bhejne wale ka naam
MAIL_POLL_MINUTES=5                                           # kitni der baad check kare
APP_URL=https://books.zidane.com.pk                           # Telegram alerts mein "Open" link ke liye
```
App mailbox ko sirf **parhti** hai. Kuch delete ya move nahi karti. Pichle 3 din ki emails dekhti hai aur har email sirf ek dafa leti hai.

## 3. Telegram bot
1. Telegram mein **@BotFather** kholein, `/newbot` bhejein, naam dein (jaise *Zidane Books*) aur username (jaise `ZidaneBooksBot`).
2. Woh ek token dega (`123456:ABC...`). File mein:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC...
   APP_URL=https://books.zidane.com.pk
   ```
3. Restart ke baad har banda app mein **apne naam par click → My account → Link my Telegram** dabaye aur bot mein **Start** kare.

Bot sirf linked team members ki baat sunta hai. Anjaan logon ko jawab deta hai: "I only work for the Zidane Books team".

## 4. OpenClaw / doosre bots (API keys)
Default mein **band** hai. Jab dena ho:
1. Director: **My account → API keys → "Allow API keys for the team"** tick karein.
2. Jis user ke naam se bot chalega (jaise Sales), woh **+ Create key** dabaye aur key bot ko de.
3. Bot har request mein header bheje: `Authorization: Bearer zb_...`

Key wale bot ke paas wahi ijazat hogi jo us user ke role ki hai. Woh sirf yeh kar sakta hai:
- parhna
- Orders Inbox mein daalna
- comment karna
- **draft** banana

Invoice issue karna, payment, delete aur settings hamesha app mein insaan karega. Har API action activity log mein likha jata hai. Key kabhi bhi **Revoke** ki ja sakti hai.

## Check karna
App mein **Orders Inbox** kholein. Upar peeli patti nazar aaye to woh batati hai ke kya abhi set nahi hua. Sab set ho to patti gayab ho jati hai.
