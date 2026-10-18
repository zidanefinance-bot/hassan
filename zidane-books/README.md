# Zidane Books

The first piece of **Zidane Business OS**: a web app where Sales, Operations, Accounts and Directors each work their part of
every order, following the Master Blueprint. Currency is PKR and GST rates can be configured.

## How the business flows (Phase 1 of the Business OS blueprint)

```
Enquiry → Quote → Customer confirmation / PO → INTERNAL JOB → Procurement → Supplier bill + freight → Material ready
  (Sales)   (Sales)          (Sales)            (Sales creates)  (Operations)       (Operations)          (Operations)
→ Customer DC → Signed DC → Customer invoice → Submitted → Verified → Payment received
   (Sales)       (Sales)        (Sales)         (Sales)    (Accounts)     (Accounts)
```

The **Job** is the bridge between the two sides. Sales never touches supplier bills, Operations never touches the
customer PO, DC or invoice, and Accounts verifies and posts money without re-entering anything.

## Who sees what

| | Sales | Operations | Field Purchaser | Accounts | Director |
|---|---|---|---|---|---|
| Customers, enquiries, quotes | ✏️ | — | — | 👁 | ✏️ |
| Create Job | ✏️ | receives it | receives it | 👁 | ✏️ |
| Selling rates | ✏️ | hidden | hidden | 👁 | ✏️ |
| Procurement, purchase status | status only | ✏️ | ✏️ | 👁 | ✏️ |
| Suppliers, POs, supplier bills, freight | hidden | ✏️ | ✏️ (bills, costs) | 👁 + verify | ✏️ |
| Purchase costs | hidden | 👁 | 👁 | 👁 | 👁 |
| Customer DC, signed DC, invoice | ✏️ | hidden | hidden | 👁 + verify | ✏️ |
| Receive payment / pay supplier | — | — | — | ✏️ | ✏️ |
| Company expenses, financial reports | — | — | — | ✏️ | ✏️ |
| Job profit, margins | hidden | hidden | hidden | 👁 | 👁 |
| Users and settings | — | — | — | — | ✏️ |

Each role's **Home** shows its own action queues, for example: "Material ready, DC needed" for Sales, "Items to buy"
for Operations, "Supplier bills to verify" for Accounts. A Director sees all of them. These rules are enforced in the
API (`server/auth.js` caps, `server/app.js`), and the tests check them over HTTP.

## Also included

- **Items, like Zoho:** anyone writing a document can add a new item on the spot. Each item page shows every transaction it appears in (quotes, DCs, invoices, POs, bills), buying rates by supplier (last, 30/90-day average, cheapest), selling rates by customer, stock history, and a change log with before → after values. Line editors show the last rate charged to that customer or paid to that supplier. Items import from CSV (a Zoho Books export works) and export to CSV. Every view is filtered by role.
- **Payments like Zoho:** one receipt or supplier payment can be split across several invoices or bills. Whatever isn't applied stays as the contact's **advance / unused credit**. Use "Apply credits" on any invoice or bill, or "Apply to invoices" on the payment, to adjust it later, and "Unapply" to undo. Overpaying an invoice keeps the extra as an advance. Accounts' home lists advances that are waiting to be applied.
- **Ledger / statement of account** for every customer and supplier. It has an opening balance for any date range, invoices or bills against payments, a running balance, and print.
- **Credit notes and vendor credits:** for goods returned or a discount after the invoice/bill. Ticking "goods came back" puts the stock back (a vendor credit takes it out). Apply them to invoices/bills or refund them. Invoices and bills have a **Credit note** / **Vendor credit** button that starts one from their lines.
- **Refunds:** give back an unused advance or credit note. They show on the ledger.
- **Attachments:** photos or PDFs (signed DC, customer PO, supplier bill photo, payment proof) on any document, Job or payment, 10 MB max.
- **Copy** any document as a new draft. Invoices and bills take a flat discount, delivery/other charges and a round-off.
- **Customer and supplier terms:** payment terms set due dates. A credit limit means an invoice that goes over it needs a director to issue. Opening balances show in outstanding and on the ledger.
- **Backup:** Settings → Download backup gives a consistent copy of the whole database (director only).
- **Stock:** bills bring stock in. On Jobs the DC takes it out, and the invoice doesn't take it out again. Direct-delivery Jobs never touch the warehouse. Manual adjustments and stock history are kept.
- **Master procurement list:** the same item is totalled across all active Jobs, e.g. 500 + 250 = 750, with a per-Job breakdown.
- **Reports:** P&L, Job profit, receivables and payables ageing, inventory, sales by customer and by item, sales tax. CSV export and print.
- **Documents:** printable quote, DC (with signature lines, no prices), invoice, PO and bill, plus WhatsApp share.
- **Records:** verified invoices and bills, and signed DCs, can only be changed by a director. Changing a verified document clears its verification. There is an activity log.

Not yet (later phases): ration-bag kits, double-entry ledger with chart of accounts, banks and reconciliation, WHT,
cheques, credit notes, approvals for low margin, purchaser wallet, investors/loans, AI command box, WhatsApp/Telegram.

## Put it online

Two ways, both with step-by-step guides in Roman Urdu: **[deploy/SERVER.md](deploy/SERVER.md)** puts it on your own Ubuntu server next to the website (systemd + nginx + Let's Encrypt + daily backups, via `deploy/install-on-server.sh`). **[DEPLOY.md](DEPLOY.md)** puts it on Railway (Dockerfile, `/data` volume).

## Run it

Needs Node 22.13+ (uses the built-in `node:sqlite`, so there are no native modules).

```bash
npm install
npm run seed            # optional: director + one demo login per role + 3 Jobs at different stages (sample data)
npm run dev             # API on :3001, app on http://localhost:5173
```

Production: `npm run build && npm start` serves the app and the API on `PORT` (default 3001). Data lives in
`data/zidane-books.db` (set `DB_FILE` to change it). Back this file up. The first start creates an admin and prints
the password; set `ADMIN_EMAIL` / `ADMIN_PASSWORD` to choose them. Demo logins are `sales@`, `operations@`,
`purchaser@` and `accounts@zidane.com.pk` with password `demo1234` (or `DEMO_PASSWORD`).

Tests: `npm test` covers totals, stock rules, the Job → DC → invoice flow, direct delivery, procurement grouping,
payments and statuses, P&L, and every role boundary over HTTP.

The database is SQLite for now. The blueprint calls for PostgreSQL in production.
