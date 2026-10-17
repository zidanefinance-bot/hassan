// Role home: "What needs your attention today?" Action queues first, then only the numbers each role needs.
import React from "react";
import { Link } from "react-router-dom";
import { fmtDate, Loading, money, PageHead, useAuth, useLoad } from "../lib.jsx";

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
  const state = useLoad("/reports/home");
  return (
    <>
      <PageHead title={`Salaam, ${user.name.split(" ")[0]}`} sub={`${user.role_label} · here's what needs your attention today.`}>
        {can("sales.write") && <Link className="btn primary" to="/quotes/new?enquiry=1">+ New Enquiry</Link>}
        {can("sales.write") && <Link className="btn" to="/jobs/new">+ New Job</Link>}
        {can("buy") && <Link className="btn primary" to="/procurement">What to buy</Link>}
        {can("buy") && <Link className="btn" to="/bills/new">+ Supplier Bill</Link>}
      </PageHead>
      <Loading state={state}>{(d) => {
        const active = d.queues.filter((q) => q.count > 0);
        const depts = [...new Set(active.map((q) => q.dept))];
        const k = d.kpis;
        return (
          <>
            <div className="stats">
              {k.receivables !== undefined && <div className="stat"><small>Customer outstanding</small><b>{money(k.receivables)}</b></div>}
              {k.payables !== undefined && <div className="stat"><small>Supplier payable</small><b>{money(k.payables)}</b></div>}
              {k.open_quotes !== undefined && <div className="stat"><small>Open enquiries & quotes</small><b>{money(k.open_quotes)}</b></div>}
              {k.active_jobs !== undefined && <div className="stat"><small>Active Jobs</small><b>{k.active_jobs}</b><span className={k.blocked_jobs ? "neg" : "muted"}>{k.blocked_jobs} past due date</span></div>}
              {k.month && <div className="stat"><small>Net profit this month</small><b className={k.month.net_profit < 0 ? "neg" : "pos"}>{money(k.month.net_profit)}</b><span className="muted">Sales {money(k.month.revenue)} · GM {k.month.gross_margin}%</span></div>}
              {k.stock_value !== undefined && <div className="stat"><small>Stock value</small><b>{money(k.stock_value)}</b></div>}
            </div>
            {active.length === 0 ? <div className="empty">Nothing pending. All clear! ✓</div> : depts.map((dep) => (
              <div key={dep}>
                {depts.length > 1 && <h2 className="dept">{dep}</h2>}
                <div className="queues">{active.filter((q) => q.dept === dep).map((q) => <Queue key={q.key} q={q} />)}</div>
              </div>
            ))}
            <div className="grid-2">
              {k.cash_flow && <section className="card"><h3>Cash flow · last 6 months</h3><div className="legend"><span className="dot in" />Money in <span className="dot out" />Money out</div><CashChart rows={k.cash_flow} /></section>}
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
