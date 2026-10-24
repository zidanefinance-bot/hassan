// Ration kits: what one bag holds and the rate of each item in it. A kit becomes a quotation for N bags.
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Field, Loading, Modal, money, num, PageHead, useAuth, useLoad, useToast } from "../lib.jsx";
import Picker from "../components/Picker.jsx";

// one bag's line-item table, reused for the customer-facing items and the internal-only packing materials
function KitLines({ title, hint, lines, setLines, opts, showRate, minLines = 1 }) {
  const blank = () => ({ item_id: "", description: "", qty: 1, rate: "" });
  const set = (i, f, v) => setLines(lines.map((l, n) => (n === i ? { ...l, [f]: v } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
  return (
    <div>
      <h4>{title}</h4>
      {hint && <p className="muted small">{hint}</p>}
      <table className="table compact">
        <thead><tr><th>Item (or a charge like “Bag & packing”)</th><th className="r">Qty per bag</th>{showRate && <th className="r">Rate</th>}{showRate && <th className="r">Amount</th>}<th /></tr></thead>
        <tbody>{lines.map((l, i) => (
          <tr key={i}>
            <td>{l.item_id || !l.description ? <Picker options={opts} value={l.item_id} onChange={(v) => set(i, "item_id", v)} placeholder="Type item name…" /> : null}
              {!l.item_id && <input value={l.description} onChange={(e) => set(i, "description", e.target.value)} placeholder="…or type a charge (no stock)" style={{ marginTop: 4 }} />}</td>
            <td className="r"><input type="number" min="0" step="any" value={l.qty} onChange={(e) => set(i, "qty", e.target.value)} style={{ width: 90 }} required /></td>
            {showRate && <td className="r"><input type="number" min="0" step="0.01" value={l.rate} onChange={(e) => set(i, "rate", e.target.value)} style={{ width: 110 }} placeholder="Rs" /></td>}
            {showRate && <td className="r">{money((Number(l.qty) || 0) * (Number(l.rate) || 0))}</td>}
            <td>{lines.length > minLines && <button type="button" className="icon-btn" onClick={() => setLines(lines.filter((_, n) => n !== i))}>✕</button>}</td>
          </tr>
        ))}</tbody>
        <tfoot><tr><td><button type="button" className="btn sm" onClick={() => setLines([...lines, blank()])}>+ Item</button></td><td />{showRate && <td className="r">One bag</td>}{showRate && <td className="r">{money(total)}</td>}<td /></tr></tfoot>
      </table>
    </div>
  );
}

function KitForm({ initial, items, onClose, onSaved }) {
  const blank = () => ({ item_id: "", description: "", qty: 1, rate: "" });
  const toLine = (l) => ({ item_id: l.item_id || "", description: l.description || "", qty: l.qty, rate: l.rate });
  const [name, setName] = useState(initial?.name || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [active, setActive] = useState(initial?.active);
  const [lines, setLines] = useState(initial ? initial.lines.map(toLine) : [blank()]);
  const [materials, setMaterials] = useState(initial?.materials?.length ? initial.materials.map(toLine) : []);
  const [showMaterials, setShowMaterials] = useState(Boolean(initial?.materials?.length));
  const [err, setErr] = useState("");
  const opts = items.map((i) => ({ id: i.id, label: i.name, sub: i.unit, search: `${i.sku || ""} ${i.category || ""}` }));
  const save = async (e) => {
    e.preventDefault();
    const body = { name, notes, active, lines: [...lines.map((l) => ({ ...l, internal: false })), ...(showMaterials ? materials.map((l) => ({ ...l, internal: true })) : [])] };
    try { initial ? await api(`/kits/${initial.id}`, { method: "PUT", body }) : await api("/kits", { method: "POST", body }); onSaved(); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={initial ? `Edit ${initial.name}` : "New ration kit"} onClose={onClose} wide>
      <form className="form" onSubmit={save}>
        <div className="row-2"><Field label="Kit name *"><input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Standard ration bag" /></Field><Field label="Notes (shown on the quotation)"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
        <KitLines title="What one bag holds" hint="Shown to the customer on the quotation, DC and invoice." lines={lines} setLines={setLines} opts={opts} showRate />
        {showMaterials ? (
          <KitLines title="Packing materials (internal)" hint="Purchasing sees these for however many bags the order is — never shown to the customer." lines={materials} setLines={setMaterials} opts={opts} minLines={0} />
        ) : (
          <button type="button" className="btn sm" onClick={() => { setMaterials([blank()]); setShowMaterials(true); }}>+ Packing materials (poly bags, sacks…) for Purchasing only</button>
        )}
        {initial && <label className="check"><input type="checkbox" checked={active !== 0 && active !== false} onChange={(e) => setActive(e.target.checked)} /> In use</label>}
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save kit</button></div>
      </form>
    </Modal>
  );
}

function QuoteModal({ kit, onClose }) {
  const customers = useLoad("/contacts?type=customer");
  const [q, setQ] = useState({ contact_id: "", bags: 100, show_as: "bags" });
  const [err, setErr] = useState("");
  const nav = useNavigate();
  return (
    <Modal title={`Quotation · ${kit.name}`} onClose={onClose}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); try { const r = await api(`/kits/${kit.id}/quote`, { method: "POST", body: q }); nav(`/quotes/${r.id}`); } catch (x) { setErr(x.message); } }}>
        <Field label="Customer *"><Picker options={(customers.data || []).map((c) => ({ id: c.id, label: c.name, sub: c.company || "" }))} value={q.contact_id} onChange={(v) => setQ({ ...q, contact_id: v })} placeholder="Type customer name…" /></Field>
        <div className="row-2">
          <Field label="How many bags? *"><input type="number" min="1" step="1" value={q.bags} onChange={(e) => setQ({ ...q, bags: e.target.value })} required /></Field>
          <Field label="Show the customer">
            <select value={q.show_as} onChange={(e) => setQ({ ...q, show_as: e.target.value })}>
              <option value="bags">Each item's rate + bag total</option>
              <option value="bags_total">Items & qty only, bag total (rates hidden)</option>
              <option value="items">Item by item (full quantities)</option>
            </select>
          </Field>
        </div>
        <p className="muted">{num(q.bags || 0)} bags × {money(kit.price_per_bag)} = <b>{money((Number(q.bags) || 0) * kit.price_per_bag)}</b> (before tax). You can change rates and add discount or delivery charges on the draft.</p>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Make draft quotation</button></div>
      </form>
    </Modal>
  );
}

export default function Kits() {
  const state = useLoad("/kits");
  const items = useLoad("/items");
  const { can } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [quote, setQuote] = useState(null);
  return (
    <>
      <PageHead title="Ration kits" sub="What one bag holds and each item's rate. Make a quotation for any number of bags from a kit.">
        {can("sales.write") && <button className="btn primary" onClick={() => setEditing({})} disabled={!items.data}>+ New kit</button>}
      </PageHead>
      <Loading state={state}>{(list) => list.length === 0 ? <div className="empty">No kits yet. Make one for each standard bag (and the Ramadan packages).</div> : (
        <div className="kit-grid">{list.map((k) => (
          <section key={k.id} className={`card kit ${k.active ? "" : "muted"}`}>
            <div className="kit-head"><h3>{k.name}{!k.active && <span className="badge grey" style={{ marginLeft: 8 }}>not in use</span>}</h3><b>{money(k.price_per_bag)}<small className="muted"> / bag</small></b></div>
            <table className="table compact"><tbody>{k.lines.map((l) => <tr key={l.id}><td>{l.item_name || l.description}</td><td className="r">{num(l.qty)} {l.unit || ""}</td><td className="r muted">{money(l.rate)}</td></tr>)}</tbody></table>
            {k.cost_per_bag !== undefined && <p className="small">Cost of goods {money(k.cost_per_bag)} / bag · margin <b className={k.margin_per_bag < 0 ? "neg" : "pos"}>{money(k.margin_per_bag)} ({k.margin_pct}%)</b> <span className="muted">before labour, packing, loading and delivery</span></p>}
            {k.materials?.length > 0 && <p className="muted small">+ {k.materials.length} packing material{k.materials.length > 1 ? "s" : ""} / bag (internal, not quoted): {k.materials.map((m) => `${num(m.qty)} ${m.unit || ""} ${m.item_name || m.description}`).join(", ")}</p>}
            {can("sales.write") && <div className="form-actions">
              <button className="btn ghost" onClick={() => setEditing(k)} disabled={!items.data}>Edit</button>
              {k.active ? <button className="btn primary" onClick={() => setQuote(k)}>Make quotation</button> : null}
            </div>}
          </section>
        ))}</div>
      )}</Loading>
      {editing && items.data && <KitForm initial={editing.id ? editing : null} items={items.data} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); state.reload(); toast("Kit saved"); }} />}
      {quote && <QuoteModal kit={quote} onClose={() => setQuote(null)} />}
    </>
  );
}
