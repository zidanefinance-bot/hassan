import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./db.js";
import * as B from "./books.js";
import * as L from "./ledger.js";
import * as R from "./reports.js";
import { createApp } from "./app.js";
import { ensureAdmin, seedDemo } from "./seed.js";

const ALL = ["0000-01-01", "2999-12-31"];

test("ledger: every record balances, the balance sheet balances, and ledger profit = P&L net profit", () => {
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const tb = L.trialBalance(db, ALL[1]);
  assert.ok(tb.balanced, `debits ${tb.debit} = credits ${tb.credit}`);
  const bs = L.balanceSheet(db, ALL[1]);
  assert.ok(bs.balanced);
  assert.equal(bs.profit_to_date, R.profitAndLoss(db, ...ALL).net_profit);
});

test("ledger: invoice discount, charges, round-off, tax, cost, payment with tax withheld, credit note and bill", () => {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO users (id, name, email, role, password_hash) VALUES (1, 'T', 't@x.pk', 'director', 'x:y')").run();
  const c = Number(db.prepare("INSERT INTO contacts (type, name) VALUES ('customer', 'Cust')").run().lastInsertRowid);
  const s = Number(db.prepare("INSERT INTO contacts (type, name) VALUES ('supplier', 'Sup')").run().lastInsertRowid);
  const i = Number(db.prepare("INSERT INTO items (name, purchase_rate, sale_rate, stock_qty) VALUES ('Atta', 100, 150, 100)").run().lastInsertRowid);
  const meezan = Number(db.prepare("INSERT INTO accounts (code, name, type, kind) VALUES ('1020', 'Meezan', 'asset', 'bank')").run().lastInsertRowid);
  const bal = (key) => L.balances(db, { to: ALL[1] }).find((a) => a.system_key === key || a.id === key).balance;
  B.saveDocument(db, 1, { kind: "bill", contact_id: s, status: "open", charges: 500, lines: [{ item_id: i, qty: 10, rate: 100, tax_rate: 18 }] }); // 1000 + 180 tax + 500 freight
  const inv = B.saveDocument(db, 1, { kind: "invoice", contact_id: c, status: "open", doc_discount: 100, charges: 200, adjustment: -0.5, lines: [{ item_id: i, qty: 10, rate: 150, tax_rate: 18 }] });
  const total = db.prepare("SELECT total FROM documents WHERE id = ?").get(inv).total; // 1500 + 270 − 100 + 200 − 0.5 = 1869.5
  assert.equal(total, 1869.5);
  assert.equal(bal("sales"), 1599.5, "sales after invoice discount, charges and round-off, before tax");
  assert.equal(bal("gst_output"), 270);
  assert.equal(bal("cogs"), 1000, "cost of the 10 bags sold");
  assert.equal(bal("inventory"), 0, "bought 1000, sold 1000 at cost");
  assert.equal(bal("bill_charges"), 500);
  assert.equal(bal("ap"), 1680);
  B.recordPayment(db, 1, { direction: "in", document_id: inv, amount: 1700, wht_income: 169.5, account_id: meezan, mode: "bank" });
  assert.equal(bal(meezan), 1700, "money went into the chosen bank");
  assert.equal(bal("wht_income_rec"), 169.5);
  assert.equal(bal("ar"), 0, "invoice settled by cash + tax withheld");
  B.saveDocument(db, 1, { kind: "credit_note", contact_id: c, status: "open", return_stock: 1, lines: [{ item_id: i, qty: 1, rate: 150 }] });
  assert.equal(bal("sales_returns"), -150, "returns reduce income");
  assert.equal(bal("inventory"), 100, "the returned bag is back in stock at cost");
  assert.ok(L.trialBalance(db, ALL[1]).balanced);
  assert.equal(L.balanceSheet(db, ALL[1]).profit_to_date, R.profitAndLoss(db, ...ALL).net_profit, "ledger and P&L agree");
});

test("ledger: old payments and expenses get an account from their mode when accounts arrive", () => {
  const file = join(mkdtempSync(join(tmpdir(), "zb-acc-")), "a.db");
  let db = openDb(file);
  db.prepare("INSERT INTO contacts (id, type, name) VALUES (1, 'customer', 'C')").run();
  db.prepare("INSERT INTO payments (number, direction, contact_id, date, amount, mode) VALUES ('R1', 'in', 1, '2026-01-01', 100, 'cash'), ('R2', 'in', 1, '2026-01-02', 200, 'cheque')").run();
  db.prepare("INSERT INTO expenses (date, category, amount, paid_through) VALUES ('2026-01-03', 'Brand new category', 50, 'bank')").run();
  db.exec("UPDATE payments SET account_id = NULL; UPDATE expenses SET account_id = NULL;"); // as if made before accounts
  db.close();
  db = openDb(file);
  const acc = (key) => L.sys(db, key);
  assert.deepEqual(db.prepare("SELECT account_id FROM payments ORDER BY id").all().map((r) => r.account_id), [acc("cash"), acc("bank")]);
  assert.equal(db.prepare("SELECT account_id FROM expenses").get().account_id, acc("bank"));
  assert.ok(db.prepare("SELECT 1 FROM accounts WHERE expense_category = 'Brand new category' AND type = 'expense'").get(), "each expense category gets its own account");
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM accounts WHERE system_key IS NOT NULL").get().c, L.DEFAULT_ACCOUNTS.filter((a) => a[4]).length, "re-opening adds nothing twice");
  db.close();
});

test("journal entries and transfers: must balance, move money between accounts, count in the P&L", () => {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO users (id, name, email, role, password_hash) VALUES (1, 'T', 't@x.pk', 'director', 'x:y')").run();
  const bank = L.sys(db, "bank"), cash = L.sys(db, "cash"), capital = L.sys(db, "capital");
  assert.throws(() => L.saveJournal(db, 1, { memo: "x", lines: [{ account_id: bank, debit: 100 }, { account_id: capital, credit: 90 }] }), /must be equal/);
  L.saveJournal(db, 1, { date: "2026-10-01", memo: "Owner's capital", lines: [{ account_id: bank, debit: 500000 }, { account_id: capital, credit: 500000 }] });
  L.transfer(db, 1, { from_account_id: bank, to_account_id: cash, amount: 20000, date: "2026-10-02" });
  assert.throws(() => L.transfer(db, 1, { from_account_id: bank, to_account_id: capital, amount: 5 }), /cash, bank or wallet/);
  const b = L.balances(db, { to: ALL[1] });
  assert.equal(b.find((a) => a.id === bank).balance, 480000);
  assert.equal(b.find((a) => a.id === cash).balance, 20000);
  const rent = L.expenseAccountFor(db, "Rent");
  L.saveJournal(db, 1, { date: "2026-10-03", memo: "Rent owed", lines: [{ account_id: rent, debit: 30000 }, { account_id: L.sys(db, "ap"), credit: 30000 }] });
  assert.equal(R.profitAndLoss(db, "2026-10-01", "2026-10-31").net_profit, -30000, "journal expense is in the P&L");
  const led = L.accountLedger(db, bank, "2026-10-02", "2026-10-31");
  assert.equal(led.opening, 500000);
  assert.equal(led.closing, 480000);
  assert.ok(L.balanceSheet(db, ALL[1]).balanced);
});

test("accounts API: who can see the books and who can only pick an account", async () => {
  const db = openDb(":memory:");
  const director = ensureAdmin(db);
  seedDemo(db);
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = async (email, password = "demo1234") => {
    const r = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const cookie = r.headers.get("set-cookie").split(";")[0];
    return (path, opts = {}) => fetch(`${base}${path}`, { ...opts, headers: { "content-type": "application/json", cookie } });
  };
  try {
    const [dir, sales, ops, acc] = [await login(director.email, director.password), await login("sales@zidane.com.pk"), await login("operations@zidane.com.pk"), await login("accounts@zidane.com.pk")];
    assert.equal((await sales("/accounts")).status, 403, "sales doesn't see balances");
    assert.equal((await sales("/accounts/money")).status, 403);
    assert.equal((await ops("/accounts/money")).status, 200, "operations picks the account for a job cost");
    assert.equal((await ops("/accounts")).status, 403);
    assert.equal((await acc("/reports/balance-sheet")).status, 200);
    const nb = await (await acc("/accounts", { method: "POST", body: JSON.stringify({ name: "HBL current", type: "asset", kind: "bank", opening_balance: 250000, opening_date: "2026-10-01" }) })).json();
    assert.ok(nb.id);
    const money = await (await ops("/accounts/money")).json();
    assert.ok(money.some((a) => a.id === nb.id), "new bank shows up in the picker");
    const job = db.prepare("SELECT id FROM jobs LIMIT 1").get().id;
    assert.equal((await ops("/expenses", { method: "POST", body: JSON.stringify({ category: "Freight", amount: 1500, job_id: job, paid_through: "bank", account_id: nb.id }) })).status, 200);
    const ledger = await (await acc(`/accounts/${nb.id}/ledger?from=2000-01-01`)).json();
    assert.equal(ledger.closing, 248500, "opening 250000 less the freight paid from it");
    const sys = db.prepare("SELECT id FROM accounts WHERE system_key = 'ar'").get().id;
    assert.equal((await dir(`/accounts/${sys}`, { method: "PUT", body: JSON.stringify({ active: false }) })).status, 400, "built-in accounts can't be closed");
    assert.equal((await acc("/journals", { method: "POST", body: JSON.stringify({ memo: "x", lines: [{ account_id: nb.id, debit: 1 }, { account_id: sys, credit: 2 }] }) })).status, 400);
    assert.equal((await sales("/journals", { method: "POST", body: JSON.stringify({}) })).status, 403);
    const tb = await (await dir("/reports/trial-balance?to=2999-12-31")).json();
    assert.ok(tb.balanced);
  } finally {
    server.close();
  }
});
