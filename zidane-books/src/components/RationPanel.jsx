// On a ration Job: bags ordered / packed / sent / invoiced, packing entries, and DC / invoice by number of bags.
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Field, fmtDate, Modal, money, num, today, useAuth, useToast } from "../lib.jsx";

export default function RationPanel({ job, onChange }) {
  const r = job.ration;
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [pack, setPack] = useState(false);
  const [doc, setDoc] = useState(null); // "dc" | "invoice"
  const [points, setPoints] = useState(false);
  const del = async (p) => {
    if (!window.confirm(`Remove the entry of ${p.bags} bags packed on ${fmtDate(p.date)}?`)) return;
    try { await api(`/packing/${p.id}`, { method: "DELETE" }); toast("Packing entry removed"); onChange(); } catch (x) { toast(x.message, "err"); }
  };
  const pct = (n) => `${Math.min(100, Math.round((n / r.bags) * 100))}%`;
  return (
    <section className="card ration">
      <div className="ration-head">
        <div>
          <h3>Ration order · {num(r.bags)} bags{r.kit_name ? ` · ${r.kit_name}` : ""}</h3>
          {r.price_per_bag !== undefined && <p className="muted small">Rate per bag {money(r.price_per_bag)}{r.cost_per_bag !== undefined && <> · cost per bag {money(r.cost_per_bag)} (goods {money(r.goods_cost_per_bag)} + labour, packing, loading, delivery {money(r.other_cost_per_bag)}) · margin <b className={r.price_per_bag - r.cost_per_bag < 0 ? "neg" : "pos"}>{money(r.price_per_bag - r.cost_per_bag)}</b> per bag</>}</p>}
        </div>
        <div className="ration-actions">
          {(can("ops.write") || can("buy")) && !job.closed && r.to_pack > 0 && <button className="btn primary" onClick={() => setPack(true)}>+ Record packing</button>}
          {can("sales.write") && !job.closed && r.ready_to_send > 0 && <button className="btn" onClick={() => setDoc("dc")}>DC for bags</button>}
          {can("sales.write") && !job.closed && r.invoiced < r.bags && <button className="btn" onClick={() => setDoc("invoice")}>Invoice bags</button>}
        </div>
      </div>
      <div className="ration-bars">
        {[["Packed", r.packed], ["Sent (DC)", r.delivered], ["Invoiced", r.invoiced]].map(([l, n]) => (
          <div key={l}><div className="ration-bar"><i style={{ width: pct(n) }} /></div><small>{l}: <b>{num(n)}</b> / {num(r.bags)}</small></div>
        ))}
      </div>
      <p className="small">{r.to_pack > 0 ? <>To pack: <b>{num(r.to_pack)}</b> · </> : <span className="pos">All packed · </span>}Packed, waiting to go out: <b>{num(r.ready_to_send)}</b></p>
      <div className="points">
        <div className="points-head"><h4>Delivery points</h4>{can("sales.write") && !job.closed && <button className="btn sm" onClick={() => setPoints(true)}>{r.points.length ? "Edit points" : "+ Add delivery points"}</button>}</div>
        {r.points.length === 0 ? <p className="muted small">All bags go to one place ({job.delivery_location || "the customer's address"}). Add points when the customer wants bags at several places: each gets its own DC with its own address.</p> : (
          <table className="table compact">
            <thead><tr><th>Point</th><th>Contact</th><th className="r">Bags</th><th className="r">Sent</th><th className="r">Left</th></tr></thead>
            <tbody>{r.points.map((p) => (
              <tr key={p.id}><td><b>{p.name}</b>{p.address && <div className="muted small">{p.address}</div>}</td><td className="small">{[p.contact, p.phone].filter(Boolean).join(" · ")}</td>
                <td className="r">{p.bags ? num(p.bags) : "—"}</td><td className="r">{num(p.sent)}{p.drafted ? <div className="muted small">+{num(p.drafted)} draft</div> : null}</td>
                <td className={`r ${p.left === 0 ? "pos" : ""}`}>{p.left === null ? "—" : p.left === 0 ? "✓ done" : num(p.left)}</td></tr>
            ))}</tbody>
            {r.points.some((p) => p.bags) && <tfoot><tr><td colSpan={2}>Planned</td><td className="r">{num(r.points.reduce((s, p) => s + (p.bags || 0), 0))} / {num(r.bags)}</td><td className="r">{num(r.points.reduce((s, p) => s + p.sent, 0))}</td><td /></tr></tfoot>}
          </table>
        )}
      </div>
      <div className="grid-2">
        <div>
          <h4>One bag holds</h4>
          <table className="table compact">
            <tbody>{r.contents.map((c) => <tr key={c.id}><td>{c.name}</td><td className="r">{num(c.per_bag)} {c.unit || ""}</td>{c.sale_rate !== undefined && <td className="r muted">{money(c.sale_rate)}</td>}</tr>)}</tbody>
          </table>
        </div>
        <div>
          <h4>Packing</h4>
          {r.packing.length === 0 ? <p className="muted small">Nothing packed yet.</p> : (
            <table className="table compact"><tbody>{r.packing.map((p) => (
              <tr key={p.id}><td>{fmtDate(p.date)}</td><td className="r"><b>{num(p.bags)}</b> bags</td><td className="muted small">{p.notes}{p.by_name ? ` · ${p.by_name}` : ""}</td>
                <td>{can("ops.write") && <button className="icon-btn" title="Remove" onClick={() => del(p)}>✕</button>}</td></tr>
            ))}</tbody></table>
          )}
          <p className="muted small">Labour, packing material, loading and delivery for this order: add them with "+ Freight / direct cost". They count in the cost per bag.</p>
        </div>
      </div>
      {points && <PointsModal job={job} onClose={() => setPoints(false)} onSaved={() => { setPoints(false); toast("Delivery points saved"); onChange(); }} />}
      {pack && <PackModal job={job} onClose={() => setPack(false)} onSaved={() => { setPack(false); toast("Packing recorded"); onChange(); }} />}
      {doc && <BagDocModal job={job} kind={doc} onClose={() => setDoc(null)} onSaved={(id) => { setDoc(null); nav(doc === "dc" ? `/delivery-challans/${id}` : `/invoices/${id}`); }} />}
    </section>
  );
}

function PackModal({ job, onClose, onSaved }) {
  const [p, setP] = useState({ bags: job.ration.to_pack, date: today(), notes: "" });
  const [err, setErr] = useState("");
  return (
    <Modal title="Record packing" onClose={onClose}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); try { await api(`/jobs/${job.id}/packing`, { method: "POST", body: p }); onSaved(); } catch (x) { setErr(x.message); } }}>
        <p className="muted">Left to pack: <b>{num(job.ration.to_pack)}</b> bags</p>
        <div className="row-2"><Field label="Bags packed *"><input type="number" min="1" step="1" value={p.bags} onChange={(e) => setP({ ...p, bags: e.target.value })} required autoFocus /></Field><Field label="Date"><input type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></Field></div>
        <Field label="Notes"><input value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} placeholder="Shift, team…" /></Field>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

function PointsModal({ job, onClose, onSaved }) {
  const blank = () => ({ name: "", address: "", contact: "", phone: "", bags: "" });
  const [list, setList] = useState(job.ration.points.length ? job.ration.points.map((p) => ({ ...p, bags: p.bags ?? "" })) : [blank(), blank()]);
  const [err, setErr] = useState("");
  const set = (i, k, v) => setList((l) => l.map((p, n) => (n === i ? { ...p, [k]: v } : p)));
  const planned = list.reduce((s, p) => s + (Number(p.bags) || 0), 0);
  return (
    <Modal title="Delivery points" onClose={onClose} wide>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); try { await api(`/jobs/${job.id}/delivery-points`, { method: "PUT", body: { points: list } }); onSaved(); } catch (x) { setErr(x.message); } }}>
        <p className="muted">Where the {num(job.ration.bags)} bags go. Each point gets its own delivery challan with its own address and receiver. Bags per point are optional but stop a DC sending too many.</p>
        <table className="table compact">
          <thead><tr><th>Name *</th><th>Address</th><th>Receiver</th><th>Phone</th><th className="r">Bags</th><th /></tr></thead>
          <tbody>{list.map((p, i) => (
            <tr key={p.id || `n${i}`}>
              <td><input value={p.name} onChange={(e) => set(i, "name", e.target.value)} placeholder={`Point ${i + 1} (e.g. Korangi office)`} /></td>
              <td><input value={p.address || ""} onChange={(e) => set(i, "address", e.target.value)} /></td>
              <td><input value={p.contact || ""} onChange={(e) => set(i, "contact", e.target.value)} placeholder="Name" /></td>
              <td><input value={p.phone || ""} onChange={(e) => set(i, "phone", e.target.value)} style={{ width: 120 }} /></td>
              <td className="r"><input type="number" min="0" step="1" value={p.bags} onChange={(e) => set(i, "bags", e.target.value)} style={{ width: 80 }} /></td>
              <td>{!(p.sent || p.drafted) && <button type="button" className="icon-btn" onClick={() => setList((l) => l.filter((_, n) => n !== i))}>✕</button>}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td colSpan={4}><button type="button" className="btn sm" onClick={() => setList((l) => [...l, blank()])}>+ Point</button></td><td className={`r ${planned > job.ration.bags ? "neg" : ""}`}>{num(planned)} / {num(job.ration.bags)}</td><td /></tr></tfoot>
        </table>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Save points</button></div>
      </form>
    </Modal>
  );
}

function BagDocModal({ job, kind, onClose, onSaved }) {
  const r = job.ration;
  const open = r.points.filter((p) => p.left === null || p.left > 0);
  const firstPoint = open[0];
  const capFor = (p) => (p && p.left !== null ? Math.min(r.ready_to_send, p.left) : r.ready_to_send);
  const max = kind === "dc" ? capFor(firstPoint) : (r.delivered > 0 ? r.delivered : r.bags) - r.invoiced;
  const [b, setB] = useState({ bags: max, show_as: "bags", point_id: firstPoint?.id || "" });
  const [err, setErr] = useState("");
  return (
    <Modal title={kind === "dc" ? "Delivery challan for bags" : "Invoice for bags"} onClose={onClose}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); try { const x = await api(`/jobs/${job.id}/${kind}`, { method: "POST", body: b }); onSaved(x.id); } catch (y) { setErr(y.message); } }}>
        <p className="muted">{kind === "dc" ? <>Packed and waiting: <b>{num(r.ready_to_send)}</b> bags</> : <>Left to invoice: <b>{num(max)}</b> bags{r.delivered > 0 ? " (of those sent)" : ""}</>}</p>
        {kind === "dc" && r.points.length > 0 && (
          <Field label="Delivery point *">
            <select value={b.point_id} required onChange={(e) => { const p = r.points.find((x) => String(x.id) === e.target.value); setB({ ...b, point_id: e.target.value, bags: capFor(p) }); }}>
              {r.points.map((p) => <option key={p.id} value={p.id} disabled={p.left === 0}>{p.name}{p.left === null ? "" : p.left === 0 ? " (done)" : ` (${num(p.left)} bags left)`}</option>)}
            </select>
          </Field>
        )}
        <Field label="Bags *"><input type="number" min="1" step="1" value={b.bags} onChange={(e) => setB({ ...b, bags: e.target.value })} required autoFocus /></Field>
        {kind === "invoice" && (
          <Field label="Show the customer">
            <select value={b.show_as} onChange={(e) => setB({ ...b, show_as: e.target.value })}>
              <option value="bags">Bags × rate, with each item's rate in the bag</option>
              <option value="bags_total">Bags × rate, contents only (item rates hidden)</option>
              <option value="items">Item by item</option>
            </select>
          </Field>
        )}
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary">Create draft</button></div>
      </form>
    </Modal>
  );
}
