import React from "react";
import { Link } from "react-router-dom";
import { Loading, money, PageHead, useAuth, useLoad } from "../lib.jsx";

function CashChart({ rows }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.in, r.out]));
  return (
    <div className="chart">
      {rows.map((r) => (
        <div key={r.month} className="chart-col" title={`${r.month}\nIn: ${money(r.in)}\nOut: ${money(r.out)}`}>
          <div className="bars">
            <div className="bar in" style={{ height: `${(r.in / max) * 100}%` }} />
            <div className="bar out" style={{ height: `${(r.out / max) * 100}%` }} />
          </div>
          <span>{new Date(r.month + "-01").toLocaleDateString("en-GB", { month: "short" })}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const state = useLoad("/reports/dashboard");
  return (
    <>
      <PageHead title={`Salaam, ${user.name.split(" ")[0]}`} sub="Here's how the business is doing.">
        {can("sales") && <Link className="btn primary" to="/invoices/new">+ New Invoice</Link>}
        {can("purchases") && <Link className="btn" to="/bills/new">+ New Bill</Link>}
      </PageHead>
      <Loading state={state}>{(d) => (
        <>
          <div className="stats">
            <div className="stat"><small>Receivables</small><b>{money(d.receivables.total)}</b><span className={d.receivables.overdue ? "neg" : "muted"}>{money(d.receivables.overdue)} overdue</span></div>
            {d.payables && <div className="stat"><small>Payables</small><b>{money(d.payables.total)}</b><span className={d.payables.overdue ? "neg" : "muted"}>{money(d.payables.overdue)} overdue</span></div>}
            {d.month && <div className="stat"><small>Sales this month</small><b>{money(d.month.revenue)}</b><span className="muted">Gross margin {d.month.gross_margin}%</span></div>}
            {d.month && <div className="stat"><small>Net profit this month</small><b className={d.month.net_profit < 0 ? "neg" : "pos"}>{money(d.month.net_profit)}</b><span className="muted">after {money(d.month.expenses)} expenses</span></div>}
            <div className="stat"><small>Stock value</small><b>{money(d.inventory.total_value)}</b><span className={d.inventory.low_stock ? "neg" : "muted"}>{d.inventory.low_stock} items low on stock</span></div>
          </div>
          <div className="grid-2">
            {d.cash_flow && (
              <section className="card">
                <h3>Cash flow · last 6 months</h3>
                <div className="legend"><span className="dot in" />Money in <span className="dot out" />Money out</div>
                <CashChart rows={d.cash_flow} />
              </section>
            )}
            <section className="card">
              <h3>Top customers this year</h3>
              {d.top_customers.length === 0 ? <p className="muted">No sales yet.</p> : (
                <table className="table compact"><tbody>
                  {d.top_customers.map((c) => <tr key={c.id}><td><Link to={`/contacts/${c.id}`}>{c.name}</Link></td><td className="r">{c.invoices} inv.</td><td className="r"><b>{money(c.sales)}</b></td></tr>)}
                </tbody></table>
              )}
            </section>
          </div>
          <section className="card">
            <h3>Recent activity</h3>
            <ul className="activity">
              {d.recent.map((a) => <li key={a.id}><b>{a.user_name || "System"}</b> {a.action} {a.entity} <span className="muted">{a.summary}</span><time>{new Date(a.at + "Z").toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time></li>)}
            </ul>
          </section>
        </>
      )}</Loading>
    </>
  );
}
