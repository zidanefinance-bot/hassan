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
  assert.ok(overdue.rows.some((r) => r.link === `/invoices/${inv}` && /12 din se overdue/.test(r.ask)));
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
