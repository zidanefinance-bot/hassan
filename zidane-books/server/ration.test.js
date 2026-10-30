import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "./db.js";
import * as B from "./books.js";
import * as J from "./jobs.js";
import * as RA from "./ration.js";
import * as L from "./ledger.js";
import * as R from "./reports.js";
import { createApp } from "./app.js";
import { ensureAdmin, seedDemo } from "./seed.js";

function setup() {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO users (id, name, email, role, password_hash) VALUES (1, 'T', 't@x.pk', 'director', 'x:y')").run();
  const cust = Number(db.prepare("INSERT INTO contacts (type, name) VALUES ('customer', 'Helping Hands')").run().lastInsertRowid);
  const add = (name, cost, stock = 0) => Number(db.prepare("INSERT INTO items (name, purchase_rate, sale_rate, stock_qty) VALUES (?, ?, 0, ?)").run(name, cost, stock).lastInsertRowid);
  const rice = add("Rice 5kg", 950, 1000), oil = add("Oil 5L", 2500, 1000), daal = add("Daal Chana 1kg", 260, 1000);
  const kit = RA.saveKit(db, { name: "Standard bag", lines: [{ item_id: rice, qty: 1, rate: 1100 }, { item_id: oil, qty: 1, rate: 2800 }, { item_id: daal, qty: 2, rate: 300 }, { description: "Bag & packing", qty: 1, rate: 50 }] });
  return { db, cust, rice, oil, daal, kit };
}

test("kit: rate and cost of one bag", () => {
  const { db, kit } = setup();
  const k = RA.kitDetail(db, kit);
  assert.equal(k.price_per_bag, 4550, "1100 + 2800 + 2×300 + 50");
  assert.equal(k.cost_per_bag, 3970, "950 + 2500 + 2×260");
  assert.throws(() => RA.saveKit(db, { name: "standard BAG", lines: [{ description: "x", qty: 1 }] }), /already has this name/);
});

test("ration order: quote for 500 bags → Job → packing caps the DC → invoice billed as bags; stock, cost and ledger stay right", () => {
  const { db, cust, rice, oil, kit } = setup();
  const q = RA.quoteFromKit(db, 1, kit, { contact_id: cust, bags: 500 });
  const quote = db.prepare("SELECT * FROM documents WHERE id = ?").get(q);
  assert.equal(quote.bags, 500);
  assert.equal(quote.total, 2275000, "500 × 4550");
  assert.equal(db.prepare("SELECT qty FROM document_lines WHERE document_id = ? AND item_id = ?").get(q, oil).qty, 500);
  const jobId = J.jobFromQuote(db, 1, q);
  const job = () => db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  assert.equal(job().bags, 500);
  db.prepare("UPDATE job_items SET procurement_status = 'from_stock' WHERE job_id = ?").run(jobId);
  assert.throws(() => J.dcFromJob(db, 1, jobId), /Record the packing first/);
  RA.addPacking(db, 1, jobId, { bags: 180 });
  assert.throws(() => RA.addPacking(db, 1, jobId, { bags: 400 }), /Only 320 bags are left/);
  assert.throws(() => J.dcFromJob(db, 1, jobId, { bags: 200 }), /Only 180 packed bags/);
  const dc = J.dcFromJob(db, 1, jobId, { bags: 120 });
  assert.equal(db.prepare("SELECT bags FROM documents WHERE id = ?").get(dc).bags, 120);
  assert.equal(db.prepare("SELECT qty FROM document_lines WHERE document_id = ? AND item_id = ?").get(dc, rice).qty, 120);
  B.setStatus(db, 1, dc, "issued");
  assert.equal(db.prepare("SELECT stock_qty FROM items WHERE id = ?").get(rice).stock_qty, 880, "the DC takes 120 bags' rice out of stock");
  const st = RA.rationStatus(db, job());
  assert.deepEqual([st.packed, st.delivered, st.ready_to_send, st.to_pack], [180, 120, 60, 320]);
  const inv = J.invoiceFromJob(db, 1, jobId);
  const invoice = db.prepare("SELECT * FROM documents WHERE id = ?").get(inv);
  assert.equal(invoice.bags, 120, "bills the bags that went out");
  assert.equal(invoice.show_as, "bags");
  assert.equal(invoice.total, 546000, "120 × 4550");
  B.setStatus(db, 1, inv, "open");
  assert.equal(db.prepare("SELECT SUM(qty * cost_rate) AS c FROM document_lines WHERE document_id = ?").get(inv).c, 120 * 3970, "cost of goods per bag carried");
  assert.throws(() => J.invoiceFromJob(db, 1, jobId), /already invoiced/);
  const v = RA.bagView(invoice, db.prepare("SELECT l.*, i.name AS item_name FROM document_lines l LEFT JOIN items i ON i.id = l.item_id WHERE document_id = ?").all(inv));
  assert.equal(v.rate_per_bag, 4550);
  assert.deepEqual(v.contents.map((c) => c.per_bag), [1, 1, 2, 1]);
  assert.ok(L.trialBalance(db, "2999-12-31").balanced);
  assert.equal(L.balanceSheet(db, "2999-12-31").profit_to_date, R.profitAndLoss(db, "0000-01-01", "2999-12-31").net_profit);
});

test("ration: edited by hand stops looking like whole bags → shown item by item; a packing entry already delivered can't go", () => {
  const { db, cust, rice, kit } = setup();
  const jobId = J.jobFromQuote(db, 1, RA.quoteFromKit(db, 1, kit, { contact_id: cust, bags: 10 }));
  db.prepare("UPDATE job_items SET procurement_status = 'from_stock' WHERE job_id = ?").run(jobId);
  const p = RA.addPacking(db, 1, jobId, { bags: 10 });
  const dc = J.dcFromJob(db, 1, jobId, { bags: 10 });
  db.prepare("UPDATE document_lines SET qty = 7 WHERE document_id = ? AND item_id = ?").run(dc, rice);
  RA.syncBags(db, dc);
  const d = db.prepare("SELECT bags, show_as FROM documents WHERE id = ?").get(dc);
  assert.deepEqual([d.bags, d.show_as], [7, "items"]);
  B.setStatus(db, 1, dc, "issued");
  assert.throws(() => RA.deletePacking(db, 1, p), /already gone out/);
});

test("ration API: Operations packs and sees no selling rates; Sales makes the quote", async () => {
  const db = openDb(":memory:");
  const director = ensureAdmin(db);
  seedDemo(db);
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = async (email, password = "demo1234") => {
    const r = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const cookie = r.headers.get("set-cookie").split(";")[0];
    return (path, opts = {}) => fetch(`${base}${path}`, { ...opts, headers: { "content-type": "application/json", "x-reason": "test", cookie } });
  };
  try {
    const [sales, ops] = [await login("sales@zidane.com.pk"), await login("operations@zidane.com.pk")];
    const item = db.prepare("SELECT id FROM items LIMIT 1").get().id;
    const cust = db.prepare("SELECT id FROM contacts WHERE type = 'customer' LIMIT 1").get().id;
    const kit = await (await sales("/kits", { method: "POST", body: JSON.stringify({ name: "Ramadan A", lines: [{ item_id: item, qty: 2, rate: 1500 }] }) })).json();
    assert.ok(kit.id);
    assert.equal((await ops("/kits", { method: "POST", body: JSON.stringify({ name: "x", lines: [{ item_id: item, qty: 1 }] }) })).status, 403, "only Sales prices kits");
    assert.equal((await (await sales(`/kits/${kit.id}`)).json()).cost_per_bag, undefined, "Sales doesn't see cost");
    const q = await (await sales(`/kits/${kit.id}/quote`, { method: "POST", body: JSON.stringify({ contact_id: cust, bags: 50 }) })).json();
    const job = await (await sales(`/documents/${q.id}/job`, { method: "POST", body: "{}" })).json();
    assert.equal((await ops(`/jobs/${job.id}/packing`, { method: "POST", body: JSON.stringify({ bags: 20 }) })).status, 200);
    assert.equal((await sales(`/jobs/${job.id}/packing`, { method: "POST", body: JSON.stringify({ bags: 5 }) })).status, 403, "packing is Operations'");
    const seen = await (await ops(`/jobs/${job.id}`)).json();
    assert.equal(seen.ration.packed, 20);
    assert.equal(seen.ration.price_per_bag, undefined, "Operations doesn't see the bag's selling rate");
    const dir = await login(director.email, director.password);
    assert.ok((await (await dir(`/jobs/${job.id}`)).json()).ration.cost_per_bag > 0, "director sees cost per bag");
  } finally {
    server.close();
  }
});

test("ration quote can hide each item's rate: contents and the bag rate only", async () => {
  const { db, cust, kit } = setup();
  const q = RA.quoteFromKit(db, 1, kit, { contact_id: cust, bags: 200, show_as: "bags_total" });
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(q);
  assert.equal(doc.show_as, "bags_total");
  const lines = db.prepare("SELECT l.*, i.name AS item_name FROM document_lines l LEFT JOIN items i ON i.id = l.item_id WHERE document_id = ?").all(q);
  const v = RA.bagView(doc, lines);
  assert.equal(v.item_rates, false);
  assert.equal(v.rate_per_bag, 4550);
  const { documentPdf } = await import("./pdf.js");
  const pdf = await documentPdf(db, q);
  assert.ok(pdf.buffer.length > 1000);
  RA.markBags(db, q, 200, "Standard bag", "nonsense");
  assert.equal(db.prepare("SELECT show_as FROM documents WHERE id = ?").get(q).show_as, "bags", "unknown modes fall back to bags");
});

test("one order, three delivery points: each DC for one point, its own address, its own bag limit", async () => {
  const { db, cust, kit } = setup();
  const jobId = J.jobFromQuote(db, 1, RA.quoteFromKit(db, 1, kit, { contact_id: cust, bags: 500 }));
  db.prepare("UPDATE job_items SET procurement_status = 'from_stock' WHERE job_id = ?").run(jobId);
  assert.throws(() => RA.savePoints(db, 1, jobId, [{ name: "A", bags: 400 }, { name: "B", bags: 200 }]), /add up to 600 bags, but the order is 500/);
  RA.savePoints(db, 1, jobId, [
    { name: "Korangi office", address: "Plot 12, Sector 23, Korangi", contact: "Imran", phone: "0300 1111111", bags: 200 },
    { name: "SITE factory", address: "D-45, SITE", contact: "Asif", bags: 180 },
    { name: "Landhi warehouse", bags: 120 },
  ]);
  const [korangi, site, landhi] = RA.deliveryPoints(db, jobId);
  RA.addPacking(db, 1, jobId, { bags: 500 });
  assert.throws(() => J.dcFromJob(db, 1, jobId, { bags: 50 }), /Pick which one/);
  const dcA = J.dcFromJob(db, 1, jobId, { point_id: korangi.id });
  const a = db.prepare("SELECT * FROM documents WHERE id = ?").get(dcA);
  assert.equal(a.bags, 200, "defaults to what that point still needs");
  assert.match(a.deliver_to, /Korangi office\nPlot 12, Sector 23, Korangi\nImran · 0300 1111111/);
  assert.throws(() => J.dcFromJob(db, 1, jobId, { point_id: korangi.id }), /already a draft delivery challan for Korangi office/);
  assert.throws(() => J.dcFromJob(db, 1, jobId, { point_id: site.id, bags: 200 }), /SITE factory needs only 180 more bags/);
  const dcB = J.dcFromJob(db, 1, jobId, { point_id: site.id }); // a second point's draft at the same time is fine
  B.setStatus(db, 1, dcA, "issued");
  B.setStatus(db, 1, dcB, "issued");
  const dcC = J.dcFromJob(db, 1, jobId, { point_id: landhi.id });
  assert.equal(db.prepare("SELECT bags FROM documents WHERE id = ?").get(dcC).bags, 120);
  B.setStatus(db, 1, dcC, "issued");
  const st = RA.rationStatus(db, db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId));
  assert.deepEqual(st.points.map((p) => [p.sent, p.left]), [[200, 0], [180, 0], [120, 0]]);
  assert.equal(st.delivered, 500);
  assert.throws(() => RA.savePoints(db, 1, jobId, [{ id: korangi.id, name: "Korangi office", bags: 200 }]), /already has a delivery challan/);
  const { documentPdf } = await import("./pdf.js");
  assert.ok((await documentPdf(db, dcB)).buffer.length > 1000);
  const inv = J.invoiceFromJob(db, 1, jobId);
  assert.equal(db.prepare("SELECT bags FROM documents WHERE id = ?").get(inv).bags, 500, "one invoice for all three deliveries");
  // the invoice names the three DCs it bills, and each DC names the invoice
  const num = (id) => db.prepare("SELECT number FROM documents WHERE id = ?").get(id).number;
  const invDoc = db.prepare("SELECT * FROM documents WHERE id = ?").get(inv);
  assert.deepEqual(J.linkedNumbers(db, invDoc), [num(dcA), num(dcB), num(dcC)]);
  B.setStatus(db, 1, inv, "open");
  assert.deepEqual(J.linkedNumbers(db, db.prepare("SELECT * FROM documents WHERE id = ?").get(dcB)), [num(inv)]);
  // typed by hand on the invoice: kept as typed
  B.saveDocument(db, 1, { ...invDoc, dc_numbers: `${num(dcA)},${num(dcB)}`, lines: db.prepare("SELECT * FROM document_lines WHERE document_id = ?").all(inv), _admin: true }, inv);
  assert.equal(db.prepare("SELECT dc_numbers FROM documents WHERE id = ?").get(inv).dc_numbers, `${num(dcA)}, ${num(dcB)}`);
});

test("a quote priced for 1 bag becomes a Job for the bags confirmed: every line grows with it", () => {
  const { db, cust, kit } = setup();
  const q = RA.quoteFromKit(db, 1, kit, { contact_id: cust, bags: 1 });
  const jobId = J.jobFromQuote(db, 1, q, { bags: 313 });
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  assert.equal(job.bags, 313);
  const per = RA.perBag(db, job);
  assert.deepEqual(per.map((l) => l.per_bag), [1, 1, 2, 1], "one bag still holds what the quote said");
  assert.deepEqual(per.map((l) => l.qty), [313, 313, 626, 313], "the Job is the whole order");
  // a quote already for 100 bags, confirmed for 250
  const q2 = RA.quoteFromKit(db, 1, kit, { contact_id: cust, bags: 100 });
  const j2 = db.prepare("SELECT * FROM jobs WHERE id = ?").get(J.jobFromQuote(db, 1, q2, { bags: 250 }));
  assert.deepEqual(RA.perBag(db, j2).map((l) => l.per_bag), [1, 1, 2, 1]);
});

