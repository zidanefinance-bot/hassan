// Post-dated cheques given to suppliers: what's out, when each falls due (highlighted), and the receiving slip.
import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, Field, fmtDate, Loading, Modal, money, PageHead, today, useLoad, useToast } from "../lib.jsx";
import Picker from "../components/Picker.jsx";
import AccountSelect from "../components/AccountSelect.jsx";
import ShareButton from "../components/ShareButton.jsx";
import { contactOptions } from "./DocumentForm.jsx";

const TONE = { overdue: "red", soon: "red", week: "amber", later: "blue", cleared: "green", cancelled: "grey", bounced: "red" };
export const pdcWhen = (p) => p.status !== "issued" ? p.status
  : p.days_left < 0 ? `${-p.days_left} day${p.days_left === -1 ? "" : "s"} past its date`
  : p.days_left === 0 ? "dated TODAY" : `in ${p.days_left} day${p.days_left === 1 ? "" : "s"}`;

// give a PDC: supplier, cheque details, and (optionally) the open bills it covers
export function PdcForm({ initial, preset = {}, onClose, onSaved }) {
  const suppliers = useLoad("/contacts?type=supplier");
  const [p, setP] = useState(() => initial
    ? { contact_id: String(initial.contact_id), amount: initial.amount, cheque_no: initial.cheque_no, account_id: initial.account_id ? String(initial.account_id) : "", bank_name: initial.bank_name || "", cheque_date: initial.cheque_date, issued_date: initial.issued_date, notes: initial.notes || "", bills: Object.fromEntries(initial.bills.map((b) => [b.document_id, b.amount])) }
    : { contact_id: preset.contact_id ? String(preset.contact_id) : "", amount: preset.amount || "", cheque_no: "", account_id: "", bank_name: "", cheque_date: "", issued_date: today(), notes: "", bills: preset.bill_id ? { [preset.bill_id]: preset.amount } : {} });
  const open = useLoad(p.contact_id ? `/contacts/${p.contact_id}/open-documents` : null, [p.contact_id]);
  const [err, setErr] = useState("");
  const set = (k) => ({ value: p[k], onChange: (e) => setP({ ...p, [k]: e.target.value }) });
  const billTotal = Object.values(p.bills).reduce((s, v) => s + (Number(v) || 0), 0);
  const save = async (e) => {
    e.preventDefault();
    const body = { ...p, bills: Object.entries(p.bills).filter(([, v]) => Number(v) > 0).map(([document_id, amount]) => ({ document_id: Number(document_id), amount: Number(amount) })) };
    try { const r = initial ? await api(`/pdcs/${initial.id}`, { method: "PUT", body }) : await api("/pdcs", { method: "POST", body }); onSaved(initial ? initial.id : r.id); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={initial ? `Edit ${initial.number}` : "Give a PDC cheque"} onClose={onClose} wide>
      <form className="form" onSubmit={save}>
        <div className="row-2">
          <Field label="Supplier *"><Picker options={contactOptions(suppliers.data)} value={p.contact_id} onChange={(v) => setP({ ...p, contact_id: String(v || ""), bills: {} })} placeholder="Type supplier name…" /></Field>
          <Field label="Amount (Rs) *"><input type="number" step="0.01" min="0" {...set("amount")} required /></Field>
        </div>
        <div className="row-3">
          <Field label="Cheque number *"><input {...set("cheque_no")} required placeholder="e.g. 00451234" /></Field>
          <Field label="Cheque date (due) *" hint="The date written on the cheque"><input type="date" {...set("cheque_date")} required /></Field>
          <Field label="Given on"><input type="date" {...set("issued_date")} /></Field>
        </div>
        <div className="row-2">
          <Field label="Drawn on (our bank account) *"><AccountSelect value={p.account_id} mode="bank" onChange={(v) => setP((x) => ({ ...x, account_id: v }))} /></Field>
          <Field label="Bank name on the cheque" hint="Empty = the account's bank"><input {...set("bank_name")} placeholder="e.g. Faysal Bank" /></Field>
        </div>
        {p.contact_id && (
          <div>
            <h4>Against which bills? <span className="muted small">(optional; when the cheque clears, it pays these)</span></h4>
            <Loading state={open}>{(docs) => docs.length === 0 ? <p className="muted small">No open bills for this supplier.</p> : (
              <table className="table compact">
                <thead><tr><th>Bill</th><th>Date</th><th className="r">Balance</th><th className="r">This cheque</th></tr></thead>
                <tbody>{docs.map((d) => (
                  <tr key={d.id}><td>{d.number}</td><td>{fmtDate(d.date)}</td><td className="r">{money(d.balance)}</td>
                    <td className="r"><input type="number" step="0.01" min="0" style={{ width: 130 }} value={p.bills[d.id] ?? ""} placeholder="0"
                      onChange={(e) => setP({ ...p, bills: { ...p.bills, [d.id]: e.target.value } })} />
                      {!(Number(p.bills[d.id]) > 0) && <button type="button" className="link-btn small" onClick={() => setP({ ...p, bills: { ...p.bills, [d.id]: d.balance } })}> full</button>}</td></tr>
                ))}</tbody>
                <tfoot><tr><td colSpan={3}>Bills covered</td><td className={`r ${billTotal > (Number(p.amount) || 0) + 0.001 ? "neg" : ""}`}>{money(billTotal)}</td></tr></tfoot>
              </table>
            )}</Loading>
          </div>
        )}
        <Field label="Notes"><input {...set("notes")} /></Field>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">{initial ? "Save" : "Save PDC"}</button></div>
      </form>
    </Modal>
  );
}

function PdcView({ id, onClose, onChanged }) {
  const state = useLoad(`/pdcs/${id}`, [id]);
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [closing, setClosing] = useState(null);
  const [note, setNote] = useState("");
  const act = async (fn, msg) => { try { await fn(); toast(msg); state.reload(); onChanged(); } catch (x) { toast(x.message, "err"); } };
  return (
    <Modal title="PDC cheque" onClose={onClose} wide>
      <Loading state={state}>{(p) => (
        <div className="form">
          <div className={`pdc-hero ${TONE[p.urgency]}`}>
            <div><small>Cheque</small><b>{p.cheque_no}</b></div>
            <div><small>Amount</small><b>{money(p.amount)}</b></div>
            <div><small>Cheque date</small><b>{fmtDate(p.cheque_date)}</b><span>{pdcWhen(p)}</span></div>
          </div>
          <dl className="kv">
            <dt>Number</dt><dd>{p.number}</dd>
            <dt>Supplier</dt><dd><Link to={`/contacts/${p.contact_id}`}>{p.contact_name}</Link></dd>
            <dt>Bank</dt><dd>{p.bank_name || "—"}{p.account_name ? ` · from ${p.account_name}` : ""}</dd>
            <dt>Given on</dt><dd>{fmtDate(p.issued_date)}</dd>
            {p.bills.length > 0 && <><dt>Bills</dt><dd>{p.bills.map((b) => <div key={b.document_id}><Link to={`/bills/${b.document_id}`}>{b.number}</Link>{b.reference ? ` (their # ${b.reference})` : ""} · {money(b.amount)}</div>)}</dd></>}
            {p.payment_number && <><dt>Cleared as</dt><dd><Link to={`/payments/${p.payment_id}`}>{p.payment_number}</Link></dd></>}
            {p.notes && <><dt>Notes</dt><dd>{p.notes}</dd></>}
          </dl>
          <div className="form-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <a className="btn" href={`/api/pdcs/${p.id}/receiving.pdf`} target="_blank" rel="noreferrer">⬇ Receiving slip (PDF)</a>
            <ShareButton url={`/api/pdcs/${p.id}/receiving.pdf`} title={`Cheque receiving ${p.number}`} text={`Cheque ${p.cheque_no} · ${p.contact_name}`} label="Share slip" />
            {p.status === "issued" && <>
              <button className="btn primary" onClick={() => confirm(`Cheque ${p.cheque_no} cleared from the bank? This records the payment of ${money(p.amount)}${p.bills.length ? " against its bills" : ""}.`) && act(() => api(`/pdcs/${p.id}/clear`, { method: "POST", body: {} }), "Cleared: payment recorded")}>Mark cleared (paid)</button>
              <button className="btn ghost" onClick={() => setEdit(true)}>Edit</button>
              <button className="btn ghost danger" onClick={() => setClosing("bounced")}>Bounced</button>
              <button className="btn ghost danger" onClick={() => setClosing("cancelled")}>Cancel / taken back</button>
            </>}
          </div>
          {closing && (
            <div className="inline-form">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={closing === "bounced" ? "Why? e.g. insufficient funds" : "Why? e.g. paid in cash instead"} autoFocus />
              <button className="btn sm danger" onClick={() => act(() => api(`/pdcs/${p.id}/close`, { method: "POST", body: { status: closing, note } }), closing === "bounced" ? "Marked bounced" : "Cancelled").then(() => setClosing(null))}>{closing === "bounced" ? "Mark bounced" : "Cancel cheque"}</button>
              <button className="btn sm ghost" onClick={() => setClosing(null)}>✕</button>
            </div>
          )}
          {edit && <PdcForm initial={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); toast("Saved"); state.reload(); onChanged(); }} />}
        </div>
      )}</Loading>
    </Modal>
  );
}

const VIEWS = [["open", "With supplier"], ["cleared", "Cleared"], ["bounced", "Bounced"], ["cancelled", "Cancelled"], ["", "All"]];
export default function Pdcs() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState("open");
  const state = useLoad(`/pdcs?status=${view}`, [view]);
  const [adding, setAdding] = useState(false);
  const openId = params.get("open");
  const toast = useToast();
  const rows = state.data || [];
  const dueWeek = rows.filter((p) => p.status === "issued" && p.days_left <= 7);
  return (
    <>
      <PageHead title="PDC cheques" sub="Post-dated cheques given to suppliers. Not paid until the cheque date: reminders start 7 days before, every other day.">
        <button className="btn primary" onClick={() => setAdding(true)}>+ Give a PDC</button>
      </PageHead>
      {view === "open" && dueWeek.length > 0 && (
        <div className="pdc-alert">⚠ <b>{dueWeek.length} cheque{dueWeek.length > 1 ? "s" : ""} due within 7 days: {money(dueWeek.reduce((s, p) => s + p.amount, 0))}</b> must be in the bank.</div>
      )}
      <div className="chips">{VIEWS.map(([k, n]) => <button key={k} className={`chip ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{n}</button>)}</div>
      <Loading state={state}>{(list) => list.length === 0 ? <div className="empty">No cheques here.</div> : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Cheque date</th><th>When</th><th>Cheque #</th><th>Supplier</th><th>Bank</th><th>Bills</th><th className="r">Amount</th></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id} className={`click pdc-row ${p.status === "issued" ? p.urgency : ""}`} onClick={() => setParams({ open: p.id })}>
              <td className="nowrap"><b>{fmtDate(p.cheque_date)}</b></td>
              <td><span className={`badge ${TONE[p.urgency]}`}>{pdcWhen(p)}</span></td>
              <td><b>{p.cheque_no}</b><div className="muted small">{p.number}</div></td>
              <td>{p.contact_name}</td>
              <td className="small">{p.bank_name || p.account_name || "—"}</td>
              <td className="small">{p.bills.map((b) => b.number).join(", ") || "—"}</td>
              <td className="r"><b>{money(p.amount)}</b></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}</Loading>
      {adding && <PdcForm onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); toast("PDC saved. Download the receiving slip for the supplier to sign."); state.reload(); setParams({ open: id }); }} />}
      {openId && <PdcView id={openId} onClose={() => setParams({})} onChanged={() => state.reload()} />}
    </>
  );
}
