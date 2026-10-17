# Zidane Books

A Zoho Books-style web app for Zidane Wholesale Solutions: sales, purchases, stock, expenses and reports, used by a team
with separate roles. Currency is PKR and GST rates can be configured.

## What's in v0.1

| Area | Features |
|---|---|
| Sales | Customers, quotes (sent/accepted/declined → convert to invoice), invoices (draft → issued → partial/paid/overdue), payments received |
| Purchases | Suppliers, purchase orders (→ convert to bill), bills, payments made |
| Inventory | Items with buy/sell rate, margin, tax, reorder level. Stock moves automatically: issued bills add stock and update cost, issued invoices remove it, void reverses it. Manual adjustments and stock history |
| Expenses | Categories (editable), paid through cash/bank/cheque, monthly view by category |
| Reports | Profit & Loss (sales − COGS at cost-when-sold − expenses), receivables and payables ageing, inventory valuation, sales by customer and by item, sales tax summary, CSV export, print |
| Documents | Printable invoice/quote/PO/bill layout with your logo (Print → Save as PDF), WhatsApp share with the summary pre-filled |
| Team | Logins with roles: **admin** (everything), **accountant** (all except users/settings), **sales** (customers, quotes, invoices, receipts). Enforced on the server, not just hidden in the UI. Activity log on the dashboard |
| Settings | Company details on documents, NTN/STRN, tax rates, number prefixes, payment terms |

It is document-based. It is not yet a full double-entry ledger (no chart of accounts, journals or bank reconciliation yet).

## Run it

Needs Node 22.13+ (uses the built-in `node:sqlite`, so there are no native modules).

```bash
npm install
npm run seed            # optional: creates admin + demo data (sample names and rates)
npm run dev             # API on :3001, app on http://localhost:5173
```

Production: `npm run build && npm start` serves the app and the API on `PORT` (default 3001). Data lives in
`data/zidane-books.db` (set `DB_FILE` to change it). Back this file up. The first start creates an admin and prints
the password; set `ADMIN_EMAIL` / `ADMIN_PASSWORD` to choose them.

Tests: `npm test` covers totals, stock effects, payments/statuses, conversion, P&L, and role enforcement over HTTP.
