import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, Badge, Field, fmtDate, KIND, Loading, Modal, money, PageHead, Search, useForm, useLoad, useToast } from "../lib.jsx";

export function ContactForm({ type, initial, onClose, onSaved }) {
  const [f, bind] = useForm(initial || { type, name: "", company: "", phone: "", email: "", address: "", ntn: "", notes: "" });
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
  const title = type === "customer" ? "Customers" : "Suppliers";
  return (
    <>
      <PageHead title={title} sub={type === "customer" ? "Companies, factories and NGOs you sell to." : "Who you buy stock from."}>
        <Search value={q} onChange={setQ} placeholder={`Search ${title.toLowerCase()}…`} />
        <button className="btn primary" onClick={() => setAdding(true)}>+ New</button>
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

export function ContactView() {
  const { id } = useParams();
  const state = useLoad(`/contacts/${id}`);
  const [editing, setEditing] = useState(false);
  const nav = useNavigate();
  const toast = useToast();
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
            <Link className="btn primary" to={`/${isCust ? "invoices" : "bills"}/new?contact=${c.id}`}>+ New {isCust ? "Invoice" : "Bill"}</Link>
            <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn ghost danger" onClick={() => del(c)}>Delete</button>
          </PageHead>
          <div className="grid-2">
            <section className="card">
              <dl className="kv">
                <dt>Phone</dt><dd>{c.phone || "—"}{c.phone && <a className="wa" href={`https://wa.me/${c.phone.replace(/\D/g, "").replace(/^0/, "92")}`} target="_blank" rel="noreferrer">WhatsApp</a>}</dd>
                <dt>Email</dt><dd>{c.email || "—"}</dd><dt>Address</dt><dd>{c.address || "—"}</dd><dt>NTN</dt><dd>{c.ntn || "—"}</dd><dt>Notes</dt><dd>{c.notes || "—"}</dd>
              </dl>
            </section>
            <section className="card stat big"><small>{isCust ? "They owe you" : "You owe them"}</small><b className={outstanding > 0 ? "neg" : ""}>{money(outstanding)}</b></section>
          </div>
          <section className="card flush">
            <h3 className="pad">Transactions</h3>
            {c.documents.length === 0 ? <p className="muted pad">No transactions yet.</p> : (
              <table className="table"><thead><tr><th>Date</th><th>Type</th><th>Number</th><th>Status</th><th className="r">Total</th><th className="r">Balance</th></tr></thead>
                <tbody>{c.documents.map((d) => (
                  <tr key={d.id} className="click" onClick={() => nav(`/${KIND[d.kind].path}/${d.id}`)}>
                    <td>{fmtDate(d.date)}</td><td>{KIND[d.kind].label}</td><td>{d.number}</td><td><Badge status={d.display_status} /></td><td className="r">{money(d.total)}</td>
                    <td className="r">{["invoice", "bill"].includes(d.kind) && d.status === "open" ? money(d.total - d.paid) : ""}</td>
                  </tr>
                ))}</tbody></table>
            )}
          </section>
          {editing && <ContactForm type={c.type} initial={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); state.reload(); }} />}
        </>
      );
    }}</Loading>
  );
}
