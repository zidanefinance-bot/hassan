// Reports. P&L is document-based: sales (ex-tax) − cost of goods sold (cost captured on each invoice line) − expenses.
import { round2, today, displayStatus } from "./books.js";

const ISSUED = "status = 'open'";

function balances(db, kind, on = today()) {
  return db.prepare(`SELECT d.*, c.name AS contact_name, COALESCE((SELECT SUM(amount) FROM payments p WHERE p.document_id = d.id), 0) AS paid
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

export const receivables = (db) => aging(balances(db, "invoice"));
export const payables = (db) => aging(balances(db, "bill"));

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

export function dashboard(db) {
  const t = today(), monthStart = t.slice(0, 8) + "01";
  const rec = receivables(db), pay = payables(db);
  return {
    receivables: { total: rec.total, overdue: round2(rec.total - rec.buckets.current) },
    payables: { total: pay.total, overdue: round2(pay.total - pay.buckets.current) },
    month: profitAndLoss(db, monthStart, t),
    cash_flow: cashFlow(db, 6),
    inventory: (({ total_value, low_stock }) => ({ total_value, low_stock }))(inventory(db)),
    top_customers: salesByCustomer(db, monthStart.slice(0, 5) + "01-01", t).slice(0, 5),
    recent: db.prepare("SELECT a.*, u.name AS user_name FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 12").all(),
  };
}
