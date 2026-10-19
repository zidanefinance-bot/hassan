import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, fmtDate, KIND, Loading, money, PageHead, Search, useAuth, useLoad } from "../lib.jsx";

const WRITE = { quote: ["sales.write"], invoice: ["sales.write"], dc: ["sales.write"], credit_note: ["sales.write"], po: ["ops.write", "buy"], bill: ["ops.write", "buy"], vendor_credit: ["ops.write"] };
const FILTERS = {
  quote: ["all", "enquiry", "draft", "sent", "accepted", "declined", "converted"],
  dc: ["all", "draft", "issued", "signed", "void"],
  invoice: ["all", "draft", "open", "partial", "overdue", "paid", "void"],
  po: ["all", "draft", "issued", "billed", "cancelled"],
  bill: ["all", "draft", "open", "partial", "overdue", "paid", "void"],
  credit_note: ["all", "draft", "open", "partial", "closed", "void"],
  vendor_credit: ["all", "draft", "open", "partial", "closed", "void"],
};

export default function Documents({ kind }) {
  const K = KIND[kind];
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const state = useLoad(`/documents?kind=${kind}&q=${encodeURIComponent(q)}${status !== "all" ? `&status=${status}` : ""}`);
  const nav = useNavigate();
  const { can } = useAuth();
  // balances and due dates are for whoever handles that money (Accounts; Sales for customers)
  const seesMoney = can("money") || can("admin") || (K.contact === "customer" && can("sales.read"));
  const money_ = ["invoice", "bill", "credit_note", "vendor_credit"].includes(kind) && seesMoney;
  const isCredit = ["credit_note", "vendor_credit"].includes(kind);
  return (
    <>
      <PageHead title={K.plural}>
        <Search value={q} onChange={setQ} placeholder={K.contact === "customer" ? "Search number, PO # or customer…" : "Search number, ref or supplier…"} />
        {kind === "quote" && can("sales.write") && <Link className="btn" to="/quotes/new?enquiry=1">+ New Enquiry</Link>}
        {WRITE[kind].some(can) && kind !== "dc" && <Link className="btn primary" to={`/${K.path}/new`}>+ New {K.label}</Link>}
      </PageHead>
      <div className="tabs">{FILTERS[kind].filter((s) => seesMoney || !["partial", "overdue", "paid", "closed"].includes(s)).map((s) => <button key={s} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>{s}</button>)}</div>
      <Loading state={state}>{(rows) => rows.length === 0 ? <div className="empty">Nothing here yet.</div> : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Date</th><th>Number</th><th>{K.contact === "customer" ? "Customer" : "Supplier"}</th><th>{K.contact === "customer" ? "Job / Customer PO" : "Job / Ref"}</th><th>Status</th>{money_ && <th>{isCredit ? "Ref" : "Due"}</th>}<th className="r">Total</th>{money_ && <th className="r">{isCredit ? "Unused" : "Balance"}</th>}</tr></thead>
          <tbody>{rows.map((d) => (
            <tr key={d.id} className="click" onClick={() => nav(`/${K.path}/${d.id}`)}>
              <td>{fmtDate(d.date)}</td><td><b>{d.number}</b></td><td>{d.contact_name}</td><td>{d.job_number && <span className="muted">{d.job_number}</span>}{(d.job_po || d.reference) && (d.job_po || d.reference) !== d.job_number && <b className="po">{d.job_number ? " · " : ""}{d.job_po || d.reference}</b>}{!d.job_number && !d.reference && <span className="muted">—</span>}</td><td><Badge status={d.display_status} />{d.verified_at && <span className="badge green sm">✓</span>}</td>
              {money_ && <td>{isCredit ? <span className="muted">{d.reference || "—"}</span> : fmtDate(d.due_date)}</td>}<td className="r">{kind === "dc" ? "" : money(d.total)}</td>{money_ && <td className="r">{d.status === "open" ? money(d.balance) : "—"}</td>}
            </tr>
          ))}</tbody>
          {money_ && <tfoot><tr><td colSpan={6}>{rows.length} {K.plural.toLowerCase()}</td><td className="r">{money(rows.reduce((a, d) => a + d.total, 0))}</td><td className="r">{money(rows.filter((d) => d.status === "open").reduce((a, d) => a + d.balance, 0))}</td></tr></tfoot>}
        </table></div>
      )}</Loading>
    </>
  );
}
