// Search box in the top bar: type a customer PO #, Job, invoice/bill number, customer, supplier or item.
// Press "/" anywhere to jump into it. Results only include what your role can open.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib.jsx";

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const input = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    const key = (e) => {
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  // ask the server a moment after typing stops
  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); return; }
    setBusy(true);
    const t = setTimeout(() => api(`/search?q=${encodeURIComponent(q.trim())}`).then((r) => { setRows(r); setHi(0); }).catch(() => setRows([])).finally(() => setBusy(false)), 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const go = (r) => { setOpen(false); setQ(""); input.current?.blur(); nav(r.link); };
  const key = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && rows[hi]) { e.preventDefault(); go(rows[hi]); }
    else if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
  };
  return (
    <div className="gsearch" ref={box}>
      <input ref={input} type="search" value={q} placeholder="Search PO #, Job, invoice, customer, item…  ( / )" aria-label="Search everything"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={key} />
      {open && q.trim().length >= 2 && (
        <ul className="gsearch-list" role="listbox">
          {rows.map((r, i) => (
            <li key={r.link} className={i === hi ? "hi" : ""} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); go(r); }}>
              <span className={`gs-type t-${r.type.replace(/\s/g, "")}`}>{r.type}</span>
              <span className="gs-text"><b>{r.title}</b><small>{r.sub}</small></span>
            </li>
          ))}
          {!rows.length && <li className="none">{busy ? "Searching…" : `Nothing found for “${q.trim()}”`}</li>}
        </ul>
      )}
    </div>
  );
}
