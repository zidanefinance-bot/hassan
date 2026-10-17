import React from "react";
import { Link } from "react-router-dom";
import { fmtDate, KIND, Loading, money, PageHead, useLoad } from "../lib.jsx";

export default function Payments({ direction }) {
  const state = useLoad(`/payments?direction=${direction}`);
  const isIn = direction === "in";
  return (
    <>
      <PageHead title={isIn ? "Payments Received" : "Payments Made"} sub={isIn ? "Money collected from customers. Record new ones from an invoice." : "Money paid to suppliers. Record new ones from a bill."} />
      <Loading state={state}>{(rows) => rows.length === 0 ? <div className="empty">No payments yet.</div> : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Date</th><th>{isIn ? "Customer" : "Supplier"}</th><th>Against</th><th>Mode</th><th>Reference</th><th className="r">Amount</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id}><td>{fmtDate(p.date)}</td><td><Link to={`/contacts/${p.contact_id}`}>{p.contact_name}</Link></td>
              <td>{p.document_id ? <Link to={`/${KIND[p.document_kind].path}/${p.document_id}`}>{p.document_number}</Link> : "—"}</td><td>{p.mode}</td><td className="muted">{p.reference}</td><td className="r"><b>{money(p.amount)}</b></td></tr>
          ))}</tbody>
          <tfoot><tr><td colSpan={5}>{rows.length} payments</td><td className="r">{money(rows.reduce((a, p) => a + p.amount, 0))}</td></tr></tfoot>
        </table></div>
      )}</Loading>
    </>
  );
}
