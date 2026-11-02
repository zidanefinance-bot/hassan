// Withholding the customer deducts at source, known up front: per Job line (income tax % of the line before tax, and the
// share of its sales tax they keep, e.g. 20%). Defaults come from the customer. An invoice carries what it expects to be
// withheld, so its "cash expected" is right and the payment form fills the two tax boxes by itself.
import { round2 } from "./books.js";

export function setupWht(db) {
  const cols = (t) => db.prepare(`SELECT name FROM pragma_table_info('${t}')`).all().map((c) => c.name);
  if (!cols("job_items").includes("wht_income_pct")) db.exec("ALTER TABLE job_items ADD COLUMN wht_income_pct REAL; ALTER TABLE job_items ADD COLUMN wht_sales_pct REAL;");
  if (!cols("contacts").includes("wht_income_pct")) db.exec("ALTER TABLE contacts ADD COLUMN wht_income_pct REAL; ALTER TABLE contacts ADD COLUMN wht_sales_pct REAL;");
  if (!cols("documents").includes("wht_income_exp")) db.exec("ALTER TABLE documents ADD COLUMN wht_income_exp REAL NOT NULL DEFAULT 0; ALTER TABLE documents ADD COLUMN wht_sales_exp REAL NOT NULL DEFAULT 0;");
}

const pct = (v) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.min(100, Math.max(0, Number(v))));

// a Job line's rates: what was typed on the line (0 = none), else (left empty) the customer's defaults
export function setLineWht(db, jobItemId, line, customerId) {
  const c = db.prepare("SELECT wht_income_pct, wht_sales_pct FROM contacts WHERE id = ?").get(customerId) || {};
  const inc = pct(line.wht_income_pct) ?? c.wht_income_pct ?? null;
  const st = pct(line.wht_sales_pct) ?? c.wht_sales_pct ?? null;
  db.prepare("UPDATE job_items SET wht_income_pct = ?, wht_sales_pct = ? WHERE id = ?").run(inc, st, jobItemId);
}

// withholding on an amount before tax and its sales tax
export const whtOn = (net, tax, incPct, stPct) => ({ income: round2((net * (incPct || 0)) / 100), sales: round2((tax * (stPct || 0)) / 100) });

// per Job line and in all
export function jobWht(db, jobId) {
  const lines = db.prepare("SELECT ji.id, ji.qty, ji.sale_rate, ji.tax_rate, ji.wht_income_pct, ji.wht_sales_pct, COALESCE(i.name, ji.description) AS name FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE ji.job_id = ?").all(jobId)
    .map((l) => { const net = l.qty * l.sale_rate, tax = (net * (l.tax_rate || 0)) / 100; const w = whtOn(net, tax, l.wht_income_pct, l.wht_sales_pct); return { id: l.id, name: l.name, wht_income_pct: l.wht_income_pct, wht_sales_pct: l.wht_sales_pct, wht_income: w.income, wht_sales: w.sales, gross: round2(net + tax) }; });
  const income = round2(lines.reduce((s, l) => s + l.wht_income, 0)), sales = round2(lines.reduce((s, l) => s + l.wht_sales, 0));
  const gross = round2(lines.reduce((s, l) => s + l.gross, 0));
  return { lines, income, sales, total: round2(income + sales), gross, cash: round2(gross - income - sales) };
}

// what an invoice expects to be withheld: each line at its Job line's rates (matched by item), else the customer's
export function syncInvoiceWht(db, invoiceId) {
  const d = db.prepare("SELECT * FROM documents WHERE id = ?").get(invoiceId);
  if (!d || d.kind !== "invoice") return;
  const c = db.prepare("SELECT wht_income_pct, wht_sales_pct FROM contacts WHERE id = ?").get(d.contact_id) || {};
  const jobLines = d.job_id ? db.prepare("SELECT item_id, description, wht_income_pct, wht_sales_pct FROM job_items WHERE job_id = ?").all(d.job_id) : [];
  const docLines = db.prepare("SELECT item_id, description, amount, tax_rate FROM document_lines WHERE document_id = ?").all(invoiceId);
  // the invoice's own discount / charges move each line's share the same way as its totals
  const factor = d.subtotal - d.discount_total > 0 ? (d.subtotal - d.discount_total - (d.doc_discount || 0) + (d.charges || 0)) / (d.subtotal - d.discount_total) : 1;
  let inc = 0, st = 0;
  for (const l of docLines) {
    const j = jobLines.find((x) => (l.item_id ? x.item_id === l.item_id : (x.description || "").toLowerCase() === (l.description || "").toLowerCase()));
    const ip = j ? j.wht_income_pct : c.wht_income_pct, sp = j ? j.wht_sales_pct : c.wht_sales_pct;
    const net = l.amount * factor, tax = (l.amount * (l.tax_rate || 0)) / 100;
    const w = whtOn(net, tax, ip, sp);
    inc += w.income; st += w.sales;
  }
  db.prepare("UPDATE documents SET wht_income_exp = ?, wht_sales_exp = ? WHERE id = ?").run(round2(inc), round2(st), invoiceId);
}

// what is still expected to be withheld on an invoice: expected less what payments already recorded as withheld
export function whtOutstanding(db, d) {
  const got = db.prepare("SELECT COALESCE(SUM(p.wht_income), 0) AS i, COALESCE(SUM(p.wht_sales), 0) AS s FROM payment_allocations a JOIN payments p ON p.id = a.payment_id WHERE a.document_id = ?").get(d.id);
  return { income: round2(Math.max(0, (d.wht_income_exp || 0) - got.i)), sales: round2(Math.max(0, (d.wht_sales_exp || 0) - got.s)) };
}
