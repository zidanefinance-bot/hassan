import React, { useEffect, useState } from "react";
import { api, Field, Loading, Modal, PageHead, useAuth, useLoad, useToast } from "../lib.jsx";

const ROLE_INFO = {
  director: "Everything: approvals, profit, all departments, users and settings",
  sales: "Customers, enquiries, quotes, Jobs, customer DCs and invoices. Can't see purchase costs, supplier bills or margins",
  operations: "Jobs to fulfil, procurement, suppliers, purchases, supplier bills, freight and direct costs. Can't see selling rates or customer invoices",
  purchaser: "What to buy today, mark bought / not available, record purchases. No customer rates, no money",
  accounts: "Verify invoices and bills, receive payments, pay suppliers, expenses and financial reports. Doesn't re-enter Sales or Operations data",
};
const ROLE_LABEL = { director: "Director", sales: "Sales", operations: "Operations", purchaser: "Field Purchaser", accounts: "Accounts" };

function Users() {
  const state = useLoad("/users");
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const toast = useToast();
  const save = async (e) => {
    e.preventDefault();
    try {
      form.id ? await api(`/users/${form.id}`, { method: "PUT", body: form }) : await api("/users", { method: "POST", body: form });
      toast(form.id ? "User updated" : "User added"); setForm(null); state.reload();
    } catch (x) { toast(x.message, "err"); }
  };
  return (
    <section className="card">
      <div className="card-head"><h3>Team</h3><button className="btn sm primary" onClick={() => setForm({ name: "", email: "", role: "sales", password: "" })}>+ Add user</button></div>
      <Loading state={state}>{(rows) => (
        <table className="table compact"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{ROLE_LABEL[u.role]}</td><td>{u.active ? "Active" : <span className="muted">Disabled</span>}</td>
            <td className="r"><button className="btn sm ghost" onClick={() => setForm({ ...u, active: !!u.active, password: "" })}>Edit</button></td></tr>)}</tbody></table>
      )}</Loading>
      <dl className="kv small">{Object.entries(ROLE_INFO).map(([r, t]) => <React.Fragment key={r}><dt>{ROLE_LABEL[r]}</dt><dd className="muted">{t}</dd></React.Fragment>)}</dl>
      {form && (
        <Modal title={form.id ? `Edit ${form.name}` : "Add user"} onClose={() => setForm(null)}>
          <form className="form" onSubmit={save}>
            <div className="row-2"><Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
              <Field label="Email"><input type="email" value={form.email} disabled={!!form.id} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field></div>
            <div className="row-2"><Field label="Role"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{Object.keys(ROLE_INFO).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
              <Field label={form.id ? "New password (optional)" : "Password"} hint="At least 8 characters"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!form.id} /></Field></div>
            {form.id && form.id !== user.id && <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active (can sign in)</label>}
            <div className="form-actions"><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn primary">Save</button></div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function Password() {
  const [p, setP] = useState({ current: "", next: "" });
  const toast = useToast();
  return (
    <section className="card">
      <h3>Change my password</h3>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); try { await api("/auth/password", { method: "POST", body: p }); toast("Password changed"); setP({ current: "", next: "" }); } catch (x) { toast(x.message, "err"); } }}>
        <div className="row-2"><Field label="Current password"><input type="password" value={p.current} onChange={(e) => setP({ ...p, current: e.target.value })} required /></Field>
          <Field label="New password"><input type="password" value={p.next} onChange={(e) => setP({ ...p, next: e.target.value })} required minLength={8} /></Field></div>
        <div className="form-actions"><button className="btn">Change password</button></div>
      </form>
    </section>
  );
}

export default function Settings() {
  const state = useLoad("/settings");
  const [s, setS] = useState(null);
  const toast = useToast();
  useEffect(() => { if (state.data) setS(state.data); }, [state.data]);
  const save = async () => {
    try { await api("/settings", { method: "PUT", body: { ...s, expenseCategories: s.expenseCategories.map((x) => x.trim()).filter(Boolean), jobExpenseCategories: (s.jobExpenseCategories || []).map((x) => x.trim()).filter(Boolean) } }); toast("Settings saved"); state.reload(); } catch (x) { toast(x.message, "err"); }
  };
  const co = (k) => ({ value: s.company[k] || "", onChange: (e) => setS({ ...s, company: { ...s.company, [k]: e.target.value } }) });
  return (
    <>
      <PageHead title="Settings"><button className="btn primary" onClick={save} disabled={!s}>Save settings</button></PageHead>
      {!s ? <div className="empty">Loading…</div> : (
        <div className="grid-2">
          <section className="card form">
            <h3>Company (shown on invoices)</h3>
            <Field label="Business name"><input {...co("name")} /></Field>
            <Field label="Address"><textarea rows={2} {...co("address")} /></Field>
            <div className="row-2"><Field label="Phone"><input {...co("phone")} /></Field><Field label="Email"><input {...co("email")} /></Field></div>
            <div className="row-3"><Field label="Website"><input {...co("website")} /></Field><Field label="NTN"><input {...co("ntn")} /></Field><Field label="STRN"><input {...co("strn")} /></Field></div>
            <Field label="Invoice footer"><input value={s.invoiceFooter || ""} onChange={(e) => setS({ ...s, invoiceFooter: e.target.value })} /></Field>
          </section>
          <section className="card form">
            <h3>Numbering & terms</h3>
            {["job", "quote", "dc", "invoice", "credit_note", "po", "bill", "vendor_credit", "receipt", "payment", "refund"].map((k) => (
              <div className="row-2" key={k}>
                <Field label={`${{ job: "Job", quote: "Quote", dc: "Delivery challan", invoice: "Invoice", credit_note: "Credit note", po: "Purchase order", bill: "Supplier bill", vendor_credit: "Vendor credit", receipt: "Customer receipt", payment: "Supplier payment", refund: "Refund" }[k]} prefix`}><input value={s.prefixes[k] ?? ""} onChange={(e) => setS({ ...s, prefixes: { ...s.prefixes, [k]: e.target.value } })} /></Field>
                <Field label="Next number"><input type="number" min={1} value={s.nextNumbers[k] ?? 1} onChange={(e) => setS({ ...s, nextNumbers: { ...s.nextNumbers, [k]: Number(e.target.value) } })} /></Field>
              </div>
            ))}
            <Field label="Default payment terms (days)"><input type="number" min={0} value={s.paymentTermsDays} onChange={(e) => setS({ ...s, paymentTermsDays: Number(e.target.value) })} /></Field>
          </section>
          <section className="card form">
            <h3>Tax rates</h3>
            {s.taxes.map((t, i) => (
              <div className="row-3" key={i}>
                <Field label="Name"><input value={t.name} onChange={(e) => setS({ ...s, taxes: s.taxes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></Field>
                <Field label="Rate %"><input type="number" step="0.01" value={t.rate} onChange={(e) => setS({ ...s, taxes: s.taxes.map((x, j) => (j === i ? { ...x, rate: Number(e.target.value) } : x)) })} /></Field>
                <button className="btn ghost danger sm self-end" onClick={() => setS({ ...s, taxes: s.taxes.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <button className="btn ghost sm" onClick={() => setS({ ...s, taxes: [...s.taxes, { name: "New tax", rate: 0 }] })}>+ Add tax rate</button>
          </section>
          <section className="card form">
            <h3>Expense categories</h3>
            <Field label="Company expenses (Accounts), one per line"><textarea rows={8} value={s.expenseCategories.join("\n")} onChange={(e) => setS({ ...s, expenseCategories: e.target.value.split("\n") })} /></Field>
            <Field label="Job direct costs (Operations), one per line"><textarea rows={6} value={(s.jobExpenseCategories || []).join("\n")} onChange={(e) => setS({ ...s, jobExpenseCategories: e.target.value.split("\n") })} /></Field>
          </section>
          <Users />
          <Password />
          <section className="card">
            <h3>Backup</h3>
            <p className="muted">Download a full copy of all your data (one file). Keep it somewhere safe, for example Google Drive, at least once a week.</p>
            <a className="btn" href="/api/admin/backup">Download backup</a>
          </section>
        </div>
      )}
    </>
  );
}
