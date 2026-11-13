// Bank loans: the schedule (principal + interest per installment), what's left, the next installment highlighted,
// and "Paid" in one click (posts the entry: loan down, interest as an expense, bank out).
import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, Field, fmtDate, Loading, Modal, money, PageHead, today, useLoad, useToast } from "../lib.jsx";
import AccountSelect from "../components/AccountSelect.jsx";

const TONE = { overdue: "red", soon: "red", week: "amber", later: "blue" };
const when = (i) => i.days_left < 0 ? `${-i.days_left} day${i.days_left === -1 ? "" : "s"} past due` : i.days_left === 0 ? "due TODAY" : `in ${i.days_left} day${i.days_left === 1 ? "" : "s"}`;
const firstOfNextMonth = (d) => { if (!d) return ""; const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); };

function LoanForm({ onClose, onSaved }) {
  const [f, setF] = useState({ lender: "", reference: "", title: "", principal: "", rate: "", start_date: today(), first_due: "", months: "", installment: "", bank_account_id: "", record_receipt: true, received: "", schedule_text: "", notes: "" });
  const [paste, setPaste] = useState(false);
  const [prev, setPrev] = useState(null);
  const [err, setErr] = useState("");
  const set = (k) => ({ value: f[k], onChange: (e) => { setF({ ...f, [k]: e.target.value }); setPrev(null); } });
  const body = () => ({ ...f, first_due: f.first_due || firstOfNextMonth(f.start_date), schedule_text: paste ? f.schedule_text : "" });
  const preview = async () => { setErr(""); try { setPrev(await api("/loans/preview", { method: "POST", body: body() })); } catch (x) { setErr(x.message); } };
  const save = async (e) => { e.preventDefault(); setErr(""); try { const r = await api("/loans", { method: "POST", body: body() }); onSaved(r.id); } catch (x) { setErr(x.message); } };
  const fee = f.record_receipt && f.received !== "" && Number(f.principal) > Number(f.received) ? Number(f.principal) - Number(f.received) : 0;
  return (
    <Modal title="New bank loan" onClose={onClose} wide>
      <form className="form" onSubmit={save}>
        <div className="row-3">
          <Field label="Bank / lender *"><input {...set("lender")} required placeholder="e.g. Faysal Bank" /></Field>
          <Field label="Loan reference"><input {...set("reference")} placeholder="e.g. PR3-1261031000001" /></Field>
          <Field label="Loan name"><input {...set("title")} placeholder="e.g. Asaan Finance Term Loan" /></Field>
        </div>
        <div className="row-3">
          <Field label="Loan amount (Rs) *"><input type="number" step="0.01" min="0" {...set("principal")} required /></Field>
          <Field label="Interest rate % a year *"><input type="number" step="0.0001" min="0" {...set("rate")} required placeholder="e.g. 19.05" /></Field>
          <Field label="Loan start date *"><input type="date" {...set("start_date")} required /></Field>
        </div>
        <div className="chips">
          <button type="button" className={`chip ${!paste ? "on" : ""}`} onClick={() => { setPaste(false); setPrev(null); }}>Work out the schedule</button>
          <button type="button" className={`chip ${paste ? "on" : ""}`} onClick={() => { setPaste(true); setPrev(null); }}>Paste the bank's schedule</button>
        </div>
        {!paste ? (
          <div className="row-3">
            <Field label="Monthly installment (Rs)" hint="From the bank's letter ('Constant'). Empty = worked out"><input type="number" step="0.01" min="0" {...set("installment")} /></Field>
            <Field label="Number of installments *"><input type="number" min="1" {...set("months")} required={!paste} placeholder="e.g. 36" /></Field>
            <Field label="First installment date" hint="Empty = 1st of next month"><input type="date" {...set("first_due")} /></Field>
          </div>
        ) : (
          <Field label="Bank's schedule *" hint="Copy the lines from the bank's schedule: date, balance, interest, principal (one installment per line). Heading lines are skipped.">
            <textarea rows={8} {...set("schedule_text")} placeholder={"01NOV2026  4,821,974.92  2,609.59  178,025.08\n01DEC2026  4,716,840.49  75,500.24  105,134.43\n…"} style={{ fontFamily: "monospace" }} />
          </Field>
        )}
        <div className="row-3">
          <Field label="Bank account (money came in, installments go out) *"><AccountSelect value={f.bank_account_id} mode="bank" onChange={(v) => setF((x) => ({ ...x, bank_account_id: v }))} /></Field>
          <Field label=" "><label className="check"><input type="checkbox" checked={f.record_receipt} onChange={(e) => setF({ ...f, record_receipt: e.target.checked })} /> Record the loan money received in this bank</label></Field>
          {f.record_receipt && <Field label="Money actually received (Rs)" hint={fee ? `Rs ${fee.toLocaleString("en-PK")} kept by the bank → Bank charges` : "Empty = the full loan amount"}><input type="number" step="0.01" min="0" {...set("received")} placeholder={f.principal || ""} /></Field>}
        </div>
        {!f.record_receipt && <p className="muted small">Untick only if you already entered the loan money in the books yourself (e.g. a journal entry).</p>}
        <Field label="Notes"><input {...set("notes")} /></Field>
        <div><button type="button" className="btn" onClick={preview}>Show the schedule</button></div>
        {prev && (
          <div className="card flush" style={{ maxHeight: 320, overflow: "auto" }}>
            <p className="pad small">Installment <b>{money(prev.installment)}</b> · {prev.rows.length} installments · total interest <b>{money(prev.total_interest)}</b></p>
            <table className="table compact">
              <thead><tr><th>#</th><th>Due</th><th className="r">Interest</th><th className="r">Principal</th><th className="r">Installment</th></tr></thead>
              <tbody>{prev.rows.map((r) => <tr key={r.seq}><td>{r.seq}</td><td>{fmtDate(r.due_date)}</td><td className="r">{money(r.interest)}</td><td className="r">{money(r.principal)}</td><td className="r">{money(r.interest + r.principal)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save loan</button></div>
      </form>
    </Modal>
  );
}

function PayModal({ loan, inst, onClose, onDone }) {
  const [f, setF] = useState({ date: inst.due_date <= today() ? inst.due_date : today(), account_id: loan.bank_account_id ? String(loan.bank_account_id) : "", interest: inst.interest, principal: inst.principal });
  const [err, setErr] = useState("");
  const total = (Number(f.interest) || 0) + (Number(f.principal) || 0);
  const save = async (e) => { e.preventDefault(); try { await api(`/loans/${loan.id}/installments/${inst.id}/pay`, { method: "POST", body: f }); onDone(); } catch (x) { setErr(x.message); } };
  const set = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  return (
    <Modal title={`Installment ${inst.seq} paid · ${loan.lender}`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="row-2">
          <Field label="Paid on"><input type="date" {...set("date")} required /></Field>
          <Field label="From bank account"><AccountSelect value={f.account_id} mode="bank" onChange={(v) => setF((x) => ({ ...x, account_id: v }))} /></Field>
        </div>
        <div className="row-2">
          <Field label="Principal (loan goes down)"><input type="number" step="0.01" min="0" {...set("principal")} /></Field>
          <Field label="Interest (expense)"><input type="number" step="0.01" min="0" {...set("interest")} /></Field>
        </div>
        <p>Total out of the bank: <b>{money(total)}</b>{Math.abs(total - inst.amount) > 0.005 && <span className="muted small"> (schedule says {money(inst.amount)})</span>}</p>
        <p className="muted small">Change the amounts only if the bank's statement shows different figures.</p>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Mark paid</button></div>
      </form>
    </Modal>
  );
}

function EditRow({ loan, inst, onClose, onDone }) {
  const [f, setF] = useState({ due_date: inst.due_date, interest: inst.interest, principal: inst.principal });
  const [err, setErr] = useState("");
  const set = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  const save = async (e) => { e.preventDefault(); try { await api(`/loans/${loan.id}/installments/${inst.id}`, { method: "PUT", body: f }); onDone(); } catch (x) { setErr(x.message); } };
  return (
    <Modal title={`Correct installment ${inst.seq}`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="row-3">
          <Field label="Due date"><input type="date" {...set("due_date")} /></Field>
          <Field label="Interest"><input type="number" step="0.01" min="0" {...set("interest")} /></Field>
          <Field label="Principal"><input type="number" step="0.01" min="0" {...set("principal")} /></Field>
        </div>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

function LoanView({ id, onClose, onChanged }) {
  const state = useLoad(`/loans/${id}`, [id]);
  const toast = useToast();
  const [pay, setPay] = useState(null);
  const [edit, setEdit] = useState(null);
  const done = (msg) => { setPay(null); setEdit(null); toast(msg); state.reload(); onChanged(); };
  const act = async (fn, msg) => { try { await fn(); done(msg); } catch (x) { toast(x.message, "err"); } };
  return (
    <Modal title="Bank loan" onClose={onClose} wide>
      <Loading state={state}>{(l) => (
        <div className="form">
          <div className={`pdc-hero ${l.next ? TONE[l.next.urgency] : "green"}`}>
            <div><small>Still owed (principal)</small><b>{money(l.outstanding)}</b><span style={{ color: "var(--muted)", fontWeight: 400 }}>of {money(l.principal)}</span></div>
            <div><small>Next installment</small>{l.next ? <><b>{money(l.next.amount)}</b><span>{fmtDate(l.next.due_date)} · {when(l.next)}</span></> : <b>All paid ✓</b>}</div>
            <div><small>Installments</small><b>{l.paid_count} paid · {l.left_count} left</b><span style={{ color: "var(--muted)", fontWeight: 400 }}>interest paid {money(l.interest_paid)} · to come {money(l.interest_left)}</span></div>
          </div>
          <dl className="kv">
            <dt>Loan</dt><dd><b>{l.number}</b> · {l.lender}{l.title ? ` · ${l.title}` : ""}{l.reference ? ` · ref ${l.reference}` : ""}</dd>
            <dt>Terms</dt><dd>{money(l.principal)} at {l.rate}% a year · from {fmtDate(l.start_date)} · {l.months} × {money(l.installment)} · total interest {money(l.total_interest)}</dd>
            <dt>Bank account</dt><dd>{l.bank_account_name || "—"}{l.received != null ? ` · received ${money(l.received)}${l.disburse_journal_number ? ` (${l.disburse_journal_number})` : ""}` : " · money received not recorded here"}</dd>
            <dt>In the books</dt><dd><Link to={`/accounts/${l.loan_account_id}`}>{l.loan_account_code} {l.loan_account_name}</Link>: {money(l.ledger_balance)}
              {Math.abs(l.ledger_balance - l.outstanding) > 0.5 && <span className="neg small"> (doesn't match what's owed {money(l.outstanding)}: check entries made by hand on this account)</span>}</dd>
            {l.notes && <><dt>Notes</dt><dd>{l.notes}</dd></>}
          </dl>
          <div className="card flush" style={{ maxHeight: 460, overflow: "auto" }}>
            <table className="table compact loan-sched">
              <thead><tr><th>#</th><th>Due</th><th className="r">Interest</th><th className="r">Principal</th><th className="r">Installment</th><th className="r">Owed after</th><th>Status</th><th /></tr></thead>
              <tbody>{l.installments.map((i) => {
                const isNext = l.next && l.next.id === i.id;
                return (
                  <tr key={i.id} className={i.paid_on ? "muted" : isNext ? `pdc-row ${i.urgency}` : ""}>
                    <td>{i.seq}</td><td className="nowrap">{fmtDate(i.due_date)}</td>
                    <td className="r">{money(i.paid_on ? i.paid_interest : i.interest)}</td><td className="r">{money(i.paid_on ? i.paid_principal : i.principal)}</td>
                    <td className="r"><b>{money(i.amount)}</b></td><td className="r">{money(i.balance_after)}</td>
                    <td>{i.paid_on ? <span className="badge green">Paid {fmtDate(i.paid_on)}</span> : i.days_left <= 7 ? <span className={`badge ${TONE[i.urgency]}`}>{when(i)}</span> : <span className="muted small">to pay</span>}</td>
                    <td className="nowrap r">
                      {isNext && <button className="btn sm primary" onClick={() => setPay(i)}>Paid</button>}
                      {!i.paid_on && <button className="btn sm ghost" title="Correct to the bank's figures" onClick={() => setEdit(i)}>✎</button>}
                      {i.paid_on && i.seq === l.paid_count && <button className="btn sm ghost" onClick={() => confirm(`Undo installment ${i.seq}? Its entry (${i.journal_number}) is removed.`) && act(() => api(`/loans/${l.id}/installments/${i.id}/undo`, { method: "POST" }), "Payment undone")}>Undo</button>}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          {l.paid_count === 0 && <div className="form-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn ghost danger" onClick={() => confirm(`Delete loan ${l.number}? The loan-received entry goes too.`) && act(() => api(`/loans/${l.id}`, { method: "DELETE" }).then(onClose), "Loan deleted")}>Delete loan</button>
          </div>}
          {pay && <PayModal loan={l} inst={pay} onClose={() => setPay(null)} onDone={() => done("Installment paid: entry posted")} />}
          {edit && <EditRow loan={l} inst={edit} onClose={() => setEdit(null)} onDone={() => done("Installment corrected")} />}
        </div>
      )}</Loading>
    </Modal>
  );
}

export default function Loans() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState("active");
  const state = useLoad(`/loans?status=${view}`, [view]);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const openId = params.get("open");
  const rows = state.data || [];
  const due = rows.filter((l) => l.next && l.next.days_left <= 7);
  return (
    <>
      <PageHead title="Bank loans" sub="Each installment split into principal (loan goes down) and interest (expense). Reminders 7, 3, 1 days before and on the day.">
        <button className="btn primary" onClick={() => setAdding(true)}>+ New loan</button>
      </PageHead>
      {due.length > 0 && <div className="pdc-alert">⚠ <b>{due.length} installment{due.length > 1 ? "s" : ""} due within 7 days: {money(due.reduce((s, l) => s + l.next.amount, 0))}</b> must be in the bank.</div>}
      <div className="chips">{[["active", "Running"], ["closed", "Paid off"], ["", "All"]].map(([k, n]) => <button key={k} className={`chip ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{n}</button>)}</div>
      <Loading state={state}>{(list) => list.length === 0 ? <div className="empty">No loans here.</div> : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Loan</th><th>Bank</th><th className="r">Amount</th><th className="r">Still owed</th><th>Next installment</th><th className="r">Due</th><th>Left</th></tr></thead>
          <tbody>{list.map((l) => (
            <tr key={l.id} className={`click ${l.next && l.next.days_left <= 7 ? `pdc-row ${l.next.urgency}` : ""}`} onClick={() => setParams({ open: l.id })}>
              <td><b>{l.number}</b><div className="muted small">{l.title || l.reference || ""}</div></td>
              <td>{l.lender}</td>
              <td className="r">{money(l.principal)}</td>
              <td className="r"><b>{money(l.outstanding)}</b></td>
              <td>{l.next ? <>{fmtDate(l.next.due_date)} {l.next.days_left <= 7 && <span className={`badge ${TONE[l.next.urgency]}`}>{when(l.next)}</span>}</> : <span className="badge green">paid off</span>}</td>
              <td className="r">{l.next ? money(l.next.amount) : "—"}</td>
              <td>{l.left_count} of {l.months}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}</Loading>
      {adding && <LoanForm onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); toast("Loan saved"); state.reload(); setParams({ open: id }); }} />}
      {openId && <LoanView id={openId} onClose={() => setParams({})} onChanged={() => state.reload()} />}
    </>
  );
}
