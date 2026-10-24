// Shared helpers: API client, formatting, auth context and small UI pieces.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export async function api(path, { method = "GET", body, headers = {} } = {}) {
  const send = (extra = {}) => fetch(`/api${path}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers, ...extra }, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
  let res = await send();
  let data = await res.json().catch(() => ({}));
  // editing or deleting a record asks why; the answer goes with the request and into the record's activity
  if (res.status === 428 && data.code === "reason_required") {
    const reason = await askReason(data);
    if (!reason) { const err = new Error("Not done: a reason is needed"); err.cancelled = true; quiet.add(err.message); throw err; }
    res = await send({ "x-reason": encodeURIComponent(reason) });
    data = await res.json().catch(() => ({}));
  }
  if (res.status === 202 && data.pending) {
    notice(data.message || "Sent to the Director for approval.");
    const err = new Error(data.message || "Sent to the Director for approval"); err.pending = true; quiet.add(err.message); throw err;
  }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  if (method !== "GET") window.dispatchEvent(new Event("zb:changed"));
  return data;
}

// messages api() already showed (or that need no toast): a page's error toast skips them
const quiet = new Set();

// A small "why?" box, drawn outside React so any api() call can ask it
function askReason({ action, what }) {
  return new Promise((resolve) => {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog"><div class="modal-head"><h2></h2><button class="icon-btn" aria-label="Close">×</button></div>
      <form class="form"><p class="muted"></p><label class="field"><span>Reason *</span><textarea rows="3" required placeholder="e.g. customer changed the quantity / entered twice by mistake"></textarea></label>
      <div class="form-actions"><button type="button" class="btn ghost">Cancel</button><button class="btn primary"></button></div></form></div>`;
    bg.querySelector("h2").textContent = action === "delete" ? "Why delete this?" : "Why the change?";
    bg.querySelector("p").textContent = `${what}${action === "delete" ? " · the Director can see the reason" : " · saved in its activity"}`;
    bg.querySelector(".btn.primary").textContent = action === "delete" ? "Delete" : "Save";
    const ta = bg.querySelector("textarea");
    const done = (v) => { bg.remove(); document.removeEventListener("keydown", esc); resolve(v); };
    const esc = (e) => e.key === "Escape" && done(null);
    document.addEventListener("keydown", esc);
    bg.querySelector(".icon-btn").onclick = bg.querySelector(".btn.ghost").onclick = () => done(null);
    bg.querySelector("form").onsubmit = (e) => { e.preventDefault(); const v = ta.value.trim(); if (v) done(v); };
    document.body.appendChild(bg);
    ta.focus();
  });
}

function notice(text) {
  const n = document.createElement("div");
  n.className = "notice-pop";
  n.textContent = "⏳ " + text;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 6000);
}

const pkr = new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n) => `Rs ${pkr.format(Number(n) || 0)}`;
export const num = (n) => new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(Number(n) || 0);
export const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

export const KIND = {
  quote: { label: "Quote", plural: "Enquiries & Quotes", path: "quotes", contact: "customer" },
  dc: { label: "Delivery Challan", plural: "Delivery Challans", path: "delivery-challans", contact: "customer" },
  invoice: { label: "Invoice", plural: "Invoices", path: "invoices", contact: "customer" },
  po: { label: "Purchase Order", plural: "Purchase Orders", path: "purchase-orders", contact: "supplier" },
  bill: { label: "Supplier Bill", plural: "Supplier Bills", path: "bills", contact: "supplier" },
  credit_note: { label: "Credit Note", plural: "Credit Notes", path: "credit-notes", contact: "customer" },
  vendor_credit: { label: "Vendor Credit", plural: "Vendor Credits", path: "vendor-credits", contact: "supplier" },
};

// ---- auth
const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  // no connection is not the same as signed out: show an offline screen instead of the login form
  const check = useCallback(() => api("/auth/me").then(setUser).catch((e) => setUser(e.status ? null : "offline")), []);
  useEffect(() => { check(); }, [check]);
  useEffect(() => { const on = () => user === "offline" && check(); window.addEventListener("online", on); return () => window.removeEventListener("online", on); }, [user, check]);
  const login = async (email, password) => setUser(await api("/auth/login", { method: "POST", body: { email, password } }));
  const logout = async () => { await api("/auth/logout", { method: "POST" }); setUser(null); };
  return <AuthCtx.Provider value={{ user, login, logout, retry: check, can: (p) => Boolean(user?.perms?.includes(p)) }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

// ---- data loading hook
export function useLoad(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(() => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    api(path).then((data) => setState({ data, error: null, loading: false, path })).catch((error) => setState({ data: null, error, loading: false, path }));
  }, [path]);
  useEffect(reload, [reload, ...deps]);
  return { ...state, reload };
}

// ---- toasts
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = "ok") => {
    if (kind !== "ok" && quiet.delete(msg)) return;
    const id = Math.random();
    setItems((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">{items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---- UI bits
export const STATUS_TONE = { closed: "green", enquiry: "amber", converted: "green", signed: "green", new: "red", procurement_started: "amber", partially_purchased: "amber", purchase_complete: "blue", material_ready: "green", dispatched: "blue", delivered: "green", draft: "grey", sent: "blue", open: "blue", issued: "blue", accepted: "green", paid: "green", invoiced: "green", billed: "green", partial: "amber", overdue: "red", declined: "red", void: "grey", cancelled: "grey" };
export const Badge = ({ status }) => <span className={`badge ${STATUS_TONE[status] || "grey"}`}>{String(status).replace(/_/g, " ")}</span>;
export const OPS_STEPS = ["new", "procurement_started", "partially_purchased", "purchase_complete", "material_ready", "dispatched", "delivered"];
export const label = (s) => String(s || "").replace(/_/g, " ");

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      <div className="actions">{children}</div>
    </div>
  );
}

export function Loading({ state, children }) {
  if (state.error) return <div className="empty error">{state.error.message}</div>;
  if (state.loading && !state.data) return <div className="empty">Loading…</div>;
  return children(state.data);
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small className="muted">{hint}</small>}</label>;
}

// form state helper: const [f, set] = useForm(init); <input {...set("name")} />
export function useForm(init) {
  const [f, setF] = useState(init);
  const bind = (k, type) => ({
    value: f[k] ?? "",
    onChange: (e) => setF((s) => ({ ...s, [k]: type === "checkbox" ? e.target.checked : e.target.value })),
    ...(type === "checkbox" ? { checked: !!f[k] } : {}),
  });
  return [f, bind, setF];
}

export function Search({ value, onChange, placeholder = "Search…" }) {
  return <input className="search" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}
