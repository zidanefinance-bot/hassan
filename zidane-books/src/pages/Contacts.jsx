import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Comments from "../components/Comments.jsx";
import { api, Badge, Field, fmtDate, KIND, Loading, Modal, money, PageHead, Search, useAuth, useForm, useLoad, useToast } from "../lib.jsx";

export function ContactForm({ type, initial, onClose, onSaved }) {
  const [f, bind] = useForm(initial ? { ...initial, payment_terms_days: initial.payment_terms_days ?? "", credit_limit: initial.credit_limit ?? "" } : { type, name: "", company: "", phone: "", email: "", address: "", ntn: "", notes: "", opening_balance: "", payment_terms_days: "", credit_limit: "" });
  const [err, setErr] = useState("");
  const toast = useToast();
  const save = async (e) => {
    e.preventDefault();
    try {
      const r = initial ? await api(`/contacts/${initial.id}`, { method: "PUT", body: f }) : await api("/contacts", { method: "POST", body: f });
      toast(initial ? "Saved" : `${type === "customer" ? "Customer" : "Supplier"} added`);
      onSaved(r.id || initial.id);
    } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={initial ? `Edit ${initial.name}` : `New ${type}`} onClose={onClose}>
      <form onSubmit={save} className="form">
        <div className="row-2"><Field label="Name *"><input {...bind("name")} required autoFocus /></Field><Field label="Contact person / dept"><input {...bind("company")} /></Field></div>
        <div className="row-2"><Field label="Phone / WhatsApp"><input {...bind("phone")} placeholder="03xx xxxxxxx" /></Field><Field label="Email"><input type="email" {...bind("email")} /></Field></div>
        <Field label="Address"><textarea rows={2} {...bind("address")} /></Field>
        <div className="row-2"><Field label="NTN / STRN"><input {...bind("ntn")} /></Field><Field label="Notes"><input {...bind("notes")} /></Field></div>
        <div className="row-3">
          <Field label="Payment terms (days)" hint="Due date on new invoices/bills. Empty = company default"><input type="number" min="0" {...bind("payment_terms_days")} /></Field>
          {type === "customer" && <Field label="Credit limit (Rs)" hint="Above this, only a director can issue invoices"><input type="number" min="0" step="0.01" {...bind("credit_limit")} /></Field>}
          <Field label="Opening balance (Rs)" hint={type === "customer" ? "What they owed when you started" : "What you owed when you started"}><input type="number" step="0.01" {...bind("opening_balance")} /></Field>
        </div>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

export default function Contacts({ type }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const state = useLoad(`/contacts?type=${type}&q=${encodeURIComponent(q)}`);
  const nav = useNavigate();
  const { can } = useAuth();
  const canWrite = can(type === "customer" ? "sales.write" : "ops.write");
  const title = type === "customer" ? "Customers" : "Suppliers";
  return (
    <>
      <PageHead title={title} sub={type === "customer" ? "Companies, factories and NGOs you sell to." : "Who you buy stock from."}>
        <Search value={q} onChange={setQ} placeholder={`Search ${title.toLowerCase()}…`} />
        {canWrite && <button className="btn primary" onClick={() => setAdding(true)}>+ New</button>}
      </PageHead>
      <Loading state={state}>{(rows) => rows.length === 0 ? <div className="empty">No {title.toLowerCase()} yet. Add your first one.</div> : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th className="r">{type === "customer" ? "Receivable" : "Payable"}</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id} className="click" onClick={() => nav(`/contacts/${c.id}`)}>
              <td><b>{c.name}</b></td><td className="muted">{c.company}</td><td>{c.phone}</td><td className={`r ${c.outstanding > 0 ? "neg" : ""}`}>{money(c.outstanding)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}</Loading>
      {adding && <ContactForm type={type} onClose={() => setAdding(false)} onSaved={(id) => nav(`/contacts/${id}`)} />}
    </>
  );
}

// Statement of account: everything charged and paid, with a running balance, for any date range
function Statement({ contactId, isCust }) {
  const [range, setRange] = useState({ from: "", to: "" });
  const state = useLoad(`/contacts/${contactId}/statement?from=${range.from}&to=${range.to}`);
  return (
    <section className="card">
      <div className="stmt-head">
        <div><h3>Statement of account</h3><p className="muted small">{isCust ? "Positive balance = customer owes us. Negative = customer has advance with us." : "Positive balance = we owe the supplier. Negative = our advance with them."}</p></div>
        <div className="actions">
          <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="From" /><span className="muted">to</span>
          <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="To" />
          <button className="btn" onClick={() => window.print()}>Print / PDF</button>
        </div>
      </div>
      <Loading state={state}>{(st) => (
        <>
          <div className="stmt-sum">
            <div className="stat"><small>Opening</small><b>{money(st.opening)}</b></div>
            <div className="stat"><small>{isCust ? "Invoiced" : "Billed"}</small><b>{money(st.charges)}</b></div>
            <div className="stat"><small>{isCust ? "Received" : "Paid"}</small><b>{money(st.payments)}</b></div>
            <div className="stat"><small>Closing balance</small><b className={st.closing > 0 ? "neg" : st.closing < 0 ? "pos" : ""}>{money(st.closing)}</b><span className="muted">{st.closing < 0 ? "advance" : st.closing > 0 ? (isCust ? "receivable" : "payable") : "settled"}</span></div>
          </div>
          <div className="tablewrap"><table className="table compact">
            <thead><tr><th>Date</th><th>Transaction</th><th>Details</th><th className="r">{isCust ? "Invoice" : "Bill"}</th><th className="r">{isCust ? "Payment" : "Paid"}</th><th className="r">Balance</th></tr></thead>
            <tbody>
              <tr><td>{st.from && st.from !== "0000-01-01" ? fmtDate(st.from) : ""}</td><td colSpan={4}><i>Opening balance</i></td><td className="r">{money(st.opening)}</td></tr>
              {st.rows.map((r, i) => (
                <tr key={i}><td>{fmtDate(r.date)}</td><td>{r.type === "payment" || (r.type === "refund" && r.source === "payment") ? <Link to={`/payments/${r.id}`}>{r.number}</Link> : r.type === "refund" ? r.number : <Link to={`/${KIND[r.type].path}/${r.id}`}>{r.number}</Link>}</td><td className="muted">{r.details}</td>
                  <td className="r">{r.charge ? money(r.charge) : ""}</td><td className="r">{r.payment ? money(r.payment) : ""}</td><td className="r"><b>{money(r.balance)}</b></td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}>Closing balance</td><td className="r">{money(st.charges)}</td><td className="r">{money(st.payments)}</td><td className="r">{money(st.closing)}</td></tr></tfoot>
          </table></div>
        </>
      )}</Loading>
    </section>
  );
}

export function ContactView() {
  const { id } = useParams();
  const state = useLoad(`/contacts/${id}`);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("transactions");
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const del = async (c) => {
    if (!confirm(`Delete ${c.name}?`)) return;
    try { await api(`/contacts/${c.id}`, { method: "DELETE" }); toast("Deleted"); nav(c.type === "customer" ? "/customers" : "/suppliers"); } catch (x) { toast(x.message, "err"); }
  };
  return (
    <Loading state={state}>{(c) => {
      const isCust = c.type === "customer";
      const outstanding = c.documents.filter((d) => ["invoice", "bill"].includes(d.kind) && d.status === "open").reduce((a, d) => a + d.total - d.paid, 0);
      return (
        <>
          <PageHead title={c.name} sub={`${isCust ? "Customer" : "Supplier"}${c.company ? " · " + c.company : ""}`}>
            {isCust && can("sales.write") && <Link className="btn primary" to={`/quotes/new?enquiry=1&contact=${c.id}`}>+ Enquiry</Link>}
            {isCust && can("sales.write") && <Link className="btn" to={`/jobs/new?customer=${c.id}`}>+ Job</Link>}
            {!isCust && can("buy") && <Link className="btn primary" to={`/bills/new?contact=${c.id}`}>+ Supplier bill</Link>}
            {can("money") && <Link className="btn primary" to={`/payments/new?direction=${isCust ? "in" : "out"}&contact=${c.id}`}>{isCust ? "Receive payment / advance" : "Pay supplier / advance"}</Link>}
            {can(isCust ? "sales.write" : "ops.write") && <button className="btn" onClick={() => setEditing(true)}>Edit</button>}
            {can(isCust ? "sales.write" : "ops.write") && <button className="btn ghost danger" onClick={() => del(c)}>Delete</button>}
          </PageHead>
          <div className="grid-2">
            <section className="card">
              <dl className="kv">
                <dt>Phone</dt><dd>{c.phone || "—"}{c.phone && <a className="wa" href={`https://wa.me/${c.phone.replace(/\D/g, "").replace(/^0/, "92")}`} target="_blank" rel="noreferrer">WhatsApp</a>}</dd>
                <dt>Email</dt><dd>{c.email || "—"}</dd><dt>Address</dt><dd>{c.address || "—"}</dd><dt>NTN</dt><dd>{c.ntn || "—"}</dd><dt>Notes</dt><dd>{c.notes || "—"}</dd>
              </dl>
            </section>
            <section className="card stat big"><small>{isCust ? "They owe you" : "You owe them"}</small><b className={outstanding > 0 ? "neg" : ""}>{money(outstanding)}</b>
              {c.credits > 0 && <span className="pos">{isCust ? "Customer advance (unused):" : "Our advance with them (unused):"} <b>{money(c.credits)}</b></span>}
              {c.credits > 0 && outstanding > 0 && <span className="muted small">Open an {isCust ? "invoice" : "bill"} and use "Apply credits" to adjust it.</span>}
              {c.credit && <span className={c.credit.over ? "neg small" : "muted small"}>Credit limit {money(c.credit.limit)} · used {money(c.credit.owed)}</span>}
              {(c.payment_terms_days ?? null) !== null && <span className="muted small">Terms: {c.payment_terms_days} days</span>}</section>
          </div>
          <div className="tabs">{[["transactions", "Transactions"], ["statement", "Statement / ledger"], ...(c.payments.length ? [["payments", `Payments (${c.payments.length})`]] : [])].map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
          {tab === "statement" && <Statement contactId={c.id} isCust={isCust} />}
          {tab === "payments" && (
            <section className="card flush"><table className="table">
              <thead><tr><th>Date</th><th>Number</th><th>Mode</th><th>Reference</th><th className="r">Amount</th><th className="r">Unused</th></tr></thead>
              <tbody>{c.payments.map((p) => <tr key={p.id} className={can("money") ? "click" : ""} onClick={() => can("money") && nav(`/payments/${p.id}`)}><td>{fmtDate(p.date)}</td><td><b>{p.number}</b></td><td>{p.mode}</td><td className="muted">{p.reference}</td><td className="r">{money(p.amount)}</td><td className={`r ${p.unused > 0 ? "pos" : "muted"}`}>{p.unused > 0 ? money(p.unused) : "—"}</td></tr>)}</tbody>
            </table></section>
          )}
          {tab === "transactions" && c.jobs.length > 0 && (
            <section className="card flush"><h3 className="pad">Jobs</h3>
              <table className="table"><tbody>{c.jobs.map((j) => <tr key={j.id} className="click" onClick={() => nav(`/jobs/${j.id}`)}><td><b>{j.number}</b></td><td><Badge status={j.ops_status} /></td><td>{fmtDate(j.required_date)}</td><td className="muted">{j.closed ? "closed" : ""}</td></tr>)}</tbody></table>
            </section>
          )}
          {tab === "transactions" && <section className="card flush">
            <h3 className="pad">Documents</h3>
            {c.documents.length === 0 ? <p className="muted pad">No transactions yet.</p> : (
              <table className="table"><thead><tr><th>Date</th><th>Type</th><th>Number</th><th>Status</th><th className="r">Total</th><th className="r">Balance</th></tr></thead>
                <tbody>{c.documents.map((d) => (
                  <tr key={d.id} className="click" onClick={() => nav(`/${KIND[d.kind].path}/${d.id}`)}>
                    <td>{fmtDate(d.date)}</td><td>{KIND[d.kind].label}</td><td>{d.number}</td><td><Badge status={d.display_status} /></td><td className="r">{d.kind === "dc" ? "" : money(d.total)}</td>
                    <td className="r">{["invoice", "bill"].includes(d.kind) && d.status === "open" ? money(d.total - d.paid) : ""}</td>
                  </tr>
                ))}</tbody></table>
            )}
          </section>}
          <Comments entity="contact" id={c.id} />
          {editing && <ContactForm type={c.type} initial={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); state.reload(); }} />}
        </>
      );
    }}</Loading>
  );
}
