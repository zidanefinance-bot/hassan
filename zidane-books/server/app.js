// HTTP API. Every route except login needs a signed-in user, and each one checks the role's caps (auth.js).
// Hiding something in the UI is never the only protection: costs, selling rates and margins are stripped here.
import express from "express";
import cookieParser from "cookie-parser";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { authMiddleware, can, checkPassword, createApiKey, createSession, hashPassword, requirePerm, requireUser, ROLE_LABELS, ROLES } from "./auth.js";
import * as TG from "./telegram.js";
import * as PUSH from "./push.js";
import * as B from "./books.js";
import * as J from "./jobs.js";
import * as I from "./items.js";
import { tx } from "./db.js";
import { procurementXlsx } from "./exports.js";
import { startFresh } from "./reset.js";
import { financeHome } from "./finance.js";
import * as R from "./reports.js";
import * as C from "./collab.js";
import * as IN from "./inbox.js";
import { norm } from "./matching.js";
import { emailDocuments, mailReady } from "./mailer.js";
import { documentPdf } from "./pdf.js";
import * as AS from "./assistant.js";
import * as L from "./ledger.js";
import * as RA from "./ration.js";
import * as GD from "./guard.js";

const { httpError, round2, today } = B;
const { DOC_READ, CONTACT_READ } = C;
const DOC_WRITE = { quote: ["sales.write"], invoice: ["sales.write"], dc: ["sales.write"], credit_note: ["sales.write"], po: ["ops.write", "buy"], bill: ["ops.write", "buy"], vendor_credit: ["ops.write"] };
const MAX_UPLOAD = 10 * 1024 * 1024;
// What an API key may do: read, add to the Orders Inbox, comment, and save drafts. Issuing, money, deleting and settings stay in the app.
const API_ALLOWED = [/^POST \/inbox$/, /^POST \/comments$/, /^POST \/documents$/, /^PUT \/documents\/\d+$/, /^POST \/notifications\/read$/];
const UPLOAD_TYPES = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf|text\/csv|application\/vnd\.(ms-excel|openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)))$/;
// a field purchaser buying from a new shop adds the supplier on the spot
const CONTACT_WRITE = { customer: ["sales.write"], supplier: ["ops.write", "buy"] };

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
  // who may see money (payments, balances, paid/overdue) for a side: Accounts and directors always; Sales for customers,
  // since they chase collections. Operations and purchasers see what was bought, not what was paid.
  const seesMoney = (user, side) => can(user, "money") || can(user, "admin") || (side === "customer" && can(user, "sales.read"));
  const SIDE = { quote: "customer", invoice: "customer", dc: "customer", credit_note: "customer", po: "supplier", bill: "supplier", vendor_credit: "supplier" };
  // selling rate is Sales/Accounts/Director only; purchase cost is Operations/Accounts/Director only
  const shapeItem = (req, i) => {
    const out = { ...i };
    if (!can(req.user, "cost.view")) delete out.purchase_rate;
    if (!can(req.user, "price.view")) delete out.sale_rate;
    return out;
  };

  // ---- auth
  // password guessing: 8 wrong tries for an email or 30 from one address within 15 minutes → wait 15 minutes
  const fails = new Map(); // key -> [timestamps]
  const WINDOW = 15 * 60e3;
  const recent = (k) => (fails.get(k) || []).filter((t) => t > Date.now() - WINDOW);
  const blocked = (ip, email) => recent(`e:${email}`).length >= 8 || recent(`i:${ip}`).length >= 30;
  const failed = (ip, email) => { for (const k of [`e:${email}`, `i:${ip}`]) fails.set(k, [...recent(k), Date.now()]); };
  setInterval(() => { for (const k of fails.keys()) if (!recent(k).length) fails.delete(k); }, WINDOW).unref();
  api.post("/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    const who = String(email || "").trim().toLowerCase();
    if (blocked(req.ip, who)) throw httpError(429, "Too many wrong tries. Wait 15 minutes and try again.");
    const u = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(String(email || "").trim());
    if (!u || !checkPassword(String(password || ""), u.password_hash)) {
      failed(req.ip, who);
      B.log(db, u?.id ?? null, "failed sign-in", "user", u?.id ?? null, `${who} from ${req.ip}`);
      throw httpError(401, "Wrong email or password");
    }
    fails.delete(`e:${who}`);
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
  api.use((req, _res, next) => {
    if (!req.viaApi) return next();
    const route = `${req.method} ${req.path}`;
    if (req.method === "GET" && !/^\/(admin|api-keys|me\/)/.test(req.path)) return next();
    if (!API_ALLOWED.some((r) => r.test(route))) return next(httpError(403, "API keys can only read, add to the inbox, comment and save drafts. Do this in the app."));
    if (/documents/.test(route) && !["draft", "enquiry"].includes(req.body?.status || "draft")) return next(httpError(403, "API keys can only save drafts. Issue it in the app."));
    if (/^PUT/.test(route) && !["draft", "enquiry"].includes(db.prepare("SELECT status FROM documents WHERE id = ?").get(Number(req.path.split("/")[2]))?.status)) return next(httpError(403, "API keys can only change drafts"));
    B.log(db, req.user.id, "API", req.viaApi === "assistant" ? "assistant" : "api", req.viaApi === "assistant" ? null : req.viaApi, route);
    next();
  });
  // before a delete request is sent for approval: would the delete be allowed at all? (who may touch it, hard rules)
  const DELETE_PERMS = { payment: ["money"], refund: ["money"], allocation: ["money"], journal: ["money"], item: ["items.write"], packing: ["ops.write"], expense: ["expenses", "ops.write", "money"], account: ["money"] };
  const deletePrecheck = (req, kind, rid) => {
    if (DELETE_PERMS[kind]) need(req.user, DELETE_PERMS[kind]);
    if (kind !== "document") return;
    const d = db.prepare("SELECT * FROM documents WHERE id = ?").get(rid);
    need(req.user, DOC_WRITE[d.kind] || ["admin"]);
    if (d.kind === "quote" && d.status === "converted") throw httpError(400, "This quote is already a Job");
    if (B.paidAmount(db, d.id) > 0) throw httpError(400, "This document has payments applied. Unapply them first.");
    if (B.creditUsed(db, d.id) > 0) throw httpError(400, "This credit has been applied or refunded. Undo that first.");
    if (d.kind === "dc") J.checkDcRemoval(db, d);
  };
  api.use(GD.guardMiddleware(db, deletePrecheck)); // a reason for edits and deletes; non-directors' deletes wait for approval
  api.get("/activity", (req, res) => {
    if (req.query.entity) return res.json(GD.recordActivity(db, req.user, String(req.query.entity), Number(req.query.id)));
    need(req.user, "admin"); res.json(GD.allActivity(db, req.query));
  });
  api.get("/delete-requests", (req, res) => res.json(GD.deleteRequests(db, req.user)));
  api.post("/delete-requests/:id/reject", requirePerm("admin"), (req, res) => {
    if (!GD.rejectRequest(db, req.user, id(req), req.body?.note)) throw httpError(409, "This request was already handled");
    res.json({ ok: true });
  });
  api.get("/auth/me", (req, res) => res.json({ ...req.user, role_label: ROLE_LABELS[req.user.role], perms: ROLES[req.user.role] }));
  api.post("/auth/password", (req, res) => {
    const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!checkPassword(String(req.body.current || ""), u.password_hash)) throw httpError(400, "Current password is wrong");
    if (String(req.body.next || "").length < 8) throw httpError(400, "New password needs at least 8 characters");
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(req.body.next), u.id);
    res.json({ ok: true });
  });

  // ---- users (director)
  // director only: wipe the records and start real entries (a backup is saved first)
  api.post("/admin/start-fresh", requirePerm("admin"), (req, res) => res.json(startFresh(db, req.user.id, req.body || {})));
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
  const PRIVATE_SETTINGS = ["vapid", "lastDailyAlerts"]; // never sent to the browser
  api.get("/settings", (_req, res) => {
    const out = {};
    for (const r of db.prepare("SELECT key, value FROM settings").all()) if (!PRIVATE_SETTINGS.includes(r.key)) out[r.key] = JSON.parse(r.value);
    res.json(out);
  });
  api.put("/settings", requirePerm("admin"), (req, res) => {
    const allowed = ["company", "taxes", "prefixes", "nextNumbers", "paymentTermsDays", "expenseCategories", "jobExpenseCategories", "itemCategories", "invoiceFooter", "autoJobFromPo", "financeAssumptions", "salesTargetMonthly", "expenseBudgets", "lowMarginPct", "dcSignDays"];
    if ("itemCategories" in (req.body || {})) {
      const cats = [...new Set((req.body.itemCategories || []).map((c) => String(c).trim()).filter(Boolean))];
      if (!cats.length) throw httpError(400, "Keep at least one item category");
      req.body.itemCategories = cats;
    }
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
    res.json(rows.filter((c) => canAny(req.user, CONTACT_READ[c.type])).map((c) => (seesMoney(req.user, c.type)
      ? { ...c, outstanding: round2(c.outstanding), credits: round2(c.credits) } : { ...c, outstanding: undefined, credits: undefined, opening_balance: undefined })));
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
    if (!seesMoney(req.user, c.type)) {
      return res.json({ ...c, opening_balance: undefined, documents: docs.map((d) => ({ ...d, paid: undefined, display_status: d.status })), jobs, payments: [], credits: null, credit: null, money_hidden: true });
    }
    res.json({ ...c, documents: docs, jobs, payments, credits: round2(credits.reduce((a, x) => a + x.unused, 0)), credit: c.type === "customer" ? B.creditStatus(db, c.id) : null });
  });
  api.get("/contacts/:id/credit-status", (req, res) => { need(req.user, ["sales.read", "money"]); res.json(B.creditStatus(db, id(req), Number(req.query.extra) || 0)); });
  // ledger / statement of account: the side that owns the contact can see it, and Accounts
  api.get("/contacts/:id/statement", (req, res) => {
    const c = db.prepare("SELECT type FROM contacts WHERE id = ?").get(id(req));
    if (!c) throw httpError(404, "Not found");
    need(req.user, [...CONTACT_READ[c.type], "money"]);
    if (!seesMoney(req.user, c.type)) throw httpError(403, "Statements are for Accounts");
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
    const same = db.prepare("SELECT name FROM contacts WHERE type = ? AND active = 1").all(b.type).find((c) => norm(c.name) === norm(b.name));
    if (same) throw httpError(400, `${same.name} is already in your ${b.type}s. Pick it from the list instead.`);
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
    const same = db.prepare("SELECT name FROM items WHERE active = 1").all().find((i) => i.name.trim().toLowerCase().replace(/\s+/g, " ") === b.name.trim().toLowerCase().replace(/\s+/g, " "));
    if (same) throw httpError(400, `"${same.name}" is already an item. Pick it from the list instead.`);
    b.category = I.itemCategory(db, b.category);
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
    // an item keeps a category that was later taken off the list, until someone changes it
    if (next.category !== i.category || !i.category) next.category = I.itemCategory(db, next.category);
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
  api.get("/jobs", (req, res) => {
    needJobs(req);
    const sales = can(req.user, "sales.read"), ops = can(req.user, "ops.read");
    res.json(J.jobList(db, req.query).map((j) => ({ ...j, ...(sales ? {} : { dc_count: undefined, signed_dc_count: undefined, invoice_count: undefined }), ...(ops ? {} : { bill_count: undefined }) })));
  });
  api.get("/jobs/:id", (req, res) => { needJobs(req); res.json(J.jobDetail(db, id(req), cans(req))); });
  api.post("/jobs", requirePerm("sales.write"), (req, res) => {
    const jobId = J.createJob(db, req.user.id, req.body);
    C.notifyEvent(db, req.user.id, "job.created", { jobId });
    res.json({ id: jobId });
  });
  api.delete("/jobs/:id", requirePerm("admin"), (req, res) => { J.deleteJob(db, req.user.id, id(req)); res.json({ ok: true }); });
  api.put("/jobs/:id", requirePerm("sales.write"), (req, res) => { J.updateJob(db, req.user.id, id(req), req.body); res.json({ ok: true }); });
  api.post("/jobs/:id/ops-status", requirePerm("ops.write"), (req, res) => {
    const before = db.prepare("SELECT ops_status FROM jobs WHERE id = ?").get(id(req))?.ops_status;
    J.setOpsStatus(db, req.user.id, id(req), req.body.status);
    if (req.body.status === "material_ready" && before !== "material_ready") C.notifyEvent(db, req.user.id, "job.ready", { jobId: id(req) });
    res.json({ ok: true });
  });
  api.post("/jobs/:id/dc", requirePerm("sales.write"), (req, res) => res.json({ id: J.dcFromJob(db, req.user.id, id(req), { admin: can(req.user, "admin"), bags: req.body?.bags, point_id: req.body?.point_id }) }));
  api.put("/jobs/:id/delivery-points", requirePerm("sales.write"), (req, res) => { RA.savePoints(db, req.user.id, id(req), req.body?.points); res.json({ ok: true }); });
  api.post("/jobs/:id/invoice", requirePerm("sales.write"), (req, res) => res.json({ id: J.invoiceFromJob(db, req.user.id, id(req), { bags: req.body?.bags, show_as: req.body?.show_as }) }));
  // ration orders: packing progress (Operations / the packing team), recorded in bags
  api.post("/jobs/:id/packing", (req, res) => { need(req.user, ["ops.write", "buy", "admin"]); res.json({ id: RA.addPacking(db, req.user.id, id(req), req.body || {}) }); });
  api.delete("/packing/:id", (req, res) => { need(req.user, ["ops.write", "admin"]); RA.deletePacking(db, req.user.id, id(req)); res.json({ ok: true }); });
  // "Material arrived": delivery challan + invoice in one go, optionally emailed to the customer as PDFs
  api.post("/jobs/:id/deliver", requirePerm("sales.write"), async (req, res) => {
    const out = { dc_id: null, invoice_id: null, invoice_status: null, email: null };
    J.deliverPrecheck(db, id(req));
    out.dc_id = J.dcFromJob(db, req.user.id, id(req));
    B.setStatus(db, req.user.id, out.dc_id, "issued");
    afterSave(req, out.dc_id, "draft");
    out.invoice_id = J.invoiceFromJob(db, req.user.id, id(req));
    const inv = db.prepare("SELECT * FROM documents WHERE id = ?").get(out.invoice_id);
    try {
      limitGuard(req, inv.id, () => checkCreditLimit(req, inv.contact_id, inv.total));
      B.setStatus(db, req.user.id, inv.id, "open");
      afterSave(req, inv.id, "draft");
      out.invoice_status = "open";
    } catch (e) {
      if (e.status !== 403) throw e;
      out.invoice_status = "draft"; out.invoice_note = e.message; // over the credit limit: stays draft, directors are asked
    }
    if (req.body?.email) {
      const ids = out.invoice_status === "open" ? [out.dc_id, out.invoice_id] : [out.dc_id];
      try { out.email = { ok: true, ...(await emailDocuments(db, req.user.id, ids, { to: req.body.to })) }; } catch (e) { out.email = { ok: false, error: e.message }; }
    }
    res.json(out);
  });
  api.post("/jobs/:id/close", requirePerm("admin"), (req, res) => { J.closeJob(db, req.user.id, id(req), req.body.closed !== false); res.json({ ok: true }); });
  api.post("/job-items/:id/procurement", requirePerm("buy"), (req, res) => {
    const ji = db.prepare("SELECT ji.job_id, ji.procurement_status, COALESCE(i.name, ji.description) AS name FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE ji.id = ?").get(id(req));
    const before = ji && db.prepare("SELECT ops_status FROM jobs WHERE id = ?").get(ji.job_id)?.ops_status;
    J.setItemProcurement(db, req.user.id, id(req), req.body.status);
    if (ji && before !== "material_ready" && db.prepare("SELECT ops_status FROM jobs WHERE id = ?").get(ji.job_id)?.ops_status === "material_ready") C.notifyEvent(db, req.user.id, "job.ready", { jobId: ji.job_id });
    res.json({ ok: true });
  });
  api.get("/procurement/needs", (req, res) => { need(req.user, ["buy", "ops.read"]); res.json(J.jobNeeds(db, Number(req.query.exclude) || 0)); });
  api.get("/procurement", (req, res) => { need(req.user, ["buy", "ops.read"]); res.json(J.procurementList(db)); });
  api.get("/procurement.xlsx", async (req, res) => {
    need(req.user, ["buy", "ops.read"]);
    const { buffer, filename } = await procurementXlsx(db, req.user, { canCost: can(req.user, "cost.view") });
    res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" }).send(buffer);
  });

  // ---- documents (quotes/enquiries, invoices, customer DCs, purchase orders, supplier bills)
  api.get("/documents", (req, res) => {
    const kind = req.query.kind;
    need(req.user, DOC_READ[kind] || "admin");
    const q = `%${req.query.q || ""}%`;
    // customer PO numbers are searchable everywhere: the Job's PO and the document's own reference
    const rows = db.prepare(`SELECT d.*, c.name AS contact_name, j.number AS job_number, j.customer_po_number AS job_po, ${B.PAID_SQL} AS paid
      FROM documents d JOIN contacts c ON c.id = d.contact_id LEFT JOIN jobs j ON j.id = d.job_id
      WHERE d.kind = ? AND (d.number LIKE ? OR c.name LIKE ? OR IFNULL(j.number,'') LIKE ? OR IFNULL(j.customer_po_number,'') LIKE ? OR IFNULL(d.reference,'') LIKE ?)
      ORDER BY d.date DESC, d.id DESC LIMIT 500`).all(kind, q, q, q, q, q)
      .map((d) => {
        const left = B.CREDIT_KINDS[d.kind] ? B.creditUnused(db, d.id) : null;
        return { ...d, paid: round2(d.paid), balance: left ?? round2(d.total - d.paid), display_status: B.displayStatus(d, d.paid, undefined, left) };
      });
    const status = req.query.status;
    const out = seesMoney(req.user, SIDE[kind]) ? rows : rows.map((d) => ({ ...d, paid: undefined, balance: undefined, display_status: d.status }));
    res.json(status ? out.filter((d) => d.display_status === status) : out);
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
    const hide = !seesMoney(req.user, SIDE[d.kind]);
    const body = ({
      ...d, paid, balance: left ?? round2(d.total - paid), display_status: B.displayStatus(d, paid, undefined, left),
      applications: isCredit ? db.prepare("SELECT a.*, x.kind, x.number FROM payment_allocations a JOIN documents x ON x.id = a.document_id WHERE a.credit_id = ? ORDER BY a.id").all(d.id) : [],
      refunds: isCredit ? db.prepare("SELECT * FROM refunds WHERE credit_id = ? ORDER BY id").all(d.id) : [],
      contact: db.prepare("SELECT * FROM contacts WHERE id = ?").get(d.contact_id),
      lines: db.prepare("SELECT l.id, l.item_id, l.description, l.qty, l.rate, l.discount_pct, l.tax_rate, l.amount, l.job_id, j.number AS job_number, i.name AS item_name, i.unit FROM document_lines l LEFT JOIN items i ON i.id = l.item_id LEFT JOIN jobs j ON j.id = l.job_id WHERE document_id = ? ORDER BY l.id").all(d.id),
      payments: db.prepare(`SELECT a.id AS allocation_id, a.amount, a.date AS applied_on, COALESCE(p.id, c.id) AS id, CASE WHEN p.id IS NULL THEN 'credit' ELSE 'payment' END AS source,
        COALESCE(p.number, c.number) AS number, COALESCE(p.date, c.date) AS date, COALESCE(p.mode, CASE c.kind WHEN 'credit_note' THEN 'credit note' ELSE 'vendor credit' END) AS mode, COALESCE(p.reference, c.reference) AS reference, c.kind AS credit_kind
        FROM payment_allocations a LEFT JOIN payments p ON p.id = a.payment_id LEFT JOIN documents c ON c.id = a.credit_id WHERE a.document_id = ? ORDER BY a.id`).all(d.id),
      credits: can(req.user, "money") && ["invoice", "bill"].includes(d.kind) ? B.contactCredits(db, d.contact_id).filter((p) => p.direction === (d.kind === "invoice" ? "in" : "out")) : [],
      credit_status: d.kind === "invoice" && d.status === "draft" ? B.creditStatus(db, d.contact_id, d.total) : null,
      source: d.source_id ? db.prepare("SELECT id, kind, number FROM documents WHERE id = ?").get(d.source_id) : null,
      children: db.prepare("SELECT id, kind, number FROM documents WHERE source_id = ?").all(d.id),
      job: d.job_id ? db.prepare("SELECT id, number, customer_po_number, delivery_location FROM jobs WHERE id = ?").get(d.job_id) : null,
      // the other paperwork of the same Job that this person may see (DC ↔ invoice ↔ credit note, bill ↔ PO)
      linked_numbers: J.linkedNumbers(db, d),
      related: d.job_id ? db.prepare("SELECT id, kind, number, status FROM documents WHERE job_id = ? AND id != ? AND status != 'void' ORDER BY id").all(d.job_id, d.id).filter((x) => canAny(req.user, DOC_READ[x.kind])) : [],
      verified_by_name: d.verified_by ? db.prepare("SELECT name FROM users WHERE id = ?").get(d.verified_by)?.name : null,
    });
    res.json(hide ? { ...body, paid: undefined, balance: undefined, display_status: d.status, payments: [], applications: [], refunds: [], money_hidden: true } : body);
  });
  api.post("/documents", (req, res) => {
    need(req.user, DOC_WRITE[req.body.kind] || "admin");
    if (req.body.kind === "invoice" && req.body.status === "open") checkCreditLimit(req, req.body.contact_id, B.computeTotals(req.body.lines || [], req.body).total);
    jobDocChecks(req, { id: 0, job_id: Number(req.body.job_id) || null }, req.body.kind, req.body.status || "draft", req.body.lines || []);
    const docId = B.saveDocument(db, req.user.id, { ...req.body, _admin: can(req.user, "admin") });
    afterSave(req, docId, null);
    res.json({ id: docId });
  });
  api.put("/documents/:id", (req, res) => {
    const d = loadDoc(req, DOC_WRITE);
    if (d.verified_at && !can(req.user, "admin")) throw httpError(400, "This document is verified by Accounts. Ask a director to change it.");
    const paid = B.paidAmount(db, d.id);
    if (paid > 0 && B.computeTotals(req.body.lines || [], req.body).total < paid) throw httpError(400, "Total can't go below what's already paid");
    // credit limit on whatever this edit adds to what the customer owes (a bigger open invoice counts too)
    const newStatus = req.body.status || d.status;
    if (d.kind === "invoice" && newStatus === "open") {
      const extra = round2(B.computeTotals(req.body.lines || [], req.body).total - (d.status === "open" && Number(req.body.contact_id ?? d.contact_id) === d.contact_id ? d.total : 0));
      if (extra > 0) limitGuard(req, d.id, () => checkCreditLimit(req, Number(req.body.contact_id ?? d.contact_id), extra));
    }
    jobDocChecks(req, { ...d, job_id: req.body.job_id === undefined ? d.job_id : Number(req.body.job_id) || null }, d.kind, newStatus, req.body.lines || []);
    B.saveDocument(db, req.user.id, { ...req.body, kind: d.kind, _admin: can(req.user, "admin") }, d.id);
    RA.syncBags(db, d.id);
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
  // a Job's DCs and invoices can't go past what the Job ordered / delivered
  const jobDocChecks = (req, doc, kind, status, lines) => {
    if (!doc.job_id) return;
    if (kind === "dc" && ["issued", "signed"].includes(status)) J.checkDcIssue(db, doc, lines, { admin: can(req.user, "admin") });
    if (kind === "invoice" && ["open", "draft"].includes(status)) J.checkInvoiceQty(db, doc, lines);
  };
  const afterSave = (req, docId, beforeStatus) => {
    const d = db.prepare("SELECT kind, status, job_id FROM documents WHERE id = ?").get(docId);
    if (d?.status === "open" && beforeStatus !== "open") C.notifyEvent(db, req.user.id, "doc.issued", { docId });
    const out = (s) => ["issued", "signed"].includes(s);
    // a bill buys for every Job its lines are for
    if (d?.kind === "bill") for (const { j } of db.prepare(`SELECT DISTINCT ${J.LINE_JOB} AS j FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE d.id = ? AND ${J.LINE_JOB} IS NOT NULL`).all(docId)) J.syncJobBuying(db, req.user.id, j);
    if (d?.kind === "dc" && d.job_id) J.syncJobDelivery(db, d.job_id, { removed: out(beforeStatus) && !out(d.status) });
  };
  api.post("/documents/:id/status", docAction(DOC_WRITE, (req, d) => {
    // the credit limit applies whenever an invoice becomes open, from whatever status
    if (d.kind === "invoice" && d.status !== "open" && req.body.status === "open") limitGuard(req, d.id, () => checkCreditLimit(req, d.contact_id, d.total));
    if (d.kind === "dc" && req.body.status === "issued") J.checkDcIssue(db, d, null, { admin: can(req.user, "admin") });
    if (d.kind === "invoice" && req.body.status === "open") J.checkInvoiceQty(db, d, db.prepare("SELECT * FROM document_lines WHERE document_id = ?").all(d.id));
    if (d.kind === "dc" && req.body.status === "void") J.checkDcRemoval(db, d);
    B.setStatus(db, req.user.id, id(req), req.body.status, { admin: can(req.user, "admin") });
    afterSave(req, d.id, d.status);
  }));
  api.post("/documents/:id/email", async (req, res) => {
    const d = loadDoc(req, DOC_WRITE);
    res.json(await emailDocuments(db, req.user.id, [d.id, ...(req.body?.with || []).map(Number).filter((x) => x !== d.id && canAny(req.user, DOC_WRITE[db.prepare("SELECT kind FROM documents WHERE id = ?").get(x)?.kind]))], { to: req.body?.to, cc: req.body?.cc, message: req.body?.message }));
  });
  api.get("/documents/:id/pdf", async (req, res) => {
    const d = loadDoc(req, DOC_READ);
    const p = await documentPdf(db, d.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${p.filename}"`);
    res.send(p.buffer);
  });
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
    if (d.kind === "quote" && d.status === "converted") throw httpError(400, "This quote is already a Job");
    // issued money paperwork stays on record (void it instead); only a director can remove it
    if (["invoice", "bill", "credit_note", "vendor_credit"].includes(d.kind) && d.status !== "draft" && !can(req.user, "admin")) throw httpError(400, `${d.number} is already issued. Void it instead of deleting (a director can delete it).`);
    if (d.kind === "dc") J.checkDcRemoval(db, d);
    B.deleteDocument(db, req.user.id, d.id);
    if (d.kind === "dc" && d.job_id) J.syncJobDelivery(db, d.job_id, { removed: ["issued", "signed"].includes(d.status) });
  }));

  // ---- payments (Accounts): receipts and supplier payments, split across documents; leftovers are advances
  api.get("/payments", requirePerm("money"), (req, res) => {
    res.json(db.prepare(`SELECT p.*, c.name AS contact_name, ac.name AS account_name, ${B.UNUSED_SQL} AS unused,
      (SELECT GROUP_CONCAT(d.number, ', ') FROM payment_allocations a JOIN documents d ON d.id = a.document_id WHERE a.payment_id = p.id) AS applied_to
      FROM payments p JOIN contacts c ON c.id = p.contact_id LEFT JOIN accounts ac ON ac.id = p.account_id WHERE p.direction = ? ORDER BY p.date DESC, p.id DESC LIMIT 500`).all(req.query.direction === "out" ? "out" : "in")
      .map((p) => ({ ...p, unused: round2(p.unused) })));
  });
  api.get("/payments/:id", requirePerm("money"), (req, res) => {
    const p = db.prepare(`SELECT p.*, c.name AS contact_name, c.type AS contact_type, ac.name AS account_name, ${B.UNUSED_SQL} AS unused FROM payments p JOIN contacts c ON c.id = p.contact_id LEFT JOIN accounts ac ON ac.id = p.account_id WHERE p.id = ?`).get(id(req));
    if (!p) throw httpError(404, "Not found");
    const allocations = db.prepare("SELECT a.*, d.kind, d.number, d.total FROM payment_allocations a JOIN documents d ON d.id = a.document_id WHERE a.payment_id = ? ORDER BY a.id").all(p.id);
    const refunds = db.prepare("SELECT r.*, ac.name AS account_name FROM refunds r LEFT JOIN accounts ac ON ac.id = r.account_id WHERE payment_id = ? ORDER BY r.id").all(p.id);
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
    res.json(db.prepare("SELECT e.*, c.name AS contact_name, j.number AS job_number, ac.name AS account_name FROM expenses e LEFT JOIN contacts c ON c.id = e.contact_id LEFT JOIN jobs j ON j.id = e.job_id LEFT JOIN accounts ac ON ac.id = e.account_id WHERE date BETWEEN ? AND ? ORDER BY date DESC, e.id DESC").all(from, to));
  });
  const expFields = (b) => {
    if (!b.category) throw httpError(400, "Category is required");
    if (!(Number(b.amount) > 0)) throw httpError(400, "Amount must be more than zero");
    L.expenseAccountFor(db, b.category); // a new category gets its own expense account
    return [b.date || today(), b.category, round2(b.amount), b.paid_through || "cash", b.contact_id || null, b.job_id || null, b.reference || null, b.notes || null, L.moneyAccount(db, b.account_id, b.paid_through || "cash")];
  };
  api.post("/expenses", (req, res) => {
    if (!canExpense(req.user, req.body.job_id)) throw httpError(403, "You don't have access to this");
    const r = db.prepare("INSERT INTO expenses (date, category, amount, paid_through, contact_id, job_id, reference, notes, account_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...expFields(req.body), req.user.id);
    B.log(db, req.user.id, req.body.job_id ? "added job cost" : "added expense", "expense", Number(r.lastInsertRowid), `${req.body.category} · ${req.body.amount}`);
    res.json({ id: Number(r.lastInsertRowid) });
  });
  // one cost (a rickshaw for two POs' goods) shared by several Jobs: by each Job's value, or equally.
  // Each Job gets its own expense line for its share; preview: true only works the shares out.
  api.post("/expenses/split", (req, res) => {
    const b = req.body || {};
    const ids = [...new Set((b.job_ids || []).map(Number).filter(Boolean))];
    if (ids.length < 2) throw httpError(400, "Pick at least two Jobs to share it");
    for (const j of ids) if (!canExpense(req.user, j)) throw httpError(403, "You don't have access to this");
    const amount = round2(Number(b.amount) || 0);
    if (!(amount > 0)) throw httpError(400, "Amount must be more than zero");
    const jobs = ids.map((j) => db.prepare("SELECT j.id, j.number, j.closed, (SELECT COALESCE(SUM(qty * sale_rate), 0) FROM job_items WHERE job_id = j.id) AS value FROM jobs j WHERE j.id = ?").get(j));
    if (jobs.some((j) => !j)) throw httpError(404, "Job not found");
    if (jobs.some((j) => j.closed)) throw httpError(400, "One of these Jobs is closed");
    const total = jobs.reduce((a, j) => a + j.value, 0);
    const byValue = b.mode !== "equal" && total > 0;
    let left = amount;
    const shares = jobs.map((j, i) => {
      const s = i === jobs.length - 1 ? round2(left) : round2(byValue ? (amount * j.value) / total : amount / jobs.length);
      left = round2(left - s);
      return { job_id: j.id, number: j.number, amount: s };
    });
    if (b.preview) return res.json({ shares, mode: byValue ? "value" : "equal" });
    const note = `${b.notes ? b.notes + " · " : ""}Part of Rs ${amount.toLocaleString("en-PK")} shared by ${jobs.map((j) => j.number).join(", ")} (${byValue ? "by Job value" : "equally"})`;
    tx(db, () => {
      for (const s of shares) {
        const r = db.prepare("INSERT INTO expenses (date, category, amount, paid_through, contact_id, job_id, reference, notes, account_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(...expFields({ ...b, amount: s.amount, job_id: s.job_id, notes: note }), req.user.id);
        B.log(db, req.user.id, "added job cost", "expense", Number(r.lastInsertRowid), `${b.category} · ${s.amount} (shared)`);
      }
    });
    res.json({ shares });
  });
  const loadExp = (req) => {
    const e = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id(req));
    if (!e) throw httpError(404, "Not found");
    if (!canExpense(req.user, e.job_id)) throw httpError(403, "You don't have access to this");
    return e;
  };
  api.put("/expenses/:id", (req, res) => {
    const e = loadExp(req);
    db.prepare("UPDATE expenses SET date=?, category=?, amount=?, paid_through=?, contact_id=?, job_id=?, reference=?, notes=?, account_id=? WHERE id=?").run(...expFields({ ...req.body, job_id: e.job_id }), e.id);
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
    // the customer's PO file is shared with the orders inbox: only remove it when nothing else uses it
    if (!db.prepare("SELECT 1 FROM attachments WHERE path = ? UNION SELECT 1 FROM inbox_files WHERE path = ?").get(a.path, a.path)) rmSync(join(uploadDir, a.path), { force: true });
    res.json({ ok: true });
  });

  // ---- push alerts on this device (installed app)
  api.get("/push/key", (_req, res) => res.json({ key: PUSH.vapidKeys(db).publicKey }));
  api.get("/push/devices", (req, res) => res.json(PUSH.devices(db, req.user.id)));
  api.post("/push/subscribe", (req, res) => { PUSH.subscribe(db, req.user.id, req.body?.subscription, req.headers["user-agent"]); res.json({ ok: true }); });
  api.post("/push/unsubscribe", (req, res) => { PUSH.unsubscribe(db, req.user.id, req.body?.endpoint); res.json({ ok: true }); });
  api.post("/push/test", (req, res) => { C.notify(db, [req.user.id], { kind: "test", title: "Alerts are working ✓", body: "This is how Zidane Books alerts will look on this device.", link: "/" }); res.json({ ok: true }); });

  // ---- my Telegram link and API keys
  api.get("/me/telegram", (req, res) => res.json(TG.telegramStatus(db, req.user.id)));
  api.post("/me/telegram", async (req, res) => { if (!TG.telegramReady()) throw httpError(503, "Telegram is not set up on the server yet"); res.json(await TG.linkCode(db, req.user.id)); });
  api.delete("/me/telegram", (req, res) => { TG.unlink(db, req.user.id); res.json({ ok: true }); });
  api.get("/api-keys", (req, res) => res.json({ enabled: B.getSetting(db, "apiKeysEnabled") === true,
    keys: db.prepare("SELECT k.id, k.name, k.prefix, k.created_at, k.last_used_at, k.revoked_at, k.user_id, u.name AS user_name FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.user_id = ? OR ? ORDER BY k.id DESC").all(req.user.id, can(req.user, "admin") ? 1 : 0) }));
  api.post("/api-keys", (req, res) => {
    if (B.getSetting(db, "apiKeysEnabled") !== true) throw httpError(403, "API keys are switched off. A director can turn them on in Settings.");
    const key = createApiKey(db, req.user.id, req.body?.name);
    B.log(db, req.user.id, "created API key", "api", null, req.body?.name || "");
    res.json({ key });
  });
  api.delete("/api-keys/:id", (req, res) => {
    const k = db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id(req));
    if (!k || (k.user_id !== req.user.id && !can(req.user, "admin"))) throw httpError(404, "Not found");
    db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?").run(k.id);
    B.log(db, req.user.id, "revoked API key", "api", k.id, k.name);
    res.json({ ok: true });
  });
  api.post("/api-keys/enabled", requirePerm("admin"), (req, res) => { B.setSetting(db, "apiKeysEnabled", req.body?.enabled === true); B.log(db, req.user.id, req.body?.enabled ? "turned on API keys" : "turned off API keys", "settings", null, ""); res.json({ ok: true }); });

  // ---- comments and notifications
  api.get("/comments", (req, res) => res.json(C.listComments(db, req.user, req.query.entity, Number(req.query.entity_id))));
  api.get("/comments/people", (req, res) => res.json(C.mentionable(db, req.user, req.query.entity, Number(req.query.entity_id))));
  api.post("/comments", (req, res) => res.json({ id: C.addComment(db, req.user, req.body || {}) }));
  api.delete("/comments/:id", (req, res) => { C.deleteComment(db, req.user, id(req)); res.json({ ok: true }); });
  api.get("/notifications", (req, res) => { C.dailyAlerts(db); res.json(C.inbox(db, req.user.id)); });
  api.post("/notifications/read", (req, res) => { C.markRead(db, req.user.id, req.body?.ids === "all" ? "all" : req.body?.ids); res.json({ ok: true }); });

  // ---- search everything from the top bar: Jobs (incl. customer PO #), documents, contacts, items. Filtered by role.
  api.get("/search", (req, res) => {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json([]);
    const like = `%${q}%`;
    const out = [];
    if (canAny(req.user, ["sales.read", "ops.read"])) {
      for (const j of db.prepare(`SELECT j.id, j.number, j.customer_po_number, j.ops_status, j.closed, c.name FROM jobs j JOIN contacts c ON c.id = j.customer_id
          WHERE j.number LIKE ? OR IFNULL(j.customer_po_number,'') LIKE ? OR c.name LIKE ? ORDER BY j.closed, j.id DESC LIMIT 8`).all(like, like, like)) {
        out.push({ type: "Job", title: `${j.number}${j.customer_po_number ? ` · PO ${j.customer_po_number}` : ""}`, sub: `${j.name} · ${j.closed ? "closed" : j.ops_status.replace(/_/g, " ")}`, link: `/jobs/${j.id}` });
      }
    }
    const kinds = Object.keys(DOC_READ).filter((k) => canAny(req.user, DOC_READ[k]));
    if (kinds.length) {
      for (const d of db.prepare(`SELECT d.id, d.kind, d.number, d.reference, d.status, d.date, c.name, j.customer_po_number AS po FROM documents d JOIN contacts c ON c.id = d.contact_id LEFT JOIN jobs j ON j.id = d.job_id
          WHERE d.kind IN (${kinds.map(() => "?").join(",")}) AND (d.number LIKE ? OR IFNULL(d.reference,'') LIKE ? OR IFNULL(j.customer_po_number,'') LIKE ? OR c.name LIKE ?)
          ORDER BY d.date DESC, d.id DESC LIMIT 12`).all(...kinds, like, like, like, like)) {
        const po = d.po || (["quote", "invoice", "dc", "credit_note"].includes(d.kind) ? d.reference : null);
        out.push({ type: { quote: "Quote", invoice: "Invoice", dc: "DC", po: "PO", bill: "Bill", credit_note: "Credit note", vendor_credit: "Vendor credit" }[d.kind],
          title: `${d.number}${po && po !== d.number ? ` · ${d.kind === "bill" || d.kind === "po" ? "Ref" : "PO"} ${po}` : d.kind === "bill" && d.reference ? ` · Bill # ${d.reference}` : ""}`,
          sub: `${d.name} · ${d.status} · ${d.date}`, link: `/${C.DOC_PATH[d.kind]}/${d.id}` });
      }
    }
    for (const [type, perms] of [["customer", CONTACT_READ.customer], ["supplier", CONTACT_READ.supplier]]) {
      if (!canAny(req.user, perms)) continue;
      for (const c of db.prepare("SELECT id, name, phone, company FROM contacts WHERE type = ? AND (name LIKE ? OR IFNULL(phone,'') LIKE ? OR IFNULL(company,'') LIKE ?) ORDER BY name LIMIT 5").all(type, like, like, like)) {
        out.push({ type: type === "customer" ? "Customer" : "Supplier", title: c.name, sub: [c.company, c.phone].filter(Boolean).join(" · "), link: `/contacts/${c.id}` });
      }
    }
    for (const i of db.prepare("SELECT id, name, sku, unit, stock_qty FROM items WHERE active = 1 AND (name LIKE ? OR IFNULL(sku,'') LIKE ?) ORDER BY name LIMIT 5").all(like, like)) {
      out.push({ type: "Item", title: i.name, sub: [i.sku, `${i.stock_qty} ${i.unit} in stock`].filter(Boolean).join(" · "), link: `/items/${i.id}` });
    }
    res.json(out);
  });

  // ---- orders inbox (AI reads POs and supplier bills)
  const aiReady = () => IN.readerReady();
  const needInbox = (req) => { if (!IN.canUseInbox(req.user)) throw httpError(403, "You don't have access to this"); };
  // the daily backup (deploy/backup.sh) writes how it went; directors see it in Settings
  const lastBackup = () => { try { return JSON.parse(readFileSync(join(dirname(process.env.DB_FILE || "data/zidane-books.db"), "backups", "last-backup.json"), "utf8")); } catch { return null; } };
  api.get("/setup-status", (req, res) => res.json({ ai: aiReady(), email_in: Boolean(process.env.IMAP_HOST && process.env.IMAP_USER), email_out: mailReady(), telegram: TG.telegramReady(),
    ...(can(req.user, "admin") ? { backup: lastBackup() } : {}) }));
  api.get("/inbox", (req, res) => { needInbox(req); res.json(IN.listInbox(db, req.user, req.query)); });
  api.get("/inbox/files/:id", (req, res) => {
    needInbox(req);
    const f = IN.inboxFile(db, req.user, id(req));
    res.setHeader("Content-Type", f.mime);
    res.setHeader("Content-Disposition", `inline; filename="${f.filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(readFileSync(join(uploadDir, f.path)));
  });
  api.get("/inbox/:id", (req, res) => { needInbox(req); res.json(IN.getMessage(db, req.user, id(req))); });
  // paste a message or upload photos/PDFs; with wait=true the answer comes back once AI has read it
  api.post("/inbox", async (req, res) => {
    needInbox(req);
    const { text = "", subject = "", files = [], wait } = req.body || {};
    if (!String(text).trim() && !files.length) throw httpError(400, "Paste the message or attach a photo / PDF");
    const decoded = files.map((f) => ({ filename: f.filename, mime: f.mime, buffer: Buffer.from(String(f.data || ""), "base64") }));
    if (decoded.some((f) => f.buffer.length > MAX_UPLOAD)) throw httpError(400, "Files can be at most 10 MB");
    const mid = IN.addMessage(db, uploadDir, { source: files.length ? "upload" : "paste", subject: subject || null, body_text: String(text).slice(0, 100000), files: decoded, created_by: req.user.id });
    const job = IN.enqueue(db, uploadDir, mid);
    if (wait) await job;
    res.json(wait ? IN.getMessage(db, req.user, mid) : { id: mid });
  });
  api.post("/inbox/:id/read", (req, res) => { needInbox(req); IN.getMessage(db, req.user, id(req)); IN.enqueue(db, uploadDir, id(req)); res.json({ ok: true }); });
  api.post("/inbox/:id/status", (req, res) => { needInbox(req); IN.markHandled(db, req.user, id(req), req.body || {}); res.json({ ok: true }); });
  api.post("/inbox/check", requirePerm("admin"), async (_req, res) => {
    if (!process.env.IMAP_HOST) throw httpError(503, "Email inbox is not set up yet");
    res.json({ added: await IN.fetchMail(db, uploadDir) });
  });

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
  api.get("/reports/finance", requirePerm("reports.finance"), (_req, res) => res.json(financeHome(db)));
  // each director picks their own home: the full one, or the finance one (kept per login, on every device)
  api.post("/me/home-view", requirePerm("reports.finance"), (req, res) => {
    const views = B.getSetting(db, "homeViews") || {};
    views[req.user.id] = req.body?.view === "finance" ? "finance" : "full";
    B.setSetting(db, "homeViews", views);
    res.json({ ok: true });
  });
  api.get("/reports/pnl", requirePerm("reports.finance"), (req, res) => res.json(R.profitAndLoss(db, ...range(req))));
  api.get("/reports/tax", requirePerm("reports.finance"), (req, res) => res.json(R.taxSummary(db, ...range(req))));
  api.get("/reports/receivables", (req, res) => { need(req.user, ["reports.finance", "sales.read"]); res.json(R.receivables(db)); });
  api.get("/reports/payables", requirePerm("reports.finance"), (_req, res) => res.json(R.payables(db)));
  api.get("/reports/inventory", requirePerm("reports.finance"), (_req, res) => res.json(R.inventory(db)));
  api.get("/reports/sales-by-customer", (req, res) => { need(req.user, ["reports.finance", "sales.read"]); res.json(R.salesByCustomer(db, ...range(req))); });
  api.get("/reports/sales-by-item", requirePerm("reports.finance"), (req, res) => res.json(R.salesByItem(db, ...range(req))));
  api.get("/reports/job-profit", requirePerm("profit.view"), (req, res) => res.json(R.jobProfit(db, ...range(req))));

  // ---- ration kits: what one bag holds and the rate of each item in it (Sales prices them; costs need cost.view)
  const kitShape = (req, k) => (can(req.user, "cost.view") ? k : { ...k, cost_per_bag: undefined, margin_per_bag: undefined, margin_pct: undefined, lines: k.lines.map(({ purchase_rate, ...l }) => l) });
  api.get("/kits", (req, res) => { need(req.user, ["sales.read", "ops.read"]); res.json(RA.kitList(db).map((k) => kitShape(req, k))); });
  api.get("/kits/:id", (req, res) => { need(req.user, ["sales.read", "ops.read"]); res.json(kitShape(req, RA.kitDetail(db, id(req)))); });
  api.post("/kits", requirePerm("sales.write"), (req, res) => res.json({ id: RA.saveKit(db, req.body || {}) }));
  api.put("/kits/:id", requirePerm("sales.write"), (req, res) => { RA.kitDetail(db, id(req)); res.json({ id: RA.saveKit(db, req.body || {}, id(req)) }); });
  api.post("/kits/:id/quote", requirePerm("sales.write"), (req, res) => res.json({ id: RA.quoteFromKit(db, req.user.id, id(req), req.body || {}) }));
  // a ration document is shown to the customer as bags (default) or item by item
  api.post("/documents/:id/show-as", docAction(DOC_WRITE, (req, d) => {
    if (!(d.bags > 0)) throw httpError(400, "This isn't a ration document");
    RA.markBags(db, d.id, d.bags, d.kit_name, req.body?.show_as);
  }));

  // ---- accounts: Chart of Accounts, general ledger, manual entries, trial balance, balance sheet
  // Anyone who records money picks the account (names only); Accounts and directors see balances and the books.
  const books = (req) => need(req.user, ["reports.finance"]);
  const recordsMoney = (req) => need(req.user, ["money", "expenses", "buy", "reports.finance"]);
  api.get("/accounts/money", (req, res) => { recordsMoney(req); res.json(db.prepare(`SELECT id, code, name, kind, bank_name, account_number FROM accounts WHERE active = 1 AND kind IN ('cash','bank','wallet') ORDER BY CAST(code AS INTEGER)`).all()); });
  api.get("/accounts", (req, res) => { books(req); res.json(L.balances(db, { to: req.query.to || today() })); });
  const accFields = (b, a) => {
    const name = String(b.name ?? a?.name ?? "").trim();
    if (!name) throw httpError(400, "Name is required");
    const type = a?.system_key || a?.expense_category ? a.type : b.type ?? a?.type;
    if (!L.TYPES.includes(type)) throw httpError(400, "Pick a type");
    const kind = a?.system_key ? a.kind : type === "asset" && ["cash", "bank", "wallet"].includes(b.kind ?? a?.kind) ? (b.kind ?? a?.kind) : "other";
    const code = String(b.code ?? a?.code ?? "").trim();
    if (!/^[0-9A-Za-z.-]{1,12}$/.test(code)) throw httpError(400, "Code: up to 12 letters or numbers");
    return { name, type, kind, code, bank_name: b.bank_name ?? a?.bank_name ?? null, account_number: b.account_number ?? a?.account_number ?? null,
      opening_balance: round2(Number(b.opening_balance ?? a?.opening_balance) || 0), opening_date: (b.opening_date ?? a?.opening_date) || null, notes: b.notes ?? a?.notes ?? null,
      active: b.active === undefined ? (a?.active ?? 1) : b.active ? 1 : 0 };
  };
  const dupCode = (e) => { if (String(e.message).includes("UNIQUE")) throw httpError(400, "Another account already has this code"); throw e; };
  api.post("/accounts", (req, res) => {
    books(req);
    const f = accFields({ ...req.body, code: String(req.body?.code || "").trim() || L.nextCode(db, req.body?.type in { asset: 1, liability: 1, equity: 1, income: 1, expense: 1 } ? req.body.type : "asset") });
    try {
      const r = db.prepare("INSERT INTO accounts (code, name, type, kind, bank_name, account_number, opening_balance, opening_date, notes, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(f.code, f.name, f.type, f.kind, f.bank_name, f.account_number, f.opening_balance, f.opening_date, f.notes, f.active);
      B.log(db, req.user.id, "added account", "account", Number(r.lastInsertRowid), `${f.code} ${f.name}`);
      res.json({ id: Number(r.lastInsertRowid) });
    } catch (e) { dupCode(e); }
  });
  api.put("/accounts/:id", (req, res) => {
    books(req);
    const a = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id(req));
    if (!a) throw httpError(404, "Not found");
    const f = accFields(req.body || {}, a);
    if (!f.active && a.system_key) throw httpError(400, "This account is used by the books and can't be closed");
    try {
      db.prepare("UPDATE accounts SET code=?, name=?, type=?, kind=?, bank_name=?, account_number=?, opening_balance=?, opening_date=?, notes=?, active=? WHERE id=?")
        .run(f.code, f.name, f.type, f.kind, f.bank_name, f.account_number, f.opening_balance, f.opening_date, f.notes, f.active, a.id);
    } catch (e) { dupCode(e); }
    B.log(db, req.user.id, "changed account", "account", a.id, `${f.code} ${f.name}`);
    res.json({ ok: true });
  });
  api.get("/accounts/:id/ledger", (req, res) => { books(req); res.json(L.accountLedger(db, id(req), req.query.from || "0000-01-01", req.query.to || today())); });
  api.get("/journals", (req, res) => {
    books(req);
    res.json(db.prepare(`SELECT j.*, (SELECT SUM(debit) FROM journal_lines WHERE entry_id = j.id) AS amount, u.name AS created_by_name FROM journal_entries j LEFT JOIN users u ON u.id = j.created_by ORDER BY j.date DESC, j.id DESC LIMIT 500`).all());
  });
  api.get("/journals/:id", (req, res) => { books(req); res.json(L.getJournal(db, id(req))); });
  api.post("/journals", (req, res) => { books(req); res.json({ id: L.saveJournal(db, req.user.id, req.body || {}) }); });
  api.post("/transfers", (req, res) => { need(req.user, ["money", "reports.finance"]); res.json({ id: L.transfer(db, req.user.id, req.body || {}) }); });
  api.delete("/journals/:id", (req, res) => {
    books(req);
    const j = L.getJournal(db, id(req));
    db.prepare("DELETE FROM journal_entries WHERE id = ?").run(j.id);
    B.log(db, req.user.id, "deleted journal entry", "journal", j.id, j.number);
    res.json({ ok: true });
  });
  api.get("/reports/trial-balance", (req, res) => { books(req); res.json(L.trialBalance(db, req.query.to || today())); });
  api.get("/reports/balance-sheet", (req, res) => { books(req); res.json(L.balanceSheet(db, req.query.to || today())); });

  // ---- in-app assistant (chat). Not callable by API keys or by the assistant itself.
  const noHelpers = (req) => { if (req.viaApi) throw httpError(403, "Use the assistant from the app"); };
  api.get("/assistant/status", (req, res) => { noHelpers(req); res.json({ ready: IN.readerReady() }); });
  api.post("/assistant/chat", async (req, res) => {
    noHelpers(req);
    const base = `http://127.0.0.1:${req.socket.localPort}`;
    res.json(await AS.chat({ user: req.user, chatId: req.body?.chat_id, text: req.body?.text, base }));
  });
  api.delete("/assistant/chat/:id", (req, res) => { noHelpers(req); AS.forgetChat(req.user, req.params.id); res.json({ ok: true }); });

  app.use("/api", api);
  app.use("/api", (_req, _res, next) => next(httpError(404, "Not found")));
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    // 502/503 are our own "email failed" / "not set up yet" messages; other 5xx are bugs and stay generic
    res.status(status).json({ error: status >= 500 && ![502, 503].includes(status) ? "Something went wrong on the server" : err.message });
  });
  return app;
}
