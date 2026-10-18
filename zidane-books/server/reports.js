// Reports. P&L is document-based: sales (ex-tax) − cost of goods sold (cost captured on each invoice line) − expenses.
import { round2, today, displayStatus, PAID_SQL, UNUSED_SQL, CREDIT_UNUSED_SQL } from "./books.js";
import { jobEconomics, jobList, OPS_STATUSES, procurementList } from "./jobs.js";

const ISSUED = "status = 'open'";

function balances(db, kind, on = today()) {
  return db.prepare(`SELECT d.*, c.name AS contact_name, ${PAID_SQL} AS paid
    FROM documents d JOIN contacts c ON c.id = d.contact_id WHERE d.kind = ? AND d.${ISSUED}`).all(kind)
    .map((d) => ({ ...d, paid: round2(d.paid), balance: round2(d.total - d.paid), display_status: displayStatus(d, d.paid, on) }))
    .filter((d) => d.balance > 0.001);
}

function aging(rows, on = today()) {
  const buckets = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  const byContact = {};
  for (const r of rows) {
    const days = r.due_date ? Math.floor((Date.parse(on) - Date.parse(r.due_date)) / 864e5) : 0;
    const b = days <= 0 ? "current" : days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
    buckets[b] = round2(buckets[b] + r.balance);
    const c = (byContact[r.contact_id] ||= { contact_id: r.contact_id, name: r.contact_name, total: 0, current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 });
    c[b] = round2(c[b] + r.balance);
    c.total = round2(c.total + r.balance);
  }
  return { buckets, total: round2(Object.values(buckets).reduce((a, b) => a + b, 0)), contacts: Object.values(byContact).sort((a, b) => b.total - a.total), documents: rows };
}

// unused advances plus unused credit notes / vendor credits
const advances = (db, dir) => round2(db.prepare(`SELECT COALESCE(SUM(${UNUSED_SQL}), 0) AS v FROM payments p WHERE p.direction = ?`).get(dir).v
  + db.prepare(`SELECT COALESCE(SUM(${CREDIT_UNUSED_SQL}), 0) AS v FROM documents d WHERE d.kind = ? AND d.status = 'open'`).get(dir === "in" ? "credit_note" : "vendor_credit").v);
export const receivables = (db) => ({ ...aging(balances(db, "invoice")), advances: advances(db, "in") });
export const payables = (db) => ({ ...aging(balances(db, "bill")), advances: advances(db, "out") });

export function profitAndLoss(db, from, to) {
  const sales = db.prepare(`SELECT COALESCE(SUM(subtotal - discount_total), 0) AS v, COALESCE(SUM(tax_total), 0) AS tax FROM documents WHERE kind = 'invoice' AND ${ISSUED} AND date BETWEEN ? AND ?`).get(from, to);
  const cogs = db.prepare(`SELECT COALESCE(SUM(l.qty * l.cost_rate), 0) AS v FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE d.kind = 'invoice' AND d.${ISSUED} AND d.date BETWEEN ? AND ?`).get(from, to).v;
  const exp = db.prepare("SELECT category, SUM(amount) AS amount FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY amount DESC").all(from, to)
    .map((e) => ({ ...e, amount: round2(e.amount) }));
  const expenses = round2(exp.reduce((a, e) => a + e.amount, 0));
  const revenue = round2(sales.v), gross = round2(revenue - cogs);
  return { from, to, revenue, cogs: round2(cogs), gross_profit: gross, gross_margin: revenue ? round2((gross / revenue) * 100) : 0, expenses, expense_breakdown: exp, net_profit: round2(gross - expenses), tax_collected: round2(sales.tax) };
}

export function taxSummary(db, from, to) {
  const q = (kind) => round2(db.prepare(`SELECT COALESCE(SUM(tax_total), 0) AS v FROM documents WHERE kind = ? AND ${ISSUED} AND date BETWEEN ? AND ?`).get(kind, from, to).v);
  const collected = q("invoice"), paid = q("bill");
  return { from, to, output_tax: collected, input_tax: paid, net_payable: round2(collected - paid) };
}

export function inventory(db) {
  const items = db.prepare("SELECT * FROM items WHERE active = 1 ORDER BY name").all().map((i) => ({
    ...i, stock_value: round2(i.stock_qty * i.purchase_rate), margin_pct: i.sale_rate ? round2(((i.sale_rate - i.purchase_rate) / i.sale_rate) * 100) : 0, low: i.track_stock && i.stock_qty <= i.reorder_level,
  }));
  return { items, total_value: round2(items.reduce((a, i) => a + i.stock_value, 0)), low_stock: items.filter((i) => i.low).length };
}

export function salesByCustomer(db, from, to) {
  return db.prepare(`SELECT c.id, c.name, COUNT(d.id) AS invoices, SUM(d.subtotal - d.discount_total) AS sales, SUM(d.total) AS total
    FROM documents d JOIN contacts c ON c.id = d.contact_id WHERE d.kind = 'invoice' AND d.${ISSUED} AND d.date BETWEEN ? AND ? GROUP BY c.id ORDER BY sales DESC`).all(from, to)
    .map((r) => ({ ...r, sales: round2(r.sales), total: round2(r.total) }));
}

export function salesByItem(db, from, to) {
  return db.prepare(`SELECT i.id, i.name, i.unit, SUM(l.qty) AS qty, SUM(l.amount) AS sales, SUM(l.qty * l.cost_rate) AS cost
    FROM document_lines l JOIN documents d ON d.id = l.document_id JOIN items i ON i.id = l.item_id
    WHERE d.kind = 'invoice' AND d.${ISSUED} AND d.date BETWEEN ? AND ? GROUP BY i.id ORDER BY sales DESC`).all(from, to)
    .map((r) => ({ ...r, sales: round2(r.sales), cost: round2(r.cost), profit: round2(r.sales - r.cost) }));
}

// money in vs money out per month for the last n months
export function cashFlow(db, months = 6) {
  const out = [];
  const d = new Date(today());
  d.setDate(1);
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    const inflow = db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE direction = 'in' AND substr(date, 1, 7) = ?").get(key).v;
    const outPay = db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE direction = 'out' AND substr(date, 1, 7) = ?").get(key).v;
    const outExp = db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE substr(date, 1, 7) = ?").get(key).v;
    out.push({ month: key, in: round2(inflow), out: round2(outPay + outExp) });
  }
  return out;
}

// Job profitability (Director / Accounts): revenue from Sales + costs from Operations, per Job
export function jobProfit(db, from, to) {
  return db.prepare("SELECT j.id, j.number, j.ops_status, j.closed, c.name AS customer_name FROM jobs j JOIN contacts c ON c.id = j.customer_id WHERE date(j.created_at) BETWEEN ? AND ? ORDER BY j.id DESC").all(from, to)
    .map((j) => ({ ...j, ...jobEconomics(db, j.id) }));
}

// Role home: "what needs your attention today?" Every record that is stuck becomes an action in its owner's queue.
export function home(db, user, can) {
  const t = today();
  const soon = (n) => new Date(Date.parse(t) + n * 864e5).toISOString().slice(0, 10);
  const docs = (sql, ...args) => db.prepare(`SELECT d.*, c.name AS contact_name, j.number AS job_number, ${PAID_SQL} AS paid
    FROM documents d JOIN contacts c ON c.id = d.contact_id LEFT JOIN jobs j ON j.id = d.job_id WHERE ${sql} ORDER BY COALESCE(d.due_date, d.date), d.id`).all(...args)
    .map((d) => ({ ...d, balance: round2(d.total - d.paid) }));
  const jobs = jobList(db, { scope: "active" });
  const step = (s) => OPS_STATUSES.indexOf(s);
  const P = { quote: "quotes", invoice: "invoices", dc: "delivery-challans", po: "purchase-orders", bill: "bills" };
  const docItem = (d, sub) => ({ label: `${d.number} · ${d.contact_name}`, sub, link: `/${P[d.kind]}/${d.id}`, due: d.due_date });
  const jobItem = (j, sub) => ({ label: `${j.number} · ${j.customer_name}`, sub, link: `/jobs/${j.id}`, due: j.required_date });
  const q = (dept, key, title, items, tone = "amber") => ({ dept, key, title, tone, count: items.length, items: items.slice(0, 8) });
  const queues = [];

  if (can("sales.write")) {
    queues.push(
      q("Sales", "rate", "Enquiries waiting for rates", docs("d.kind = 'quote' AND d.status = 'enquiry'").map((d) => docItem(d, "Add selling rates and send the quote"))),
      q("Sales", "quote", "Quotes sent, waiting for customer", docs("d.kind = 'quote' AND d.status = 'sent'").map((d) => docItem(d, "Follow up for confirmation / PO")), "blue"),
      q("Sales", "nojob", "Confirmed, Job not created", docs("d.kind = 'quote' AND d.status = 'accepted'").map((d) => docItem(d, "Create the Internal Job")), "red"),
      q("Sales", "dc", "Material ready, DC needed", jobs.filter((j) => step(j.ops_status) >= step("material_ready") && j.dc_count === 0).map((j) => jobItem(j, "Create the customer DC")), "red"),
      q("Sales", "signed", "Delivered, signed DC missing", docs("d.kind = 'dc' AND d.status = 'issued'").map((d) => docItem(d, "Upload / mark signed receiving"))),
      q("Sales", "inv", "Signed DC, invoice not made", jobs.filter((j) => j.signed_dc_count > 0 && j.invoice_count === 0).map((j) => jobItem(j, "Create the customer invoice")), "red"),
      q("Sales", "draftinv", "Draft invoices", docs("d.kind = 'invoice' AND d.status = 'draft'").map((d) => docItem(d, "Review and issue"))),
      q("Sales", "submit", "Invoices not submitted to customer", docs("d.kind = 'invoice' AND d.status = 'open' AND d.submitted_date IS NULL").map((d) => docItem(d, "Submit and mark the date"))),
      q("Sales", "follow", "Overdue: follow up with customer", docs("d.kind = 'invoice' AND d.status = 'open' AND d.due_date < ?", t).filter((d) => d.balance > 0).map((d) => docItem(d, `Rs ${d.balance.toLocaleString("en-PK")} outstanding`)), "red"),
    );
  }
  if (can("buy")) {
    const plist = procurementList(db);
    queues.push(
      q("Operations", "newjob", "New Jobs to start", jobs.filter((j) => j.ops_status === "new").map((j) => jobItem(j, `${j.item_count} items · start procurement`)), "red"),
      q("Operations", "buy", "Items to buy", plist.map((g) => ({ label: `${g.name} · ${g.total_qty} ${g.unit}`, sub: `${g.jobs.length} job(s)${g.earliest ? ` · needed by ${g.earliest}` : ""}`, link: "/procurement", due: g.earliest }))),
      q("Operations", "late", "Deadline in 2 days, material not ready", jobs.filter((j) => j.required_date && j.required_date <= soon(2) && step(j.ops_status) < step("material_ready")).map((j) => jobItem(j, j.ops_status.replace(/_/g, " "))), "red"),
      q("Operations", "nobill", "Purchased but no supplier bill", jobs.filter((j) => ["partially_purchased", "purchase_complete", "material_ready", "dispatched", "delivered"].includes(j.ops_status) && j.bill_count === 0).map((j) => jobItem(j, "Add the supplier bill"))),
      q("Operations", "ready", "Bought, mark material ready", jobs.filter((j) => j.ops_status === "purchase_complete").map((j) => jobItem(j, "Tell Sales it's ready")), "blue"),
    );
  }
  if (can("verify") || can("money")) {
    queues.push(
      q("Accounts", "vbill", "Supplier bills to verify", docs("d.kind = 'bill' AND d.status = 'open' AND d.verified_at IS NULL").map((d) => docItem(d, `Rs ${d.total.toLocaleString("en-PK")}`))),
      q("Accounts", "vinv", "Invoices to verify", docs("d.kind = 'invoice' AND d.status = 'open' AND d.verified_at IS NULL").map((d) => docItem(d, `Rs ${d.total.toLocaleString("en-PK")}`))),
      q("Accounts", "collect", "Collections due (next 7 days or overdue)", docs("d.kind = 'invoice' AND d.status = 'open' AND d.due_date <= ?", soon(7)).filter((d) => d.balance > 0).map((d) => docItem(d, `Rs ${d.balance.toLocaleString("en-PK")} · due ${d.due_date}`)), "blue"),
      q("Accounts", "adv", "Advances waiting to be applied", db.prepare(`SELECT p.*, c.name AS contact_name, ${UNUSED_SQL} AS unused FROM payments p JOIN contacts c ON c.id = p.contact_id
        WHERE ${UNUSED_SQL} > 0.001 AND EXISTS (SELECT 1 FROM documents d WHERE d.contact_id = p.contact_id AND d.status = 'open' AND d.kind = CASE p.direction WHEN 'in' THEN 'invoice' ELSE 'bill' END AND d.total - ${PAID_SQL} > 0.001)
        ORDER BY p.date`).all().map((p) => ({ label: `${p.number} · ${p.contact_name}`, sub: `Rs ${round2(p.unused).toLocaleString("en-PK")} unused · open ${p.direction === "in" ? "invoices" : "bills"} exist`, link: `/payments/${p.id}` })), "blue"),
      q("Accounts", "pay", "Supplier payments due (next 7 days or overdue)", docs("d.kind = 'bill' AND d.status = 'open' AND d.due_date <= ?", soon(7)).filter((d) => d.balance > 0).map((d) => docItem(d, `Rs ${d.balance.toLocaleString("en-PK")} · due ${d.due_date}`)), "red"),
    );
  }

  const kpis = {};
  if (can("sales.read")) {
    kpis.open_quotes = round2(db.prepare("SELECT COALESCE(SUM(total), 0) AS v FROM documents WHERE kind = 'quote' AND status IN ('enquiry','draft','sent','accepted')").get().v);
    kpis.receivables = receivables(db).total;
  }
  if (can("ops.read")) {
    kpis.active_jobs = jobs.length;
    kpis.blocked_jobs = jobs.filter((j) => j.required_date && j.required_date < t && step(j.ops_status) < step("material_ready")).length;
  }
  if (can("reports.finance")) {
    kpis.payables = payables(db).total;
    kpis.month = profitAndLoss(db, t.slice(0, 8) + "01", t);
    kpis.stock_value = inventory(db).total_value;
    kpis.cash_flow = cashFlow(db, 6);
  }
  const recent = can("admin") ? db.prepare("SELECT a.*, u.name AS user_name FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 12").all()
    : db.prepare("SELECT a.*, u.name AS user_name FROM activity a LEFT JOIN users u ON u.id = a.user_id WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 8").all(user.id);
  return { queues, kpis, recent };
}
