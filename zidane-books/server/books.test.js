import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "./db.js";
import * as B from "./books.js";
import * as R from "./reports.js";
import { createApp } from "./app.js";
import { ensureAdmin, seedDemo } from "./seed.js";
import * as J from "./jobs.js";

function fresh() {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO users (id, name, email, role, password_hash) VALUES (1, 'T', 't@x.pk', 'director', 'x:y')").run();
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
  const extra = B.recordPayment(db, 1, { direction: "in", document_id: inv, amount: 700 });
  assert.equal(B.displayStatus(doc(), B.paidAmount(db, inv)), "paid");
  assert.equal(B.unusedAmount(db, extra), 100, "overpayment stays as customer advance");
  assert.throws(() => B.setStatus(db, 1, inv, "void"), /payments/);
});

test("Job flow: quote → Job → DC moves stock → invoice doesn't move it again → economics", () => {
  const { db, c, s: sup, i } = fresh();
  db.prepare("UPDATE items SET stock_qty = 100 WHERE id = ?").run(i);
  const q = B.saveDocument(db, 1, { kind: "quote", contact_id: c, status: "accepted", lines: [{ item_id: i, qty: 10, rate: 120 }] });
  const job = J.jobFromQuote(db, 1, q, { required_date: "2030-01-01" });
  assert.equal(db.prepare("SELECT status FROM documents WHERE id = ?").get(q).status, "converted");
  assert.equal(db.prepare("SELECT number FROM jobs WHERE id = ?").get(job).number, "JOB-00001");
  assert.throws(() => J.jobFromQuote(db, 1, q), /already exists/);
  B.saveDocument(db, 1, { kind: "bill", contact_id: sup, job_id: job, status: "open", lines: [{ item_id: i, qty: 10, rate: 95 }] });
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 110);
  const ji = db.prepare("SELECT id FROM job_items WHERE job_id = ?").get(job).id;
  J.setItemProcurement(db, 1, ji, "bought");
  assert.equal(db.prepare("SELECT ops_status FROM jobs WHERE id = ?").get(job).ops_status, "purchase_complete");
  const dc = J.dcFromJob(db, 1, job);
  B.setStatus(db, 1, dc, "issued");
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 100, "DC takes stock out");
  assert.throws(() => J.dcFromJob(db, 1, job), /already been delivered/);
  J.signDc(db, 1, dc, { name: "Store" });
  assert.equal(db.prepare("SELECT ops_status FROM jobs WHERE id = ?").get(job).ops_status, "delivered");
  const inv = J.invoiceFromJob(db, 1, job);
  B.setStatus(db, 1, inv, "open");
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 100, "Job invoice doesn't move stock again");
  assert.equal(db.prepare("SELECT total FROM documents WHERE id = ?").get(inv).total, 1200);
  db.prepare("INSERT INTO expenses (date, category, amount, job_id) VALUES ('2030-01-01', 'Freight', 50, ?)").run(job);
  const e = J.jobEconomics(db, job);
  assert.equal(e.total_cost, 1000);
  assert.equal(e.gross_profit, 200);
});

test("direct-delivery Jobs never touch warehouse stock", () => {
  const { db, c, s: sup, i } = fresh();
  const job = J.createJob(db, 1, { customer_id: c, fulfilment_type: "direct", items: [{ item_id: i, qty: 5, sale_rate: 120 }] });
  B.saveDocument(db, 1, { kind: "bill", contact_id: sup, job_id: job, status: "open", lines: [{ item_id: i, qty: 5, rate: 90 }] });
  const dc = J.dcFromJob(db, 1, job);
  B.setStatus(db, 1, dc, "issued");
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 0);
});

test("procurement list groups the same item across Jobs", () => {
  const { db, c, i } = fresh();
  J.createJob(db, 1, { customer_id: c, items: [{ item_id: i, qty: 500 }] });
  J.createJob(db, 1, { customer_id: c, items: [{ item_id: i, qty: 250 }, { description: "Harpic 500ml", qty: 300 }] });
  const list = J.procurementList(db);
  const atta = list.find((g) => g.item_id === i);
  assert.equal(atta.total_qty, 750);
  assert.equal(atta.jobs.length, 2);
  assert.ok(list.find((g) => g.name === "Harpic 500ml"));
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

test("API: role boundaries are enforced on the server", async () => {
  const db = openDb(":memory:");
  const director = ensureAdmin(db);
  seedDemo(db);
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = async (email, password) => {
    const r = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    assert.equal(r.status, 200, email);
    const cookie = r.headers.get("set-cookie").split(";")[0];
    return (path, opts = {}) => fetch(`${base}${path}`, { ...opts, headers: { "content-type": "application/json", cookie } });
  };
  try {
    assert.equal((await fetch(`${base}/items`)).status, 401);
    const [dir, sales, ops, buyer, acc] = await Promise.all([login(director.email, director.password), ...["sales", "operations", "purchaser", "accounts"].map((r) => login(`${r}@zidane.com.pk`, "demo1234"))]);
    // Sales: customer side only, no costs
    assert.equal((await sales("/documents?kind=invoice")).status, 200);
    assert.equal((await sales("/documents?kind=bill")).status, 403);
    assert.equal((await sales("/payments", { method: "POST", body: JSON.stringify({ direction: "in", contact_id: 1, amount: 5 }) })).status, 403, "sales can't post receipts");
    assert.equal((await (await sales("/items")).json())[0].purchase_rate, undefined, "sales doesn't see purchase cost");
    assert.equal((await (await sales("/jobs/1")).json()).economics, null, "sales doesn't see job profit");
    // Operations: fulfilment and cost side, never the customer invoice or selling rates
    assert.equal((await ops("/documents?kind=invoice")).status, 403);
    assert.equal((await ops("/jobs/1/invoice", { method: "POST" })).status, 403);
    assert.equal((await (await ops("/items")).json())[0].sale_rate, undefined, "ops doesn't see selling rate");
    const opJob = await (await ops("/jobs/1")).json();
    assert.equal(opJob.items[0].sale_rate, undefined);
    assert.ok(opJob.documents.every((d) => ["po", "bill"].includes(d.kind)), "ops sees only purchase documents on a Job");
    // Purchaser: can buy, can't change fulfilment status or see money
    assert.equal((await buyer("/procurement")).status, 200);
    assert.equal((await buyer("/jobs/2/ops-status", { method: "POST", body: JSON.stringify({ status: "material_ready" }) })).status, 403);
    // Accounts: money and verification, can't edit sales documents
    assert.equal((await acc("/payments?direction=in")).status, 200);
    assert.equal((await acc("/documents", { method: "POST", body: JSON.stringify({ kind: "invoice", contact_id: 1, lines: [{ qty: 1, rate: 1 }] }) })).status, 403);
    assert.ok((await (await acc("/jobs/1")).json()).economics, "accounts sees job economics");
    // Director: everything
    assert.equal((await dir("/reports/job-profit")).status, 200);
    assert.equal((await sales("/reports/job-profit")).status, 403);
  } finally {
    server.close();
  }
});

test("item 360: transactions, rate history, last rate, change log and CSV import", async () => {
  const I = await import("./items.js");
  const { db, c, s: sup, i } = fresh();
  const all = () => true;
  B.saveDocument(db, 1, { kind: "bill", contact_id: sup, status: "open", lines: [{ item_id: i, qty: 10, rate: 90 }] });
  B.saveDocument(db, 1, { kind: "bill", contact_id: sup, status: "open", lines: [{ item_id: i, qty: 10, rate: 100 }] });
  B.saveDocument(db, 1, { kind: "invoice", contact_id: c, status: "open", lines: [{ item_id: i, qty: 5, rate: 130, discount_pct: 10 }] });
  assert.equal(I.itemTransactions(db, i, all).length, 3);
  const salesOnly = (p) => ["sales.read", "price.view"].includes(p);
  const tSales = I.itemTransactions(db, i, salesOnly);
  assert.ok(tSales.every((t) => t.kind === "invoice"), "sales sees only customer-side documents");
  const r = I.itemRates(db, i, all);
  assert.equal(r.purchase.last.rate, 100);
  assert.equal(r.purchase.avg_90, 95);
  assert.equal(r.sales.last.rate, 117);
  assert.equal(I.itemRates(db, i, salesOnly).purchase, undefined, "no purchase rates for sales");
  assert.equal(I.lastRate(db, i, c, "sale", all).rate, 117);
  const before = db.prepare("SELECT * FROM items WHERE id = ?").get(i);
  I.logItemChanges(db, 1, before, { ...before, sale_rate: 125 }, all);
  assert.match(I.itemHistory(db, i)[0].summary, /selling rate: 120 → 125/);
  I.logItemChanges(db, 1, before, { ...before, purchase_rate: 99 }, all);
  assert.equal(I.itemHistory(db, i, salesOnly).filter((a) => /purchase rate/.test(a.summary)).length, 0, "sales never sees cost changes");
  const moves = I.shapeMoves([{ reason: "bill BILL-00001", document_kind: "bill", document_id: 1 }], salesOnly);
  assert.equal(moves[0].reason, "purchase received");
  const res = I.importItems(db, 1, [{ "Item Name": "Atta", Rate: "125", "Purchase Rate": "101" }, { "Item Name": "Sugar 1kg", SKU: "SUG-1", Rate: "Rs 155", "Opening Stock": "40", Unit: "kg" }, { Rate: "1" }], all);
  assert.deepEqual(res, { created: 1, updated: 1, skipped: 1 });
  const sugar = db.prepare("SELECT * FROM items WHERE sku = 'SUG-1'").get();
  assert.equal(sugar.sale_rate, 155);
  assert.equal(sugar.stock_qty, 40);
});

test("advances: receive ahead, apply later; split one payment across invoices; unapply; statement", () => {
  const { db, c, s: sup, i } = fresh();
  const inv1 = B.saveDocument(db, 1, { kind: "invoice", contact_id: c, status: "open", date: "2030-01-05", lines: [{ item_id: i, qty: 10, rate: 100 }] });
  const inv2 = B.saveDocument(db, 1, { kind: "invoice", contact_id: c, status: "open", date: "2030-01-10", lines: [{ item_id: i, qty: 5, rate: 100 }] });
  // advance with nothing applied
  const adv = B.recordPayment(db, 1, { direction: "in", contact_id: c, amount: 800, date: "2030-01-01" });
  assert.equal(db.prepare("SELECT number FROM payments WHERE id = ?").get(adv).number, "RCPT-00001");
  assert.equal(B.contactCredits(db, c)[0].unused, 800);
  B.applyCredits(db, 1, inv1, [{ payment_id: adv, amount: 800 }]);
  assert.equal(B.paidAmount(db, inv1), 800);
  assert.equal(B.contactCredits(db, c).length, 0);
  assert.throws(() => B.applyCredits(db, 1, inv2, [{ payment_id: adv, amount: 1 }]), /doesn't have that much left/);
  // one payment split across both invoices, with the rest as advance
  const p2 = B.recordPayment(db, 1, { direction: "in", contact_id: c, amount: 1000, date: "2030-01-12", allocations: [{ document_id: inv1, amount: 200 }, { document_id: inv2, amount: 500 }] });
  assert.equal(B.unusedAmount(db, p2), 300);
  assert.throws(() => B.recordPayment(db, 1, { direction: "in", contact_id: c, amount: 10, allocations: [{ document_id: inv1, amount: 20 }] }), /more than the payment/);
  // a supplier payment can't touch a customer invoice
  const sp = B.recordPayment(db, 1, { direction: "out", contact_id: sup, amount: 50 });
  assert.throws(() => B.applyCredits(db, 1, inv1, [{ payment_id: sp, amount: 10 }]), /different contact|Customer receipts/);
  // unapply puts money back on credit
  const alloc = db.prepare("SELECT id FROM payment_allocations WHERE payment_id = ? AND document_id = ?").get(p2, inv2).id;
  B.removeAllocation(db, 1, alloc);
  assert.equal(B.unusedAmount(db, p2), 800);
  // statement: 1000 + 500 charged, 800 + 1000 received → customer is 300 in credit
  const st = B.statement(db, c);
  assert.equal(st.closing, -300);
  assert.equal(st.rows.length, 4);
  const jan = B.statement(db, c, "2030-01-06");
  assert.equal(jan.opening, 200, "opening balance carries entries before the period");
});

test("credit notes and vendor credits: return stock, apply, refund, void rules; clone; extras; credit limit", () => {
  const { db, c, s: sup, i } = fresh();
  db.prepare("UPDATE items SET stock_qty = 50 WHERE id = ?").run(i);
  // invoice with delivery charges, flat discount and round-off
  const inv = B.saveDocument(db, 1, { kind: "invoice", contact_id: c, status: "open", charges: 500, charges_label: "Delivery", doc_discount: 100, adjustment: -0.5, lines: [{ item_id: i, qty: 10, rate: 100 }] });
  assert.equal(db.prepare("SELECT total FROM documents WHERE id = ?").get(inv).total, 1399.5);
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 40);
  // customer returns 2 → credit note brings stock back and can be applied to the invoice
  const cn = B.saveDocument(db, 1, { kind: "credit_note", contact_id: c, status: "open", lines: [{ item_id: i, qty: 2, rate: 100 }] });
  assert.equal(db.prepare("SELECT number FROM documents WHERE id = ?").get(cn).number, "CN-00001");
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 42);
  assert.equal(B.contactCredits(db, c).find((x) => x.source === "credit").unused, 200);
  B.applyCredits(db, 1, inv, [{ credit_id: cn, amount: 150 }]);
  assert.equal(B.paidAmount(db, inv), 150);
  assert.equal(B.creditUnused(db, cn), 50);
  assert.throws(() => B.setStatus(db, 1, cn, "void"), /Unapply or reverse/);
  // refund the rest of the credit note to the customer
  B.recordRefund(db, 1, { credit_id: cn, amount: 50, mode: "cash" });
  assert.equal(B.creditUnused(db, cn), 0);
  assert.throws(() => B.recordRefund(db, 1, { credit_id: cn, amount: 1 }), /only has 0 unused/);
  // refund an advance
  const adv = B.recordPayment(db, 1, { direction: "in", contact_id: c, amount: 300 });
  B.recordRefund(db, 1, { payment_id: adv, amount: 100 });
  assert.equal(B.unusedAmount(db, adv), 200);
  // statement: invoice 1399.5 − credit note 200 + refund 50 − advance 300 + refund 100 = 1049.5
  assert.equal(B.statement(db, c).closing, 1049.5);
  // vendor credit takes stock back out and applies to a bill
  const bill = B.saveDocument(db, 1, { kind: "bill", contact_id: sup, status: "open", lines: [{ item_id: i, qty: 10, rate: 90 }] });
  const vc = B.saveDocument(db, 1, { kind: "vendor_credit", contact_id: sup, status: "open", lines: [{ item_id: i, qty: 1, rate: 90 }] });
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 51);
  assert.throws(() => B.applyCredits(db, 1, inv, [{ credit_id: vc, amount: 10 }]), /different contact|Customer receipts/);
  B.applyCredits(db, 1, bill, [{ credit_id: vc, amount: 90 }]);
  assert.equal(B.paidAmount(db, bill), 90);
  // a credit note for a discount only (no goods back) doesn't touch stock
  B.saveDocument(db, 1, { kind: "credit_note", contact_id: c, status: "open", return_stock: false, lines: [{ description: "Rate difference", qty: 1, rate: 75 }] });
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(i).stock_qty, 51);
  // clone keeps lines and extras as a new draft
  const copy = B.cloneDocument(db, 1, inv);
  const cd = db.prepare("SELECT * FROM documents WHERE id = ?").get(copy);
  assert.equal(cd.status, "draft");
  assert.equal(cd.total, 1399.5);
  assert.notEqual(cd.number, db.prepare("SELECT number FROM documents WHERE id = ?").get(inv).number);
  // credit limit
  db.prepare("UPDATE contacts SET credit_limit = 1500 WHERE id = ?").run(c);
  const st = B.creditStatus(db, c, 1000);
  assert.equal(st.owed, 1249.5);
  assert.equal(st.over, true);
});

test("API: attachments, credit-limit approval, backup and health", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const db = openDb(":memory:");
  const director = ensureAdmin(db);
  seedDemo(db);
  const server = createApp(db, { uploadDir: join(mkdtempSync(join(tmpdir(), "zb-")), "uploads") }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = async (email, password) => {
    const r = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const cookie = r.headers.get("set-cookie").split(";")[0];
    return (path, opts = {}) => fetch(`${base}${path}`, { ...opts, headers: { "content-type": "application/json", cookie } });
  };
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200, "health needs no login");
    const [dir, sales, ops] = [await login(director.email, director.password), await login("sales@zidane.com.pk", "demo1234"), await login("operations@zidane.com.pk", "demo1234")];
    // attachment on an invoice: sales can, operations can't even see it
    const png = Buffer.from("89504e470d0a1a0a", "hex").toString("base64");
    const up = await sales("/attachments", { method: "POST", body: JSON.stringify({ entity: "document", entity_id: 6, filename: "signed.png", mime: "image/png", data: png, label: "Signed DC" }) });
    assert.equal(up.status, 200);
    const { id: att } = await up.json();
    assert.equal((await (await sales("/attachments?entity=document&entity_id=6")).json()).length, 1);
    assert.equal((await ops("/attachments?entity=document&entity_id=6")).status, 403);
    assert.equal((await sales(`/attachments/${att}/file`)).headers.get("content-type"), "image/png");
    assert.equal((await sales("/attachments", { method: "POST", body: JSON.stringify({ entity: "document", entity_id: 6, filename: "x.exe", mime: "application/x-msdownload", data: png }) })).status, 400);
    // credit limit: sales can't issue over the limit, a director can
    await dir("/contacts/1", { method: "PUT", body: JSON.stringify({ credit_limit: 1000 }) });
    const body = { kind: "invoice", contact_id: 1, status: "open", lines: [{ qty: 1, rate: 5000 }] };
    const blocked = await sales("/documents", { method: "POST", body: JSON.stringify(body) });
    assert.equal(blocked.status, 403);
    assert.match((await blocked.json()).error, /credit limit/);
    assert.equal((await dir("/documents", { method: "POST", body: JSON.stringify(body) })).status, 200);
    // backup: director only, returns a SQLite file
    const bk = await dir("/admin/backup");
    assert.equal(bk.status, 200);
    assert.equal(Buffer.from(await bk.arrayBuffer()).subarray(0, 15).toString(), "SQLite format 3");
    assert.equal((await sales("/admin/backup")).status, 403);
  } finally {
    server.close();
  }
});
