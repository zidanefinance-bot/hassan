// Master procurement list: the same item across active Jobs is added up, so it can be bought (and negotiated) in bulk.
import React from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, label, Loading, money, num, PageHead, today, useLoad, useToast } from "../lib.jsx";

export default function Procurement() {
  const state = useLoad("/procurement");
  const toast = useToast();
  const mark = async (jobItemId, status) => {
    try { await api(`/job-items/${jobItemId}/procurement`, { method: "POST", body: { status } }); toast(`Marked ${label(status)}`); state.reload(); } catch (x) { toast(x.message, "err"); }
  };
  return (
    <>
      <PageHead title="What to buy" sub="Everything still to buy across active Jobs, soonest first. The same item is totalled across Jobs.">
        <a className="btn" href="/api/procurement.xlsx" download>⬇ Download Excel</a>
        <Link className="btn primary" to="/bills/new">+ Record purchase / bill</Link>
      </PageHead>
      <Loading state={state}>{(groups) => groups.length === 0 ? <div className="empty">Nothing to buy right now. ✓</div> : (
        <div className="buy-list">
          {groups.map((g) => (
            <section key={g.key} className={`card buy ${g.urgent ? "urgent" : ""}`}>
              <header>
                <div><h3>{g.name}</h3><span className="muted small">{g.category ? `${g.category} · ` : ""}{g.stock_qty !== null && g.stock_qty !== undefined ? `In stock ${num(g.stock_qty)} ${g.unit}` : "Not in item list"}{g.purchase_rate ? ` · last cost ${money(g.purchase_rate)}` : ""}</span></div>
                <div className="r"><b className="big-num">{num(g.total_qty)}</b> <span className="muted">{g.unit}</span>{g.earliest && <div className={`small ${g.earliest <= today() ? "neg" : "muted"}`}>by {fmtDate(g.earliest)}</div>}</div>
              </header>
              <table className="table compact"><tbody>
                {g.jobs.map((j) => (
                  <tr key={j.job_item_id}>
                    <td><Link to={`/jobs/${j.job_id}`}>{j.job_number}</Link> <span className="muted">{j.customer_name}</span>{j.fulfilment_type === "direct" && <span className="badge blue sm">direct</span>}</td>
                    <td className="r">{num(j.qty)}</td>
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
      )}</Loading>
    </>
  );
}
