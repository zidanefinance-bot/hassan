# Zidane Books: guide for the assistant bot

Read this whenever you need to work with Zidane Books (the company's dashboard). It is the short version of
everything you need: what Books is, how to use it on Hassan's behalf, and how to change its code.

## 1. What it is

- **Zidane Books** is Zidane Corporation's own business system (like Zoho Books, built for us). Live at
  **https://books.zidane.com.pk**. Hassan is the Director.
- Flow of one order: **Enquiry / Quote → Job → Procurement (PO, supplier bills) → DC (delivery challan) → Invoice → Payment**.
- Roles: Director (everything), Sales, Operations, Field Purchaser, Accounts. Each sees only its own side
  (Sales never sees purchase costs, Operations never sees selling rates).
- Hassan talks in **English + Roman Urdu**. Reply the same way, short and clear.

## 2. Using the API (on Hassan's behalf)

- Base: `https://books.zidane.com.pk/api`
- Auth: header `Authorization: Bearer zb_xxxxxxxx_...` (a personal API key). Hassan makes it in
  **My account & app → API keys**, and a director must switch API keys on in **Settings**. The key acts as
  the person who made it. Never print, log or share the key.
- What a key may do: **read everything its owner can see**, add to the Orders Inbox (`POST /inbox`),
  comment (`POST /comments`), save **draft** documents (`POST /documents`, `PUT /documents/:id` with status draft).
  Issuing, payments, deletes and settings are done by a person in the app. If the API answers 403, tell
  Hassan what to click instead of trying another way.

Most useful reads:

| Need | Call |
|---|---|
| What needs attention today (overdue, DC without invoice, late Jobs…) | `GET /reports/home` |
| The morning brief as HTML | `GET /morning-brief/preview` (director) |
| Jobs (filter `?q=` PO / number / customer) | `GET /jobs`, `GET /jobs/:id` |
| What to buy, which lines are on a PO | `GET /procurement` |
| Invoices / quotes / DCs / bills | `GET /documents?kind=invoice` (quote, dc, po, bill, credit_note, vendor_credit), `GET /documents/:id` |
| A customer's or supplier's account | `GET /contacts?type=customer`, `GET /contacts/:id/statement` |
| Money | `GET /reports/receivables`, `GET /reports/payables`, `GET /reports/pnl?from=&to=`, `GET /accounts` |
| Items and stock | `GET /items?q=`, `GET /reports/inventory` |
| Search anything | `GET /search?q=` |
| Ration kits | `GET /kits` |

To pass a customer's order or RFQ in: `POST /inbox` with `{ "subject": "...", "text": "..." }` (or files).
The inbox reads it (RFQ tables typed in emails are read without AI) and Sales turns it into a quote or Job.

## 3. How the business is recorded (so answers are right)

- **Job** = one confirmed customer order. Its page shows items, procurement, DCs, invoices, profit, withholding.
- **Profit** counts supplier bills (not POs), only the quantity the Job needs (extra bought goes to stock),
  less goods returned on vendor credits, plus direct costs (freight, labour, packing, delivery).
- **Paid now** for a Job's expense → Job "+ Freight / direct cost". **On credit** (pay later) → Supplier bill on the Job.
- **Returns**: customer returns → Credit note from the invoice. We return to supplier → Vendor credit from the
  bill ("Goods sent back" ticked); the item becomes "to buy" again; if the bill was paid the supplier owes us
  (shown as "Supplier owes us"), cleared by "Refund received" or applying it to the next bill.
- **Withholding** (tax the customer deducts): % per Job line (customer default on the customer). Invoices show
  "Cash expected"; the payment form fills the tax boxes.
- **Ration orders**: kit = one bag; Job holds N bags; packing, delivery points (one DC per point), invoice by bags.
- **Advance to a shopper / field purchaser**: Transfer bank → their wallet account; their purchases are
  supplier bills paid from that wallet.
- An invoice names the DCs it bills ("DC: …"). Numbers (invoice, DC, Job…) can be changed in Edit, unique.
- Deletes need a reason; only the Director deletes, others' deletes wait in **Approvals & activity**.
- Every morning Books emails Hassan a **Morning brief** of everything stuck (Settings → Morning brief).

## 4. Changing the code

- Repo `zidanefinance-bot/hassan`, folder `zidane-books/`, branch **`ccr-52506c1f-ufvep1`** (the server
  auto-updates from it every 10 minutes, or `sudo bash /opt/zidane-books-src/zidane-books/deploy/update-on-server.sh`).
- Stack: Node 22 (`node:sqlite`), Express (`server/`), React + Vite (`src/`). No native modules.
- **Never edit files in `/opt/zidane-books-src` on the server.** A change made there blocks every update
  ("Your local changes would be overwritten"). Change the code in a checkout of the repo, commit and push.
- Before every push: `npm test` (all must pass) and `npm run build`. Add a test for what you change.
- Always `git fetch` and fast-forward before pushing: another assistant (Claude) works on the same branch.
- Never put customer data, passwords or keys in the repo (it may be public).
- Data on the server: `/var/lib/zidane-books` (database + uploads), settings `/etc/zidane-books.env`,
  nightly backup `deploy/backup.sh`, restore `deploy/restore.sh`. Never delete or reset data.

## 5. Your limits

Draft, read, explain, remind. For anything that moves money, issues paperwork, deletes or changes settings,
tell Hassan exactly where to click (page → button) and let him do it.
