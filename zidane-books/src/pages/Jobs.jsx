// Internal Jobs: Sales creates, Operations fulfils, Sales delivers and invoices. One screen, shaped by role.
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, Badge, Field, fmtDate, KIND, label, Loading, Modal, money, num, OPS_STEPS, PageHead, Search, today, useAuth, useLoad, useToast } from "../lib.jsx";
import RationPanel from "../components/RationPanel.jsx";
import AccountSelect from "../components/AccountSelect.jsx";
import { ContactForm } from "./Contacts.jsx";
import { ItemForm } from "./Items.jsx";
import Attachments from "../components/Attachments.jsx";
import Comments from "../components/Comments.jsx";
import Activity from "../components/Activity.jsx";
import Picker from "../components/Picker.jsx";
import { contactOptions, itemOptions } from "./DocumentForm.jsx";
import { cleanLine, guessCategory, learnedLines, missingLines, partyPreset, unitOf } from "../components/draftLines.js";
import NewItems from "../components/NewItems.jsx";

const PRIORITY_TONE = { urgent: "red", high: "amber", normal: "grey", low: "grey" };
// buying status of a Job line, in words everyone understands (not invoice words like "paid" / "overdue")
const PROC = { to_buy: ["To buy", "amber"], partial: ["Partly bought", "amber"], bought: ["Bought", "green"], from_stock: ["From our stock", "green"] };
const ProcBadge = ({ s }) => <span className={`badge ${PROC[s]?.[1] || "grey"}`}>{PROC[s]?.[0] || label(s)}</span>;

// the filter chips over the Jobs list; "in buying" covers the procurement steps
const IN_BUYING = ["procurement_started", "partially_purchased", "purchase_complete"];
const isOverdue = (j) => !j.closed && j.required_date && j.required_date < today() && OPS_STEPS.indexOf(j.ops_status) < 5;
const FILTERS = [
  ["active", "Active", (j) => !j.closed],
  ["new", "New", (j) => !j.closed && j.ops_status === "new"],
  ["buying", "In buying", (j) => !j.closed && IN_BUYING.includes(j.ops_status)],
  ["ready", "Material ready", (j) => !j.closed && j.ops_status === "material_ready"],
  ["dispatched", "Dispatched", (j) => !j.closed && j.ops_status === "dispatched"],
  ["delivered", "Delivered", (j) => !j.closed && j.ops_status === "delivered"],
  ["overdue", "Overdue", isOverdue],
  ["closed", "Closed", (j) => Boolean(j.closed)],
  ["all", "All", () => true],
];
// whole days between two dates (Karachi calendar days); created_at is stored in UTC
const karachiDay = (utc) => new Date(new Date(utc.replace(" ", "T") + "Z").getTime() + 5 * 3600e3).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const dayWord = (n) => (n <= 0 ? "today" : n === 1 ? "1 day" : `${n} days`);
function age(j) {
  const made = karachiDay(j.created_at);
  const done = j.closed ? j.closed_on || j.delivered_on : j.ops_status === "delivered" ? j.delivered_on : null;
  if (done) { const n = daysBetween(made, done); return { text: n <= 0 ? "done same day" : `done in ${dayWord(n)}`, tone: "muted" }; }
  const n = daysBetween(made, today());
  return { text: n <= 0 ? "today" : `${dayWord(n)} old`, tone: n > 14 ? "neg" : n > 7 ? "warn" : "" };
}

export default function Jobs() {
  const [q, setQ] = useState("");
  const saved = (() => { try { return localStorage.getItem("jobs:filter"); } catch { return null; } })();
  const [filter, setFilter] = useState(FILTERS.some((f) => f[0] === saved) ? saved : "active");
  const pick = (f) => { setFilter(f); try { localStorage.setItem("jobs:filter", f); } catch {} };
  const { can } = useAuth();
  const state = useLoad(`/jobs?q=${encodeURIComponent(q)}`);
  const nav = useNavigate();
  const all = state.data || [];
  const test = FILTERS.find((f) => f[0] === filter)[2];
  return (
    <>
      <PageHead title="Jobs" sub="Every confirmed customer order becomes a Job. Sales creates it, Operations fulfils it.">
        <Search value={q} onChange={setQ} placeholder="Search PO #, job or customer…" />
        {can("sales.write") && <Link className="btn primary" to="/jobs/new">+ New Job</Link>}
      </PageHead>
      <div className="chips">{FILTERS.map(([k, name, f]) => {
        const n = all.filter(f).length;
        return <button key={k} className={`chip ${filter === k ? "on" : ""} ${k === "overdue" && n ? "alert" : ""}`} onClick={() => pick(k)}>{name} <span className="n">{n}</span></button>;
      })}</div>
      <Loading state={state}>{(list) => { const rows = list.filter(test); return rows.length === 0 ? <div className="empty">{list.length ? "No Jobs in this filter." : "No Jobs yet."}</div> : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Job</th><th>Created</th><th>Age</th><th>Customer PO</th><th>Customer</th><th>Needed by</th><th>Priority</th><th>Fulfilment</th><th className="r">Items</th>{can("sales.read") && <th>Customer side</th>}</tr></thead>
          <tbody>{rows.map((j) => { const a = age(j); return (
            <tr key={j.id} className="click" onClick={() => nav(`/jobs/${j.id}`)}>
              <td><b>{j.number}</b>{j.fulfilment_type === "direct" && <span className="badge blue sm">direct</span>}{j.closed ? <span className="badge grey sm">closed</span> : null}</td>
              <td className="nowrap">{fmtDate(karachiDay(j.created_at))}</td>
              <td className={`nowrap ${a.tone}`}>{a.text}</td>
              <td>{j.customer_po_number ? <b className="po">{j.customer_po_number}</b> : <span className="muted">—</span>}</td>
              <td>{j.customer_name}</td>
              <td className={isOverdue(j) ? "neg" : ""}>{fmtDate(j.required_date)}</td>
              <td><span className={`badge ${PRIORITY_TONE[j.priority]}`}>{j.priority}</span></td>
              <td><Badge status={j.ops_status} /></td>
              <td className="r">{j.item_count}{j.to_buy_count > 0 && <span className="muted small"> · {j.to_buy_count} to buy</span>}</td>
              {can("sales.read") && <td className="small">{j.invoice_count ? "Invoiced" : j.signed_dc_count ? "Signed DC" : j.dc_count ? "DC issued" : "—"}</td>}
            </tr>
          ); })}</tbody>
        </table></div>
      ); }}</Loading>
    </>
  );
}

const blank = () => ({ key: Math.random(), item_id: "", description: "", qty: 1, sale_rate: 0, tax_rate: 0 });

export function JobForm() {
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { id: editId } = useParams(); // /jobs/:id/edit corrects an existing Job
  const customers = useLoad("/contacts?type=customer");
  const items = useLoad("/items");
  const settings = useLoad("/settings");
  const [f, setF] = useState({ customer_id: params.get("customer") || "", order_source: "call", customer_po_number: "", customer_po_date: "", required_date: "", delivery_location: "", priority: "normal", fulfilment_type: "stock", instructions: "", items: [blank()] });
  const [adding, setAdding] = useState(null); // null, or the customer name typed in the picker
  const [addingItem, setAddingItem] = useState(null); // null, or { line, name, preset }
  const [aiParty, setAiParty] = useState(null);
  const [partyInfo, setPartyInfo] = useState({}); // what the PO says about the customer (buyer, terms, NTN)
  const [err, setErr] = useState("");
  // a customer PO read by AI in the orders inbox (?inbox=ID)
  const inboxId = params.get("inbox");
  const [aiFilled, setAiFilled] = useState(false);
  const filledFrom = useRef(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    // once only: reloading items (after "Add the new items") must not refill the form over what was done
    if (!inboxId || !items.data || filledFrom.current === inboxId) return;
    filledFrom.current = inboxId;
    api(`/inbox/${inboxId}`).then((m) => {
      const x = m.extraction;
      if (!x) return;
      setF((s) => ({
        ...s, customer_id: x.party_match_id ? String(x.party_match_id) : s.customer_id, order_source: m.source === "email" ? (x.reference ? "formal PO" : "email") : m.source === "paste" ? "whatsapp" : x.reference ? "formal PO" : s.order_source,
        customer_po_number: x.reference || "", customer_po_date: x.date || "", required_date: x.required_date || "", delivery_location: x.delivery_location || "",
        // for Operations: who to deal with at the customer, not the money terms
        instructions: [!x.party_match_id && x.party_name ? `Customer on paper: ${x.party_name}` : null, x.buyer_name ? `Buyer: ${[x.buyer_name, x.contact_phone].filter(Boolean).join(", ")}` : null, x.notes].filter(Boolean).join("\n"),
        items: x.lines.length ? x.lines.map((l) => {
          const it = items.data.find((i) => i.id === l.item_match_id);
          return { ...blank(), item_id: it ? it.id : "", description: it ? "" : [l.description, l.unit].filter(Boolean).join(" · "), qty: l.qty, sale_rate: l.rate ?? it?.sale_rate ?? 0, tax_rate: l.tax_rate ?? it?.tax_rate ?? 0, ai: l.match_confidence, ai_text: l.description, ai_unit: l.unit, ai_rate: l.rate };
        }) : s.items,
      }));
      setAiParty(!x.party_match_id && x.party_name ? x.party_name : null);
      setPartyInfo(partyPreset(x));
      setAiFilled(true);
    }).catch(() => {});
  }, [inboxId, items.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editId) return;
    api(`/jobs/${editId}`).then((j) => setF({
      customer_id: String(j.customer_id), order_source: j.order_source, customer_po_number: j.customer_po_number || "", customer_po_date: j.customer_po_date || "",
      required_date: j.required_date || "", delivery_location: j.delivery_location || "", priority: j.priority, fulfilment_type: j.fulfilment_type, instructions: j.instructions || "",
      items: j.items.map((it) => ({ key: it.id, id: it.id, item_id: it.item_id || "", description: it.item_id ? "" : it.name, qty: it.qty, sale_rate: it.sale_rate ?? 0, tax_rate: it.tax_rate ?? 0 })),
    })).catch((x) => setErr(x.message));
  }, [editId]);
  const set = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  const setItem = (i, patch) => setF((s) => ({ ...s, items: s.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return; // a double tap must not make two Jobs
    setErr("");
    setSaving(true);
    try {
      // "Customer on paper" was only a hint while the customer wasn't picked
      const instructions = f.customer_id ? f.instructions.split("\n").filter((l) => !l.startsWith("Customer on paper:")).join("\n") : f.instructions;
      const body = { ...f, instructions, items: f.items.map(({ key, ...x }) => ({ ...cleanLine(x), item_id: x.item_id || null })) };
      if (editId) {
        await api(`/jobs/${editId}`, { method: "PUT", body });
        toast("Job updated");
        return nav(`/jobs/${editId}`);
      }
      const r = await api("/jobs", { method: "POST", body });
      if (inboxId) await api(`/inbox/${inboxId}/status`, { method: "POST", body: { status: "done", result_kind: "job", result_id: r.id, lines: learnedLines(f.items) } }).catch(() => {});
      toast("Job created and sent to Operations");
      nav(`/jobs/${r.id}`);
    } catch (x) { setErr(x.message); setSaving(false); }
  };
  return (
    <>
      <PageHead title={editId ? "Edit Job" : "New Job"} sub={editId ? "Correct quantities, rates or items. What's already on a bill, DC or invoice can't go below that." : "For a confirmed order. Customer PO is optional; Operations gets only what it needs to fulfil."} />
      {aiParty && !f.customer_id && <div className="ai-banner">The PO is from <b>{aiParty}</b>, who isn't in your customers yet. <button className="btn sm" onClick={() => setAdding(aiParty)}>+ Add {aiParty} as a new customer</button></div>}
      {aiFilled && <div className="ai-banner">✨ Filled from the customer's PO. Lines marked <span className="ai-flag">check</span> weren't matched to one of your items for sure. Pick the right item (it's remembered for next time) or add them as new items.
        {missingLines(f.items).length > 0 && <> <button className="btn sm" onClick={() => setCreating(true)}>+ Add the {missingLines(f.items).length} new item(s) to my items</button></>}</div>}
      <div className="card form">
        <div className="row-4">
          {editId ? <Field label="Customer"><input value={customers.data?.find((c) => String(c.id) === f.customer_id)?.name || ""} disabled /></Field> : <Field label="Customer *"><div className="with-btn"><Picker options={contactOptions(customers.data)} value={f.customer_id} onChange={(v) => setF((s) => ({ ...s, customer_id: String(v) }))} placeholder="Type customer name…" createLabel="customer" onCreate={(name) => setAdding(name)} /><button type="button" className="btn sm" title="New customer" onClick={() => setAdding("")}>+</button></div></Field>}
          <Field label="Order came by"><select {...set("order_source")}>{["call", "whatsapp", "email", "verbal", "repeat order", "tender", "contract", "formal PO", "walk-in"].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Customer PO # (optional)"><input {...set("customer_po_number")} /></Field>
          <Field label="PO date"><input type="date" {...set("customer_po_date")} /></Field>
        </div>
        <div className="row-4">
          <Field label="Needed by"><input type="date" {...set("required_date")} /></Field>
          <Field label="Priority"><select {...set("priority")}>{["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Fulfilment" hint={f.fulfilment_type === "direct" ? "Supplier delivers straight to the customer; warehouse stock isn't touched" : "Goods come through our warehouse"}>
            <select {...set("fulfilment_type")}><option value="stock">Through warehouse</option><option value="direct">Direct delivery</option></select>
          </Field>
          <Field label="Delivery location"><input {...set("delivery_location")} /></Field>
        </div>
        <table className="table lines-table">
          <thead><tr><th style={{ width: "45%" }}>Item</th><th>Qty</th><th>Selling rate (Rs)</th><th>Tax</th><th className="r">Amount</th><th /></tr></thead>
          <tbody>{f.items.map((l, i) => (
            <tr key={l.key} className={l.ai && l.ai !== "high" ? "ai-check" : ""}>
              <td>
                {l.ai && l.ai !== "high" && <small className="ai-flag" title="What the paper said">check: “{l.ai_text}”
                  {!l.item_id && <> · <button type="button" className="link-btn" onClick={() => setAddingItem({ line: i, name: l.ai_text, preset: { unit: unitOf(l.ai_unit), sale_rate: l.ai_rate ?? "", category: guessCategory(l.ai_text, items.data, settings.data?.itemCategories) } })}>+ add as new item</button></>}</small>}
                <Picker options={itemOptions(items.data)} value={l.item_id} emptyLabel="— not in the item list (describe below) —" placeholder="Type item name or SKU…" createLabel="item"
                  onChange={(v) => { const it = items.data?.find((x) => String(x.id) === String(v)); setItem(i, it ? { item_id: it.id, sale_rate: l.ai_rate ?? it.sale_rate ?? 0, tax_rate: it.tax_rate, ai: null } : { item_id: "" }); }}
                  onCreate={(name) => setAddingItem({ line: i, name })} />
                {!l.item_id && <input className="mt" placeholder="Describe the item (e.g. Harpic 500ml)" value={l.description} onChange={(e) => setItem(i, { description: e.target.value })} />}
              </td>
              <td><input type="number" step="0.01" value={l.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></td>
              <td><input type="number" step="0.01" value={l.sale_rate} onChange={(e) => setItem(i, { sale_rate: e.target.value })} placeholder="0 = rate pending" /></td>
              <td><select value={l.tax_rate} onChange={(e) => setItem(i, { tax_rate: e.target.value })}>{(settings.data?.taxes || []).map((t) => <option key={t.name} value={t.rate}>{t.rate}%</option>)}</select></td>
              <td className="r">{money((Number(l.qty) || 0) * (Number(l.sale_rate) || 0))}</td>
              <td><button type="button" className="icon-btn" aria-label="Remove" onClick={() => setF((s) => ({ ...s, items: s.items.length > 1 ? s.items.filter((_, j) => j !== i) : [blank()] }))}>×</button></td>
            </tr>
          ))}</tbody>
        </table>
        <div><button type="button" className="btn ghost" onClick={() => setF((s) => ({ ...s, items: [...s.items, blank()] }))}>+ Add item</button>
          <button type="button" className="btn ghost" onClick={() => setAddingItem({ line: -1, name: "" })}>+ New item (not in list)</button></div>
        <Field label="Instructions for Operations"><textarea rows={2} {...set("instructions")} placeholder="Packing, delivery timing, gate pass…" /></Field>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button className="btn ghost" onClick={() => nav(-1)}>Cancel</button><button className="btn primary" disabled={saving} onClick={save}>{saving ? "Saving…" : editId ? "Save changes" : "Create Job"}</button></div>
      </div>
      {creating && <NewItems lines={f.items} items={items.data} rateField="sale_rate" onClose={() => setCreating(false)} onDone={(items2) => { setCreating(false); items.reload(); setF((s) => ({ ...s, items: items2 })); }} />}
      {addingItem && <ItemForm presetName={addingItem.name} preset={addingItem.preset} onClose={() => setAddingItem(null)} onSaved={async (newId) => {
        const target = addingItem.line;
        setAddingItem(null);
        const it = await api(`/items/${newId}`);
        items.reload();
        setF((s) => {
          // the line it was typed on (keeping its qty), else the first empty line, else a new line
          const at = target >= 0 ? target : s.items.findIndex((x) => !x.item_id && !x.description);
          const line = { ...blank(), item_id: it.id, sale_rate: it.sale_rate ?? 0, tax_rate: it.tax_rate, ...(at >= 0 && target >= 0 ? { key: s.items[at].key, qty: s.items[at].qty } : {}) };
          return { ...s, items: at < 0 ? [...s.items, line] : s.items.map((x, j) => (j === at ? line : x)) };
        });
      }} />}
      {adding !== null && <ContactForm type="customer" presetName={adding} preset={adding === aiParty ? partyInfo : {}} onClose={() => setAdding(null)} onSaved={(id) => { setAdding(null); setAiParty(null); customers.reload(); setF((s) => ({ ...s, customer_id: String(id)})); }} />}
    </>
  );
}

function JobCost({ job, settings, onClose, onSaved }) {
  const [e, setE] = useState({ category: settings?.jobExpenseCategories?.[0] || "Freight", amount: "", date: today(), paid_through: "cash", account_id: "", notes: "" });
  const [err, setErr] = useState("");
  // one cost for goods of several Jobs (a rickshaw for two POs): share it out
  const [share, setShare] = useState(false);
  const [others, setOthers] = useState([]);
  const [mode, setMode] = useState("value");
  const [preview, setPreview] = useState(null);
  const jobs = useLoad(share ? "/jobs?scope=active" : null);
  const ids = [job.id, ...others];
  useEffect(() => {
    if (!share || others.length === 0 || !(Number(e.amount) > 0)) return setPreview(null);
    api("/expenses/split", { method: "POST", body: { ...e, job_ids: ids, mode, preview: true } }).then(setPreview).catch(() => setPreview(null));
  }, [share, others.join(","), mode, e.amount]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = (k) => ({ value: e[k], onChange: (x) => setE({ ...e, [k]: x.target.value }) });
  const save = async (x) => {
    x.preventDefault();
    try {
      if (share && others.length) await api("/expenses/split", { method: "POST", body: { ...e, job_ids: ids, mode } });
      else await api("/expenses", { method: "POST", body: { ...e, job_id: job.id } });
      onSaved();
    } catch (y) { setErr(y.message); }
  };
  return (
    <Modal title={`Add direct cost · ${job.number}`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="row-2"><Field label="Type"><select {...b("category")}>{(settings?.jobExpenseCategories || ["Freight"]).map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Amount (Rs)"><input type="number" step="0.01" {...b("amount")} required autoFocus /></Field></div>
        <div className="row-2"><Field label="Date"><input type="date" {...b("date")} /></Field><Field label="Paid by"><select {...b("paid_through")}><option value="cash">Cash</option><option value="bank">Bank</option><option value="online">Online / wallet</option></select></Field></div>
        <Field label="Paid from account *"><AccountSelect value={e.account_id} mode={e.paid_through} onChange={(v) => setE((x) => ({ ...x, account_id: v }))} /></Field>
        <Field label="Notes"><input {...b("notes")} placeholder="Vehicle #, labour count…" /></Field>
        <label className="check"><input type="checkbox" checked={share} onChange={(x) => setShare(x.target.checked)} /> This cost was for other Jobs too (share it)</label>
        {share && (
          <div className="share-box">
            <div className="share-list">{(jobs.data || []).filter((j) => j.id !== job.id).map((j) => (
              <label key={j.id} className="check"><input type="checkbox" checked={others.includes(j.id)} onChange={(x) => setOthers((o) => (x.target.checked ? [...o, j.id] : o.filter((y) => y !== j.id)))} /> {j.number} · {j.customer_name}{j.customer_po_number ? ` · PO ${j.customer_po_number}` : ""}</label>
            ))}</div>
            <Field label="Share it"><select value={mode} onChange={(x) => setMode(x.target.value)}><option value="value">By each Job's value</option><option value="equal">Equally</option></select></Field>
            {preview && <p className="small">{preview.shares.map((s) => `${s.number}: ${money(s.amount)}`).join(" · ")}</p>}
          </div>
        )}
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">{share && others.length ? `Save for ${others.length + 1} Jobs` : "Save"}</button></div>
      </form>
    </Modal>
  );
}

export function JobView() {
  const { id } = useParams();
  const state = useLoad(`/jobs/${id}`);
  const settings = useLoad("/settings");
  const { can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [cost, setCost] = useState(false);
  const [deliver, setDeliver] = useState(false);
  // reload on failure too, so a refused change (e.g. a status dropdown) snaps back to what's saved
  const act = async (fn, msg) => { try { const r = await fn(); if (msg) toast(msg); state.reload(); return r; } catch (x) { toast(x.message, "err"); state.reload(); } };
  return (
    <Loading state={state}>{(j) => {
      const step = OPS_STEPS.indexOf(j.ops_status);
      const nextOps = { new: "procurement_started", procurement_started: null, partially_purchased: null, purchase_complete: "material_ready", material_ready: "dispatched", dispatched: "delivered" }[j.ops_status];
      const docsOf = (k) => j.documents.filter((d) => d.kind === k);
      // Sales: what's in hand and not delivered yet (a part delivery is fine), and what's delivered but not invoiced
      const canDeliver = j.items.some((it) => (it.ready_qty ?? 0) - it.delivered_qty > 0.001);
      const toDeliverLeft = j.items.some((it) => it.qty - it.delivered_qty > 0.001);
      // an invoice can come before or after the DC: whatever isn't invoiced yet
      const canInvoice = j.items.some((it) => it.qty - (it.invoiced_qty ?? 0) > 0.001);
      return (
        <>
          <PageHead title={<>{j.number}{j.customer_po_number && <span className="po-tag">PO {j.customer_po_number}</span>} <Badge status={j.ops_status} /></>} sub={`${j.customer_name}${j.customer_po_date ? ` · PO dated ${fmtDate(j.customer_po_date)}` : ""} · created by ${j.created_by_name || "—"}`}>
            {can("ops.write") && j.ops_status === "new" && <button className="btn primary" onClick={() => act(() => api(`/jobs/${id}/ops-status`, { method: "POST", body: { status: "procurement_started" } }), "Procurement started")}>Start procurement</button>}
            {can("ops.write") && step >= 1 && step < 4 && <button className="btn primary" onClick={() => act(() => api(`/jobs/${id}/ops-status`, { method: "POST", body: { status: "material_ready" } }), "Sales has been told material is ready")}>Mark material ready</button>}
            {can("ops.write") && step === 4 && !j.documents.some((d) => d.kind === "dc" && d.status !== "draft" && d.status !== "void") && <button className="btn ghost" onClick={() => act(() => api(`/jobs/${id}/ops-status`, { method: "POST", body: { status: "procurement_started" } }), "Moved back to procurement")}>Not ready after all</button>}
            {can("ops.write") && j.ops_status === "dispatched" && !j.documents.some((d) => d.kind === "dc" && ["issued", "signed"].includes(d.status)) && <button className="btn ghost" onClick={() => act(() => api(`/jobs/${id}/ops-status`, { method: "POST", body: { status: "material_ready" } }), "Moved back to material ready")}>Not dispatched yet</button>}
            {can("ops.write") && nextOps && step >= 4 && nextOps !== "delivered" && <button className="btn" onClick={() => act(() => api(`/jobs/${id}/ops-status`, { method: "POST", body: { status: nextOps } }), `Marked ${label(nextOps)}`)}>Mark {label(nextOps)}</button>}
            {can("sales.write") && !j.closed && <Link className="btn ghost" to={`/jobs/${id}/edit`}>Edit Job</Link>}
            {(can("admin") || can("sales.write")) && !j.documents.length && !j.expenses?.length && <button className="btn ghost danger" onClick={async () => { if (confirm(`Delete ${j.number}? Use this for a Job made twice by mistake.`) && await act(() => api(`/jobs/${id}`, { method: "DELETE" }), "Job deleted")) nav("/jobs"); }}>Delete Job</button>}
            {can("buy") && <Link className="btn" to={`/bills/new?job=${id}`}>+ Supplier bill</Link>}
            {can("buy") && <button className="btn" onClick={() => setCost(true)}>+ Freight / direct cost</button>}
            {can("sales.write") && !j.closed && canDeliver && <button className="btn primary" onClick={() => setDeliver(true)}>{step >= 4 ? "Material arrived" : "Send what's in hand"} → DC + invoice</button>}
            {can("sales.write") && !j.closed && !j.ration && toDeliverLeft && (canDeliver || can("admin")) && <button className="btn" onClick={async () => { const r = await act(() => api(`/jobs/${id}/dc`, { method: "POST" }), "Draft DC created"); if (r) nav(`/delivery-challans/${r.id}`); }}>Create DC</button>}
            {can("sales.write") && !j.closed && toDeliverLeft && !canDeliver && <span className="muted small self-center">DC unlocks when Operations marks items bought or the material ready</span>}
            {can("sales.write") && !j.closed && !j.ration && canInvoice && <button className="btn" onClick={async () => { const r = await act(() => api(`/jobs/${id}/invoice`, { method: "POST" }), "Draft invoice created"); if (r) nav(`/invoices/${r.id}`); }}>Create invoice</button>}
            {can("admin") && <button className="btn ghost" onClick={() => act(() => api(`/jobs/${id}/close`, { method: "POST", body: { closed: !j.closed } }), j.closed ? "Job reopened" : "Job closed")}>{j.closed ? "Reopen" : "Close job"}</button>}
          </PageHead>

          <div className="steps">{OPS_STEPS.map((s, i) => <div key={s} className={`step ${i <= step ? "done" : ""} ${i === step ? "now" : ""}`}><i />{label(s)}</div>)}</div>
          {j.ration && <RationPanel job={j} onChange={state.reload} />}

          <div className="grid-2">
            <section className="card">
              <dl className="kv">
                <dt>Needed by</dt><dd className={j.required_date && j.required_date < today() && step < 4 ? "neg" : ""}>{fmtDate(j.required_date)}</dd>
                <dt>Priority</dt><dd><span className={`badge ${PRIORITY_TONE[j.priority]}`}>{j.priority}</span></dd>
                <dt>Fulfilment</dt><dd>{j.fulfilment_type === "direct" ? "Direct delivery from supplier" : "Through warehouse"}</dd>
                <dt>Deliver to</dt><dd>{j.delivery_location || "—"}</dd>
                <dt>Instructions</dt><dd>{j.instructions || "—"}</dd>
                {j.customer_phone && <><dt>Customer phone</dt><dd>{j.customer_phone}</dd></>}
                <dt>Order source</dt><dd>{j.order_source}</dd>
              </dl>
            </section>
            {j.economics ? (
              <section className="card">
                <h3>Job economics <span className="muted small">(Director / Accounts only)</span></h3>
                <dl className="statement">
                  <dt>Revenue ({j.economics.revenue_basis})</dt><dd>{money(j.economics.revenue_basis === "invoiced" ? j.economics.invoiced_revenue : j.economics.expected_revenue)}</dd>
                  <dt className="indent">Purchases (supplier bills)</dt><dd className="muted">− {money(j.economics.purchases)}</dd>
                  {j.economics.stock_cost > 0 && <><dt className="indent">From own stock (at cost)</dt><dd className="muted">− {money(j.economics.stock_cost)}</dd></>}
                  <dt className="indent">Freight & direct costs</dt><dd className="muted">− {money(j.economics.direct_costs)}</dd>
                  <dt className="grand">Gross profit</dt><dd className={`grand ${j.economics.gross_profit < 0 ? "neg" : "pos"}`}>{money(j.economics.gross_profit)} <small className="muted">({j.economics.margin_pct}%)</small></dd>
                </dl>
                {j.economics.cost_pending && <p className="neg small">{j.economics.cost_pending_reason === "no_bill" ? "Profit not final: no supplier bill on this Job yet." : "Profit not final: some items are still to buy."}</p>}
              </section>
            ) : (
              <section className="card"><h3>Documents</h3>{j.documents.length === 0 ? <p className="muted">None yet.</p> : <DocList docs={j.documents} />}</section>
            )}
          </div>

          <section className="card flush">
            <h3 className="pad">Items</h3>
            <table className="table">
              <thead><tr><th>Item</th><th className="r">Qty</th>{can("price.view") && <th className="r">Selling rate</th>}{can("cost.view") && <th className="r">Last cost</th>}<th>Procurement</th>{can("ops.read") && <th className="r">Bought</th>}{can("sales.read") && <th className="r">Delivered</th>}{can("sales.read") && <th className="r">Invoiced</th>}</tr></thead>
              <tbody>{j.items.map((it) => (
                <tr key={it.id}>
                  <td><b>{it.name}</b>{it.stock_qty !== null && it.stock_qty !== undefined && can("ops.read") && <div className="muted small">In stock: {num(it.stock_qty)} {it.unit}</div>}</td>
                  <td className="r">{num(it.qty)} {it.unit}</td>
                  {can("price.view") && <td className="r">{it.sale_rate ? money(it.sale_rate) : <span className="neg">rate pending</span>}</td>}
                  {can("cost.view") && <td className="r">{it.purchase_rate ? money(it.purchase_rate) : "—"}</td>}
                  <td>
                    {can("buy") && !j.closed && !(it.delivered_qty > 0) && !(step >= 4 && ["bought", "from_stock"].includes(it.procurement_status)) ? (
                      <select className="inline" value={it.procurement_status} onChange={(e) => act(() => api(`/job-items/${it.id}/procurement`, { method: "POST", body: { status: e.target.value } }), `Marked ${PROC[e.target.value][0].toLowerCase()}`)}>
                        {Object.entries(PROC).map(([s, [l]]) => <option key={s} value={s}>{l}</option>)}
                      </select>
                    ) : <ProcBadge s={it.procurement_status} />}
                  </td>
                  {can("ops.read") && <td className="r">{num(it.purchased_qty)}</td>}
                  {can("sales.read") && <td className="r">{num(it.delivered_qty)}</td>}
                  {can("sales.read") && <td className="r">{num(it.invoiced_qty)}</td>}
                </tr>
              ))}</tbody>
            </table>
          </section>

          {j.economics && j.documents.length > 0 && <section className="card"><h3>Documents</h3><DocList docs={j.documents} /></section>}
          {j.expenses.length > 0 && (
            <section className="card flush">
              <h3 className="pad">Direct costs</h3>
              <table className="table"><thead><tr><th>Date</th><th>Type</th><th>Paid by</th><th>Notes</th><th className="r">Amount</th></tr></thead>
                <tbody>{j.expenses.map((e) => <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{e.category}</td><td>{e.account_name || e.paid_through}</td><td className="muted">{e.notes}</td><td className="r">{money(e.amount)}</td></tr>)}</tbody></table>
            </section>
          )}
          <Attachments entity="job" id={j.id} labels={["Customer PO", "Delivery photo", "Supplier quotation", "Other evidence"]} />
          <Comments entity="job" id={j.id} />
          <Activity entity="job" id={j.id} />
          {deliver && <DeliverModal job={j} onClose={() => setDeliver(false)} onDone={() => { setDeliver(false); state.reload(); }} />}
          {cost && <JobCost job={j} settings={settings.data} onClose={() => setCost(false)} onSaved={() => { setCost(false); toast("Cost added to Job"); state.reload(); }} />}
        </>
      );
    }}</Loading>
  );
}

// one click when goods are ready: issue the DC and the invoice together, and (optionally) email both PDFs to the customer
function DeliverModal({ job, onClose, onDone }) {
  const [email, setEmail] = useState(true);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const setup = useLoad("/setup-status");
  const customer = useLoad(`/contacts/${job.customer_id}`);
  useEffect(() => { if (customer.data?.email) setTo(customer.data.email); }, [customer.data]);
  const canEmail = setup.data?.email_out;
  const go = async () => {
    setBusy(true);
    try { setResult(await api(`/jobs/${job.id}/deliver`, { method: "POST", body: { email: canEmail && email, to } })); }
    catch (x) { setResult({ error: x.message }); } finally { setBusy(false); }
  };
  const left = job.items.filter((it) => it.delivered_qty < it.qty);
  return (
    <Modal title="Material arrived: deliver and invoice" onClose={result ? onDone : onClose}>
      {!result ? (
        <div className="form">
          <p>This will <b>issue a delivery challan</b> for what's left to deliver and <b>issue the invoice</b> for it:</p>
          <ul className="small">{left.map((it) => <li key={it.id}>{it.name}: {num(it.qty - it.delivered_qty)} {it.unit}</li>)}</ul>
          {canEmail ? <>
            <label className="check"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email both PDFs to the customer</label>
            {email && <Field label="Customer email" hint={customer.data && !customer.data.email ? "No email saved on this customer. Type one (it isn't saved)." : null}><input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="accounts@customer.com" /></Field>}
          </> : <p className="muted small">Email isn't set up on the server yet, so the documents won't be emailed. You can print or WhatsApp them.</p>}
          <div className="form-actions"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || (canEmail && email && !to)} onClick={go}>{busy ? "Working…" : "Issue DC + invoice"}</button></div>
        </div>
      ) : result.error ? (
        <div className="form"><div className="form-error">{result.error}</div><div className="form-actions"><button className="btn" onClick={onClose}>Close</button></div></div>
      ) : (
        <div className="form">
          <p className="pos">✓ Delivery challan issued: <Link to={`/delivery-challans/${result.dc_id}`}>open it</Link></p>
          {result.invoice_status === "open" ? <p className="pos">✓ Invoice issued: <Link to={`/invoices/${result.invoice_id}`}>open it</Link></p>
            : <p className="neg">Invoice saved as draft: {result.invoice_note} <Link to={`/invoices/${result.invoice_id}`}>open it</Link>. The directors have been asked to approve it.</p>}
          {result.email && (result.email.ok ? <p className="pos">✓ Emailed to {result.email.to}</p> : <p className="neg">Email failed: {result.email.error}</p>)}
          <div className="form-actions"><button className="btn primary" onClick={onDone}>Done</button></div>
        </div>
      )}
    </Modal>
  );
}

function DocList({ docs }) {
  return (
    <table className="table compact"><tbody>
      {docs.map((d) => (
        <tr key={d.id}>
          <td>{KIND[d.kind].label}</td><td><Link to={`/${KIND[d.kind].path}/${d.id}`}>{d.number}</Link></td><td className="muted">{d.contact_name}</td>
          <td><Badge status={d.status} />{d.verified_at && <span className="badge green sm">verified</span>}{d.submitted_date && <span className="badge blue sm">submitted</span>}</td>
          <td className="r">{d.kind !== "dc" ? money(d.total) : d.signed_by_name || ""}</td>
        </tr>
      ))}
    </tbody></table>
  );
}
