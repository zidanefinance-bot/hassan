import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "./db.js";
import * as B from "./books.js";
import * as PDC from "./pdc.js";
import { ensureAdmin, seedDemo } from "./seed.js";
import { buildBrief } from "./digest.js";

const plus = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

test("PDC: given against bills, reminders every other day from 7 days before, cleared into a real payment", async () => {
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const sup = db.prepare("SELECT id FROM contacts WHERE type = 'supplier' LIMIT 1").get().id;
  const bank = db.prepare("SELECT id FROM accounts WHERE kind = 'bank' LIMIT 1").get().id;
  const bill = B.saveDocument(db, 1, { kind: "bill", contact_id: sup, status: "open", reference: "S-77", lines: [{ description: "Sacks", qty: 100, rate: 300 }] });
  const t = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  const date = plus(t, 9);
  const id = PDC.savePdc(db, 1, { contact_id: sup, amount: 30000, cheque_no: "00451234", account_id: bank, cheque_date: date, bills: [{ document_id: bill, amount: 30000 }] });
  assert.throws(() => PDC.savePdc(db, 1, { contact_id: sup, amount: 1, cheque_no: "00451234", account_id: bank, cheque_date: date }), /already recorded/);
  assert.equal(B.paidAmount(db, bill), 0, "a PDC is not money paid yet");
  assert.equal(PDC.pdcsForDocument(db, bill).length, 1, "the bill shows the cheque given against it");

  // reminders: 7, 5, 3, 1 days before and on the day; nothing at 9, 8, 6, 4, 2; once a day at most
  const reminded = [];
  for (let k = 9; k >= -2; k--) { const on = plus(date, -k); if (PDC.remindDue(db, on).includes(id)) reminded.push(k); PDC.remindDue(db, on); }
  assert.deepEqual(reminded, [7, 5, 3, 1, 0, -1, -2]);
  assert.ok(db.prepare("SELECT 1 FROM notifications WHERE kind = 'pdc' AND title LIKE '%00451234%'").get());

  // the receiving slip
  const slip = await PDC.receivingPdf(db, id);
  assert.ok(slip.buffer.length > 1500);
  assert.match(slip.filename, /^Cheque-receiving-PDC-00001/);

  // it shows up as due on the brief once within 7 days
  db.prepare("UPDATE pdcs SET cheque_date = ? WHERE id = ?").run(plus(t, 3), id);
  assert.ok(buildBrief(db).sections.find((s) => s.title.startsWith("PDC cheques due")).rows.some((r) => /00451234/.test(r.text)));

  // cleared: a payment from that bank, applied to the bill
  const pay = PDC.clearPdc(db, 1, id);
  const p = db.prepare("SELECT * FROM payments WHERE id = ?").get(pay);
  assert.equal(p.amount, 30000);
  assert.equal(p.account_id, bank);
  assert.equal(p.mode, "cheque");
  assert.equal(B.paidAmount(db, bill), 30000);
  assert.equal(PDC.getPdc(db, id).status, "cleared");
  assert.throws(() => PDC.clearPdc(db, 1, id), /already cleared/);
  assert.equal(PDC.pdcsForDocument(db, bill).length, 0);

  // a bounced one makes no payment
  const id2 = PDC.savePdc(db, 1, { contact_id: sup, amount: 5000, cheque_no: "00451235", account_id: bank, cheque_date: date });
  PDC.closePdc(db, 1, id2, "bounced", "insufficient funds");
  assert.equal(PDC.getPdc(db, id2).status, "bounced");
});
