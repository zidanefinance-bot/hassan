import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import "./styles.css";
import { AuthProvider, ToastProvider, useAuth } from "./lib.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Jobs, { JobForm, JobView } from "./pages/Jobs.jsx";
import Procurement from "./pages/Procurement.jsx";
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
  { to: "/", label: "Home", icon: "⌂", end: true },
  { to: "/jobs", label: "Jobs", icon: "▣", any: ["sales.read", "ops.read"] },
  { to: "/procurement", label: "Procurement", icon: "⛟", any: ["buy"] },
  { to: "/items", label: "Items", icon: "◫" },
  { group: "Sales", any: ["sales.read"] },
  { to: "/customers", label: "Customers", icon: "☺", any: ["sales.read"] },
  { to: "/quotes", label: "Enquiries & Quotes", icon: "✎", any: ["sales.read"] },
  { to: "/delivery-challans", label: "Delivery Challans", icon: "⇥", any: ["sales.read"] },
  { to: "/invoices", label: "Invoices", icon: "▤", any: ["sales.read"] },
  { group: "Operations", any: ["ops.read"] },
  { to: "/suppliers", label: "Suppliers", icon: "⚑", any: ["ops.read"] },
  { to: "/purchase-orders", label: "Purchase Orders", icon: "✉", any: ["ops.read"] },
  { to: "/bills", label: "Supplier Bills", icon: "▥", any: ["ops.read"] },
  { group: "Accounts", any: ["money", "expenses"] },
  { to: "/payments-received", label: "Payments Received", icon: "↓", any: ["money"] },
  { to: "/payments-made", label: "Payments Made", icon: "↑", any: ["money"] },
  { to: "/expenses", label: "Expenses", icon: "₨", any: ["expenses"] },
  { group: "Business", any: ["reports.finance", "sales.read", "admin"] },
  { to: "/reports", label: "Reports", icon: "▲", any: ["reports.finance", "sales.read"] },
  { to: "/settings", label: "Settings", icon: "⚙", any: ["admin"] },
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
          {NAV.filter((n) => !n.any || n.any.some(can)).map((n, i) =>
            n.group ? <div key={i} className="nav-group">{n.group}</div>
              : <NavLink key={n.to} to={n.to} end={n.end}><span className="nav-icon">{n.icon}</span>{n.label}</NavLink>)}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu" onClick={() => setOpen((o) => !o)} aria-label="Menu">☰</button>
          <div className="spacer" />
          <div className="user"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><small>{user.role_label}</small></div></div>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/new" element={<JobForm />} />
            <Route path="/jobs/:id" element={<JobView />} />
            <Route path="/procurement" element={<Procurement />} />
            <Route path="/items" element={<Items />} />
            <Route path="/items/:id" element={<ItemView />} />
            <Route path="/customers" element={<Contacts type="customer" />} />
            <Route path="/suppliers" element={<Contacts type="supplier" />} />
            <Route path="/contacts/:id" element={<ContactView />} />
            {["quote", "dc", "invoice", "po", "bill"].map((k) => [
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
const pathOf = (k) => ({ quote: "quotes", dc: "delivery-challans", invoice: "invoices", po: "purchase-orders", bill: "bills" })[k];

createRoot(document.getElementById("root")).render(
  <BrowserRouter><ToastProvider><AuthProvider><Shell /></AuthProvider></ToastProvider></BrowserRouter>,
);
