import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, Badge, Field, fmtDate, KIND, Loading, Modal, money, num, PageHead, today, useAuth, useLoad, useToast } from "../lib.jsx";
import { ApplyCreditsModal } from "./Payments.jsx";

const WRITE = { quote: ["sales.write"], invoice: ["sales.write"], dc: ["sales.write"], po: ["ops.write", "buy"], bill: ["ops.write", "buy"] };

export function PaymentModal({ doc, onClose, onSaved }) {
  const [p, setP] = useState({ amount: doc.balance, date: today(), mode: "bank", reference: "", notes: "" });
  const [err, setErr] = useState("");
  const save = async (e) => {
    e.preventDefault();
    try { await api("/payments", { method: "POST", body: { ...p, direction: doc.kind === "invoice" ? "in" : "out", document_id: doc.id } }); onSaved(); } catch (x) { setErr(x.message); }
  };
  const bind = (k) => ({ value: p[k], onChange: (e) => setP({ ...p, [k]: e.target.value }) });
  return (
    <Modal title={doc.kind === "invoice" ? `Receive payment · ${doc.number}` : `Pay supplier · ${doc.number}`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <p className="muted">Balance due: <b>{money(doc.balance)}</b>{Number(p.amount) > doc.balance && <><br /><span className="pos">{money(Number(p.amount) - doc.balance)} extra will be kept as {doc.kind === "invoice" ? "the customer's" : "an"} advance.</span></>}</p>
        <div className="row-2"><Field label="Amount (Rs)"><input type="number" step="0.01" {...bind("amount")} required autoFocus /></Field><Field label="Date"><input type="date" {...bind("date")} /></Field></div>
        <div className="row-2">
          <Field label="Mode"><select {...bind("mode")}><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="online">Online / wallet</option></select></Field>
          <Field label="Reference"><input {...bind("reference")} placeholder="Bank / cheque # / transaction ID" /></Field>
        </div>
        <Field label="Notes"><input {...bind("notes")} /></Field>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Record payment</button></div>
      </form>
    </Modal>
  );
}

function SignModal({ doc, onClose, onSaved }) {
  const [s, setS] = useState({ name: "", date: today() });
  const [err, setErr] = useState("");
  return (
    <Modal title={`Signed receiving · ${doc.number}`} onClose={onClose}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); try { await api(`/documents/${doc.id}/sign`, { method: "POST", body: s }); onSaved(); } catch (x) { setErr(x.message); } }}>
        <p className="muted">Record who received the goods at {doc.contact.name}. Keep the signed/stamped copy on file.</p>
        <div className="row-2"><Field label="Received by (name / designation)"><input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} required autoFocus /></Field>
          <Field label="Date received"><input type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} /></Field></div>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Mark signed</button></div>
      </form>
    </Modal>
  );
}

function waText(d, company) {
  const isDc = d.kind === "dc";
  const lines = d.lines.map((l) => `• ${l.item_name || l.description} × ${num(l.qty)}${isDc ? ` ${l.unit || ""}` : ` = ${money(l.amount)}`}`).join("\n");
  const head = `Assalam o Alaikum ${d.contact.name},\n\n${KIND[d.kind].label} ${d.number} from ${company.name}\nDate: ${fmtDate(d.date)}${d.due_date ? `\nDue: ${fmtDate(d.due_date)}` : ""}${d.job?.customer_po_number ? `\nYour PO: ${d.job.customer_po_number}` : ""}`;
  const tail = isDc ? "" : `\n\nTotal: ${money(d.total)}${d.paid ? `\nPaid: ${money(d.paid)}\nBalance: ${money(d.balance)}` : ""}`;
  return `${head}\n\n${lines}${tail}\n\n${company.phone} · ${company.website}`;
}

export default function DocumentView({ kind }) {
  const K = KIND[kind];
  const { id } = useParams();
  const { can } = useAuth();
  const state = useLoad(`/documents/${id}`);
  const settings = useLoad("/settings");
  const [modal, setModal] = useState(null);
  const nav = useNavigate();
  const toast = useToast();
  const act = async (fn, msg) => { try { const r = await fn(); if (msg) toast(msg); state.reload(); return r; } catch (x) { toast(x.message, "err"); } };
  const post = (path, body, msg) => act(() => api(`/documents/${id}${path}`, { method: "POST", body }), msg);
  const writer = WRITE[kind].some(can);

  return (
    <Loading state={state}>{(d) => {
      const company = settings.data?.company || {};
      const isMoney = ["invoice", "bill"].includes(kind);
      const isDc = kind === "dc";
      const editable = writer && !["void", "converted", "billed", "signed"].includes(d.status) && (!d.verified_at || can("admin"));
      const phone = d.contact.phone?.replace(/\D/g, "").replace(/^0/, "92");
      return (
        <>
          <PageHead title={<>{d.number} <Badge status={d.display_status} />{d.verified_at && <span className="badge green">verified</span>}{d.submitted_date && <span className="badge blue">submitted</span>}</>}
            sub={`${K.label} · ${d.contact.name}${d.job ? ` · ${d.job.number}` : ""}`}>
            {writer && kind === "quote" && d.status === "enquiry" && <button className="btn primary" onClick={() => post("/status", { status: "sent" }, "Marked sent")}>Rates added, mark sent</button>}
            {writer && kind === "quote" && d.status === "sent" && <><button className="btn" onClick={() => post("/status", { status: "accepted" }, "Customer confirmed")}>Customer confirmed</button><button className="btn" onClick={() => post("/status", { status: "declined" }, "Marked declined")}>Declined</button></>}
            {writer && kind === "quote" && ["sent", "accepted", "draft"].includes(d.status) && <button className="btn primary" onClick={async () => { const r = await post("/job", {}, "Job created and sent to Operations"); if (r) nav(`/jobs/${r.id}`); }}>Create Job</button>}
            {writer && d.status === "draft" && kind !== "quote" && <button className="btn primary" onClick={() => post("/status", { status: { invoice: "open", bill: "open", po: "issued", dc: "issued" }[kind] }, "Issued")}>Issue</button>}
            {writer && isDc && d.status === "issued" && <button className="btn primary" onClick={() => setModal("sign")}>Mark signed / received</button>}
            {writer && kind === "invoice" && d.status === "open" && !d.submitted_date && <button className="btn" onClick={() => post("/submit", { date: today() }, "Marked submitted to customer")}>Mark submitted</button>}
            {can("verify") && isMoney && d.status === "open" && !d.verified_at && <button className="btn primary" onClick={() => post("/verify", {}, "Verified")}>Verify</button>}
            {can("money") && isMoney && d.status === "open" && d.balance > 0 && <button className="btn primary" onClick={() => setModal("pay")}>{kind === "invoice" ? "Receive payment" : "Pay supplier"}</button>}
            {can("money") && isMoney && d.status === "open" && d.balance > 0 && d.credits.length > 0 && <button className="btn" onClick={() => setModal("credits")}>Apply credits ({money(d.credits.reduce((a, c) => a + c.unused, 0))})</button>}
            {writer && kind === "po" && ["issued", "draft"].includes(d.status) && <button className="btn primary" onClick={async () => { const r = await post("/convert", {}, "Bill created"); if (r) nav(`/bills/${r.id}`); }}>Convert to bill</button>}
            {editable && <Link className="btn" to={`/${K.path}/${id}/edit`}>Edit</Link>}
            <button className="btn" onClick={() => window.print()}>Print / PDF</button>
            {phone && <a className="btn wa-btn" href={`https://wa.me/${phone}?text=${encodeURIComponent(waText(d, company))}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            {writer && ["open", "issued"].includes(d.status) && d.paid === 0 && ["invoice", "bill", "dc"].includes(kind) && <button className="btn ghost danger" onClick={() => confirm(`Void ${d.number}?${isDc || kind === "bill" ? " Stock will be reversed." : ""}`) && post("/status", { status: "void" }, "Voided")}>Void</button>}
            {writer && d.paid === 0 && ((!d.verified_at && d.status !== "signed") || can("admin")) && <button className="btn ghost danger" onClick={async () => { if (confirm(`Delete ${d.number}?`)) { await act(() => api(`/documents/${id}`, { method: "DELETE" }), "Deleted"); nav(`/${K.path}`); } }}>Delete</button>}
          </PageHead>
          <p className="muted links">
            {d.job && <>Job <Link to={`/jobs/${d.job.id}`}>{d.job.number}</Link>. </>}
            {d.source && <>Created from <Link to={`/${KIND[d.source.kind].path}/${d.source.id}`}>{d.source.number}</Link>. </>}
            {d.children.map((c) => <span key={c.id}>Converted to <Link to={`/${KIND[c.kind].path}/${c.id}`}>{c.number}</Link>. </span>)}
            {d.verified_at && <>Verified by {d.verified_by_name}. </>}
            {d.submitted_date && <>Submitted to customer on {fmtDate(d.submitted_date)}. </>}
            {d.signed_at && <>Received by {d.signed_by_name} on {fmtDate(d.signed_at)}. </>}
          </p>

          <article className="paper">
            <header className="paper-head">
              <div><img src="/logo.svg" alt="" className="paper-logo" /><div className="muted small">{company.address}<br />{company.phone} · {company.email}{company.ntn && <><br />NTN {company.ntn}{company.strn && ` · STRN ${company.strn}`}</>}</div></div>
              <div className="r"><h2>{(kind === "quote" && d.status === "enquiry" ? "Enquiry" : K.label).toUpperCase()}</h2><b>{d.number}</b>
                <div className="muted small">Date: {fmtDate(d.date)}{d.due_date && <><br />Due: {fmtDate(d.due_date)}</>}{d.reference && <><br />Ref: {d.reference}</>}{d.job?.customer_po_number && <><br />Customer PO: {d.job.customer_po_number}</>}</div></div>
            </header>
            <div className="paper-to"><small className="muted">{K.contact === "customer" ? (isDc ? "Deliver to" : "Bill to") : "Supplier"}</small><b>{d.contact.name}</b>
              <div className="muted small">{d.contact.company}{(d.job?.delivery_location || d.contact.address) && <><br />{isDc && d.job?.delivery_location ? d.job.delivery_location : d.contact.address}</>}{d.contact.phone && <><br />{d.contact.phone}</>}{d.contact.ntn && <><br />NTN {d.contact.ntn}</>}</div></div>
            <table className="table paper-lines">
              <thead><tr><th>#</th><th>Item</th><th className="r">Qty</th>{!isDc && <><th className="r">Rate</th><th className="r">Disc</th><th className="r">Tax</th><th className="r">Amount</th></>}</tr></thead>
              <tbody>{d.lines.map((l, i) => (
                <tr key={l.id}><td>{i + 1}</td><td>{l.item_name || l.description}</td><td className="r">{num(l.qty)} {l.unit || ""}</td>
                  {!isDc && <><td className="r">{l.rate ? money(l.rate) : <span className="neg">pending</span>}</td><td className="r">{l.discount_pct ? `${l.discount_pct}%` : "—"}</td><td className="r">{l.tax_rate}%</td><td className="r">{money(l.amount)}</td></>}</tr>
              ))}</tbody>
            </table>
            {isDc ? (
              <div className="sign-row">
                <div><div className="sign-line" />Delivered by (Zidane)</div>
                <div><div className="sign-line">{d.signed_by_name}</div>Received by: name, sign & stamp</div>
              </div>
            ) : (
              <div className="doc-bottom">
                <div className="notes small">{d.notes && <p><b>Notes</b><br />{d.notes}</p>}{d.terms && <p><b>Terms</b><br />{d.terms}</p>}</div>
                <dl className="totals">
                  <dt>Subtotal</dt><dd>{money(d.subtotal)}</dd>
                  {d.discount_total > 0 && <><dt>Discount</dt><dd>− {money(d.discount_total)}</dd></>}
                  <dt>Tax</dt><dd>{money(d.tax_total)}</dd>
                  <dt className="grand">Total</dt><dd className="grand">{money(d.total)}</dd>
                  {isMoney && d.paid > 0 && <><dt>Paid</dt><dd>− {money(d.paid)}</dd><dt className="grand">Balance due</dt><dd className="grand">{money(d.balance)}</dd></>}
                </dl>
              </div>
            )}
            {isDc && d.notes && <p className="small">{d.notes}</p>}
            <footer className="paper-foot muted small">{settings.data?.invoiceFooter}</footer>
          </article>

          {isMoney && d.payments.length > 0 && (
            <section className="card flush no-print">
              <h3 className="pad">Payments</h3>
              <table className="table"><thead><tr><th>Payment</th><th>Paid on</th><th>Mode</th><th>Reference</th><th className="r">Applied here</th><th /></tr></thead>
                <tbody>{d.payments.map((p) => (
                  <tr key={p.allocation_id}><td>{can("money") ? <Link to={`/payments/${p.id}`}>{p.number}</Link> : p.number}</td><td>{fmtDate(p.date)}</td><td>{p.mode}</td><td>{p.reference}</td><td className="r">{money(p.amount)}</td>
                    <td className="r">{can("money") && <button className="btn sm ghost danger" onClick={async () => { if (confirm("Unapply this payment? The amount goes back to the contact's advance.")) await act(() => api(`/allocations/${p.allocation_id}`, { method: "DELETE" }), "Unapplied"); }}>Unapply</button>}</td></tr>
                ))}</tbody></table>
            </section>
          )}
          {modal === "pay" && <PaymentModal doc={d} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast("Payment recorded"); state.reload(); }} />}
          {modal === "credits" && <ApplyCreditsModal doc={d} Modal={Modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast("Credits applied"); state.reload(); }} />}
          {modal === "sign" && <SignModal doc={d} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast("Signed DC recorded. Job marked delivered."); state.reload(); }} />}
        </>
      );
    }}</Loading>
  );
}
