import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./db.js";
import { addMessage, processMessage, useReader } from "./inbox.js";
import { parseQueryEmail } from "./queryparse.js";

// the shapes buyers' ERPs paste into an email (each table cell on its own line in the email's text)
const WITH_HEADER = "Dear Concern,\n\nPlease quote your best rates.\n\nRequisition\nItem Description\nUOM\nQuantity\n1510\nDRILL BIT SET 4-18MM\nSet\n1\n1512\nLOCK PLIER INNER\nPieces\n2\n\n[cid:image001.jpg@01]\n\nDisclaimer: confidential";
const WITH_CODES = "need your best and least rate\n\n1450\n510-00001878-00000-01-000-000\nEMERGENCY LIGHT BULB 6V\nPieces\n30\n1450\n510-00008234-00000-01-000-000\nBATTERY 6V 4.5AH\nPieces\n15\n";
const SHARED_PR = "Please quote for the following.\n\n32549\nFIRST AID BANDAGE 2\"\nPieces\n24\nSURGICAL TAPE\nPieces\n24\nGAUZE\nPacket\n1,200\n";
const EXTRA_COLUMN = "Importance: High\n\nNote: Electrical tools must be VDE type.\n\nItem\nRequisition\nItem Description\nUOM\nQuantity\n\nOperating Unit\n515-00002675-00000-01-000-000\n214\nCOMBINATION PLIER 8\"\nPieces\n4\nDENIM UNIT\n410-00013383-00000-01-000-000\n214\nMEASURING TAPE 50M\nPieces\n1\n\nDENIM UNIT\n410-00013383-00000-01-000-000\n214\nMEASURING TAPE 50M\nPieces\n1\n\nDENIM UNIT\n";
const FROM = "Buyer One <buyer.one@textile-mills.com.pk>";

test("RFQ tables typed into an email are read line by line", () => {
  const a = parseQueryEmail({ subject: "Quotation Required PR# 1510", text: WITH_HEADER, from: FROM });
  assert.equal(a.request, "rfq");
  assert.deepEqual(a.lines.map((l) => [l.description, l.unit, l.qty, l.requisition]), [["DRILL BIT SET 4-18MM", "Set", 1, "1510"], ["LOCK PLIER INNER", "Pieces", 2, "1512"]]);
  assert.equal(a.party_name, "Textile Mills");
  assert.equal(a.reference, null, "an RFQ is not a PO");

  const b = parseQueryEmail({ subject: "1450 RFQ", text: WITH_CODES, from: FROM });
  assert.deepEqual(b.lines.map((l) => [l.description, l.qty, l.their_code]), [["EMERGENCY LIGHT BULB 6V", 30, "510-00001878-00000-01-000-000"], ["BATTERY 6V 4.5AH", 15, "510-00008234-00000-01-000-000"]]);

  const c = parseQueryEmail({ subject: "RFQ", text: SHARED_PR, from: FROM });
  assert.deepEqual(c.lines.map((l) => [l.description, l.qty, l.requisition]), [["FIRST AID BANDAGE 2\"", 24, "32549"], ["SURGICAL TAPE", 24, "32549"], ["GAUZE", 1200, "32549"]], "PR on the first row only applies to the rows under it");

  const d = parseQueryEmail({ subject: "RFQ", text: EXTRA_COLUMN, from: FROM });
  assert.deepEqual(d.lines.map((l) => l.description), ["COMBINATION PLIER 8\"", "MEASURING TAPE 50M", "MEASURING TAPE 50M"], "the operating-unit column isn't taken for an item");
  assert.match(d.notes, /VDE type/);
  assert.match(d.check, /appear twice/);
  assert.doesNotMatch(d.notes, /twice/, "our warning never goes on the quote");

  // HTML-only email: the table cells are read from the HTML
  const h = parseQueryEmail({ subject: "RFQ", text: "Please quote", html: "<table><tr><td>Item Description</td><td>UOM</td><td>Qty</td></tr><tr><td><b>HOLE SAW &amp; BITS</b></td><td>Pieces</td><td>3</td></tr></table>", from: FROM });
  assert.deepEqual(h.lines.map((l) => [l.description, l.qty]), [["HOLE SAW & BITS", 3]]);

  // pictures of the items above the table ([cid:…]) don't end the email; their date / requester cells are skipped
  const pics = "Need best and least rate\nPls find the attached Picture\n\nHEADSET WITH MIC\n\n[cid:image001.png@01]\n\nINTERNAL SPEAKERS\n[cid:image006.png@01][cid:image007.png@01]\n\n243\n510-00053409-00000-01-000-000\nAMPLIFIER 2500 WATTS\nPieces\n1\n27-Oct-2026\nRequester Name\n243\n410-00013394-00000-01-000-000\nSPEAKER WIRE 2.5 mm 2 core\nMeter\n2000\n27-Oct-2026\nRequester Name\n\nDisclaimer: confidential";
  assert.deepEqual(parseQueryEmail({ subject: "FW: 243 RFQ against Picture", text: pics, from: FROM }).lines.map((l) => [l.description, l.unit, l.qty, l.requisition]), [["AMPLIFIER 2500 WATTS", "Pieces", 1, "243"], ["SPEAKER WIRE 2.5 mm 2 core", "Meter", 2000, "243"]]);
  // a forward: the table is under "From: … Sent: …"
  assert.equal(parseQueryEmail({ subject: "FW: RFQ", text: `Please see below\n\nFrom: Buyer One\nSent: Monday\nSubject: RFQ\n\n${WITH_HEADER}`, from: FROM }).lines.length, 2);
  // a row's cells on one line, split by tabs; a table with no unit column
  assert.deepEqual(parseQueryEmail({ subject: "RFQ", text: "Please quote\nRequisition\tItem Description\tUOM\tQuantity\n77\tA4 PAPER 80GSM\tReam\t50", from: FROM }).lines.map((l) => [l.description, l.qty]), [["A4 PAPER 80GSM", 50]]);
  assert.deepEqual(parseQueryEmail({ subject: "RFQ", text: "Please quote\nS.No\nDescription\nQty\n1\nTISSUE BOX\n100\n2\nHAND WASH 500ML\n40\nRegards", from: FROM }).lines.map((l) => [l.description, l.qty]), [["TISSUE BOX", 100], ["HAND WASH 500ML", 40]]);

  // a PO typed into the email keeps its PO number; ordinary emails are not orders
  assert.equal(parseQueryEmail({ subject: "Delivery required PO# 24099", text: WITH_HEADER.replace("Please quote your best rates.", "Please deliver."), from: FROM }).reference, "24099");
  assert.equal(parseQueryEmail({ subject: "Meeting", text: "Can we meet on Monday at 3?\nThanks", from: FROM }), null);
});

test("inbox: an RFQ email becomes a draft to quote for the right customer; a reminder doesn't make a second one", async () => {
  const db = openDb(":memory:");
  const dir = mkdtempSync(join(tmpdir(), "zb-q-"));
  useReader({ ready: () => false, read: async () => { throw new Error("no AI in tests"); } });
  db.prepare("INSERT INTO users (id, name, email, role, password_hash) VALUES (1, 'S', 's@x.pk', 'sales', 'x:y')").run();
  const cust = Number(db.prepare("INSERT INTO contacts (type, name, email) VALUES ('customer', 'Textile Mills (Pvt) Ltd', 'purchase@textile-mills.com.pk')").run().lastInsertRowid);
  const id = addMessage(db, dir, { source: "email", message_id: "q1", from_addr: FROM, subject: "Quotation Required PR# 1510", body_text: WITH_HEADER, received_at: "2026-10-23 05:09:00" });
  await processMessage(db, dir, id);
  const m = db.prepare("SELECT * FROM inbox_messages WHERE id = ?").get(id);
  assert.equal(m.status, "ready");
  const x = JSON.parse(m.extraction);
  assert.equal(x.request, "rfq");
  assert.equal(x.party_match_id, cust, "matched by the customer's email domain");
  assert.equal(x.lines.length, 2);
  assert.ok(db.prepare("SELECT 1 FROM notifications WHERE title LIKE 'New RFQ to quote%'").get());
  assert.ok(!db.prepare("SELECT 1 FROM jobs").get(), "an RFQ never becomes a Job by itself");

  const again = addMessage(db, dir, { source: "email", message_id: "q2", from_addr: FROM, subject: "RE: Quotation Required PR# 1510", body_text: `REMINDER\n\nFrom: Buyer One\nSent: Friday\n\n${WITH_HEADER}`, received_at: "2026-10-24 05:09:00" });
  await processMessage(db, dir, again);
  const r = db.prepare("SELECT status, error FROM inbox_messages WHERE id = ?").get(again);
  assert.equal(r.status, "ignored");
  assert.match(r.error, new RegExp(`#${id}`));
  assert.ok(db.prepare("SELECT 1 FROM notifications WHERE title LIKE 'Reminder:%'").get(), "Sales hears the buyer is waiting");
});
