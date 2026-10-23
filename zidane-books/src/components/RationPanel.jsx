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

function BagDocModal({ job, kind, onClose, onSaved }) {
  const r = job.ration;
  const max = kind === "dc" ? r.ready_to_send : (r.delivered > 0 ? r.delivered : r.bags) - r.invoiced;
  const [b, setB] = useState({ bags: max, show_as: "bags" });
  const [err, setErr] = useState("");
  return (
    <Modal title={kind === "dc" ? "Delivery challan for bags" : "Invoice for bags"} onClose={onClose}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); try { const x = await api(`/jobs/${job.id}/${kind}`, { method: "POST", body: b }); onSaved(x.id); } catch (y) { setErr(y.message); } }}>
        <p className="muted">{kind === "dc" ? <>Packed and waiting: <b>{num(r.ready_to_send)}</b> bags</> : <>Left to invoice: <b>{num(max)}</b> bags{r.delivered > 0 ? " (of those sent)" : ""}</>}</p>
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
