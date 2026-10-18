// Evidence files on any record: signed DC, customer PO, supplier bill photo, payment proof…
import React, { useRef, useState } from "react";
import { api, useAuth, useLoad, useToast } from "../lib.jsx";

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Attachments({ entity, id, labels = [] }) {
  const state = useLoad(`/attachments?entity=${entity}&entity_id=${id}`);
  const { user, can } = useAuth();
  const [label, setLabel] = useState(labels[0] || "");
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const toast = useToast();
  const upload = async (files) => {
    setBusy(true);
    try {
      for (const f of files) {
        if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is bigger than 10 MB`);
        const data = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = bad; r.readAsDataURL(f); });
        await api("/attachments", { method: "POST", body: { entity, entity_id: id, filename: f.name, mime: f.type || "application/octet-stream", data, label } });
      }
      toast(files.length > 1 ? `${files.length} files attached` : "File attached");
      state.reload();
    } catch (x) { toast(x.message, "err"); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const remove = async (a) => {
    if (!confirm(`Remove ${a.filename}?`)) return;
    try { await api(`/attachments/${a.id}`, { method: "DELETE" }); state.reload(); } catch (x) { toast(x.message, "err"); }
  };
  const list = state.data || [];
  return (
    <section className="card no-print attach">
      <div className="row-between">
        <h3>Attachments {list.length > 0 && <span className="muted">({list.length})</span>}</h3>
        <div className="actions">
          {labels.length > 0 && <select value={label} onChange={(e) => setLabel(e.target.value)} aria-label="What is it">{labels.map((l) => <option key={l}>{l}</option>)}<option value="">Other</option></select>}
          <button className="btn sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "+ Attach file / photo"}</button>
          <input ref={input} type="file" multiple accept="image/*,application/pdf,.csv,.xlsx,.xls,.docx" hidden onChange={(e) => e.target.files.length && upload([...e.target.files])} />
        </div>
      </div>
      {list.length === 0 ? <p className="muted small">No files yet. Photos and PDFs up to 10 MB.</p> : (
        <ul className="files">
          {list.map((a) => (
            <li key={a.id}>
              {a.mime.startsWith("image/") ? <a href={`/api/attachments/${a.id}/file`} target="_blank" rel="noreferrer"><img src={`/api/attachments/${a.id}/file`} alt={a.filename} /></a> : <a className="fileicon" href={`/api/attachments/${a.id}/file`} target="_blank" rel="noreferrer">{a.mime.includes("pdf") ? "PDF" : "FILE"}</a>}
              <div><a href={`/api/attachments/${a.id}/file`} target="_blank" rel="noreferrer"><b>{a.label ? `${a.label}: ` : ""}{a.filename}</b></a><span className="muted small">{kb(a.size)} · {a.uploaded_by_name} · {new Date(a.created_at + "Z").toLocaleDateString("en-GB")}</span></div>
              {(a.uploaded_by === user.id || can("admin")) && <button className="icon-btn" aria-label="Remove" onClick={() => remove(a)}>×</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
