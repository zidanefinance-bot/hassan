import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "./db.js";
import * as B from "./books.js";
import * as R from "./reports.js";
import { createApp } from "./app.js";
import { ensureAdmin, seedDemo } from "./seed.js";

function fresh() {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO users (id, name, email, role, password_hash) VALUES (1, 'T', 't@x.pk', 'admin', 'x:y')").run();
  const c = Number(db.prepare("INSERT INTO contacts (type, name) VALUES ('customer', 'Cust')").run().lastInsertRowid);
  const s = Number(db.prepare("INSERT INTO contacts (type, name) VALUES ('supplier', 'Sup')").run().lastInsertRowid);
  const i = Number(db.prepare("INSERT INTO items (name, purchase_rate, sale_rate) VALUES ('Atta', 100, 120)").run().lastInsertRowid);
  return { db, c, s, i };
}

test("line totals: discount before tax", () => {
  const r = B.computeLines([{ qty: 10, rate: 100, discount_pct: 10, tax_rate: 18 }, { qty: 1, rate: 50 }]);
  assert.equal(r.subtotal, 1050);
  assert.equal(r.discount_total, 100);
  assert.equal(r.tax_total, 162);
  assert.equal(r.total, 1112);
});

test("bills add stock and update cost, invoices remove stock, void restores it", () => {
  const { db, c, s, i } = fresh();
  B.saveDocument(db, 1, { kind: "bill", contact_id: s, status: "open", lines: [{ item_id: i, qty: 50, rate: 90 }] });
  let item = db.prepare("SELECT * FROM items WHERE id = ?").get(i);
  assert.equal(item.stock_qty, 50);
  assert.equal(item.purchase_rate, 90);
  const inv = B.saveDocument(db, 1, { kind: "invoice", contact_id: c, status: "draft", lines: [{ item_id: i, qty: 20, rate: 120 }] });
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 50, "drafts don't move stock");
  B.setStatus(db, 1, inv, "open");
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 30);
  assert.equal(db.prepare("SELECT cost_rate FROM document_lines WHERE document_id = ?").get(inv).cost_rate, 90, "COGS uses cost at time of sale");
  B.saveDocument(db, 1, { kind: "invoice", contact_id: c, status: "open", lines: [{ item_id: i, qty: 5, rate: 120 }] }, inv);
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 45, "editing re-applies stock");
  B.setStatus(db, 1, inv, "void");
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 50);
});

test("payments drive paid/partial/overdue and can't exceed balance", () => {
  const { db, c, i } = fresh();
  const inv = B.saveDocument(db, 1, { kind: "invoice", contact_id: c, status: "open", due_date: "2000-01-01", lines: [{ item_id: i, qty: 10, rate: 100 }] });
  const doc = () => db.prepare("SELECT * FROM documents WHERE id = ?").get(inv);
  assert.equal(B.displayStatus(doc(), 0), "overdue");
  B.recordPayment(db, 1, { direction: "in", document_id: inv, amount: 400 });
  assert.equal(B.displayStatus(doc(), B.paidAmount(db, inv), "1999-12-01"), "partial");
  assert.throws(() => B.recordPayment(db, 1, { direction: "in", document_id: inv, amount: 700 }), /more than the balance/);
  B.recordPayment(db, 1, { direction: "in", document_id: inv, amount: 600 });
  assert.equal(B.displayStatus(doc(), B.paidAmount(db, inv)), "paid");
  assert.throws(() => B.setStatus(db, 1, inv, "void"), /payments/);
});

test("quote converts to a draft invoice and numbering increments", () => {
  const { db, c, i } = fresh();
  const q = B.saveDocument(db, 1, { kind: "quote", contact_id: c, status: "sent", lines: [{ item_id: i, qty: 3, rate: 120 }] });
  const inv = B.convertDocument(db, 1, q);
  const d = db.prepare("SELECT * FROM documents WHERE id = ?").get(inv);
  assert.equal(d.kind, "invoice");
  assert.equal(d.status, "draft");
  assert.equal(d.total, 360);
  assert.equal(d.number, "INV-00001");
  assert.equal(db.prepare("SELECT status FROM documents WHERE id = ?").get(q).status, "invoiced");
});

test("P&L, receivables and demo seed hang together", () => {
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const pnl = R.profitAndLoss(db, "2000-01-01", "2999-12-31");
  assert.ok(pnl.revenue > 0 && pnl.cogs > 0 && pnl.cogs < pnl.revenue);
  assert.equal(pnl.net_profit, B.round2(pnl.revenue - pnl.cogs - pnl.expenses));
  const rec = R.receivables(db);
  assert.equal(rec.total, B.round2(rec.documents.reduce((a, d) => a + d.balance, 0)));
});

test("API: login required and roles enforced", async () => {
  const db = openDb(":memory:");
  const admin = ensureAdmin(db);
  const app = createApp(db);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    assert.equal((await fetch(`${base}/items`)).status, 401);
    const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(admin) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const h = { "content-type": "application/json", cookie };
    assert.equal((await fetch(`${base}/users`, { method: "POST", headers: h, body: JSON.stringify({ name: "Sana", email: "sana@x.pk", role: "sales", password: "password123" }) })).status, 200);
    const sales = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "sana@x.pk", password: "password123" }) });
    const sh = { "content-type": "application/json", cookie: sales.headers.get("set-cookie").split(";")[0] };
    assert.equal((await fetch(`${base}/documents?kind=invoice`, { headers: sh })).status, 200);
    assert.equal((await fetch(`${base}/documents?kind=bill`, { headers: sh })).status, 403);
    assert.equal((await fetch(`${base}/reports/pnl`, { headers: sh })).status, 403);
    assert.equal((await fetch(`${base}/expenses`, { headers: sh })).status, 403);
  } finally {
    server.close();
  }
});
