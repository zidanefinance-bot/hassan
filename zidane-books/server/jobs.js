// Internal Jobs: the bridge between Sales and Operations.
// Sales creates the Job from customer demand; Operations fulfils it (procurement, purchases, supplier bills,
// direct costs, fulfilment status); Sales then raises the customer DC and invoice from it.
import { tx } from "./db.js";
import { getSetting, httpError, log, nextNumber, round2, saveDocument, today } from "./books.js";

export const OPS_STATUSES = ["new", "procurement_started", "partially_purchased", "purchase_complete", "material_ready", "dispatched", "delivered"];
export const PROCUREMENT_STATUSES = ["to_buy", "partial", "bought", "not_available", "from_stock"];
const ACTIVE = "j.closed = 0";

export function createJob(db, userId, input) {
  const items = (input.items || []).filter((i) => i.item_id || i.description);
  if (!input.customer_id) throw httpError(400, "Customer is required");
  if (items.length === 0) throw httpError(400, "Add at least one item");
  return tx(db, () => {
    const number = nextNumber(db, "job");
    const r = db.prepare(`INSERT INTO jobs (number, customer_id, quote_id, customer_po_number, customer_po_date, order_source, required_date, delivery_location, priority, fulfilment_type, instructions, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(number, input.customer_id, input.quote_id || null, input.customer_po_number || null, input.customer_po_date || null,
      input.order_source || "call", input.required_date || null, input.delivery_location || null, input.priority || "normal", input.fulfilment_type === "direct" ? "direct" : "stock", input.instructions || null, userId ?? null);
    const id = Number(r.lastInsertRowid);
    for (const i of items) {
      db.prepare("INSERT INTO job_items (job_id, item_id, description, qty, sale_rate, tax_rate) VALUES (?, ?, ?, ?, ?, ?)").run(id, i.item_id || null, i.description || null, Number(i.qty) || 0, Number(i.sale_rate ?? i.rate) || 0, Number(i.tax_rate) || 0);
    }
    if (input.quote_id) db.prepare("UPDATE documents SET status = 'converted', job_id = ? WHERE id = ? AND kind = 'quote'").run(id, input.quote_id);
    log(db, userId, "created job", "job", id, `${number}`);
    return id;
  });
}

export function jobFromQuote(db, userId, quoteId, extra = {}) {
  const q = db.prepare("SELECT * FROM documents WHERE id = ? AND kind = 'quote'").get(quoteId);
  if (!q) throw httpError(404, "Quote not found");
  if (q.status === "converted") throw httpError(400, "A Job already exists for this quote");
  const lines = db.prepare("SELECT item_id, description, qty, rate AS sale_rate, tax_rate, discount_pct FROM document_lines WHERE document_id = ?").all(q.id)
    .map((l) => ({ ...l, sale_rate: round2(l.sale_rate * (1 - l.discount_pct / 100)) }));
  return createJob(db, userId, { customer_id: q.contact_id, quote_id: q.id, items: lines, instructions: q.notes, ...extra });
}

export function setOpsStatus(db, userId, id, status) {
  if (!OPS_STATUSES.includes(status)) throw httpError(400, "Unknown fulfilment status");
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) throw httpError(404, "Job not found");
  db.prepare("UPDATE jobs SET ops_status = ? WHERE id = ?").run(status, id);
  log(db, userId, `marked ${status.replace(/_/g, " ")}`, "job", id, job.number);
}

export function setItemProcurement(db, userId, jobItemId, status) {
  if (!PROCUREMENT_STATUSES.includes(status)) throw httpError(400, "Unknown procurement status");
  const it = db.prepare("SELECT ji.*, j.number, j.ops_status FROM job_items ji JOIN jobs j ON j.id = ji.job_id WHERE ji.id = ?").get(jobItemId);
  if (!it) throw httpError(404, "Not found");
  tx(db, () => {
    db.prepare("UPDATE job_items SET procurement_status = ? WHERE id = ?").run(status, jobItemId);
    // keep the Job's fulfilment status in step with its lines until material is ready
    if (OPS_STATUSES.indexOf(it.ops_status) < OPS_STATUSES.indexOf("material_ready")) {
      const all = db.prepare("SELECT procurement_status FROM job_items WHERE job_id = ?").all(it.job_id).map((r) => r.procurement_status);
      const done = all.every((s) => s === "bought" || s === "from_stock");
      const some = all.some((s) => s !== "to_buy");
      db.prepare("UPDATE jobs SET ops_status = ? WHERE id = ?").run(done ? "purchase_complete" : some ? "partially_purchased" : it.ops_status === "new" ? "new" : it.ops_status, it.job_id);
    }
    log(db, userId, `item ${status.replace(/_/g, " ")}`, "job", it.job_id, it.number);
  });
}

export function updateJob(db, userId, id, input) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) throw httpError(404, "Job not found");
  db.prepare("UPDATE jobs SET customer_po_number=?, customer_po_date=?, required_date=?, delivery_location=?, priority=?, instructions=? WHERE id=?")
    .run(input.customer_po_number ?? job.customer_po_number, input.customer_po_date ?? job.customer_po_date, input.required_date ?? job.required_date,
      input.delivery_location ?? job.delivery_location, input.priority ?? job.priority, input.instructions ?? job.instructions, id);
  log(db, userId, "updated job", "job", id, job.number);
}

// qty per job_item already on issued DCs / invoices / supplier bills
function lineTotals(db, jobId, kind, statuses) {
  const ph = statuses.map(() => "?").join(",");
  const rows = db.prepare(`SELECT l.item_id, l.description, SUM(l.qty) AS qty, SUM(l.amount) AS amount FROM document_lines l JOIN documents d ON d.id = l.document_id
    WHERE d.job_id = ? AND d.kind = ? AND d.status IN (${ph}) GROUP BY l.item_id, l.description`).all(jobId, kind, ...statuses);
  return (ji) => rows.find((r) => (ji.item_id ? r.item_id === ji.item_id : r.description === ji.description)) || { qty: 0, amount: 0 };
}

export function jobEconomics(db, jobId) {
  const items = db.prepare("SELECT ji.*, i.purchase_rate FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE job_id = ?").all(jobId);
  const delivered = lineTotals(db, jobId, "dc", ["issued", "signed"]);
  const expected = round2(items.reduce((a, i) => a + i.qty * i.sale_rate, 0));
  const invoiced = round2(db.prepare("SELECT COALESCE(SUM(subtotal - discount_total), 0) AS v FROM documents WHERE job_id = ? AND kind = 'invoice' AND status = 'open'").get(jobId).v);
  const purchases = round2(db.prepare("SELECT COALESCE(SUM(subtotal - discount_total), 0) AS v FROM documents WHERE job_id = ? AND kind = 'bill' AND status = 'open'").get(jobId).v);
  const fromStock = round2(items.filter((i) => i.procurement_status === "from_stock").reduce((a, i) => a + delivered(i).qty * (i.purchase_rate || 0), 0));
  const direct = round2(db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE job_id = ?").get(jobId).v);
  const revenue = invoiced || expected;
  const cost = round2(purchases + fromStock + direct);
  return { expected_revenue: expected, invoiced_revenue: invoiced, revenue_basis: invoiced ? "invoiced" : "expected", purchases, stock_cost: fromStock, direct_costs: direct, total_cost: cost,
    gross_profit: round2(revenue - cost), margin_pct: revenue ? round2(((revenue - cost) / revenue) * 100) : 0,
    // profit isn't final while anything is still to buy, or nothing bought has a supplier bill yet
    cost_pending: purchases + fromStock === 0 || items.some((i) => !["bought", "from_stock"].includes(i.procurement_status)) };
}

// One Job, shaped for the viewer's role (see auth.js caps)
export function jobDetail(db, id, can) {
  const job = db.prepare("SELECT j.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS created_by_name FROM jobs j JOIN contacts c ON c.id = j.customer_id LEFT JOIN users u ON u.id = j.created_by WHERE j.id = ?").get(id);
  if (!job) throw httpError(404, "Job not found");
  const items = db.prepare("SELECT ji.*, i.name AS item_name, i.unit, i.stock_qty, i.purchase_rate FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE job_id = ? ORDER BY ji.id").all(id);
  const delivered = lineTotals(db, id, "dc", ["issued", "signed"]);
  const invoiced = lineTotals(db, id, "invoice", ["open"]);
  const bought = lineTotals(db, id, "bill", ["open", "draft"]);
  const docs = db.prepare("SELECT d.id, d.kind, d.number, d.date, d.status, d.total, d.submitted_date, d.verified_at, d.signed_at, d.signed_by_name, c.name AS contact_name, COALESCE((SELECT SUM(amount) FROM payments p WHERE p.document_id = d.id), 0) AS paid FROM documents d JOIN contacts c ON c.id = d.contact_id WHERE d.job_id = ? ORDER BY d.id").all(id);
  const out = {
    ...job,
    items: items.map((i) => ({
      id: i.id, item_id: i.item_id, name: i.item_name || i.description, unit: i.unit || "", qty: i.qty, procurement_status: i.procurement_status, stock_qty: i.stock_qty,
      delivered_qty: delivered(i).qty, invoiced_qty: invoiced(i).qty, purchased_qty: bought(i).qty,
      ...(can("price.view") ? { sale_rate: i.sale_rate, tax_rate: i.tax_rate } : {}),
      ...(can("cost.view") ? { purchase_rate: i.purchase_rate } : {}),
    })),
    documents: docs.filter((d) => (["quote", "invoice", "dc"].includes(d.kind) ? can("sales.read") : can("ops.read"))),
    expenses: can("ops.read") ? db.prepare("SELECT * FROM expenses WHERE job_id = ? ORDER BY date").all(id) : [],
    economics: can("profit.view") ? jobEconomics(db, id) : null,
  };
  if (!can("sales.read")) delete out.customer_phone; // operations only needs who and where
  return out;
}

export function jobList(db, { q = "", status = "", scope = "" } = {}) {
  const like = `%${q}%`;
  const rows = db.prepare(`SELECT j.*, c.name AS customer_name,
      (SELECT COUNT(*) FROM job_items WHERE job_id = j.id) AS item_count,
      (SELECT COUNT(*) FROM job_items WHERE job_id = j.id AND procurement_status IN ('to_buy','partial','not_available')) AS to_buy_count,
      (SELECT COUNT(*) FROM documents WHERE job_id = j.id AND kind = 'dc' AND status IN ('issued','signed')) AS dc_count,
      (SELECT COUNT(*) FROM documents WHERE job_id = j.id AND kind = 'dc' AND status = 'signed') AS signed_dc_count,
      (SELECT COUNT(*) FROM documents WHERE job_id = j.id AND kind = 'invoice' AND status = 'open') AS invoice_count,
      (SELECT COUNT(*) FROM documents WHERE job_id = j.id AND kind = 'bill') AS bill_count
    FROM jobs j JOIN contacts c ON c.id = j.customer_id WHERE (j.number LIKE ? OR c.name LIKE ?) ORDER BY j.closed, COALESCE(j.required_date, '9999'), j.id DESC LIMIT 500`).all(like, like);
  return rows.filter((j) => (!status || j.ops_status === status) && (scope !== "active" || !j.closed));
}

// What Operations must buy: open lines of active Jobs, grouped by item across Jobs (master procurement list)
export function procurementList(db) {
  const rows = db.prepare(`SELECT ji.id, ji.job_id, ji.item_id, ji.description, ji.qty, ji.procurement_status, j.number AS job_number, j.required_date, j.priority, j.fulfilment_type,
      c.name AS customer_name, i.name AS item_name, i.unit, i.stock_qty, i.purchase_rate
    FROM job_items ji JOIN jobs j ON j.id = ji.job_id JOIN contacts c ON c.id = j.customer_id LEFT JOIN items i ON i.id = ji.item_id
    WHERE ${ACTIVE} AND ji.procurement_status IN ('to_buy','partial','not_available') ORDER BY COALESCE(j.required_date, '9999'), j.id`).all();
  const groups = new Map();
  for (const r of rows) {
    const key = r.item_id ? `i${r.item_id}` : `d${(r.description || "").toLowerCase()}`;
    const g = groups.get(key) || { key, item_id: r.item_id, name: r.item_name || r.description, unit: r.unit || "", stock_qty: r.stock_qty, purchase_rate: r.purchase_rate, total_qty: 0, earliest: null, urgent: false, jobs: [] };
    g.total_qty = round2(g.total_qty + r.qty);
    if (r.required_date && (!g.earliest || r.required_date < g.earliest)) g.earliest = r.required_date;
    g.urgent ||= r.priority === "urgent" || (r.required_date && r.required_date <= today());
    g.jobs.push({ job_item_id: r.id, job_id: r.job_id, job_number: r.job_number, customer_name: r.customer_name, qty: r.qty, required_date: r.required_date, status: r.procurement_status, fulfilment_type: r.fulfilment_type });
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.earliest || "9999").localeCompare(b.earliest || "9999"));
}

// Sales: draft customer DC for whatever hasn't been delivered yet
export function dcFromJob(db, userId, jobId) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  if (!job) throw httpError(404, "Job not found");
  const items = db.prepare("SELECT * FROM job_items WHERE job_id = ?").all(jobId);
  const delivered = lineTotals(db, jobId, "dc", ["issued", "signed"]);
  const lines = items.map((i) => ({ item_id: i.item_id, description: i.description, qty: round2(i.qty - delivered(i).qty), rate: 0 })).filter((l) => l.qty > 0);
  if (lines.length === 0) throw httpError(400, "Everything on this Job has already been delivered");
  return saveDocument(db, userId, { kind: "dc", contact_id: job.customer_id, job_id: jobId, status: "draft", reference: job.customer_po_number || job.number, notes: job.delivery_location ? `Deliver to: ${job.delivery_location}` : null, lines });
}

// Sales: draft invoice for delivered-but-not-invoiced quantities (or the whole Job if nothing has a DC yet)
export function invoiceFromJob(db, userId, jobId) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  if (!job) throw httpError(404, "Job not found");
  const items = db.prepare("SELECT * FROM job_items WHERE job_id = ?").all(jobId);
  const delivered = lineTotals(db, jobId, "dc", ["issued", "signed"]);
  const invoiced = lineTotals(db, jobId, "invoice", ["open", "draft"]);
  const anyDc = items.some((i) => delivered(i).qty > 0);
  const lines = items.map((i) => ({ item_id: i.item_id, description: i.description, qty: round2((anyDc ? delivered(i).qty : i.qty) - invoiced(i).qty), rate: i.sale_rate, tax_rate: i.tax_rate }))
    .filter((l) => l.qty > 0);
  if (lines.length === 0) throw httpError(400, anyDc ? "Everything delivered is already invoiced" : "Nothing left to invoice");
  const days = getSetting(db, "paymentTermsDays") || 0;
  const due = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  return saveDocument(db, userId, { kind: "invoice", contact_id: job.customer_id, job_id: jobId, status: "draft", due_date: due, reference: job.customer_po_number || job.number, lines });
}

export function signDc(db, userId, id, { name, date }) {
  const d = db.prepare("SELECT * FROM documents WHERE id = ? AND kind = 'dc'").get(id);
  if (!d) throw httpError(404, "DC not found");
  if (d.status !== "issued") throw httpError(400, "Issue the DC before marking it signed");
  db.prepare("UPDATE documents SET status = 'signed', signed_at = ?, signed_by_name = ? WHERE id = ?").run(date || today(), name || null, id);
  if (d.job_id) db.prepare("UPDATE jobs SET ops_status = 'delivered' WHERE id = ? AND ops_status != 'delivered'").run(d.job_id);
  log(db, userId, "received signed DC", "dc", id, d.number);
}

export function closeJob(db, userId, id, closed = true) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) throw httpError(404, "Job not found");
  db.prepare("UPDATE jobs SET closed = ? WHERE id = ?").run(closed ? 1 : 0, id);
  log(db, userId, closed ? "closed job" : "reopened job", "job", id, job.number);
}
