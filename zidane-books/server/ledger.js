// Double-entry accounts: Chart of Accounts, the general ledger and the statements built from it.
// The ledger is worked out from the records themselves (invoices, bills, credit notes, payments, refunds, expenses,
// opening balances) plus manual journal entries, so it can never drift from them and old data is included as-is.
// Each record gives balanced lines: debits = credits. Only issued ("open") documents count, like the P&L.
import { httpError, round2, today } from "./books.js";
import { tx } from "./db.js";

export const TYPES = ["asset", "liability", "equity", "income", "expense"];
const DEBIT_NORMAL = new Set(["asset", "expense"]);
export const MONEY_KINDS = ["cash", "bank", "wallet"]; // accounts money can be paid into / out of
const OPENING_DATE = "2000-01-01"; // contact opening balances have no date of their own: they sit before everything

// the accounts every business needs; system_key ties the ledger rules to them (names and codes can be changed)
export const DEFAULT_ACCOUNTS = [
  ["1000", "Cash in hand", "asset", "cash", "cash"],
  ["1010", "Bank (not specified)", "asset", "bank", "bank"],
  ["1100", "Accounts receivable (customers)", "asset", "other", "ar"],
  ["1200", "Inventory / stock", "asset", "other", "inventory"],
  ["1300", "Income tax withheld by customers", "asset", "other", "wht_income_rec"],
  ["1310", "Sales tax withheld by customers", "asset", "other", "wht_sales_rec"],
  ["1320", "Sales tax (GST) on purchases", "asset", "other", "gst_input"],
  ["2000", "Accounts payable (suppliers)", "liability", "other", "ap"],
  ["2100", "Sales tax (GST) on sales", "liability", "other", "gst_output"],
  ["2200", "Income tax withheld from suppliers", "liability", "other", "wht_income_pay"],
  ["2210", "Sales tax withheld from suppliers", "liability", "other", "wht_sales_pay"],
  ["2300", "Loans", "liability", "other", null],
  ["3000", "Owner's capital", "equity", "other", "capital"],
  ["3100", "Owner's drawings", "equity", "other", "drawings"],
  ["3900", "Opening balances", "equity", "other", "opening"],
  ["4000", "Sales", "income", "other", "sales"],
  ["4010", "Sales returns", "income", "other", "sales_returns"],
  ["4900", "Other income", "income", "other", "other_income"],
  ["5000", "Cost of goods sold", "expense", "other", "cogs"],
  ["5100", "Freight & charges on supplier bills", "expense", "other", "bill_charges"],
  ["6999", "Other expenses", "expense", "other", "other_exp"],
];

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('cash','bank','wallet','other')),
  system_key TEXT UNIQUE, expense_category TEXT UNIQUE, bank_name TEXT, account_number TEXT,
  opening_balance REAL NOT NULL DEFAULT 0, opening_date TEXT, notes TEXT, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- manual entries: owner's capital, loans, bank-to-bank transfers, depreciation, corrections
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY, number TEXT NOT NULL UNIQUE, date TEXT NOT NULL, memo TEXT, kind TEXT NOT NULL DEFAULT 'journal' CHECK (kind IN ('journal','transfer')),
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id), debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0,
  contact_id INTEGER REFERENCES contacts(id), memo TEXT
);`;

// once per start: default accounts, one expense account per expense category, and "paid through" on old money records
export function setupAccounts(db) {
  db.exec(SCHEMA);
  const add = db.prepare("INSERT OR IGNORE INTO accounts (code, name, type, kind, system_key) VALUES (?, ?, ?, ?, ?)");
  for (const [code, name, type, kind, key] of DEFAULT_ACCOUNTS) {
    if (key && db.prepare("SELECT 1 FROM accounts WHERE system_key = ?").get(key)) continue;
    if (!key && db.prepare("SELECT 1 FROM accounts WHERE name = ?").get(name)) continue;
    add.run(db.prepare("SELECT 1 FROM accounts WHERE code = ?").get(code) ? nextCode(db, type) : code, name, type, kind, key);
  }
  const cats = new Set(["expenseCategories", "jobExpenseCategories"].flatMap((k) => JSON.parse(db.prepare("SELECT value FROM settings WHERE key = ?").get(k)?.value || "[]")));
  for (const { category } of db.prepare("SELECT DISTINCT category FROM expenses").all()) cats.add(category);
  for (const c of cats) expenseAccountFor(db, c);
  for (const t of ["payments", "refunds", "expenses"]) {
    if (!db.prepare(`PRAGMA table_info(${t})`).all().some((c) => c.name === "account_id")) db.exec(`ALTER TABLE ${t} ADD COLUMN account_id INTEGER REFERENCES accounts(id)`);
  }
  // records from before accounts existed: cash went to Cash in hand, everything else to the unspecified bank
  const cash = sys(db, "cash"), bank = sys(db, "bank");
  db.prepare("UPDATE payments SET account_id = CASE WHEN mode = 'cash' THEN ? ELSE ? END WHERE account_id IS NULL").run(cash, bank);
  db.prepare("UPDATE refunds SET account_id = CASE WHEN mode = 'cash' THEN ? ELSE ? END WHERE account_id IS NULL").run(cash, bank);
  db.prepare("UPDATE expenses SET account_id = CASE WHEN paid_through = 'cash' THEN ? ELSE ? END WHERE account_id IS NULL").run(cash, bank);
}

export const sys = (db, key) => db.prepare("SELECT id FROM accounts WHERE system_key = ?").get(key)?.id;

export function nextCode(db, type) {
  const base = { asset: 1000, liability: 2000, equity: 3000, income: 4000, expense: 6000 }[type];
  const max = db.prepare("SELECT MAX(CAST(code AS INTEGER)) AS m FROM accounts WHERE CAST(code AS INTEGER) BETWEEN ? AND ?").get(base, base + 989).m; // x999 is kept for "Other …"
  let n = Math.max(max || base, base) + 10;
  while (db.prepare("SELECT 1 FROM accounts WHERE code = ?").get(String(n))) n++;
  return String(n);
}

// every expense category has its own expense account (made the first time the category is used)
export function expenseAccountFor(db, category) {
  const c = String(category || "").trim();
  if (!c) return sys(db, "other_exp");
  const hit = db.prepare("SELECT id FROM accounts WHERE expense_category = ? COLLATE NOCASE").get(c);
  if (hit) return hit.id;
  return Number(db.prepare("INSERT INTO accounts (code, name, type, kind, expense_category) VALUES (?, ?, 'expense', 'other', ?)").run(nextCode(db, "expense"), c, c).lastInsertRowid);
}

// the money account a payment / refund / expense used: the one chosen, else by mode (cash → Cash in hand)
export function moneyAccount(db, accountId, mode) {
  if (accountId) {
    const a = db.prepare("SELECT id, kind, active FROM accounts WHERE id = ?").get(Number(accountId));
    if (!a || !MONEY_KINDS.includes(a.kind)) throw httpError(400, "Choose a cash, bank or wallet account");
    if (!a.active) throw httpError(400, "That account is closed");
    return a.id;
  }
  return sys(db, mode === "cash" ? "cash" : "bank");
}

// ---- the ledger: all lines on or before `to` (and from `from`), each { date, account_id, debit, credit, source, ref, contact_id, memo }
export function ledgerLines(db, { from = "0000-01-01", to = "9999-12-31" } = {}) {
  const A = Object.fromEntries(db.prepare("SELECT system_key, id FROM accounts WHERE system_key IS NOT NULL").all().map((r) => [r.system_key, r.id]));
  const out = [];
  const push = (base, lines) => {
    for (const [account_id, debit, credit] of lines) {
      const d = round2(debit), c = round2(credit);
      if (Math.abs(d) < 0.005 && Math.abs(c) < 0.005) continue;
      // a negative amount (e.g. a round-off down) goes on the other side
      out.push({ ...base, account_id, debit: d < 0 ? 0 : d + (c < 0 ? -c : 0), credit: c < 0 ? 0 : c + (d < 0 ? -d : 0) });
    }
  };
  const range = "date BETWEEN ? AND ?";
  const cost = db.prepare("SELECT COALESCE(SUM(qty * cost_rate), 0) AS v FROM document_lines WHERE document_id = ?");
  for (const d of db.prepare(`SELECT id, kind, number, date, contact_id, total, tax_total, charges, return_stock FROM documents WHERE status = 'open' AND kind IN ('invoice','credit_note','bill','vendor_credit') AND ${range} ORDER BY date, id`).all(from, to)) {
    const base = { date: d.date, source: d.kind, ref: d.number, source_id: d.id, contact_id: d.contact_id, memo: null };
    const net = d.total - d.tax_total; // after line and invoice-level discounts, charges and round-off; before tax
    if (d.kind === "invoice") {
      const c = cost.get(d.id).v;
      push(base, [[A.ar, d.total, 0], [A.sales, 0, net], [A.gst_output, 0, d.tax_total], [A.cogs, c, 0], [A.inventory, 0, c]]);
    } else if (d.kind === "credit_note") {
      const c = d.return_stock ? cost.get(d.id).v : 0; // goods that came back go back into stock at their cost
      push(base, [[A.sales_returns, net, 0], [A.gst_output, d.tax_total, 0], [A.ar, 0, d.total], [A.inventory, c, 0], [A.cogs, 0, c]]);
    } else if (d.kind === "bill") {
      push(base, [[A.inventory, net - d.charges, 0], [A.bill_charges, d.charges, 0], [A.gst_input, d.tax_total, 0], [A.ap, 0, d.total]]);
    } else {
      push(base, [[A.ap, d.total, 0], [A.inventory, 0, net - d.charges], [A.bill_charges, 0, d.charges], [A.gst_input, 0, d.tax_total]]);
    }
  }
  for (const p of db.prepare(`SELECT * FROM payments WHERE ${range} ORDER BY date, id`).all(from, to)) {
    const base = { date: p.date, source: "payment", ref: p.number, source_id: p.id, contact_id: p.contact_id, memo: p.reference };
    const settled = p.amount + p.wht_income + p.wht_sales;
    p.account_id ||= A.bank;
    if (p.direction === "in") push(base, [[p.account_id, p.amount, 0], [A.wht_income_rec, p.wht_income, 0], [A.wht_sales_rec, p.wht_sales, 0], [A.ar, 0, settled]]);
    else push(base, [[A.ap, settled, 0], [p.account_id, 0, p.amount], [A.wht_income_pay, 0, p.wht_income], [A.wht_sales_pay, 0, p.wht_sales]]);
  }
  for (const r of db.prepare(`SELECT r.*, c.type AS ctype FROM refunds r JOIN contacts c ON c.id = r.contact_id WHERE r.${range} ORDER BY r.date, r.id`).all(from, to)) {
    r.account_id ||= A.bank;
    const base = { date: r.date, source: "refund", ref: r.number, source_id: r.id, contact_id: r.contact_id, memo: r.reference };
    push(base, r.ctype === "customer" ? [[A.ar, r.amount, 0], [r.account_id, 0, r.amount]] : [[r.account_id, r.amount, 0], [A.ap, 0, r.amount]]);
  }
  const expAcc = new Map(db.prepare("SELECT expense_category, id FROM accounts WHERE expense_category IS NOT NULL").all().map((r) => [r.expense_category.toLowerCase(), r.id]));
  for (const e of db.prepare(`SELECT * FROM expenses WHERE ${range} ORDER BY date, id`).all(from, to)) {
    const base = { date: e.date, source: "expense", ref: e.category, source_id: e.id, contact_id: e.contact_id, memo: e.notes };
    push(base, [[expAcc.get(String(e.category).toLowerCase()) || A.other_exp, e.amount, 0], [e.account_id || A.cash, 0, e.amount]]);
  }
  if (OPENING_DATE >= from && OPENING_DATE <= to) {
    for (const c of db.prepare("SELECT id, type, name, opening_balance FROM contacts WHERE opening_balance <> 0").all()) {
      const base = { date: OPENING_DATE, source: "opening", ref: "Opening balance", source_id: c.id, contact_id: c.id, memo: c.name };
      push(base, c.type === "customer" ? [[A.ar, c.opening_balance, 0], [A.opening, 0, c.opening_balance]] : [[A.opening, c.opening_balance, 0], [A.ap, 0, c.opening_balance]]);
    }
  }
  for (const a of db.prepare("SELECT id, name, type, opening_balance, COALESCE(opening_date, ?) AS d FROM accounts WHERE opening_balance <> 0").all(OPENING_DATE)) {
    if (a.d < from || a.d > to) continue;
    const base = { date: a.d, source: "opening", ref: "Opening balance", source_id: null, account_ref: a.id, contact_id: null, memo: a.name };
    push(base, DEBIT_NORMAL.has(a.type) ? [[a.id, a.opening_balance, 0], [A.opening, 0, a.opening_balance]] : [[A.opening, a.opening_balance, 0], [a.id, 0, a.opening_balance]]);
  }
  for (const l of db.prepare(`SELECT l.*, e.date, e.number, e.memo AS entry_memo, e.kind FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id WHERE e.${range} ORDER BY e.date, e.id, l.id`).all(from, to)) {
    out.push({ date: l.date, source: l.kind, ref: l.number, source_id: l.entry_id, contact_id: l.contact_id, memo: l.memo || l.entry_memo, account_id: l.account_id, debit: round2(l.debit), credit: round2(l.credit) });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

const signed = (type, debit, credit) => round2(DEBIT_NORMAL.has(type) ? debit - credit : credit - debit);

// balance of every account on a date (or movement over a period when `from` is given)
export function balances(db, { from, to = "9999-12-31" } = {}) {
  const sums = new Map();
  for (const l of ledgerLines(db, { from, to })) {
    const s = sums.get(l.account_id) || { debit: 0, credit: 0 };
    s.debit += l.debit; s.credit += l.credit;
    sums.set(l.account_id, s);
  }
  return db.prepare("SELECT * FROM accounts ORDER BY CAST(code AS INTEGER), code").all().map((a) => {
    const s = sums.get(a.id) || { debit: 0, credit: 0 };
    return { ...a, debit: round2(s.debit), credit: round2(s.credit), balance: signed(a.type, s.debit, s.credit) };
  });
}

export function trialBalance(db, to = today()) {
  const rows = balances(db, { to }).filter((a) => a.debit || a.credit).map((a) => {
    const net = round2(a.debit - a.credit);
    return { id: a.id, code: a.code, name: a.name, type: a.type, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
  });
  const debit = round2(rows.reduce((s, r) => s + r.debit, 0)), credit = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { to, rows, debit, credit, balanced: Math.abs(debit - credit) < 0.01 };
}

export function balanceSheet(db, to = today()) {
  const all = balances(db, { to });
  const group = (type) => all.filter((a) => a.type === type && Math.abs(a.balance) >= 0.005).map(({ id, code, name, kind, balance }) => ({ id, code, name, kind, balance }));
  const sum = (rows) => round2(rows.reduce((s, r) => s + r.balance, 0));
  // profit that hasn't been moved to equity yet: income − expenses, all time up to the date
  const profit = round2(sum(group("income")) - sum(group("expense")));
  const assets = group("asset"), liabilities = group("liability"), equity = group("equity");
  const totalEquity = round2(sum(equity) + profit);
  return {
    to, assets, liabilities, equity, profit_to_date: profit,
    total_assets: sum(assets), total_liabilities: sum(liabilities), total_equity: totalEquity,
    balanced: Math.abs(sum(assets) - sum(liabilities) - totalEquity) < 0.01,
    money: assets.filter((a) => MONEY_KINDS.includes(a.kind)),
  };
}

// one account's statement: opening balance, each line with a running balance, closing balance
export function accountLedger(db, accountId, from = "0000-01-01", to = today()) {
  const a = db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId);
  if (!a) throw httpError(404, "Account not found");
  const before = ledgerLines(db, { to: prevDay(from) }).filter((l) => l.account_id === a.id);
  let run = signed(a.type, before.reduce((s, l) => s + l.debit, 0), before.reduce((s, l) => s + l.credit, 0));
  const opening = run;
  const names = new Map(db.prepare("SELECT id, name FROM contacts").all().map((c) => [c.id, c.name]));
  const lines = ledgerLines(db, { from, to }).filter((l) => l.account_id === a.id).map((l) => {
    run = round2(run + signed(a.type, l.debit, l.credit));
    return { ...l, contact_name: names.get(l.contact_id) || null, balance: run };
  });
  return { account: a, from, to, opening, lines, closing: run,
    debit: round2(lines.reduce((s, l) => s + l.debit, 0)), credit: round2(lines.reduce((s, l) => s + l.credit, 0)) };
}
const prevDay = (d) => (d <= "0000-01-01" ? "0000-01-01" : new Date(Date.parse(d + "T00:00:00Z") - 864e5).toISOString().slice(0, 10));

// ---- manual entries. lines = [{account_id, debit, credit, contact_id?, memo?}]; a transfer is a two-line entry
export function saveJournal(db, userId, { date, memo, lines, kind = "journal" }) {
  const clean = (lines || []).map((l) => ({ account_id: Number(l.account_id), debit: round2(Number(l.debit) || 0), credit: round2(Number(l.credit) || 0), contact_id: Number(l.contact_id) || null, memo: l.memo || null }))
    .filter((l) => l.debit || l.credit);
  if (clean.length < 2) throw httpError(400, "An entry needs at least two lines");
  if (clean.some((l) => l.debit < 0 || l.credit < 0 || (l.debit && l.credit))) throw httpError(400, "Each line is either a debit or a credit, and not negative");
  for (const l of clean) if (!db.prepare("SELECT 1 FROM accounts WHERE id = ? AND active = 1").get(l.account_id)) throw httpError(400, "Pick an open account on every line");
  const dr = round2(clean.reduce((s, l) => s + l.debit, 0)), cr = round2(clean.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(dr - cr) >= 0.01) throw httpError(400, `Debits (${dr}) and credits (${cr}) must be equal`);
  return tx(db, () => {
    const n = (db.prepare("SELECT COUNT(*) AS c FROM journal_entries").get().c || 0) + 1;
    let number = `JV-${String(n).padStart(5, "0")}`;
    while (db.prepare("SELECT 1 FROM journal_entries WHERE number = ?").get(number)) number = `JV-${String(Number(number.slice(3)) + 1).padStart(5, "0")}`;
    const id = Number(db.prepare("INSERT INTO journal_entries (number, date, memo, kind, created_by) VALUES (?, ?, ?, ?, ?)").run(number, date || today(), memo || null, kind === "transfer" ? "transfer" : "journal", userId ?? null).lastInsertRowid);
    const ins = db.prepare("INSERT INTO journal_lines (entry_id, account_id, debit, credit, contact_id, memo) VALUES (?, ?, ?, ?, ?, ?)");
    for (const l of clean) ins.run(id, l.account_id, l.debit, l.credit, l.contact_id, l.memo);
    db.prepare("INSERT INTO activity (user_id, action, entity, entity_id, summary) VALUES (?, ?, 'journal', ?, ?)").run(userId ?? null, kind === "transfer" ? "transferred money" : "added journal entry", id, `${number} · ${dr}${memo ? ` · ${memo}` : ""}`);
    return id;
  });
}

export function transfer(db, userId, { from_account_id, to_account_id, amount, date, memo }) {
  const amt = round2(Number(amount) || 0);
  if (!(amt > 0)) throw httpError(400, "Amount must be more than zero");
  const fromId = moneyAccount(db, from_account_id), toId = moneyAccount(db, to_account_id);
  if (!from_account_id || !to_account_id || fromId === toId) throw httpError(400, "Pick two different accounts");
  return saveJournal(db, userId, { date, memo: memo || "Transfer", kind: "transfer", lines: [{ account_id: toId, debit: amt }, { account_id: fromId, credit: amt }] });
}

export function getJournal(db, id) {
  const e = db.prepare("SELECT j.*, u.name AS created_by_name FROM journal_entries j LEFT JOIN users u ON u.id = j.created_by WHERE j.id = ?").get(id);
  if (!e) throw httpError(404, "Not found");
  return { ...e, lines: db.prepare("SELECT l.*, a.code, a.name AS account_name, c.name AS contact_name FROM journal_lines l JOIN accounts a ON a.id = l.account_id LEFT JOIN contacts c ON c.id = l.contact_id WHERE l.entry_id = ? ORDER BY l.id").all(id) };
}
