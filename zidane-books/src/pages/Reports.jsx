import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Badge, fmtDate, KIND, Loading, money, num, PageHead, today, useAuth, useLoad } from "../lib.jsx";

const TABS = [["pnl", "Profit & Loss", "reports.finance"], ["job-profit", "Job profit", "profit.view"], ["receivables", "Receivables", "*"], ["payables", "Payables", "reports.finance"], ["inventory", "Inventory", "reports.finance"], ["sales-by-customer", "Sales by customer", "*"], ["sales-by-item", "Sales by item", "reports.finance"], ["tax", "Sales tax", "reports.finance"], ["balance-sheet", "Balance sheet", "reports.finance"], ["trial-balance", "Trial balance", "reports.finance"]];
const AS_OF = ["balance-sheet", "trial-balance"];
const RANGED = ["pnl", "job-profit", "sales-by-customer", "sales-by-item", "tax"];
// one-click periods next to the dates
const iso = (d) => d.toISOString().slice(0, 10);
function periods() {
  const t = today(), [y, m] = t.split("-").map(Number), q = Math.floor((m - 1) / 3) * 3;
  return [
    ["This month", `${t.slice(0, 8)}01`, t],
    ["Last month", iso(new Date(Date.UTC(y, m - 2, 1))), iso(new Date(Date.UTC(y, m - 1, 0)))],
    ["This quarter", iso(new Date(Date.UTC(y, q, 1))), t],
    ["Last 6 months", iso(new Date(Date.UTC(y, m - 6, 1))), t],
    ["This year", `${y}-01-01`, t],
    ["All time", "2000-01-01", t],
  ];
}

function csv(name, header, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob([[header, ...rows].map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${name}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

const EXP = [["late", "Late"], ["today", "Today"], ["1-10", "1–10 days"], ["11-20", "11–20 days"], ["21-30", "21–30 days"], ["30+", "30+ days"]];
function Aging({ d, kind }) {
  const b = ["current", "1-30", "31-60", "61-90", "90+"];
  return (
    <>
      <h3>Expected {kind === "invoice" ? "from customers" : "to suppliers"}, by due date</h3>
      <div className="card flush"><table className="table">
        <thead><tr><th>{kind === "invoice" ? "Customer" : "Supplier"}</th>{EXP.map(([k, l]) => <th key={k} className={`r ${k === "late" ? "neg" : ""}`}>{l}</th>)}<th className="r">Total</th></tr></thead>
        <tbody>{d.contacts.map((c) => <tr key={c.contact_id}><td><Link to={`/contacts/${c.contact_id}`}>{c.name}</Link></td>{EXP.map(([k]) => <td key={k} className={`r ${k === "late" && c.expected[k] ? "neg" : ""}`}>{c.expected[k] ? money(c.expected[k]) : "—"}</td>)}<td className="r"><b>{money(c.total)}</b></td></tr>)}</tbody>
        <tfoot><tr><td>Total</td>{EXP.map(([k]) => <td key={k} className="r">{money(d.expected[k])}</td>)}<td className="r">{money(d.total)}</td></tr></tfoot>
      </table></div>
      <h3>How late</h3>
      <div className="stats">{b.map((k) => <div key={k} className="stat"><small>{k === "current" ? "Within credit days (not late)" : `${k} days late`}</small><b className={k !== "current" && d.buckets[k] ? "neg" : ""}>{money(d.buckets[k])}</b></div>)}</div>
      <div className="card flush"><table className="table">
        <thead><tr><th>{kind === "invoice" ? "Customer" : "Supplier"}</th>{b.map((k) => <th key={k} className="r">{k}</th>)}<th className="r">Total</th></tr></thead>
        <tbody>{d.contacts.map((c) => <tr key={c.contact_id}><td><Link to={`/contacts/${c.contact_id}`}>{c.name}</Link></td>{b.map((k) => <td key={k} className="r">{c[k] ? money(c[k]) : "—"}</td>)}<td className="r"><b>{money(c.total)}</b></td></tr>)}</tbody>
        <tfoot><tr><td>Total</td>{b.map((k) => <td key={k} className="r">{money(d.buckets[k])}</td>)}<td className="r">{money(d.total)}</td></tr></tfoot>
      </table></div>
      <h3>Open {kind === "invoice" ? "invoices" : "bills"}</h3>
      <div className="card flush"><table className="table">
        <thead><tr><th>Number</th><th>{kind === "invoice" ? "Customer" : "Supplier"}</th><th>Due</th><th>Days</th><th className="r">Total</th><th className="r">Balance</th></tr></thead>
        <tbody>{d.documents.map((x) => <tr key={x.id}><td><Link to={`/${KIND[kind].path}/${x.id}`}>{x.number}</Link></td><td>{x.contact_name}</td><td>{fmtDate(x.due_date)}</td>
          <td className={x.due_in < 0 ? "neg" : "muted"}>{x.due_in < 0 ? `${-x.due_in} day${x.due_in === -1 ? "" : "s"} late` : x.due_in === 0 ? "today" : `in ${x.due_in} day${x.due_in === 1 ? "" : "s"}`}</td><td className="r">{money(x.total)}</td><td className="r">{money(x.balance)}</td></tr>)}</tbody>
      </table></div>
    </>
  );
}

function Report({ tab, data: d }) {
  if (tab === "pnl") return (
    <div className="card pnl">
      <p className="muted">{fmtDate(d.from)} – {fmtDate(d.to)}</p>
      <dl className="statement">
        <dt>Sales (excl. tax{d.returns ? ", after credit notes" : ""})</dt><dd>{money(d.revenue)}</dd>
        {d.returns > 0 && <><dt className="indent">Credit notes / returns</dt><dd className="muted">− {money(d.returns)} (included above)</dd></>}
        <dt>Cost of goods sold</dt><dd>− {money(d.cogs)}</dd>
        <dt className="sub">Gross profit <span className="muted">({d.gross_margin}%)</span></dt><dd className="sub">{money(d.gross_profit)}</dd>
        {d.expense_breakdown.map((e) => <React.Fragment key={e.category}><dt className="indent">{e.category}</dt><dd className="muted">− {money(e.amount)}</dd></React.Fragment>)}
        <dt>Total expenses</dt><dd>− {money(d.expenses)}</dd>
        <dt className="grand">Net profit</dt><dd className={`grand ${d.net_profit < 0 ? "neg" : "pos"}`}>{money(d.net_profit)}</dd>
      </dl>
      <p className="muted small">Cost of goods sold uses each item's purchase rate at the time it was invoiced. Sales tax collected ({money(d.tax_collected)}) is not income.</p>
    </div>
  );
  if (tab === "job-profit") {
    if (d.length === 0) return <div className="empty">No Jobs created in this period. Pick "All time" above to see every Job.</div>;
    const sum = (f) => d.reduce((s, j) => s + f(j), 0);
    const rev = sum((j) => (j.revenue_basis === "invoiced" ? j.invoiced_revenue : j.expected_revenue)), gp = sum((j) => j.gross_profit);
    return (<>
    <div className="stats">
      <div className="stat"><small>Jobs</small><b>{d.length}</b></div>
      <div className="stat"><small>Revenue</small><b>{money(rev)}</b></div>
      <div className="stat"><small>Gross profit</small><b className={gp < 0 ? "neg" : "pos"}>{money(gp)}</b></div>
      <div className="stat"><small>Margin</small><b>{rev ? Math.round((gp / rev) * 1000) / 10 : 0}%</b></div>
      <div className="stat"><small>Profit not final yet</small><b className={d.some((j) => j.cost_pending) ? "neg" : ""}>{d.filter((j) => j.cost_pending).length} Jobs</b></div>
    </div>
    <p className="muted small">Jobs created in the dates above. Click a heading to sort.</p>
    <div className="card flush"><table className="table">
      <thead><tr><th>Job</th><th>Customer</th><th>Status</th><th className="r">Revenue</th><th className="r">Purchases</th><th className="r">Direct costs</th><th className="r">Gross profit</th><th className="r">Margin</th></tr></thead>
      <tbody>{d.map((j) => <tr key={j.id}><td><Link to={`/jobs/${j.id}`}>{j.number}</Link></td><td>{j.customer_name}</td><td><Badge status={j.ops_status} /></td>
        <td className="r">{money(j.revenue_basis === "invoiced" ? j.invoiced_revenue : j.expected_revenue)}{j.revenue_basis === "expected" && <div className="muted small">expected</div>}</td>
        <td className="r">{money(j.purchases + j.stock_cost)}{j.cost_pending && <div className="neg small">cost pending</div>}</td><td className="r">{money(j.direct_costs)}</td>
        <td className={`r ${j.gross_profit < 0 ? "neg" : "pos"}`}><b>{money(j.gross_profit)}</b></td><td className="r">{j.margin_pct}%</td></tr>)}</tbody>
      <tfoot><tr><td>Total ({d.length})</td><td /><td /><td className="r">{money(rev)}</td><td className="r">{money(sum((j) => j.purchases + j.stock_cost))}</td><td className="r">{money(sum((j) => j.direct_costs))}</td><td className="r"><b>{money(gp)}</b></td><td className="r">{rev ? Math.round((gp / rev) * 1000) / 10 : 0}%</td></tr></tfoot>
    </table></div>
  </>);
  }
  if (tab === "receivables") return <Aging d={d} kind="invoice" />;
  if (tab === "payables") return <Aging d={d} kind="bill" />;
  if (tab === "inventory") return (
    <>
      <div className="stats"><div className="stat"><small>Stock value at cost</small><b>{money(d.total_value)}</b></div><div className="stat"><small>Low stock items</small><b className={d.low_stock ? "neg" : ""}>{d.low_stock}</b></div></div>
      <div className="card flush"><table className="table">
        <thead><tr><th>Item</th><th className="r">In stock</th><th className="r">Reorder at</th><th className="r">Cost</th><th className="r">Value</th><th className="r">Margin</th></tr></thead>
        <tbody>{d.items.map((i) => <tr key={i.id}><td><Link to={`/items/${i.id}`}>{i.name}</Link></td><td className={`r ${i.low ? "neg" : ""}`}>{num(i.stock_qty)} {i.unit}</td><td className="r">{num(i.reorder_level)}</td><td className="r">{money(i.purchase_rate)}</td><td className="r">{money(i.stock_value)}</td><td className="r">{i.margin_pct}%</td></tr>)}</tbody>
      </table></div>
    </>
  );
  if (tab === "sales-by-customer") return (
    <div className="card flush"><table className="table">
      <thead><tr><th>Customer</th><th className="r">Invoices</th><th className="r">Sales (excl. tax)</th><th className="r">Total billed</th></tr></thead>
      <tbody>{d.map((r) => <tr key={r.id}><td><Link to={`/contacts/${r.id}`}>{r.name}</Link></td><td className="r">{r.invoices}</td><td className="r">{money(r.sales)}</td><td className="r">{money(r.total)}</td></tr>)}</tbody>
    </table></div>
  );
  if (tab === "sales-by-item") return (
    <div className="card flush"><table className="table">
      <thead><tr><th>Item</th><th className="r">Qty sold</th><th className="r">Sales</th><th className="r">Cost</th><th className="r">Profit</th></tr></thead>
      <tbody>{d.map((r) => <tr key={r.id}><td>{r.name}</td><td className="r">{num(r.qty)} {r.unit}</td><td className="r">{money(r.sales)}</td><td className="r">{money(r.cost)}</td><td className={`r ${r.profit < 0 ? "neg" : "pos"}`}>{money(r.profit)}</td></tr>)}</tbody>
    </table></div>
  );
  if (tab === "tax") return (
    <div className="card pnl"><dl className="statement">
      <dt>Output tax (on sales invoices)</dt><dd>{money(d.output_tax)}</dd>
      <dt>Input tax (on supplier bills)</dt><dd>− {money(d.input_tax)}</dd>
      <dt className="grand">Net tax payable</dt><dd className="grand">{money(d.net_payable)}</dd>
      {d.withheld_by_customers && <>
        <dt className="sub">Withheld by customers on their payments (claim it)</dt><dd className="sub">{money(d.withheld_by_customers.income + d.withheld_by_customers.sales)}</dd>
        <dt className="indent">Income tax</dt><dd className="muted">{money(d.withheld_by_customers.income)}</dd>
        <dt className="indent">Sales tax</dt><dd className="muted">{money(d.withheld_by_customers.sales)}</dd>
        <dt className="sub">Withheld by us on supplier payments (deposit it)</dt><dd className="sub">{money(d.withheld_by_us.income + d.withheld_by_us.sales)}</dd>
      </>}
    </dl><p className="muted small">A summary from your documents, to help with filing. Check figures with your tax advisor.</p></div>
  );
  if (tab === "balance-sheet") {
    const Section = ({ title, rows, total }) => (
      <><dt className="sub">{title}</dt><dd className="sub">{money(total)}</dd>
        {rows.map((a) => <React.Fragment key={a.id}><dt className="indent"><Link to={`/accounts/${a.id}`}>{a.name}</Link></dt><dd className={`muted ${a.balance < 0 ? "neg" : ""}`}>{money(a.balance)}</dd></React.Fragment>)}</>
    );
    return (
      <div className="card pnl">
        <p className="muted">As of {fmtDate(d.to)}</p>
        <dl className="statement">
          <Section title="Assets" rows={d.assets} total={d.total_assets} />
          <Section title="Liabilities" rows={d.liabilities} total={d.total_liabilities} />
          <Section title="Equity" rows={d.equity} total={d.total_equity - d.profit_to_date} />
          <dt className="indent">Profit to date (not yet moved to equity)</dt><dd className={`muted ${d.profit_to_date < 0 ? "neg" : ""}`}>{money(d.profit_to_date)}</dd>
          <dt className="grand">Liabilities + equity</dt><dd className="grand">{money(d.total_liabilities + d.total_equity)}</dd>
        </dl>
        <p className={`small ${d.balanced ? "pos" : "neg"}`}>{d.balanced ? "✓ Balanced: assets = liabilities + equity." : "✕ Not balanced. Please tell us."}</p>
        <p className="muted small">Accounts receivable is net of customers' unused advances. Inventory is at the cost on bills less the cost of what was sold, so it can differ from the stock report.</p>
      </div>
    );
  }
  if (tab === "trial-balance") return (
    <div className="card flush"><table className="table">
      <thead><tr><th>Code</th><th>Account</th><th className="r">Debit</th><th className="r">Credit</th></tr></thead>
      <tbody>{d.rows.map((r) => <tr key={r.id}><td className="muted">{r.code}</td><td><Link to={`/accounts/${r.id}`}>{r.name}</Link></td><td className="r">{r.debit ? money(r.debit) : ""}</td><td className="r">{r.credit ? money(r.credit) : ""}</td></tr>)}</tbody>
      <tfoot><tr><td /><td>Total {d.balanced ? "✓" : "✕ not equal"}</td><td className="r">{money(d.debit)}</td><td className="r">{money(d.credit)}</td></tr></tfoot>
    </table></div>
  );
  return null;
}

function toCsv(tab, d) {
  if (tab === "pnl") return [["Line", "Amount"], [["Sales", d.revenue], ["COGS", d.cogs], ["Gross profit", d.gross_profit], ...d.expense_breakdown.map((e) => [e.category, e.amount]), ["Expenses", d.expenses], ["Net profit", d.net_profit]]];
  if (tab === "receivables" || tab === "payables") return [["Contact", ...EXP.map(([, l]) => `Due: ${l}`), "Late 1-30", "Late 31-60", "Late 61-90", "Late 90+", "Total"], d.contacts.map((c) => [c.name, ...EXP.map(([k]) => c.expected[k]), c["1-30"], c["31-60"], c["61-90"], c["90+"], c.total])];
  if (tab === "inventory") return [["Item", "SKU", "Stock", "Unit", "Cost", "Value", "Sale rate"], d.items.map((i) => [i.name, i.sku, i.stock_qty, i.unit, i.purchase_rate, i.stock_value, i.sale_rate])];
  if (tab === "sales-by-customer") return [["Customer", "Invoices", "Sales", "Total"], d.map((r) => [r.name, r.invoices, r.sales, r.total])];
  if (tab === "sales-by-item") return [["Item", "Qty", "Sales", "Cost", "Profit"], d.map((r) => [r.name, r.qty, r.sales, r.cost, r.profit])];
  if (tab === "job-profit") return [["Job", "Customer", "Status", "Revenue", "Purchases", "Direct costs", "Gross profit", "Margin %"], d.map((j) => [j.number, j.customer_name, j.ops_status, j.revenue_basis === "invoiced" ? j.invoiced_revenue : j.expected_revenue, j.purchases + j.stock_cost, j.direct_costs, j.gross_profit, j.margin_pct])];
  if (tab === "trial-balance") return [["Code", "Account", "Debit", "Credit"], d.rows.map((r) => [r.code, r.name, r.debit, r.credit])];
  if (tab === "balance-sheet") return [["Section", "Account", "Balance"], [...d.assets.map((a) => ["Assets", a.name, a.balance]), ...d.liabilities.map((a) => ["Liabilities", a.name, a.balance]), ...d.equity.map((a) => ["Equity", a.name, a.balance]), ["Equity", "Profit to date", d.profit_to_date]]];
  return [["Line", "Amount"], [["Output tax", d.output_tax], ["Input tax", d.input_tax], ["Net payable", d.net_payable]]];
}

export default function Reports() {
  const { can } = useAuth();
  const tabs = TABS.filter(([, , p]) => p === "*" || can(p));
  // the dashboard links here with ?tab=…&from=…&to=…
  const qs = new URLSearchParams(useLocation().search);
  const [tab, setTab] = useState(tabs.some(([k]) => k === qs.get("tab")) ? qs.get("tab") : tabs[0][0]);
  const [from, setFrom] = useState(qs.get("from") || (qs.get("tab") === "job-profit" ? "2000-01-01" : today().slice(0, 8) + "01"));
  const [to, setTo] = useState(qs.get("to") || today());
  // Job profit lists every Job by default; the money reports stay on this month
  const pickTab = (k) => {
    if (k === "job-profit" && from === today().slice(0, 8) + "01" && to === today()) setFrom("2000-01-01");
    else if (k !== "job-profit" && tab === "job-profit" && from === "2000-01-01") setFrom(today().slice(0, 8) + "01");
    setTab(k);
  };
  const path = `/reports/${tab}${RANGED.includes(tab) ? `?from=${from}&to=${to}` : AS_OF.includes(tab) ? `?to=${to}` : ""}`;
  const loaded = useLoad(path);
  const state = loaded.path === path ? loaded : { ...loaded, data: null, loading: true }; // don't render one tab's data with another tab's view
  return (
    <>
      <PageHead title="Reports">
        {AS_OF.includes(tab) && <><span className="muted">As of</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></>}
        {RANGED.includes(tab) && <select value={periods().find(([, f, t]) => f === from && t === to)?.[0] || ""} onChange={(e) => { const p = periods().find(([n]) => n === e.target.value); if (p) { setFrom(p[1]); setTo(p[2]); } }}>
          <option value="">Custom dates</option>{periods().map(([n]) => <option key={n}>{n}</option>)}</select>}
        {RANGED.includes(tab) && <><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span className="muted">to</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></>}
        <button className="btn" disabled={!state.data} onClick={() => csv(`zidane-${tab}-${today()}`, ...toCsv(tab, state.data))}>Export CSV</button>
        <button className="btn" onClick={() => window.print()}>Print</button>
      </PageHead>
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => pickTab(k)}>{l}</button>)}</div>
      <Loading state={state}>{(d) => <Report tab={tab} data={d} />}</Loading>
    </>
  );
}
