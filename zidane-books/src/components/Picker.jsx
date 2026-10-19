// Type-to-search picker for customers, suppliers and items. When nothing matches, the last row offers
// "+ Add new … “what you typed”", so a new customer or item can be made without leaving the form.
import React, { useEffect, useMemo, useRef, useState } from "react";

const norm = (s) => String(s ?? "").toLowerCase();

export default function Picker({ options, value, onChange, placeholder = "Type to search…", emptyLabel, onCreate, createLabel = "", autoFocus, invalid }) {
  const selected = options.find((o) => String(o.id) === String(value));
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef(null);
  const list = useRef(null);

  // every typed word must appear somewhere in the name, sku or extra text. Best first: names that start with what
  // you typed ("mo" → Mop, Mop Stick, Mop Refill), then names with a word starting with it, then anything containing it.
  const matches = useMemo(() => {
    const q = norm(text).trim();
    const words = q.split(/\s+/).filter(Boolean);
    if (!words.length) return options.slice(0, 60);
    const rank = (o) => {
      const name = norm(o.label);
      if (name.startsWith(q)) return 0;
      if (name.split(/[\s\-/(),.]+/).some((w) => w.startsWith(words[0]))) return 1;
      return 2;
    };
    return options.filter((o) => words.every((w) => norm(`${o.label} ${o.search || ""}`).includes(w)))
      .map((o) => [rank(o), o]).sort((a, b) => a[0] - b[0] || a[1].label.length - b[1].label.length || a[1].label.localeCompare(b[1].label))
      .map(([, o]) => o).slice(0, 60);
  }, [options, text]);
  const exact = options.some((o) => norm(o.label) === norm(text).trim());
  const canCreate = onCreate && text.trim() && !exact;
  // real suggestions first, then "+ Add new", then the "not in the list" choice
  const rows = [...matches, ...(canCreate ? [{ create: true }] : []), ...(emptyLabel ? [{ id: "", label: emptyLabel, empty: true }] : [])];

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!box.current?.contains(e.target)) { setOpen(false); setText(""); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => { list.current?.children[hi]?.scrollIntoView({ block: "nearest" }); }, [hi]);

  const choose = (row) => {
    setOpen(false);
    if (row.create) { onCreate(text.trim()); setText(""); return; }
    setText("");
    onChange(row.id);
  };
  const key = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && open && rows[hi]) { e.preventDefault(); choose(rows[hi]); }
    else if (e.key === "Escape") { setOpen(false); setText(""); }
  };

  return (
    <div className={`picker ${open ? "open" : ""}`} ref={box}>
      <input
        value={open ? text : selected?.label || ""}
        placeholder={selected ? selected.label : placeholder}
        autoFocus={autoFocus}
        className={invalid ? "invalid" : ""}
        onFocus={() => { setOpen(true); setHi(0); }}
        onChange={(e) => { setText(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={key}
        role="combobox" aria-expanded={open} aria-autocomplete="list"
      />
      {open && (
        <ul className="picker-list" role="listbox" ref={list}>
          {rows.map((r, i) => (
            <li key={r.create ? "__create" : `o${r.id}`} role="option" aria-selected={i === hi} className={`${i === hi ? "hi" : ""} ${r.create ? "create" : ""} ${r.empty ? "blank" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); choose(r); }} onMouseEnter={() => setHi(i)}>
              {r.create ? <>+ Add new {createLabel} “<b>{text.trim()}</b>”</> : <><span>{r.label}</span>{r.sub && <small>{r.sub}</small>}</>}
            </li>
          ))}
          {rows.length === 0 && <li className="none">No match{onCreate ? "" : ". Ask someone who can add it."}</li>}
        </ul>
      )}
    </div>
  );
}
