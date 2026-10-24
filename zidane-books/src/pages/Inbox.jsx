// Orders inbox: customer POs and supplier bills that came by email (or were pasted / uploaded), read by AI.
// Each draft is checked by a person and turned into a quote, Job or supplier bill with one click.
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, Field, Loading, Modal, money, num, PageHead, useAuth, useLoad, useToast } from "../lib.jsx";
import { unitOf } from "../components/draftLines.js";

export const readFiles = (files) => Promise.all(files.map((f) => {
  if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is bigger than 10 MB`);
  return new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok({ filename: f.name, mime: f.type || "application/octet-stream", data: String(r.result).split(",")[1] }); r.onerror = bad; r.readAsDataURL(f); });
}));

const TYPE = { customer_order: ["Customer order", "blue"], supplier_bill: ["Supplier bill", "amber"], other: ["Not an order", "grey"] };
const STATUS = { new: "waiting", reading: "AI reading…", ready: "ready to check", done: "done", ignored: "ignored", error: "couldn't read" };
const TONE = { new: "grey", reading: "amber", ready: "red", done: "green", ignored: "grey", error: "red" };
const when = (at) => new Date(at.replace(" ", "T") + "Z").toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const RESULT = { quote: "quotes", job: "jobs", bill: "bills" };

function SetupNote({ st, isAdmin }) {
  if (!st || (st.ai && st.email_in)) return null;
  return (
    <div className="ai-banner warn">
      {!st.ai && <p><b>PDF orders are read automatically, free.</b> POs and bills made by a computer system (like Texmark's) are read without AI. Photos, scans and typed messages need AI reading, which is off. {isAdmin ? "Add ANTHROPIC_API_KEY on the server to turn it on (see SETUP-AI-EMAIL.md)." : ""}</p>}
      {!st.email_in && <p><b>Email inbox not connected.</b> Paste messages or upload photos below for now. {isAdmin ? "Add the IMAP settings on the server to read the orders mailbox automatically." : ""}</p>}
    </div>
  );
}

function AddMessage({ onClose, onAdded }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await api("/inbox", { method: "POST", body: { text, files: await readFiles(files) } }); onAdded(r.id); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <Modal title="Add an order or bill" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Paste the message (WhatsApp, email, SMS…)" hint="Urdu, Roman Urdu or English. e.g. “500 bag atta 10kg aur 200 kg cheeni bhej dein, Friday tak”">
          <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </Field>
        <Field label="…or attach photos / PDF of the PO or bill">
          <input type="file" multiple accept="image/*,application/pdf,.txt,.csv" onChange={(e) => setFiles([...e.target.files])} />
        </Field>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || (!text.trim() && !files.length)}>{busy ? "Sending…" : "Read it"}</button></div>
      </form>
    </Modal>
  );
}

function Detail({ id, onChanged }) {
  const state = useLoad(`/inbox/${id}`);
  const { can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const m = state.data;
  // keep checking while AI is reading
  useEffect(() => {
    if (!m || !["new", "reading"].includes(m.status)) return;
    const t = setTimeout(() => { state.reload(); onChanged(); }, 3000);
    return () => clearTimeout(t);
  }, [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn, msg) => { try { await fn(); if (msg) toast(msg); state.reload(); onChanged(); } catch (x) { toast(x.message, "err"); } };
  if (!m) return <Loading state={state}>{() => null}</Loading>;
  const x = m.extraction;
  const order = x?.doc_type === "customer_order", bill = x?.doc_type === "supplier_bill";
  const total = x?.lines?.reduce((a, l) => a + (l.rate != null ? l.qty * l.rate : 0), 0) || 0;
  return (
    <section className="card inbox-detail">
      <div className="row-between">
        <div><h3>{m.subject || (m.source === "email" ? "(no subject)" : m.source === "paste" ? "Pasted message" : "Uploaded file")}</h3>
          <p className="muted small">{m.from_addr || "Added in the app"} · {when(m.received_at)}</p></div>
        <span className={`badge ${TONE[m.status]}`}>{STATUS[m.status]}</span>
      </div>

      {m.status === "reading" || m.status === "new" ? <p className="ai-reading">Reading… {m.status === "new" && "(waiting in line)"}</p> : null}
      {m.status === "error" && <div className="form-error">Couldn't read it: {m.error}</div>}

      {x && (
        <div className="ai-result">
          <div className="row-between"><b>{x.reader === "pdf-text" ? "📄" : x.reader === "email-text" ? "✉" : "✨"} {x.summary}</b>{x.request === "rfq" ? <span className="badge amber">RFQ · to quote</span> : x.doc_type && <span className={`badge ${TYPE[x.doc_type][1]}`}>{TYPE[x.doc_type][0]}</span>}</div>
          <dl className="kv small">
            <dt>{bill ? "Supplier" : "Customer"}</dt><dd>{x.party_name || "—"} {x.party_match_id ? <span className="badge green sm">= {x.party_match_name}</span> : x.party_name ? <span className="badge amber sm">new / not matched</span> : null}</dd>
            {x.reference && <><dt>{bill ? "Bill #" : "PO #"}</dt><dd>{x.reference}</dd></>}
            {x.date && <><dt>Date</dt><dd>{x.date}</dd></>}
            {x.required_date && <><dt>{bill ? "Due" : "Needed by"}</dt><dd>{x.required_date}</dd></>}
            {x.delivery_location && <><dt>Deliver to</dt><dd>{x.delivery_location}</dd></>}
            {x.party_address && <><dt>Address</dt><dd>{x.party_address}</dd></>}
            {x.buyer_name && <><dt>{bill ? "Contact" : "Buyer"}</dt><dd>{[x.buyer_name, x.contact_phone].filter(Boolean).join(" · ")}</dd></>}
            {x.payment_terms && <><dt>Payment terms</dt><dd>{x.payment_terms}
              {x.party_match_id && x.payment_terms_days != null && x.party_terms_days !== x.payment_terms_days && <span className="badge amber sm">{x.party_match_name} is set to {x.party_terms_days == null ? "no terms" : `${x.party_terms_days} days`}</span>}</dd></>}
            {(x.party_ntn || x.party_strn) && <><dt>NTN / STRN</dt><dd>{[x.party_ntn, x.party_strn].map((v) => v || "—").join(" / ")}</dd></>}
          </dl>
          {x.lines.length > 0 && (
            <table className="table compact">
              <thead><tr><th>On the paper</th><th>Our item</th><th className="r">Qty</th><th className="r">Rate</th></tr></thead>
              <tbody>{x.lines.map((l, i) => (
                <tr key={i} className={l.match_confidence !== "high" ? "ai-check" : ""}>
                  <td>{l.description}{(l.requisition || l.their_code) && <div className="muted small">{[l.requisition && `PR ${l.requisition}`, l.their_code].filter(Boolean).join(" · ")}</div>}</td>
                  <td>{l.item_match_id ? <>{l.match_confidence === "high" ? "✓ " : "? "}{l.item_name}</> : <span className="ai-flag">not in items</span>}</td>
                  <td className="r">{num(l.qty)} {l.unit ? unitOf(l.unit) : ""}</td><td className="r">{l.rate != null ? money(l.rate) : "—"}</td>
                </tr>
              ))}</tbody>
              {total > 0 && <tfoot><tr><td colSpan={3}>Total (before tax){x.total ? ` · paper says ${money(x.total)}` : ""}</td><td className="r">{money(total)}</td></tr></tfoot>}
            </table>
          )}
          {x.notes && <p className="small"><b>Notes:</b> {x.notes}</p>}
          {x.check && <p className="small form-error">⚠ {x.check}</p>}
        </div>
      )}

      {m.status === "done" && m.result_kind && <p className="pos">✓ Done. <Link to={`/${RESULT[m.result_kind]}/${m.result_id}`}>Open the {m.result_kind === "job" ? "Job" : m.result_kind}</Link></p>}

      <div className="actions wrap">
        {order && m.status !== "done" && can("sales.write") && <>
          {x.request === "rfq" ? <>
            <button className="btn primary" onClick={() => nav(`/quotes/new?inbox=${m.id}`)}>Make a quote</button>
            <button className="btn" onClick={() => nav(`/jobs/new?inbox=${m.id}`)}>Already confirmed → Create Job</button>
          </> : <>
            <button className="btn primary" onClick={() => nav(`/jobs/new?inbox=${m.id}`)}>Confirmed order → Create Job</button>
            <button className="btn" onClick={() => nav(`/quotes/new?inbox=${m.id}`)}>Make a quote</button>
          </>}
        </>}
        {bill && m.status !== "done" && can("buy") && <button className="btn primary" onClick={() => nav(`/bills/new?inbox=${m.id}`)}>Create supplier bill</button>}
        {["ready", "error", "ignored"].includes(m.status) && <button className="btn ghost" onClick={() => act(() => api(`/inbox/${m.id}/read`, { method: "POST" }), "Reading again…")}>Read again</button>}
        {m.status === "ready" && <button className="btn ghost" onClick={() => act(() => api(`/inbox/${m.id}/status`, { method: "POST", body: { status: "ignored" } }), "Ignored")}>Ignore</button>}
        {m.status === "ignored" && <button className="btn ghost" onClick={() => act(() => api(`/inbox/${m.id}/status`, { method: "POST", body: { status: "ready" } }))}>Move back to inbox</button>}
      </div>

      <details className="original" open={!x}>
        <summary>Original message{m.files.length ? ` and ${m.files.length} file(s)` : ""}</summary>
        {m.body_text && <pre>{m.body_text}</pre>}
        <ul className="files">{m.files.map((f) => (
          <li key={f.id}>{f.mime.startsWith("image/") ? <a href={`/api/inbox/files/${f.id}`} target="_blank" rel="noreferrer"><img src={`/api/inbox/files/${f.id}`} alt={f.filename} /></a>
            : <a className="fileicon" href={`/api/inbox/files/${f.id}`} target="_blank" rel="noreferrer">{f.mime.includes("pdf") ? "PDF" : "FILE"}</a>}
            <div><a href={`/api/inbox/files/${f.id}`} target="_blank" rel="noreferrer"><b>{f.filename}</b></a></div></li>
        ))}</ul>
      </details>
    </section>
  );
}

export default function Inbox() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("open");
  const [adding, setAdding] = useState(false);
  const { can } = useAuth();
  const st = useLoad("/setup-status");
  const state = useLoad("/inbox");
  const toast = useToast();
  const open = params.get("open");
  const select = (id) => setParams(id ? { open: String(id) } : {});
  const busy = useRef(false);
  // refresh the list now and then (new emails arrive in the background)
  useEffect(() => { const t = setInterval(() => !busy.current && state.reload(), 30000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = (state.data || []).filter((r) => filter === "all" || (filter === "open" ? ["new", "reading", "ready", "error"].includes(r.status) : r.status === filter));
  const checkNow = async () => { busy.current = true; try { const r = await api("/inbox/check", { method: "POST" }); toast(r.added ? `${r.added} new email(s)` : "No new emails"); state.reload(); } catch (x) { toast(x.message, "err"); } finally { busy.current = false; } };
  return (
    <>
      <PageHead title="Orders Inbox" sub="Customer POs and supplier bills, read by AI. Check the draft, then turn it into a Job, quote or bill.">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show">{[["open", "To do"], ["done", "Done"], ["ignored", "Ignored"], ["all", "All"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {can("admin") && st.data?.email_in && <button className="btn" onClick={checkNow}>Check email now</button>}
        <button className="btn primary" onClick={() => setAdding(true)}>+ Paste / upload</button>
      </PageHead>
      <SetupNote st={st.data} isAdmin={can("admin")} />
      <div className={`inbox ${open ? "has-open" : ""}`}>
        <Loading state={state}>{() => rows.length === 0 ? <div className="empty">{filter === "open" ? "Nothing waiting. New POs and bills will show up here." : "Nothing here."}</div> : (
          <ul className="inbox-list">
            {rows.map((r) => (
              <li key={r.id} className={String(r.id) === open ? "active" : ""}>
                <button onClick={() => select(r.id)}>
                  <div className="row-between"><b>{r.party_name || r.from_addr || "Added in the app"}</b><time className="muted small">{when(r.received_at)}</time></div>
                  <span className="small">{r.summary || r.subject || (r.source === "paste" ? "Pasted message" : "Uploaded file")}</span>
                  <div className="tags">
                    <span className={`badge ${TONE[r.status]} sm`}>{STATUS[r.status]}</span>
                    {r.doc_type && <span className={`badge ${TYPE[r.doc_type][1]} sm`}>{TYPE[r.doc_type][0]}</span>}
                    {r.file_count > 0 && <span className="muted small">📎 {r.file_count}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}</Loading>
        {open && <div><button className="btn ghost sm back" onClick={() => select(null)}>← Back to list</button><Detail key={open} id={open} onChanged={state.reload} /></div>}
      </div>
      {adding && <AddMessage onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); state.reload(); select(id); }} />}
    </>
  );
}
