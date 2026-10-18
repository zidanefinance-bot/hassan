// Working together: who may see a record, comments with @mentions, and each user's notification inbox.
// A notification is only ever sent to someone who can open the record it points to.
import { can, ROLES } from "./auth.js";
import { httpError, today } from "./books.js";

export const DOC_READ = { quote: ["sales.read"], invoice: ["sales.read"], dc: ["sales.read"], credit_note: ["sales.read"], po: ["ops.read"], bill: ["ops.read"], vendor_credit: ["ops.read"] };
export const CONTACT_READ = { customer: ["sales.read"], supplier: ["ops.read"] };
export const DOC_PATH = { quote: "quotes", invoice: "invoices", dc: "delivery-challans", credit_note: "credit-notes", po: "purchase-orders", bill: "bills", vendor_credit: "vendor-credits" };
export const ENTITIES = ["document", "job", "payment", "expense", "contact", "item"];
const canAny = (user, perms = []) => perms.some((p) => can(user, p));

export function canSeeEntity(db, user, entity, entityId) {
  if (entity === "document") { const d = db.prepare("SELECT kind FROM documents WHERE id = ?").get(entityId); return Boolean(d && canAny(user, DOC_READ[d.kind])); }
  if (entity === "job") return canAny(user, ["sales.read", "ops.read"]) && Boolean(db.prepare("SELECT 1 FROM jobs WHERE id = ?").get(entityId));
  if (entity === "payment") return can(user, "money");
  if (entity === "expense") { const e = db.prepare("SELECT job_id FROM expenses WHERE id = ?").get(entityId); return Boolean(e && (can(user, "expenses") || (e.job_id && can(user, "buy")))); }
  if (entity === "contact") { const c = db.prepare("SELECT type FROM contacts WHERE id = ?").get(entityId); return Boolean(c && canAny(user, CONTACT_READ[c.type])); }
  if (entity === "item") return Boolean(db.prepare("SELECT 1 FROM items WHERE id = ?").get(entityId));
  return false;
}

// short name and app link for a record, e.g. { title: "INV-00045 · Al-Noor", link: "/invoices/45" }
export function describeEntity(db, entity, entityId) {
  if (entity === "document") {
    const d = db.prepare("SELECT d.kind, d.number, c.name FROM documents d JOIN contacts c ON c.id = d.contact_id WHERE d.id = ?").get(entityId);
    return d && { title: `${d.number} · ${d.name}`, link: `/${DOC_PATH[d.kind]}/${entityId}` };
  }
  if (entity === "job") {
    const j = db.prepare("SELECT j.number, c.name FROM jobs j JOIN contacts c ON c.id = j.customer_id WHERE j.id = ?").get(entityId);
    return j && { title: `${j.number} · ${j.name}`, link: `/jobs/${entityId}` };
  }
  if (entity === "payment") { const p = db.prepare("SELECT number FROM payments WHERE id = ?").get(entityId); return p && { title: p.number, link: `/payments/${entityId}` }; }
  if (entity === "expense") { const e = db.prepare("SELECT category, date FROM expenses WHERE id = ?").get(entityId); return e && { title: `Expense · ${e.category} · ${e.date}`, link: "/expenses" }; }
  if (entity === "contact") { const c = db.prepare("SELECT name FROM contacts WHERE id = ?").get(entityId); return c && { title: c.name, link: `/contacts/${entityId}` }; }
  if (entity === "item") { const i = db.prepare("SELECT name FROM items WHERE id = ?").get(entityId); return i && { title: i.name, link: `/items/${entityId}` }; }
  return null;
}

const activeUsers = (db) => db.prepare("SELECT id, name, role FROM users WHERE active = 1").all();
export const usersWith = (db, perm) => activeUsers(db).filter((u) => ROLES[u.role]?.includes(perm)).map((u) => u.id);
const userById = (db, id) => db.prepare("SELECT id, name, role, active FROM users WHERE id = ?").get(id);

// Delivery hooks (Telegram etc.) register here; each gets (user, notification) after it is stored.
const deliverers = [];
export const onNotify = (fn) => deliverers.push(fn);

// Send one notification to each user in userIds (except the actor). When `entity` is given, users who can't open it are skipped.
// `once` skips a user who already has the same unread alert, so repeated events don't pile up.
export function notify(db, userIds, { kind, title, body = null, link = null, actor = null, entity = null, entityId = null, once = false }) {
  const sent = [];
  for (const uid of new Set(userIds.filter(Boolean).map(Number))) {
    if (uid === actor) continue;
    const u = userById(db, uid);
    if (!u?.active) continue;
    if (entity && !canSeeEntity(db, u, entity, entityId)) continue;
    if (once && db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND kind = ? AND IFNULL(link,'') = IFNULL(?,'') AND read_at IS NULL").get(uid, kind, link)) continue;
    const r = db.prepare("INSERT INTO notifications (user_id, kind, title, body, link, actor_id) VALUES (?, ?, ?, ?, ?, ?)").run(uid, kind, title, body, link, actor);
    const n = { id: Number(r.lastInsertRowid), user_id: uid, kind, title, body, link };
    sent.push(n);
    for (const d of deliverers) { try { d(db, u, n); } catch (e) { console.error("notification delivery failed:", e.message); } }
  }
  return sent;
}

// Business events → who should hear about them. Called by the API after each action succeeds.
export function notifyEvent(db, actor, event, data) {
  const about = (entity, id) => describeEntity(db, entity, id) || { title: "", link: null };
  const base = (entity, id) => ({ ...about(entity, id), actor, entity, entityId: id });
  const job = (id) => db.prepare("SELECT created_by FROM jobs WHERE id = ?").get(id) || {};
  switch (event) {
    case "job.created": {
      const a = base("job", data.jobId);
      return notify(db, usersWith(db, "ops.write"), { ...a, kind: "job", title: `New Job: ${a.title}`, body: "Start procurement" });
    }
    case "job.ready": {
      const a = base("job", data.jobId);
      return notify(db, [...usersWith(db, "sales.write"), job(data.jobId).created_by], { ...a, kind: "job", title: `Material ready: ${a.title}`, body: "Make the delivery challan" });
    }
    case "job.not_available": {
      const a = base("job", data.jobId);
      return notify(db, [...usersWith(db, "sales.write"), job(data.jobId).created_by], { ...a, kind: "job", title: `Not available in market: ${data.itemName}`, body: `${a.title}. Talk to the customer about a substitute.` });
    }
    case "doc.issued": {
      const a = base("document", data.docId);
      const d = db.prepare("SELECT kind, total FROM documents WHERE id = ?").get(data.docId);
      if (!d || !["invoice", "bill"].includes(d.kind)) return [];
      return notify(db, usersWith(db, "verify"), { ...a, kind: "verify", title: `${d.kind === "invoice" ? "Invoice" : "Supplier bill"} to verify: ${a.title}`, body: `Rs ${d.total.toLocaleString("en-PK")}`, once: true });
    }
    case "doc.over_limit": {
      const a = base("document", data.docId);
      return notify(db, usersWith(db, "admin"), { ...a, kind: "approval", title: `Approval needed: ${a.title}`, body: data.message, once: true });
    }
    case "payment.received": {
      const sent = [];
      for (const al of db.prepare("SELECT a.document_id, a.amount, d.created_by, d.kind FROM payment_allocations a JOIN documents d ON d.id = a.document_id WHERE a.payment_id = ? AND a.id > ?").all(data.paymentId, data.after || 0)) {
        if (al.kind !== "invoice") continue;
        const a = base("document", al.document_id);
        sent.push(...notify(db, [al.created_by], { ...a, kind: "payment", title: `Payment received: ${a.title}`, body: `Rs ${al.amount.toLocaleString("en-PK")}` }));
      }
      return sent;
    }
    default:
      return [];
  }
}

// ---- comments
export function listComments(db, user, entity, entityId) {
  if (!canSeeEntity(db, user, entity, entityId)) throw httpError(403, "You don't have access to this");
  return db.prepare("SELECT c.id, c.body, c.created_at, c.user_id, u.name AS user_name, u.role FROM comments c JOIN users u ON u.id = c.user_id WHERE entity = ? AND entity_id = ? ORDER BY c.id").all(entity, entityId);
}

// people who may be @mentioned on a record: those who can open it
export function mentionable(db, user, entity, entityId) {
  if (!canSeeEntity(db, user, entity, entityId)) throw httpError(403, "You don't have access to this");
  return activeUsers(db).filter((u) => u.id !== user.id && canSeeEntity(db, u, entity, entityId)).map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

const recordOwner = (db, entity, id) => {
  const table = { document: "documents", job: "jobs", payment: "payments", expense: "expenses" }[entity];
  return table ? db.prepare(`SELECT created_by FROM ${table} WHERE id = ?`).get(id)?.created_by : null;
};

export function addComment(db, user, { entity, entity_id, body, mentions = [] }) {
  const entityId = Number(entity_id);
  if (!ENTITIES.includes(entity)) throw httpError(400, "Unknown record type");
  if (!canSeeEntity(db, user, entity, entityId)) throw httpError(403, "You don't have access to this");
  const text = String(body || "").trim();
  if (!text) throw httpError(400, "Write something first");
  if (text.length > 4000) throw httpError(400, "Comment is too long");
  const id = Number(db.prepare("INSERT INTO comments (entity, entity_id, user_id, body) VALUES (?, ?, ?, ?)").run(entity, entityId, user.id, text).lastInsertRowid);
  const about = describeEntity(db, entity, entityId);
  const short = text.length > 140 ? text.slice(0, 137) + "…" : text;
  const common = { link: about?.link, actor: user.id, entity, entityId, body: short };
  // mentioned people get a "question for you"; everyone else in the thread and the record's creator get a reply alert
  const mentioned = notify(db, mentions.map(Number), { ...common, kind: "mention", title: `${user.name} asked you on ${about?.title}` });
  const told = new Set(mentioned.map((n) => n.user_id));
  const others = [recordOwner(db, entity, entityId), ...db.prepare("SELECT DISTINCT user_id FROM comments WHERE entity = ? AND entity_id = ?").all(entity, entityId).map((r) => r.user_id)].filter((u) => u && !told.has(u));
  notify(db, others, { ...common, kind: "comment", title: `${user.name} commented on ${about?.title}` });
  // answering on a record clears your own "asked you" alerts there
  if (about?.link) db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND kind = 'mention' AND link = ? AND read_at IS NULL").run(user.id, about.link);
  return id;
}

export function deleteComment(db, user, id) {
  const c = db.prepare("SELECT * FROM comments WHERE id = ?").get(id);
  if (!c) throw httpError(404, "Not found");
  if (c.user_id !== user.id && !can(user, "admin")) throw httpError(403, "Only the writer or a director can delete a comment");
  db.prepare("DELETE FROM comments WHERE id = ?").run(id);
}

// ---- inbox
export function inbox(db, userId, limit = 40) {
  return {
    unread: db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL").get(userId).n,
    items: db.prepare("SELECT n.*, u.name AS actor_name FROM notifications n LEFT JOIN users u ON u.id = n.actor_id WHERE n.user_id = ? ORDER BY n.id DESC LIMIT ?").all(userId, limit),
  };
}
export function markRead(db, userId, ids) {
  if (ids === "all") return db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(userId);
  for (const id of ids || []) db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL").run(Number(id), userId);
}

// Once a day: low stock to Operations, newly overdue invoices to Sales and Accounts. Safe to call often; it runs once per date.
export function dailyAlerts(db) {
  const t = today();
  const last = db.prepare("SELECT value FROM settings WHERE key = 'lastDailyAlerts'").get();
  if (last && JSON.parse(last.value) === t) return 0;
  db.prepare("INSERT INTO settings (key, value) VALUES ('lastDailyAlerts', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(t));
  let n = 0;
  const low = db.prepare("SELECT id, name, unit, stock_qty, reorder_level FROM items WHERE active = 1 AND track_stock = 1 AND reorder_level > 0 AND stock_qty <= reorder_level ORDER BY name").all();
  if (low.length) {
    n += notify(db, [...usersWith(db, "buy"), ...usersWith(db, "admin")], { kind: "stock", title: `Low stock: ${low.length} item${low.length > 1 ? "s" : ""} at or below reorder level`, body: low.slice(0, 5).map((i) => `${i.name} (${i.stock_qty} ${i.unit})`).join(", "), link: "/items?low=1", once: true }).length;
  }
  const overdue = db.prepare(`SELECT d.id, d.number, c.name FROM documents d JOIN contacts c ON c.id = d.contact_id
    WHERE d.kind = 'invoice' AND d.status = 'open' AND d.due_date = date(?, '-1 day')
    AND d.total - IFNULL((SELECT SUM(amount) FROM payment_allocations WHERE document_id = d.id), 0) > 0.001`).all(t);
  for (const d of overdue) {
    n += notify(db, [...usersWith(db, "sales.write"), ...usersWith(db, "money")], { kind: "overdue", title: `Overdue today: ${d.number} · ${d.name}`, body: "Follow up for payment", link: `/invoices/${d.id}`, entity: "document", entityId: d.id }).length;
  }
  return n;
}
