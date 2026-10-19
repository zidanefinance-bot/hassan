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
import Payments, { PaymentView, RecordPayment } from "./pages/Payments.jsx";
import Expenses from "./pages/Expenses.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import Inbox from "./pages/Inbox.jsx";
import Account from "./pages/Account.jsx";
import Bell from "./components/Notifications.jsx";
import GlobalSearch from "./components/GlobalSearch.jsx";
import { registerServiceWorker, useInstall } from "./pwa.js";

const NAV = [
  { to: "/", label: "Home", icon: "⌂", end: true },
  { to: "/inbox", label: "Orders Inbox", icon: "✉", any: ["sales.write", "buy", "admin"] },
  { to: "/jobs", label: "Jobs", icon: "▣", any: ["sales.read", "ops.read"] },
  { to: "/procurement", label: "Procurement", icon: "⛟", any: ["buy"] },
  { to: "/items", label: "Items", icon: "◫" },
  { group: "Sales", any: ["sales.read"] },
  { to: "/customers", label: "Customers", icon: "☺", any: ["sales.read"] },
  { to: "/quotes", label: "Enquiries & Quotes", icon: "✎", any: ["sales.read"] },
  { to: "/delivery-challans", label: "Delivery Challans", icon: "⇥", any: ["sales.read"] },
  { to: "/invoices", label: "Invoices", icon: "▤", any: ["sales.read"] },
  { to: "/credit-notes", label: "Credit Notes", icon: "↺", any: ["sales.read"] },
  { group: "Operations", any: ["ops.read"] },
  { to: "/suppliers", label: "Suppliers", icon: "⚑", any: ["ops.read"] },
  { to: "/purchase-orders", label: "Purchase Orders", icon: "✉", any: ["ops.read"] },
  { to: "/bills", label: "Supplier Bills", icon: "▥", any: ["ops.read"] },
  { to: "/vendor-credits", label: "Vendor Credits", icon: "↻", any: ["ops.read"] },
  { group: "Accounts", any: ["money", "expenses"] },
  { to: "/payments-received", label: "Payments Received", icon: "↓", any: ["money"] },
  { to: "/payments-made", label: "Payments Made", icon: "↑", any: ["money"] },
  { to: "/expenses", label: "Expenses", icon: "₨", any: ["expenses"] },
  { group: "Business", any: ["reports.finance", "sales.read", "admin"] },
  { to: "/reports", label: "Reports", icon: "▲", any: ["reports.finance", "sales.read"] },
  { to: "/settings", label: "Settings", icon: "⚙", any: ["admin"] },
  { group: "You" },
  { to: "/account", label: "My account & app", icon: "☻" },
];

function Shell() {
  const { user, logout, can, retry } = useAuth();
  const install = useInstall();
  const [open, setOpen] = React.useState(false);
  if (user === undefined) return <div className="empty">Loading…</div>;
  if (user === "offline") return (
    <div className="offline-screen"><img src="/icons/icon-192.png" alt="" /><h1>No internet connection</h1>
      <p>Zidane Books needs the internet to show live figures.<br />Internet nahi hai. Connection aate hi khud khul jayegi.</p>
      <button className="btn primary" onClick={retry}>Try again</button></div>
  );
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
          <GlobalSearch />
          <div className="spacer" />
          {install.canInstall && <button className="btn sm install-btn" onClick={install.install}>⬇ Install app</button>}
          <Bell />
          <NavLink className="user" to="/account" title="My account"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><small>{user.role_label}</small></div></NavLink>
          <button className="btn ghost signout" onClick={logout} title="Sign out"><span className="so-text">Sign out</span><span className="so-icon" aria-hidden>⏻</span></button>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/new" element={<JobForm />} />
            <Route path="/jobs/:id" element={<JobView />} />
            <Route path="/jobs/:id/edit" element={<JobForm />} />
            <Route path="/procurement" element={<Procurement />} />
            <Route path="/items" element={<Items />} />
            <Route path="/items/:id" element={<ItemView />} />
            <Route path="/customers" element={<Contacts type="customer" />} />
            <Route path="/suppliers" element={<Contacts type="supplier" />} />
            <Route path="/contacts/:id" element={<ContactView />} />
            {["quote", "dc", "invoice", "credit_note", "po", "bill", "vendor_credit"].map((k) => [
              <Route key={k} path={`/${pathOf(k)}`} element={<Documents kind={k} />} />,
              <Route key={k + "n"} path={`/${pathOf(k)}/new`} element={<DocumentForm kind={k} />} />,
              <Route key={k + "v"} path={`/${pathOf(k)}/:id`} element={<DocumentView kind={k} />} />,
              <Route key={k + "e"} path={`/${pathOf(k)}/:id/edit`} element={<DocumentForm kind={k} />} />,
            ])}
            <Route path="/payments-received" element={<Payments direction="in" />} />
            <Route path="/payments-made" element={<Payments direction="out" />} />
            <Route path="/payments/new" element={<RecordPayment />} />
            <Route path="/payments/:id" element={<PaymentView />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
const pathOf = (k) => ({ quote: "quotes", dc: "delivery-challans", invoice: "invoices", credit_note: "credit-notes", po: "purchase-orders", bill: "bills", vendor_credit: "vendor-credits" })[k];

registerServiceWorker();
createRoot(document.getElementById("root")).render(
  <BrowserRouter><ToastProvider><AuthProvider><Shell /></AuthProvider></ToastProvider></BrowserRouter>,
);
