import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "./db.js";
import * as B from "./books.js";
import * as J from "./jobs.js";
import { jobWht, whtOutstanding } from "./wht.js";
import { ensureAdmin, seedDemo } from "./seed.js";

test("withholding per Job line: customer's default, a line's own rate, the invoice expects it, the payment clears it", () => {
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const cust = Number(db.prepare("INSERT INTO contacts (type, name, wht_income_pct, wht_sales_pct) VALUES ('customer', 'Mills Ltd', 5.5, 20)").run().lastInsertRowid);
  const jobId = J.createJob(db, 1, { customer_id: cust, items: [
    { description: "Tissue box", qty: 100, sale_rate: 200, tax_rate: 18 },             // goods: the customer's 5.5% and 20% of tax
    { description: "Cleaning service", qty: 1, sale_rate: 10000, tax_rate: 0, wht_income_pct: 11 }, // a service at 11%
  ] });
  const w = jobWht(db, jobId);
  const box = w.lines.find((l) => l.name === "Tissue box"), svc = w.lines.find((l) => l.name === "Cleaning service");
  assert.equal(box.wht_income, 1100);           // 5.5% of 20,000
  assert.equal(box.wht_sales, 720);             // 20% of 3,600 tax
  assert.equal(svc.wht_income, 1100);           // 11% of 10,000
  assert.equal(w.total, 2920);
  assert.equal(w.cash, 20000 + 3600 + 10000 - 2920);

  db.prepare("UPDATE job_items SET procurement_status = 'bought' WHERE job_id = ?").run(jobId);
  db.prepare("UPDATE jobs SET ops_status = 'material_ready' WHERE id = ?").run(jobId);
  const dc = J.dcFromJob(db, 1, jobId);
  B.setStatus(db, 1, dc, "issued");
  const inv = J.invoiceFromJob(db, 1, jobId);
  B.setStatus(db, 1, inv, "open");
  let d = db.prepare("SELECT * FROM documents WHERE id = ?").get(inv);
  assert.equal(d.wht_income_exp, 2200);
  assert.equal(d.wht_sales_exp, 720);
  // they pay: cash = total - withholding, the two taxes as withheld, and the invoice is settled
  B.recordPayment(db, 1, { direction: "in", contact_id: cust, document_id: inv, amount: d.total - 2920, wht_income: 2200, wht_sales: 720, mode: "bank" });
  assert.equal(B.paidAmount(db, inv), d.total);
  assert.deepEqual(whtOutstanding(db, d), { income: 0, sales: 0 });
});

test("withholding corrected later: the Job's invoice follows; tax that comes in later can be recorded alone", () => {
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const cust = Number(db.prepare("INSERT INTO contacts (type, name, wht_income_pct) VALUES ('customer', 'Mills Ltd', 5.5)").run().lastInsertRowid);
  const jobId = J.createJob(db, 1, { customer_id: cust, items: [{ description: "Gloves", qty: 10, sale_rate: 100 }, { description: "Mop", qty: 10, sale_rate: 100 }] });
  db.prepare("UPDATE job_items SET procurement_status = 'bought' WHERE job_id = ?").run(jobId);
  db.prepare("UPDATE jobs SET ops_status = 'material_ready' WHERE id = ?").run(jobId);
  B.setStatus(db, 1, J.dcFromJob(db, 1, jobId), "issued");
  const inv = J.invoiceFromJob(db, 1, jobId);
  B.setStatus(db, 1, inv, "open");
  const exp = () => db.prepare("SELECT wht_income_exp AS v FROM documents WHERE id = ?").get(inv).v;
  assert.equal(exp(), 110); // 5.5% of 2,000
  // oops: they don't withhold on the mop
  const items = db.prepare("SELECT * FROM job_items WHERE job_id = ? ORDER BY id").all(jobId);
  J.updateJob(db, 1, jobId, { items: items.map((i) => ({ ...i, wht_income_pct: i.description === "Mop" ? 0 : "" })) });
  assert.equal(exp(), 55, "the invoice expects the corrected amount");
  // they paid the cash net; the tax certificate comes later, on its own
  const total = db.prepare("SELECT total FROM documents WHERE id = ?").get(inv).total;
  B.recordPayment(db, 1, { direction: "in", contact_id: cust, document_id: inv, amount: total - 55, mode: "bank" });
  B.recordPayment(db, 1, { direction: "in", contact_id: cust, document_id: inv, amount: 0, wht_income: 55, mode: "bank" });
  assert.equal(B.paidAmount(db, inv), total);
  assert.throws(() => B.recordPayment(db, 1, { direction: "in", contact_id: cust, amount: 0, mode: "bank" }), /more than zero/);
});
