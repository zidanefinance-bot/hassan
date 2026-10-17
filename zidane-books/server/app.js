// HTTP API. Every route except login needs a signed-in user, and each one checks the role's caps (auth.js).
// Hiding something in the UI is never the only protection: costs, selling rates and margins are stripped here.
import express from "express";
import cookieParser from "cookie-parser";
import { authMiddleware, can, checkPassword, createSession, hashPassword, requirePerm, requireUser, ROLE_LABELS, ROLES } from "./auth.js";
import * as B from "./books.js";
import * as J from "./jobs.js";
import * as R from "./reports.js";

const { httpError, round2, today } = B;
const DOC_READ = { quote: ["sales.read"], invoice: ["sales.read"], dc: ["sales.read"], po: ["ops.read"], bill: ["ops.read"] };
const DOC_WRITE = { quote: ["sales.write"], invoice: ["sales.write"], dc: ["sales.write"], po: ["ops.write", "buy"], bill: ["ops.write", "buy"] };
const CONTACT_READ = { customer: ["sales.read"], supplier: ["ops.read"] };
const CONTACT_WRITE = { customer: ["sales.write"], supplier: ["ops.write"] };

export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(authMiddleware(db));
  const api = express.Router();
  const canAny = (user, perms = []) => perms.some((p) => can(user, p));
  const need = (user, perms) => { if (!canAny(user, Array.isArray(perms) ? perms : [perms])) throw httpError(403, "You don't have access to this"); };
  const id = (req) => Number(req.params.id);
  const cans = (req) => (p) => can(req.user, p);
  // selling rate is Sales/Accounts/Director only; purchase cost is Operations/Accounts/Director only
  const shapeItem = (req, i) => {
    const out = { ...i };
    if (!can(req.user, "cost.view")) delete out.purchase_rate;
    if (!can(req.user, "price.view")) delete out.sale_rate;
    return out;
  };

  // ---- auth
  api.post("/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    const u = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(String(email || "").trim());
    if (!u || !checkPassword(String(password || ""), u.password_hash)) throw httpError(401, "Wrong email or password");
    const s = createSession(db, u.id);
    res.cookie("zb_session", s.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1", maxAge: s.maxAge });
    res.json({ id: u.id, name: u.name, email: u.email, role: u.role, role_label: ROLE_LABELS[u.role], perms: ROLES[u.role] });
  });
  api.post("/auth/logout", (req, res) => {
    if (req.cookies?.zb_session) db.prepare("DELETE FROM sessions WHERE token = ?").run(req.cookies.zb_session);
    res.clearCookie("zb_session").json({ ok: true });
  });
  api.use(requireUser);
  api.get("/auth/me", (req, res) => res.json({ ...req.user, role_label: ROLE_LABELS[req.user.role], perms: ROLES[req.user.role] }));
  api.post("/auth/password", (req, res) => {
    const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!checkPassword(String(req.body.current || ""), u.password_hash)) throw httpError(400, "Current password is wrong");
    if (String(req.body.next || "").length < 8) throw httpError(400, "New password needs at least 8 characters");
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(req.body.next), u.id);
    res.json({ ok: true });
  });

  // ---- users (director)
  api.get("/users", requirePerm("admin"), (_req, res) => res.json(db.prepare("SELECT id, name, email, role, active, created_at FROM users ORDER BY id").all()));
  api.post("/users", requirePerm("admin"), (req, res) => {
    const { name, email, role, password } = req.body;
    if (!name || !email || !ROLES[role]) throw httpError(400, "Name, email and a valid role are required");
    if (String(password || "").length < 8) throw httpError(400, "Password needs at least 8 characters");
    try {
      const r = db.prepare("INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)").run(name, email.trim(), role, hashPassword(password));
      B.log(db, req.user.id, "added user", "user", Number(r.lastInsertRowid), `${name} (${ROLE_LABELS[role]})`);
      res.json({ id: Number(r.lastInsertRowid) });
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) throw httpError(400, "This email already has an account");
      throw e;
    }
  });
  api.put("/users/:id", requirePerm("admin"), (req, res) => {
    const { name, role, active, password } = req.body;
    if (role && !ROLES[role]) throw httpError(400, "Invalid role");
    if (id(req) === req.user.id && (active === false || (role && role !== "director"))) throw httpError(400, "You can't remove your own director access");
    const u = db.prepare("SELECT * FROM users WHERE id = ?").get(id(req));
    if (!u) throw httpError(404, "Not found");
    db.prepare("UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?").run(name ?? u.name, role ?? u.role, active === undefined ? u.active : active ? 1 : 0, u.id);
    if (password) {
      if (password.length < 8) throw httpError(400, "Password needs at least 8 characters");
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), u.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
    }
    if (active === false || (role && role !== u.role)) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
    res.json({ ok: true });
  });

  // ---- settings
  api.get("/settings", (_req, res) => {
    const out = {};
    for (const r of db.prepare("SELECT key, value FROM settings").all()) out[r.key] = JSON.parse(r.value);
    res.json(out);
  });
  api.put("/settings", requirePerm("admin"), (req, res) => {
    const allowed = ["company", "taxes", "prefixes", "nextNumbers", "paymentTermsDays", "expenseCategories", "jobExpenseCategories", "invoiceFooter"];
    for (const [k, v] of Object.entries(req.body || {})) if (allowed.includes(k)) B.setSetting(db, k, v);
    B.log(db, req.user.id, "updated settings", "settings", null, Object.keys(req.body || {}).join(", "));
    res.json({ ok: true });
  });

  // ---- contacts
  api.get("/contacts", (req, res) => {
    const type = req.query.type;
    if (type) need(req.user, CONTACT_READ[type] || "admin");
    const q = `%${req.query.q || ""}%`;
    const rows = db.prepare(`SELECT c.*,
      COALESCE((SELECT SUM(d.total) FROM documents d WHERE d.contact_id = c.id AND d.kind IN ('invoice','bill') AND d.status = 'open'), 0)
      - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.contact_id = c.id AND p.document_id IS NOT NULL), 0) AS outstanding
      FROM contacts c WHERE (? IS NULL OR c.type = ?) AND (c.name LIKE ? OR IFNULL(c.company,'') LIKE ? OR IFNULL(c.phone,'') LIKE ?) ORDER BY c.name`)
      .all(type || null, type || null, q, q, q);
    res.json(rows.filter((c) => canAny(req.user, CONTACT_READ[c.type])).map((c) => ({ ...c, outstanding: round2(c.outstanding) })));
  });
  api.get("/contacts/:id", (req, res) => {
    const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id(req));
    if (!c) throw httpError(404, "Not found");
    need(req.user, CONTACT_READ[c.type]);
    const docs = db.prepare("SELECT d.*, COALESCE((SELECT SUM(amount) FROM payments p WHERE p.document_id = d.id), 0) AS paid FROM documents d WHERE contact_id = ? ORDER BY date DESC, id DESC").all(c.id)
      .map((d) => ({ ...d, paid: round2(d.paid), display_status: B.displayStatus(d, d.paid) }));
    const jobs = c.type === "customer" ? db.prepare("SELECT id, number, ops_status, required_date, closed FROM jobs WHERE customer_id = ? ORDER BY id DESC").all(c.id) : [];
    const payments = can(req.user, "money") ? db.prepare("SELECT * FROM payments WHERE contact_id = ? ORDER BY date DESC, id DESC").all(c.id) : [];
    res.json({ ...c, documents: docs, jobs, payments });
  });
  const contactFields = (b) => [b.name, b.company || null, b.phone || null, b.email || null, b.address || null, b.ntn || null, Number(b.opening_balance) || 0, b.notes || null];
  api.post("/contacts", (req, res) => {
    const b = req.body;
    if (!CONTACT_WRITE[b.type]) throw httpError(400, "Type must be customer or supplier");
    need(req.user, CONTACT_WRITE[b.type]);
    if (!b.name?.trim()) throw httpError(400, "Name is required");
    const r = db.prepare("INSERT INTO contacts (type, name, company, phone, email, address, ntn, opening_balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(b.type, ...contactFields(b));
    B.log(db, req.user.id, "added", b.type, Number(r.lastInsertRowid), b.name);
    res.json({ id: Number(r.lastInsertRowid) });
  });
  api.put("/contacts/:id", (req, res) => {
    const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id(req));
    if (!c) throw httpError(404, "Not found");
    need(req.user, CONTACT_WRITE[c.type]);
    db.prepare("UPDATE contacts SET name=?, company=?, phone=?, email=?, address=?, ntn=?, opening_balance=?, notes=? WHERE id=?").run(...contactFields({ ...c, ...req.body }), c.id);
    res.json({ ok: true });
  });
  api.delete("/contacts/:id", (req, res) => {
    const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id(req));
    if (!c) throw httpError(404, "Not found");
    need(req.user, CONTACT_WRITE[c.type]);
    if (db.prepare("SELECT 1 FROM documents WHERE contact_id = ? UNION SELECT 1 FROM payments WHERE contact_id = ? UNION SELECT 1 FROM jobs WHERE customer_id = ?").get(c.id, c.id, c.id)) throw httpError(400, "This contact has transactions. It can't be deleted.");
    db.prepare("DELETE FROM contacts WHERE id = ?").run(c.id);
    res.json({ ok: true });
  });

  // ---- items (everyone reads; rates shaped by role)
  api.get("/items", (req, res) => {
    const q = `%${req.query.q || ""}%`;
    res.json(db.prepare("SELECT * FROM items WHERE active = 1 AND (name LIKE ? OR IFNULL(sku,'') LIKE ? OR IFNULL(category,'') LIKE ?) ORDER BY name").all(q, q, q).map((i) => shapeItem(req, i)));
  });
  api.get("/items/:id", (req, res) => {
    const i = db.prepare("SELECT * FROM items WHERE id = ?").get(id(req));
    if (!i) throw httpError(404, "Not found");
    res.json({ ...shapeItem(req, i), moves: db.prepare("SELECT * FROM stock_moves WHERE item_id = ? ORDER BY id DESC LIMIT 100").all(i.id) });
  });
  const itemFields = (b) => [b.name, b.sku || null, b.unit || "pcs", b.category || null, Number(b.purchase_rate) || 0, Number(b.sale_rate) || 0, Number(b.tax_rate) || 0, Number(b.reorder_level) || 0, b.track_stock === false ? 0 : 1];
  api.post("/items", requirePerm("items.write"), (req, res) => {
    const b = req.body;
    if (!b.name?.trim()) throw httpError(400, "Name is required");
    const r = db.prepare("INSERT INTO items (name, sku, unit, category, purchase_rate, sale_rate, tax_rate, reorder_level, track_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...itemFields(b));
    const newId = Number(r.lastInsertRowid);
    if (Number(b.opening_stock)) B.adjustStock(db, req.user.id, newId, b.opening_stock, "opening stock");
    B.log(db, req.user.id, "added", "item", newId, b.name);
    res.json({ id: newId });
  });
  api.put("/items/:id", requirePerm("items.write"), (req, res) => {
    const i = db.prepare("SELECT * FROM items WHERE id = ?").get(id(req));
    if (!i) throw httpError(404, "Not found");
    const body = { ...req.body };
    if (!can(req.user, "price.view")) delete body.sale_rate; // operations can't change selling rates
    db.prepare("UPDATE items SET name=?, sku=?, unit=?, category=?, purchase_rate=?, sale_rate=?, tax_rate=?, reorder_level=?, track_stock=? WHERE id=?").run(...itemFields({ ...i, track_stock: !!i.track_stock, ...body }), i.id);
    res.json({ ok: true });
  });
  api.post("/items/:id/adjust", requirePerm("items.write"), (req, res) => { B.adjustStock(db, req.user.id, id(req), req.body.qty, req.body.reason); res.json({ ok: true }); });
  api.delete("/items/:id", requirePerm("items.write"), (req, res) => {
    db.prepare("UPDATE items SET active = 0 WHERE id = ?").run(id(req)); // keep history, hide from lists
    res.json({ ok: true });
  });

  // ---- jobs
  const needJobs = (req) => need(req.user, ["sales.read", "ops.read"]);
  api.get("/jobs", (req, res) => { needJobs(req); res.json(J.jobList(db, req.query)); });
  api.get("/jobs/:id", (req, res) => { needJobs(req); res.json(J.jobDetail(db, id(req), cans(req))); });
  api.post("/jobs", requirePerm("sales.write"), (req, res) => res.json({ id: J.createJob(db, req.user.id, req.body) }));
  api.put("/jobs/:id", requirePerm("sales.write"), (req, res) => { J.updateJob(db, req.user.id, id(req), req.body); res.json({ ok: true }); });
  api.post("/jobs/:id/ops-status", requirePerm("ops.write"), (req, res) => { J.setOpsStatus(db, req.user.id, id(req), req.body.status); res.json({ ok: true }); });
  api.post("/jobs/:id/dc", requirePerm("sales.write"), (req, res) => res.json({ id: J.dcFromJob(db, req.user.id, id(req)) }));
  api.post("/jobs/:id/invoice", requirePerm("sales.write"), (req, res) => res.json({ id: J.invoiceFromJob(db, req.user.id, id(req)) }));
  api.post("/jobs/:id/close", requirePerm("admin"), (req, res) => { J.closeJob(db, req.user.id, id(req), req.body.closed !== false); res.json({ ok: true }); });
  api.post("/job-items/:id/procurement", requirePerm("buy"), (req, res) => { J.setItemProcurement(db, req.user.id, id(req), req.body.status); res.json({ ok: true }); });
  api.get("/procurement", (req, res) => { need(req.user, ["buy", "ops.read"]); res.json(J.procurementList(db)); });

  // ---- documents (quotes/enquiries, invoices, customer DCs, purchase orders, supplier bills)
  api.get("/documents", (req, res) => {
    const kind = req.query.kind;
    need(req.user, DOC_READ[kind] || "admin");
    const q = `%${req.query.q || ""}%`;
    const rows = db.prepare(`SELECT d.*, c.name AS contact_name, j.number AS job_number, COALESCE((SELECT SUM(amount) FROM payments p WHERE p.document_id = d.id), 0) AS paid
      FROM documents d JOIN contacts c ON c.id = d.contact_id LEFT JOIN jobs j ON j.id = d.job_id WHERE d.kind = ? AND (d.number LIKE ? OR c.name LIKE ? OR IFNULL(j.number,'') LIKE ?) ORDER BY d.date DESC, d.id DESC LIMIT 500`).all(kind, q, q, q)
      .map((d) => ({ ...d, paid: round2(d.paid), balance: round2(d.total - d.paid), display_status: B.displayStatus(d, d.paid) }));
    const status = req.query.status;
    res.json(status ? rows.filter((d) => d.display_status === status) : rows);
  });
  const loadDoc = (req, perms) => {
    const d = db.prepare("SELECT * FROM documents WHERE id = ?").get(id(req));
    if (!d) throw httpError(404, "Not found");
    need(req.user, perms[d.kind]);
    return d;
  };
  api.get("/documents/:id", (req, res) => {
    const d = loadDoc(req, DOC_READ);
    const paid = B.paidAmount(db, d.id);
    res.json({
      ...d, paid, balance: round2(d.total - paid), display_status: B.displayStatus(d, paid),
      contact: db.prepare("SELECT * FROM contacts WHERE id = ?").get(d.contact_id),
      lines: db.prepare("SELECT l.id, l.item_id, l.description, l.qty, l.rate, l.discount_pct, l.tax_rate, l.amount, i.name AS item_name, i.unit FROM document_lines l LEFT JOIN items i ON i.id = l.item_id WHERE document_id = ? ORDER BY l.id").all(d.id),
      payments: db.prepare("SELECT * FROM payments WHERE document_id = ? ORDER BY date, id").all(d.id),
      source: d.source_id ? db.prepare("SELECT id, kind, number FROM documents WHERE id = ?").get(d.source_id) : null,
      children: db.prepare("SELECT id, kind, number FROM documents WHERE source_id = ?").all(d.id),
      job: d.job_id ? db.prepare("SELECT id, number, customer_po_number, delivery_location FROM jobs WHERE id = ?").get(d.job_id) : null,
      verified_by_name: d.verified_by ? db.prepare("SELECT name FROM users WHERE id = ?").get(d.verified_by)?.name : null,
    });
  });
  api.post("/documents", (req, res) => { need(req.user, DOC_WRITE[req.body.kind] || "admin"); res.json({ id: B.saveDocument(db, req.user.id, req.body) }); });
  api.put("/documents/:id", (req, res) => {
    const d = loadDoc(req, DOC_WRITE);
    if (d.verified_at && !can(req.user, "admin")) throw httpError(400, "This document is verified by Accounts. Ask a director to change it.");
    const paid = B.paidAmount(db, d.id);
    if (paid > 0 && B.computeLines(req.body.lines || []).total < paid) throw httpError(400, "Total can't go below what's already paid");
    B.saveDocument(db, req.user.id, { ...req.body, kind: d.kind }, d.id);
    if (d.verified_at) db.prepare("UPDATE documents SET verified_at = NULL, verified_by = NULL WHERE id = ?").run(d.id); // changed after verification → verify again
    res.json({ id: d.id });
  });
  const docAction = (perms, fn) => (req, res) => { const d = loadDoc(req, perms); res.json(fn(req, d) ?? { ok: true }); };
  api.post("/documents/:id/status", docAction(DOC_WRITE, (req) => { B.setStatus(db, req.user.id, id(req), req.body.status); }));
  api.post("/documents/:id/convert", docAction(DOC_WRITE, (req) => ({ id: B.convertDocument(db, req.user.id, id(req)) })));
  api.post("/documents/:id/job", docAction(DOC_WRITE, (req, d) => {
    if (d.kind !== "quote") throw httpError(400, "Only quotes become Jobs");
    return { id: J.jobFromQuote(db, req.user.id, d.id, req.body || {}) };
  }));
  api.post("/documents/:id/sign", docAction(DOC_WRITE, (req) => { J.signDc(db, req.user.id, id(req), req.body || {}); }));
  api.post("/documents/:id/submit", docAction(DOC_WRITE, (req, d) => {
    if (d.kind !== "invoice" || d.status !== "open") throw httpError(400, "Issue the invoice before marking it submitted");
    db.prepare("UPDATE documents SET submitted_date = ? WHERE id = ?").run(req.body?.date || today(), d.id);
    B.log(db, req.user.id, "submitted invoice", "invoice", d.id, d.number);
  }));
  api.post("/documents/:id/verify", (req, res) => {
    need(req.user, "verify");
    const d = db.prepare("SELECT * FROM documents WHERE id = ?").get(id(req));
    if (!d || !["invoice", "bill"].includes(d.kind)) throw httpError(400, "Only invoices and supplier bills are verified");
    if (d.status !== "open") throw httpError(400, "Only issued documents can be verified");
    db.prepare("UPDATE documents SET verified_at = datetime('now'), verified_by = ? WHERE id = ?").run(req.user.id, d.id);
    B.log(db, req.user.id, "verified", d.kind, d.id, d.number);
    res.json({ ok: true });
  });
  api.delete("/documents/:id", docAction(DOC_WRITE, (req, d) => {
    if ((d.verified_at || (d.kind === "dc" && d.status === "signed")) && !can(req.user, "admin")) throw httpError(400, "Verified invoices/bills and signed DCs can only be removed by a director");
    B.deleteDocument(db, req.user.id, d.id);
  }));

  // ---- payments (Accounts)
  api.get("/payments", requirePerm("money"), (req, res) => {
    res.json(db.prepare(`SELECT p.*, c.name AS contact_name, d.number AS document_number, d.kind AS document_kind FROM payments p JOIN contacts c ON c.id = p.contact_id
      LEFT JOIN documents d ON d.id = p.document_id WHERE p.direction = ? ORDER BY p.date DESC, p.id DESC LIMIT 500`).all(req.query.direction === "out" ? "out" : "in"));
  });
  api.post("/payments", requirePerm("money"), (req, res) => res.json({ id: B.recordPayment(db, req.user.id, req.body) }));
  api.delete("/payments/:id", requirePerm("money"), (req, res) => {
    const p = db.prepare("SELECT * FROM payments WHERE id = ?").get(id(req));
    if (!p) throw httpError(404, "Not found");
    db.prepare("DELETE FROM payments WHERE id = ?").run(p.id);
    B.log(db, req.user.id, "deleted payment", "payment", p.id, String(p.amount));
    res.json({ ok: true });
  });

  // ---- expenses: company expenses are Accounts'; job-direct costs (freight, loading…) are Operations'
  const canExpense = (user, jobId) => can(user, "expenses") || (jobId && can(user, "buy"));
  api.get("/expenses", requirePerm("expenses"), (req, res) => {
    const from = req.query.from || "0000-01-01", to = req.query.to || "9999-12-31";
    res.json(db.prepare("SELECT e.*, c.name AS contact_name, j.number AS job_number FROM expenses e LEFT JOIN contacts c ON c.id = e.contact_id LEFT JOIN jobs j ON j.id = e.job_id WHERE date BETWEEN ? AND ? ORDER BY date DESC, e.id DESC").all(from, to));
  });
  const expFields = (b) => {
    if (!b.category) throw httpError(400, "Category is required");
    if (!(Number(b.amount) > 0)) throw httpError(400, "Amount must be more than zero");
    return [b.date || today(), b.category, round2(b.amount), b.paid_through || "cash", b.contact_id || null, b.job_id || null, b.reference || null, b.notes || null];
  };
  api.post("/expenses", (req, res) => {
    if (!canExpense(req.user, req.body.job_id)) throw httpError(403, "You don't have access to this");
    const r = db.prepare("INSERT INTO expenses (date, category, amount, paid_through, contact_id, job_id, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...expFields(req.body), req.user.id);
    B.log(db, req.user.id, req.body.job_id ? "added job cost" : "added expense", "expense", Number(r.lastInsertRowid), `${req.body.category} · ${req.body.amount}`);
    res.json({ id: Number(r.lastInsertRowid) });
  });
  const loadExp = (req) => {
    const e = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id(req));
    if (!e) throw httpError(404, "Not found");
    if (!canExpense(req.user, e.job_id)) throw httpError(403, "You don't have access to this");
    return e;
  };
  api.put("/expenses/:id", (req, res) => {
    const e = loadExp(req);
    db.prepare("UPDATE expenses SET date=?, category=?, amount=?, paid_through=?, contact_id=?, job_id=?, reference=?, notes=? WHERE id=?").run(...expFields({ ...req.body, job_id: e.job_id }), e.id);
    res.json({ ok: true });
  });
  api.delete("/expenses/:id", (req, res) => { const e = loadExp(req); db.prepare("DELETE FROM expenses WHERE id = ?").run(e.id); res.json({ ok: true }); });

  // ---- reports
  const range = (req) => [req.query.from || today().slice(0, 8) + "01", req.query.to || today()];
  api.get("/reports/home", (req, res) => res.json(R.home(db, req.user, cans(req))));
  api.get("/reports/pnl", requirePerm("reports.finance"), (req, res) => res.json(R.profitAndLoss(db, ...range(req))));
  api.get("/reports/tax", requirePerm("reports.finance"), (req, res) => res.json(R.taxSummary(db, ...range(req))));
  api.get("/reports/receivables", (req, res) => { need(req.user, ["reports.finance", "sales.read"]); res.json(R.receivables(db)); });
  api.get("/reports/payables", requirePerm("reports.finance"), (_req, res) => res.json(R.payables(db)));
  api.get("/reports/inventory", requirePerm("reports.finance"), (_req, res) => res.json(R.inventory(db)));
  api.get("/reports/sales-by-customer", (req, res) => { need(req.user, ["reports.finance", "sales.read"]); res.json(R.salesByCustomer(db, ...range(req))); });
  api.get("/reports/sales-by-item", requirePerm("reports.finance"), (req, res) => res.json(R.salesByItem(db, ...range(req))));
  api.get("/reports/job-profit", requirePerm("profit.view"), (req, res) => res.json(R.jobProfit(db, ...range(req))));

  app.use("/api", api);
  app.use("/api", (_req, _res, next) => next(httpError(404, "Not found")));
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "Something went wrong on the server" : err.message });
  });
  return app;
}
