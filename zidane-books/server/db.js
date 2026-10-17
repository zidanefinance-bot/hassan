// SQLite storage (Node's built-in node:sqlite, no native deps). One file: data/zidane-books.db
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDb(file = process.env.DB_FILE || "data/zidane-books.db") {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
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
  prefixes: { quote: "QT-", invoice: "INV-", po: "PO-", bill: "BILL-" },
  nextNumbers: { quote: 1, invoice: 1, po: 1, bill: 1 },
  paymentTermsDays: 15,
  expenseCategories: ["Rent", "Salaries", "Fuel & Transport", "Utilities", "Packaging", "Loading & Labour", "Office", "Marketing", "Bank Charges", "Other"],
  invoiceFooter: "Thank you for your business. Groceries for business.",
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','accountant','sales')),
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('customer','supplier')), name TEXT NOT NULL,
  company TEXT, phone TEXT, email TEXT, address TEXT, ntn TEXT, opening_balance REAL NOT NULL DEFAULT 0,
  notes TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, sku TEXT, unit TEXT NOT NULL DEFAULT 'pcs', category TEXT,
  purchase_rate REAL NOT NULL DEFAULT 0, sale_rate REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0, reorder_level REAL NOT NULL DEFAULT 0, track_stock INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('quote','invoice','po','bill')), number TEXT NOT NULL,
  contact_id INTEGER NOT NULL REFERENCES contacts(id), date TEXT NOT NULL, due_date TEXT,
  status TEXT NOT NULL, notes TEXT, terms TEXT, reference TEXT,
  subtotal REAL NOT NULL DEFAULT 0, discount_total REAL NOT NULL DEFAULT 0, tax_total REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
  source_id INTEGER REFERENCES documents(id), created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (kind, number)
);
CREATE TABLE IF NOT EXISTS document_lines (
  id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id), description TEXT, qty REAL NOT NULL, rate REAL NOT NULL,
  discount_pct REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0, cost_rate REAL NOT NULL DEFAULT 0, amount REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  contact_id INTEGER NOT NULL REFERENCES contacts(id), document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  date TEXT NOT NULL, amount REAL NOT NULL CHECK (amount > 0), mode TEXT NOT NULL DEFAULT 'cash', reference TEXT, notes TEXT,
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY, date TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL CHECK (amount > 0),
  paid_through TEXT NOT NULL DEFAULT 'cash', contact_id INTEGER REFERENCES contacts(id), reference TEXT, notes TEXT,
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
CREATE INDEX IF NOT EXISTS idx_docs_kind ON documents(kind, date);
CREATE INDEX IF NOT EXISTS idx_lines_doc ON document_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_pay_doc ON payments(document_id);
`;
