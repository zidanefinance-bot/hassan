import React, { useEffect, useState } from "react";
import { api, Field, Loading, Modal, PageHead, useAuth, useLoad, useToast } from "../lib.jsx";

const ROLE_INFO = {
  director: "Everything: approvals, profit, all departments, users and settings",
  sales: "Customers, enquiries, quotes, Jobs, customer DCs and invoices. Can't see purchase costs, supplier bills or margins",
  operations: "Jobs to fulfil, procurement, suppliers, purchases, supplier bills, freight and direct costs. Can't see selling rates or customer invoices",
  purchaser: "What to buy today, mark bought / from stock, record purchases. No customer rates, no money",
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

export function Password() {
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

// remove every record (Jobs, quotes, invoices, bills, payments, stock, inbox …) to begin real entries
function StartFresh() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ confirm: "", keepContacts: false, keepItems: false });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const run = async () => {
    setBusy(true);
    try {
      await api("/admin/start-fresh", { method: "POST", body: f });
      toast("All records removed. A backup was saved on the server first.");
      setTimeout(() => window.location.assign("/"), 1200);
    } catch (x) { toast(x.message, "err"); setBusy(false); }
  };
  return (
    <section className="card danger-zone">
      <h3>Start fresh</h3>
      <p className="muted">Delete all test entries and begin real ones: Jobs, enquiries, quotes, POs, DCs, invoices, bills, credit notes, payments, expenses, stock, orders inbox, comments and notifications. Numbers start again from 1.
        Users, logins and these settings stay. A full copy of the database is saved on the server first.</p>
      {!open ? <button className="btn danger" onClick={() => setOpen(true)}>Start fresh…</button> : (
        <div className="form">
          <label className="check"><input type="checkbox" checked={f.keepContacts} onChange={(e) => setF({ ...f, keepContacts: e.target.checked })} /> Keep customers & suppliers</label>
          <label className="check"><input type="checkbox" checked={f.keepItems} onChange={(e) => setF({ ...f, keepItems: e.target.checked })} /> Keep items (stock goes to 0)</label>
          <Field label="Type DELETE to confirm"><input value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} placeholder="DELETE" /></Field>
          <div className="form-actions"><button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" disabled={busy || f.confirm !== "DELETE"} onClick={run}>{busy ? "Deleting…" : `Delete everything${f.keepContacts || f.keepItems ? " else" : ""}`}</button></div>
        </div>
      )}
    </section>
  );
}

export default function Settings() {
  const state = useLoad("/settings");
  const [s, setS] = useState(null);
  const toast = useToast();
  useEffect(() => { if (state.data) setS(state.data); }, [state.data]);
  const save = async () => {
    try { await api("/settings", { method: "PUT", body: { ...s, expenseCategories: s.expenseCategories.map((x) => x.trim()).filter(Boolean), jobExpenseCategories: (s.jobExpenseCategories || []).map((x) => x.trim()).filter(Boolean), itemCategories: (s.itemCategories || []).map((x) => x.trim()).filter(Boolean) } }); toast("Settings saved"); state.reload(); } catch (x) { toast(x.message, "err"); }
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
            <h3>Orders inbox</h3>
            <label className="check"><input type="checkbox" checked={s.autoJobFromPo !== false} onChange={(e) => setS({ ...s, autoJobFromPo: e.target.checked })} /> Make the Job by itself when a PO is certain</label>
            <p className="muted small">Certain = a customer we have, a PO number, and every item already one of ours (e.g. Texmark's second PO onwards). Sales and Operations are told. Anything new or unclear waits in the Orders Inbox. The same PO sent again never makes a second Job.</p>
          </section>
          <section className="card form">
            <h3>Item categories</h3>
            <Field label="One per line. Every item must be in one; the Items page opens by category" hint="Renaming one here doesn't move its items: open them and pick the new name"><textarea rows={9} value={(s.itemCategories || []).join("\n")} onChange={(e) => setS({ ...s, itemCategories: e.target.value.split("\n") })} /></Field>
          </section>
          <section className="card form">
            <h3>Expense categories</h3>
            <Field label="Company expenses (Accounts), one per line"><textarea rows={8} value={s.expenseCategories.join("\n")} onChange={(e) => setS({ ...s, expenseCategories: e.target.value.split("\n") })} /></Field>
            <Field label="Job direct costs (Operations), one per line"><textarea rows={6} value={(s.jobExpenseCategories || []).join("\n")} onChange={(e) => setS({ ...s, jobExpenseCategories: e.target.value.split("\n") })} /></Field>
          </section>
          <section className="card form">
            <h3>Targets & alerts (dashboard)</h3>
            <div className="row-2">
              <Field label="Monthly sales target (Rs, excl. tax)" hint="0 = don't show"><input type="number" min={0} value={s.salesTargetMonthly ?? 0} onChange={(e) => setS({ ...s, salesTargetMonthly: Number(e.target.value) })} /></Field>
              <Field label="Warn when a Job's margin is below (%)"><input type="number" step="0.5" value={s.lowMarginPct ?? 8} onChange={(e) => setS({ ...s, lowMarginPct: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Chase an unsigned delivery challan after (days)"><input type="number" min={1} value={s.dcSignDays ?? 3} onChange={(e) => setS({ ...s, dcSignDays: Number(e.target.value) })} /></Field>
            <h4>Monthly expense budget</h4>
            <p className="muted small">Leave 0 for no budget. The dashboard turns amber at 80% and red when it goes over.</p>
            <div className="budget-grid">
              {s.expenseCategories.filter((c) => c.trim()).map((c) => (
                <Field key={c} label={c}><input type="number" min={0} value={(s.expenseBudgets || {})[c] ?? 0} onChange={(e) => setS({ ...s, expenseBudgets: { ...(s.expenseBudgets || {}), [c]: Number(e.target.value) } })} /></Field>
              ))}
            </div>
          </section>
          <Users />
          <Password />
          <section className="card">
            <h3>Backup</h3>
            <p className="muted">Download a full copy of all your data (one file). Keep it somewhere safe, for example Google Drive, at least once a week.</p>
            <a className="btn" href="/api/admin/backup">Download backup</a>
          </section>
          <StartFresh />
        </div>
      )}
    </>
  );
}
