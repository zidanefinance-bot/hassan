// Internal Jobs: the bridge between Sales and Operations.
// Sales creates the Job from customer demand; Operations fulfils it (procurement, purchases, supplier bills,
// direct costs, fulfilment status); Sales then raises the customer DC and invoice from it.
import { tx } from "./db.js";
import { getSetting, httpError, log, nextNumber, PAID_SQL, round2, saveDocument, today } from "./books.js";
import { DOC_READ } from "./collab.js";

export const OPS_STATUSES = ["new", "procurement_started", "partially_purchased", "purchase_complete", "material_ready", "dispatched", "delivered"];
// an ordered item is always supplied: there is no "not available" (the old value is turned back into to_buy at start-up)
export const PROCUREMENT_STATUSES = ["to_buy", "partial", "bought", "from_stock"];
const ACTIVE = "j.closed = 0";

export function createJob(db, userId, input) {
  const items = (input.items || []).filter((i) => i.item_id || i.description);
  if (!input.customer_id) throw httpError(400, "Customer is required");
  if (items.length === 0) throw httpError(400, "Add at least one item");
  if (items.some((i) => !(Number(i.qty) > 0))) throw httpError(400, "Every line needs a quantity above 0");
  if (items.some((i) => Number(i.sale_rate ?? i.rate) < 0)) throw httpError(400, "A selling rate can't be negative");
  if (input.quote_id) {
    const q = db.prepare("SELECT * FROM documents WHERE id = ? AND kind = 'quote'").get(input.quote_id);
    if (!q) throw httpError(400, "That quote doesn't exist");
    if (q.status === "converted" || q.job_id) throw httpError(400, "A Job already exists for this quote");
    if (q.contact_id !== Number(input.customer_id)) throw httpError(400, "The quote is for a different customer");
  }
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

const step = (s) => OPS_STATUSES.indexOf(s);
const issuedDcs = (db, jobId) => db.prepare("SELECT COUNT(*) AS n FROM documents WHERE job_id = ? AND kind = 'dc' AND status IN ('issued','signed')").get(jobId).n;

export function setOpsStatus(db, userId, id, status) {
  if (!OPS_STATUSES.includes(status)) throw httpError(400, "Unknown fulfilment status");
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) throw httpError(404, "Job not found");
  if (job.closed) throw httpError(400, "This Job is closed. A director can reopen it.");
  if (status === job.ops_status) return;
  const items = db.prepare("SELECT procurement_status FROM job_items WHERE job_id = ?").all(id).map((r) => r.procurement_status);
  if (step(status) >= step("material_ready") && step(job.ops_status) < step("material_ready") && items.some((s) => s === "to_buy" || s === "partial")) {
    throw httpError(400, "Some items are still to buy. Mark each item bought or from stock first.");
  }
  if (step(status) >= step("material_ready") && items.length && items.every((s) => s === "not_available")) throw httpError(400, "Nothing on this Job is available to deliver");
  if (step(status) < step("dispatched") && issuedDcs(db, id)) throw httpError(400, "A delivery challan has already gone out for this Job, so it can't move back before dispatched");
  if (status === "delivered" && !db.prepare("SELECT 1 FROM documents WHERE job_id = ? AND kind = 'dc' AND status = 'signed'").get(id)) {
    throw httpError(400, "Delivered is set when Sales records the customer's signed DC");
  }
  db.prepare("UPDATE jobs SET ops_status = ? WHERE id = ?").run(status, id);
  log(db, userId, `marked ${status.replace(/_/g, " ")}`, "job", id, job.number);
}

export function setItemProcurement(db, userId, jobItemId, status) {
  if (status === "not_available") throw httpError(400, "An ordered item has to be supplied: mark it to buy, partly bought, bought or from stock");
  if (!PROCUREMENT_STATUSES.includes(status)) throw httpError(400, "Unknown procurement status");
  const it = db.prepare("SELECT ji.*, j.number, j.ops_status, j.closed FROM job_items ji JOIN jobs j ON j.id = ji.job_id WHERE ji.id = ?").get(jobItemId);
  if (!it) throw httpError(404, "Not found");
  if (status === it.procurement_status) return;
  // once goods are with the customer, or material has been declared ready, the buying side is settled
  if (it.closed) throw httpError(400, "This Job is closed");
  if (lineTotals(db, it.job_id, "dc", ["issued", "signed"])(it).qty > 0) throw httpError(400, "This item has already been delivered to the customer, so its buying status can't change");
  if (step(it.ops_status) >= step("material_ready") && ["to_buy", "partial", "not_available"].includes(status)) {
    throw httpError(400, "Material is already marked ready. Move the Job back to 'procurement started' first if something is missing.");
  }
  const billed = lineTotals(db, it.job_id, "bill", ["open", "draft"])(it).qty;
  if (["not_available", "to_buy", "partial"].includes(status) && billed >= it.qty) throw httpError(400, `A supplier bill already covers ${billed} of this item, so it's bought. If it went back to the supplier, record a vendor credit first.`);
  if (status === "from_stock") {
    const stock = db.prepare("SELECT stock_qty, track_stock, unit FROM items WHERE id = ?").get(it.item_id);
    const need = round2(it.qty - lineTotals(db, it.job_id, "dc", ["issued", "signed"])(it).qty);
    if (!it.item_id) throw httpError(400, "This line isn't one of our items, so it can't come from stock");
    if (stock?.track_stock && stock.stock_qty < need) throw httpError(400, `Only ${stock.stock_qty} ${stock.unit} in stock, ${need} needed. Mark it to buy (or partly bought) instead.`);
  }
  tx(db, () => {
    db.prepare("UPDATE job_items SET procurement_status = ? WHERE id = ?").run(status, jobItemId);
    rollupOps(db, it.job_id);
    log(db, userId, `item ${status.replace(/_/g, " ")}`, "job", it.job_id, it.number);
  });
}

// keep the Job's fulfilment status in step with its lines until material is ready
function rollupOps(db, jobId) {
  const job = db.prepare("SELECT ops_status FROM jobs WHERE id = ?").get(jobId);
  if (step(job.ops_status) >= step("material_ready")) return;
  const all = db.prepare("SELECT procurement_status FROM job_items WHERE job_id = ?").all(jobId).map((r) => r.procurement_status);
  const done = all.every((s) => s === "bought" || s === "from_stock");
  const some = all.some((s) => s !== "to_buy");
  db.prepare("UPDATE jobs SET ops_status = ? WHERE id = ?").run(done ? "purchase_complete" : some ? "partially_purchased" : job.ops_status, jobId);
}

// A supplier bill for a Job buys its lines: what a bill covers becomes partly bought / bought.
// It only moves lines forward; Operations can still mark things by hand (cash buys without a bill).
export function syncJobBuying(db, userId, jobId) {
  const job = db.prepare("SELECT number, closed FROM jobs WHERE id = ?").get(jobId);
  if (!job || job.closed) return;
  const billed = lineTotals(db, jobId, "bill", ["open", "draft"]);
  let changed = 0;
  for (const it of db.prepare("SELECT * FROM job_items WHERE job_id = ? AND procurement_status IN ('to_buy','partial')").all(jobId)) {
    const b = billed(it).qty;
    const next = b >= it.qty - 0.001 ? "bought" : b > 0 ? "partial" : it.procurement_status;
    if (next !== it.procurement_status) { db.prepare("UPDATE job_items SET procurement_status = ? WHERE id = ?").run(next, it.id); changed++; }
  }
  if (changed) { rollupOps(db, jobId); log(db, userId, `${changed} item(s) bought by supplier bill`, "job", jobId, job.number); }
}

export function updateJob(db, userId, id, input) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) throw httpError(404, "Job not found");
  if (job.closed) throw httpError(400, "This Job is closed. A director can reopen it.");
  tx(db, () => {
    db.prepare("UPDATE jobs SET customer_po_number=?, customer_po_date=?, required_date=?, delivery_location=?, priority=?, instructions=?, order_source=?, fulfilment_type=? WHERE id=?")
      .run(input.customer_po_number ?? job.customer_po_number, input.customer_po_date ?? job.customer_po_date, input.required_date ?? job.required_date,
        input.delivery_location ?? job.delivery_location, input.priority ?? job.priority, input.instructions ?? job.instructions,
        input.order_source ?? job.order_source, input.fulfilment_type === "direct" ? "direct" : input.fulfilment_type === "stock" ? "stock" : job.fulfilment_type, id);
    if (Array.isArray(input.items)) updateJobItems(db, job, input.items);
    log(db, userId, "updated job", "job", id, job.number);
  });
}

// Correcting a Job's lines: change qty / rate, add lines, remove lines. Whatever is already on a supplier bill,
// a DC or an invoice stays: a line can't go below that, and such a line can't be removed or swapped for another item.
function updateJobItems(db, job, input) {
  const lines = input.filter((i) => i.item_id || i.description);
  if (!lines.length) throw httpError(400, "Add at least one item");
  if (lines.some((i) => !(Number(i.qty) > 0))) throw httpError(400, "Every line needs a quantity above 0");
  if (lines.some((i) => Number(i.sale_rate ?? i.rate) < 0)) throw httpError(400, "A selling rate can't be negative");
  const existing = db.prepare("SELECT ji.*, COALESCE(i.name, ji.description) AS name FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE ji.job_id = ?").all(job.id);
  const used = { bill: lineTotals(db, job.id, "bill", ["open", "draft"]), dc: lineTotals(db, job.id, "dc", ["issued", "signed", "draft"]), invoice: lineTotals(db, job.id, "invoice", ["open", "draft"]) };
  const taken = (it) => Math.max(used.bill(it).qty, used.dc(it).qty, used.invoice(it).qty);
  const keep = new Set(lines.filter((l) => l.id).map((l) => Number(l.id)));
  for (const it of existing) {
    if (!keep.has(it.id) && taken(it) > 0) throw httpError(400, `${it.name} is already on a bill, DC or invoice, so it can't be removed. Lower its quantity instead.`);
  }
  for (const it of existing) if (!keep.has(it.id)) db.prepare("DELETE FROM job_items WHERE id = ?").run(it.id);
  let addsBuying = false;
  for (const l of lines) {
    const qty = Number(l.qty), rate = Number(l.sale_rate ?? l.rate) || 0, tax = Number(l.tax_rate) || 0;
    const it = l.id && existing.find((x) => x.id === Number(l.id));
    if (it) {
      const t = taken(it);
      const sameItem = (Number(l.item_id) || null) === (it.item_id || null) && (it.item_id || (l.description || null) === (it.description || null));
      if (!sameItem && t > 0) throw httpError(400, `${it.name} is already on a bill, DC or invoice, so it can't be changed to another item`);
      if (qty < t - 0.001) throw httpError(400, `${it.name}: ${t} is already on a bill, DC or invoice, so the quantity can't go below that`);
      // more than was bought before: back to buying
      const status = qty > it.qty + 0.001 && ["bought", "partial"].includes(it.procurement_status) ? (used.bill(it).qty > 0 ? "partial" : "to_buy") : it.procurement_status;
      if (status !== it.procurement_status) addsBuying = true;
      db.prepare("UPDATE job_items SET item_id = ?, description = ?, qty = ?, sale_rate = ?, tax_rate = ?, procurement_status = ? WHERE id = ?")
        .run(Number(l.item_id) || null, Number(l.item_id) ? null : l.description || null, qty, rate, tax, status, it.id);
    } else {
      db.prepare("INSERT INTO job_items (job_id, item_id, description, qty, sale_rate, tax_rate) VALUES (?, ?, ?, ?, ?, ?)").run(job.id, Number(l.item_id) || null, Number(l.item_id) ? null : l.description || null, qty, rate, tax);
      addsBuying = true;
    }
  }
  // a new or bigger line after the material was ready sends the Job back to buying (unless goods are already out)
  if (addsBuying && step(job.ops_status) >= step("material_ready") && step(job.ops_status) < step("dispatched")) db.prepare("UPDATE jobs SET ops_status = 'partially_purchased' WHERE id = ?").run(job.id);
  rollupOps(db, job.id);
  syncJobBuying(db, null, job.id);
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
  // supplier bills before tax, with their freight / charges and less their discount
  const purchases = round2(db.prepare("SELECT COALESCE(SUM(subtotal - discount_total - doc_discount + charges), 0) AS v FROM documents WHERE job_id = ? AND kind = 'bill' AND status = 'open'").get(jobId).v);
  const fromStock = round2(items.filter((i) => i.procurement_status === "from_stock").reduce((a, i) => a + delivered(i).qty * (i.purchase_rate || 0), 0));
  const direct = round2(db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE job_id = ?").get(jobId).v);
  const revenue = invoiced || expected;
  const cost = round2(purchases + fromStock + direct);
  return { expected_revenue: expected, invoiced_revenue: invoiced, revenue_basis: invoiced ? "invoiced" : "expected", purchases, stock_cost: fromStock, direct_costs: direct, total_cost: cost,
    gross_profit: round2(revenue - cost), margin_pct: revenue ? round2(((revenue - cost) / revenue) * 100) : 0,
    // profit isn't final while anything is still to buy, or nothing bought has a supplier bill yet
    cost_pending: purchases + fromStock === 0 || items.some((i) => ["to_buy", "partial"].includes(i.procurement_status)),
    cost_pending_reason: purchases + fromStock === 0 ? "no_bill" : items.some((i) => ["to_buy", "partial"].includes(i.procurement_status)) ? "still_buying" : null };
}

// One Job, shaped for the viewer's role (see auth.js caps)
export function jobDetail(db, id, can) {
  const job = db.prepare("SELECT j.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS created_by_name FROM jobs j JOIN contacts c ON c.id = j.customer_id LEFT JOIN users u ON u.id = j.created_by WHERE j.id = ?").get(id);
  if (!job) throw httpError(404, "Job not found");
  const items = db.prepare("SELECT ji.*, i.name AS item_name, i.unit, i.stock_qty, i.purchase_rate FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE job_id = ? ORDER BY ji.id").all(id);
  const delivered = lineTotals(db, id, "dc", ["issued", "signed"]);
  const invoiced = lineTotals(db, id, "invoice", ["open"]);
  const bought = lineTotals(db, id, "bill", ["open", "draft"]);
  const ready = readyQty(db, id);
  const docs = db.prepare(`SELECT d.id, d.kind, d.number, d.date, d.status, d.total, d.submitted_date, d.verified_at, d.signed_at, d.signed_by_name, c.name AS contact_name, ${PAID_SQL} AS paid FROM documents d JOIN contacts c ON c.id = d.contact_id WHERE d.job_id = ? ORDER BY d.id`).all(id);
  const out = {
    ...job,
    items: items.map((i) => ({
      id: i.id, item_id: i.item_id, name: i.item_name || i.description, unit: i.unit || "", qty: i.qty, procurement_status: i.procurement_status, stock_qty: i.stock_qty,
      ...(can("sales.read") ? { delivered_qty: delivered(i).qty, invoiced_qty: invoiced(i).qty, ready_qty: ready(i) } : { delivered_qty: delivered(i).qty }),
      ...(can("ops.read") ? { purchased_qty: bought(i).qty } : {}),
      ...(can("price.view") ? { sale_rate: i.sale_rate, tax_rate: i.tax_rate } : {}),
      ...(can("cost.view") ? { purchase_rate: i.purchase_rate } : {}),
    })),
    // each side only sees its own paperwork on the Job (credit notes are Sales', vendor credits Operations')
    documents: docs.filter((d) => DOC_READ[d.kind].some(can)).map((d) => (can("money") ? d : { ...d, paid: undefined })),
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
      (SELECT COUNT(*) FROM documents WHERE job_id = j.id AND kind = 'bill') AS bill_count,
      (SELECT COALESCE(SUM(qty), 0) FROM job_items WHERE job_id = j.id) AS ordered_qty,
      (SELECT COALESCE(SUM(l.qty), 0) FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE d.job_id = j.id AND d.kind = 'dc' AND d.status IN ('issued','signed')) AS out_qty,
      (SELECT COALESCE(SUM(l.qty), 0) FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE d.job_id = j.id AND d.kind = 'dc' AND d.status = 'signed') AS signed_qty,
      (SELECT COALESCE(SUM(l.qty), 0) FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE d.job_id = j.id AND d.kind = 'invoice' AND d.status IN ('open','draft')) AS invoiced_qty,
      (SELECT COUNT(*) FROM documents WHERE job_id = j.id AND kind = 'dc' AND status = 'draft') AS draft_dc_count
    FROM jobs j JOIN contacts c ON c.id = j.customer_id WHERE (j.number LIKE ? OR c.name LIKE ? OR IFNULL(j.customer_po_number, '') LIKE ?) ORDER BY j.closed, COALESCE(j.required_date, '9999'), j.id DESC LIMIT 500`).all(like, like, like);
  return rows.filter((j) => (!status || j.ops_status === status) && (scope !== "active" || !j.closed));
}

// What Operations must buy: open lines of active Jobs, grouped by item across Jobs (master procurement list)
export function procurementList(db) {
  const rows = db.prepare(`SELECT ji.id, ji.job_id, ji.item_id, ji.description, ji.qty, ji.procurement_status, j.number AS job_number, j.required_date, j.priority, j.fulfilment_type,
      c.name AS customer_name, i.name AS item_name, i.unit, i.category, i.stock_qty, i.purchase_rate
    FROM job_items ji JOIN jobs j ON j.id = ji.job_id JOIN contacts c ON c.id = j.customer_id LEFT JOIN items i ON i.id = ji.item_id
    WHERE ${ACTIVE} AND ji.procurement_status IN ('to_buy','partial') ORDER BY COALESCE(j.required_date, '9999'), j.id`).all();
  const groups = new Map();
  const billedFor = new Map();
  for (const r of rows) {
    // what supplier bills for this Job already cover is bought: only the rest is still to buy
    if (!billedFor.has(r.job_id)) billedFor.set(r.job_id, lineTotals(db, r.job_id, "bill", ["open", "draft"]));
    r.bought = round2(Math.min(r.qty, billedFor.get(r.job_id)({ item_id: r.item_id, description: r.description }).qty));
    r.ordered = r.qty;
    r.qty = round2(r.qty - r.bought);
    if (r.qty <= 0.001) continue;
    const key = r.item_id ? `i${r.item_id}` : `d${(r.description || "").toLowerCase()}`;
    const g = groups.get(key) || { key, item_id: r.item_id, name: r.item_name || r.description, unit: r.unit || "", category: r.category || "", stock_qty: r.stock_qty, purchase_rate: r.purchase_rate, total_qty: 0, earliest: null, urgent: false, jobs: [] };
    g.total_qty = round2(g.total_qty + r.qty);
    if (r.required_date && (!g.earliest || r.required_date < g.earliest)) g.earliest = r.required_date;
    g.urgent ||= r.priority === "urgent" || (r.required_date && r.required_date <= today());
    g.jobs.push({ job_item_id: r.id, job_id: r.job_id, job_number: r.job_number, customer_name: r.customer_name, qty: r.qty, ordered: r.ordered, bought: r.bought, required_date: r.required_date, priority: r.priority, status: r.procurement_status, fulfilment_type: r.fulfilment_type });
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.earliest || "9999").localeCompare(b.earliest || "9999"));
}

// How much of each Job line can go to the customer now: everything once material is ready; before that, what is
// bought or from stock, and on a partly bought line what supplier bills cover. So the part in hand can go out first.
export function readyQty(db, jobId) {
  const job = db.prepare("SELECT ops_status FROM jobs WHERE id = ?").get(jobId);
  const billed = lineTotals(db, jobId, "bill", ["open", "draft"]);
  const allReady = step(job.ops_status) >= step("material_ready");
  return (it) => (allReady || ["bought", "from_stock"].includes(it.procurement_status) ? it.qty : it.procurement_status === "partial" ? Math.min(it.qty, billed(it).qty) : 0);
}

// Sales: draft customer DC for whatever hasn't been delivered yet
// Quantity rules for a Job's customer paperwork: a DC can't deliver more than was ordered (less what already went out),
// and an invoice can't bill more than was delivered (or ordered, when the Job has no DC).
function jobLineLimits(db, doc, lines) {
  const items = db.prepare("SELECT ji.*, COALESCE(i.name, ji.description) AS name FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE ji.job_id = ?").all(doc.job_id);
  const key = (x) => (x.item_id ? `i${x.item_id}` : `d${(x.description || "").toLowerCase()}`);
  const sumOther = (kind, statuses) => {
    const rows = db.prepare(`SELECT l.item_id, l.description, SUM(l.qty) AS qty FROM document_lines l JOIN documents d ON d.id = l.document_id
      WHERE d.job_id = ? AND d.kind = ? AND d.status IN (${statuses.map(() => "?").join(",")}) AND d.id != ? GROUP BY l.item_id, l.description`).all(doc.job_id, kind, ...statuses, doc.id || 0);
    return Object.fromEntries(rows.map((r) => [key(r), r.qty]));
  };
  const want = {};
  for (const l of lines) want[key(l)] = round2((want[key(l)] || 0) + Number(l.qty || 0));
  return { items, key, sumOther, want };
}
export function checkDcIssue(db, doc, lines = null, { admin = false } = {}) {
  if (!doc.job_id) return;
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(doc.job_id);
  if (job.closed) throw httpError(400, "This Job is closed");
  const { items, key, sumOther, want } = jobLineLimits(db, doc, lines || db.prepare("SELECT * FROM document_lines WHERE document_id = ?").all(doc.id));
  const out = sumOther("dc", ["issued", "signed"]);
  const ready = readyQty(db, doc.job_id);
  for (const it of items) {
    const left = round2(it.qty - (out[key(it)] || 0));
    if ((want[key(it)] || 0) > left + 0.001) throw httpError(400, `Only ${left} of ${it.name} is left to deliver on this Job`);
    // a director can send goods Operations hasn't marked yet
    const inHand = round2(ready(it) - (out[key(it)] || 0));
    if (!admin && (want[key(it)] || 0) > inHand + 0.001) throw httpError(400, inHand > 0 ? `Only ${inHand} of ${it.name} is bought / in hand so far` : `${it.name} isn't bought yet. Operations marks it bought (or the material ready) first.`);
  }
}
// an invoice may come before or after the DC; either way it can't bill more than was ordered / delivered
export function checkInvoiceQty(db, doc, lines) {
  if (!doc.job_id) return;
  const { items, key, sumOther, want } = jobLineLimits(db, doc, lines);
  const delivered = sumOther("dc", ["issued", "signed"]);
  const anyDc = Object.keys(delivered).length > 0;
  const billed = sumOther("invoice", ["open", "draft"]);
  for (const it of items) {
    const cap = round2((anyDc ? delivered[key(it)] || 0 : it.qty) - (billed[key(it)] || 0));
    if ((want[key(it)] || 0) > cap + 0.001) throw httpError(400, `Only ${Math.max(0, cap)} of ${it.name} is left to invoice (${anyDc ? "delivered" : "ordered"} on this Job)`);
  }
}
// a DC that went out can't be voided or deleted if the Job has already invoiced those goods
export function checkDcRemoval(db, doc) {
  if (!doc.job_id || !["issued", "signed"].includes(doc.status)) return;
  const { items, key, sumOther } = jobLineLimits(db, doc, []);
  const delivered = sumOther("dc", ["issued", "signed"]);
  const billed = sumOther("invoice", ["open", "draft"]);
  if (items.some((it) => (billed[key(it)] || 0) > (delivered[key(it)] || 0) + 0.001)) throw httpError(400, "Goods on this delivery challan are already invoiced. Void the invoice (or make a credit note) first.");
}

// "Material arrived" does DC + invoice together: make sure both will work before the DC goes out
export function deliverPrecheck(db, jobId) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  if (!job) throw httpError(404, "Job not found");
  if (job.closed) throw httpError(400, "This Job is closed");
  const draft = db.prepare("SELECT number, kind FROM documents WHERE job_id = ? AND kind IN ('dc','invoice') AND status = 'draft'").get(jobId);
  if (draft) throw httpError(400, `${draft.number} is already a draft ${draft.kind === "dc" ? "delivery challan" : "invoice"} for this Job. Issue or delete it first.`);
  const items = db.prepare("SELECT * FROM job_items WHERE job_id = ?").all(jobId);
  const delivered = lineTotals(db, jobId, "dc", ["issued", "signed"]);
  const invoiced = lineTotals(db, jobId, "invoice", ["open"]);
  const ready = readyQty(db, jobId);
  if (!items.some((i) => i.qty - delivered(i).qty > 0.001)) throw httpError(400, "Everything on this Job has already been delivered");
  if (!items.some((i) => ready(i) - delivered(i).qty > 0.001)) throw httpError(400, "Nothing more is bought / in hand yet. Operations marks items bought (or the material ready) first.");
  if (items.every((i) => invoiced(i).qty >= i.qty - 0.001)) throw httpError(400, "This Job is already fully invoiced. Use 'Create DC' to send the goods.");
}

export function dcFromJob(db, userId, jobId, { admin = false } = {}) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  if (!job) throw httpError(404, "Job not found");
  const draft = db.prepare("SELECT number FROM documents WHERE job_id = ? AND kind = 'dc' AND status = 'draft'").get(jobId);
  if (draft) throw httpError(400, `${draft.number} is already a draft delivery challan for this Job. Issue or delete it first.`);
  const items = db.prepare("SELECT * FROM job_items WHERE job_id = ?").all(jobId);
  const delivered = lineTotals(db, jobId, "dc", ["issued", "signed"]);
  if (job.closed) throw httpError(400, "This Job is closed");
  if (!items.some((i) => i.qty - delivered(i).qty > 0.001)) throw httpError(400, "Everything on this Job has already been delivered");
  // what's in hand and not yet delivered (a director may draft the whole rest)
  const ready = readyQty(db, jobId);
  const lines = items.map((i) => ({ item_id: i.item_id, description: i.description, qty: round2((admin ? i.qty : ready(i)) - delivered(i).qty), rate: 0 })).filter((l) => l.qty > 0);
  if (lines.length === 0) throw httpError(400, "Nothing more is bought / in hand yet. Operations marks items bought (or the material ready) first.");
  return saveDocument(db, userId, { kind: "dc", contact_id: job.customer_id, job_id: jobId, status: "draft", reference: job.customer_po_number || job.number, lines });
}

// Sales: draft invoice for delivered-but-not-invoiced quantities (or the whole Job when nothing has a DC yet)
export function invoiceFromJob(db, userId, jobId) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  if (!job) throw httpError(404, "Job not found");
  const draft = db.prepare("SELECT number FROM documents WHERE job_id = ? AND kind = 'invoice' AND status = 'draft'").get(jobId);
  if (draft) throw httpError(400, `${draft.number} is already a draft invoice for this Job. Issue or delete it first.`);
  const items = db.prepare("SELECT * FROM job_items WHERE job_id = ?").all(jobId);
  const delivered = lineTotals(db, jobId, "dc", ["issued", "signed"]);
  const invoiced = lineTotals(db, jobId, "invoice", ["open", "draft"]);
  const anyDc = items.some((i) => delivered(i).qty > 0);
  if (job.closed) throw httpError(400, "This Job is closed");
  const lines = items
    .map((i) => ({ item_id: i.item_id, description: i.description, qty: round2((anyDc ? delivered(i).qty : i.qty) - invoiced(i).qty), rate: i.sale_rate, tax_rate: i.tax_rate }))
    .filter((l) => l.qty > 0);
  if (lines.length === 0) throw httpError(400, anyDc ? "Everything delivered is already invoiced" : "Nothing left to invoice");
  const days = db.prepare("SELECT payment_terms_days FROM contacts WHERE id = ?").get(job.customer_id)?.payment_terms_days ?? getSetting(db, "paymentTermsDays") ?? 0;
  const due = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  return saveDocument(db, userId, { kind: "invoice", contact_id: job.customer_id, job_id: jobId, status: "draft", due_date: due, reference: job.customer_po_number || job.number, lines });
}

// The Job's delivery status follows its DCs: a signed DC = delivered, an issued one = dispatched.
// When a DC is deleted, voided or taken back to draft (removed), the Job steps back too (to material ready if no DC is out).
// Operations may also mark a Job dispatched by hand before any DC exists; that is left alone unless a DC was removed.
export function syncJobDelivery(db, jobId, { removed = false } = {}) {
  const job = db.prepare("SELECT ops_status, closed FROM jobs WHERE id = ?").get(jobId);
  if (!job || job.closed) return;
  const n = (status) => db.prepare("SELECT COUNT(*) AS n FROM documents WHERE job_id = ? AND kind = 'dc' AND status = ?").get(jobId, status).n;
  const signed = n("signed"), issued = n("issued");
  const signedFor = lineTotals(db, jobId, "dc", ["signed"]);
  const allSigned = signed > 0 && db.prepare("SELECT * FROM job_items WHERE job_id = ?").all(jobId).every((i) => signedFor(i).qty >= i.qty - 0.001);
  let next = job.ops_status;
  // a part delivery leaves the Job at dispatched, so the rest still shows up as to deliver
  if (allSigned) next = "delivered";
  else if (signed) next = job.ops_status === "delivered" || step(job.ops_status) < step("dispatched") ? "dispatched" : job.ops_status;
  else if (issued) next = step(job.ops_status) < step("dispatched") || job.ops_status === "delivered" ? "dispatched" : job.ops_status;
  else if (job.ops_status === "delivered" || (removed && job.ops_status === "dispatched")) next = "material_ready";
  if (next !== job.ops_status) db.prepare("UPDATE jobs SET ops_status = ? WHERE id = ?").run(next, jobId);
}

export function signDc(db, userId, id, { name, date }) {
  const d = db.prepare("SELECT * FROM documents WHERE id = ? AND kind = 'dc'").get(id);
  if (!d) throw httpError(404, "DC not found");
  if (d.status !== "issued") throw httpError(400, "Issue the DC before marking it signed");
  db.prepare("UPDATE documents SET status = 'signed', signed_at = ?, signed_by_name = ? WHERE id = ?").run(date || today(), name || null, id);
  if (d.job_id) syncJobDelivery(db, d.job_id);
  log(db, userId, "received signed DC", "dc", id, d.number);
}

export function closeJob(db, userId, id, closed = true) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) throw httpError(404, "Job not found");
  if (closed) {
    const drafts = db.prepare("SELECT number FROM documents WHERE job_id = ? AND status = 'draft' AND kind IN ('dc','invoice','bill','po')").all(id).map((d) => d.number);
    if (drafts.length) throw httpError(400, `Finish or delete the drafts first: ${drafts.join(", ")}`);
  }
  db.prepare("UPDATE jobs SET closed = ? WHERE id = ?").run(closed ? 1 : 0, id);
  log(db, userId, closed ? "closed job" : "reopened job", "job", id, job.number);
}
