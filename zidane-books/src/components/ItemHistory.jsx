// Click an item's name on a Job, DC or invoice: its history in a popup (Jobs, sales papers, buying papers, rates),
// each person seeing only their side (Operations: no selling rates; Sales: no costs).
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, fmtDate, KIND, Loading, Modal, money, num, useLoad } from "../lib.jsx";

const SALES = ["quote", "dc", "invoice", "credit_note"], BUY = ["po", "bill", "vendor_credit"];

export function ItemName({ id, name, className = "" }) {
  const [open, setOpen] = useState(false);
  if (!id) return <span className={className}>{name}</span>;
  return (<>
    <button type="button" className={`item-link ${className}`} title="Click for this item's history" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{name}</button>
    {open && <ItemHistory id={id} onClose={() => setOpen(false)} />}
  </>);
}

export default function ItemHistory({ id, onClose }) {
  const state = useLoad(`/items/${id}`, [id]);
  const [tab, setTab] = useState(null);
  return (
    <Modal title="Item history" onClose={onClose} wide>
      <Loading state={state}>{(i) => {
        const sales = i.transactions.filter((t) => SALES.includes(t.kind)), buy = i.transactions.filter((t) => BUY.includes(t.kind));
        const tabs = [["jobs", `Jobs (${i.jobs.length})`, i.jobs.length], ["sales", `Quotes, DCs & invoices (${sales.length})`, sales.length], ["buy", `POs & supplier bills (${buy.length})`, buy.length]].filter(([, , n]) => n > 0);
        const cur = tab || tabs[0]?.[0];
        const r = i.rates || {};
        const docRows = (rows) => (
          <table className="table compact">
            <thead><tr><th>Date</th><th>Type</th><th>Number</th><th>Customer / supplier</th><th>Job</th><th>Status</th><th className="r">Qty</th><th className="r">Rate</th></tr></thead>
            <tbody>{rows.map((t, n) => (
              <tr key={n}><td className="nowrap">{fmtDate(t.date)}</td><td>{KIND[t.kind].label}</td><td><Link to={`/${KIND[t.kind].path}/${t.id}`} onClick={onClose}><b>{t.number}</b></Link></td><td>{t.contact_name}</td><td className="muted">{t.job_number || "—"}</td><td><Badge status={t.status} /></td>
                <td className="r">{num(t.qty)}</td><td className="r">{t.rate === undefined || t.kind === "dc" ? "—" : money(t.rate * (1 - (t.discount_pct || 0) / 100))}</td></tr>
            ))}</tbody>
          </table>
        );
        return (
          <div className="form">
            <h3 style={{ margin: 0 }}>{i.name} <span className="muted small">{[i.sku, i.category, i.unit].filter(Boolean).join(" · ")}</span></h3>
            <div className="stats">
              <div className="stat"><small>In stock</small><b>{num(i.stock_qty)} {i.unit}</b></div>
              {r.purchase && <div className="stat"><small>Last bought</small><b>{r.purchase.last ? money(r.purchase.last.rate) : "—"}</b>{r.purchase.last && <span className="muted">{r.purchase.last.supplier} · {fmtDate(r.purchase.last.date)}</span>}</div>}
              {r.purchase?.lowest_supplier && <div className="stat"><small>Cheapest supplier</small><b>{money(r.purchase.lowest_supplier.last_rate)}</b><span className="muted">{r.purchase.lowest_supplier.name}</span></div>}
              {r.sales && <div className="stat"><small>Last sold</small><b>{r.sales.last ? money(r.sales.last.rate) : "—"}</b>{r.sales.last && <span className="muted">{r.sales.last.customer} · {fmtDate(r.sales.last.date)}</span>}</div>}
            </div>
            {tabs.length === 0 ? <p className="muted">No history yet for this item.</p> : <>
              <div className="chips">{tabs.map(([k, l]) => <button key={k} type="button" className={`chip ${cur === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>)}</div>
              <div className="card flush" style={{ maxHeight: 380, overflow: "auto" }}>
                {cur === "jobs" && (
                  <table className="table compact">
                    <thead><tr><th>Created</th><th>Job</th><th>Customer</th><th>Status</th><th className="r">Qty</th>{i.jobs.some((j) => j.sale_rate !== undefined) && <th className="r">Rate</th>}</tr></thead>
                    <tbody>{i.jobs.map((j) => (
                      <tr key={j.id}><td className="nowrap">{fmtDate(j.date)}</td><td><Link to={`/jobs/${j.id}`} onClick={onClose}><b>{j.number}</b></Link>{j.customer_po_number && <div className="muted small">PO {j.customer_po_number}</div>}</td>
                        <td>{j.customer_name}</td><td>{j.closed ? <Badge status="closed" /> : <Badge status={j.ops_status} />}</td><td className="r">{num(j.qty)}</td>{j.sale_rate !== undefined && <td className="r">{money(j.sale_rate)}</td>}</tr>
                    ))}</tbody>
                  </table>
                )}
                {cur === "sales" && docRows(sales)}
                {cur === "buy" && docRows(buy)}
              </div>
            </>}
            <div className="form-actions" style={{ justifyContent: "flex-start" }}><Link className="btn" to={`/items/${id}`} onClick={onClose}>Open full item page →</Link></div>
          </div>
        );
      }}</Loading>
    </Modal>
  );
}
