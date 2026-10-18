// Orders inbox: customer POs and supplier bills arrive by email (or are pasted / uploaded), AI reads them into a draft,
// and the right person turns the draft into a quote, Job or supplier bill with one click (after checking it).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { can } from "./auth.js";
import { httpError } from "./books.js";
import { aiReady, checkMatches, readPaperwork } from "./ai.js";
import { notify, usersWith } from "./collab.js";

const MAX_FILE = 10 * 1024 * 1024;
// tests swap in a fake reader so they don't call the AI
let reader = { ready: aiReady, read: readPaperwork };
export const useReader = (r) => { reader = r; };
export const readerReady = () => reader.ready();
const KEEP = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf|text\/(plain|csv))$/;

// which inbox rows a user may see: Sales gets customer orders, Operations/Purchaser get supplier bills, directors everything
const visibleTypes = (user) => {
  if (can(user, "admin")) return null;
  const t = [];
  if (can(user, "sales.write")) t.push("customer_order");
  if (can(user, "buy")) t.push("supplier_bill");
  return t;
};
export const canUseInbox = (user) => can(user, "admin") || can(user, "sales.write") || can(user, "buy");
const allowed = (user, row) => {
  const t = visibleTypes(user);
  return t === null || !row.doc_type || row.doc_type === "other" || t.includes(row.doc_type);
};

export function addMessage(db, uploadDir, { source, message_id = null, from_addr = null, subject = null, body_text = "", received_at = null, files = [], created_by = null }) {
  if (message_id && db.prepare("SELECT 1 FROM inbox_messages WHERE message_id = ?").get(message_id)) return null;
  const id = Number(db.prepare("INSERT INTO inbox_messages (source, message_id, from_addr, subject, body_text, received_at, created_by) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)")
    .run(source, message_id, from_addr, subject, body_text || "", received_at, created_by).lastInsertRowid);
  const dir = join(uploadDir, "inbox");
  mkdirSync(dir, { recursive: true });
  for (const f of files) {
    if (!KEEP.test(f.mime) || !f.buffer?.length || f.buffer.length > MAX_FILE) continue;
    const stored = `inbox/${Date.now()}-${randomBytes(6).toString("hex")}`;
    writeFileSync(join(uploadDir, stored), f.buffer);
    db.prepare("INSERT INTO inbox_files (inbox_id, filename, mime, size, path) VALUES (?, ?, ?, ?, ?)").run(id, String(f.filename || "file").replace(/[^\w.\- ]+/g, "_").slice(0, 120), f.mime, f.buffer.length, stored);
  }
  return id;
}

// AI reads one message. Runs in the background; the row's status tells the UI where it is.
export async function processMessage(db, uploadDir, id) {
  const m = db.prepare("SELECT * FROM inbox_messages WHERE id = ?").get(id);
  if (!m || !reader.ready()) return;
  db.prepare("UPDATE inbox_messages SET status = 'reading', error = NULL WHERE id = ?").run(id);
  try {
    const files = db.prepare("SELECT * FROM inbox_files WHERE inbox_id = ?").all(id).map((f) => ({ filename: f.filename, mime: f.mime === "image/jpg" ? "image/jpeg" : f.mime, buffer: readFileSync(join(uploadDir, f.path)) }));
    const catalog = db.prepare("SELECT id, name, sku, unit FROM items WHERE active = 1 ORDER BY name").all();
    const contacts = db.prepare("SELECT id, type, name FROM contacts WHERE active = 1 ORDER BY name").all();
    const x = checkMatches(db, await reader.read({ text: m.body_text, subject: m.subject, from: m.from_addr, files, catalog, contacts }));
    const status = x.doc_type === "other" ? "ignored" : "ready";
    db.prepare("UPDATE inbox_messages SET status = ?, doc_type = ?, extraction = ? WHERE id = ?").run(status, x.doc_type, JSON.stringify(x), id);
    if (status === "ready") {
      const who = x.doc_type === "customer_order" ? usersWith(db, "sales.write") : usersWith(db, "buy");
      notify(db, [...who, ...usersWith(db, "admin")], { kind: "inbox", title: `${x.doc_type === "customer_order" ? "New order" : "Supplier bill"} read by AI: ${x.party_name || m.from_addr || "unknown sender"}`, body: x.summary, link: `/inbox?open=${id}`, actor: m.created_by });
    }
  } catch (e) {
    db.prepare("UPDATE inbox_messages SET status = 'error', error = ? WHERE id = ?").run(String(e.message || e).slice(0, 500), id);
  }
}

// one at a time, in arrival order
let queue = Promise.resolve();
export const enqueue = (db, uploadDir, id) => { queue = queue.then(() => processMessage(db, uploadDir, id)).catch(() => {}); return queue; };

export function listInbox(db, user, { status = "" } = {}) {
  const rows = db.prepare(`SELECT m.id, m.source, m.from_addr, m.subject, m.received_at, m.status, m.doc_type, m.extraction, m.error, m.result_kind, m.result_id,
      (SELECT COUNT(*) FROM inbox_files f WHERE f.inbox_id = m.id) AS file_count
    FROM inbox_messages m WHERE (? = '' OR m.status = ?) ORDER BY m.id DESC LIMIT 300`).all(status, status);
  return rows.filter((r) => allowed(user, r)).map((r) => {
    const x = r.extraction ? JSON.parse(r.extraction) : null;
    return { ...r, extraction: undefined, summary: x?.summary, party_name: x?.party_name, line_count: x?.lines?.length ?? null };
  });
}

export function getMessage(db, user, id) {
  const m = db.prepare("SELECT * FROM inbox_messages WHERE id = ?").get(id);
  if (!m || !allowed(user, m)) throw httpError(404, "Not found");
  const x = m.extraction ? JSON.parse(m.extraction) : null;
  // costs on a supplier bill stay away from Sales, selling rates on an order away from Operations
  if (x && ((x.doc_type === "supplier_bill" && !can(user, "cost.view")) || (x.doc_type === "customer_order" && !can(user, "price.view")))) x.lines = x.lines.map((l) => ({ ...l, rate: null })), x.total = null;
  if (x) {
    x.party_match_name = x.party_match_id ? db.prepare("SELECT name FROM contacts WHERE id = ?").get(x.party_match_id)?.name : null;
    x.lines = x.lines.map((l) => ({ ...l, item_name: l.item_match_id ? db.prepare("SELECT name FROM items WHERE id = ?").get(l.item_match_id)?.name : null }));
  }
  return { ...m, extraction: x, files: db.prepare("SELECT id, filename, mime, size FROM inbox_files WHERE inbox_id = ?").all(id) };
}

export function inboxFile(db, user, fileId) {
  const f = db.prepare("SELECT f.*, m.doc_type FROM inbox_files f JOIN inbox_messages m ON m.id = f.inbox_id WHERE f.id = ?").get(fileId);
  if (!f || !allowed(user, f)) throw httpError(404, "Not found");
  return f;
}

export function markHandled(db, user, id, { status, result_kind = null, result_id = null }) {
  const m = db.prepare("SELECT * FROM inbox_messages WHERE id = ?").get(id);
  if (!m || !allowed(user, m)) throw httpError(404, "Not found");
  if (!["done", "ignored", "ready"].includes(status)) throw httpError(400, "Invalid status");
  db.prepare("UPDATE inbox_messages SET status = ?, result_kind = ?, result_id = ?, handled_by = ?, handled_at = datetime('now') WHERE id = ?").run(status, result_kind, result_id, user.id, id);
}

// ---- email: check the orders mailbox every few minutes (IMAP). Settings come from the server environment.
export function startMailPoller(db, uploadDir, log = console) {
  const { IMAP_HOST, IMAP_USER, IMAP_PASSWORD } = process.env;
  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) return null;
  const every = Math.max(2, Number(process.env.MAIL_POLL_MINUTES) || 5) * 60000;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { const n = await fetchMail(db, uploadDir); if (n) log.log(`Inbox: ${n} new email(s)`); }
    catch (e) { log.error("Inbox check failed:", e.message); }
    finally { running = false; }
  };
  setTimeout(tick, 10000);
  return setInterval(tick, every);
}

export async function fetchMail(db, uploadDir) {
  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const client = new ImapFlow({
    host: process.env.IMAP_HOST, port: Number(process.env.IMAP_PORT) || 993, secure: process.env.IMAP_SECURE !== "false",
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD }, logger: false,
  });
  await client.connect();
  let added = 0;
  const lock = await client.getMailboxLock(process.env.IMAP_FOLDER || "INBOX");
  try {
    // look back a few days; message ids we already have are skipped, and the mailbox itself is never changed
    const since = new Date(Date.now() - (Number(process.env.MAIL_LOOKBACK_DAYS) || 3) * 864e5);
    for await (const msg of client.fetch({ since }, { source: true, uid: true })) {
      const mail = await simpleParser(msg.source);
      const messageId = mail.messageId || `uid-${msg.uid}`;
      if (db.prepare("SELECT 1 FROM inbox_messages WHERE message_id = ?").get(messageId)) continue;
      const fromAddr = mail.from?.value?.[0]?.address || mail.from?.text || null;
      if (fromAddr && process.env.IMAP_USER && fromAddr.toLowerCase() === process.env.IMAP_USER.toLowerCase()) continue; // our own sent mail
      const id = addMessage(db, uploadDir, {
        source: "email", message_id: messageId, from_addr: mail.from?.text || fromAddr, subject: mail.subject || "",
        body_text: (mail.text || "").slice(0, 100000), received_at: (mail.date || new Date()).toISOString().replace("T", " ").slice(0, 19),
        files: (mail.attachments || []).map((a) => ({ filename: a.filename || "attachment", mime: a.contentType, buffer: a.content })),
      });
      if (id) { added++; enqueue(db, uploadDir, id); }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return added;
}
