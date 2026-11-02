import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "./db.js";
import * as B from "./books.js";
import { ensureAdmin, seedDemo } from "./seed.js";
import { buildBrief, briefHtml, sendBrief, useBriefTransport } from "./digest.js";

test("morning brief: what is stuck, as questions, and it goes by email", async () => {
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const cust = db.prepare("SELECT id FROM contacts WHERE type = 'customer' LIMIT 1").get().id;
  // an invoice 12 days past due, unpaid
  const due = new Date(Date.now() - 12 * 864e5).toISOString().slice(0, 10);
  const inv = B.saveDocument(db, 1, { kind: "invoice", contact_id: cust, date: due, due_date: due, status: "open", lines: [{ description: "Tissue", qty: 10, rate: 1000 }] });
  // a Job that is late and never started
  db.prepare("UPDATE jobs SET required_date = date('now', '-3 days'), ops_status = 'new' WHERE id = (SELECT MIN(id) FROM jobs WHERE closed = 0 AND ops_status = 'new')").run();
  const b = buildBrief(db);
  const sec = (t) => b.sections.find((s) => s.title.startsWith(t));
  const overdue = sec("Overdue invoices");
  assert.ok(overdue.rows.some((r) => r.link === `/invoices/${inv}` && /1[23] din se overdue/.test(r.ask)));
  assert.ok(sec("Job overdue").rows.some((r) => /Purchasing abhi tak shuru nahi hui/.test(r.ask)));
  assert.ok(b.count > 0 && b.overdueTotal >= 10000);
  const html = briefHtml(b);
  assert.match(html, /MORNING BRIEF/);
  assert.match(html, /Payment kab aayegi\?/);

  // sent to the address in Settings
  B.setSetting(db, "morningBrief", { enabled: true, to: "hassan@gmail.com", time: "08:00" });
  const sent = [];
  useBriefTransport(async (m) => sent.push(m));
  const r = await sendBrief(db);
  assert.equal(r.to, "hassan@gmail.com");
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Morning brief · \d+ pending · Rs [\d,]+ overdue/);
  assert.match(sent[0].text, /Overdue invoices/);
  useBriefTransport(null);
});

test("a DC an invoice already covers isn't 'not invoiced', even if the invoice qty was corrected", async () => {
  const J = await import("./jobs.js");
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const cust = db.prepare("SELECT id FROM contacts WHERE type = 'customer' LIMIT 1").get().id;
  const jobId = J.createJob(db, 1, { customer_id: cust, items: [{ description: "Motor winding paper", qty: 3, sale_rate: 6316 }] });
  db.prepare("UPDATE job_items SET procurement_status = 'bought' WHERE job_id = ?").run(jobId);
  db.prepare("UPDATE jobs SET ops_status = 'material_ready' WHERE id = ?").run(jobId);
  const dc = J.dcFromJob(db, 1, jobId);
  B.setStatus(db, 1, dc, "issued");
  const stuck = () => buildBrief(db).sections.find((s) => s.title.startsWith("Maal chala gaya"))?.rows.some((r) => r.link === `/jobs/${jobId}`) || false;
  assert.equal(stuck(), true, "DC out, no invoice");
  // an invoice made the old way (no DC numbers kept), its qty corrected from 3 to 2.7
  const inv = B.saveDocument(db, 1, { kind: "invoice", contact_id: cust, job_id: jobId, status: "open", lines: [{ description: "Motor winding paper", qty: 2.7, rate: 6316 }] });
  assert.equal(db.prepare("SELECT dc_numbers FROM documents WHERE id = ?").get(inv).dc_numbers, null);
  assert.equal(stuck(), false, "the invoice covers the DC");
  assert.equal(J.uninvoicedDcs(db, jobId).length, 0);
});

test("numbers can be changed by hand: unique, and other paperwork follows", async () => {
  const J = await import("./jobs.js");
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const cust = db.prepare("SELECT id FROM contacts WHERE type = 'customer' LIMIT 1").get().id;
  const jobId = J.createJob(db, 1, { customer_id: cust, items: [{ description: "Gloves", qty: 5, sale_rate: 100 }] });
  db.prepare("UPDATE job_items SET procurement_status = 'bought' WHERE job_id = ?").run(jobId);
  db.prepare("UPDATE jobs SET ops_status = 'material_ready' WHERE id = ?").run(jobId);
  const dc = J.dcFromJob(db, 1, jobId);
  B.setStatus(db, 1, dc, "issued");
  const inv = J.invoiceFromJob(db, 1, jobId);
  const get = (id) => db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  const lines = (id) => db.prepare("SELECT * FROM document_lines WHERE document_id = ?").all(id);
  // the invoice gets its Zoho number
  B.saveDocument(db, 1, { ...get(inv), number: "INV-000951", lines: lines(inv) }, inv);
  assert.equal(get(inv).number, "INV-000951");
  // a number another invoice has is refused
  const other = B.saveDocument(db, 1, { kind: "invoice", contact_id: cust, status: "draft", lines: [{ description: "x", qty: 1, rate: 1 }] });
  assert.throws(() => B.saveDocument(db, 1, { ...get(other), number: "inv-000951", lines: lines(other) }, other), /already used/);
  // a new one can start with a number typed in
  const typed = B.saveDocument(db, 1, { kind: "quote", contact_id: cust, status: "draft", number: "QT-ZOHO-77", lines: [{ description: "x", qty: 1, rate: 1 }] });
  assert.equal(get(typed).number, "QT-ZOHO-77");
  // the DC renamed: the invoice's DC list follows
  const oldDc = get(dc).number;
  assert.match(get(inv).dc_numbers, new RegExp(oldDc));
  B.saveDocument(db, 1, { ...get(dc), number: "DC-000500", lines: lines(dc) }, dc);
  assert.equal(get(inv).dc_numbers, "DC-000500");
  // the Job renamed: the invoice that referred to it follows
  const jobNo = db.prepare("SELECT number FROM jobs WHERE id = ?").get(jobId).number;
  assert.equal(get(inv).reference, jobNo);
  J.updateJob(db, 1, jobId, { number: "JOB-ZOHO-1" });
  assert.equal(db.prepare("SELECT number FROM jobs WHERE id = ?").get(jobId).number, "JOB-ZOHO-1");
  assert.equal(get(inv).reference, "JOB-ZOHO-1");
  assert.ok(db.prepare("SELECT 1 FROM activity WHERE action = 'changed number' AND summary LIKE ?").get(`%→ INV-000951`));
});
