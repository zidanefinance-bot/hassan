import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { addDays, api, Field, KIND, money, num, PageHead, today, useAuth, useLoad, useToast } from "../lib.jsx";
import Picker from "../components/Picker.jsx";
import { cleanLine, guessCategory, learnedLines, missingLines, partyPreset, unitOf } from "../components/draftLines.js";
import NewItems from "../components/NewItems.jsx";
import { ContactForm } from "./Contacts.jsx";
import { ItemForm } from "./Items.jsx";
import { readFiles } from "./Inbox.jsx";

const ISSUE_STATUS = { quote: "sent", invoice: "open", po: "issued", bill: "open", dc: "issued", credit_note: "open", vendor_credit: "open" };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const CONTACT_WRITE = { customer: ["sales.write"], supplier: ["ops.write", "buy"] };
const canAddContact = (can, type) => CONTACT_WRITE[type].some(can);
export const contactOptions = (list) => (list || []).map((c) => ({ id: c.id, label: c.name, sub: [c.company, c.phone].filter(Boolean).join(" · "), search: `${c.company || ""} ${c.phone || ""}` }));
export const itemOptions = (list) => (list || []).map((x) => ({ id: x.id, label: x.name, sub: [x.sku, x.track_stock ? `${num(x.stock_qty)} ${x.unit} in stock` : x.unit].filter(Boolean).join(" · "), search: `${x.sku || ""} ${x.category || ""}` }));
const blankLine = () => ({ key: Math.random(), item_id: "", description: "", qty: 1, rate: 0, discount_pct: 0, tax_rate: 0 });

export default function DocumentForm({ kind }) {
  const K = KIND[kind];
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const isSale = K.contact === "customer";
  const isDc = kind === "dc";
  const isPurchase = ["po", "bill"].includes(kind);
  const isCredit = ["credit_note", "vendor_credit"].includes(kind);
  const jobs = useLoad(isPurchase ? "/jobs?scope=active" : null);
  const contacts = useLoad(`/contacts?type=${K.contact}`);
  const items = useLoad("/items");
  const settings = useLoad("/settings");
  const existing = useLoad(id ? `/documents/${id}` : null);
  const [doc, setDoc] = useState(null);
  const [addingContact, setAddingContact] = useState(null); // null, or the name typed in the picker
  const [addingItem, setAddingItem] = useState(null); // null, or { line, name, preset }
  const [aiParty, setAiParty] = useState(null); // customer/supplier named on the paper that isn't in our contacts yet
  const [newItems, setNewItems] = useState(false);
  const [partyInfo, setPartyInfo] = useState({}); // what the paper says about them (buyer, terms, NTN)
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // AI draft: from the orders inbox (?inbox=ID) or a bill photo read on this page
  const [inboxId, setInboxId] = useState(params.get("inbox"));
  const [draft, setDraft] = useState(null);
  const [reading, setReading] = useState(false);
  const photo = useRef(null);

  useEffect(() => {
    if (id && existing.data) setDoc({ ...existing.data, lines: existing.data.lines.map((l) => ({ ...l, key: l.id, item_id: l.item_id || "" })) });
    if (!id && settings.data && !doc) {
      const d = today();
      setDoc({ contact_id: params.get("contact") || "", job_id: params.get("job") || "", date: d, due_date: ["invoice", "bill"].includes(kind) ? addDays(d, settings.data.paymentTermsDays || 0) : "", reference: "", notes: "", terms: "",
        doc_discount: 0, charges: 0, charges_label: "", adjustment: 0, return_stock: 1, lines: [blankLine()] });
      // credit note from an invoice / vendor credit from a bill: start from its contact and lines
      const from = params.get("from");
      if (inboxId) api(`/inbox/${inboxId}`).then((m) => m.extraction && setDraft({ ...m.extraction, from: m.from_addr || (m.source === "email" ? "email" : "upload") })).catch(() => {});
      if (from) api(`/documents/${from}`).then((src) => setDoc((x) => ({ ...x, contact_id: String(src.contact_id), reference: src.number,
        lines: src.lines.map((l) => ({ ...blankLine(), item_id: l.item_id || "", description: l.item_id ? "" : l.description, qty: l.qty, rate: l.rate, discount_pct: l.discount_pct, tax_rate: l.tax_rate })) }))).catch(() => {});
    }
  }, [id, existing.data, settings.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    let sub = 0, disc = 0, tax = 0;
    for (const l of doc?.lines || []) {
      const g = (Number(l.qty) || 0) * (Number(l.rate) || 0), d = g * ((Number(l.discount_pct) || 0) / 100);
      sub += g; disc += d; tax += (g - d) * ((Number(l.tax_rate) || 0) / 100);
    }
    const lineTotal = sub - disc + tax;
    return { sub, disc, tax, lineTotal, total: lineTotal - (Number(doc?.doc_discount) || 0) + (Number(doc?.charges) || 0) + (Number(doc?.adjustment) || 0) };
  }, [doc]);

  // put an AI draft into the form once items are loaded (a missing rate falls back to the item's rate)
  useEffect(() => {
    if (!draft || !doc || !items.data) return;
    const x = draft;
    setAiParty(!x.party_match_id && x.party_name ? x.party_name : null);
    setPartyInfo(partyPreset(x));
    const termsDue = x.payment_terms_days != null && ["invoice", "bill"].includes(kind) ? addDays(x.date || today(), x.payment_terms_days) : null;
    setDoc((d) => ({
      ...d,
      contact_id: x.party_match_id ? String(x.party_match_id) : d.contact_id,
      date: x.date || d.date,
      due_date: kind === "bill" && x.required_date ? x.required_date : termsDue || d.due_date,
      reference: x.reference || (x.their_refs?.length ? `Your PR ${x.their_refs.join(", ")}` : d.reference),
      terms: x.payment_terms ? `Payment terms: ${x.payment_terms}` : d.terms,
      notes: [d.notes, !x.party_match_id && x.party_name ? `${isSale ? "Customer" : "Supplier"} on paper: ${x.party_name}` : null, kind !== "bill" && x.required_date ? `Needed by ${x.required_date}` : null, x.buyer_name ? `${isSale ? "Buyer" : "Contact"}: ${[x.buyer_name, x.contact_phone].filter(Boolean).join(", ")}` : null, x.delivery_location ? `Deliver to: ${x.delivery_location}` : null, x.notes].filter(Boolean).join("\n"),
      lines: x.lines.length ? x.lines.map((l) => {
        const it = items.data.find((i) => i.id === l.item_match_id);
        return { ...blankLine(), item_id: it ? it.id : "", description: it ? "" : [l.description, l.unit].filter(Boolean).join(" · "), qty: l.qty,
          rate: l.rate ?? (it ? (isSale ? it.sale_rate : it.purchase_rate) ?? 0 : 0), tax_rate: l.tax_rate ?? it?.tax_rate ?? 0, ai: l.match_confidence, ai_text: l.description, ai_unit: l.unit, ai_rate: l.rate };
      }) : d.lines,
    }));
    setDraft(null);
  }, [draft, items.data, doc === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const readPhoto = async (files) => {
    setReading(true); setErr("");
    try {
      const m = await api("/inbox", { method: "POST", body: { files: await readFiles(files), wait: true } });
      if (m.status === "error") throw new Error(m.error || "Couldn't read it");
      if (!m.extraction || m.extraction.doc_type !== "supplier_bill") throw new Error("That doesn't look like a supplier bill. Try a clearer photo.");
      setInboxId(String(m.id));
      setDraft({ ...m.extraction, from: "photo" });
      toast("Bill read. Check the lines, then save.");
    } catch (x) { setErr(x.message); } finally { setReading(false); if (photo.current) photo.current.value = ""; }
  };

  const withBlank = (lines) => (lines.length ? lines : [blankLine()]);
  // purchases for a Job: pull in the Job's items (if the lines are still empty) so Operations only fills supplier, rates and bill #
  useEffect(() => {
    if (!isPurchase || !doc?.job_id) return;
    api(`/jobs/${doc.job_id}`).then((j) => setDoc((d) => (d.lines.every((l) => !l.item_id && !l.description)
      // only what earlier bills for this Job haven't covered yet
      ? { ...d, lines: withBlank(jobLines(j)) }
      : d))).catch(() => {});
  }, [doc?.job_id]); // eslint-disable-line react-hooks/exhaustive-deps
  // what a Job still needs bought, as bill lines (for another Job than the bill's, the line carries that Job)
  const jobLines = (j, lineJob = "") => j.items.filter((it) => it.procurement_status !== "from_stock" && it.qty - (it.purchased_qty || 0) > 0.001)
    .map((it) => ({ ...blankLine(), item_id: it.item_id || "", description: it.item_id ? "" : it.name, qty: Math.round((it.qty - (it.purchased_qty || 0)) * 1000) / 1000, rate: it.purchase_rate || 0, job_id: lineJob }));
  // a bill bought together for several Jobs: split each line over the Jobs that still need that item (oldest first);
  // what's left over stays for stock. A line already given a Job is left alone.
  const matchToJobs = async () => {
    const needs = await api(`/procurement/needs${id ? `?exclude=${id}` : ""}`);
    const left = needs.map((n) => ({ ...n }));
    let split = 0;
    const out = [];
    for (const l of doc.lines) {
      if (!l.item_id || l.job_id || !(Number(l.qty) > 0)) { out.push(l); continue; }
      let qty = Number(l.qty);
      for (const n of left.filter((x) => String(x.item_id) === String(l.item_id) && x.left > 0)) {
        if (qty <= 0) break;
        const take = Math.min(qty, n.left);
        n.left -= take; qty -= take; split++;
        out.push({ ...l, key: Math.random(), qty: Math.round(take * 1000) / 1000, job_id: String(n.job_id) });
      }
      if (qty > 0.0005) out.push({ ...l, key: Math.random(), qty: Math.round(qty * 1000) / 1000, job_id: "" });
    }
    if (!split) return toast("No open Job needs these items", "err");
    // each line now names its Job, so the bill itself is "general stock" and anything left over is stock
    setDoc((d) => ({ ...d, job_id: "", lines: out }));
    toast("Lines matched to Jobs. Check them, then save.");
  };
  // one bill for several Jobs (e.g. bearings for two POs bought together): bring in another Job's items
  const addJobItems = async (jobId) => {
    if (!jobId) return;
    const j = await api(`/jobs/${jobId}`);
    const own = String(jobId) === String(doc.job_id) ? "" : String(jobId);
    const add = jobLines(j, own);
    if (!add.length) return toast(`Nothing left to buy for ${j.number}`, "err");
    setDoc((d) => ({ ...d, lines: [...d.lines.filter((l) => l.item_id || l.description), ...add] }));
    toast(`${add.length} line(s) for ${j.number} added`);
  };

  if (!doc) return <div className="empty">Loading…</div>;
  const set = (k, v) => setDoc((d) => ({ ...d, [k]: v }));
  const setLine = (i, patch) => setDoc((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const pickItem = (i, itemId, list = items.data) => {
    const it = list?.find((x) => String(x.id) === String(itemId));
    setLine(i, it ? { item_id: it.id, rate: doc.lines[i]?.ai_rate ?? (isSale ? it.sale_rate : it.purchase_rate) ?? 0, tax_rate: it.tax_rate, description: "", hint: null, ai: null } : { item_id: "", hint: null });
    // what we last charged this customer / paid this supplier for it
    if (it && doc.contact_id && !isDc) {
      api(`/items/last-rate?item_id=${it.id}&contact_id=${doc.contact_id}&side=${isSale ? "sale" : "purchase"}`)
        .then((r) => r && setDoc((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i && String(l.item_id) === String(it.id) ? { ...l, hint: r } : l)) }))).catch(() => {});
    }
  };
  const save = async (issue, asEnquiry = false) => {
    setErr("");
    const lines = doc.lines.filter((l) => l.item_id || l.description).map(({ key, item_name, unit, id: _id, document_id, amount, cost_rate, hint, job_number, ...l }) => ({ ...cleanLine(l), item_id: l.item_id || null, job_id: isPurchase && l.job_id ? Number(l.job_id) : null }));
    if (!doc.contact_id) return setErr(`Choose a ${K.contact}`);
    if (lines.length === 0) return setErr("Add at least one item");
    const status = asEnquiry ? "enquiry" : issue ? ISSUE_STATUS[kind] : id ? doc.status : "draft";
    const body = { kind, contact_id: Number(doc.contact_id), date: doc.date, due_date: doc.due_date || null, reference: doc.reference, ...(kind === "invoice" ? { dc_numbers: doc.dc_numbers || "" } : {}), notes: doc.notes, terms: doc.terms, status, lines,
      doc_discount: doc.doc_discount, charges: doc.charges, charges_label: doc.charges_label, adjustment: doc.adjustment, return_stock: doc.return_stock ? 1 : 0,
      ...(isPurchase ? { job_id: doc.job_id ? Number(doc.job_id) : null } : {}) };
    setBusy(true);
    try {
      const r = id ? await api(`/documents/${id}`, { method: "PUT", body }) : await api("/documents", { method: "POST", body });
      if (inboxId && !id) await api(`/inbox/${inboxId}/status`, { method: "POST", body: { status: "done", result_kind: kind, result_id: r.id, lines: learnedLines(doc.lines) } }).catch(() => {});
      toast(`${K.label} saved`);
      nav(`/${K.path}/${r.id}`);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  const taxes = settings.data?.taxes || [];
  const contact = (contacts.data || []).find((c) => String(c.id) === String(doc.contact_id));
  // picking a contact applies their payment terms to the due date
  const pickContact = (cid) => {
    const c = (contacts.data || []).find((x) => String(x.id) === String(cid));
    setDoc((d) => ({ ...d, contact_id: cid, ...(["invoice", "bill"].includes(kind) && c?.payment_terms_days != null ? { due_date: addDays(d.date, c.payment_terms_days) } : {}) }));
  };
  const overLimit = kind === "invoice" && contact?.credit_limit && (!id || doc.status === "draft") && contact.outstanding + totals.total > contact.credit_limit;
  const showExtras = !isDc;
  return (
    <>
      <PageHead title={id ? `Edit ${doc.number}` : params.get("enquiry") ? "New Enquiry" : `New ${K.label}`} sub={kind === "quote" && !id ? "Write down what the customer asked for. Rates can be added later."
        : kind === "credit_note" ? "For goods returned by the customer, or a discount after the invoice. Apply it to invoices or refund it."
        : kind === "vendor_credit" ? "For goods we sent back, or a discount the supplier gave after the bill. Apply it to bills or take a refund." : null}>
        {kind === "bill" && !id && <>
          <button className="btn" disabled={reading} onClick={() => photo.current?.click()}>{reading ? "Reading bill…" : "📷 Fill from bill photo"}</button>
          <input ref={photo} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={(e) => e.target.files.length && readPhoto([...e.target.files])} />
        </>}
      </PageHead>
      {aiParty && !doc.contact_id && (
        <div className="ai-banner">The paper says <b>{aiParty}</b>, who isn't in your {K.contact}s yet.{" "}
          {canAddContact(can, K.contact) ? <button className="btn sm" onClick={() => setAddingContact(aiParty)}>+ Add {aiParty} as a new {K.contact}</button> : `Pick the right ${K.contact}, or ask someone to add them.`}</div>
      )}
      {inboxId && !id && doc.lines.some((l) => l.ai) && (
        <div className="ai-banner">✨ Filled from the paper. Lines marked <span className="ai-flag">check</span> weren't matched to one of your items for sure. Pick the right item (it's remembered for next time) or add them as new items.
          {missingLines(doc.lines).length > 0 && <> <button className="btn sm" onClick={() => setNewItems(true)}>+ Add the {missingLines(doc.lines).length} new item(s) to my items</button></>}</div>
      )}
      <div className="card form doc-form">
        <div className="row-4">
          <Field label={`${K.contact === "customer" ? "Customer" : "Supplier"} *`}>
            <div className="with-btn">
              <Picker options={contactOptions(contacts.data)} value={doc.contact_id} onChange={(v) => pickContact(String(v))} placeholder={`Type ${K.contact} name…`}
                createLabel={K.contact} onCreate={canAddContact(can, K.contact) ? (name) => setAddingContact(name) : null} />
              {canAddContact(can, K.contact) && <button type="button" className="btn sm" title={`New ${K.contact}`} onClick={() => setAddingContact("")}>+</button>}
            </div>
          </Field>
          <Field label="Date"><input type="date" value={doc.date} onChange={(e) => set("date", e.target.value)} /></Field>
          {["invoice", "bill"].includes(kind) && <Field label="Due date"><input type="date" value={doc.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></Field>}
          <Field label={kind === "bill" ? "Supplier bill #" : kind === "credit_note" ? "Against invoice #" : kind === "vendor_credit" ? "Against bill #" : "Reference"}><input value={doc.reference || ""} onChange={(e) => set("reference", e.target.value)} /></Field>
          {kind === "invoice" && <Field label="DC numbers" hint="Printed on the invoice. Several are fine, with commas."><input value={doc.dc_numbers || ""} onChange={(e) => set("dc_numbers", e.target.value)} placeholder="DC-00012, DC-00013" /></Field>}
        </div>
        {isCredit && (
          <label className="check"><input type="checkbox" checked={!!doc.return_stock} onChange={(e) => set("return_stock", e.target.checked ? 1 : 0)} />
            {kind === "credit_note" ? "Goods came back. Add them to stock (untick for a discount / rate difference only)" : "Goods sent back to supplier. Take them out of stock"}</label>
        )}
        {overLimit && <div className="form-error">Over credit limit: {contact.name} owes {money(contact.outstanding)} and the limit is {money(contact.credit_limit)}. You can save a draft; a director has to issue it.</div>}
        {isPurchase && (
          <div className="row-4">
            <Field label="For Job (optional)" hint="Links the cost to the Job. Leave empty for general stock. A line can be for another Job (below).">
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
                <tr key={l.key} className={l.ai && l.ai !== "high" ? "ai-check" : ""}>
                  <td>
                    {l.ai && l.ai !== "high" && <small className="ai-flag" title="What the paper said">check: “{l.ai_text}”
                      {!l.item_id && <> · <button type="button" className="link-btn" onClick={() => setAddingItem({ line: i, name: l.ai_text, preset: { unit: unitOf(l.ai_unit), category: guessCategory(l.ai_text, items.data, settings.data?.itemCategories), [isSale ? "sale_rate" : "purchase_rate"]: l.ai_rate ?? "" } })}>+ add as new item</button></>}</small>}
                    <Picker options={itemOptions(items.data)} value={l.item_id} onChange={(v) => pickItem(i, v)} emptyLabel="— custom line (not an item) —" placeholder="Type item name or SKU…"
                      createLabel="item" onCreate={(name) => setAddingItem({ line: i, name })} />
                    {!l.item_id && <input className="mt" placeholder="Description" value={l.description || ""} onChange={(e) => setLine(i, { description: e.target.value })} />}
                    {isPurchase && (jobs.data || []).length > 0 && (
                      <select className="mt line-job" value={l.job_id || ""} onChange={(e) => setLine(i, { job_id: e.target.value })} aria-label="Job for this line">
                        <option value="">{doc.job_id ? `For the bill's Job` : "For stock (no Job)"}</option>
                        {(jobs.data || []).filter((j) => String(j.id) !== String(doc.job_id)).map((j) => <option key={j.id} value={j.id}>For {j.number} · {j.customer_name}{j.customer_po_number ? ` · PO ${j.customer_po_number}` : ""}</option>)}
                      </select>
                    )}
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
          <button type="button" className="btn ghost" onClick={() => setAddingItem({ line: -1, name: "" })}>+ New item (not in list)</button>
          {isPurchase && (jobs.data || []).length > 0 && <button type="button" className="btn" onClick={() => matchToJobs().catch((x) => toast(x.message, "err"))}>Match lines to Jobs</button>}
          {isPurchase && (jobs.data || []).length > 0 && (
            <select className="inline" value="" onChange={(e) => addJobItems(e.target.value).catch((x) => toast(x.message, "err"))} aria-label="Add a Job's items">
              <option value="">+ Add another Job's items to this bill…</option>
              {(jobs.data || []).map((j) => <option key={j.id} value={j.id}>{j.number} · {j.customer_name}{j.customer_po_number ? ` · PO ${j.customer_po_number}` : ""}</option>)}
            </select>
          )}
        </div>

        <div className="doc-bottom">
          <div className="notes">
            <Field label="Notes (shown on the document)"><textarea rows={3} value={doc.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
            <Field label="Terms"><textarea rows={2} value={doc.terms || ""} onChange={(e) => set("terms", e.target.value)} placeholder="e.g. Payment within 15 days. Delivery Karachi." /></Field>
          </div>
          {showExtras && <dl className="totals extras">
            <dt>Subtotal</dt><dd>{money(totals.sub)}</dd>
            {totals.disc > 0 && <><dt>Line discounts</dt><dd>− {money(totals.disc)}</dd></>}
            <dt>Tax</dt><dd>{money(totals.tax)}</dd>
            <dt><label htmlFor="docdisc">Discount (Rs)</label></dt><dd><input id="docdisc" type="number" step="0.01" min="0" value={doc.doc_discount || ""} placeholder="0" onChange={(e) => set("doc_discount", e.target.value)} /></dd>
            <dt><input aria-label="Charges label" className="inline-label" value={doc.charges_label || ""} placeholder="Delivery / other charges" onChange={(e) => set("charges_label", e.target.value)} /></dt>
            <dd><input type="number" step="0.01" min="0" value={doc.charges || ""} placeholder="0" onChange={(e) => set("charges", e.target.value)} aria-label="Charges amount" /></dd>
            <dt><label htmlFor="adj">Round off</label> <button type="button" className="rate-hint inline" onClick={() => set("adjustment", r2(Math.round(totals.total - (Number(doc.adjustment) || 0)) - (totals.total - (Number(doc.adjustment) || 0))))}>round</button></dt>
            <dd><input id="adj" type="number" step="0.01" value={doc.adjustment || ""} placeholder="0" onChange={(e) => set("adjustment", e.target.value)} /></dd>
            <dt className="grand">Total</dt><dd className="grand">{money(totals.total)}</dd>
          </dl>}
        </div>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions">
          <button className="btn ghost" onClick={() => nav(-1)}>Cancel</button>
          {kind === "quote" && (!id || doc.status === "enquiry") && <button className="btn" disabled={busy} onClick={() => save(false, true)}>Save as enquiry (rates pending)</button>}
          {(!id || doc.status === "draft") && <button className="btn" disabled={busy} onClick={() => save(false)}>Save as draft</button>}
          <button className="btn primary" disabled={busy} onClick={() => save(!id || ["draft", "enquiry"].includes(doc.status))}>{id && !["draft", "enquiry"].includes(doc.status) ? "Save" : kind === "quote" ? "Save & mark sent" : kind === "dc" ? "Save & issue DC" : kind === "po" || isCredit ? "Save & issue" : `Save & ${kind === "invoice" ? "issue" : "record"}`}</button>
        </div>
      </div>
      {newItems && <NewItems lines={doc.lines} items={items.data} rateField={isSale ? "sale_rate" : "purchase_rate"} onClose={() => setNewItems(false)} onDone={(lines2) => { setNewItems(false); items.reload(); setDoc((d) => ({ ...d, lines: lines2 })); }} />}
      {addingItem && <ItemForm presetName={addingItem.name} preset={addingItem.preset} onClose={() => setAddingItem(null)} onSaved={async (newId) => {
        const target = addingItem.line;
        setAddingItem(null);
        const list = await api("/items");
        items.reload();
        // the line it was typed on, else the first empty line, else a new line
        const empty = target >= 0 ? target : doc.lines.findIndex((l) => !l.item_id && !l.description);
        if (empty < 0) setDoc((d) => ({ ...d, lines: [...d.lines, blankLine()] }));
        const at = empty < 0 ? doc.lines.length : empty;
        const keepQty = target >= 0 ? doc.lines[at]?.qty : null;
        setTimeout(() => { pickItem(at, newId, list); if (keepQty) setLine(at, { qty: keepQty, ai: null }); }, 0);
      }} />}
      {addingContact !== null && <ContactForm type={K.contact} presetName={addingContact} preset={addingContact === aiParty ? partyInfo : {}} onClose={() => setAddingContact(null)} onSaved={(cid) => { setAddingContact(null); setAiParty(null); contacts.reload(); pickContact(String(cid)); }} />}
    </>
  );
}
