// Role home: "What needs your attention today?" Action queues first, then only the numbers each role needs.
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { addDays, fmtDate, Loading, money, PageHead, today, useAuth, useLoad } from "../lib.jsx";

// period picker presets: [label, from, to]
const monthStart = (d, back = 0) => { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() - back); return x.toISOString().slice(0, 10); };
const PERIODS = {
  month: ["This month", () => [monthStart(today()), today()]],
  last: ["Last month", () => [monthStart(today(), 1), addDays(monthStart(today()), -1)]],
  d30: ["Last 30 days", () => [addDays(today(), -29), today()]],
  quarter: ["Last 3 months", () => [monthStart(today(), 2), today()]],
  year: ["This year", () => [today().slice(0, 4) + "-01-01", today()]],
};
const change = (now, before) => (before ? Math.round(((now - before) / Math.abs(before)) * 100) : null);
// a loss is never shown as good news, whatever it did against last time
const Delta = ({ now, before }) => {
  const c = change(now, before);
  if (c === null) return null;
  const good = c >= 0 && now >= 0;
  return <span className={good ? "pos" : "neg"}>{c >= 0 ? "▲" : "▼"} {Math.abs(c)}% vs previous period{now < 0 ? " · loss" : ""}</span>;
};

// a KPI card; with `to` the whole card opens the detail
function Stat({ label, value, sub, to, tone }) {
  const body = <><small>{label}</small><b className={tone || ""}>{value}</b>{sub}</>;
  return to ? <Link className="stat link" to={to}>{body}</Link> : <div className="stat">{body}</div>;
}

function Bars({ rows, value, label }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <div className="chart">
      {rows.map((r) => (
        <div key={label(r)} className="chart-col" title={`${label(r)}: ${money(value(r))}`}>
          <div className="bars"><div className="bar in" style={{ height: `${(value(r) / max) * 100}%` }} /></div>
          <span>{label(r)}</span>
        </div>
      ))}
    </div>
  );
}

// money still to come in / go out, by when it falls due
const EXPECTED = [["late", "Already late"], ["today", "Due today"], ["1-10", "In 1–10 days"], ["11-20", "In 11–20 days"], ["21-30", "In 21–30 days"], ["30+", "After 30 days"]];
function Expected({ inn, out }) {
  return (
    <section className="card">
      <div className="card-head"><h3>Payments expected</h3><Link className="btn sm ghost" to="/reports?tab=receivables">Details</Link></div>
      <table className="table compact"><thead><tr><th>When due</th>{inn && <th className="r">From customers</th>}{out && <th className="r">To suppliers</th>}</tr></thead>
        <tbody>{EXPECTED.map(([k, l]) => (
          <tr key={k}><td className={k === "late" ? "neg" : ""}>{l}</td>
            {inn && <td className={`r ${k === "late" && inn[k] ? "neg" : ""}`}>{inn[k] ? money(inn[k]) : "—"}</td>}
            {out && <td className={`r ${k === "late" && out[k] ? "neg" : ""}`}>{out[k] ? money(out[k]) : "—"}</td>}</tr>
        ))}</tbody></table>
    </section>
  );
}

const AGE = [["current", "Within credit days"], ["1-30", "1–30 days late"], ["31-60", "31–60"], ["61-90", "61–90"], ["90+", "90+"]];
function AgingBar({ buckets }) {
  const total = AGE.reduce((a, [k]) => a + (buckets[k] || 0), 0);
  if (!total) return <p className="muted small">Nothing outstanding.</p>;
  return (
    <>
      <div className="agebar">{AGE.map(([k]) => buckets[k] > 0 && <span key={k} className={`age-${k.replace("+", "p")}`} style={{ width: `${(buckets[k] / total) * 100}%` }} title={`${k}: ${money(buckets[k])}`} />)}</div>
      <div className="agelegend">{AGE.map(([k, l]) => <span key={k}><i className={`age-${k.replace("+", "p")}`} />{l}<b>{money(buckets[k] || 0)}</b></span>)}</div>
    </>
  );
}

const monthLabel = (m) => new Date(m + "-01").toLocaleDateString("en-GB", { month: "short" });

function CashChart({ rows }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.in, r.out]));
  return (
    <div className="chart">
      {rows.map((r) => (
        <div key={r.month} className="chart-col" title={`${r.month}\nIn: ${money(r.in)}\nOut: ${money(r.out)}`}>
          <div className="bars"><div className="bar in" style={{ height: `${(r.in / max) * 100}%` }} /><div className="bar out" style={{ height: `${(r.out / max) * 100}%` }} /></div>
          <span>{new Date(r.month + "-01").toLocaleDateString("en-GB", { month: "short" })}</span>
        </div>
      ))}
    </div>
  );
}

function Queue({ q }) {
  return (
    <section className={`queue ${q.tone}`}>
      <header><h3>{q.title}</h3><span className="count">{q.count}</span></header>
      <ul>
        {q.items.map((it, i) => (
          <li key={i}><Link to={it.link}><b>{it.label}</b><span className="muted">{it.sub}</span></Link>{it.due && <time className={it.due < new Date().toISOString().slice(0, 10) ? "neg" : "muted"}>{fmtDate(it.due)}</time>}</li>
        ))}
        {q.count > q.items.length && <li className="muted small">+ {q.count - q.items.length} more</li>}
      </ul>
    </section>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const [period, setPeriod] = useState("month");
  const [from, to] = PERIODS[period][1]();
  const state = useLoad(`/reports/home?from=${from}&to=${to}`);
  return (
    <>
      <PageHead title={`Salaam, ${user.name.split(" ")[0]}`} sub={`${user.role_label} · here's what needs your attention today.`}>
        {can("sales.write") && <Link className="btn primary" to="/quotes/new?enquiry=1">+ New Enquiry</Link>}
        {can("sales.write") && <Link className="btn" to="/jobs/new">+ New Job</Link>}
        {can("buy") && <Link className="btn primary" to="/procurement">What to buy</Link>}
        {can("buy") && <Link className="btn" to="/bills/new">+ Supplier Bill</Link>}
        {can("reports.finance") && <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">{Object.entries(PERIODS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>}
      </PageHead>
      <Loading state={state}>{(d) => {
        const active = d.queues.filter((q) => q.count > 0);
        const depts = [...new Set(active.map((q) => q.dept))];
        const k = d.kpis;
        return (
          <>
            {k.today && (
              <div className="today-strip">
                <b>Today</b>
                {k.today.sales !== undefined && <span>Sales <b>{money(k.today.sales)}</b></span>}
                {k.today.money_in !== undefined && <span>Money in <b className="pos">{money(k.today.money_in)}</b></span>}
                {k.today.money_out !== undefined && <span>Money out <b className="neg">{money(k.today.money_out)}</b></span>}
              </div>
            )}
            <div className="stats">
              {k.receivables !== undefined && <Stat label="Customer outstanding" value={money(k.receivables)} to="/reports?tab=receivables" sub={k.aging && (k.aging.buckets["31-60"] + k.aging.buckets["61-90"] + k.aging.buckets["90+"]) > 0 ? <span className="neg">{money(k.aging.buckets["31-60"] + k.aging.buckets["61-90"] + k.aging.buckets["90+"])} over 30 days late</span> : null} />}
              {k.payables !== undefined && <Stat label="Supplier payable" value={money(k.payables)} to="/reports?tab=payables" />}
              {k.orders_in_hand && <Stat label="Orders in hand (not invoiced yet)" value={money(k.orders_in_hand.to_invoice)} to="/jobs" sub={<span className="muted">{k.orders_in_hand.jobs} open Job{k.orders_in_hand.jobs === 1 ? "" : "s"} · total value {money(k.orders_in_hand.value)}</span>} />}
              {k.open_quotes !== undefined && <Stat label="Open enquiries & quotes" value={money(k.open_quotes)} to="/quotes" />}
              {k.active_jobs !== undefined && <Stat label="Active Jobs" value={k.active_jobs} to="/jobs" sub={<span className={k.blocked_jobs ? "neg" : "muted"}>{k.blocked_jobs} past due date</span>} />}
              {k.period && <Stat label={`Net profit · ${PERIODS[period][0].toLowerCase()}`} value={money(k.period.net_profit)} tone={k.period.net_profit < 0 ? "neg" : "pos"} to={`/reports?tab=pnl&from=${from}&to=${to}`}
                sub={<><span className="muted">Sales {money(k.period.revenue)} · GM {k.period.gross_margin}%</span><Delta now={k.period.net_profit} before={k.previous?.net_profit} /></>} />}
              {k.stock_value !== undefined && <Stat label="Stock value" value={money(k.stock_value)} to="/reports?tab=inventory" sub={k.low_stock ? <Link className="neg" to="/items?low=1">{k.low_stock} item(s) low</Link> : null} />}
            </div>
            {k.target && (
              <section className="card target">
                <div className="row-between"><h3>Sales target · this month</h3><span><b>{money(k.target.achieved)}</b> <span className="muted">of {money(k.target.target)}</span></span></div>
                <div className="progress"><span style={{ width: `${Math.min(100, (k.target.achieved / k.target.target) * 100)}%` }} /></div>
                <p className="muted small">{Math.round((k.target.achieved / k.target.target) * 100)}% done{k.target.achieved < k.target.target ? ` · ${money(k.target.target - k.target.achieved)} to go` : " · target reached 🎉"}</p>
              </section>
            )}
            {active.length === 0 ? <div className="empty">Nothing pending. All clear! ✓</div> : depts.map((dep) => (
              <div key={dep}>
                {depts.length > 1 && <h2 className="dept">{dep}</h2>}
                <div className="queues">{active.filter((q) => q.dept === dep).map((q) => <Queue key={q.key} q={q} />)}</div>
              </div>
            ))}
            <div className="grid-2">
              {(k.expected_in || k.expected_out) && <Expected inn={k.expected_in} out={k.expected_out} />}
              {k.aging && (
                <section className="card">
                  <div className="card-head"><h3>Who owes us, and how late</h3><Link className="btn sm ghost" to="/reports?tab=receivables">Details</Link></div>
                  <AgingBar buckets={k.aging.buckets} />
                  {k.aging.top.length > 0 && <table className="table compact mt"><thead><tr><th>Top customers owing</th><th className="r">Over 30 days</th><th className="r">Total</th></tr></thead>
                    <tbody>{k.aging.top.map((c) => <tr key={c.contact_id}><td><Link to={`/contacts/${c.contact_id}`}>{c.name}</Link></td><td className={`r ${c["31-60"] + c["61-90"] + c["90+"] ? "neg" : "muted"}`}>{money(c["31-60"] + c["61-90"] + c["90+"])}</td><td className="r"><b>{money(c.total)}</b></td></tr>)}</tbody></table>}
                </section>
              )}
              {k.payables_aging && (
                <section className="card">
                  <div className="card-head"><h3>What we owe suppliers</h3><Link className="btn sm ghost" to="/reports?tab=payables">Details</Link></div>
                  <AgingBar buckets={k.payables_aging} />
                </section>
              )}
              {k.sales_trend && (
                <section className="card">
                  <h3>Sales · last 6 months</h3>
                  <Bars rows={k.sales_trend} value={(r) => r.sales} label={(r) => monthLabel(r.month)} />
                  {k.sales_trend.length > 1 && <p className="small"><Delta now={k.sales_trend.at(-1).sales} before={k.sales_trend.at(-2).sales} /> <span className="muted">(this month so far vs last month)</span></p>}
                </section>
              )}
              {k.cash_flow && <section className="card"><h3>Cash flow · last 6 months</h3><div className="legend"><span className="dot in" />Money in <span className="dot out" />Money out</div><CashChart rows={k.cash_flow} /></section>}
              {k.top_customers && (
                <section className="card">
                  <div className="card-head"><h3>Top customers · {PERIODS[period][0].toLowerCase()}</h3><Link className="btn sm ghost" to={`/reports?tab=sales-by-customer&from=${from}&to=${to}`}>All</Link></div>
                  {k.top_customers.length === 0 ? <p className="muted small">No invoices in this period.</p> : <table className="table compact"><tbody>{k.top_customers.map((c, i) => <tr key={c.id}><td className="muted">{i + 1}</td><td><Link to={`/contacts/${c.id}`}>{c.name}</Link></td><td className="muted">{c.invoices} inv.</td><td className="r"><b>{money(c.sales)}</b></td></tr>)}</tbody></table>}
                </section>
              )}
              {k.top_items && (
                <section className="card">
                  <div className="card-head"><h3>Top items · {PERIODS[period][0].toLowerCase()}</h3><Link className="btn sm ghost" to={`/reports?tab=sales-by-item&from=${from}&to=${to}`}>All</Link></div>
                  {k.top_items.length === 0 ? <p className="muted small">No invoices in this period.</p> : <table className="table compact"><thead><tr><th /><th>Item</th><th className="r">Sales</th>{k.top_items[0].profit !== undefined && <th className="r">Profit</th>}</tr></thead>
                    <tbody>{k.top_items.map((it, i) => <tr key={it.id}><td className="muted">{i + 1}</td><td><Link to={`/items/${it.id}`}>{it.name}</Link></td><td className="r">{money(it.sales)}</td>{it.profit !== undefined && <td className={`r ${it.profit < 0 ? "neg" : "pos"}`}>{money(it.profit)}</td>}</tr>)}</tbody></table>}
                </section>
              )}
              {k.budgets && (
                <section className="card">
                  <div className="card-head"><h3>Expense budget · this month</h3>{can("admin") && <Link className="btn sm ghost" to="/settings">Set budgets</Link>}</div>
                  {k.budgets.length === 0 ? <p className="muted small">No budgets yet. A director can set a monthly budget per expense type in Settings.</p> : k.budgets.map((b) => {
                    const pct = Math.round((b.spent / b.budget) * 100);
                    return (
                      <div key={b.category} className="budget">
                        <div className="row-between small"><span>{b.category}</span><span className={pct > 100 ? "neg" : pct >= 80 ? "warn" : "muted"}>{money(b.spent)} / {money(b.budget)}</span></div>
                        <div className={`progress ${pct > 100 ? "over" : pct >= 80 ? "near" : ""}`}><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
                      </div>
                    );
                  })}
                </section>
              )}
              <section className="card">
                <h3>{can("admin") ? "Recent activity (everyone)" : "My recent activity"}</h3>
                <ul className="activity">
                  {d.recent.map((a) => <li key={a.id}><b>{a.user_name || "System"}</b> {a.action} {a.entity} <span className="muted">{a.summary}</span><time>{new Date(a.at + "Z").toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time></li>)}
                </ul>
              </section>
            </div>
          </>
        );
      }}</Loading>
    </>
  );
}
