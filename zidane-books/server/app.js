// HTTP API. Every route except login needs a signed-in user, and each one checks the role's caps (auth.js).
// Hiding something in the UI is never the only protection: costs, selling rates and margins are stripped here.
import express from "express";
import cookieParser from "cookie-parser";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { authMiddleware, can, checkPassword, createSession, hashPassword, requirePerm, requireUser, ROLE_LABELS, ROLES } from "./auth.js";
import * as B from "./books.js";
import * as J from "./jobs.js";
import * as I from "./items.js";
import * as R from "./reports.js";
import * as C from "./collab.js";

const { httpError, round2, today } = B;
const { DOC_READ, CONTACT_READ } = C;
const DOC_WRITE = { quote: ["sales.write"], invoice: ["sales.write"], dc: ["sales.write"], credit_note: ["sales.write"], po: ["ops.write", "buy"], bill: ["ops.write", "buy"], vendor_credit: ["ops.write"] };
const MAX_UPLOAD = 10 * 1024 * 1024;
const UPLOAD_TYPES = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf|text\/csv|application\/vnd\.(ms-excel|openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)))$/;
const CONTACT_WRITE = { customer: ["sales.write"], supplier: ["ops.write"] };

export function createApp(db, { uploadDir = process.env.UPLOAD_DIR || join(dirname(process.env.DB_FILE || "data/zidane-books.db"), "uploads") } = {}) {
  const app = express();
  app.set("trust proxy", 1); // behind the hosting provider's HTTPS proxy
  app.use(express.json({ limit: "15mb" }));
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
  api.get("/health", (_req, res) => { db.prepare("SELECT 1").get(); res.json({ ok: true }); });
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
    const allowed = ["company", "taxes", "prefixes", "nextNumbers", "paymentTermsDays", "expenseCategories", "jobExpenseCategories", "invoiceFooter", "salesTargetMonthly", "expenseBudgets", "lowMarginPct", "dcSignDays"];
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
      c.opening_balance + COALESCE((SELECT SUM(d.total - ${B.PAID_SQL}) FROM documents d WHERE d.contact_id = c.id AND d.kind IN ('invoice','bill') AND d.status = 'open'), 0) AS outstanding,
      COALESCE((SELECT SUM(${B.UNUSED_SQL}) FROM payments p WHERE p.contact_id = c.id), 0)
        + COALESCE((SELECT SUM(${B.CREDIT_UNUSED_SQL}) FROM documents d WHERE d.contact_id = c.id AND d.kind IN ('credit_note','vendor_credit') AND d.status = 'open'), 0) AS credits
      FROM contacts c WHERE (? IS NULL OR c.type = ?) AND (c.name LIKE ? OR IFNULL(c.company,'') LIKE ? OR IFNULL(c.phone,'') LIKE ?) ORDER BY c.name`)
      .all(type || null, type || null, q, q, q);
    res.json(rows.filter((c) => canAny(req.user, CONTACT_READ[c.type])).map((c) => ({ ...c, outstanding: round2(c.outstanding), credits: round2(c.credits) })));
  });
  api.get("/contacts/:id", (req, res) => {
    const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id(req));
    if (!c) throw httpError(404, "Not found");
    need(req.user, CONTACT_READ[c.type]);
    const docs = db.prepare(`SELECT d.*, ${B.PAID_SQL} AS paid FROM documents d WHERE contact_id = ? ORDER BY date DESC, id DESC`).all(c.id)
      .map((d) => ({ ...d, paid: round2(d.paid), display_status: B.displayStatus(d, d.paid) }));
    const jobs = c.type === "customer" ? db.prepare("SELECT id, number, ops_status, required_date, closed FROM jobs WHERE customer_id = ? ORDER BY id DESC").all(c.id) : [];
    const payments = db.prepare(`SELECT p.*, ${B.UNUSED_SQL} AS unused FROM payments p WHERE contact_id = ? ORDER BY date DESC, id DESC`).all(c.id).map((p) => ({ ...p, unused: round2(p.unused) }));
    const credits = B.contactCredits(db, c.id);
    res.json({ ...c, documents: docs, jobs, payments, credits: round2(credits.reduce((a, x) => a + x.unused, 0)), credit: c.type === "customer" ? B.creditStatus(db, c.id) : null });
  });
  api.get("/contacts/:id/credit-status", (req, res) => { need(req.user, ["sales.read", "money"]); res.json(B.creditStatus(db, id(req), Number(req.query.extra) || 0)); });
  // ledger / statement of account: the side that owns the contact can see it, and Accounts
  api.get("/contacts/:id/statement", (req, res) => {
    const c = db.prepare("SELECT type FROM contacts WHERE id = ?").get(id(req));
    if (!c) throw httpError(404, "Not found");
    need(req.user, [...CONTACT_READ[c.type], "money"]);
    res.json({ ...B.statement(db, id(req), req.query.from || undefined, req.query.to || undefined), company: B.getSetting(db, "company") });
  });
  api.get("/contacts/:id/open-documents", (req, res) => {
    need(req.user, "money");
    const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id(req));
    if (!c) throw httpError(404, "Not found");
    res.json(db.prepare(`SELECT d.id, d.kind, d.number, d.date, d.due_date, d.total, ${B.PAID_SQL} AS paid FROM documents d WHERE d.contact_id = ? AND d.kind = ? AND d.status = 'open' ORDER BY COALESCE(d.due_date, d.date), d.id`)
      .all(c.id, c.type === "customer" ? "invoice" : "bill").map((d) => ({ ...d, paid: round2(d.paid), balance: round2(d.total - d.paid) })).filter((d) => d.balance > 0.001));
  });
  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
  const contactFields = (b) => [b.name, b.company || null, b.phone || null, b.email || null, b.address || null, b.ntn || null, Number(b.opening_balance) || 0, b.notes || null, num(b.payment_terms_days), num(b.credit_limit)];
  api.post("/contacts", (req, res) => {
    const b = req.body;
    if (!CONTACT_WRITE[b.type]) throw httpError(400, "Type must be customer or supplier");
    need(req.user, CONTACT_WRITE[b.type]);
    if (!b.name?.trim()) throw httpError(400, "Name is required");
    const r = db.prepare("INSERT INTO contacts (type, name, company, phone, email, address, ntn, opening_balance, notes, payment_terms_days, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(b.type, ...contactFields(b));
    B.log(db, req.user.id, "added", b.type, Number(r.lastInsertRowid), b.name);
    res.json({ id: Number(r.lastInsertRowid) });
  });
  api.put("/contacts/:id", (req, res) => {
    const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id(req));
    if (!c) throw httpError(404, "Not found");
    need(req.user, CONTACT_WRITE[c.type]);
    db.prepare("UPDATE contacts SET name=?, company=?, phone=?, email=?, address=?, ntn=?, opening_balance=?, notes=?, payment_terms_days=?, credit_limit=? WHERE id=?").run(...contactFields({ ...c, ...req.body }), c.id);
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
  api.get("/items/last-rate", (req, res) => {
    res.json(I.lastRate(db, Number(req.query.item_id), Number(req.query.contact_id), req.query.side === "purchase" ? "purchase" : "sale", cans(req)));
  });
  api.get("/items/:id", (req, res) => {
    const i = db.prepare("SELECT * FROM items WHERE id = ?").get(id(req));
    if (!i) throw httpError(404, "Not found");
    res.json({
      ...shapeItem(req, i),
      moves: I.shapeMoves(db.prepare("SELECT m.*, d.kind AS document_kind FROM stock_moves m LEFT JOIN documents d ON d.id = m.document_id WHERE item_id = ? ORDER BY m.id DESC LIMIT 200").all(i.id), cans(req)),
      transactions: I.itemTransactions(db, i.id, cans(req)),
      rates: I.itemRates(db, i.id, cans(req)),
      history: I.itemHistory(db, i.id, cans(req)),
    });
  });
  const itemFields = (b) => [b.name, b.sku || null, b.unit || "pcs", b.category || null, Number(b.purchase_rate) || 0, Number(b.sale_rate) || 0, Number(b.tax_rate) || 0, Number(b.reorder_level) || 0, b.track_stock === false ? 0 : 1];
  // anyone who writes documents can add a new item on the spot (like Zoho); they only set the rate they're allowed to see
  api.post("/items", (req, res) => {
    need(req.user, ["items.write", "sales.write", "buy"]);
    const b = { ...req.body };
    if (!can(req.user, "cost.view")) delete b.purchase_rate;
    if (!can(req.user, "price.view")) delete b.sale_rate;
    if (!b.name?.trim()) throw httpError(400, "Name is required");
    const r = db.prepare("INSERT INTO items (name, sku, unit, category, purchase_rate, sale_rate, tax_rate, reorder_level, track_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...itemFields(b));
    const newId = Number(r.lastInsertRowid);
    if (Number(b.opening_stock) && can(req.user, "items.write")) B.adjustStock(db, req.user.id, newId, b.opening_stock, "opening stock");
    B.log(db, req.user.id, "added", "item", newId, b.name);
    res.json({ id: newId });
  });
  api.put("/items/:id", requirePerm("items.write"), (req, res) => {
    const i = db.prepare("SELECT * FROM items WHERE id = ?").get(id(req));
    if (!i) throw httpError(404, "Not found");
    const body = { ...req.body };
    if (!can(req.user, "price.view")) delete body.sale_rate; // operations can't change selling rates
    if (!can(req.user, "cost.view")) delete body.purchase_rate;
    const next = { ...i, track_stock: !!i.track_stock, ...body };
    db.prepare("UPDATE items SET name=?, sku=?, unit=?, category=?, purchase_rate=?, sale_rate=?, tax_rate=?, reorder_level=?, track_stock=? WHERE id=?").run(...itemFields(next), i.id);
    I.logItemChanges(db, req.user.id, i, next, cans(req));
    res.json({ ok: true });
  });
  api.post("/items/import", requirePerm("items.write"), (req, res) => res.json(I.importItems(db, req.user.id, req.body.rows, cans(req))));
  api.post("/items/:id/adjust", requirePerm("items.write"), (req, res) => { B.adjustStock(db, req.user.id, id(req), req.body.qty, req.body.reason); res.json({ ok: true }); });
  api.delete("/items/:id", requirePerm("items.write"), (req, res) => {
    db.prepare("UPDATE items SET active = 0 WHERE id = ?").run(id(req)); // keep history, hide from lists
    res.json({ ok: true });
  });

  // ---- jobs
  const needJobs = (req) => need(req.user, ["sales.read", "ops.read"]);
  api.get("/jobs", (req, res) => { needJobs(req); res.json(J.jobList(db, req.query)); });
  api.get("/jobs/:id", (req, res) => { needJobs(req); res.json(J.jobDetail(db, id(req), cans(req))); });
  api.post("/jobs", requirePerm("sales.write"), (req, res) => {
    const jobId = J.createJob(db, req.user.id, req.body);
    C.notifyEvent(db, req.user.id, "job.created", { jobId });
    res.json({ id: jobId });
  });
  api.put("/jobs/:id", requirePerm("sales.write"), (req, res) => { J.updateJob(db, req.user.id, id(req), req.body); res.json({ ok: true }); });
  api.post("/jobs/:id/ops-status", requirePerm("ops.write"), (req, res) => {
    const before = db.prepare("SELECT ops_status FROM jobs WHERE id = ?").get(id(req))?.ops_status;
    J.setOpsStatus(db, req.user.id, id(req), req.body.status);
    if (req.body.status === "material_ready" && before !== "material_ready") C.notifyEvent(db, req.user.id, "job.ready", { jobId: id(req) });
    res.json({ ok: true });
  });
  api.post("/jobs/:id/dc", requirePerm("sales.write"), (req, res) => res.json({ id: J.dcFromJob(db, req.user.id, id(req)) }));
  api.post("/jobs/:id/invoice", requirePerm("sales.write"), (req, res) => res.json({ id: J.invoiceFromJob(db, req.user.id, id(req)) }));
  api.post("/jobs/:id/close", requirePerm("admin"), (req, res) => { J.closeJob(db, req.user.id, id(req), req.body.closed !== false); res.json({ ok: true }); });
  api.post("/job-items/:id/procurement", requirePerm("buy"), (req, res) => {
    const ji = db.prepare("SELECT ji.job_id, ji.procurement_status, COALESCE(i.name, ji.description) AS name FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE ji.id = ?").get(id(req));
    const before = ji && db.prepare("SELECT ops_status FROM jobs WHERE id = ?").get(ji.job_id)?.ops_status;
    J.setItemProcurement(db, req.user.id, id(req), req.body.status);
    if (ji && req.body.status === "not_available" && ji.procurement_status !== "not_available") C.notifyEvent(db, req.user.id, "job.not_available", { jobId: ji.job_id, itemName: ji.name });
    if (ji && before !== "material_ready" && db.prepare("SELECT ops_status FROM jobs WHERE id = ?").get(ji.job_id)?.ops_status === "material_ready") C.notifyEvent(db, req.user.id, "job.ready", { jobId: ji.job_id });
    res.json({ ok: true });
  });
  api.get("/procurement", (req, res) => { need(req.user, ["buy", "ops.read"]); res.json(J.procurementList(db)); });

  // ---- documents (quotes/enquiries, invoices, customer DCs, purchase orders, supplier bills)
  api.get("/documents", (req, res) => {
    const kind = req.query.kind;
    need(req.user, DOC_READ[kind] || "admin");
    const q = `%${req.query.q || ""}%`;
    const rows = db.prepare(`SELECT d.*, c.name AS contact_name, j.number AS job_number, ${B.PAID_SQL} AS paid
      FROM documents d JOIN contacts c ON c.id = d.contact_id LEFT JOIN jobs j ON j.id = d.job_id WHERE d.kind = ? AND (d.number LIKE ? OR c.name LIKE ? OR IFNULL(j.number,'') LIKE ?) ORDER BY d.date DESC, d.id DESC LIMIT 500`).all(kind, q, q, q)
      .map((d) => {
        const left = B.CREDIT_KINDS[d.kind] ? B.creditUnused(db, d.id) : null;
        return { ...d, paid: round2(d.paid), balance: left ?? round2(d.total - d.paid), display_status: B.displayStatus(d, d.paid, undefined, left) };
      });
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
    const isCredit = Boolean(B.CREDIT_KINDS[d.kind]);
    const left = isCredit ? B.creditUnused(db, d.id) : null;
    res.json({
      ...d, paid, balance: left ?? round2(d.total - paid), display_status: B.displayStatus(d, paid, undefined, left),
      applications: isCredit ? db.prepare("SELECT a.*, x.kind, x.number FROM payment_allocations a JOIN documents x ON x.id = a.document_id WHERE a.credit_id = ? ORDER BY a.id").all(d.id) : [],
      refunds: isCredit ? db.prepare("SELECT * FROM refunds WHERE credit_id = ? ORDER BY id").all(d.id) : [],
      contact: db.prepare("SELECT * FROM contacts WHERE id = ?").get(d.contact_id),
      lines: db.prepare("SELECT l.id, l.item_id, l.description, l.qty, l.rate, l.discount_pct, l.tax_rate, l.amount, i.name AS item_name, i.unit FROM document_lines l LEFT JOIN items i ON i.id = l.item_id WHERE document_id = ? ORDER BY l.id").all(d.id),
      payments: db.prepare(`SELECT a.id AS allocation_id, a.amount, a.date AS applied_on, COALESCE(p.id, c.id) AS id, CASE WHEN p.id IS NULL THEN 'credit' ELSE 'payment' END AS source,
        COALESCE(p.number, c.number) AS number, COALESCE(p.date, c.date) AS date, COALESCE(p.mode, CASE c.kind WHEN 'credit_note' THEN 'credit note' ELSE 'vendor credit' END) AS mode, COALESCE(p.reference, c.reference) AS reference, c.kind AS credit_kind
        FROM payment_allocations a LEFT JOIN payments p ON p.id = a.payment_id LEFT JOIN documents c ON c.id = a.credit_id WHERE a.document_id = ? ORDER BY a.id`).all(d.id),
      credits: can(req.user, "money") && ["invoice", "bill"].includes(d.kind) ? B.contactCredits(db, d.contact_id).filter((p) => p.direction === (d.kind === "invoice" ? "in" : "out")) : [],
      credit_status: d.kind === "invoice" && d.status === "draft" ? B.creditStatus(db, d.contact_id, d.total) : null,
      source: d.source_id ? db.prepare("SELECT id, kind, number FROM documents WHERE id = ?").get(d.source_id) : null,
      children: db.prepare("SELECT id, kind, number FROM documents WHERE source_id = ?").all(d.id),
      job: d.job_id ? db.prepare("SELECT id, number, customer_po_number, delivery_location FROM jobs WHERE id = ?").get(d.job_id) : null,
      verified_by_name: d.verified_by ? db.prepare("SELECT name FROM users WHERE id = ?").get(d.verified_by)?.name : null,
    });
  });
  api.post("/documents", (req, res) => {
    need(req.user, DOC_WRITE[req.body.kind] || "admin");
    if (req.body.kind === "invoice" && req.body.status === "open") checkCreditLimit(req, req.body.contact_id, B.computeTotals(req.body.lines || [], req.body).total);
    const docId = B.saveDocument(db, req.user.id, req.body);
    afterSave(req, docId, null);
    res.json({ id: docId });
  });
  api.put("/documents/:id", (req, res) => {
    const d = loadDoc(req, DOC_WRITE);
    if (d.verified_at && !can(req.user, "admin")) throw httpError(400, "This document is verified by Accounts. Ask a director to change it.");
    const paid = B.paidAmount(db, d.id);
    if (paid > 0 && B.computeTotals(req.body.lines || [], req.body).total < paid) throw httpError(400, "Total can't go below what's already paid");
    if (d.kind === "invoice" && d.status === "draft" && req.body.status === "open") limitGuard(req, d.id, () => checkCreditLimit(req, d.contact_id, B.computeTotals(req.body.lines || [], req.body).total));
    B.saveDocument(db, req.user.id, { ...req.body, kind: d.kind }, d.id);
    afterSave(req, d.id, d.status);
    if (d.verified_at) db.prepare("UPDATE documents SET verified_at = NULL, verified_by = NULL WHERE id = ?").run(d.id); // changed after verification → verify again
    res.json({ id: d.id });
  });
  const docAction = (perms, fn) => (req, res) => { const d = loadDoc(req, perms); res.json(fn(req, d) ?? { ok: true }); };
  // credit limit: an invoice that takes the customer over their limit needs a director to issue it
  const checkCreditLimit = (req, contactId, addTotal) => {
    const st = B.creditStatus(db, contactId, addTotal);
    if (st?.over && !can(req.user, "admin")) throw httpError(403, `Over credit limit: customer owes Rs ${st.owed.toLocaleString("en-PK")}, limit Rs ${st.limit.toLocaleString("en-PK")}. Save as draft and ask a director to issue it.`);
  };
  // a draft invoice blocked by the credit limit goes to the directors' approval queue
  const limitGuard = (req, docId, fn) => {
    try { fn(); } catch (e) {
      if (docId && e.status === 403 && /credit limit/.test(e.message)) C.notifyEvent(db, req.user.id, "doc.over_limit", { docId, message: e.message.split(".")[0] });
      throw e;
    }
  };
  const afterSave = (req, docId, beforeStatus) => {
    const d = db.prepare("SELECT status FROM documents WHERE id = ?").get(docId);
    if (d?.status === "open" && beforeStatus !== "open") C.notifyEvent(db, req.user.id, "doc.issued", { docId });
  };
  api.post("/documents/:id/status", docAction(DOC_WRITE, (req, d) => {
    if (d.kind === "invoice" && d.status === "draft" && req.body.status === "open") limitGuard(req, d.id, () => checkCreditLimit(req, d.contact_id, d.total));
    B.setStatus(db, req.user.id, id(req), req.body.status);
    afterSave(req, d.id, d.status);
  }));
  api.post("/documents/:id/clone", docAction(DOC_WRITE, (req) => ({ id: B.cloneDocument(db, req.user.id, id(req)) })));
  api.post("/documents/:id/convert", docAction(DOC_WRITE, (req) => ({ id: B.convertDocument(db, req.user.id, id(req)) })));
  api.post("/documents/:id/job", docAction(DOC_WRITE, (req, d) => {
    if (d.kind !== "quote") throw httpError(400, "Only quotes become Jobs");
    const jobId = J.jobFromQuote(db, req.user.id, d.id, req.body || {});
    C.notifyEvent(db, req.user.id, "job.created", { jobId });
    return { id: jobId };
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

  // ---- payments (Accounts): receipts and supplier payments, split across documents; leftovers are advances
  api.get("/payments", requirePerm("money"), (req, res) => {
    res.json(db.prepare(`SELECT p.*, c.name AS contact_name, ${B.UNUSED_SQL} AS unused,
      (SELECT GROUP_CONCAT(d.number, ', ') FROM payment_allocations a JOIN documents d ON d.id = a.document_id WHERE a.payment_id = p.id) AS applied_to
      FROM payments p JOIN contacts c ON c.id = p.contact_id WHERE p.direction = ? ORDER BY p.date DESC, p.id DESC LIMIT 500`).all(req.query.direction === "out" ? "out" : "in")
      .map((p) => ({ ...p, unused: round2(p.unused) })));
  });
  api.get("/payments/:id", requirePerm("money"), (req, res) => {
    const p = db.prepare(`SELECT p.*, c.name AS contact_name, c.type AS contact_type, ${B.UNUSED_SQL} AS unused FROM payments p JOIN contacts c ON c.id = p.contact_id WHERE p.id = ?`).get(id(req));
    if (!p) throw httpError(404, "Not found");
    const allocations = db.prepare("SELECT a.*, d.kind, d.number, d.total FROM payment_allocations a JOIN documents d ON d.id = a.document_id WHERE a.payment_id = ? ORDER BY a.id").all(p.id);
    const refunds = db.prepare("SELECT * FROM refunds WHERE payment_id = ? ORDER BY id").all(p.id);
    res.json({ ...p, unused: round2(p.unused), allocations, refunds, created_by_name: db.prepare("SELECT name FROM users WHERE id = ?").get(p.created_by)?.name });
  });
  api.post("/payments", requirePerm("money"), (req, res) => {
    const pid = B.recordPayment(db, req.user.id, req.body);
    C.notifyEvent(db, req.user.id, "payment.received", { paymentId: pid });
    res.json({ id: pid });
  });
  api.post("/payments/:id/allocate", requirePerm("money"), (req, res) => {
    const after = db.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM payment_allocations").get().m;
    B.allocatePayment(db, req.user.id, id(req), req.body.allocations);
    C.notifyEvent(db, req.user.id, "payment.received", { paymentId: id(req), after });
    res.json({ ok: true });
  });
  api.post("/documents/:id/allocate", requirePerm("money"), (req, res) => { B.allocateCredit(db, req.user.id, id(req), req.body.allocations); res.json({ ok: true }); });
  api.post("/refunds", requirePerm("money"), (req, res) => res.json({ id: B.recordRefund(db, req.user.id, req.body) }));
  api.delete("/refunds/:id", requirePerm("money"), (req, res) => { B.deleteRefund(db, req.user.id, id(req)); res.json({ ok: true }); });
  api.post("/documents/:id/apply-credits", requirePerm("money"), (req, res) => { B.applyCredits(db, req.user.id, id(req), req.body.credits); res.json({ ok: true }); });
  api.delete("/allocations/:id", requirePerm("money"), (req, res) => { B.removeAllocation(db, req.user.id, id(req)); res.json({ ok: true }); });
  api.delete("/payments/:id", requirePerm("money"), (req, res) => {
    const p = db.prepare("SELECT * FROM payments WHERE id = ?").get(id(req));
    if (!p) throw httpError(404, "Not found");
    db.prepare("DELETE FROM payments WHERE id = ?").run(p.id);
    B.log(db, req.user.id, "deleted payment", "payment", p.id, `${p.number} · ${p.amount}`);
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

  // ---- attachments (evidence): anyone who can see a record can attach to it; uploader or a director can remove
  const canSeeEntity = (user, entity, entityId) => entity !== "item" && C.canSeeEntity(db, user, entity, entityId);
  api.get("/attachments", (req, res) => {
    const { entity, entity_id } = req.query;
    if (!canSeeEntity(req.user, entity, Number(entity_id))) throw httpError(403, "You don't have access to this");
    res.json(db.prepare("SELECT a.id, a.filename, a.mime, a.size, a.label, a.created_at, a.uploaded_by, u.name AS uploaded_by_name FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by WHERE entity = ? AND entity_id = ? ORDER BY a.id").all(entity, Number(entity_id)));
  });
  api.post("/attachments", (req, res) => {
    const { entity, entity_id, filename, mime, data, label } = req.body || {};
    if (!canSeeEntity(req.user, entity, Number(entity_id))) throw httpError(403, "You don't have access to this");
    if (!UPLOAD_TYPES.test(String(mime))) throw httpError(400, "Upload a photo, PDF, Excel/CSV or Word file");
    const buf = Buffer.from(String(data || ""), "base64");
    if (!buf.length) throw httpError(400, "The file is empty");
    if (buf.length > MAX_UPLOAD) throw httpError(400, "Files can be at most 10 MB");
    mkdirSync(uploadDir, { recursive: true });
    const stored = `${Date.now()}-${randomBytes(8).toString("hex")}`;
    writeFileSync(join(uploadDir, stored), buf);
    const safeName = String(filename || "file").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    const r = db.prepare("INSERT INTO attachments (entity, entity_id, filename, mime, size, path, label, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(entity, Number(entity_id), safeName, mime, buf.length, stored, label || null, req.user.id);
    B.log(db, req.user.id, "attached", entity, Number(entity_id), `${label ? label + ": " : ""}${safeName}`);
    res.json({ id: Number(r.lastInsertRowid) });
  });
  api.get("/attachments/:id/file", (req, res) => {
    const a = db.prepare("SELECT * FROM attachments WHERE id = ?").get(id(req));
    if (!a || !canSeeEntity(req.user, a.entity, a.entity_id)) throw httpError(404, "Not found");
    res.setHeader("Content-Type", a.mime);
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${a.filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(readFileSync(join(uploadDir, a.path)));
  });
  api.delete("/attachments/:id", (req, res) => {
    const a = db.prepare("SELECT * FROM attachments WHERE id = ?").get(id(req));
    if (!a || !canSeeEntity(req.user, a.entity, a.entity_id)) throw httpError(404, "Not found");
    if (a.uploaded_by !== req.user.id && !can(req.user, "admin")) throw httpError(403, "Only the person who uploaded it or a director can remove it");
    db.prepare("DELETE FROM attachments WHERE id = ?").run(a.id);
    rmSync(join(uploadDir, a.path), { force: true });
    res.json({ ok: true });
  });

  // ---- comments and notifications
  api.get("/comments", (req, res) => res.json(C.listComments(db, req.user, req.query.entity, Number(req.query.entity_id))));
  api.get("/comments/people", (req, res) => res.json(C.mentionable(db, req.user, req.query.entity, Number(req.query.entity_id))));
  api.post("/comments", (req, res) => res.json({ id: C.addComment(db, req.user, req.body || {}) }));
  api.delete("/comments/:id", (req, res) => { C.deleteComment(db, req.user, id(req)); res.json({ ok: true }); });
  api.get("/notifications", (req, res) => { C.dailyAlerts(db); res.json(C.inbox(db, req.user.id)); });
  api.post("/notifications/read", (req, res) => { C.markRead(db, req.user.id, req.body?.ids === "all" ? "all" : req.body?.ids); res.json({ ok: true }); });

  // ---- backup (director): a consistent copy of the whole database
  api.get("/admin/backup", requirePerm("admin"), (_req, res) => {
    const file = join(uploadDir, "..", `backup-${Date.now()}.db`);
    mkdirSync(dirname(file), { recursive: true });
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="zidane-books-${today()}.db"`);
    res.setHeader("Content-Length", statSync(file).size);
    res.send(readFileSync(file));
    rmSync(file, { force: true });
  });

  // ---- reports
  const range = (req) => [req.query.from || today().slice(0, 8) + "01", req.query.to || today()];
  api.get("/reports/home", (req, res) => { const [from, to] = range(req); res.json(R.home(db, req.user, cans(req), { from, to })); });
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
