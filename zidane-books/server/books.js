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

// kind is a document kind or "job"
export function nextNumber(db, kind) {
  const prefixes = getSetting(db, "prefixes"), next = getSetting(db, "nextNumbers");
  let n = next[kind] || 1, number;
  do { number = `${prefixes[kind]}${String(n).padStart(5, "0")}`; n++; }
  while (kind === "job" ? db.prepare("SELECT 1 FROM jobs WHERE number = ?").get(number) : db.prepare("SELECT 1 FROM documents WHERE kind = ? AND number = ?").get(kind, number));
  setSetting(db, "nextNumbers", { ...next, [kind]: n });
  return number;
}

// Stock rules. A bill brings stock in. For Job orders the delivery challan takes it out (the invoice then
// doesn't, so nothing is counted twice); a direct sale invoice with no Job takes it out itself.
// Direct-delivery Jobs (supplier delivers straight to the customer) never touch the warehouse.
const STOCK_SIGN = { invoice: -1, bill: 1, dc: -1 };
function movesStock(db, doc) {
  if (!STOCK_SIGN[doc.kind]) return false;
  const job = doc.job_id ? db.prepare("SELECT fulfilment_type FROM jobs WHERE id = ?").get(doc.job_id) : null;
  if (job?.fulfilment_type === "direct") return false;
  if (doc.kind === "dc") return ["issued", "signed"].includes(doc.status);
  if (doc.kind === "invoice") return doc.status === "open" && !doc.job_id;
  return doc.status === "open";
}

function reverseStock(db, docId) {
  for (const m of db.prepare("SELECT item_id, qty FROM stock_moves WHERE document_id = ?").all(docId)) {
    db.prepare("UPDATE items SET stock_qty = stock_qty - ? WHERE id = ?").run(m.qty, m.item_id);
  }
  db.prepare("DELETE FROM stock_moves WHERE document_id = ?").run(docId);
}

function applyStock(db, doc, lines) {
  if (!movesStock(db, doc)) return;
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

export const KIND_STATUSES = {
  quote: ["enquiry", "draft", "sent", "accepted", "declined", "converted"],
  dc: ["draft", "issued", "signed", "void"],
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
      db.prepare(`UPDATE documents SET contact_id=?, date=?, due_date=?, status=?, notes=?, terms=?, reference=?, subtotal=?, discount_total=?, tax_total=?, total=?, job_id=? WHERE id=?`)
        .run(input.contact_id, input.date || today(), input.due_date || null, status, input.notes || null, input.terms || null, input.reference || null,
          calc.subtotal, calc.discount_total, calc.tax_total, calc.total, input.job_id === undefined ? doc.job_id : input.job_id || null, id);
      db.prepare("DELETE FROM document_lines WHERE document_id = ?").run(id);
    } else {
      const number = input.number?.trim() || nextNumber(db, kind);
      const r = db.prepare(`INSERT INTO documents (kind, number, contact_id, date, due_date, status, notes, terms, reference, subtotal, discount_total, tax_total, total, source_id, job_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(kind, number, input.contact_id, input.date || today(), input.due_date || null, status, input.notes || null, input.terms || null, input.reference || null,
          calc.subtotal, calc.discount_total, calc.tax_total, calc.total, input.source_id || null, input.job_id || null, userId ?? null);
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
  if (status === "void" && paidAmount(db, id) > 0) throw httpError(400, "Unapply the payments before voiding");
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
  if (paidAmount(db, id) > 0) throw httpError(400, "This document has payments applied. Unapply them first.");
  tx(db, () => {
    reverseStock(db, id);
    db.prepare("UPDATE documents SET source_id = NULL WHERE source_id = ?").run(id);
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    log(db, userId, "deleted", doc.kind, id, doc.number);
  });
}

// purchase order → supplier bill (quotes become Jobs, see jobs.js)
export function convertDocument(db, userId, id) {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!doc || doc.kind !== "po") throw httpError(400, "Only purchase orders can be converted to bills");
  const target = "bill";
  const lines = db.prepare("SELECT item_id, description, qty, rate, discount_pct, tax_rate FROM document_lines WHERE document_id = ?").all(id);
  const days = getSetting(db, "paymentTermsDays") || 0;
  const due = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  const newId = saveDocument(db, userId, { kind: target, contact_id: doc.contact_id, date: today(), due_date: due, status: "draft", notes: doc.notes, terms: doc.terms, reference: doc.number, source_id: doc.id, job_id: doc.job_id, lines });
  db.prepare("UPDATE documents SET status = 'billed' WHERE id = ?").run(id);
  return newId;
}

// SQL for "how much has been applied to document d" (use with a documents alias d)
export const PAID_SQL = "COALESCE((SELECT SUM(a.amount) FROM payment_allocations a WHERE a.document_id = d.id), 0)";
// SQL for "how much of payment p is still unused" (alias p)
export const UNUSED_SQL = "(p.amount - COALESCE((SELECT SUM(a.amount) FROM payment_allocations a WHERE a.payment_id = p.id), 0))";

export function paidAmount(db, docId) {
  return round2(db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM payment_allocations WHERE document_id = ?").get(docId).s);
}
export function unusedAmount(db, paymentId) {
  return round2(db.prepare(`SELECT ${UNUSED_SQL} AS v FROM payments p WHERE p.id = ?`).get(paymentId)?.v ?? 0);
}

// what the user sees: invoices/bills get paid / partial / overdue derived from payments and due date
export function displayStatus(doc, paid, on = today()) {
  if (!["invoice", "bill"].includes(doc.kind) || doc.status !== "open") return doc.status;
  const balance = round2(doc.total - paid);
  if (balance <= 0) return "paid";
  if (doc.due_date && doc.due_date < on) return "overdue";
  return paid > 0 ? "partial" : "open";
}

// checks one allocation and writes it; caller holds the transaction
function allocate(db, userId, payment, documentId, amount, date) {
  amount = round2(amount);
  if (!(amount > 0)) return;
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(documentId);
  if (!doc || !["invoice", "bill"].includes(doc.kind)) throw httpError(400, "Payments go against invoices or bills");
  if (doc.status !== "open") throw httpError(400, `${doc.number} isn't issued yet`);
  if (doc.contact_id !== payment.contact_id) throw httpError(400, `${doc.number} belongs to a different contact`);
  if ((doc.kind === "invoice") !== (payment.direction === "in")) throw httpError(400, "Customer receipts go against invoices, supplier payments against bills");
  const balance = round2(doc.total - paidAmount(db, doc.id));
  if (amount > balance + 0.001) throw httpError(400, `${doc.number} only has ${balance} due`);
  if (amount > unusedAmount(db, payment.id) + 0.001) throw httpError(400, `${payment.number} doesn't have that much left`);
  db.prepare("INSERT INTO payment_allocations (payment_id, document_id, amount, date, created_by) VALUES (?, ?, ?, ?, ?)").run(payment.id, doc.id, amount, date || today(), userId ?? null);
  log(db, userId, "applied payment", doc.kind, doc.id, `${payment.number} → ${doc.number} · ${amount}`);
}

// Record a receipt/payment. Allocate it with `allocations` [{document_id, amount}], or `document_id` (applies up to that
// document's balance). Anything left over stays on the contact as an advance / unused credit.
export function recordPayment(db, userId, p) {
  const amount = round2(p.amount);
  if (!(amount > 0)) throw httpError(400, "Amount must be more than zero");
  if (!["in", "out"].includes(p.direction)) throw httpError(400, "Direction must be in or out");
  return tx(db, () => {
    let contactId = p.contact_id;
    let allocations = p.allocations || [];
    if (p.document_id && !allocations.length) {
      const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(p.document_id);
      if (!doc) throw httpError(404, "Document not found");
      contactId = doc.contact_id;
      allocations = [{ document_id: doc.id, amount: Math.min(amount, round2(doc.total - paidAmount(db, doc.id))) }];
    }
    if (!contactId) throw httpError(400, "Contact is required");
    const totalAlloc = round2(allocations.reduce((a, x) => a + (Number(x.amount) || 0), 0));
    if (totalAlloc > amount + 0.001) throw httpError(400, "You've applied more than the payment amount");
    const number = nextNumber(db, p.direction === "in" ? "receipt" : "payment");
    const r = db.prepare("INSERT INTO payments (number, direction, contact_id, date, amount, mode, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(number, p.direction, contactId, p.date || today(), amount, p.mode || "cash", p.reference || null, p.notes || null, userId ?? null);
    const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(Number(r.lastInsertRowid));
    for (const a of allocations) allocate(db, userId, payment, a.document_id, a.amount, payment.date);
    const left = round2(amount - totalAlloc);
    log(db, userId, p.direction === "in" ? "received payment" : "paid supplier", "payment", payment.id, `${number} · ${amount}${left > 0 ? ` (${left} kept as advance)` : ""}`);
    return payment.id;
  });
}

// apply unused credits (advances) to one invoice/bill: credits = [{payment_id, amount}]
export function applyCredits(db, userId, documentId, credits) {
  if (!Array.isArray(credits) || credits.length === 0) throw httpError(400, "Choose at least one credit to apply");
  tx(db, () => {
    for (const c of credits) {
      const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(c.payment_id);
      if (!payment) throw httpError(404, "Payment not found");
      allocate(db, userId, payment, documentId, c.amount, today());
    }
  });
}

// apply one payment's unused amount across documents: allocations = [{document_id, amount}]
export function allocatePayment(db, userId, paymentId, allocations) {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);
  if (!payment) throw httpError(404, "Payment not found");
  tx(db, () => { for (const a of allocations || []) allocate(db, userId, payment, a.document_id, a.amount, today()); });
}

export function removeAllocation(db, userId, allocationId) {
  const a = db.prepare("SELECT a.*, p.number AS payment_number, d.number AS document_number, d.kind FROM payment_allocations a JOIN payments p ON p.id = a.payment_id JOIN documents d ON d.id = a.document_id WHERE a.id = ?").get(allocationId);
  if (!a) throw httpError(404, "Not found");
  db.prepare("DELETE FROM payment_allocations WHERE id = ?").run(allocationId);
  log(db, userId, "unapplied payment", a.kind, a.document_id, `${a.payment_number} ✕ ${a.document_number} · ${a.amount} back to credit`);
}

// a contact's unused payments (customer advances / supplier advances)
export function contactCredits(db, contactId) {
  return db.prepare(`SELECT p.*, ${UNUSED_SQL} AS unused FROM payments p WHERE p.contact_id = ? ORDER BY p.date, p.id`).all(contactId)
    .map((p) => ({ ...p, unused: round2(p.unused) })).filter((p) => p.unused > 0.001);
}

// Statement of account: running balance of what the customer owes us (or what we owe the supplier)
export function statement(db, contactId, from = "0000-01-01", to = "9999-12-31") {
  const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId);
  if (!c) throw httpError(404, "Not found");
  const docKind = c.type === "customer" ? "invoice" : "bill";
  const dir = c.type === "customer" ? "in" : "out";
  const docs = db.prepare("SELECT id, kind, number, date, due_date, total, reference FROM documents WHERE contact_id = ? AND kind = ? AND status = 'open'").all(contactId, docKind);
  const pays = db.prepare("SELECT id, number, date, amount, mode, reference FROM payments WHERE contact_id = ? AND direction = ?").all(contactId, dir);
  const entries = [
    ...docs.map((d) => ({ date: d.date, type: docKind, id: d.id, number: d.number, details: d.reference ? `Ref ${d.reference}` : d.due_date ? `Due ${d.due_date}` : "", charge: round2(d.total), payment: 0 })),
    ...pays.map((p) => ({ date: p.date, type: "payment", id: p.id, number: p.number, details: [p.mode, p.reference].filter(Boolean).join(" · "), charge: 0, payment: round2(p.amount) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.type === "payment") - (b.type === "payment"));
  let opening = round2(c.opening_balance || 0);
  for (const e of entries) if (e.date < from) opening = round2(opening + e.charge - e.payment);
  let bal = opening;
  const rows = entries.filter((e) => e.date >= from && e.date <= to).map((e) => ({ ...e, balance: (bal = round2(bal + e.charge - e.payment)) }));
  return { contact: { id: c.id, name: c.name, type: c.type, phone: c.phone, address: c.address }, from, to, opening, rows,
    charges: round2(rows.reduce((a, r) => a + r.charge, 0)), payments: round2(rows.reduce((a, r) => a + r.payment, 0)), closing: bal };
}

// own = false when the caller already holds a transaction (e.g. CSV import)
export function adjustStock(db, userId, itemId, qty, reason, own = true) {
  qty = Number(qty);
  if (!qty) throw httpError(400, "Quantity cannot be zero");
  (own ? (fn) => tx(db, fn) : (fn) => fn())(() => {
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
