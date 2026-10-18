// SQLite storage (Node's built-in node:sqlite, no native deps). One file: data/zidane-books.db
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDb(file = process.env.DB_FILE || "data/zidane-books.db") {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  const hasTables = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  // schema 4 is the first one with real data in it; later versions only add tables, so SCHEMA upgrades it in place
  if (hasTables && version < 4) {
    throw new Error(`${file} was made by an older version (schema ${version}, need ${SCHEMA_VERSION}). It only holds test data: delete it and start again.`);
  }
  if (hasTables && version > SCHEMA_VERSION) throw new Error(`${file} was made by a newer version of Zidane Books (schema ${version}). Update the app first.`);
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(k, JSON.stringify(v));
  }
  return db;
}

// run fn inside a transaction; rolls back on throw
export function tx(db, fn) {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export const DEFAULT_SETTINGS = {
  company: {
    name: "Zidane Wholesale Solutions",
    address: "B-55, Sector 31-D, PNT Society, Korangi, Karachi",
    phone: "021 111 ZIDANE (943263)",
    email: "sales@zidane.com.pk",
    website: "zidane.com.pk",
    ntn: "",
    strn: "",
  },
  currency: "PKR",
  taxes: [{ name: "GST", rate: 18 }, { name: "Reduced GST", rate: 10 }, { name: "Exempt", rate: 0 }],
  prefixes: { quote: "QT-", invoice: "INV-", po: "PO-", bill: "BILL-", dc: "DC-", job: "JOB-", receipt: "RCPT-", payment: "PMT-", credit_note: "CN-", vendor_credit: "VC-", refund: "RF-" },
  nextNumbers: { quote: 1, invoice: 1, po: 1, bill: 1, dc: 1, job: 1, receipt: 1, payment: 1, credit_note: 1, vendor_credit: 1, refund: 1 },
  paymentTermsDays: 15,
  jobExpenseCategories: ["Freight", "Loading / Unloading", "Packing", "Labour", "Vehicle", "Market expense", "Other direct cost"],
  expenseCategories: ["Rent", "Salaries", "Fuel & Transport", "Utilities", "Packaging", "Loading & Labour", "Office", "Marketing", "Bank Charges", "Other"],
  invoiceFooter: "Thank you for your business. Groceries for business.",
  salesTargetMonthly: 0,
  expenseBudgets: {},
  lowMarginPct: 8,
  dcSignDays: 3,
  apiKeysEnabled: false,
};

export const SCHEMA_VERSION = 5;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('director','sales','operations','purchaser','accounts')),
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('customer','supplier')), name TEXT NOT NULL,
  company TEXT, phone TEXT, email TEXT, address TEXT, ntn TEXT, opening_balance REAL NOT NULL DEFAULT 0,
  payment_terms_days INTEGER, credit_limit REAL,
  notes TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, sku TEXT, unit TEXT NOT NULL DEFAULT 'pcs', category TEXT,
  purchase_rate REAL NOT NULL DEFAULT 0, sale_rate REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0, reorder_level REAL NOT NULL DEFAULT 0, track_stock INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY, number TEXT NOT NULL UNIQUE, customer_id INTEGER NOT NULL REFERENCES contacts(id),
  quote_id INTEGER, customer_po_number TEXT, customer_po_date TEXT, order_source TEXT NOT NULL DEFAULT 'call',
  required_date TEXT, delivery_location TEXT, priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  fulfilment_type TEXT NOT NULL DEFAULT 'stock' CHECK (fulfilment_type IN ('stock','direct')), instructions TEXT,
  ops_status TEXT NOT NULL DEFAULT 'new', closed INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS job_items (
  id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, item_id INTEGER REFERENCES items(id),
  description TEXT, qty REAL NOT NULL, sale_rate REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0,
  procurement_status TEXT NOT NULL DEFAULT 'to_buy' CHECK (procurement_status IN ('to_buy','partial','bought','not_available','from_stock'))
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('quote','invoice','po','bill','dc','credit_note','vendor_credit')), number TEXT NOT NULL,
  contact_id INTEGER NOT NULL REFERENCES contacts(id), date TEXT NOT NULL, due_date TEXT,
  status TEXT NOT NULL, notes TEXT, terms TEXT, reference TEXT,
  subtotal REAL NOT NULL DEFAULT 0, discount_total REAL NOT NULL DEFAULT 0, tax_total REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
  doc_discount REAL NOT NULL DEFAULT 0, charges REAL NOT NULL DEFAULT 0, charges_label TEXT, adjustment REAL NOT NULL DEFAULT 0,
  return_stock INTEGER NOT NULL DEFAULT 1,
  source_id INTEGER REFERENCES documents(id), job_id INTEGER REFERENCES jobs(id),
  submitted_date TEXT, verified_by INTEGER REFERENCES users(id), verified_at TEXT,
  signed_at TEXT, signed_by_name TEXT, created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (kind, number)
);
CREATE TABLE IF NOT EXISTS document_lines (
  id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id), description TEXT, qty REAL NOT NULL, rate REAL NOT NULL,
  discount_pct REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0, cost_rate REAL NOT NULL DEFAULT 0, amount REAL NOT NULL
);
-- A payment (customer receipt or supplier payment) can be split across several invoices/bills through allocations.
-- Whatever isn't allocated is the contact's advance / unused credit, applied to documents later.
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, number TEXT NOT NULL UNIQUE, direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  date TEXT NOT NULL, amount REAL NOT NULL CHECK (amount > 0), mode TEXT NOT NULL DEFAULT 'cash', reference TEXT, notes TEXT,
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Money applied to an invoice/bill comes from a payment or from a credit note / vendor credit (credit_id).
CREATE TABLE IF NOT EXISTS payment_allocations (
  id INTEGER PRIMARY KEY, payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
  credit_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, amount REAL NOT NULL CHECK (amount > 0),
  date TEXT NOT NULL, created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((payment_id IS NULL) != (credit_id IS NULL))
);
-- Money given back: an unused advance (payment) or an unused credit note / vendor credit
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY, number TEXT NOT NULL UNIQUE, contact_id INTEGER NOT NULL REFERENCES contacts(id),
  payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE, credit_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  date TEXT NOT NULL, amount REAL NOT NULL CHECK (amount > 0), mode TEXT NOT NULL DEFAULT 'bank', reference TEXT, notes TEXT,
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((payment_id IS NULL) != (credit_id IS NULL))
);
-- Evidence files (signed DC, customer PO, supplier bill photo, payment proof) attached to any record
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY, entity TEXT NOT NULL CHECK (entity IN ('document','job','payment','expense','contact')), entity_id INTEGER NOT NULL,
  filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, path TEXT NOT NULL, label TEXT,
  uploaded_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL CHECK (amount > 0),
  paid_through TEXT NOT NULL DEFAULT 'cash', contact_id INTEGER REFERENCES contacts(id), job_id INTEGER REFERENCES jobs(id), reference TEXT, notes TEXT,
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id), qty REAL NOT NULL, reason TEXT NOT NULL,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE, date TEXT NOT NULL DEFAULT (date('now'))
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL,
  entity_id INTEGER, summary TEXT, at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- v5: a conversation on any record (ask a question, @mention someone) and each user's notification inbox
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY, entity TEXT NOT NULL CHECK (entity IN ('document','job','payment','expense','contact','item')), entity_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT, link TEXT, actor_id INTEGER REFERENCES users(id),
  read_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- v5: orders inbox. Emails (or a pasted message / uploaded photo) that AI reads into a draft quote, Job or supplier bill
CREATE TABLE IF NOT EXISTS inbox_messages (
  id INTEGER PRIMARY KEY, source TEXT NOT NULL CHECK (source IN ('email','upload','paste','telegram','api')), message_id TEXT UNIQUE,
  from_addr TEXT, subject TEXT, body_text TEXT, received_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reading','ready','done','ignored','error')),
  doc_type TEXT, extraction TEXT, error TEXT, result_kind TEXT, result_id INTEGER,
  created_by INTEGER REFERENCES users(id), handled_by INTEGER REFERENCES users(id), handled_at TEXT
);
CREATE TABLE IF NOT EXISTS inbox_files (
  id INTEGER PRIMARY KEY, inbox_id INTEGER NOT NULL REFERENCES inbox_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, path TEXT NOT NULL
);
-- v5: emails sent to customers/suppliers from the app
CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY, to_addr TEXT NOT NULL, subject TEXT NOT NULL, document_ids TEXT, status TEXT NOT NULL, error TEXT,
  sent_by INTEGER REFERENCES users(id), sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- v5: a user's Telegram chat for alerts, and personal API keys (for an assistant bot such as OpenClaw; off until a director enables it)
CREATE TABLE IF NOT EXISTS user_telegram (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, chat_id TEXT, link_code TEXT UNIQUE, linked_at TEXT
);
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL,
  prefix TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_used_at TEXT, revoked_at TEXT
);
-- v5: devices that get push alerts from the installed app
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_ok_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_messages(status, received_at);
CREATE INDEX IF NOT EXISTS idx_comments ON comments(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_docs_kind ON documents(kind, date);
CREATE INDEX IF NOT EXISTS idx_lines_doc ON document_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_alloc_doc ON payment_allocations(document_id);
CREATE INDEX IF NOT EXISTS idx_alloc_pay ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_alloc_credit ON payment_allocations(credit_id);
CREATE INDEX IF NOT EXISTS idx_attach ON attachments(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_pay_contact ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_docs_job ON documents(job_id);
CREATE INDEX IF NOT EXISTS idx_job_items ON job_items(job_id);
`;
