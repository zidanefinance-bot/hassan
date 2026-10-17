import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import "./styles.css";
import { AuthProvider, ToastProvider, useAuth } from "./lib.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Contacts, { ContactView } from "./pages/Contacts.jsx";
import Items, { ItemView } from "./pages/Items.jsx";
import Documents from "./pages/Documents.jsx";
import DocumentForm from "./pages/DocumentForm.jsx";
import DocumentView from "./pages/DocumentView.jsx";
import Payments from "./pages/Payments.jsx";
import Expenses from "./pages/Expenses.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";

const NAV = [
  { to: "/", label: "Dashboard", icon: "▦", end: true },
  { to: "/items", label: "Items", icon: "◫" },
  { group: "Sales", perm: "sales" },
  { to: "/customers", label: "Customers", icon: "☺", perm: "sales" },
  { to: "/quotes", label: "Quotes", icon: "✎", perm: "sales" },
  { to: "/invoices", label: "Invoices", icon: "▤", perm: "sales" },
  { to: "/payments-received", label: "Payments Received", icon: "↓", perm: "sales" },
  { group: "Purchases", perm: "purchases" },
  { to: "/suppliers", label: "Suppliers", icon: "⚑", perm: "purchases" },
  { to: "/purchase-orders", label: "Purchase Orders", icon: "✉", perm: "purchases" },
  { to: "/bills", label: "Bills", icon: "▥", perm: "purchases" },
  { to: "/payments-made", label: "Payments Made", icon: "↑", perm: "purchases" },
  { to: "/expenses", label: "Expenses", icon: "₨", perm: "expenses" },
  { group: "Business", perm: "reports" },
  { to: "/reports", label: "Reports", icon: "▲", perm: "reports" },
  { to: "/settings", label: "Settings", icon: "⚙", perm: "admin" },
];

function Shell() {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = React.useState(false);
  if (user === undefined) return <div className="empty">Loading…</div>;
  if (!user) return <Login />;
  return (
    <div className={`shell ${open ? "nav-open" : ""}`}>
      <aside className="sidebar" onClick={() => setOpen(false)}>
        <div className="brand"><img src="/logo-white.svg" alt="Zidane" /><span>Books</span></div>
        <nav>
          {NAV.filter((n) => !n.perm || can(n.perm)).map((n, i) =>
            n.group ? <div key={i} className="nav-group">{n.group}</div>
              : <NavLink key={n.to} to={n.to} end={n.end}><span className="nav-icon">{n.icon}</span>{n.label}</NavLink>)}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu" onClick={() => setOpen((o) => !o)} aria-label="Menu">☰</button>
          <div className="spacer" />
          <div className="user"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><small>{user.role}</small></div></div>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/items" element={<Items />} />
            <Route path="/items/:id" element={<ItemView />} />
            <Route path="/customers" element={<Contacts type="customer" />} />
            <Route path="/suppliers" element={<Contacts type="supplier" />} />
            <Route path="/contacts/:id" element={<ContactView />} />
            {["quote", "invoice", "po", "bill"].map((k) => [
              <Route key={k} path={`/${pathOf(k)}`} element={<Documents kind={k} />} />,
              <Route key={k + "n"} path={`/${pathOf(k)}/new`} element={<DocumentForm kind={k} />} />,
              <Route key={k + "v"} path={`/${pathOf(k)}/:id`} element={<DocumentView kind={k} />} />,
              <Route key={k + "e"} path={`/${pathOf(k)}/:id/edit`} element={<DocumentForm kind={k} />} />,
            ])}
            <Route path="/payments-received" element={<Payments direction="in" />} />
            <Route path="/payments-made" element={<Payments direction="out" />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
const pathOf = (k) => ({ quote: "quotes", invoice: "invoices", po: "purchase-orders", bill: "bills" })[k];

createRoot(document.getElementById("root")).render(
  <BrowserRouter><ToastProvider><AuthProvider><Shell /></AuthProvider></ToastProvider></BrowserRouter>,
);
