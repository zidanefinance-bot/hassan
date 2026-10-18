// Internal Jobs: Sales creates, Operations fulfils, Sales delivers and invoices. One screen, shaped by role.
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, Badge, Field, fmtDate, KIND, label, Loading, Modal, money, num, OPS_STEPS, PageHead, Search, today, useAuth, useLoad, useToast } from "../lib.jsx";
import { ContactForm } from "./Contacts.jsx";
import { ItemForm } from "./Items.jsx";
import Attachments from "../components/Attachments.jsx";
import Comments from "../components/Comments.jsx";

const PRIORITY_TONE = { urgent: "red", high: "amber", normal: "grey", low: "grey" };

export default function Jobs() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("active");
  const { can } = useAuth();
  const state = useLoad(`/jobs?q=${encodeURIComponent(q)}&scope=${scope === "active" ? "active" : ""}`);
  const nav = useNavigate();
  return (
    <>
      <PageHead title="Jobs" sub="Every confirmed customer order becomes a Job. Sales creates it, Operations fulfils it.">
        <Search value={q} onChange={setQ} placeholder="Search job or customer…" />
        {can("sales.write") && <Link className="btn primary" to="/jobs/new">+ New Job</Link>}
      </PageHead>
      <div className="tabs">{["active", "all"].map((s) => <button key={s} className={scope === s ? "active" : ""} onClick={() => setScope(s)}>{s}</button>)}</div>
      <Loading state={state}>{(rows) => rows.length === 0 ? <div className="empty">No Jobs yet.</div> : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Job</th><th>Customer</th><th>Needed by</th><th>Priority</th><th>Fulfilment</th><th className="r">Items</th>{can("sales.read") && <th>Customer side</th>}</tr></thead>
          <tbody>{rows.map((j) => (
            <tr key={j.id} className="click" onClick={() => nav(`/jobs/${j.id}`)}>
              <td><b>{j.number}</b>{j.fulfilment_type === "direct" && <span className="badge blue sm">direct</span>}{j.closed ? <span className="badge grey sm">closed</span> : null}</td>
              <td>{j.customer_name}</td>
              <td className={j.required_date && j.required_date < today() && OPS_STEPS.indexOf(j.ops_status) < 4 ? "neg" : ""}>{fmtDate(j.required_date)}</td>
              <td><span className={`badge ${PRIORITY_TONE[j.priority]}`}>{j.priority}</span></td>
              <td><Badge status={j.ops_status} /></td>
              <td className="r">{j.item_count}{j.to_buy_count > 0 && <span className="muted small"> · {j.to_buy_count} to buy</span>}</td>
              {can("sales.read") && <td className="small">{j.invoice_count ? "Invoiced" : j.signed_dc_count ? "Signed DC" : j.dc_count ? "DC issued" : "—"}</td>}
            </tr>
          ))}</tbody>
        </table></div>
      )}</Loading>
    </>
  );
}

const blank = () => ({ key: Math.random(), item_id: "", description: "", qty: 1, sale_rate: 0, tax_rate: 0 });

export function JobForm() {
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const customers = useLoad("/contacts?type=customer");
  const items = useLoad("/items");
  const settings = useLoad("/settings");
  const [f, setF] = useState({ customer_id: params.get("customer") || "", order_source: "call", customer_po_number: "", customer_po_date: "", required_date: "", delivery_location: "", priority: "normal", fulfilment_type: "stock", instructions: "", items: [blank()] });
  const [adding, setAdding] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [err, setErr] = useState("");
  // a customer PO read by AI in the orders inbox (?inbox=ID)
  const inboxId = params.get("inbox");
  const [aiFilled, setAiFilled] = useState(false);
  useEffect(() => {
    if (!inboxId || !items.data) return;
    api(`/inbox/${inboxId}`).then((m) => {
      const x = m.extraction;
      if (!x) return;
      setF((s) => ({
        ...s, customer_id: x.party_match_id ? String(x.party_match_id) : s.customer_id, order_source: m.source === "email" ? (x.reference ? "formal PO" : "email") : m.source === "paste" ? "whatsapp" : x.reference ? "formal PO" : s.order_source,
        customer_po_number: x.reference || "", customer_po_date: x.date || "", required_date: x.required_date || "", delivery_location: x.delivery_location || "",
        instructions: [!x.party_match_id && x.party_name ? `Customer on paper: ${x.party_name}` : null, x.notes].filter(Boolean).join("\n"),
        items: x.lines.length ? x.lines.map((l) => {
          const it = items.data.find((i) => i.id === l.item_match_id);
          return { ...blank(), item_id: it ? it.id : "", description: it ? "" : [l.description, l.unit].filter(Boolean).join(" · "), qty: l.qty, sale_rate: l.rate ?? it?.sale_rate ?? 0, tax_rate: l.tax_rate ?? it?.tax_rate ?? 0, ai: l.match_confidence, ai_text: l.description };
        }) : s.items,
      }));
      setAiFilled(true);
    }).catch(() => {});
  }, [inboxId, items.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  const setItem = (i, patch) => setF((s) => ({ ...s, items: s.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const save = async () => {
    setErr("");
    try {
      const r = await api("/jobs", { method: "POST", body: { ...f, items: f.items.map(({ key, ai, ai_text, ...x }) => ({ ...x, item_id: x.item_id || null })) } });
      if (inboxId) await api(`/inbox/${inboxId}/status`, { method: "POST", body: { status: "done", result_kind: "job", result_id: r.id } }).catch(() => {});
      toast("Job created and sent to Operations");
      nav(`/jobs/${r.id}`);
    } catch (x) { setErr(x.message); }
  };
  return (
    <>
      <PageHead title="New Job" sub="For a confirmed order. Customer PO is optional; Operations gets only what it needs to fulfil." />
      {aiFilled && <div className="ai-banner">✨ Filled by AI from the customer's PO. Lines marked <span className="ai-flag">check</span> weren't matched to an item for sure. Fix them, then create the Job.</div>}
      <div className="card form">
        <div className="row-4">
          <Field label="Customer *"><div className="with-btn"><select {...set("customer_id")}><option value="">Select…</option>{(customers.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" className="btn sm" onClick={() => setAdding(true)}>+</button></div></Field>
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
                {l.ai && l.ai !== "high" && <small className="ai-flag" title="What the paper said">check: “{l.ai_text}”</small>}
                <select value={l.item_id} onChange={(e) => { const it = items.data?.find((x) => String(x.id) === e.target.value); setItem(i, it ? { item_id: it.id, sale_rate: it.sale_rate ?? 0, tax_rate: it.tax_rate } : { item_id: "" }); }}>
                  <option value="">— item not in list —</option>{(items.data || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
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
          <button type="button" className="btn ghost" onClick={() => setAddingItem(true)}>+ New item (not in list)</button></div>
        <Field label="Instructions for Operations"><textarea rows={2} {...set("instructions")} placeholder="Packing, delivery timing, gate pass…" /></Field>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button className="btn ghost" onClick={() => nav(-1)}>Cancel</button><button className="btn primary" onClick={save}>Create Job</button></div>
      </div>
      {addingItem && <ItemForm onClose={() => setAddingItem(false)} onSaved={async (newId) => {
        setAddingItem(false);
        const it = await api(`/items/${newId}`);
        items.reload();
        setF((s) => {
          const empty = s.items.findIndex((x) => !x.item_id && !x.description);
          const line = { ...blank(), item_id: it.id, sale_rate: it.sale_rate ?? 0, tax_rate: it.tax_rate };
          return { ...s, items: empty < 0 ? [...s.items, line] : s.items.map((x, j) => (j === empty ? line : x)) };
        });
      }} />}
      {adding && <ContactForm type="customer" onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); customers.reload(); setF((s) => ({ ...s, customer_id: String(id) })); }} />}
    </>
  );
}

function JobCost({ job, settings, onClose, onSaved }) {
  const [e, setE] = useState({ category: settings?.jobExpenseCategories?.[0] || "Freight", amount: "", date: today(), paid_through: "cash", notes: "" });
  const [err, setErr] = useState("");
  const b = (k) => ({ value: e[k], onChange: (x) => setE({ ...e, [k]: x.target.value }) });
  return (
    <Modal title={`Add direct cost · ${job.number}`} onClose={onClose}>
      <form className="form" onSubmit={async (x) => { x.preventDefault(); try { await api("/expenses", { method: "POST", body: { ...e, job_id: job.id } }); onSaved(); } catch (y) { setErr(y.message); } }}>
        <div className="row-2"><Field label="Type"><select {...b("category")}>{(settings?.jobExpenseCategories || ["Freight"]).map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Amount (Rs)"><input type="number" step="0.01" {...b("amount")} required autoFocus /></Field></div>
        <div className="row-2"><Field label="Date"><input type="date" {...b("date")} /></Field><Field label="Paid by"><select {...b("paid_through")}><option value="cash">Cash</option><option value="bank">Bank</option><option value="online">Online / wallet</option></select></Field></div>
        <Field label="Notes"><input {...b("notes")} placeholder="Vehicle #, labour count…" /></Field>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
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
  const act = async (fn, msg) => { try { const r = await fn(); if (msg) toast(msg); state.reload(); return r; } catch (x) { toast(x.message, "err"); } };
  return (
    <Loading state={state}>{(j) => {
      const step = OPS_STEPS.indexOf(j.ops_status);
      const nextOps = { new: "procurement_started", procurement_started: null, partially_purchased: null, purchase_complete: "material_ready", material_ready: "dispatched", dispatched: "delivered" }[j.ops_status];
      const docsOf = (k) => j.documents.filter((d) => d.kind === k);
      return (
        <>
          <PageHead title={<>{j.number} <Badge status={j.ops_status} /></>} sub={`${j.customer_name}${j.customer_po_number ? ` · PO ${j.customer_po_number}` : ""} · created by ${j.created_by_name || "—"}`}>
            {can("ops.write") && j.ops_status === "new" && <button className="btn primary" onClick={() => act(() => api(`/jobs/${id}/ops-status`, { method: "POST", body: { status: "procurement_started" } }), "Procurement started")}>Start procurement</button>}
            {can("ops.write") && step >= 1 && step < 4 && <button className="btn primary" onClick={() => act(() => api(`/jobs/${id}/ops-status`, { method: "POST", body: { status: "material_ready" } }), "Sales has been told material is ready")}>Mark material ready</button>}
            {can("ops.write") && nextOps && step >= 4 && <button className="btn" onClick={() => act(() => api(`/jobs/${id}/ops-status`, { method: "POST", body: { status: nextOps } }), `Marked ${label(nextOps)}`)}>Mark {label(nextOps)}</button>}
            {can("buy") && <Link className="btn" to={`/bills/new?job=${id}`}>+ Supplier bill</Link>}
            {can("buy") && <button className="btn" onClick={() => setCost(true)}>+ Freight / direct cost</button>}
            {can("sales.write") && step >= 4 && j.items.some((it) => it.delivered_qty < it.qty) && <button className="btn primary" onClick={() => setDeliver(true)}>Material arrived → DC + invoice</button>}
            {can("sales.write") && <button className={`btn ${step >= 4 ? "" : "primary"}`} onClick={async () => { const r = await act(() => api(`/jobs/${id}/dc`, { method: "POST" }), "Draft DC created"); if (r) nav(`/delivery-challans/${r.id}`); }}>Create DC</button>}
            {can("sales.write") && <button className="btn" onClick={async () => { const r = await act(() => api(`/jobs/${id}/invoice`, { method: "POST" }), "Draft invoice created"); if (r) nav(`/invoices/${r.id}`); }}>Create invoice</button>}
            {can("admin") && <button className="btn ghost" onClick={() => act(() => api(`/jobs/${id}/close`, { method: "POST", body: { closed: !j.closed } }), j.closed ? "Job reopened" : "Job closed")}>{j.closed ? "Reopen" : "Close job"}</button>}
          </PageHead>

          <div className="steps">{OPS_STEPS.map((s, i) => <div key={s} className={`step ${i <= step ? "done" : ""} ${i === step ? "now" : ""}`}><i />{label(s)}</div>)}</div>

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
                {j.economics.cost_pending && <p className="neg small">Purchase cost pending: no supplier bill on this Job yet.</p>}
              </section>
            ) : (
              <section className="card"><h3>Documents</h3>{j.documents.length === 0 ? <p className="muted">None yet.</p> : <DocList docs={j.documents} />}</section>
            )}
          </div>

          <section className="card flush">
            <h3 className="pad">Items</h3>
            <table className="table">
              <thead><tr><th>Item</th><th className="r">Qty</th>{can("price.view") && <th className="r">Selling rate</th>}{can("cost.view") && <th className="r">Last cost</th>}<th>Procurement</th><th className="r">Bought</th>{can("sales.read") && <th className="r">Delivered</th>}{can("sales.read") && <th className="r">Invoiced</th>}</tr></thead>
              <tbody>{j.items.map((it) => (
                <tr key={it.id}>
                  <td><b>{it.name}</b>{it.stock_qty !== null && it.stock_qty !== undefined && can("ops.read") && <div className="muted small">In stock: {num(it.stock_qty)} {it.unit}</div>}</td>
                  <td className="r">{num(it.qty)} {it.unit}</td>
                  {can("price.view") && <td className="r">{it.sale_rate ? money(it.sale_rate) : <span className="neg">rate pending</span>}</td>}
                  {can("cost.view") && <td className="r">{it.purchase_rate ? money(it.purchase_rate) : "—"}</td>}
                  <td>
                    {can("buy") ? (
                      <select className="inline" value={it.procurement_status} onChange={(e) => act(() => api(`/job-items/${it.id}/procurement`, { method: "POST", body: { status: e.target.value } }), "Updated")}>
                        {["to_buy", "partial", "bought", "not_available", "from_stock"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                      </select>
                    ) : <Badge status={it.procurement_status === "to_buy" ? "open" : it.procurement_status === "bought" || it.procurement_status === "from_stock" ? "paid" : it.procurement_status === "not_available" ? "overdue" : "partial"} />}
                  </td>
                  <td className="r">{num(it.purchased_qty)}</td>
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
                <tbody>{j.expenses.map((e) => <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{e.category}</td><td>{e.paid_through}</td><td className="muted">{e.notes}</td><td className="r">{money(e.amount)}</td></tr>)}</tbody></table>
            </section>
          )}
          <Attachments entity="job" id={j.id} labels={["Customer PO", "Delivery photo", "Supplier quotation", "Other evidence"]} />
          <Comments entity="job" id={j.id} />
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
