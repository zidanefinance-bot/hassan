// Business rules: document totals, numbering, stock effects, balances and statuses.
import { tx } from "./db.js";

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const today = () => new Date().toISOString().slice(0, 10);

export function getSetting(db, key) {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return r ? JSON.parse(r.value) : undefined;
}
export function setSetting(db, key, value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));
}

export function log(db, userId, action, entity, entityId, summary) {
  db.prepare("INSERT INTO activity (user_id, action, entity, entity_id, summary) VALUES (?, ?, ?, ?, ?)").run(userId ?? null, action, entity, entityId ?? null, summary ?? null);
}

// line amount = qty × rate − discount; tax is on the discounted amount
export function computeLines(lines) {
  let subtotal = 0, discount = 0, tax = 0;
  const out = lines.map((l) => {
    const qty = Number(l.qty) || 0, rate = Number(l.rate) || 0, dp = Number(l.discount_pct) || 0, tr = Number(l.tax_rate) || 0;
    const gross = qty * rate;
    const disc = gross * (dp / 100);
    const amount = round2(gross - disc);
    subtotal += gross; discount += disc; tax += amount * (tr / 100);
    return { ...l, qty, rate, discount_pct: dp, tax_rate: tr, amount };
  });
  subtotal = round2(subtotal); discount = round2(discount); tax = round2(tax);
  return { lines: out, subtotal, discount_total: discount, tax_total: tax, total: round2(subtotal - discount + tax) };
}

export function nextNumber(db, kind) {
  const prefixes = getSetting(db, "prefixes"), next = getSetting(db, "nextNumbers");
  let n = next[kind] || 1, number;
  do { number = `${prefixes[kind]}${String(n).padStart(5, "0")}`; n++; }
  while (db.prepare("SELECT 1 FROM documents WHERE kind = ? AND number = ?").get(kind, number));
  setSetting(db, "nextNumbers", { ...next, [kind]: n });
  return number;
}

// statuses that move stock: an issued invoice takes stock out, an issued bill brings it in
const STOCK_SIGN = { invoice: -1, bill: 1 };
const MOVES_STOCK = (doc) => STOCK_SIGN[doc.kind] && doc.status === "open";

function reverseStock(db, docId) {
  for (const m of db.prepare("SELECT item_id, qty FROM stock_moves WHERE document_id = ?").all(docId)) {
    db.prepare("UPDATE items SET stock_qty = stock_qty - ? WHERE id = ?").run(m.qty, m.item_id);
  }
  db.prepare("DELETE FROM stock_moves WHERE document_id = ?").run(docId);
}

function applyStock(db, doc, lines) {
  if (!MOVES_STOCK(doc)) return;
  for (const l of lines) {
    if (!l.item_id) continue;
    const item = db.prepare("SELECT track_stock FROM items WHERE id = ?").get(l.item_id);
    if (!item?.track_stock) continue;
    const qty = STOCK_SIGN[doc.kind] * l.qty;
    db.prepare("INSERT INTO stock_moves (item_id, qty, reason, document_id, date) VALUES (?, ?, ?, ?, ?)").run(l.item_id, qty, `${doc.kind} ${doc.number}`, doc.id, doc.date);
    db.prepare("UPDATE items SET stock_qty = stock_qty + ? WHERE id = ?").run(qty, l.item_id);
    if (doc.kind === "bill") db.prepare("UPDATE items SET purchase_rate = ? WHERE id = ?").run(l.rate * (1 - l.discount_pct / 100), l.item_id); // last purchase cost
  }
}

const KIND_STATUSES = {
  quote: ["draft", "sent", "accepted", "declined", "invoiced"],
  invoice: ["draft", "open", "void"],
  po: ["draft", "issued", "billed", "cancelled"],
  bill: ["draft", "open", "void"],
};

// create or update a document with its lines (and stock effects) in one transaction
export function saveDocument(db, userId, input, id = null) {
  const kind = input.kind;
  if (!KIND_STATUSES[kind]) throw httpError(400, "Unknown document kind");
  if (!input.contact_id) throw httpError(400, "Contact is required");
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw httpError(400, "Add at least one line");
  const status = input.status || "draft";
  if (!KIND_STATUSES[kind].includes(status)) throw httpError(400, `Invalid status for ${kind}`);
  const calc = computeLines(input.lines);
  const isUpdate = Boolean(id);
  return tx(db, () => {
    let doc;
    if (id) {
      doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
      if (!doc) throw httpError(404, "Not found");
      if (doc.kind !== kind) throw httpError(400, "Kind cannot change");
      reverseStock(db, id);
      db.prepare(`UPDATE documents SET contact_id=?, date=?, due_date=?, status=?, notes=?, terms=?, reference=?, subtotal=?, discount_total=?, tax_total=?, total=? WHERE id=?`)
        .run(input.contact_id, input.date || today(), input.due_date || null, status, input.notes || null, input.terms || null, input.reference || null,
          calc.subtotal, calc.discount_total, calc.tax_total, calc.total, id);
      db.prepare("DELETE FROM document_lines WHERE document_id = ?").run(id);
    } else {
      const number = input.number?.trim() || nextNumber(db, kind);
      const r = db.prepare(`INSERT INTO documents (kind, number, contact_id, date, due_date, status, notes, terms, reference, subtotal, discount_total, tax_total, total, source_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(kind, number, input.contact_id, input.date || today(), input.due_date || null, status, input.notes || null, input.terms || null, input.reference || null,
          calc.subtotal, calc.discount_total, calc.tax_total, calc.total, input.source_id || null, userId ?? null);
      id = Number(r.lastInsertRowid);
    }
    for (const l of calc.lines) {
      const cost = kind === "invoice" && l.item_id ? db.prepare("SELECT purchase_rate FROM items WHERE id = ?").get(l.item_id)?.purchase_rate ?? 0 : 0;
      db.prepare("INSERT INTO document_lines (document_id, item_id, description, qty, rate, discount_pct, tax_rate, cost_rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, l.item_id || null, l.description || null, l.qty, l.rate, l.discount_pct, l.tax_rate, cost, l.amount);
    }
    doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
    applyStock(db, doc, calc.lines);
    log(db, userId, isUpdate ? "updated" : "created", kind, id, `${doc.number} · ${calc.total}`);
    return id;
  });
}

export function setStatus(db, userId, id, status) {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!doc) throw httpError(404, "Not found");
  if (!KIND_STATUSES[doc.kind].includes(status)) throw httpError(400, `Invalid status for ${doc.kind}`);
  if (status === "void" && paidAmount(db, id) > 0) throw httpError(400, "Delete the payments before voiding");
  return tx(db, () => {
    reverseStock(db, id);
    db.prepare("UPDATE documents SET status = ? WHERE id = ?").run(status, id);
    const lines = db.prepare("SELECT * FROM document_lines WHERE document_id = ?").all(id);
    applyStock(db, { ...doc, status }, lines);
    log(db, userId, `marked ${status}`, doc.kind, id, doc.number);
  });
}

export function deleteDocument(db, userId, id) {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!doc) throw httpError(404, "Not found");
  if (paidAmount(db, id) > 0) throw httpError(400, "This document has payments. Delete them first.");
  tx(db, () => {
    reverseStock(db, id);
    db.prepare("UPDATE documents SET source_id = NULL WHERE source_id = ?").run(id);
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    log(db, userId, "deleted", doc.kind, id, doc.number);
  });
}

// quote → invoice, po → bill
export function convertDocument(db, userId, id) {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!doc || !["quote", "po"].includes(doc.kind)) throw httpError(400, "Only quotes and purchase orders can be converted");
  const target = doc.kind === "quote" ? "invoice" : "bill";
  const lines = db.prepare("SELECT item_id, description, qty, rate, discount_pct, tax_rate FROM document_lines WHERE document_id = ?").all(id);
  const days = getSetting(db, "paymentTermsDays") || 0;
  const due = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  const newId = saveDocument(db, userId, { kind: target, contact_id: doc.contact_id, date: today(), due_date: due, status: "draft", notes: doc.notes, terms: doc.terms, reference: doc.number, source_id: doc.id, lines });
  db.prepare("UPDATE documents SET status = ? WHERE id = ?").run(doc.kind === "quote" ? "invoiced" : "billed", id);
  return newId;
}

export function paidAmount(db, docId) {
  return round2(db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE document_id = ?").get(docId).s);
}

// what the user sees: invoices/bills get paid / partial / overdue derived from payments and due date
export function displayStatus(doc, paid, on = today()) {
  if (!["invoice", "bill"].includes(doc.kind) || doc.status !== "open") return doc.status;
  const balance = round2(doc.total - paid);
  if (balance <= 0) return "paid";
  if (doc.due_date && doc.due_date < on) return "overdue";
  return paid > 0 ? "partial" : "open";
}

export function recordPayment(db, userId, p) {
  const amount = round2(p.amount);
  if (!(amount > 0)) throw httpError(400, "Amount must be more than zero");
  if (!["in", "out"].includes(p.direction)) throw httpError(400, "Direction must be in or out");
  return tx(db, () => {
    let contactId = p.contact_id;
    if (p.document_id) {
      const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(p.document_id);
      if (!doc || !["invoice", "bill"].includes(doc.kind)) throw httpError(400, "Payments go against invoices or bills");
      if (doc.status !== "open") throw httpError(400, "Issue the document before recording a payment");
      if ((doc.kind === "invoice") !== (p.direction === "in")) throw httpError(400, "Invoices receive money in, bills pay money out");
      const balance = round2(doc.total - paidAmount(db, doc.id));
      if (amount > balance + 0.001) throw httpError(400, `Amount is more than the balance due (${balance})`);
      contactId = doc.contact_id;
    }
    if (!contactId) throw httpError(400, "Contact is required");
    const r = db.prepare("INSERT INTO payments (direction, contact_id, document_id, date, amount, mode, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(p.direction, contactId, p.document_id || null, p.date || today(), amount, p.mode || "cash", p.reference || null, p.notes || null, userId ?? null);
    log(db, userId, "recorded payment", "payment", Number(r.lastInsertRowid), `${p.direction === "in" ? "received" : "paid"} ${amount}`);
    return Number(r.lastInsertRowid);
  });
}

export function adjustStock(db, userId, itemId, qty, reason) {
  qty = Number(qty);
  if (!qty) throw httpError(400, "Quantity cannot be zero");
  tx(db, () => {
    db.prepare("INSERT INTO stock_moves (item_id, qty, reason) VALUES (?, ?, ?)").run(itemId, qty, reason || "manual adjustment");
    db.prepare("UPDATE items SET stock_qty = stock_qty + ? WHERE id = ?").run(qty, itemId);
    log(db, userId, "adjusted stock", "item", itemId, `${qty > 0 ? "+" : ""}${qty} · ${reason || "manual"}`);
  });
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
