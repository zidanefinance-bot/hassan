// Business rules: document totals, numbering, stock effects, balances and statuses.
import { tx } from "./db.js";
import { moneyAccount } from "./ledger.js";

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

// document-level extras on top of the lines: a flat discount (after tax), delivery/other charges, and a round-off adjustment
export function computeTotals(lines, extra = {}) {
  const c = computeLines(lines);
  const doc_discount = round2(Math.max(0, Number(extra.doc_discount) || 0));
  const charges = round2(Math.max(0, Number(extra.charges) || 0));
  const adjustment = round2(Number(extra.adjustment) || 0);
  return { ...c, doc_discount, charges, adjustment, total: round2(c.total - doc_discount + charges + adjustment) };
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
const STOCK_SIGN = { invoice: -1, bill: 1, dc: -1, credit_note: 1, vendor_credit: -1 }; // returns: goods come back / go back
function movesStock(db, doc) {
  if (!STOCK_SIGN[doc.kind]) return false;
  const job = doc.job_id ? db.prepare("SELECT fulfilment_type FROM jobs WHERE id = ?").get(doc.job_id) : null;
  if (job?.fulfilment_type === "direct") return false;
  if (doc.kind === "dc") return ["issued", "signed"].includes(doc.status);
  if (doc.kind === "credit_note" || doc.kind === "vendor_credit") return doc.status === "open" && Boolean(doc.return_stock);
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
  credit_note: ["draft", "open", "void"],
  vendor_credit: ["draft", "open", "void"],
  invoice: ["draft", "open", "void"],
  po: ["draft", "issued", "billed", "cancelled"],
  bill: ["draft", "open", "void"],
};

// Which status may follow which. "signed" (DC), "converted" (quote → Job) and "billed" (PO → bill) are only set by
// their own actions. Going back from open/issued is allowed only while nothing is paid or applied against it.
const TRANSITIONS = {
  quote: { enquiry: ["draft", "sent", "declined"], draft: ["enquiry", "sent", "declined"], sent: ["draft", "accepted", "declined"], accepted: ["sent", "declined"], declined: ["draft"], converted: [] },
  dc: { draft: ["issued", "void"], issued: ["void"], signed: [], void: [] },
  invoice: { draft: ["open", "void"], open: ["draft", "void"], void: [] },
  bill: { draft: ["open", "void"], open: ["draft", "void"], void: [] },
  credit_note: { draft: ["open", "void"], open: ["draft", "void"], void: [] },
  vendor_credit: { draft: ["open", "void"], open: ["draft", "void"], void: [] },
  po: { draft: ["issued", "cancelled"], issued: ["draft", "cancelled"], billed: [], cancelled: ["draft"] },
};
export function checkTransition(db, doc, status, { admin = false } = {}) {
  if (status === doc.status) return;
  if (!KIND_STATUSES[doc.kind].includes(status)) throw httpError(400, `Invalid status for ${doc.kind}`);
  const ok = TRANSITIONS[doc.kind][doc.status]?.includes(status) || (admin && doc.status === "void" && status === "draft");
  if (!ok) throw httpError(400, `A ${doc.status} ${doc.kind.replace("_", " ")} can't be changed to ${status}`);
  if (doc.verified_at && !admin) throw httpError(403, "This document is verified by Accounts. Ask a director to change it.");
  if (["open", "issued"].includes(doc.status)) {
    if (paidAmount(db, doc.id) > 0) throw httpError(400, "Payments are applied to it. Unapply them first.");
    if (creditUsed(db, doc.id) > 0) throw httpError(400, "This credit has been applied or refunded. Undo that first.");
  }
}

// create or update a document with its lines (and stock effects) in one transaction
// a document's number can be set by hand (e.g. to match Zoho / a printed book): unique within its kind, and where other
// paperwork names it (a credit note's "against invoice #", an invoice's DC list) the new number follows
export function checkNumber(db, kind, number, id = 0) {
  const n = String(number || "").trim();
  if (!n) throw httpError(400, "The number can't be empty");
  if (n.length > 40) throw httpError(400, "That number is too long");
  const dup = db.prepare("SELECT 1 FROM documents WHERE kind = ? AND lower(number) = lower(?) AND id != ?").get(kind, n, id);
  if (dup) throw httpError(400, `${n} is already used by another ${kind.replace(/_/g, " ")}`);
  return n;
}
function renumber(db, userId, doc, number) {
  const n = checkNumber(db, doc.kind, number, doc.id);
  db.prepare("UPDATE documents SET number = ? WHERE id = ?").run(n, doc.id);
  db.prepare("UPDATE documents SET reference = ? WHERE reference = ? AND contact_id = ? AND id != ?").run(n, doc.number, doc.contact_id, doc.id);
  if (doc.kind === "dc") for (const inv of db.prepare("SELECT id, dc_numbers FROM documents WHERE kind = 'invoice' AND dc_numbers IS NOT NULL").all()) {
    const list = inv.dc_numbers.split(",").map((x) => x.trim());
    if (list.includes(doc.number)) db.prepare("UPDATE documents SET dc_numbers = ? WHERE id = ?").run(list.map((x) => (x === doc.number ? n : x)).join(", "), inv.id);
  }
  log(db, userId, "changed number", doc.kind, doc.id, `${doc.number} → ${n}`);
}

// A DC / invoice / quote made for a Job is for that Job's customer, and a DC carries only that Job's items, up to
// what is still to deliver. A DC that is invoiced (or a ration DC, counted in bags) keeps its customer and lines.
const lineKey = (l) => (l.item_id ? `i${Number(l.item_id)}` : `d${String(l.description || "").trim().toLowerCase()}`);
const sameLines = (a, b) => {
  const norm = (ls) => ls.filter((l) => l.item_id || l.description).map((l) => `${lineKey(l)}|${round2(Number(l.qty) || 0)}`).sort().join(";");
  return norm(a) === norm(b);
};
function dcInvoices(db, dc) {
  if (!dc.job_id) return [];
  return db.prepare("SELECT id, number, dc_numbers FROM documents WHERE job_id = ? AND kind = 'invoice' AND status IN ('open','draft')").all(dc.job_id)
    .filter((i) => (i.dc_numbers ? i.dc_numbers.split(",").map((x) => x.trim()).includes(dc.number) : i.id > dc.id)).map((i) => i.number);
}
function checkJobDocument(db, kind, input, existing, jobId) {
  const job = jobId ? db.prepare("SELECT id, number, customer_id, bags FROM jobs WHERE id = ?").get(jobId) : null;
  if (job && ["quote", "invoice", "dc", "credit_note"].includes(kind) && Number(input.contact_id) !== job.customer_id) {
    const name = db.prepare("SELECT name FROM contacts WHERE id = ?").get(job.customer_id)?.name;
    throw httpError(400, `This is for Job ${job.number}, so the customer must be ${name}. To deliver to someone else, make a new Job.`);
  }
  if (kind !== "dc") return;
  if (existing) {
    if (existing.job_id && Number(jobId || 0) !== existing.job_id) throw httpError(400, "A delivery challan can't move to another Job");
    const before = db.prepare("SELECT item_id, description, qty FROM document_lines WHERE document_id = ?").all(existing.id);
    const changed = Number(input.contact_id) !== existing.contact_id || !sameLines(before, input.lines);
    const inv = changed && existing.status !== "draft" ? dcInvoices(db, existing) : [];
    if (inv.length) throw httpError(400, `${existing.number} is already invoiced (${inv.join(", ")}), so its customer and items can't change. Fix it with a credit note, or change the invoice first.`);
    if (changed && existing.bags > 0) throw httpError(400, `${existing.number} is counted in bags. To change it, delete it and make the DC again from the Job.`);
    if (!changed) return;
  }
  if (!job || job.bags > 0) return; // ration DCs are made from the Job in bags (checked there)
  const items = db.prepare("SELECT ji.item_id, ji.description, ji.qty, COALESCE(i.name, ji.description) AS name, i.unit FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE ji.job_id = ?").all(job.id);
  const onJob = new Map();
  for (const i of items) { const k = lineKey(i); const x = onJob.get(k) || { qty: 0, name: i.name, unit: i.unit || "" }; x.qty += i.qty; onJob.set(k, x); }
  const sent = new Map();
  for (const l of db.prepare("SELECT l.item_id, l.description, l.qty FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE d.job_id = ? AND d.kind = 'dc' AND d.status IN ('issued','signed') AND d.id != ?").all(job.id, existing?.id || 0))
    sent.set(lineKey(l), (sent.get(lineKey(l)) || 0) + l.qty);
  const want = new Map();
  for (const l of input.lines.filter((x) => x.item_id || x.description)) {
    const k = lineKey(l);
    if (!onJob.has(k)) {
      const name = l.item_id ? db.prepare("SELECT name FROM items WHERE id = ?").get(Number(l.item_id))?.name : l.description;
      throw httpError(400, `${name || "This item"} isn't on Job ${job.number}. A DC can only carry the Job's items. Add it to the Job first.`);
    }
    want.set(k, (want.get(k) || 0) + (Number(l.qty) || 0));
  }
  for (const [k, q] of want) {
    const x = onJob.get(k), left = round2(x.qty - (sent.get(k) || 0));
    if (q > left + 0.001) throw httpError(400, `${x.name}: only ${Math.max(0, left)} ${x.unit} left to deliver on Job ${job.number} (ordered ${round2(x.qty)}), not ${round2(q)}.`);
  }
}

export function saveDocument(db, userId, input, id = null) {
  const kind = input.kind;
  if (!KIND_STATUSES[kind]) throw httpError(400, "Unknown document kind");
  if (!input.contact_id) throw httpError(400, "Contact is required");
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw httpError(400, "Add at least one line");
  const existing = id ? db.prepare("SELECT * FROM documents WHERE id = ?").get(id) : null;
  // an update without a status keeps the current one (it must never quietly turn an issued document into a draft)
  const status = input.status || existing?.status || "draft";
  if (!KIND_STATUSES[kind].includes(status)) throw httpError(400, `Invalid status for ${kind}`);
  if (!existing && ["signed", "converted", "billed"].includes(status)) throw httpError(400, `A new ${kind} can't start as ${status}`);
  if (existing) {
    if (existing.kind === "quote" && existing.status === "converted") throw httpError(400, "This quote is already a Job. Change the Job instead.");
    if (existing.kind === "dc" && existing.status === "signed") throw httpError(400, "The customer has signed this delivery challan. It can't be changed.");
    if (existing.kind === "po" && existing.status === "billed") throw httpError(400, "This purchase order is already billed. Change the bill instead.");
    if (status !== existing.status) checkTransition(db, existing, status, { admin: input._admin });
    if (Number(input.contact_id) !== existing.contact_id && (paidAmount(db, id) > 0 || creditUsed(db, id) > 0)) throw httpError(400, "Payments or credits are applied to it, so the customer/supplier can't change");
  }
  const jobId = input.job_id === undefined ? existing?.job_id : input.job_id || null;
  if (jobId && jobId !== existing?.job_id && db.prepare("SELECT closed FROM jobs WHERE id = ?").get(jobId)?.closed) throw httpError(400, "That Job is closed");
  checkJobDocument(db, kind, input, existing, jobId ? Number(jobId) : null);
  if (kind === "bill" && input.reference?.trim()) {
    const dup = db.prepare("SELECT number FROM documents WHERE kind = 'bill' AND contact_id = ? AND lower(trim(reference)) = lower(trim(?)) AND status != 'void' AND id != ?").get(input.contact_id, input.reference, id || 0);
    if (dup) throw httpError(400, `This supplier's bill # ${input.reference.trim()} is already recorded as ${dup.number}`);
  }
  const calc = computeTotals(input.lines, input);
  const isUpdate = Boolean(id);
  const returnStock = input.return_stock === false || input.return_stock === 0 ? 0 : 1;
  return tx(db, () => {
    let doc;
    if (id) {
      doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
      if (!doc) throw httpError(404, "Not found");
      if (doc.kind !== kind) throw httpError(400, "Kind cannot change");
      reverseStock(db, id);
      if (["credit_note", "vendor_credit"].includes(kind) && creditUsed(db, id) > calc.total + 0.001) throw httpError(400, "This credit is already applied or refunded for more than the new total");
      db.prepare(`UPDATE documents SET contact_id=?, date=?, due_date=?, status=?, notes=?, terms=?, reference=?, subtotal=?, discount_total=?, tax_total=?, total=?, job_id=?,
        doc_discount=?, charges=?, charges_label=?, adjustment=?, return_stock=? WHERE id=?`)
        .run(input.contact_id, input.date || today(), input.due_date || null, status, input.notes || null, input.terms || null, input.reference || null,
          calc.subtotal, calc.discount_total, calc.tax_total, calc.total, input.job_id === undefined ? doc.job_id : input.job_id || null,
          calc.doc_discount, calc.charges, input.charges_label || null, calc.adjustment, returnStock, id);
      db.prepare("DELETE FROM document_lines WHERE document_id = ?").run(id);
      if (input.number && String(input.number).trim() !== doc.number) renumber(db, userId, doc, input.number);
    } else {
      const number = input.number?.trim() ? checkNumber(db, kind, input.number) : nextNumber(db, kind);
      const r = db.prepare(`INSERT INTO documents (kind, number, contact_id, date, due_date, status, notes, terms, reference, subtotal, discount_total, tax_total, total, source_id, job_id,
        doc_discount, charges, charges_label, adjustment, return_stock, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(kind, number, input.contact_id, input.date || today(), input.due_date || null, status, input.notes || null, input.terms || null, input.reference || null,
          calc.subtotal, calc.discount_total, calc.tax_total, calc.total, input.source_id || null, input.job_id || null,
          calc.doc_discount, calc.charges, input.charges_label || null, calc.adjustment, returnStock, userId ?? null);
      id = Number(r.lastInsertRowid);
    }
    for (const l of calc.lines) {
      // cost of what's sold (and of what a credit note brings back), for profit
      const cost = (kind === "invoice" || kind === "credit_note") && l.item_id ? db.prepare("SELECT purchase_rate FROM items WHERE id = ?").get(l.item_id)?.purchase_rate ?? 0 : 0;
      // purchases: a line may be for its own Job (else the bill's Job, else stock)
      const lineJob = ["bill", "po", "vendor_credit"].includes(kind) && Number(l.job_id) && Number(l.job_id) !== Number(input.job_id) ? Number(l.job_id) : null;
      db.prepare("INSERT INTO document_lines (document_id, item_id, description, qty, rate, discount_pct, tax_rate, cost_rate, amount, job_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, l.item_id || null, l.description || null, l.qty, l.rate, l.discount_pct, l.tax_rate, cost, l.amount, lineJob);
    }
    doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
    applyStock(db, doc, calc.lines);
    log(db, userId, isUpdate ? "updated" : "created", kind, id, `${doc.number} · ${calc.total}`);
    // the DCs an invoice bills, as typed on the invoice (several are fine: "DC-00012, DC-00013")
    if (kind === "invoice" && input.dc_numbers !== undefined) db.prepare("UPDATE documents SET dc_numbers = ? WHERE id = ?").run(String(input.dc_numbers || "").split(/[,\n]+/).map((x) => x.trim()).filter(Boolean).join(", ") || null, id);
    return id;
  });
}

export function setStatus(db, userId, id, status, { admin = false } = {}) {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!doc) throw httpError(404, "Not found");
  if (status === doc.status) return;
  checkTransition(db, doc, status, { admin });
  return tx(db, () => {
    reverseStock(db, id);
    db.prepare("UPDATE documents SET status = ? WHERE id = ?").run(status, id);
    if (status === "draft" || status === "void") db.prepare("UPDATE documents SET verified_at = NULL, verified_by = NULL WHERE id = ?").run(id);
    const lines = db.prepare("SELECT * FROM document_lines WHERE document_id = ?").all(id);
    applyStock(db, { ...doc, status }, lines);
    log(db, userId, `marked ${status}`, doc.kind, id, doc.number);
  });
}

export function deleteDocument(db, userId, id) {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!doc) throw httpError(404, "Not found");
  if (paidAmount(db, id) > 0) throw httpError(400, "This document has payments applied. Unapply them first.");
  if (creditUsed(db, id) > 0) throw httpError(400, "This credit has been applied or refunded. Undo that first.");
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
  if (doc.status !== "issued") throw httpError(400, doc.status === "billed" ? "This purchase order is already billed" : "Issue the purchase order before turning it into a bill");
  const child = db.prepare("SELECT number FROM documents WHERE source_id = ? AND kind = 'bill' AND status != 'void'").get(id);
  if (child) throw httpError(400, `Already billed as ${child.number}`);
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
// SQL for "how much of payment p is still unused" (alias p): not applied and not refunded
// a payment settles its cash plus any tax the customer (or we) withheld at source
export const UNUSED_SQL = "(p.amount + p.wht_income + p.wht_sales - COALESCE((SELECT SUM(a.amount) FROM payment_allocations a WHERE a.payment_id = p.id), 0) - COALESCE((SELECT SUM(r.amount) FROM refunds r WHERE r.payment_id = p.id), 0))";
// SQL for "how much of credit note / vendor credit d is still unused" (alias d)
export const CREDIT_UNUSED_SQL = "(d.total - COALESCE((SELECT SUM(a.amount) FROM payment_allocations a WHERE a.credit_id = d.id), 0) - COALESCE((SELECT SUM(r.amount) FROM refunds r WHERE r.credit_id = d.id), 0))";
export const CREDIT_KINDS = { credit_note: "in", vendor_credit: "out" }; // which side of the business each credit belongs to

export function paidAmount(db, docId) {
  return round2(db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM payment_allocations WHERE document_id = ?").get(docId).s);
}
export function unusedAmount(db, paymentId) {
  return round2(db.prepare(`SELECT ${UNUSED_SQL} AS v FROM payments p WHERE p.id = ?`).get(paymentId)?.v ?? 0);
}
export function creditUsed(db, creditId) {
  return round2(db.prepare("SELECT COALESCE((SELECT SUM(amount) FROM payment_allocations WHERE credit_id = ?), 0) + COALESCE((SELECT SUM(amount) FROM refunds WHERE credit_id = ?), 0) AS v").get(creditId, creditId).v);
}
export function creditUnused(db, creditId) {
  return round2(db.prepare(`SELECT ${CREDIT_UNUSED_SQL} AS v FROM documents d WHERE d.id = ?`).get(creditId)?.v ?? 0);
}

// a credit source is a payment (advance) or an issued credit note / vendor credit
function loadSource(db, src) {
  if (src.payment_id) {
    const p = db.prepare("SELECT * FROM payments WHERE id = ?").get(src.payment_id);
    if (!p) throw httpError(404, "Payment not found");
    return { type: "payment", id: p.id, number: p.number, contact_id: p.contact_id, direction: p.direction, unused: () => unusedAmount(db, p.id), col: "payment_id" };
  }
  const d = db.prepare("SELECT * FROM documents WHERE id = ?").get(src.credit_id);
  if (!d || !CREDIT_KINDS[d.kind]) throw httpError(404, "Credit not found");
  if (d.status !== "open") throw httpError(400, `${d.number} isn't issued`);
  return { type: "credit", id: d.id, number: d.number, contact_id: d.contact_id, direction: CREDIT_KINDS[d.kind], unused: () => creditUnused(db, d.id), col: "credit_id" };
}

// checks one allocation and writes it; caller holds the transaction
function allocate(db, userId, source, documentId, amount, date) {
  amount = round2(amount);
  if (!(amount > 0)) return;
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(documentId);
  if (!doc || !["invoice", "bill"].includes(doc.kind)) throw httpError(400, "Payments and credits go against invoices or bills");
  if (doc.status !== "open") throw httpError(400, `${doc.number} isn't issued yet`);
  if (doc.contact_id !== source.contact_id) throw httpError(400, `${doc.number} belongs to a different contact`);
  if ((doc.kind === "invoice") !== (source.direction === "in")) throw httpError(400, "Customer receipts and credit notes go against invoices; supplier payments and vendor credits against bills");
  const balance = round2(doc.total - paidAmount(db, doc.id));
  if (amount > balance + 0.001) throw httpError(400, `${doc.number} only has ${balance} due`);
  if (amount > source.unused() + 0.001) throw httpError(400, `${source.number} doesn't have that much left`);
  db.prepare(`INSERT INTO payment_allocations (${source.col}, document_id, amount, date, created_by) VALUES (?, ?, ?, ?, ?)`).run(source.id, doc.id, amount, date || today(), userId ?? null);
  log(db, userId, source.type === "credit" ? "applied credit" : "applied payment", doc.kind, doc.id, `${source.number} → ${doc.number} · ${amount}`);
}

// Record a receipt/payment. Allocate it with `allocations` [{document_id, amount}], or `document_id` (applies up to that
// document's balance). Anything left over stays on the contact as an advance / unused credit.
export function recordPayment(db, userId, p) {
  const amount = round2(Number(p.amount) || 0);
  const whtIncome = round2(Number(p.wht_income) || 0), whtSales = round2(Number(p.wht_sales) || 0);
  if (amount < 0 || whtIncome < 0 || whtSales < 0) throw httpError(400, "Amounts can't be negative");
  const settled = round2(amount + whtIncome + whtSales);
  // tax only (amount 0) is fine: the cash came earlier, the withholding certificate now
  if (!(settled > 0)) throw httpError(400, "Amount must be more than zero");
  if (!["in", "out"].includes(p.direction)) throw httpError(400, "Direction must be in or out");
  return tx(db, () => {
    let contactId = p.contact_id;
    let allocations = p.allocations || [];
    if (p.document_id && !allocations.length) {
      const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(p.document_id);
      if (!doc) throw httpError(404, "Document not found");
      contactId = doc.contact_id;
      allocations = [{ document_id: doc.id, amount: Math.min(settled, round2(doc.total - paidAmount(db, doc.id))) }];
    }
    if (!contactId) throw httpError(400, "Contact is required");
    const totalAlloc = round2(allocations.reduce((a, x) => a + (Number(x.amount) || 0), 0));
    if (totalAlloc > settled + 0.001) throw httpError(400, "You've applied more than the payment amount (plus tax withheld)");
    const number = nextNumber(db, p.direction === "in" ? "receipt" : "payment");
    const r = db.prepare("INSERT INTO payments (number, direction, contact_id, date, amount, mode, reference, notes, created_by, wht_income, wht_sales, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(number, p.direction, contactId, p.date || today(), amount, p.mode || "cash", p.reference || null, p.notes || null, userId ?? null, whtIncome, whtSales, moneyAccount(db, p.account_id, p.mode || "cash"));
    const id = Number(r.lastInsertRowid);
    const source = loadSource(db, { payment_id: id });
    for (const a of allocations) allocate(db, userId, source, a.document_id, a.amount, p.date || today());
    const left = round2(settled - totalAlloc);
    log(db, userId, p.direction === "in" ? "received payment" : "paid supplier", "payment", id, `${number} · ${amount}${settled > amount ? ` + ${round2(settled - amount)} tax withheld` : ""}${left > 0 ? ` (${left} kept as advance)` : ""}`);
    return id;
  });
}

// apply unused advances and credit notes to one invoice/bill: credits = [{payment_id | credit_id, amount}]
export function applyCredits(db, userId, documentId, credits) {
  if (!Array.isArray(credits) || credits.length === 0) throw httpError(400, "Choose at least one credit to apply");
  tx(db, () => { for (const c of credits) allocate(db, userId, loadSource(db, c), documentId, c.amount, today()); });
}

// spread one payment's or credit's unused amount across documents: allocations = [{document_id, amount}]
export function allocatePayment(db, userId, paymentId, allocations) {
  const source = loadSource(db, { payment_id: paymentId });
  tx(db, () => { for (const a of allocations || []) allocate(db, userId, source, a.document_id, a.amount, today()); });
}
export function allocateCredit(db, userId, creditId, allocations) {
  const source = loadSource(db, { credit_id: creditId });
  tx(db, () => { for (const a of allocations || []) allocate(db, userId, source, a.document_id, a.amount, today()); });
}

export function removeAllocation(db, userId, allocationId) {
  const a = db.prepare(`SELECT a.*, COALESCE(p.number, c.number) AS source_number, d.number AS document_number, d.kind FROM payment_allocations a
    LEFT JOIN payments p ON p.id = a.payment_id LEFT JOIN documents c ON c.id = a.credit_id JOIN documents d ON d.id = a.document_id WHERE a.id = ?`).get(allocationId);
  if (!a) throw httpError(404, "Not found");
  db.prepare("DELETE FROM payment_allocations WHERE id = ?").run(allocationId);
  log(db, userId, "unapplied", a.kind, a.document_id, `${a.source_number} ✕ ${a.document_number} · ${a.amount} back to credit`);
}

// give back an unused advance or credit: {payment_id | credit_id, amount, date, mode, reference}
export function recordRefund(db, userId, input) {
  const amount = round2(input.amount);
  if (!(amount > 0)) throw httpError(400, "Amount must be more than zero");
  return tx(db, () => {
    const source = loadSource(db, input);
    if (amount > source.unused() + 0.001) throw httpError(400, `${source.number} only has ${source.unused()} unused`);
    const number = nextNumber(db, "refund");
    const r = db.prepare(`INSERT INTO refunds (number, contact_id, ${source.col}, date, amount, mode, reference, notes, created_by, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(number, source.contact_id, source.id, input.date || today(), amount, input.mode || "bank", input.reference || null, input.notes || null, userId ?? null, moneyAccount(db, input.account_id, input.mode || "bank"));
    log(db, userId, "refunded", "refund", Number(r.lastInsertRowid), `${number} · ${amount} from ${source.number}`);
    return Number(r.lastInsertRowid);
  });
}
export function deleteRefund(db, userId, id) {
  const r = db.prepare("SELECT * FROM refunds WHERE id = ?").get(id);
  if (!r) throw httpError(404, "Not found");
  db.prepare("DELETE FROM refunds WHERE id = ?").run(id);
  log(db, userId, "deleted refund", "refund", id, `${r.number} · ${r.amount}`);
}

// a contact's unused advances and credit notes, as one list
export function contactCredits(db, contactId) {
  const pays = db.prepare(`SELECT p.id, p.number, p.date, p.direction, p.mode, p.reference, ${UNUSED_SQL} AS unused FROM payments p WHERE p.contact_id = ?`).all(contactId)
    .map((p) => ({ ...p, source: "payment", label: "Advance" }));
  const credits = db.prepare(`SELECT d.id, d.number, d.date, d.kind, d.reference, ${CREDIT_UNUSED_SQL} AS unused FROM documents d WHERE d.contact_id = ? AND d.kind IN ('credit_note','vendor_credit') AND d.status = 'open'`).all(contactId)
    .map((d) => ({ ...d, source: "credit", direction: CREDIT_KINDS[d.kind], label: d.kind === "credit_note" ? "Credit note" : "Vendor credit" }));
  return [...pays, ...credits].map((c) => ({ ...c, unused: round2(c.unused) })).filter((c) => c.unused > 0.001).sort((a, b) => a.date.localeCompare(b.date));
}

// Statement of account: running balance of what the customer owes us (or what we owe the supplier)
export function statement(db, contactId, from = "0000-01-01", to = "9999-12-31") {
  const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId);
  if (!c) throw httpError(404, "Not found");
  const cust = c.type === "customer";
  const docKind = cust ? "invoice" : "bill", creditKind = cust ? "credit_note" : "vendor_credit", dir = cust ? "in" : "out";
  const docs = db.prepare("SELECT id, kind, number, date, due_date, total, reference FROM documents WHERE contact_id = ? AND kind IN (?, ?) AND status = 'open'").all(contactId, docKind, creditKind);
  const pays = db.prepare("SELECT id, number, date, amount, wht_income, wht_sales, mode, reference FROM payments WHERE contact_id = ? AND direction = ?").all(contactId, dir);
  const refunds = db.prepare("SELECT id, number, date, amount, mode, reference, payment_id, credit_id FROM refunds WHERE contact_id = ?").all(contactId);
  const entries = [
    ...docs.map((d) => d.kind === creditKind
      ? { date: d.date, type: d.kind, id: d.id, number: d.number, details: cust ? "Credit note" : "Vendor credit", charge: 0, payment: round2(d.total) }
      : { date: d.date, type: d.kind, id: d.id, number: d.number, details: d.reference ? `Ref ${d.reference}` : d.due_date ? `Due ${d.due_date}` : "", charge: round2(d.total), payment: 0 }),
    ...pays.map((p) => ({ date: p.date, type: "payment", id: p.id, number: p.number, details: [p.mode, p.reference, p.wht_income + p.wht_sales > 0 && `incl. tax withheld Rs ${round2(p.wht_income + p.wht_sales)}`].filter(Boolean).join(" · "), charge: 0, payment: round2(p.amount + p.wht_income + p.wht_sales) })),
    ...refunds.map((r) => ({ date: r.date, type: "refund", id: r.payment_id || r.credit_id, source: r.payment_id ? "payment" : "credit", number: r.number, details: `Refund · ${r.mode}${r.reference ? ` · ${r.reference}` : ""}`, charge: round2(r.amount), payment: 0 })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.payment > 0) - (b.payment > 0));
  let opening = round2(c.opening_balance || 0);
  for (const e of entries) if (e.date < from) opening = round2(opening + e.charge - e.payment);
  let bal = opening;
  const rows = entries.filter((e) => e.date >= from && e.date <= to).map((e) => ({ ...e, balance: (bal = round2(bal + e.charge - e.payment)) }));
  return { contact: { id: c.id, name: c.name, type: c.type, phone: c.phone, address: c.address }, from, to, opening, rows,
    charges: round2(rows.reduce((a, r) => a + r.charge, 0)), payments: round2(rows.reduce((a, r) => a + r.payment, 0)),
    // returns / credit notes are not money paid: shown on their own
    credits: round2(rows.filter((r) => r.type === creditKind).reduce((a, r) => a + r.payment, 0)), closing: bal };
}

// copy a document as a new draft (same contact, lines, notes and extras), dated today
export function cloneDocument(db, userId, id) {
  const d = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!d) throw httpError(404, "Not found");
  const lines = db.prepare("SELECT item_id, description, qty, rate, discount_pct, tax_rate FROM document_lines WHERE document_id = ?").all(id);
  const c = db.prepare("SELECT payment_terms_days FROM contacts WHERE id = ?").get(d.contact_id);
  const days = c?.payment_terms_days ?? getSetting(db, "paymentTermsDays") ?? 0;
  const newId = saveDocument(db, userId, { kind: d.kind, contact_id: d.contact_id, status: d.kind === "quote" ? "draft" : "draft", date: today(),
    due_date: ["invoice", "bill"].includes(d.kind) ? new Date(Date.now() + days * 864e5).toISOString().slice(0, 10) : null,
    notes: d.notes, terms: d.terms, doc_discount: d.doc_discount, charges: d.charges, charges_label: d.charges_label, adjustment: d.adjustment, return_stock: d.return_stock, lines,
  });
  if (d.bags > 0) db.prepare("UPDATE documents SET bags = ?, kit_name = ?, show_as = ? WHERE id = ?").run(d.bags, d.kit_name, d.show_as, newId);
  return newId;
}

// credit limit check for a customer: what they owe now against their limit
export function creditStatus(db, contactId, extra = 0) {
  const c = db.prepare("SELECT credit_limit, opening_balance FROM contacts WHERE id = ?").get(contactId);
  if (!c || !c.credit_limit) return null;
  const owed = round2((c.opening_balance || 0) + db.prepare(`SELECT COALESCE(SUM(d.total - ${PAID_SQL}), 0) AS v FROM documents d WHERE d.contact_id = ? AND d.kind = 'invoice' AND d.status = 'open'`).get(contactId).v);
  return { limit: c.credit_limit, owed, after: round2(owed + extra), over: round2(owed + extra) > c.credit_limit };
}

// what the user sees: invoices/bills get paid / partial / overdue derived from payments and due date
export function displayStatus(doc, paid, on = today(), creditLeft = null) {
  if (CREDIT_KINDS[doc.kind] && doc.status === "open" && creditLeft !== null) return creditLeft <= 0.001 ? "closed" : creditLeft < doc.total ? "partial" : "open";
  if (!["invoice", "bill"].includes(doc.kind) || doc.status !== "open") return doc.status;
  const balance = round2(doc.total - paid);
  if (balance <= 0) return "paid";
  if (doc.due_date && doc.due_date < on) return "overdue";
  return paid > 0 ? "partial" : "open";
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
