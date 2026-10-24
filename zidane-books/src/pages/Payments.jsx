// Customer receipts and supplier payments. One payment can be split across several invoices/bills;
// whatever is left stays with the contact as an advance (unused credit) and can be applied later.
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, Field, fmtDate, KIND, Loading, Modal, money, PageHead, today, useLoad, useToast } from "../lib.jsx";
import AccountSelect from "../components/AccountSelect.jsx";
import Attachments from "../components/Attachments.jsx";
import Comments from "../components/Comments.jsx";
import Activity from "../components/Activity.jsx";
import Picker from "../components/Picker.jsx";

const isIn = (d) => d === "in";
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function Payments({ direction }) {
  const state = useLoad(`/payments?direction=${direction}`);
  const nav = useNavigate();
  return (
    <>
      <PageHead title={isIn(direction) ? "Payments Received" : "Payments Made"} sub={isIn(direction) ? "Customer receipts. Money not applied to an invoice stays as the customer's advance." : "Supplier payments. Money not applied to a bill stays as an advance to the supplier."}>
        <Link className="btn primary" to={`/payments/new?direction=${direction}`}>{isIn(direction) ? "+ Receive payment" : "+ Pay supplier"}</Link>
      </PageHead>
      <Loading state={state}>{(rows) => rows.length === 0 ? <div className="empty">No payments yet.</div> : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Date</th><th>Number</th><th>{isIn(direction) ? "Customer" : "Supplier"}</th><th>Applied to</th><th>Account</th><th className="r">Amount</th><th className="r">Unused (advance)</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id} className="click" onClick={() => nav(`/payments/${p.id}`)}>
              <td>{fmtDate(p.date)}</td><td><b>{p.number}</b></td><td>{p.contact_name}</td><td className="muted small">{p.applied_to || "—"}</td><td>{p.account_name || p.mode}<div className="muted small">{p.mode}</div></td>
              <td className="r">{money(p.amount)}{p.wht_income + p.wht_sales > 0 && <div className="muted small">+ {money(p.wht_income + p.wht_sales)} tax withheld</div>}</td><td className={`r ${p.unused > 0 ? "pos" : "muted"}`}>{p.unused > 0 ? money(p.unused) : "—"}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td colSpan={5}>{rows.length} payments</td><td className="r">{money(rows.reduce((a, p) => a + p.amount, 0))}</td><td className="r">{money(rows.reduce((a, p) => a + p.unused, 0))}</td></tr></tfoot>
        </table></div>
      )}</Loading>
    </>
  );
}

// table of open invoices/bills with an amount box each; `max` caps the total
export function AllocationTable({ docs, values, setValues, max }) {
  const applied = r2(Object.values(values).reduce((a, v) => a + (Number(v) || 0), 0));
  const autofill = () => {
    let left = r2(max);
    const next = {};
    for (const d of docs) { const take = r2(Math.min(left, d.balance)); if (take > 0) next[d.id] = take; left = r2(left - take); }
    setValues(next);
  };
  if (docs.length === 0) return <p className="muted">No open {docs.kind || "documents"} for this contact. The whole amount will be kept as an advance.</p>;
  return (
    <>
      <div className="row-between"><h3>Apply to</h3><div className="actions"><button type="button" className="btn sm" onClick={autofill}>Auto-apply (oldest first)</button><button type="button" className="btn sm ghost" onClick={() => setValues({})}>Clear</button></div></div>
      <table className="table compact">
        <thead><tr><th>Number</th><th>Date</th><th>Due</th><th className="r">Total</th><th className="r">Balance</th><th className="r" style={{ width: 150 }}>Apply</th></tr></thead>
        <tbody>{docs.map((d) => (
          <tr key={d.id}>
            <td><Link to={`/${KIND[d.kind].path}/${d.id}`} target="_blank">{d.number}</Link></td><td>{fmtDate(d.date)}</td><td className={d.due_date && d.due_date < today() ? "neg" : ""}>{fmtDate(d.due_date)}</td>
            <td className="r">{money(d.total)}</td><td className="r">{money(d.balance)}</td>
            <td className="r"><div className="with-btn"><input type="number" step="0.01" min="0" max={d.balance} value={values[d.id] ?? ""} onChange={(e) => setValues({ ...values, [d.id]: e.target.value })} />
              <button type="button" className="btn sm ghost" title="Pay in full" onClick={() => setValues({ ...values, [d.id]: d.balance })}>Full</button></div></td>
          </tr>
        ))}</tbody>
        <tfoot><tr><td colSpan={5}>Applied</td><td className={`r ${applied > max + 0.001 ? "neg" : ""}`}>{money(applied)}</td></tr></tfoot>
      </table>
    </>
  );
}

export function RecordPayment() {
  const [params] = useSearchParams();
  const direction = params.get("direction") === "out" ? "out" : "in";
  const type = isIn(direction) ? "customer" : "supplier";
  const contacts = useLoad(`/contacts?type=${type}`);
  const [p, setP] = useState({ contact_id: params.get("contact") || "", amount: "", wht_income: "", wht_sales: "", date: today(), mode: "bank", account_id: "", reference: "", notes: "" });
  const [docs, setDocs] = useState([]);
  const [values, setValues] = useState({});
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const toast = useToast();
  useEffect(() => {
    setValues({});
    if (!p.contact_id) return setDocs([]);
    api(`/contacts/${p.contact_id}/open-documents`).then(setDocs).catch(() => setDocs([]));
  }, [p.contact_id]);
  const applied = r2(Object.values(values).reduce((a, v) => a + (Number(v) || 0), 0));
  // what the payment settles: the money plus any tax withheld at source
  const settles = r2((Number(p.amount) || 0) + (Number(p.wht_income) || 0) + (Number(p.wht_sales) || 0));
  const advance = r2(settles - applied);
  const bind = (k) => ({ value: p[k], onChange: (e) => setP({ ...p, [k]: e.target.value }) });
  const save = async (e) => {
    e.preventDefault(); setErr("");
    if (!p.contact_id) return setErr(`Choose the ${isIn(direction) ? "customer" : "supplier"}`);
    try {
      const allocations = Object.entries(values).filter(([, v]) => Number(v) > 0).map(([document_id, amount]) => ({ document_id: Number(document_id), amount: Number(amount) }));
      const r = await api("/payments", { method: "POST", body: { ...p, direction, contact_id: Number(p.contact_id), allocations } });
      toast(advance > 0 ? `Saved. ${money(advance)} kept as advance` : "Payment saved");
      nav(`/payments/${r.id}`);
    } catch (x) { setErr(x.message); }
  };
  return (
    <>
      <PageHead title={isIn(direction) ? "Receive payment" : "Pay supplier"} sub={isIn(direction) ? "Apply it to one or more invoices. Anything not applied is kept as the customer's advance." : "Apply it to one or more bills. Anything not applied is kept as an advance to the supplier."} />
      <form className="card form" onSubmit={save}>
        <div className="row-4">
          <Field label={isIn(direction) ? "Customer *" : "Supplier *"}><Picker options={(contacts.data || []).map((c) => ({ id: c.id, label: c.name, sub: c.outstanding > 0 ? `${isIn(direction) ? "owes" : "we owe"} ${money(c.outstanding)}` : c.company || "", search: `${c.company || ""} ${c.phone || ""}` }))}
            value={p.contact_id} onChange={(v) => setP((x) => ({ ...x, contact_id: String(v) }))} placeholder={`Type ${isIn(direction) ? "customer" : "supplier"} name…`} invalid={err && !p.contact_id} /></Field>
          <Field label="Amount (Rs) *"><input type="number" step="0.01" {...bind("amount")} required /></Field>
          <Field label="Date"><input type="date" {...bind("date")} /></Field>
          <Field label="Mode"><select {...bind("mode")}><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="online">Online / wallet</option></select></Field>
        </div>
        <div className="row-4">
          <Field label={isIn(direction) ? "Received into *" : "Paid from *"}><AccountSelect value={p.account_id} mode={p.mode} onChange={(v) => setP((x) => ({ ...x, account_id: v }))} /></Field>
        </div>
        <div className="row-4">
          <Field label={isIn(direction) ? "Income tax they withheld (Rs)" : "Income tax we withheld (Rs)"} hint="WHT deducted at source"><input type="number" step="0.01" min="0" {...bind("wht_income")} /></Field>
          <Field label={isIn(direction) ? "Sales tax they withheld (Rs)" : "Sales tax we withheld (Rs)"}><input type="number" step="0.01" min="0" {...bind("wht_sales")} /></Field>
          <Field label="Reference"><input {...bind("reference")} placeholder="Bank / cheque # / transaction ID" /></Field><Field label="Notes"><input {...bind("notes")} /></Field>
        </div>
        {p.contact_id && <AllocationTable docs={docs} values={values} setValues={setValues} max={settles} />}
        <dl className="totals pay-sum">
          <dt>Amount received</dt><dd>{money(p.amount)}</dd>
          {settles > (Number(p.amount) || 0) && <><dt>Tax withheld</dt><dd>{money(settles - (Number(p.amount) || 0))}</dd></>}
          <dt>Applied to {isIn(direction) ? "invoices" : "bills"}</dt><dd>{money(applied)}</dd>
          <dt className="grand">{advance >= 0 ? "Kept as advance" : "Over-applied"}</dt><dd className={`grand ${advance < 0 ? "neg" : advance > 0 ? "pos" : ""}`}>{money(Math.abs(advance))}</dd>
        </dl>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={() => nav(-1)}>Cancel</button><button className="btn primary" disabled={advance < -0.001}>Save payment</button></div>
      </form>
    </>
  );
}

// give back an unused advance or credit note: source = { payment_id } or { credit_id }
export function RefundModal({ source, number, unused, onClose, onSaved }) {
  const [r, setR] = useState({ amount: unused, date: today(), mode: "bank", account_id: "", reference: "", notes: "" });
  const [err, setErr] = useState("");
  const b = (k) => ({ value: r[k], onChange: (e) => setR({ ...r, [k]: e.target.value }) });
  return (
    <Modal title={`Refund from ${number}`} onClose={onClose}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); try { await api("/refunds", { method: "POST", body: { ...source, ...r } }); onSaved(); } catch (x) { setErr(x.message); } }}>
        <p className="muted">Unused: <b>{money(unused)}</b></p>
        <div className="row-2"><Field label="Amount (Rs)"><input type="number" step="0.01" {...b("amount")} required autoFocus /></Field><Field label="Date"><input type="date" {...b("date")} /></Field></div>
        <div className="row-2"><Field label="Mode"><select {...b("mode")}><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="online">Online / wallet</option></select></Field><Field label="Reference"><input {...b("reference")} /></Field></div>
        <Field label="Paid from / into *"><AccountSelect value={r.account_id} mode={r.mode} onChange={(v) => setR((x) => ({ ...x, account_id: v }))} /></Field>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Record refund</button></div>
      </form>
    </Modal>
  );
}

export function PaymentView() {
  const { id } = useParams();
  const state = useLoad(`/payments/${id}`);
  const [docs, setDocs] = useState(null);
  const [values, setValues] = useState({});
  const [refunding, setRefunding] = useState(false);
  const nav = useNavigate();
  const toast = useToast();
  const act = async (fn, msg) => { try { await fn(); toast(msg); state.reload(); setDocs(null); setValues({}); } catch (x) { toast(x.message, "err"); } };
  return (
    <Loading state={state}>{(p) => (
      <>
        <PageHead title={<>{p.number} {p.unused > 0 && <span className="badge green">{money(p.unused)} unused</span>}</>} sub={`${p.direction === "in" ? "Received from" : "Paid to"} ${p.contact_name} · ${fmtDate(p.date)}`}>
          <Link className="btn" to={`/contacts/${p.contact_id}`}>Ledger</Link>
          {p.unused > 0 && <button className="btn" onClick={() => setRefunding(true)}>Refund</button>}
          {p.allocations.length === 0 && p.refunds.length === 0 && <button className="btn ghost danger" onClick={() => confirm(`Delete ${p.number}?`) && act(async () => { await api(`/payments/${id}`, { method: "DELETE" }); nav(p.direction === "in" ? "/payments-received" : "/payments-made"); }, "Payment deleted")}>Delete</button>}
        </PageHead>
        <div className="stats">
          <div className="stat"><small>Amount</small><b>{money(p.amount)}</b><span className="muted">{p.account_name ? `${p.account_name} · ` : ""}{p.mode}{p.reference ? ` · ${p.reference}` : ""}</span></div>
          {p.wht_income + p.wht_sales > 0 && <div className="stat"><small>Tax withheld</small><b>{money(p.wht_income + p.wht_sales)}</b><span className="muted">{[p.wht_income > 0 && `income tax ${money(p.wht_income)}`, p.wht_sales > 0 && `sales tax ${money(p.wht_sales)}`].filter(Boolean).join(" · ")}</span></div>}
          <div className="stat"><small>Applied</small><b>{money(p.amount + p.wht_income + p.wht_sales - p.unused)}</b></div>
          <div className="stat"><small>Unused (advance)</small><b className={p.unused > 0 ? "pos" : ""}>{money(p.unused)}</b></div>
        </div>
        <section className="card flush">
          <h3 className="pad">Applied to</h3>
          {p.allocations.length === 0 ? <p className="muted pad">Not applied yet. The whole amount is an advance.</p> : (
            <table className="table"><thead><tr><th>Document</th><th>Applied on</th><th className="r">Document total</th><th className="r">Applied</th><th /></tr></thead>
              <tbody>{p.allocations.map((a) => (
                <tr key={a.id}><td><Link to={`/${KIND[a.kind].path}/${a.document_id}`}>{a.number}</Link></td><td>{fmtDate(a.date)}</td><td className="r">{money(a.total)}</td><td className="r">{money(a.amount)}</td>
                  <td className="r"><button className="btn sm ghost danger" onClick={() => act(() => api(`/allocations/${a.id}`, { method: "DELETE" }), "Unapplied. Amount is back as advance.")}>Unapply</button></td></tr>
              ))}</tbody></table>
          )}
        </section>
        {p.unused > 0 && (
          <section className="card form">
            {docs === null ? (
              <div className="row-between"><div><h3>{money(p.unused)} not applied yet</h3><p className="muted">Apply it to {p.direction === "in" ? "invoices" : "bills"} of {p.contact_name}.</p></div>
                <button className="btn primary" onClick={() => api(`/contacts/${p.contact_id}/open-documents`).then(setDocs)}>Apply to {p.direction === "in" ? "invoices" : "bills"}</button></div>
            ) : (
              <>
                <AllocationTable docs={docs} values={values} setValues={setValues} max={p.unused} />
                <div className="form-actions"><button className="btn ghost" onClick={() => { setDocs(null); setValues({}); }}>Cancel</button>
                  <button className="btn primary" onClick={() => act(() => api(`/payments/${id}/allocate`, { method: "POST", body: { allocations: Object.entries(values).filter(([, v]) => Number(v) > 0).map(([document_id, amount]) => ({ document_id: Number(document_id), amount: Number(amount) })) } }), "Applied")}>Apply</button></div>
              </>
            )}
          </section>
        )}
        {p.refunds.length > 0 && (
          <section className="card flush"><h3 className="pad">Refunds</h3>
            <table className="table"><tbody>{p.refunds.map((r) => <tr key={r.id}><td><b>{r.number}</b></td><td>{fmtDate(r.date)}</td><td>{r.account_name || r.mode}</td><td className="muted">{r.reference}</td><td className="r">{money(r.amount)}</td>
              <td className="r"><button className="btn sm ghost danger" onClick={() => confirm(`Delete refund ${r.number}?`) && act(() => api(`/refunds/${r.id}`, { method: "DELETE" }), "Refund deleted")}>Delete</button></td></tr>)}</tbody></table>
          </section>
        )}
        {p.notes && <p className="muted">Notes: {p.notes}</p>}
        <Attachments entity="payment" id={p.id} labels={["Payment proof", "Bank screenshot", "Cheque copy"]} />
        <Comments entity="payment" id={p.id} />
        <Activity entity="payment" id={p.id} />
        {refunding && <RefundModal source={{ payment_id: p.id }} number={p.number} unused={p.unused} onClose={() => setRefunding(false)} onSaved={() => { setRefunding(false); toast("Refund recorded"); state.reload(); }} />}
      </>
    )}</Loading>
  );
}

// on an invoice/bill: use the contact's advances and credit notes to clear it
export function ApplyCreditsModal({ doc, onClose, onSaved }) {
  const [values, setValues] = useState({});
  const [err, setErr] = useState("");
  const key = (c) => `${c.source}-${c.id}`;
  const total = useMemo(() => r2(Object.values(values).reduce((a, v) => a + (Number(v) || 0), 0)), [values]);
  const autofill = () => {
    let left = doc.balance; const next = {};
    for (const c of doc.credits) { const take = r2(Math.min(left, c.unused)); if (take > 0) next[key(c)] = take; left = r2(left - take); }
    setValues(next);
  };
  const save = async () => {
    const credits = doc.credits.filter((c) => Number(values[key(c)]) > 0).map((c) => ({ [c.source === "payment" ? "payment_id" : "credit_id"]: c.id, amount: Number(values[key(c)]) }));
    try { await api(`/documents/${doc.id}/apply-credits`, { method: "POST", body: { credits } }); onSaved(); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={`Apply credits · ${doc.number}`} onClose={onClose}>
      <div className="form">
        <div className="row-between"><p className="muted">Balance due <b>{money(doc.balance)}</b> · available <b>{money(doc.credits.reduce((a, c) => a + c.unused, 0))}</b></p><button className="btn sm" onClick={autofill}>Auto-apply</button></div>
        <table className="table compact">
          <thead><tr><th>Credit</th><th>Date</th><th>Reference</th><th className="r">Unused</th><th className="r" style={{ width: 140 }}>Apply</th></tr></thead>
          <tbody>{doc.credits.map((c) => (
            <tr key={key(c)}><td><b>{c.number}</b><div className="muted small">{c.label}</div></td><td>{fmtDate(c.date)}</td><td className="muted">{c.reference || c.mode || ""}</td><td className="r">{money(c.unused)}</td>
              <td className="r"><input type="number" step="0.01" min="0" max={c.unused} value={values[key(c)] ?? ""} onChange={(e) => setValues({ ...values, [key(c)]: e.target.value })} /></td></tr>
          ))}</tbody>
          <tfoot><tr><td colSpan={4}>Applying</td><td className={`r ${total > doc.balance + 0.001 ? "neg" : ""}`}>{money(total)}</td></tr></tfoot>
        </table>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!total || total > doc.balance + 0.001} onClick={save}>Apply {money(total)}</button></div>
      </div>
    </Modal>
  );
}
