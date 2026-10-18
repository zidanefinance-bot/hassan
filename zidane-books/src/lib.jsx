// Shared helpers: API client, formatting, auth context and small UI pieces.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
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
  useEffect(() => { api("/auth/me").then(setUser).catch(() => setUser(null)); }, []);
  const login = async (email, password) => setUser(await api("/auth/login", { method: "POST", body: { email, password } }));
  const logout = async () => { await api("/auth/logout", { method: "POST" }); setUser(null); };
  return <AuthCtx.Provider value={{ user, login, logout, can: (p) => Boolean(user?.perms?.includes(p)) }}>{children}</AuthCtx.Provider>;
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
