import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, Field, fmtDate, Loading, Modal, money, num, PageHead, Search, useAuth, useForm, useLoad, useToast } from "../lib.jsx";

function ItemForm({ initial, onClose, onSaved }) {
  const settings = useLoad("/settings");
  const { can } = useAuth();
  const [f, bind] = useForm(initial ? { ...initial, track_stock: !!initial.track_stock } : { name: "", sku: "", unit: "pcs", category: "", purchase_rate: "", sale_rate: "", tax_rate: 0, reorder_level: "", opening_stock: "", track_stock: true });
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
          {!initial && <Field label="Opening stock"><input type="number" step="0.01" {...bind("opening_stock")} /></Field>}
          <Field label="Reorder level" hint="Warn when stock falls to this"><input type="number" step="0.01" {...bind("reorder_level")} /></Field>
          <label className="check"><input type="checkbox" {...bind("track_stock", "checkbox")} /> Track stock</label>
        </div>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

export default function Items() {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const { can } = useAuth();
  const state = useLoad(`/items?q=${encodeURIComponent(q)}`);
  const nav = useNavigate();
  return (
    <>
      <PageHead title="Items" sub="Products, rates and stock on hand.">
        <Search value={q} onChange={setQ} placeholder="Search items…" />
        {can("items.write") && <button className="btn primary" onClick={() => setAdding(true)}>+ New Item</button>}
      </PageHead>
      <Loading state={state}>{(rows) => rows.length === 0 ? <div className="empty">No items yet.</div> : (
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
      )}</Loading>
      {adding && <ItemForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); state.reload(); }} />}
    </>
  );
}

export function ItemView() {
  const { id } = useParams();
  const state = useLoad(`/items/${id}`);
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [adj, setAdj] = useState(null);
  const toast = useToast();
  const nav = useNavigate();
  const adjust = async (e) => {
    e.preventDefault();
    try { await api(`/items/${id}/adjust`, { method: "POST", body: adj }); toast("Stock adjusted"); setAdj(null); state.reload(); } catch (x) { toast(x.message, "err"); }
  };
  return (
    <Loading state={state}>{(i) => (
      <>
        <PageHead title={i.name} sub={[i.sku, i.category].filter(Boolean).join(" · ")}>
          {can("items.write") && <>
            <button className="btn" onClick={() => setAdj({ qty: "", reason: "" })}>Adjust stock</button>
            <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn ghost danger" onClick={async () => { if (confirm("Hide this item from lists? History is kept.")) { await api(`/items/${id}`, { method: "DELETE" }); nav("/items"); } }}>Delete</button>
          </>}
        </PageHead>
        <div className="stats">
          <div className="stat"><small>In stock</small><b>{num(i.stock_qty)} {i.unit}</b></div>
          {i.purchase_rate !== undefined && <div className="stat"><small>Stock value (at cost)</small><b>{money(i.stock_qty * i.purchase_rate)}</b></div>}
          {i.purchase_rate !== undefined && <div className="stat"><small>Purchase rate</small><b>{money(i.purchase_rate)}</b></div>}
          {i.sale_rate !== undefined && <div className="stat"><small>Selling rate</small><b>{money(i.sale_rate)}</b><span className="muted">{i.tax_rate}% tax</span></div>}
        </div>
        <section className="card flush">
          <h3 className="pad">Stock history</h3>
          <table className="table"><thead><tr><th>Date</th><th>Reason</th><th className="r">Qty</th></tr></thead>
            <tbody>{i.moves.map((m) => <tr key={m.id}><td>{fmtDate(m.date)}</td><td>{m.reason}</td><td className={`r ${m.qty < 0 ? "neg" : "pos"}`}>{m.qty > 0 ? "+" : ""}{num(m.qty)}</td></tr>)}</tbody>
          </table>
        </section>
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
    )}</Loading>
  );
}
