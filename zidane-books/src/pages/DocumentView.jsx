import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, Badge, Field, fmtDate, KIND, Loading, Modal, money, num, PageHead, today, useAuth, useLoad, useToast } from "../lib.jsx";
import { AllocationTable, ApplyCreditsModal, RefundModal } from "./Payments.jsx";
import Attachments from "../components/Attachments.jsx";
import Comments from "../components/Comments.jsx";

const WRITE = { quote: ["sales.write"], invoice: ["sales.write"], dc: ["sales.write"], credit_note: ["sales.write"], po: ["ops.write", "buy"], bill: ["ops.write", "buy"], vendor_credit: ["ops.write"] };
const ATTACH_LABELS = { quote: ["Customer enquiry", "Customer PO"], invoice: ["Customer PO", "Submission receipt"], dc: ["Signed DC", "Gate pass"], credit_note: ["Return note"], po: ["Supplier quotation"], bill: ["Supplier bill photo", "Delivery note"], vendor_credit: ["Return note"] };

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

function EmailModal({ doc, onClose, onSent }) {
  const [to, setTo] = useState(doc.contact?.email || "");
  const [message, setMessage] = useState("");
  const [withDc, setWithDc] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const setup = useLoad("/setup-status");
  // an invoice made from a Job can carry that Job's issued DC in the same email
  const jobDocs = useLoad(doc.job_id && doc.kind === "invoice" ? `/jobs/${doc.job_id}` : null);
  const dcs = (jobDocs.data?.documents || []).filter((x) => x.kind === "dc" && ["issued", "signed"].includes(x.status));
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { onSent(await api(`/documents/${doc.id}/email`, { method: "POST", body: { to, message: message || undefined, with: withDc ? dcs.map((x) => x.id) : [] } })); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <Modal title={`Email ${doc.number}`} onClose={onClose}>
      {setup.data && !setup.data.email_out ? <div className="form"><p>Email isn't set up on the server yet. A director can add the SMTP settings (see SETUP-AI-EMAIL.md). Until then use Print / PDF or WhatsApp.</p><div className="form-actions"><button className="btn" onClick={onClose}>Close</button></div></div> : (
        <form className="form" onSubmit={send}>
          <Field label="To" hint="Separate several addresses with commas"><input value={to} onChange={(e) => setTo(e.target.value)} required placeholder="accounts@customer.com" /></Field>
          <Field label="Message (optional)" hint="Leave empty for a standard message with the amount and due date"><textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
          {dcs.length > 0 && <label className="check"><input type="checkbox" checked={withDc} onChange={(e) => setWithDc(e.target.checked)} /> Also attach {dcs.map((x) => x.number).join(", ")}</label>}
          <p className="muted small">The {doc.kind === "dc" ? "challan" : "document"} goes as a PDF attachment.{doc.kind === "invoice" && !doc.submitted_date ? " The invoice will be marked as submitted to the customer." : ""}</p>
          {err && <div className="form-error">{err}</div>}
          <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Sending…" : "Send"}</button></div>
        </form>
      )}
    </Modal>
  );
}

export default function DocumentView({ kind }) {
  const K = KIND[kind];
  const { id } = useParams();
  const { can } = useAuth();
  const state = useLoad(`/documents/${id}`);
  const settings = useLoad("/settings");
  const [modal, setModal] = useState(null);
  const [allocDocs, setAllocDocs] = useState(null);
  const [allocValues, setAllocValues] = useState({});
  const nav = useNavigate();
  const toast = useToast();
  const act = async (fn, msg) => { try { const r = await fn(); if (msg) toast(msg); state.reload(); return r; } catch (x) { toast(x.message, "err"); } };
  const post = (path, body, msg) => act(() => api(`/documents/${id}${path}`, { method: "POST", body }), msg);
  const writer = WRITE[kind].some(can);

  return (
    <Loading state={state}>{(d) => {
      const company = settings.data?.company || {};
      const isMoney = ["invoice", "bill"].includes(kind);
      const isCredit = ["credit_note", "vendor_credit"].includes(kind);
      const isDc = kind === "dc";
      const editable = writer && !["void", "converted", "billed", "signed"].includes(d.status) && (!d.verified_at || can("admin"));
      const phone = d.contact.phone?.replace(/\D/g, "").replace(/^0/, "92");
      return (
        <>
          <PageHead title={<>{d.number} <Badge status={d.display_status} />{d.verified_at && <span className="badge green">verified</span>}{d.submitted_date && <span className="badge blue">submitted</span>}{isCredit && d.status === "open" && d.balance > 0 && <span className="badge green">{money(d.balance)} unused</span>}</>}
            sub={`${K.label} · ${d.contact.name}${d.job ? ` · ${d.job.number}` : ""}`}>
            {writer && kind === "quote" && d.status === "enquiry" && <button className="btn primary" onClick={() => post("/status", { status: "sent" }, "Marked sent")}>Rates added, mark sent</button>}
            {writer && kind === "quote" && d.status === "sent" && <><button className="btn" onClick={() => post("/status", { status: "accepted" }, "Customer confirmed")}>Customer confirmed</button><button className="btn" onClick={() => post("/status", { status: "declined" }, "Marked declined")}>Declined</button></>}
            {writer && kind === "quote" && ["sent", "accepted", "draft"].includes(d.status) && <button className="btn primary" onClick={async () => { const r = await post("/job", {}, "Job created and sent to Operations"); if (r) nav(`/jobs/${r.id}`); }}>Create Job</button>}
            {writer && d.status === "draft" && kind !== "quote" && <button className="btn primary" onClick={() => post("/status", { status: { invoice: "open", bill: "open", po: "issued", dc: "issued", credit_note: "open", vendor_credit: "open" }[kind] }, "Issued")}>Issue</button>}
            {can("money") && isCredit && d.status === "open" && d.balance > 0 && <button className="btn primary" onClick={() => api(`/contacts/${d.contact_id}/open-documents`).then(setAllocDocs)}>Apply to {kind === "credit_note" ? "invoices" : "bills"}</button>}
            {can("money") && isCredit && d.status === "open" && d.balance > 0 && <button className="btn" onClick={() => setModal("refund")}>Refund</button>}
            {kind === "invoice" && d.status === "open" && can("sales.write") && <Link className="btn" to={`/credit-notes/new?from=${id}`}>Credit note</Link>}
            {kind === "bill" && d.status === "open" && can("ops.write") && <Link className="btn" to={`/vendor-credits/new?from=${id}`}>Vendor credit</Link>}
            {writer && isDc && d.status === "issued" && <button className="btn primary" onClick={() => setModal("sign")}>Mark signed / received</button>}
            {writer && kind === "invoice" && d.status === "open" && !d.submitted_date && <button className="btn" onClick={() => post("/submit", { date: today() }, "Marked submitted to customer")}>Mark submitted</button>}
            {can("verify") && isMoney && d.status === "open" && !d.verified_at && <button className="btn primary" onClick={() => post("/verify", {}, "Verified")}>Verify</button>}
            {can("money") && isMoney && d.status === "open" && d.balance > 0 && <button className="btn primary" onClick={() => setModal("pay")}>{kind === "invoice" ? "Receive payment" : "Pay supplier"}</button>}
            {can("money") && isMoney && d.status === "open" && d.balance > 0 && d.credits.length > 0 && <button className="btn" onClick={() => setModal("credits")}>Apply credits ({money(d.credits.reduce((a, c) => a + c.unused, 0))})</button>}
            {writer && kind === "po" && ["issued", "draft"].includes(d.status) && <button className="btn primary" onClick={async () => { const r = await post("/convert", {}, "Bill created"); if (r) nav(`/bills/${r.id}`); }}>Convert to bill</button>}
            {editable && <Link className="btn" to={`/${K.path}/${id}/edit`}>Edit</Link>}
            {writer && <button className="btn" onClick={async () => { const r = await post("/clone", {}, "Copied as a new draft"); if (r) nav(`/${K.path}/${r.id}/edit`); }}>Copy</button>}
            <button className="btn" onClick={() => window.print()}>Print / PDF</button>
            {writer && !["draft", "void", "enquiry"].includes(d.status) && <button className="btn" onClick={() => setModal("email")}>Email</button>}
            {phone && <a className="btn wa-btn" href={`https://wa.me/${phone}?text=${encodeURIComponent(waText(d, company))}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            {writer && ["open", "issued"].includes(d.status) && d.paid === 0 && ["invoice", "bill", "dc", "credit_note", "vendor_credit"].includes(kind) && (!isCredit || d.balance === d.total) && <button className="btn ghost danger" onClick={() => confirm(`Void ${d.number}?${isDc || kind === "bill" ? " Stock will be reversed." : ""}`) && post("/status", { status: "void" }, "Voided")}>Void</button>}
            {writer && d.paid === 0 && ((!d.verified_at && d.status !== "signed") || can("admin")) && <button className="btn ghost danger" onClick={async () => { if (confirm(`Delete ${d.number}?`)) { await act(() => api(`/documents/${id}`, { method: "DELETE" }), "Deleted"); nav(`/${K.path}`); } }}>Delete</button>}
          </PageHead>
          {d.credit_status?.over && <div className="form-error no-print">Over credit limit: customer owes {money(d.credit_status.owed)}, limit {money(d.credit_status.limit)}. Only a director can issue this invoice.</div>}
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
                  {d.discount_total > 0 && <><dt>Line discounts</dt><dd>− {money(d.discount_total)}</dd></>}
                  <dt>Tax</dt><dd>{money(d.tax_total)}</dd>
                  {d.doc_discount > 0 && <><dt>Discount</dt><dd>− {money(d.doc_discount)}</dd></>}
                  {d.charges > 0 && <><dt>{d.charges_label || "Charges"}</dt><dd>{money(d.charges)}</dd></>}
                  {d.adjustment !== 0 && <><dt>Round off</dt><dd>{d.adjustment > 0 ? "" : "− "}{money(Math.abs(d.adjustment))}</dd></>}
                  <dt className="grand">Total</dt><dd className="grand">{money(d.total)}</dd>
                  {isCredit && <><dt>Unused</dt><dd>{money(d.balance)}</dd></>}
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
                  <tr key={p.allocation_id}><td>{p.source === "credit" ? <Link to={`/${KIND[p.credit_kind].path}/${p.id}`}>{p.number}</Link> : can("money") ? <Link to={`/payments/${p.id}`}>{p.number}</Link> : p.number}</td><td>{fmtDate(p.date)}</td><td>{p.mode}</td><td>{p.reference}</td><td className="r">{money(p.amount)}</td>
                    <td className="r">{can("money") && <button className="btn sm ghost danger" onClick={async () => { if (confirm("Unapply this payment? The amount goes back to the contact's advance.")) await act(() => api(`/allocations/${p.allocation_id}`, { method: "DELETE" }), "Unapplied"); }}>Unapply</button>}</td></tr>
                ))}</tbody></table>
            </section>
          )}
          {modal === "pay" && <PaymentModal doc={d} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast("Payment recorded"); state.reload(); }} />}
          {isCredit && (d.applications.length > 0 || d.refunds.length > 0) && (
            <section className="card flush no-print">
              <h3 className="pad">Where this credit went</h3>
              <table className="table"><thead><tr><th>Used for</th><th>Date</th><th className="r">Amount</th><th /></tr></thead>
                <tbody>
                  {d.applications.map((a) => <tr key={`a${a.id}`}><td>Applied to <Link to={`/${KIND[a.kind].path}/${a.document_id}`}>{a.number}</Link></td><td>{fmtDate(a.date)}</td><td className="r">{money(a.amount)}</td>
                    <td className="r">{can("money") && <button className="btn sm ghost danger" onClick={() => act(() => api(`/allocations/${a.id}`, { method: "DELETE" }), "Unapplied")}>Unapply</button>}</td></tr>)}
                  {d.refunds.map((r) => <tr key={`r${r.id}`}><td>Refund {r.number} · {r.mode}{r.reference ? ` · ${r.reference}` : ""}</td><td>{fmtDate(r.date)}</td><td className="r">{money(r.amount)}</td>
                    <td className="r">{can("money") && <button className="btn sm ghost danger" onClick={() => confirm(`Delete refund ${r.number}?`) && act(() => api(`/refunds/${r.id}`, { method: "DELETE" }), "Refund deleted")}>Delete</button>}</td></tr>)}
                </tbody></table>
            </section>
          )}
          {allocDocs && (
            <section className="card form no-print">
              <AllocationTable docs={allocDocs} values={allocValues} setValues={setAllocValues} max={d.balance} />
              <div className="form-actions"><button className="btn ghost" onClick={() => { setAllocDocs(null); setAllocValues({}); }}>Cancel</button>
                <button className="btn primary" onClick={async () => { await act(() => api(`/documents/${id}/allocate`, { method: "POST", body: { allocations: Object.entries(allocValues).filter(([, v]) => Number(v) > 0).map(([document_id, amount]) => ({ document_id: Number(document_id), amount: Number(amount) })) } }), "Credit applied"); setAllocDocs(null); setAllocValues({}); }}>Apply</button></div>
            </section>
          )}
          <Attachments entity="document" id={d.id} labels={ATTACH_LABELS[kind] || []} />
          <Comments entity="document" id={d.id} />
          {modal === "refund" && <RefundModal source={{ credit_id: d.id }} number={d.number} unused={d.balance} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast("Refund recorded"); state.reload(); }} />}
          {modal === "credits" && <ApplyCreditsModal doc={d} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast("Credits applied"); state.reload(); }} />}
          {modal === "email" && <EmailModal doc={d} onClose={() => setModal(null)} onSent={(r) => { setModal(null); toast(`Emailed to ${r.to}`); state.reload(); }} />}
          {modal === "sign" && <SignModal doc={d} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast("Signed DC recorded. Job marked delivered."); state.reload(); }} />}
        </>
      );
    }}</Loading>
  );
}
