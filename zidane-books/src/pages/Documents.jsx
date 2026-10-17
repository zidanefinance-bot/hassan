import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, fmtDate, KIND, Loading, money, PageHead, Search, useLoad } from "../lib.jsx";

const FILTERS = {
  quote: ["all", "draft", "sent", "accepted", "declined", "invoiced"],
  invoice: ["all", "draft", "open", "partial", "overdue", "paid", "void"],
  po: ["all", "draft", "issued", "billed", "cancelled"],
  bill: ["all", "draft", "open", "partial", "overdue", "paid", "void"],
};

export default function Documents({ kind }) {
  const K = KIND[kind];
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const state = useLoad(`/documents?kind=${kind}&q=${encodeURIComponent(q)}${status !== "all" ? `&status=${status}` : ""}`);
  const nav = useNavigate();
  const money_ = ["invoice", "bill"].includes(kind);
  return (
    <>
      <PageHead title={K.plural}>
        <Search value={q} onChange={setQ} placeholder={`Search ${K.plural.toLowerCase()}…`} />
        <Link className="btn primary" to={`/${K.path}/new`}>+ New {K.label}</Link>
      </PageHead>
      <div className="tabs">{FILTERS[kind].map((s) => <button key={s} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>{s}</button>)}</div>
      <Loading state={state}>{(rows) => rows.length === 0 ? <div className="empty">Nothing here yet.</div> : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Date</th><th>Number</th><th>{K.contact === "customer" ? "Customer" : "Supplier"}</th><th>Status</th>{money_ && <th>Due</th>}<th className="r">Total</th>{money_ && <th className="r">Balance</th>}</tr></thead>
          <tbody>{rows.map((d) => (
            <tr key={d.id} className="click" onClick={() => nav(`/${K.path}/${d.id}`)}>
              <td>{fmtDate(d.date)}</td><td><b>{d.number}</b></td><td>{d.contact_name}</td><td><Badge status={d.display_status} /></td>
              {money_ && <td>{fmtDate(d.due_date)}</td>}<td className="r">{money(d.total)}</td>{money_ && <td className="r">{d.status === "open" ? money(d.balance) : "—"}</td>}
            </tr>
          ))}</tbody>
          {money_ && <tfoot><tr><td colSpan={5}>{rows.length} {K.plural.toLowerCase()}</td><td className="r">{money(rows.reduce((a, d) => a + d.total, 0))}</td><td className="r">{money(rows.filter((d) => d.status === "open").reduce((a, d) => a + d.balance, 0))}</td></tr></tfoot>}
        </table></div>
      )}</Loading>
    </>
  );
}
