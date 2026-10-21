// Finance home for directors: where the money is, what comes in and goes out over the next weeks, and how healthy
// the business is. The forecast rests on a few assumptions the director can change (opening cash, fixed costs,
// how late each customer pays, WHT, margin on orders in hand); anything left blank is worked out from history.
import { getSetting, round2, today } from "./books.js";
import { inventory, payables, profitAndLoss, receivables } from "./reports.js";
import { LINE_COST, LINE_JOB } from "./jobs.js";

const DAY = 864e5;
const addDays = (d, n) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const monthStart = (d, back = 0) => { const x = new Date(`${d.slice(0, 7)}-01T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() - back); return x.toISOString().slice(0, 10); };

export const DEFAULT_ASSUMPTIONS = { openingCash: null, openingDate: null, monthlyFixed: null, whtPct: 0, marginPct: null, defaultDelay: null, delays: {} };
export const assumptionsOf = (db) => ({ ...DEFAULT_ASSUMPTIONS, ...(getSetting(db, "financeAssumptions") || {}) });

// how many days after the due date each customer really pays (fully paid invoices only)
export function paymentHabits(db) {
  const rows = db.prepare(`SELECT d.contact_id, d.due_date, d.date, MAX(a.date) AS paid_on FROM documents d JOIN payment_allocations a ON a.document_id = d.id
    WHERE d.kind = 'invoice' AND d.status = 'open' GROUP BY d.id HAVING SUM(a.amount) >= d.total - 0.01`).all();
  const by = {};
  for (const r of rows) {
    const late = days(r.due_date || r.date, r.paid_on);
    (by[r.contact_id] ||= []).push(late);
  }
  return Object.fromEntries(Object.entries(by).map(([id, l]) => [id, { invoices: l.length, avg_late: Math.round(l.reduce((a, b) => a + b, 0) / l.length) }]));
}
const habitLabel = (h) => (!h ? "No history yet" : h.avg_late <= 3 ? "Pays on time" : h.avg_late <= 15 ? "A bit late" : "Pays late");

// bank + cash today: what the director said it was on a date, plus everything paid in and out since
function cashNow(db, a) {
  if (a.openingCash === null || a.openingCash === "" || !a.openingDate) return null;
  const since = a.openingDate;
  const sum = (sql, ...p) => db.prepare(sql).get(...p).v || 0;
  const inn = sum("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE direction = 'in' AND date > ?", since);
  const out = sum("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE direction = 'out' AND date > ?", since);
  const exp = sum("SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE date > ?", since);
  const refOut = sum("SELECT COALESCE(SUM(r.amount), 0) AS v FROM refunds r JOIN contacts c ON c.id = r.contact_id WHERE c.type = 'customer' AND r.date > ?", since);
  const refIn = sum("SELECT COALESCE(SUM(r.amount), 0) AS v FROM refunds r JOIN contacts c ON c.id = r.contact_id WHERE c.type = 'supplier' AND r.date > ?", since);
  return round2(Number(a.openingCash) + inn - out - exp - refOut + refIn);
}

export function financeHome(db) {
  const t = today();
  const a = assumptionsOf(db);
  const habits = paymentHabits(db);
  const delayFor = (cid) => {
    if (a.delays?.[cid] !== undefined && a.delays[cid] !== "") return Number(a.delays[cid]);
    if (habits[cid]) return Math.max(0, habits[cid].avg_late);
    return a.defaultDelay !== null && a.defaultDelay !== "" ? Number(a.defaultDelay) : 0;
  };
  const wht = (Number(a.whtPct) || 0) / 100;
  const termsDefault = getSetting(db, "paymentTermsDays") ?? 0;

  // history the blanks fall back on: last 3 full months
  const m0 = monthStart(t, 3), m1 = addDays(monthStart(t), -1);
  const fixedAuto = round2((db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE job_id IS NULL AND date BETWEEN ? AND ?").get(m0, m1).v || 0) / 3);
  const pl3 = profitAndLoss(db, m0, m1);
  const marginAuto = pl3.revenue ? pl3.gross_margin : 15;
  const monthlyFixed = a.monthlyFixed !== null && a.monthlyFixed !== "" ? Number(a.monthlyFixed) : fixedAuto;
  const margin = a.marginPct !== null && a.marginPct !== "" ? Number(a.marginPct) : marginAuto;

  // 12 weeks from today
  const weeks = Array.from({ length: 12 }, (_, i) => ({ from: addDays(t, i * 7), to: addDays(t, i * 7 + 6), in: 0, out: 0, items: [] }));
  const put = (date, amount, dir, label) => {
    if (!(amount > 0.5)) return;
    const k = Math.max(0, Math.floor(days(t, date < t ? t : date) / 7));
    if (k >= weeks.length) return;
    weeks[k][dir] = round2(weeks[k][dir] + amount);
    weeks[k].items.push({ dir, label, amount: round2(amount), date: date < t ? t : date });
  };

  const rec = receivables(db);
  const customers = {};
  for (const d of rec.documents) {
    const expected = addDays(d.due_date || d.date, delayFor(d.contact_id));
    put(expected, d.balance * (1 - wht), "in", `${d.number} · ${d.contact_name}`);
    const c = (customers[d.contact_id] ||= { id: d.contact_id, name: d.contact_name, owed: 0, overdue: 0, next_date: null, next_amount: 0, this_week: 0 });
    c.owed = round2(c.owed + d.balance);
    if ((d.due_date || d.date) < t) c.overdue = round2(c.overdue + d.balance);
    const when = expected < t ? t : expected;
    if (!c.next_date || when < c.next_date) { c.next_date = when; c.next_amount = d.balance; } else if (when === c.next_date) c.next_amount = round2(c.next_amount + d.balance);
    if (when <= addDays(t, 6)) c.this_week = round2(c.this_week + d.balance);
  }
  // orders in hand: invoiced when due (or in a week), then paid after the customer's terms and habits
  const jobs = db.prepare(`SELECT j.id, j.number, j.customer_id, j.required_date, c.name, c.payment_terms_days,
      (SELECT COALESCE(SUM(qty * sale_rate), 0) FROM job_items WHERE job_id = j.id) AS value_ex,
      (SELECT COALESCE(SUM(qty * sale_rate * (1 + tax_rate / 100.0)), 0) FROM job_items WHERE job_id = j.id) AS value,
      (SELECT COALESCE(SUM(total), 0) FROM documents WHERE job_id = j.id AND kind = 'invoice' AND status = 'open') AS invoiced,
      (SELECT COALESCE(SUM(${LINE_COST}), 0) FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE ${LINE_JOB} = j.id AND d.kind = 'bill' AND d.status IN ('open','draft')) AS billed
    FROM jobs j JOIN contacts c ON c.id = j.customer_id WHERE j.closed = 0`).all();
  let inHand = 0;
  for (const j of jobs) {
    const left = Math.max(0, j.value - j.invoiced);
    inHand += left;
    const invoiceOn = j.required_date && j.required_date > t ? j.required_date : addDays(t, 7);
    put(addDays(invoiceOn, (j.payment_terms_days ?? termsDefault) + delayFor(j.customer_id)), left * (1 - wht), "in", `${j.number} · ${j.name} (not invoiced yet)`);
    // what still has to be bought for it, at the assumed margin
    const toBuy = Math.max(0, j.value_ex * (1 - margin / 100) - j.billed);
    put(j.required_date && j.required_date > t ? addDays(j.required_date, -3) : addDays(t, 3), toBuy, "out", `${j.number} · buying for ${j.name}`);
  }
  const pay = payables(db);
  for (const b of pay.documents) put(b.due_date || b.date, b.balance, "out", `${b.number} · ${b.contact_name}`);
  for (const w of weeks) { w.out = round2(w.out + (monthlyFixed * 12) / 52); w.items.push({ dir: "out", label: "Fixed costs (rent, salaries …)", amount: round2((monthlyFixed * 12) / 52), date: w.from }); }

  const start = cashNow(db, a);
  let bal = start ?? 0;
  for (const w of weeks) { w.closing = bal = round2(bal + w.in - w.out); w.items.sort((x, y) => y.amount - x.amount); w.items = w.items.slice(0, 8); }
  const firstShort = weeks.find((w) => w.closing < 0);

  // health
  const pm = profitAndLoss(db, monthStart(t), t), plm = profitAndLoss(db, monthStart(t, 1), addDays(monthStart(t), -1));
  const d90 = addDays(t, -89);
  const sales90 = db.prepare("SELECT COALESCE(SUM(total), 0) AS v FROM documents WHERE kind = 'invoice' AND status = 'open' AND date >= ?").get(d90).v;
  const buys90 = db.prepare("SELECT COALESCE(SUM(total), 0) AS v FROM documents WHERE kind = 'bill' AND status = 'open' AND date >= ?").get(d90).v;
  const stock = inventory(db).total_value;
  const custList = Object.values(customers).map((c) => ({ ...c, habit: habits[c.id] || null, habit_label: habitLabel(habits[c.id]), delay_used: delayFor(c.id), delay_set: a.delays?.[c.id] ?? null })).sort((x, y) => y.owed - x.owed);
  const top = custList[0];
  const whtYear = db.prepare("SELECT COALESCE(SUM(wht_income + wht_sales), 0) AS v FROM payments WHERE direction = 'in' AND date >= ?").get(`${t.slice(0, 4)}-01-01`).v;

  return {
    today: t,
    assumptions: { ...a, monthlyFixed_used: monthlyFixed, monthlyFixed_auto: fixedAuto, marginPct_used: margin, marginPct_auto: marginAuto },
    cash: { now: start, after_12_weeks: weeks.at(-1).closing, first_short_week: firstShort ? { from: firstShort.from, closing: firstShort.closing } : null, lowest: Math.min(...weeks.map((w) => w.closing)) },
    weeks,
    customers: custList,
    totals: { receivables: rec.total, overdue: round2(rec.documents.filter((d) => (d.due_date || d.date) < t).reduce((s, d) => s + d.balance, 0)), payables: pay.total, orders_in_hand: round2(inHand), stock },
    health: {
      month: { revenue: pm.revenue, gross_margin: pm.gross_margin, net_profit: pm.net_profit }, last_month: { revenue: plm.revenue, gross_margin: plm.gross_margin, net_profit: plm.net_profit },
      dso: sales90 ? Math.round(rec.total / (sales90 / 90)) : null,
      dpo: buys90 ? Math.round(pay.total / (buys90 / 90)) : null,
      tied_up: round2(rec.total + stock),
      top_customer: top && rec.total ? { name: top.name, share: Math.round((top.owed / rec.total) * 100) } : null,
      wht_to_claim_year: round2(whtYear),
    },
  };
}
