// Finance home for a director who wants the money side only: cash now and over the next 12 weeks, who pays when,
// how healthy the business is, and the assumptions behind the forecast (editable here). Same access as any director.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Field, fmtDate, Loading, money, PageHead, useLoad, useToast } from "../lib.jsx";

const short = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const nz = (v) => (v === null || v === undefined || v === "" ? "" : v);

function Stat({ label, value, sub, tone, to }) {
  const body = <><small>{label}</small><b className={tone || ""}>{value}</b>{sub}</>;
  return to ? <Link className="stat link" to={to}>{body}</Link> : <div className="stat">{body}</div>;
}

// one bar per week: the bank balance at the end of it, red below zero (hover / tap shows in and out)
function Forecast({ weeks, pick, picked }) {
  const max = Math.max(1, ...weeks.map((w) => Math.abs(w.closing)));
  const hasNeg = weeks.some((w) => w.closing < 0);
  return (
    <div className="fc">
      <div className={`fc-plot ${hasNeg ? "with-neg" : ""}`}>
        {weeks.map((w, i) => (
          <button key={w.from} type="button" className={`fc-col ${picked === i ? "on" : ""}`} onClick={() => pick(i)}
            title={`Week of ${short(w.from)}\nComing in: ${money(w.in)}\nGoing out: ${money(w.out)}\nBalance: ${money(w.closing)}`}>
            <span className="fc-pos">{w.closing >= 0 && <i style={{ height: `${(w.closing / max) * 100}%` }} />}</span>
            {hasNeg && <span className="fc-neg">{w.closing < 0 && <i style={{ height: `${(-w.closing / max) * 100}%` }} />}</span>}
            <small>{short(w.from)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function Assumptions({ data, onSaved }) {
  const a = data.assumptions;
  const [f, setF] = useState({ openingCash: nz(a.openingCash), openingDate: nz(a.openingDate) || data.today, monthlyFixed: nz(a.monthlyFixed), whtPct: nz(a.whtPct), marginPct: nz(a.marginPct), defaultDelay: nz(a.defaultDelay) });
  const toast = useToast();
  const bind = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  const num = (v) => (v === "" ? null : Number(v));
  const save = async (e) => {
    e.preventDefault();
    try {
      await api("/settings", { method: "PUT", body: { financeAssumptions: { ...a, openingCash: num(f.openingCash), openingDate: f.openingDate || null, monthlyFixed: num(f.monthlyFixed), whtPct: num(f.whtPct) ?? 0, marginPct: num(f.marginPct), defaultDelay: num(f.defaultDelay), delays: a.delays || {} } } });
      toast("Forecast updated"); onSaved();
    } catch (x) { toast(x.message, "err"); }
  };
  return (
    <form className="card form" onSubmit={save}>
      <h3>Assumptions</h3>
      <p className="muted small">The forecast stands on these. Leave a box empty and it's worked out from the last 3 months.</p>
      <div className="row-2">
        <Field label="Bank + cash balance (Rs)"><input type="number" step="1" {...bind("openingCash")} placeholder="e.g. 850000" /></Field>
        <Field label="…on this date"><input type="date" {...bind("openingDate")} /></Field>
      </div>
      <div className="row-2">
        <Field label="Fixed costs a month (Rs)"><input type="number" step="1" {...bind("monthlyFixed")} placeholder={`auto: ${Math.round(a.monthlyFixed_auto).toLocaleString("en-PK")}`} /></Field>
        <Field label="Margin on orders in hand (%)"><input type="number" step="0.1" {...bind("marginPct")} placeholder={`auto: ${a.marginPct_auto}`} /></Field>
      </div>
      <div className="row-2">
        <Field label="Tax customers withhold (%)"><input type="number" step="0.1" {...bind("whtPct")} placeholder="0" /></Field>
        <Field label="Days late, new customers"><input type="number" step="1" {...bind("defaultDelay")} placeholder="0" /></Field>
      </div>
      <div className="form-actions"><button className="btn primary">Update forecast</button></div>
    </form>
  );
}

export default function FinanceHome({ user, onFullView }) {
  const state = useLoad("/reports/finance");
  const home = useLoad("/reports/home");
  const [picked, setPicked] = useState(0);
  const [delays, setDelays] = useState({});
  const toast = useToast();
  useEffect(() => { if (state.data) setDelays(Object.fromEntries(state.data.customers.map((c) => [c.id, nz(c.delay_set)]))); }, [state.data]);
  const saveDelay = async (d, id) => {
    const a = d.assumptions;
    const next = { ...(a.delays || {}) };
    if (delays[id] === "") delete next[id]; else next[id] = Number(delays[id]);
    try { await api("/settings", { method: "PUT", body: { financeAssumptions: { ...a, delays: next } } }); state.reload(); } catch (x) { toast(x.message, "err"); }
  };
  return (
    <>
      <PageHead title={`Salaam, ${user.name.split(" ")[0]}`} sub="Finance view · cash, who pays when, and how the business is doing.">
        <Link className="btn" to="/reports?tab=pnl">Reports</Link>
        <button className="btn ghost" onClick={onFullView}>Full view</button>
      </PageHead>
      <Loading state={state}>{(d) => {
        const w = d.weeks[picked] || d.weeks[0];
        const h = d.health;
        const asks = (home.data?.queues || []).filter((q) => ["For you", "Director"].includes(q.dept) && q.count > 0);
        return (
          <>
            {d.cash.first_short_week && <div className="form-error">Cash runs short in the week of {fmtDate(d.cash.first_short_week.from)}: balance {money(d.cash.first_short_week.closing)}. Collect earlier, delay buying, or arrange funds.</div>}
            <div className="stats">
              <Stat label="Bank + cash today" value={d.cash.now === null ? "Not set" : money(d.cash.now)} tone={d.cash.now < 0 ? "neg" : ""} sub={<span className="muted">{d.cash.now === null ? "Enter it under Assumptions" : `from ${fmtDate(d.assumptions.openingDate)} + money in/out since`}</span>} />
              <Stat label="Lowest in 12 weeks" value={money(d.cash.lowest)} tone={d.cash.lowest < 0 ? "neg" : "pos"} sub={<span className="muted">after 12 weeks {money(d.cash.after_12_weeks)}</span>} />
              <Stat label="Customers owe" value={money(d.totals.receivables)} to="/reports?tab=receivables" sub={d.totals.overdue > 0 ? <span className="neg">{money(d.totals.overdue)} past due</span> : <span className="muted">nothing past due</span>} />
              <Stat label="We owe suppliers" value={money(d.totals.payables)} to="/reports?tab=payables" />
              <Stat label="Orders in hand" value={money(d.totals.orders_in_hand)} to="/jobs" sub={<span className="muted">not invoiced yet</span>} />
            </div>

            {asks.length > 0 && <div className="queues">{asks.map((q) => (
              <section key={q.key} className={`queue ${q.tone}`}><header><h3>{q.title}</h3><span className="count">{q.count}</span></header>
                <ul>{q.items.map((it, i) => <li key={i}><Link to={it.link}><b>{it.label}</b><span className="muted">{it.sub}</span></Link></li>)}</ul></section>))}</div>}

            <div className="grid-2 wide-left">
              <section className="card">
                <div className="card-head"><h3>Cash forecast · next 12 weeks</h3><span className="muted small">bank balance at each week's end</span></div>
                <Forecast weeks={d.weeks} pick={setPicked} picked={picked} />
                <div className="fc-week">
                  <b>Week of {fmtDate(w.from)}</b>
                  <span>In <b className="pos">{money(w.in)}</b></span><span>Out <b className="neg">{money(w.out)}</b></span><span>Balance <b className={w.closing < 0 ? "neg" : ""}>{money(w.closing)}</b></span>
                </div>
                <table className="table compact"><tbody>{w.items.map((x, i) => (
                  <tr key={i}><td>{x.label}</td><td className="muted small">{short(x.date)}</td><td className={`r ${x.dir === "in" ? "pos" : "neg"}`}>{x.dir === "in" ? "+" : "−"} {money(x.amount)}</td></tr>
                ))}</tbody></table>
                <p className="muted small">Tap a week to see what's in it. Customer payments are placed at the due date plus how late that customer usually pays.</p>
              </section>
              <section className="card">
                <h3>Business health</h3>
                <dl className="kv">
                  <dt>Gross margin</dt><dd>{h.month.gross_margin}% <span className="muted small">last month {h.last_month.gross_margin}%</span></dd>
                  <dt>Net profit (month)</dt><dd className={h.month.net_profit < 0 ? "neg" : ""}>{money(h.month.net_profit)} <span className="muted small">last month {money(h.last_month.net_profit)}</span></dd>
                  <dt>Customers pay in</dt><dd>{h.dso === null ? "—" : `${h.dso} days`} <span className="muted small">on average</span></dd>
                  <dt>We pay suppliers in</dt><dd>{h.dpo === null ? "—" : `${h.dpo} days`}</dd>
                  <dt>Money tied up</dt><dd>{money(h.tied_up)} <span className="muted small">with customers + in stock</span></dd>
                  {h.top_customer && <><dt>Biggest debtor</dt><dd className={h.top_customer.share >= 50 ? "neg" : ""}>{h.top_customer.name}: {h.top_customer.share}% of what's owed</dd></>}
                  <dt>Tax withheld (this year)</dt><dd>{money(h.wht_to_claim_year)} <span className="muted small">to claim from FBR</span></dd>
                </dl>
              </section>
            </div>

            <section className="card">
              <div className="card-head"><h3>Who pays when</h3><Link className="btn sm ghost" to="/reports?tab=receivables">Details</Link></div>
              {d.customers.length === 0 ? <p className="muted">No customer owes anything right now.</p> : (
                <table className="table">
                  <thead><tr><th>Customer</th><th className="r">Owes</th><th className="r">Past due</th><th>Next payment</th><th>Habit</th><th>Assume days late</th></tr></thead>
                  <tbody>{d.customers.map((c) => (
                    <tr key={c.id}>
                      <td><Link to={`/contacts/${c.id}`}>{c.name}</Link></td>
                      <td className="r"><b>{money(c.owed)}</b></td>
                      <td className={`r ${c.overdue ? "neg" : "muted"}`}>{c.overdue ? money(c.overdue) : "—"}</td>
                      <td>{fmtDate(c.next_date)} · {money(c.next_amount)}</td>
                      <td className="small">{c.habit_label}{c.habit ? <span className="muted"> ({c.habit.avg_late > 0 ? `${c.habit.avg_late} days late` : "on time"}, {c.habit.invoices} inv.)</span> : null}</td>
                      <td><input className="inline" style={{ width: 80 }} type="number" placeholder={String(c.delay_used)} value={delays[c.id] ?? ""} onChange={(e) => setDelays({ ...delays, [c.id]: e.target.value })} onBlur={() => String(delays[c.id] ?? "") !== String(nz(c.delay_set)) && saveDelay(d, c.id)} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </section>

            <Assumptions data={d} onSaved={state.reload} />
          </>
        );
      }}</Loading>
    </>
  );
}
