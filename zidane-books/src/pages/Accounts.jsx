// Chart of Accounts, one account's ledger, and manual entries (journal entries and money transfers).
import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, Field, fmtDate, Loading, Modal, money, PageHead, today, useAuth, useLoad, useToast } from "../lib.jsx";
import AccountSelect, { forgetAccounts } from "../components/AccountSelect.jsx";

const TYPE_LABEL = { asset: "Assets", liability: "Liabilities", equity: "Equity", income: "Income", expense: "Expenses" };
const KIND_LABEL = { cash: "Cash", bank: "Bank", wallet: "Wallet" };
const SOURCE = {
  invoice: ["Invoice", (id) => `/invoices/${id}`], credit_note: ["Credit note", (id) => `/credit-notes/${id}`], bill: ["Supplier bill", (id) => `/bills/${id}`],
  vendor_credit: ["Vendor credit", (id) => `/vendor-credits/${id}`], payment: ["Payment", (id) => `/payments/${id}`], refund: ["Refund", null], expense: ["Expense", () => "/expenses"],
  journal: ["Journal", (id) => `/journals?open=${id}`], transfer: ["Transfer", (id) => `/journals?open=${id}`], opening: ["Opening balance", null],
};

function AccountForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial || { type: "asset", kind: "bank", name: "", code: "", bank_name: "", account_number: "", opening_balance: "", opening_date: today(), notes: "" });
  const [err, setErr] = useState("");
  const locked = Boolean(initial?.system_key || initial?.expense_category);
  const b = (k) => ({ value: f[k] ?? "", onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  const save = async (e) => {
    e.preventDefault();
    try {
      initial ? await api(`/accounts/${initial.id}`, { method: "PUT", body: f }) : await api("/accounts", { method: "POST", body: f });
      forgetAccounts();
      onSaved();
    } catch (x) { setErr(x.message); }
  };
  const money_ = f.type === "asset" && ["cash", "bank", "wallet"].includes(f.kind);
  return (
    <Modal title={initial ? `Edit ${initial.name}` : "New account"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="row-2">
          <Field label="Type"><select {...b("type")} disabled={locked}>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l.replace(/s$/, "").replace("Liabilitie", "Liability")}</option>)}</select></Field>
          {f.type === "asset" ? (
            <Field label="Kind"><select {...b("kind")} disabled={Boolean(initial?.system_key)}><option value="bank">Bank account</option><option value="cash">Cash</option><option value="wallet">Wallet (JazzCash, Easypaisa…)</option><option value="other">Other asset</option></select></Field>
          ) : <div />}
        </div>
        <div className="row-2"><Field label="Name *"><input {...b("name")} required autoFocus placeholder={money_ ? "Meezan Bank – current account" : ""} /></Field><Field label="Code" hint={initial ? null : "Leave empty for the next free code"}><input {...b("code")} /></Field></div>
        {money_ && f.kind !== "cash" && <div className="row-2"><Field label="Bank / wallet"><input {...b("bank_name")} /></Field><Field label="Account number / IBAN"><input {...b("account_number")} /></Field></div>}
        {["asset", "liability", "equity"].includes(f.type) && (
          <div className="row-2">
            <Field label="Opening balance (Rs)" hint="What it held on the opening date (e.g. the bank statement balance)"><input type="number" step="0.01" {...b("opening_balance")} /></Field>
            <Field label="Opening date"><input type="date" {...b("opening_date")} /></Field>
          </div>
        )}
        <Field label="Notes"><input {...b("notes")} /></Field>
        {initial && !initial.system_key && <label className="check"><input type="checkbox" checked={f.active !== 0 && f.active !== false} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active (untick to close the account)</label>}
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

export function TransferModal({ onClose, onSaved }) {
  const [t, setT] = useState({ from_account_id: "", to_account_id: "", amount: "", date: today(), memo: "" });
  const [err, setErr] = useState("");
  return (
    <Modal title="Move money between accounts" onClose={onClose}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); try { await api("/transfers", { method: "POST", body: t }); onSaved(); } catch (x) { setErr(x.message); } }}>
        <p className="muted">For example cash deposited in the bank, or bank to JazzCash.</p>
        <div className="row-2">
          <Field label="From *"><AccountSelect value={t.from_account_id} mode="cash" onChange={(v) => setT((x) => ({ ...x, from_account_id: v }))} /></Field>
          <Field label="To *"><AccountSelect value={t.to_account_id} mode="bank" onChange={(v) => setT((x) => ({ ...x, to_account_id: v }))} /></Field>
        </div>
        <div className="row-2"><Field label="Amount (Rs) *"><input type="number" step="0.01" min="0" value={t.amount} onChange={(e) => setT({ ...t, amount: e.target.value })} required /></Field><Field label="Date"><input type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} /></Field></div>
        <Field label="Note"><input value={t.memo} onChange={(e) => setT({ ...t, memo: e.target.value })} placeholder="Deposit slip #…" /></Field>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save transfer</button></div>
      </form>
    </Modal>
  );
}

function JournalForm({ accounts, onClose, onSaved }) {
  const blank = () => ({ account_id: "", debit: "", credit: "", memo: "" });
  const [j, setJ] = useState({ date: today(), memo: "", lines: [blank(), blank()] });
  const [err, setErr] = useState("");
  const dr = j.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0), cr = j.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const set = (i, k, v) => setJ((x) => ({ ...x, lines: x.lines.map((l, n) => (n === i ? { ...l, [k]: v, ...(k === "debit" && v ? { credit: "" } : k === "credit" && v ? { debit: "" } : {}) } : l)) }));
  const open = accounts.filter((a) => a.active);
  return (
    <Modal title="Journal entry" onClose={onClose} wide>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); try { await api("/journals", { method: "POST", body: j }); onSaved(); } catch (x) { setErr(x.message); } }}>
        <p className="muted">For things that aren't a sale, purchase, payment or expense: owner's capital, loans, depreciation, corrections. Debits must equal credits.</p>
        <div className="row-2"><Field label="Date"><input type="date" value={j.date} onChange={(e) => setJ({ ...j, date: e.target.value })} /></Field><Field label="What is it for? *"><input value={j.memo} onChange={(e) => setJ({ ...j, memo: e.target.value })} required placeholder="Owner put in capital" /></Field></div>
        <table className="table compact">
          <thead><tr><th>Account</th><th>Note</th><th className="r">Debit</th><th className="r">Credit</th><th /></tr></thead>
          <tbody>{j.lines.map((l, i) => (
            <tr key={i}>
              <td><select value={l.account_id} onChange={(e) => set(i, "account_id", e.target.value)} required>
                <option value="">Choose…</option>
                {Object.entries(TYPE_LABEL).map(([t, lbl]) => <optgroup key={t} label={lbl}>{open.filter((a) => a.type === t).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</optgroup>)}
              </select></td>
              <td><input value={l.memo} onChange={(e) => set(i, "memo", e.target.value)} /></td>
              <td className="r"><input type="number" step="0.01" min="0" value={l.debit} onChange={(e) => set(i, "debit", e.target.value)} style={{ width: 120 }} /></td>
              <td className="r"><input type="number" step="0.01" min="0" value={l.credit} onChange={(e) => set(i, "credit", e.target.value)} style={{ width: 120 }} /></td>
              <td>{j.lines.length > 2 && <button type="button" className="icon-btn" onClick={() => setJ({ ...j, lines: j.lines.filter((_, n) => n !== i) })}>✕</button>}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td><button type="button" className="btn sm" onClick={() => setJ({ ...j, lines: [...j.lines, blank()] })}>+ Line</button></td><td className={Math.abs(dr - cr) > 0.005 ? "neg" : "pos"}>{Math.abs(dr - cr) > 0.005 ? `Difference ${money(Math.abs(dr - cr))}` : "Balanced"}</td><td className="r">{money(dr)}</td><td className="r">{money(cr)}</td><td /></tr></tfoot>
        </table>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!dr || Math.abs(dr - cr) > 0.005}>Save entry</button></div>
      </form>
    </Modal>
  );
}

export default function Accounts() {
  const state = useLoad("/accounts");
  const [editing, setEditing] = useState(null);
  const [transfer, setTransfer] = useState(false);
  const [journal, setJournal] = useState(false);
  const toast = useToast();
  const nav = useNavigate();
  const done = (msg) => { setEditing(null); setTransfer(false); setJournal(false); state.reload(); toast(msg); };
  return (
    <>
      <PageHead title="Chart of Accounts" sub="Every account with its balance today. Click an account to see its ledger.">
        <button className="btn" onClick={() => setTransfer(true)}>⇄ Move money</button>
        <button className="btn" onClick={() => setJournal(true)}>Journal entry</button>
        <button className="btn primary" onClick={() => setEditing({})}>+ New account</button>
      </PageHead>
      <Loading state={state}>{(list) => (
        <>
          <div className="stats">{list.filter((a) => a.active && ["cash", "bank", "wallet"].includes(a.kind)).map((a) => (
            <Link key={a.id} className="stat link" to={`/accounts/${a.id}`}><small>{KIND_LABEL[a.kind]} · {a.name}</small><b className={a.balance < 0 ? "neg" : ""}>{money(a.balance)}</b></Link>
          ))}</div>
          {list.some((a) => a.system_key === "bank" && (a.debit || a.credit)) && (
            <p className="muted small">Payments and expenses recorded before accounts existed sit in <b>Bank (not specified)</b> (or Cash in hand when paid in cash). Add your real bank accounts, then move that balance with "Move money", or rename the account to your main bank.</p>
          )}
          {Object.entries(TYPE_LABEL).map(([t, label]) => {
            const rows = list.filter((a) => a.type === t && (a.active || a.balance));
            return (
              <React.Fragment key={t}>
                <h3>{label}</h3>
                <div className="card flush"><table className="table">
                  <thead><tr><th style={{ width: 90 }}>Code</th><th>Account</th><th className="r">Balance</th><th /></tr></thead>
                  <tbody>{rows.map((a) => (
                    <tr key={a.id} className="click" onClick={() => nav(`/accounts/${a.id}`)}>
                      <td className="muted">{a.code}</td>
                      <td><b>{a.name}</b>{a.kind !== "other" && <span className="badge grey" style={{ marginLeft: 8 }}>{KIND_LABEL[a.kind]}</span>}{!a.active && <span className="badge grey" style={{ marginLeft: 8 }}>closed</span>}
                        {(a.bank_name || a.account_number) && <div className="muted small">{[a.bank_name, a.account_number].filter(Boolean).join(" · ")}</div>}</td>
                      <td className={`r ${a.balance < 0 ? "neg" : ""}`}>{a.debit || a.credit ? money(a.balance) : "—"}</td>
                      <td className="r"><button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); setEditing(a); }}>Edit</button></td>
                    </tr>
                  ))}</tbody>
                  <tfoot><tr><td /><td>Total {label.toLowerCase()}</td><td className="r">{money(rows.reduce((s, a) => s + a.balance, 0))}</td><td /></tr></tfoot>
                </table></div>
              </React.Fragment>
            );
          })}
          {editing && <AccountForm initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => done("Account saved")} />}
          {transfer && <TransferModal onClose={() => setTransfer(false)} onSaved={() => done("Transfer saved")} />}
          {journal && <JournalForm accounts={list} onClose={() => setJournal(false)} onSaved={() => done("Journal entry saved")} />}
        </>
      )}</Loading>
    </>
  );
}

export function AccountLedger() {
  const { id } = useParams();
  const [from, setFrom] = useState(today().slice(0, 8) + "01");
  const [to, setTo] = useState(today());
  const state = useLoad(`/accounts/${id}/ledger?from=${from}&to=${to}`);
  return (
    <Loading state={state}>{(d) => (
      <>
        <PageHead title={d.account.name} sub={`${d.account.code} · ${TYPE_LABEL[d.account.type]}${d.account.account_number ? ` · ${d.account.account_number}` : ""}`}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span className="muted">to</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn" onClick={() => window.print()}>Print</button>
          <Link className="btn ghost" to="/accounts">All accounts</Link>
        </PageHead>
        <div className="stats">
          <div className="stat"><small>Opening · {fmtDate(from)}</small><b>{money(d.opening)}</b></div>
          <div className="stat"><small>In (debit)</small><b>{money(d.debit)}</b></div>
          <div className="stat"><small>Out (credit)</small><b>{money(d.credit)}</b></div>
          <div className="stat"><small>Closing · {fmtDate(to)}</small><b className={d.closing < 0 ? "neg" : ""}>{money(d.closing)}</b></div>
        </div>
        <div className="card flush"><table className="table">
          <thead><tr><th>Date</th><th>Type</th><th>Number</th><th>Customer / supplier</th><th>Note</th><th className="r">Debit</th><th className="r">Credit</th><th className="r">Balance</th></tr></thead>
          <tbody>
            <tr><td>{fmtDate(from)}</td><td colSpan={6} className="muted">Opening balance</td><td className="r">{money(d.opening)}</td></tr>
            {d.lines.map((l, i) => {
              const [label, link] = SOURCE[l.source] || [l.source, null];
              return (
                <tr key={i}>
                  <td>{fmtDate(l.date)}</td><td className="muted">{label}</td>
                  <td>{link && l.source_id ? <Link to={link(l.source_id)}>{l.ref}</Link> : l.ref}</td>
                  <td>{l.contact_id ? <Link to={`/contacts/${l.contact_id}`}>{l.contact_name}</Link> : ""}</td>
                  <td className="muted small">{l.memo}</td>
                  <td className="r">{l.debit ? money(l.debit) : ""}</td><td className="r">{l.credit ? money(l.credit) : ""}</td>
                  <td className={`r ${l.balance < 0 ? "neg" : ""}`}>{money(l.balance)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr><td colSpan={5}>Closing balance</td><td className="r">{money(d.debit)}</td><td className="r">{money(d.credit)}</td><td className="r">{money(d.closing)}</td></tr></tfoot>
        </table></div>
      </>
    )}</Loading>
  );
}

export function Journals() {
  const state = useLoad("/journals");
  const accounts = useLoad("/accounts");
  const [openId, setOpenId] = useState(() => Number(new URLSearchParams(window.location.search).get("open")) || null);
  const [mode, setMode] = useState(null);
  const toast = useToast();
  const { can } = useAuth();
  const done = (msg) => { setMode(null); state.reload(); toast(msg); };
  return (
    <>
      <PageHead title="Journal entries & transfers" sub="Manual entries in the books. Sales, purchases, payments and expenses post themselves.">
        <button className="btn" onClick={() => setMode("transfer")}>⇄ Move money</button>
        <button className="btn primary" onClick={() => setMode("journal")} disabled={!accounts.data}>+ Journal entry</button>
      </PageHead>
      <Loading state={state}>{(list) => list.length === 0 ? <div className="empty">No manual entries yet.</div> : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Date</th><th>Number</th><th>Type</th><th>Note</th><th>By</th><th className="r">Amount</th></tr></thead>
          <tbody>{list.map((j) => <tr key={j.id} className="click" onClick={() => setOpenId(j.id)}><td>{fmtDate(j.date)}</td><td><b>{j.number}</b></td><td>{j.kind === "transfer" ? "Transfer" : "Journal"}</td><td>{j.memo}</td><td className="muted">{j.created_by_name}</td><td className="r">{money(j.amount)}</td></tr>)}</tbody>
        </table></div>
      )}</Loading>
      {openId && <JournalView id={openId} canDelete={can("reports.finance")} onClose={() => setOpenId(null)} onDeleted={() => { setOpenId(null); done("Entry deleted"); }} />}
      {mode === "transfer" && <TransferModal onClose={() => setMode(null)} onSaved={() => done("Transfer saved")} />}
      {mode === "journal" && accounts.data && <JournalForm accounts={accounts.data} onClose={() => setMode(null)} onSaved={() => done("Journal entry saved")} />}
    </>
  );
}

function JournalView({ id, canDelete, onClose, onDeleted }) {
  const state = useLoad(`/journals/${id}`);
  const [err, setErr] = useState("");
  return (
    <Modal title="Entry" onClose={onClose} wide>
      <Loading state={state}>{(j) => (
        <>
          <p><b>{j.number}</b> · {fmtDate(j.date)} · {j.memo}<br /><span className="muted small">By {j.created_by_name}</span></p>
          <table className="table compact">
            <thead><tr><th>Account</th><th>Note</th><th className="r">Debit</th><th className="r">Credit</th></tr></thead>
            <tbody>{j.lines.map((l) => <tr key={l.id}><td><Link to={`/accounts/${l.account_id}`}>{l.code} · {l.account_name}</Link></td><td className="muted">{l.memo || l.contact_name}</td><td className="r">{l.debit ? money(l.debit) : ""}</td><td className="r">{l.credit ? money(l.credit) : ""}</td></tr>)}</tbody>
          </table>
          {err && <div className="form-error">{err}</div>}
          {canDelete && <div className="form-actions"><button className="btn danger" onClick={async () => { if (!window.confirm(`Delete ${j.number}?`)) return; try { await api(`/journals/${j.id}`, { method: "DELETE" }); onDeleted(); } catch (x) { setErr(x.message); } }}>Delete entry</button></div>}
        </>
      )}</Loading>
    </Modal>
  );
}
