import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { addDays, api, Field, KIND, money, PageHead, today, useLoad, useToast } from "../lib.jsx";
import { ContactForm } from "./Contacts.jsx";
import { ItemForm } from "./Items.jsx";

const ISSUE_STATUS = { quote: "sent", invoice: "open", po: "issued", bill: "open", dc: "issued" };
const blankLine = () => ({ key: Math.random(), item_id: "", description: "", qty: 1, rate: 0, discount_pct: 0, tax_rate: 0 });

export default function DocumentForm({ kind }) {
  const K = KIND[kind];
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const isSale = K.contact === "customer";
  const isDc = kind === "dc";
  const isPurchase = ["po", "bill"].includes(kind);
  const jobs = useLoad(isPurchase ? "/jobs?scope=active" : null);
  const contacts = useLoad(`/contacts?type=${K.contact}`);
  const items = useLoad("/items");
  const settings = useLoad("/settings");
  const existing = useLoad(id ? `/documents/${id}` : null);
  const [doc, setDoc] = useState(null);
  const [addingContact, setAddingContact] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id && existing.data) setDoc({ ...existing.data, lines: existing.data.lines.map((l) => ({ ...l, key: l.id, item_id: l.item_id || "" })) });
    if (!id && settings.data && !doc) {
      const d = today();
      setDoc({ contact_id: params.get("contact") || "", job_id: params.get("job") || "", date: d, due_date: ["invoice", "bill"].includes(kind) ? addDays(d, settings.data.paymentTermsDays || 0) : "", reference: "", notes: "", terms: "", lines: [blankLine()] });
    }
  }, [id, existing.data, settings.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    let sub = 0, disc = 0, tax = 0;
    for (const l of doc?.lines || []) {
      const g = (Number(l.qty) || 0) * (Number(l.rate) || 0), d = g * ((Number(l.discount_pct) || 0) / 100);
      sub += g; disc += d; tax += (g - d) * ((Number(l.tax_rate) || 0) / 100);
    }
    return { sub, disc, tax, total: sub - disc + tax };
  }, [doc]);

  // purchases for a Job: pull in the Job's items (if the lines are still empty) so Operations only fills supplier, rates and bill #
  useEffect(() => {
    if (!isPurchase || !doc?.job_id) return;
    api(`/jobs/${doc.job_id}`).then((j) => setDoc((d) => (d.lines.every((l) => !l.item_id && !l.description)
      ? { ...d, lines: j.items.filter((it) => it.procurement_status !== "from_stock").map((it) => ({ ...blankLine(), item_id: it.item_id || "", description: it.item_id ? "" : it.name, qty: it.qty, rate: it.purchase_rate || 0 })) }
      : d))).catch(() => {});
  }, [doc?.job_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) return <div className="empty">Loading…</div>;
  const set = (k, v) => setDoc((d) => ({ ...d, [k]: v }));
  const setLine = (i, patch) => setDoc((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const pickItem = (i, itemId, list = items.data) => {
    const it = list?.find((x) => String(x.id) === String(itemId));
    setLine(i, it ? { item_id: it.id, rate: (isSale ? it.sale_rate : it.purchase_rate) ?? 0, tax_rate: it.tax_rate, description: "", hint: null } : { item_id: "", hint: null });
    // what we last charged this customer / paid this supplier for it
    if (it && doc.contact_id && !isDc) {
      api(`/items/last-rate?item_id=${it.id}&contact_id=${doc.contact_id}&side=${isSale ? "sale" : "purchase"}`)
        .then((r) => r && setDoc((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i && String(l.item_id) === String(it.id) ? { ...l, hint: r } : l)) }))).catch(() => {});
    }
  };
  const save = async (issue, asEnquiry = false) => {
    setErr("");
    const lines = doc.lines.filter((l) => l.item_id || l.description).map(({ key, item_name, unit, id: _id, document_id, amount, cost_rate, hint, ...l }) => ({ ...l, item_id: l.item_id || null }));
    if (!doc.contact_id) return setErr(`Choose a ${K.contact}`);
    if (lines.length === 0) return setErr("Add at least one item");
    const status = asEnquiry ? "enquiry" : issue ? ISSUE_STATUS[kind] : id ? doc.status : "draft";
    const body = { kind, contact_id: Number(doc.contact_id), date: doc.date, due_date: doc.due_date || null, reference: doc.reference, notes: doc.notes, terms: doc.terms, status, lines, ...(isPurchase ? { job_id: doc.job_id ? Number(doc.job_id) : null } : {}) };
    setBusy(true);
    try {
      const r = id ? await api(`/documents/${id}`, { method: "PUT", body }) : await api("/documents", { method: "POST", body });
      toast(`${K.label} saved`);
      nav(`/${K.path}/${r.id}`);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  const taxes = settings.data?.taxes || [];
  return (
    <>
      <PageHead title={id ? `Edit ${doc.number}` : params.get("enquiry") ? "New Enquiry" : `New ${K.label}`} sub={kind === "quote" && !id ? "Write down what the customer asked for. Rates can be added later." : null} />
      <div className="card form doc-form">
        <div className="row-4">
          <Field label={`${K.contact === "customer" ? "Customer" : "Supplier"} *`}>
            <div className="with-btn">
              <select value={doc.contact_id} onChange={(e) => set("contact_id", e.target.value)}>
                <option value="">Select…</option>
                {(contacts.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" className="btn sm" onClick={() => setAddingContact(true)}>+</button>
            </div>
          </Field>
          <Field label="Date"><input type="date" value={doc.date} onChange={(e) => set("date", e.target.value)} /></Field>
          {["invoice", "bill"].includes(kind) && <Field label="Due date"><input type="date" value={doc.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></Field>}
          <Field label={kind === "bill" ? "Supplier bill #" : "Reference"}><input value={doc.reference || ""} onChange={(e) => set("reference", e.target.value)} /></Field>
        </div>
        {isPurchase && (
          <div className="row-4">
            <Field label="For Job (optional)" hint="Links the cost to the Job. Leave empty for general stock.">
              <select value={doc.job_id || ""} onChange={(e) => set("job_id", e.target.value)}>
                <option value="">— general stock —</option>{(jobs.data || []).map((j) => <option key={j.id} value={j.id}>{j.number} · {j.customer_name}</option>)}
              </select>
            </Field>
          </div>
        )}

        <div className="lines">
          <table className="table lines-table">
            <thead><tr><th style={{ width: isDc ? "70%" : "34%" }}>Item</th><th>Qty</th>{!isDc && <><th>Rate (Rs)</th><th>Disc %</th><th>Tax</th><th className="r">Amount</th></>}<th /></tr></thead>
            <tbody>{doc.lines.map((l, i) => {
              const amt = (Number(l.qty) || 0) * (Number(l.rate) || 0) * (1 - (Number(l.discount_pct) || 0) / 100);
              const it = items.data?.find((x) => String(x.id) === String(l.item_id));
              return (
                <tr key={l.key}>
                  <td>
                    <select value={l.item_id} onChange={(e) => pickItem(i, e.target.value)}>
                      <option value="">— custom line —</option>
                      {(items.data || []).map((x) => <option key={x.id} value={x.id}>{x.name}{x.track_stock ? ` (${x.stock_qty} ${x.unit})` : ""}</option>)}
                    </select>
                    {!l.item_id && <input className="mt" placeholder="Description" value={l.description || ""} onChange={(e) => setLine(i, { description: e.target.value })} />}
                    {it && isSale && it.track_stock && Number(l.qty) > it.stock_qty && <small className="neg">Only {it.stock_qty} in stock</small>}
                  </td>
                  <td><input type="number" step="0.01" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                  {!isDc && <>
                    <td><input type="number" step="0.01" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} />
                      {l.hint && <button type="button" className="rate-hint" title={`${l.hint.number} · ${l.hint.date}`} onClick={() => setLine(i, { rate: l.hint.rate })}>Last: {money(l.hint.rate)}</button>}</td>
                    <td><input type="number" step="0.01" value={l.discount_pct} onChange={(e) => setLine(i, { discount_pct: e.target.value })} /></td>
                    <td><select value={l.tax_rate} onChange={(e) => setLine(i, { tax_rate: e.target.value })}>{taxes.map((t) => <option key={t.name} value={t.rate}>{t.rate}%</option>)}</select></td>
                    <td className="r">{money(amt)}</td>
                  </>}
                  <td><button type="button" className="icon-btn" aria-label="Remove line" onClick={() => setDoc((d) => ({ ...d, lines: d.lines.length > 1 ? d.lines.filter((_, j) => j !== i) : [blankLine()] }))}>×</button></td>
                </tr>
              );
            })}</tbody>
          </table>
          <button type="button" className="btn ghost" onClick={() => setDoc((d) => ({ ...d, lines: [...d.lines, blankLine()] }))}>+ Add line</button>
          <button type="button" className="btn ghost" onClick={() => setAddingItem(true)}>+ New item (not in list)</button>
        </div>

        <div className="doc-bottom">
          <div className="notes">
            <Field label="Notes (shown on the document)"><textarea rows={3} value={doc.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
            <Field label="Terms"><textarea rows={2} value={doc.terms || ""} onChange={(e) => set("terms", e.target.value)} placeholder="e.g. Payment within 15 days. Delivery Karachi." /></Field>
          </div>
          {!isDc && <dl className="totals">
            <dt>Subtotal</dt><dd>{money(totals.sub)}</dd>
            {totals.disc > 0 && <><dt>Discount</dt><dd>− {money(totals.disc)}</dd></>}
            <dt>Tax</dt><dd>{money(totals.tax)}</dd>
            <dt className="grand">Total</dt><dd className="grand">{money(totals.total)}</dd>
          </dl>}
        </div>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions">
          <button className="btn ghost" onClick={() => nav(-1)}>Cancel</button>
          {kind === "quote" && (!id || doc.status === "enquiry") && <button className="btn" disabled={busy} onClick={() => save(false, true)}>Save as enquiry (rates pending)</button>}
          {(!id || doc.status === "draft") && <button className="btn" disabled={busy} onClick={() => save(false)}>Save as draft</button>}
          <button className="btn primary" disabled={busy} onClick={() => save(!id || ["draft", "enquiry"].includes(doc.status))}>{id && !["draft", "enquiry"].includes(doc.status) ? "Save" : kind === "quote" ? "Save & mark sent" : kind === "dc" ? "Save & issue DC" : kind === "po" ? "Save & issue" : `Save & ${kind === "invoice" ? "issue" : "record"}`}</button>
        </div>
      </div>
      {addingItem && <ItemForm onClose={() => setAddingItem(false)} onSaved={async (newId) => {
        setAddingItem(false);
        const list = await api("/items");
        items.reload();
        const empty = doc.lines.findIndex((l) => !l.item_id && !l.description);
        if (empty < 0) setDoc((d) => ({ ...d, lines: [...d.lines, blankLine()] }));
        const at = empty < 0 ? doc.lines.length : empty;
        setTimeout(() => pickItem(at, newId, list), 0);
      }} />}
      {addingContact && <ContactForm type={K.contact} onClose={() => setAddingContact(false)} onSaved={(cid) => { setAddingContact(false); contacts.reload(); set("contact_id", String(cid)); }} />}
    </>
  );
}
