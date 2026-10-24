// Reasons and approvals: editing or deleting a record needs a reason (kept in its activity), and only a director
// deletes straight away. Anyone else's delete becomes a request the director approves (the delete then runs as
// the director) or rejects. Drafts are scratch work: no reason and no approval needed for them.
import { can } from "./auth.js";
import { log } from "./books.js";
import { canSeeEntity, DOC_PATH, notify, usersWith } from "./collab.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS delete_requests (
  id INTEGER PRIMARY KEY, path TEXT NOT NULL, kind TEXT NOT NULL, entity TEXT, entity_id INTEGER, title TEXT, link TEXT,
  reason TEXT NOT NULL, requested_by INTEGER REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by INTEGER REFERENCES users(id), decided_at TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;
export const setupGuard = (db) => db.exec(SCHEMA);

const ROUTES = [["contacts", "contact"], ["items", "item"], ["jobs", "job"], ["documents", "document"], ["payments", "payment"], ["expenses", "expense"],
  ["refunds", "refund"], ["allocations", "allocation"], ["packing", "packing"], ["attachments", "attachment"], ["journals", "journal"], ["accounts", "account"], ["kits", "kit"]];
const EDIT_NEEDS_REASON = new Set(["contact", "item", "job", "document", "expense", "account", "kit"]);
const DOC_KINDS = Object.keys(DOC_PATH);

function match(path) {
  const m = /^\/([a-z-]+)\/(\d+)$/.exec(path);
  const r = m && ROUTES.find(([p]) => p === m[1]);
  return r ? { kind: r[1], id: Number(m[2]) } : null;
}

// What the record is, under the entity name its activity is logged with
export function describe(db, kind, id) {
  const one = (sql) => { try { return db.prepare(sql).get(id); } catch { return null; } };
  if (kind === "document") { const d = one("SELECT d.kind, d.number, d.status, c.name FROM documents d LEFT JOIN contacts c ON c.id = d.contact_id WHERE d.id = ?"); return d && { entity: d.kind, entityId: id, title: `${d.number} · ${d.name || ""}`, link: `/${DOC_PATH[d.kind]}/${id}`, draft: ["draft", "enquiry"].includes(d.status) }; }
  if (kind === "contact") { const c = one("SELECT name, type FROM contacts WHERE id = ?"); return c && { entity: c.type, entityId: id, title: c.name, link: `/contacts/${id}` }; }
  if (kind === "item") { const i = one("SELECT name FROM items WHERE id = ?"); return i && { entity: "item", entityId: id, title: i.name, link: `/items/${id}` }; }
  if (kind === "job") { const j = one("SELECT j.number, c.name FROM jobs j LEFT JOIN contacts c ON c.id = j.customer_id WHERE j.id = ?"); return j && { entity: "job", entityId: id, title: `${j.number} · ${j.name || ""}`, link: `/jobs/${id}` }; }
  if (kind === "payment") { const p = one("SELECT number, amount FROM payments WHERE id = ?"); return p && { entity: "payment", entityId: id, title: `${p.number} · Rs ${p.amount}`, link: `/payments/${id}` }; }
  if (kind === "expense") { const e = one("SELECT category, amount, date, job_id FROM expenses WHERE id = ?"); return e && { entity: "expense", entityId: id, title: `Expense · ${e.category} · Rs ${e.amount} · ${e.date}`, link: e.job_id ? `/jobs/${e.job_id}` : "/expenses" }; }
  if (kind === "refund") { const r = one("SELECT number, amount FROM refunds WHERE id = ?"); return r && { entity: "refund", entityId: id, title: `Refund ${r.number} · Rs ${r.amount}`, link: null }; }
  if (kind === "allocation") { const a = one("SELECT a.amount, d.number, d.kind, d.id AS doc_id FROM payment_allocations a JOIN documents d ON d.id = a.document_id WHERE a.id = ?"); return a && { entity: a.kind, entityId: a.doc_id, title: `Rs ${a.amount} applied to ${a.number}`, link: `/${DOC_PATH[a.kind]}/${a.doc_id}` }; }
  if (kind === "packing") { const p = one("SELECT p.bags, p.job_id, j.number FROM job_packing p JOIN jobs j ON j.id = p.job_id WHERE p.id = ?"); return p && { entity: "job", entityId: p.job_id, title: `Packing entry · ${p.bags} bags · ${p.number}`, link: `/jobs/${p.job_id}` }; }
  if (kind === "attachment") { const a = one("SELECT entity, entity_id, filename FROM attachments WHERE id = ?"); if (!a) return null; const d = a.entity === "document" ? one(`SELECT kind FROM documents WHERE id = ${Number(a.entity_id)}`) : null; return { entity: d ? d.kind : a.entity, entityId: a.entity_id, title: `File ${a.filename}`, link: null }; }
  if (kind === "journal") { const j = one("SELECT number, kind FROM journal_entries WHERE id = ?"); return j && { entity: "journal", entityId: id, title: `${j.kind === "transfer" ? "Transfer" : "Journal"} ${j.number}`, link: "/journals" }; }
  if (kind === "account") { const a = one("SELECT code, name FROM accounts WHERE id = ?"); return a && { entity: "account", entityId: id, title: `${a.code} ${a.name}`, link: `/accounts/${id}` }; }
  if (kind === "kit") { const k = one("SELECT name FROM kits WHERE id = ?"); return k && { entity: "kit", entityId: id, title: `Kit ${k.name}`, link: "/ration-kits" }; }
  return null;
}

const readReason = (req) => {
  let h = req.get("x-reason") || "";
  try { h = decodeURIComponent(h); } catch {}
  return String(h || req.body?.reason || req.query?.reason || "").trim().slice(0, 500);
};

export function guardMiddleware(db, precheck = () => {}) {
  return (req, res, next) => {
    if ((req.method !== "DELETE" && req.method !== "PUT") || req.viaApi) return next();
    const m = match(req.path);
    if (!m || (req.method === "PUT" && !EDIT_NEEDS_REASON.has(m.kind))) return next();
    const info = describe(db, m.kind, m.id);
    if (!info || info.draft) return next(); // missing → the route answers 404; drafts are free to change
    const del = req.method === "DELETE";
    const reason = readReason(req);
    if (!reason) return res.status(428).json({ error: `Please give a reason to ${del ? "delete" : "change"} this`, code: "reason_required", action: del ? "delete" : "edit", what: info.title });
    const director = can(req.user, "admin");
    let approval = null;
    if (del && director && req.get("x-approval")) {
      approval = db.prepare("SELECT * FROM delete_requests WHERE id = ? AND status = 'pending'").get(Number(req.get("x-approval")));
      if (!approval || approval.path !== req.path) return res.status(409).json({ error: "This request was already handled" });
    }
    if (del && !director) {
      try { precheck(req, m.kind, m.id); } catch (e) { return next(e); }
      const open = db.prepare("SELECT id FROM delete_requests WHERE path = ? AND status = 'pending'").get(req.path);
      const rid = open ? open.id : Number(db.prepare("INSERT INTO delete_requests (path, kind, entity, entity_id, title, link, reason, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(req.path, m.kind, info.entity, info.entityId, info.title, info.link, reason, req.user.id).lastInsertRowid);
      if (!open) {
        log(db, req.user.id, "asked to delete", info.entity, info.entityId, `${info.title} — reason: ${reason}`);
        notify(db, usersWith(db, "admin"), { kind: "approval", title: `${req.user.name} wants to delete ${info.title}`, body: `Reason: ${reason}`, link: "/activity", actor: req.user.id });
      }
      return res.status(202).json({ pending: true, request_id: rid, message: "Sent to the Director for approval. It will be deleted once approved." });
    }
    res.on("finish", () => {
      if (res.statusCode >= 300) return;
      log(db, req.user.id, del ? "reason for delete" : "reason for edit", info.entity, info.entityId, `${del ? info.title + " — " : ""}${reason}`);
      if (approval) {
        db.prepare("UPDATE delete_requests SET status = 'approved', decided_by = ?, decided_at = datetime('now') WHERE id = ?").run(req.user.id, approval.id);
        notify(db, [approval.requested_by], { kind: "approval", title: `Delete approved: ${info.title}`, body: `By ${req.user.name}`, link: "/activity", actor: req.user.id });
      }
    });
    next();
  };
}

const ACT = "SELECT a.id, a.action, a.entity, a.entity_id, a.summary, a.at, u.name AS user_name FROM activity a LEFT JOIN users u ON u.id = a.user_id";

// The activity on one record (a Job also shows its quotes, DCs, invoices, bills and costs)
export function recordActivity(db, user, entity, id) {
  if (!canSeeEntity(db, user, entity, id)) return [];
  let where, args;
  if (entity === "document") { where = `a.entity IN (${DOC_KINDS.map(() => "?").join(",")}) AND a.entity_id = ?`; args = [...DOC_KINDS, id]; }
  else if (entity === "contact") { where = "a.entity IN ('customer','supplier','contact') AND a.entity_id = ?"; args = [id]; }
  else if (entity === "job") {
    const docs = db.prepare("SELECT id FROM documents WHERE job_id = ?").all(id).map((d) => d.id);
    const exps = db.prepare("SELECT id FROM expenses WHERE job_id = ?").all(id).map((e) => e.id);
    const q = (xs) => xs.map(() => "?").join(",") || "NULL";
    where = `(a.entity = 'job' AND a.entity_id = ?) OR (a.entity IN (${DOC_KINDS.map(() => "?").join(",")}) AND a.entity_id IN (${q(docs)})) OR (a.entity = 'expense' AND a.entity_id IN (${q(exps)}))`;
    args = [id, ...DOC_KINDS, ...docs, ...exps];
  } else { where = "a.entity = ? AND a.entity_id = ?"; args = [entity, id]; }
  return db.prepare(`${ACT} WHERE ${where} ORDER BY a.id DESC LIMIT 100`).all(...args);
}

export function allActivity(db, { q = "", user_id, limit = 200 } = {}) {
  const w = ["a.entity NOT IN ('api','assistant')"], args = [];
  if (q) { w.push("(a.summary LIKE ? OR a.action LIKE ? OR u.name LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (user_id) { w.push("a.user_id = ?"); args.push(Number(user_id)); }
  return db.prepare(`${ACT} WHERE ${w.join(" AND ")} ORDER BY a.id DESC LIMIT ?`).all(...args, Math.min(Number(limit) || 200, 1000));
}

export function deleteRequests(db, user) {
  const sql = `SELECT r.*, u.name AS requested_by_name, d.name AS decided_by_name FROM delete_requests r LEFT JOIN users u ON u.id = r.requested_by LEFT JOIN users d ON d.id = r.decided_by`;
  return can(user, "admin")
    ? db.prepare(`${sql} WHERE r.status = 'pending' OR r.id IN (SELECT id FROM delete_requests ORDER BY id DESC LIMIT 30) ORDER BY r.status = 'pending' DESC, r.id DESC`).all()
    : db.prepare(`${sql} WHERE r.requested_by = ? ORDER BY r.id DESC LIMIT 30`).all(user.id);
}

export function rejectRequest(db, user, id, note) {
  const r = db.prepare("SELECT * FROM delete_requests WHERE id = ? AND status = 'pending'").get(id);
  if (!r) return false;
  db.prepare("UPDATE delete_requests SET status = 'rejected', decided_by = ?, decided_at = datetime('now'), note = ? WHERE id = ?").run(user.id, String(note || "").slice(0, 500) || null, id);
  log(db, user.id, "refused delete", r.entity, r.entity_id, `${r.title}${note ? " — " + note : ""}`);
  notify(db, [r.requested_by], { kind: "approval", title: `Delete not approved: ${r.title}`, body: note || null, link: "/activity", actor: user.id });
  return true;
}
