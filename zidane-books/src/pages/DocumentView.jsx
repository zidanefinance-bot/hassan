import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, Badge, Field, fmtDate, KIND, Loading, Modal, money, num, PageHead, today, useLoad, useToast } from "../lib.jsx";

export function PaymentModal({ doc, onClose, onSaved }) {
  const [p, setP] = useState({ amount: doc.balance, date: today(), mode: "bank", reference: "", notes: "" });
  const [err, setErr] = useState("");
  const save = async (e) => {
    e.preventDefault();
    try { await api("/payments", { method: "POST", body: { ...p, direction: doc.kind === "invoice" ? "in" : "out", document_id: doc.id } }); onSaved(); } catch (x) { setErr(x.message); }
  };
  const bind = (k) => ({ value: p[k], onChange: (e) => setP({ ...p, [k]: e.target.value }) });
  return (
    <Modal title={doc.kind === "invoice" ? `Receive payment · ${doc.number}` : `Pay bill · ${doc.number}`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <p className="muted">Balance due: <b>{money(doc.balance)}</b></p>
        <div className="row-2"><Field label="Amount (Rs)"><input type="number" step="0.01" {...bind("amount")} required autoFocus /></Field><Field label="Date"><input type="date" {...bind("date")} /></Field></div>
        <div className="row-2">
          <Field label="Mode"><select {...bind("mode")}><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="online">Online / wallet</option></select></Field>
          <Field label="Reference"><input {...bind("reference")} placeholder="Cheque # / transaction ID" /></Field>
        </div>
        <Field label="Notes"><input {...bind("notes")} /></Field>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Record payment</button></div>
      </form>
    </Modal>
  );
}

function waText(d, company) {
  const lines = d.lines.map((l) => `• ${l.item_name || l.description} × ${num(l.qty)} = ${money(l.amount)}`).join("\n");
  const label = KIND[d.kind].label;
  return `Assalam o Alaikum ${d.contact.name},\n\n${label} ${d.number} from ${company.name}\nDate: ${fmtDate(d.date)}${d.due_date ? `\nDue: ${fmtDate(d.due_date)}` : ""}\n\n${lines}\n\nTotal: ${money(d.total)}${d.paid ? `\nPaid: ${money(d.paid)}\nBalance: ${money(d.balance)}` : ""}\n\n${company.phone} · ${company.website}`;
}

export default function DocumentView({ kind }) {
  const K = KIND[kind];
  const { id } = useParams();
  const state = useLoad(`/documents/${id}`);
  const settings = useLoad("/settings");
  const [paying, setPaying] = useState(false);
  const nav = useNavigate();
  const toast = useToast();
  const act = async (fn, msg) => { try { const r = await fn(); if (msg) toast(msg); return r; } catch (x) { toast(x.message, "err"); } };
  const status = (s) => act(() => api(`/documents/${id}/status`, { method: "POST", body: { status: s } }), `Marked ${s}`).then(state.reload);

  return (
    <Loading state={state}>{(d) => {
      const company = settings.data?.company || {};
      const money_ = ["invoice", "bill"].includes(kind);
      const phone = d.contact.phone?.replace(/\D/g, "").replace(/^0/, "92");
      return (
        <>
          <PageHead title={<>{d.number} <Badge status={d.display_status} /></>} sub={`${K.label} · ${d.contact.name}`}>
            {d.status === "draft" && <button className="btn primary" onClick={() => status(kind === "quote" ? "sent" : kind === "po" ? "issued" : "open")}>{kind === "quote" ? "Mark sent" : kind === "po" ? "Issue" : "Issue"}</button>}
            {money_ && d.status === "open" && d.balance > 0 && <button className="btn primary" onClick={() => setPaying(true)}>{kind === "invoice" ? "Receive payment" : "Pay bill"}</button>}
            {kind === "quote" && ["sent", "accepted", "draft"].includes(d.status) && <button className="btn primary" onClick={async () => { const r = await act(() => api(`/documents/${id}/convert`, { method: "POST" }), "Invoice created"); if (r) nav(`/invoices/${r.id}`); }}>Convert to invoice</button>}
            {kind === "po" && ["issued", "draft"].includes(d.status) && <button className="btn primary" onClick={async () => { const r = await act(() => api(`/documents/${id}/convert`, { method: "POST" }), "Bill created"); if (r) nav(`/bills/${r.id}`); }}>Convert to bill</button>}
            {kind === "quote" && d.status === "sent" && <><button className="btn" onClick={() => status("accepted")}>Accepted</button><button className="btn" onClick={() => status("declined")}>Declined</button></>}
            {!["void", "invoiced", "billed"].includes(d.status) && <Link className="btn" to={`/${K.path}/${id}/edit`}>Edit</Link>}
            <button className="btn" onClick={() => window.print()}>Print / PDF</button>
            {phone && <a className="btn wa-btn" href={`https://wa.me/${phone}?text=${encodeURIComponent(waText(d, company))}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            {money_ && d.status === "open" && d.paid === 0 && <button className="btn ghost danger" onClick={() => confirm(`Void ${d.number}? Stock will be reversed.`) && status("void")}>Void</button>}
            {d.paid === 0 && <button className="btn ghost danger" onClick={async () => { if (confirm(`Delete ${d.number}?`)) { await act(() => api(`/documents/${id}`, { method: "DELETE" }), "Deleted"); nav(`/${K.path}`); } }}>Delete</button>}
          </PageHead>
          {(d.source || d.children.length > 0) && (
            <p className="muted links">
              {d.source && <>Created from <Link to={`/${KIND[d.source.kind].path}/${d.source.id}`}>{d.source.number}</Link>. </>}
              {d.children.map((c) => <span key={c.id}>Converted to <Link to={`/${KIND[c.kind].path}/${c.id}`}>{c.number}</Link>. </span>)}
            </p>
          )}

          <article className="paper">
            <header className="paper-head">
              <div><img src="/logo.svg" alt="" className="paper-logo" /><div className="muted small">{company.address}<br />{company.phone} · {company.email}{company.ntn && <><br />NTN {company.ntn}{company.strn && ` · STRN ${company.strn}`}</>}</div></div>
              <div className="r"><h2>{K.label.toUpperCase()}</h2><b>{d.number}</b><div className="muted small">Date: {fmtDate(d.date)}{d.due_date && <><br />Due: {fmtDate(d.due_date)}</>}{d.reference && <><br />Ref: {d.reference}</>}</div></div>
            </header>
            <div className="paper-to"><small className="muted">{K.contact === "customer" ? "Bill to" : "Supplier"}</small><b>{d.contact.name}</b><div className="muted small">{d.contact.company}{d.contact.address && <><br />{d.contact.address}</>}{d.contact.phone && <><br />{d.contact.phone}</>}{d.contact.ntn && <><br />NTN {d.contact.ntn}</>}</div></div>
            <table className="table paper-lines">
              <thead><tr><th>#</th><th>Item</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Disc</th><th className="r">Tax</th><th className="r">Amount</th></tr></thead>
              <tbody>{d.lines.map((l, i) => (
                <tr key={l.id}><td>{i + 1}</td><td>{l.item_name || l.description}</td><td className="r">{num(l.qty)} {l.unit || ""}</td><td className="r">{money(l.rate)}</td><td className="r">{l.discount_pct ? `${l.discount_pct}%` : "—"}</td><td className="r">{l.tax_rate}%</td><td className="r">{money(l.amount)}</td></tr>
              ))}</tbody>
            </table>
            <div className="doc-bottom">
              <div className="notes small">{d.notes && <p><b>Notes</b><br />{d.notes}</p>}{d.terms && <p><b>Terms</b><br />{d.terms}</p>}</div>
              <dl className="totals">
                <dt>Subtotal</dt><dd>{money(d.subtotal)}</dd>
                {d.discount_total > 0 && <><dt>Discount</dt><dd>− {money(d.discount_total)}</dd></>}
                <dt>Tax</dt><dd>{money(d.tax_total)}</dd>
                <dt className="grand">Total</dt><dd className="grand">{money(d.total)}</dd>
                {money_ && d.paid > 0 && <><dt>Paid</dt><dd>− {money(d.paid)}</dd><dt className="grand">Balance due</dt><dd className="grand">{money(d.balance)}</dd></>}
              </dl>
            </div>
            <footer className="paper-foot muted small">{settings.data?.invoiceFooter}</footer>
          </article>

          {money_ && d.payments.length > 0 && (
            <section className="card flush no-print">
              <h3 className="pad">Payments</h3>
              <table className="table"><thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th className="r">Amount</th><th /></tr></thead>
                <tbody>{d.payments.map((p) => (
                  <tr key={p.id}><td>{fmtDate(p.date)}</td><td>{p.mode}</td><td>{p.reference}</td><td className="r">{money(p.amount)}</td>
                    <td className="r"><button className="icon-btn" aria-label="Delete payment" onClick={async () => { if (confirm("Delete this payment?")) { await act(() => api(`/payments/${p.id}`, { method: "DELETE" }), "Payment deleted"); state.reload(); } }}>×</button></td></tr>
                ))}</tbody></table>
            </section>
          )}
          {paying && <PaymentModal doc={d} onClose={() => setPaying(false)} onSaved={() => { setPaying(false); toast("Payment recorded"); state.reload(); }} />}
        </>
      );
    }}</Loading>
  );
}
