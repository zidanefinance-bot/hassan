// "Add the N new items": the lines from a PO / bill that aren't our items yet become items, each in a category.
import React, { useState } from "react";
import { Modal, useLoad, useToast } from "../lib.jsx";
import { createMissingItems, guessCategory, unitOf } from "./draftLines.js";

export default function NewItems({ lines, items = [], rateField, onClose, onDone }) {
  const settings = useLoad("/settings");
  const list = settings.data?.itemCategories || [];
  const todo = lines.map((l, i) => [l, i]).filter(([l]) => !l.item_id && l.ai_text);
  const [cats, setCats] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toast = useToast();
  // until the person picks one, each line shows our guess
  const catOf = (l, i) => cats[i] ?? guessCategory(l.ai_text, items, list);
  const all = (c) => setCats(Object.fromEntries(todo.map(([, i]) => [i, c])));
  const missing = todo.filter(([l, i]) => !catOf(l, i)).length;
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const chosen = Object.fromEntries(todo.map(([l, i]) => [i, catOf(l, i)]));
      onDone(await createMissingItems(lines, rateField, chosen));
      toast(`${todo.length} item${todo.length === 1 ? "" : "s"} added`);
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <Modal title={`Add ${todo.length} new item${todo.length === 1 ? "" : "s"}`} onClose={onClose}>
      <div className="form">
        <p className="muted small">Every item goes in a category. We guessed where we could; check them, then add.</p>
        <div className="row-between"><span className="small">Put all in</span>
          <select defaultValue="" onChange={(e) => e.target.value && all(e.target.value)}><option value="">Choose…</option>{list.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="card flush"><table className="table compact new-items">
          <thead><tr><th>Item</th><th>Unit</th><th>Category *</th></tr></thead>
          <tbody>{todo.map(([l, i]) => (
            <tr key={i}><td>{l.ai_text}</td><td className="muted">{unitOf(l.ai_unit)}</td>
              <td><select value={catOf(l, i)} onChange={(e) => setCats((s) => ({ ...s, [i]: e.target.value }))} className={catOf(l, i) ? "" : "need"}>
                <option value="">Choose…</option>{list.map((c) => <option key={c}>{c}</option>)}</select></td></tr>
          ))}</tbody>
        </table></div>
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions"><button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || missing > 0 || !list.length} onClick={save}>{busy ? "Adding…" : missing ? `Choose ${missing} more categor${missing === 1 ? "y" : "ies"}` : `Add ${todo.length} item${todo.length === 1 ? "" : "s"}`}</button></div>
      </div>
    </Modal>
  );
}
