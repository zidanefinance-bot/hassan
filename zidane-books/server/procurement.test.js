import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { openDb } from "./db.js";
import * as B from "./books.js";
import * as J from "./jobs.js";
import { procurementXlsx } from "./exports.js";
import { ensureAdmin, seedDemo } from "./seed.js";

test("what to buy shows which lines are on a PO; a cancelled PO puts them back", async () => {
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const line = J.procurementList(db).flatMap((g) => g.jobs.map((j) => ({ ...j, item_id: g.item_id }))).find((j) => j.item_id && j.qty >= 2);
  assert.ok(line, "the demo has an item to buy");
  assert.equal(line.po_qty, 0);
  assert.equal(line.not_ordered, line.qty);
  const supplier = db.prepare("SELECT id FROM contacts WHERE type = 'supplier' LIMIT 1").get().id;
  const half = Math.floor(line.qty / 2);
  const po = B.saveDocument(db, 1, { kind: "po", contact_id: supplier, job_id: line.job_id, status: "issued", lines: [{ item_id: line.item_id, qty: half, rate: 10 }] });
  const find = () => J.procurementList(db).flatMap((g) => g.jobs).find((j) => j.job_item_id === line.job_item_id);
  let now = find();
  assert.equal(now.po_qty, half);
  assert.equal(now.not_ordered, line.qty - half);
  assert.deepEqual(now.pos.map((p) => p.id), [po]);

  // the Excel: a PO status column to filter on
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await procurementXlsx(db, { name: "Ops" })).buffer);
  const ws = wb.getWorksheet("What to buy");
  const head = ws.getRow(4).values;
  const row = [...Array(ws.rowCount).keys()].map((i) => ws.getRow(i + 1)).find((r) => r.getCell(head.indexOf("PO #")).value === db.prepare("SELECT number FROM documents WHERE id = ?").get(po).number);
  assert.ok(row, "the PO number is on the line");
  assert.equal(row.getCell(head.indexOf("PO status")).value, "Partly on PO");
  assert.equal(row.getCell(head.indexOf("Not on PO yet")).value, line.qty - half);

  // cancelled: no longer counts, the line is back to "not on PO yet"; it can be opened again
  B.setStatus(db, 1, po, "cancelled");
  now = find();
  assert.equal(now.po_qty, 0);
  assert.equal(now.pos.length, 0);
  B.setStatus(db, 1, po, "draft");
  assert.equal(find().po_qty, half, "a draft PO counts as ordered-to-be");
});
