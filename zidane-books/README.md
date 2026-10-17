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
- **Stock:** bills bring stock in. On Jobs the DC takes it out, and the invoice doesn't take it out again. Direct-delivery Jobs never touch the warehouse. Manual adjustments and stock history are kept.
- **Master procurement list:** the same item is totalled across all active Jobs, e.g. 500 + 250 = 750, with a per-Job breakdown.
- **Reports:** P&L, Job profit, receivables and payables ageing, inventory, sales by customer and by item, sales tax. CSV export and print.
- **Documents:** printable quote, DC (with signature lines, no prices), invoice, PO and bill, plus WhatsApp share.
- **Records:** verified invoices and bills, and signed DCs, can only be changed by a director. Changing a verified document clears its verification. There is an activity log.

Not yet (later phases): ration-bag kits, double-entry ledger with chart of accounts, banks and reconciliation, WHT,
cheques, credit notes, approvals for low margin, purchaser wallet, investors/loans, AI command box, WhatsApp/Telegram.

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
