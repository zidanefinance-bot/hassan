import React, { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, Badge, Field, fmtDate, KIND, Loading, Modal, money, num, PageHead, Search, useAuth, useForm, useLoad, useToast } from "../lib.jsx";
import Comments from "../components/Comments.jsx";

export function ItemForm({ initial, onClose, onSaved, presetName = "", preset = {} }) {
  const settings = useLoad("/settings");
  const { can } = useAuth();
  const [f, bind] = useForm(initial ? { ...initial, track_stock: !!initial.track_stock } : { name: presetName, sku: "", unit: "pcs", category: "", purchase_rate: "", sale_rate: "", tax_rate: 0, reorder_level: "", opening_stock: "", track_stock: true, ...preset });
  const [err, setErr] = useState("");
  const toast = useToast();
  const margin = Number(f.sale_rate) ? (((f.sale_rate - f.purchase_rate) / f.sale_rate) * 100).toFixed(1) : null;
  const save = async (e) => {
    e.preventDefault();
    try {
      const r = initial ? await api(`/items/${initial.id}`, { method: "PUT", body: f }) : await api("/items", { method: "POST", body: f });
      toast(initial ? "Item saved" : "Item added");
      onSaved(r.id || initial.id);
    } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={initial ? `Edit ${initial.name}` : "New item"} onClose={onClose}>
      <form onSubmit={save} className="form">
        <Field label="Name *"><input {...bind("name")} required autoFocus placeholder="e.g. Super Fine Atta 10kg" /></Field>
        <div className="row-3"><Field label="SKU"><input {...bind("sku")} /></Field><Field label="Unit"><input {...bind("unit")} placeholder="bag, kg, tin…" /></Field><Field label="Category"><input {...bind("category")} /></Field></div>
        <div className="row-3">
          {can("cost.view") && <Field label="Purchase rate (Rs)"><input type="number" step="0.01" {...bind("purchase_rate")} /></Field>}
          {can("price.view") && <Field label="Default selling rate (Rs)" hint={margin !== null && can("profit.view") ? `Margin ${margin}%` : null}><input type="number" step="0.01" {...bind("sale_rate")} /></Field>}
          <Field label="Tax"><select {...bind("tax_rate")}>{(settings.data?.taxes || [{ name: "None", rate: 0 }]).map((t) => <option key={t.name} value={t.rate}>{t.name} ({t.rate}%)</option>)}</select></Field>
        </div>
        <div className="row-3">
          {!initial && can("items.write") && <Field label="Opening stock"><input type="number" step="0.01" {...bind("opening_stock")} /></Field>}
          <Field label="Reorder level" hint="Warn when stock falls to this"><input type="number" step="0.01" {...bind("reorder_level")} /></Field>
          <label className="check"><input type="checkbox" {...bind("track_stock", "checkbox")} /> Track stock</label>
        </div>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

// small CSV reader (quoted fields, commas and newlines inside quotes)
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  return head ? body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""]))) : [];
}

function downloadCsv(name, header, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([[header, ...rows].map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" })), download: name });
  a.click();
  URL.revokeObjectURL(a.href);
}

function ImportItems({ onClose, onDone }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const read = async (file) => {
    setErr("");
    try { const r = parseCsv(await file.text()); if (!r.length) throw new Error("No rows found. The first line must be the column names."); setRows(r); } catch (x) { setErr(x.message); }
  };
  const run = async () => {
    setBusy(true);
    try { const r = await api("/items/import", { method: "POST", body: { rows } }); toast(`${r.created} new, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped (no name)` : ""}`); onDone(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Import items from CSV" onClose={onClose}>
      <div className="form">
        <p className="muted">Use a Zoho Books item export, Excel saved as CSV, or our own export. Columns understood: <b>Item Name</b>, SKU, Unit, Category, <b>Rate</b> (selling), <b>Purchase Rate</b>, Tax %, Reorder Level, Opening Stock. Items with the same SKU or name are updated, not duplicated.</p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files[0] && read(e.target.files[0])} />
        {rows && (
          <div className="card flush mt"><table className="table compact">
            <thead><tr>{Object.keys(rows[0]).slice(0, 5).map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}>{Object.keys(rows[0]).slice(0, 5).map((h) => <td key={h}>{r[h]}</td>)}</tr>)}</tbody>
          </table><p className="muted small pad">{rows.length} rows{rows.length > 5 ? ", first 5 shown" : ""}</p></div>
        )}
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!rows || busy} onClick={run}>{busy ? "Importing…" : `Import ${rows?.length || ""} items`}</button></div>
      </div>
    </Modal>
  );
}

export default function Items() {
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(() => new URLSearchParams(window.location.search).has("low"));
  const [modal, setModal] = useState(null);
  const { can } = useAuth();
  const state = useLoad(`/items?q=${encodeURIComponent(q)}`);
  const nav = useNavigate();
  const exportCsv = () => downloadCsv("zidane-items.csv",
    ["Item Name", "SKU", "Unit", "Category", ...(can("price.view") ? ["Rate"] : []), ...(can("cost.view") ? ["Purchase Rate"] : []), "Tax %", "Reorder Level", "Stock On Hand"],
    state.data.map((i) => [i.name, i.sku, i.unit, i.category, ...(can("price.view") ? [i.sale_rate] : []), ...(can("cost.view") ? [i.purchase_rate] : []), i.tax_rate, i.reorder_level, i.stock_qty]));
  return (
    <>
      <PageHead title="Items" sub="Products, rates and stock on hand. Open an item for its full history.">
        <Search value={q} onChange={setQ} placeholder="Search items…" />
        <label className="check"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only</label>
        {can("items.write") && <button className="btn" onClick={() => setModal("import")}>Import CSV</button>}
        <button className="btn" disabled={!state.data?.length} onClick={exportCsv}>Export CSV</button>
        {["items.write", "sales.write", "buy"].some(can) && <button className="btn primary" onClick={() => setModal("new")}>+ New Item</button>}
      </PageHead>
      <Loading state={state}>{(all) => { const rows = lowOnly ? all.filter((i) => i.track_stock && i.stock_qty <= i.reorder_level) : all; return rows.length === 0 ? (lowOnly ? <div className="empty">No item is at or below its reorder level. ✓</div> : <div className="empty">No items yet. Add one, or import your list from Zoho / Excel.</div>) : (
        <div className="card flush"><table className="table">
          <thead><tr><th>Item</th><th>Category</th>{can("cost.view") && <th className="r">Buy</th>}{can("price.view") && <th className="r">Sell</th>}{can("profit.view") && <th className="r">Margin</th>}<th className="r">In stock</th></tr></thead>
          <tbody>{rows.map((i) => {
            const low = i.track_stock && i.stock_qty <= i.reorder_level;
            return (
              <tr key={i.id} className="click" onClick={() => nav(`/items/${i.id}`)}>
                <td><b>{i.name}</b><div className="muted small">{i.sku}</div></td><td className="muted">{i.category}</td>
                {can("cost.view") && <td className="r">{money(i.purchase_rate)}</td>}{can("price.view") && <td className="r">{money(i.sale_rate)}</td>}
                {can("profit.view") && <td className="r">{i.sale_rate ? (((i.sale_rate - i.purchase_rate) / i.sale_rate) * 100).toFixed(1) + "%" : "—"}</td>}
                <td className={`r ${low ? "neg" : ""}`}>{i.track_stock ? `${num(i.stock_qty)} ${i.unit}` : "—"}{low && <span className="badge red sm">low</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      ); }}</Loading>
      {modal === "new" && <ItemForm onClose={() => setModal(null)} onSaved={(id) => nav(`/items/${id}`)} />}
      {modal === "import" && <ImportItems onClose={() => setModal(null)} onDone={() => { setModal(null); state.reload(); }} />}
    </>
  );
}

const TABS = [["transactions", "Transactions"], ["rates", "Rate history"], ["stock", "Stock history"], ["history", "Change history"]];

export function ItemView() {
  const { id } = useParams();
  const state = useLoad(`/items/${id}`);
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [adj, setAdj] = useState(null);
  const [tab, setTab] = useState("transactions");
  const [kind, setKind] = useState("all");
  const toast = useToast();
  const nav = useNavigate();
  const adjust = async (e) => {
    e.preventDefault();
    try { await api(`/items/${id}/adjust`, { method: "POST", body: adj }); toast("Stock adjusted"); setAdj(null); state.reload(); } catch (x) { toast(x.message, "err"); }
  };
  return (
    <Loading state={state}>{(i) => {
      const kinds = [...new Set(i.transactions.map((t) => t.kind))];
      const tx = i.transactions.filter((t) => kind === "all" || t.kind === kind);
      const r = i.rates;
      return (
        <>
          <PageHead title={i.name} sub={[i.sku, i.category, i.unit].filter(Boolean).join(" · ")}>
            {can("items.write") && <>
              <button className="btn" onClick={() => setAdj({ qty: "", reason: "" })}>Adjust stock</button>
              <button className="btn" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn ghost danger" onClick={async () => { if (confirm("Hide this item from lists? History is kept.")) { await api(`/items/${id}`, { method: "DELETE" }); nav("/items"); } }}>Delete</button>
            </>}
          </PageHead>
          <div className="stats">
            <div className="stat"><small>In stock</small><b className={i.track_stock && i.stock_qty <= i.reorder_level ? "neg" : ""}>{num(i.stock_qty)} {i.unit}</b><span className="muted">reorder at {num(i.reorder_level)}</span></div>
            {i.purchase_rate !== undefined && <div className="stat"><small>Purchase rate</small><b>{money(i.purchase_rate)}</b>{r.purchase?.avg_90 && <span className="muted">90-day avg {money(r.purchase.avg_90)}</span>}</div>}
            {i.sale_rate !== undefined && <div className="stat"><small>Selling rate</small><b>{money(i.sale_rate)}</b><span className="muted">{i.tax_rate}% tax{r.sales?.last ? ` · last sold ${money(r.sales.last.rate)}` : ""}</span></div>}
            {i.purchase_rate !== undefined && <div className="stat"><small>Stock value (at cost)</small><b>{money(i.stock_qty * i.purchase_rate)}</b></div>}
          </div>
          <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>

          {tab === "transactions" && (i.transactions.length === 0 ? <div className="empty">This item isn't on any document yet.</div> : (
            <>
              {kinds.length > 1 && <div className="chips">{["all", ...kinds].map((k) => <button key={k} className={`chipbtn ${kind === k ? "on" : ""}`} onClick={() => setKind(k)}>{k === "all" ? "All" : KIND[k].plural}</button>)}</div>}
              <div className="card flush"><table className="table">
                <thead><tr><th>Date</th><th>Type</th><th>Number</th><th>Customer / supplier</th><th>Job</th><th>Status</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
                <tbody>{tx.map((t, n) => (
                  <tr key={n} className="click" onClick={() => nav(`/${KIND[t.kind].path}/${t.id}`)}>
                    <td>{fmtDate(t.date)}</td><td>{KIND[t.kind].label}</td><td><b>{t.number}</b></td><td>{t.contact_name}</td><td className="muted">{t.job_number || "—"}</td><td><Badge status={t.status} /></td>
                    <td className="r">{num(t.qty)}</td><td className="r">{t.rate === undefined || t.kind === "dc" ? "—" : money(t.rate)}{t.discount_pct ? <div className="muted small">−{t.discount_pct}%</div> : null}</td><td className="r">{t.amount === undefined || t.kind === "dc" ? "—" : money(t.amount)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </>
          ))}

          {tab === "rates" && (
            <div className="grid-2">
              {r.purchase && (
                <section className="card">
                  <h3>Buying rates</h3>
                  <dl className="kv">
                    <dt>Last bought</dt><dd>{r.purchase.last ? <>{money(r.purchase.last.rate)} <span className="muted">· {r.purchase.last.supplier} · {fmtDate(r.purchase.last.date)}</span></> : "—"}</dd>
                    <dt>30-day avg</dt><dd>{r.purchase.avg_30 ? money(r.purchase.avg_30) : "—"}</dd>
                    <dt>90-day avg</dt><dd>{r.purchase.avg_90 ? money(r.purchase.avg_90) : "—"}</dd>
                    <dt>Cheapest now</dt><dd>{r.purchase.lowest_supplier ? <>{r.purchase.lowest_supplier.name} <span className="muted">· {money(r.purchase.lowest_supplier.last_rate)}</span></> : "—"}</dd>
                  </dl>
                  {r.purchase.suppliers.length > 0 && <table className="table compact mt"><thead><tr><th>Supplier</th><th className="r">Last rate</th><th className="r">Lowest</th><th className="r">Bought</th></tr></thead>
                    <tbody>{r.purchase.suppliers.map((s) => <tr key={s.contact_id}><td><Link to={`/contacts/${s.contact_id}`}>{s.name}</Link><div className="muted small">{fmtDate(s.last_date)} · {s.bills} bill(s)</div></td><td className="r">{money(s.last_rate)}</td><td className="r">{money(s.lowest)}</td><td className="r">{num(s.qty)} {i.unit}</td></tr>)}</tbody></table>}
                </section>
              )}
              {r.sales && (
                <section className="card">
                  <h3>Selling rates by customer</h3>
                  {r.sales.customers.length === 0 ? <p className="muted">Not invoiced yet.</p> : (
                    <table className="table compact"><thead><tr><th>Customer</th><th className="r">Last rate</th><th className="r">Sold</th></tr></thead>
                      <tbody>{r.sales.customers.map((c) => <tr key={c.contact_id}><td><Link to={`/contacts/${c.contact_id}`}>{c.name}</Link><div className="muted small">{fmtDate(c.last_date)} · {c.invoices} invoice(s)</div></td><td className="r">{money(c.last_rate)}</td><td className="r">{num(c.qty)} {i.unit}</td></tr>)}</tbody></table>
                  )}
                </section>
              )}
            </div>
          )}

          {tab === "stock" && (
            <div className="card flush"><table className="table">
              <thead><tr><th>Date</th><th>Reason</th><th className="r">In / out</th></tr></thead>
              <tbody>{i.moves.length === 0 ? <tr><td colSpan={3} className="muted">No stock movement yet.</td></tr> : i.moves.map((m) => (
                <tr key={m.id} className={m.document_id && m.document_kind ? "click" : ""} onClick={() => m.document_id && m.document_kind && nav(`/${KIND[m.document_kind].path}/${m.document_id}`)}>
                  <td>{fmtDate(m.date)}</td><td>{m.reason}</td><td className={`r ${m.qty < 0 ? "neg" : "pos"}`}>{m.qty > 0 ? "+" : ""}{num(m.qty)}</td></tr>
              ))}</tbody>
            </table></div>
          )}

          {tab === "history" && (
            <section className="card">
              {i.history.length === 0 ? <p className="muted">No changes recorded.</p> : (
                <ul className="activity">{i.history.map((a) => <li key={a.id}><b>{a.user_name || "System"}</b> {a.action} <span className="muted">{a.summary}</span><time>{new Date(a.at + "Z").toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time></li>)}</ul>
              )}
            </section>
          )}

          <Comments entity="item" id={i.id} />
          {editing && <ItemForm initial={i} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); state.reload(); }} />}
          {adj && (
            <Modal title="Adjust stock" onClose={() => setAdj(null)}>
              <form className="form" onSubmit={adjust}>
                <Field label="Quantity change" hint="Use a minus sign to reduce, e.g. -5 for damaged stock"><input type="number" step="0.01" value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value })} required autoFocus /></Field>
                <Field label="Reason"><input value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} placeholder="Stock count, damaged, sample…" /></Field>
                <div className="form-actions"><button type="button" className="btn ghost" onClick={() => setAdj(null)}>Cancel</button><button className="btn primary">Save</button></div>
              </form>
            </Modal>
          )}
        </>
      );
    }}</Loading>
  );
}
