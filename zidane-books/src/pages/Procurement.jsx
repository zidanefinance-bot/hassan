// Master procurement list: the same item across active Jobs is added up, so it can be bought (and negotiated) in bulk.
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, label, Loading, money, num, PageHead, today, useLoad, useToast } from "../lib.jsx";

// which lines to show: all, those no PO covers yet (still to order), or those on an open PO
const VIEWS = [["all", "All", () => true], ["todo", "Not on PO yet", (j) => j.not_ordered > 0], ["po", "On PO", (j) => j.po_qty > 0]];

export default function Procurement() {
  const state = useLoad("/procurement");
  const saved = (() => { try { return localStorage.getItem("buy:view"); } catch { return null; } })();
  const [view, setView] = useState(VIEWS.some((v) => v[0] === saved) ? saved : "all");
  const pick = (v) => { setView(v); try { localStorage.setItem("buy:view", v); } catch {} };
  const show = VIEWS.find((v) => v[0] === view)[2];
  const toast = useToast();
  const mark = async (jobItemId, status) => {
    try { await api(`/job-items/${jobItemId}/procurement`, { method: "POST", body: { status } }); toast(`Marked ${label(status)}`); state.reload(); } catch (x) { toast(x.message, "err"); }
  };
  return (
    <>
      <PageHead title="What to buy" sub="Everything still to buy across active Jobs, soonest first. The same item is totalled across Jobs.">
        <a className="btn" href="/api/procurement.xlsx" download>⬇ Download Excel</a>
        <Link className="btn" to="/purchase-orders/new">+ New PO</Link>
        <Link className="btn primary" to="/bills/new">+ Record purchase / bill</Link>
      </PageHead>
      {state.data?.length > 0 && <div className="chips">{VIEWS.map(([k, name, f]) => <button key={k} className={`chip ${view === k ? "on" : ""}`} onClick={() => pick(k)}>{name} <span className="n">{state.data.flatMap((g) => g.jobs).filter(f).length}</span></button>)}</div>}
      <Loading state={state}>{(all) => { const groups = all.map((g) => ({ ...g, jobs: g.jobs.filter(show) })).filter((g) => g.jobs.length); return all.length === 0 ? <div className="empty">Nothing to buy right now. ✓</div> : groups.length === 0 ? <div className="empty">{view === "todo" ? "Everything to buy is on a PO. ✓" : "Nothing on an open PO."}</div> : (
        <div className="buy-list">
          {groups.map((g) => (
            <section key={g.key} className={`card buy ${g.urgent ? "urgent" : ""}`}>
              <header>
                <div><h3>{g.name}</h3><span className="muted small">{g.category ? `${g.category} · ` : ""}{g.stock_qty !== null && g.stock_qty !== undefined ? `In stock ${num(g.stock_qty)} ${g.unit}` : "Not in item list"}{g.purchase_rate ? ` · last cost ${money(g.purchase_rate)}` : ""}</span>
                  {g.stock_qty >= g.total_qty && <span className="badge green sm">stock covers it: mark "From stock"</span>}</div>
                <div className="r"><b className="big-num">{num(g.total_qty)}</b> <span className="muted">{g.unit}</span>{g.po_qty > 0 && <div className="small muted">{num(g.po_qty)} on PO · <b className={g.not_ordered_qty > 0 ? "neg" : "pos"}>{num(g.not_ordered_qty)} to order</b></div>}{g.po_unassigned > 0 && <div className="small muted">+ {num(g.po_unassigned)} on a PO with no Job</div>}{g.earliest && <div className={`small ${g.earliest <= today() ? "neg" : "muted"}`}>by {fmtDate(g.earliest)}</div>}</div>
              </header>
              <table className="table compact"><tbody>
                {g.jobs.map((j) => (
                  <tr key={j.job_item_id}>
                    <td><Link to={`/jobs/${j.job_id}`}>{j.job_number}</Link> <span className="muted">{j.customer_name}</span>{j.fulfilment_type === "direct" && <span className="badge blue sm">direct</span>}</td>
                    <td>{j.pos.length ? j.pos.map((p) => <Link key={p.id} to={`/purchase-orders/${p.id}`} className="badge blue sm" title={`${p.supplier} · ${num(p.qty)} ${g.unit}`}>{p.number}{p.status === "draft" ? " (draft)" : ""}</Link>)
                      : <span className="badge amber sm">no PO yet</span>}{j.po_qty > 0 && j.not_ordered > 0 && <div className="muted small">{num(j.not_ordered)} not on a PO</div>}</td>
                    <td className="r">{num(j.qty)}{j.bought > 0 && <div className="muted small">{num(j.bought)} of {num(j.ordered)} bought</div>}</td>
                    <td className="r nowrap">
                      <button className="btn sm" onClick={() => mark(j.job_item_id, "bought")}>Bought</button>
                      <button className="btn sm ghost" onClick={() => mark(j.job_item_id, "partial")}>Partial</button>
                      <button className="btn sm ghost" onClick={() => mark(j.job_item_id, "from_stock")}>From stock</button>
                    </td>
                  </tr>
                ))}
              </tbody></table>
            </section>
          ))}
        </div>
      ); }}</Loading>
    </>
  );
}
