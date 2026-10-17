import React, { useState } from "react";
import { api, Field, fmtDate, Loading, Modal, money, PageHead, today, useForm, useLoad, useToast } from "../lib.jsx";

function ExpenseForm({ initial, categories, onClose, onSaved }) {
  const [f, bind] = useForm(initial || { date: today(), category: categories[0] || "", amount: "", paid_through: "cash", reference: "", notes: "" });
  const [err, setErr] = useState("");
  const save = async (e) => {
    e.preventDefault();
    try { initial ? await api(`/expenses/${initial.id}`, { method: "PUT", body: f }) : await api("/expenses", { method: "POST", body: f }); onSaved(); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={initial ? "Edit expense" : "New expense"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="row-2"><Field label="Date"><input type="date" {...bind("date")} /></Field><Field label="Amount (Rs) *"><input type="number" step="0.01" {...bind("amount")} required autoFocus /></Field></div>
        <div className="row-2">
          <Field label="Category"><select {...bind("category")}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Paid through"><select {...bind("paid_through")}><option value="cash">Cash</option><option value="bank">Bank</option><option value="cheque">Cheque</option><option value="online">Online / wallet</option></select></Field>
        </div>
        <div className="row-2"><Field label="Reference"><input {...bind("reference")} /></Field><Field label="Notes"><input {...bind("notes")} /></Field></div>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

export default function Expenses() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const from = `${month}-01`, to = `${month}-31`;
  const state = useLoad(`/expenses?from=${from}&to=${to}`);
  const settings = useLoad("/settings");
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const cats = settings.data?.expenseCategories || ["Other"];
  return (
    <>
      <PageHead title="Expenses" sub="Rent, salaries, fuel and everything else that isn't stock.">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button className="btn primary" onClick={() => setEditing({})}>+ New Expense</button>
      </PageHead>
      <Loading state={state}>{(rows) => {
        const byCat = Object.entries(rows.reduce((a, e) => ({ ...a, [e.category]: (a[e.category] || 0) + e.amount }), {})).sort((a, b) => b[1] - a[1]);
        const total = rows.reduce((a, e) => a + e.amount, 0);
        return rows.length === 0 ? <div className="empty">No expenses this month.</div> : (
          <div className="grid-2 wide-left">
            <div className="card flush"><table className="table">
              <thead><tr><th>Date</th><th>Category</th><th>Paid through</th><th>Notes</th><th className="r">Amount</th><th /></tr></thead>
              <tbody>{rows.map((e) => (
                <tr key={e.id} className="click" onClick={() => setEditing(e)}><td>{fmtDate(e.date)}</td><td>{e.category}</td><td>{e.paid_through}</td><td className="muted">{e.notes || e.reference}</td><td className="r">{money(e.amount)}</td>
                  <td className="r"><button className="icon-btn" aria-label="Delete" onClick={async (ev) => { ev.stopPropagation(); if (confirm("Delete this expense?")) { await api(`/expenses/${e.id}`, { method: "DELETE" }); toast("Deleted"); state.reload(); } }}>×</button></td></tr>
              ))}</tbody>
              <tfoot><tr><td colSpan={4}>Total</td><td className="r">{money(total)}</td><td /></tr></tfoot>
            </table></div>
            <section className="card"><h3>By category</h3>
              {byCat.map(([c, v]) => <div key={c} className="hbar"><span>{c}</span><div><i style={{ width: `${(v / byCat[0][1]) * 100}%` }} /></div><b>{money(v)}</b></div>)}
            </section>
          </div>
        );
      }}</Loading>
      {editing && <ExpenseForm initial={editing.id ? editing : null} categories={cats} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast("Expense saved"); state.reload(); }} />}
    </>
  );
}
