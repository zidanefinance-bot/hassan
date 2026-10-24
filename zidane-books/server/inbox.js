// Orders inbox: customer POs and supplier bills arrive by email (or are pasted / uploaded), AI reads them into a draft,
// and the right person turns the draft into a quote, Job or supplier bill with one click (after checking it).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { can } from "./auth.js";
import { httpError } from "./books.js";
import { aiReady, readPaperwork } from "./ai.js";
import { parseOrderPdf } from "./poparse.js";
import { completeDraft, rememberLines } from "./matching.js";
import { isReminder, parseQueryEmail, plainSubject, senderDomain } from "./queryparse.js";
import { notify, usersWith } from "./collab.js";
import { createJob } from "./jobs.js";
import { getSetting } from "./books.js";

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
// not yet read (or not an order): only directors and whoever added it, so a supplier's rates never reach Sales by accident
const allowed = (user, row) => {
  const t = visibleTypes(user);
  if (t === null) return true;
  if (!row.doc_type || row.doc_type === "other") return row.created_by === user.id;
  return t.includes(row.doc_type);
};

export function addMessage(db, uploadDir, { source, message_id = null, from_addr = null, subject = null, body_text = "", body_html = null, received_at = null, files = [], created_by = null }) {
  if (message_id && db.prepare("SELECT 1 FROM inbox_messages WHERE message_id = ?").get(message_id)) return null;
  const id = Number(db.prepare("INSERT INTO inbox_messages (source, message_id, from_addr, subject, body_text, body_html, received_at, created_by) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)")
    .run(source, message_id, from_addr, subject, body_text || "", body_html ? String(body_html).slice(0, 500000) : null, received_at, created_by).lastInsertRowid);
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
  if (!m) return;
  db.prepare("UPDATE inbox_messages SET status = 'reading', error = NULL WHERE id = ?").run(id);
  try {
    const fileRows = db.prepare("SELECT * FROM inbox_files WHERE inbox_id = ?").all(id);
    const files = fileRows.map((f) => ({ filename: f.filename, mime: f.mime === "image/jpg" ? "image/jpeg" : f.mime, buffer: readFileSync(join(uploadDir, f.path)) }));
    // computer-made PDFs (ERP purchase orders, printed bills) are read for free; only photos and scans need AI
    let draft = null;
    const more = [];
    for (const [k, f] of files.entries()) {
      if (f.mime !== "application/pdf") continue;
      const d = await parseOrderPdf(f.buffer);
      if (d && !draft) draft = d; else if (d) more.push(fileRows[k]);
    }
    // several POs in one email: each becomes its own inbox entry (and Job), the first stays here
    for (const f of more) {
      const nid = Number(db.prepare("INSERT INTO inbox_messages (source, from_addr, subject, body_text, received_at, created_by) VALUES (?, ?, ?, ?, ?, ?)")
        .run(m.source, m.from_addr, [m.subject, f.filename].filter(Boolean).join(" · "), m.body_text || "", m.received_at, m.created_by).lastInsertRowid);
      db.prepare("UPDATE inbox_files SET inbox_id = ? WHERE id = ?").run(nid, f.id);
      await processMessage(db, uploadDir, nid);
    }
    // "RE: RFQ … REMINDER": the buyer chasing a query we already have. Not a new query; Sales hears they're waiting
    if (!draft && m.source === "email" && isReminder(m.subject, m.body_text)) {
      const domain = senderDomain(m.from_addr);
      const first = db.prepare("SELECT id, status, subject, from_addr FROM inbox_messages WHERE id < ? AND received_at >= datetime(?, '-45 days') ORDER BY id DESC").all(id, m.received_at)
        .find((o) => plainSubject(o.subject) === plainSubject(m.subject) && (!domain || senderDomain(o.from_addr) === domain));
      if (first) {
        db.prepare("UPDATE inbox_messages SET status = 'ignored', doc_type = 'customer_order', error = ? WHERE id = ?").run(`Reminder for an earlier query (#${first.id})`, id);
        if (first.status !== "done") notify(db, [...usersWith(db, "sales.write"), ...usersWith(db, "admin")], { kind: "inbox", title: `Reminder: ${m.from_addr || "buyer"} is waiting for our quote`, body: m.subject || "", link: `/inbox?open=${first.id}` });
        return;
      }
    }
    // an RFQ typed into the email (their ERP's item table pasted in): read it without AI
    if (!draft && ["email", "paste", "telegram"].includes(m.source)) {
      const q = parseQueryEmail({ subject: m.subject, text: m.body_text, html: m.body_html, from: m.from_addr });
      if (q) {
        const domain = q.sender_domain;
        const known = domain && db.prepare("SELECT id, name FROM contacts WHERE type = 'customer' AND active = 1 AND LOWER(email) LIKE ?").get(`%@${domain}`);
        draft = known ? { ...q, party_match_id: known.id, party_name: known.name } : q;
      }
    }
    // emails that aren't orders (newsletters, ledgers, "inbox zero"…) are set aside quietly; a customer's query
    // without a readable PO goes to Sales to handle by hand while AI reading is off
    if (!draft && m.source === "email" && !reader.ready()) {
      const real = files.filter((f) => !(SIGNATURE_IMAGE.test(f.filename) && f.buffer.length < 80 * 1024));
      const text = `${m.subject || ""}\n${String(m.body_text || "").slice(0, 3000)}`;
      // automatic mail (Google location sharing, sign-in alerts, newsletters …) is never a customer's order
      if (AUTOMATED_FROM.test(m.from_addr || "") || AUTOMATED_SUBJECT.test(m.subject || "")) {
        db.prepare("UPDATE inbox_messages SET status = 'ignored', error = ? WHERE id = ?").run("Automatic email, not an order", id);
        return;
      }
      if (QUERY.test(text)) {
        db.prepare("UPDATE inbox_messages SET status = 'error', doc_type = 'customer_order', error = ? WHERE id = ?").run("A customer's query or RFQ without a readable PO. Read the email and make the enquiry / quote (AI reading is off).", id);
        notify(db, [...usersWith(db, "sales.write"), ...usersWith(db, "admin")], { kind: "inbox", title: `Query by email: ${m.subject || m.from_addr || "no subject"}`, body: m.from_addr || "", link: `/inbox?open=${id}` });
        return;
      }
      if (!real.length) {
        db.prepare("UPDATE inbox_messages SET status = 'ignored', error = ? WHERE id = ?").run("Not an order or a query (no PO attached)", id);
        return;
      }
    }
    if (!draft) {
      if (!reader.ready()) throw new Error(files.length ? "This file has no readable text (a photo or scan). Turn on AI reading, or type the order in." : "Nothing to read automatically. Turn on AI reading, or type the order in.");
      const catalog = db.prepare("SELECT id, name, sku, unit FROM items WHERE active = 1 ORDER BY name").all();
      const contacts = db.prepare("SELECT id, type, name FROM contacts WHERE active = 1 ORDER BY name").all();
      draft = { ...(await reader.read({ text: m.body_text, subject: m.subject, from: m.from_addr, files, catalog, contacts })), reader: "ai" };
    }
    const x = completeDraft(db, draft);
    const status = x.doc_type === "other" ? "ignored" : "ready";
    db.prepare("UPDATE inbox_messages SET status = ?, doc_type = ?, extraction = ? WHERE id = ?").run(status, x.doc_type, JSON.stringify(x), id);
    if (status === "ready" && x.doc_type === "customer_order" && autoJob(db, m, x)) return;
    if (status === "ready") {
      const who = x.doc_type === "customer_order" ? usersWith(db, "sales.write") : usersWith(db, "buy");
      // whoever sent it from Telegram hears back too; someone who pasted it in the app is already looking at it
      notify(db, [...who, ...usersWith(db, "admin"), m.source === "telegram" ? m.created_by : null], { kind: "inbox", title: `${x.request === "rfq" ? "New RFQ to quote" : x.doc_type === "customer_order" ? "New order" : "Supplier bill"}${x.reader === "ai" ? " read by AI" : ""}: ${x.party_name || m.from_addr || "unknown sender"}`, body: x.summary, link: `/inbox?open=${id}`, actor: m.source === "telegram" ? null : m.created_by });
    }
  } catch (e) {
    db.prepare("UPDATE inbox_messages SET status = 'error', error = ? WHERE id = ?").run(String(e.message || e).slice(0, 500), id);
  }
}

// A PO we're sure about becomes a Job by itself (like the old sheet filling itself in): a known customer, a PO number,
// every line matched to one of our items for sure. The same PO arriving again (a resent email) points at the Job it
// already is. Anything less certain waits in the inbox for a person. Director can switch this off in Settings.
function autoJob(db, m, x) {
  if (getSetting(db, "autoJobFromPo") === false) return false;
  if (!x.party_match_id || !x.reference) return false;
  const existing = db.prepare("SELECT id, number FROM jobs WHERE customer_id = ? AND LOWER(TRIM(customer_po_number)) = LOWER(TRIM(?))").get(x.party_match_id, x.reference);
  if (existing) {
    db.prepare("UPDATE inbox_messages SET status = 'done', result_kind = 'job', result_id = ?, handled_at = datetime('now') WHERE id = ?").run(existing.id, m.id);
    return true;
  }
  if (!x.lines.length || x.lines.some((l) => !l.item_match_id || l.match_confidence !== "high" || !(l.qty > 0))) return false;
  const rateOf = db.prepare("SELECT sale_rate, tax_rate FROM items WHERE id = ?");
  const jobId = createJob(db, null, {
    customer_id: x.party_match_id, customer_po_number: x.reference, customer_po_date: x.date, required_date: x.required_date, delivery_location: x.delivery_location,
    order_source: "formal PO", instructions: [x.buyer_name ? `Buyer: ${[x.buyer_name, x.contact_phone].filter(Boolean).join(", ")}` : null, x.notes].filter(Boolean).join("\n") || null,
    items: x.lines.map((l) => { const it = rateOf.get(l.item_match_id); return { item_id: l.item_match_id, qty: l.qty, sale_rate: l.rate ?? it?.sale_rate ?? 0, tax_rate: l.tax_rate ?? it?.tax_rate ?? 0 }; }),
  });
  db.prepare("UPDATE inbox_messages SET status = 'done', result_kind = 'job', result_id = ?, handled_at = datetime('now') WHERE id = ?").run(jobId, m.id);
  attachSource(db, m, "job", jobId, m.created_by || null);
  const job = db.prepare("SELECT number FROM jobs WHERE id = ?").get(jobId);
  notify(db, [...usersWith(db, "sales.write"), ...usersWith(db, "admin")], { kind: "job", title: `Job ${job.number} made from ${x.party_name}'s PO ${x.reference}`, body: `${x.lines.length} item(s) read from the PO${m.source === "email" ? " email" : ""}. Check the rates; Operations has it.`, link: `/jobs/${jobId}` });
  notify(db, usersWith(db, "ops.write"), { kind: "job", title: `New Job ${job.number}: ${x.party_name}`, body: `${x.lines.length} item(s) to arrange`, link: `/jobs/${jobId}` });
  return true;
}

// the paper it came from goes with the Job / document as evidence (the customer's PO, the supplier's bill)
function attachSource(db, m, entity, entityId, userId) {
  const label = m.doc_type === "supplier_bill" ? "Supplier bill" : "Customer PO";
  for (const f of db.prepare("SELECT * FROM inbox_files WHERE inbox_id = ?").all(m.id)) {
    if (db.prepare("SELECT 1 FROM attachments WHERE entity = ? AND entity_id = ? AND path = ?").get(entity, entityId, f.path)) continue;
    db.prepare("INSERT INTO attachments (entity, entity_id, filename, mime, size, path, label, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(entity, entityId, f.filename, f.mime, f.size, f.path, label, userId);
  }
}

// words that make an email a customer's order or query; logos in email signatures (image001.jpg …) don't count as files
const QUERY = /\b(rfq|quotations?|quotes?|enquiry|enquiries|inquiry|requirements?|required|requisition|p\.?\s?o\.?\s*#?\s*\d|purchase\s*orders?|orders?|deliver(y|ies)?|supply|need)\b/i;
const AUTOMATED_FROM = /(no-?reply|do-?not-?reply|notifications?@|alerts?@|mailer-daemon|postmaster|@(.*\.)?(google|accounts\.google|facebookmail|linkedin|microsoft|apple|whatsapp|mailchimp)\.com)/i;
const AUTOMATED_SUBJECT = /(sharing (their |your )?location|location sharing|security alert|sign-?in|verify your|verification code|password|newsletter|unsubscribe|delivery status notification|undeliverable|out of office|automatic reply)/i;
const SIGNATURE_IMAGE = /^image\d+\.(jpe?g|png|gif)$/i;

// one at a time, in arrival order
let queue = Promise.resolve();
export const enqueue = (db, uploadDir, id) => { queue = queue.then(() => processMessage(db, uploadDir, id)).catch(() => {}); return queue; };

export function listInbox(db, user, { status = "" } = {}) {
  const rows = db.prepare(`SELECT m.id, m.source, m.created_by, m.from_addr, m.subject, m.received_at, m.status, m.doc_type, m.extraction, m.error, m.result_kind, m.result_id,
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
  let x = m.extraction ? JSON.parse(m.extraction) : null;
  // match again each time it's opened: a customer or items added since (from this very PO) are found now
  if (x && m.status === "ready") x = completeDraft(db, x);
  // costs on a supplier bill stay away from Sales, selling rates on an order away from Operations
  // (payment terms are money talk too)
  if (x && ((x.doc_type === "supplier_bill" && !can(user, "cost.view")) || (x.doc_type === "customer_order" && !can(user, "price.view")))) {
    x.lines = x.lines.map((l) => ({ ...l, rate: null }));
    x.total = x.payment_terms = x.payment_terms_days = null;
  }
  if (x) {
    const party = x.party_match_id ? db.prepare("SELECT name, payment_terms_days FROM contacts WHERE id = ?").get(x.party_match_id) : null;
    x.party_match_name = party?.name || null;
    x.party_terms_days = x.payment_terms != null ? party?.payment_terms_days ?? null : null;
    x.lines = x.lines.map((l) => ({ ...l, item_name: l.item_match_id ? db.prepare("SELECT name FROM items WHERE id = ?").get(l.item_match_id)?.name : null }));
  }
  return { ...m, extraction: x, files: db.prepare("SELECT id, filename, mime, size FROM inbox_files WHERE inbox_id = ?").all(id) };
}

export function inboxFile(db, user, fileId) {
  const f = db.prepare("SELECT f.*, m.doc_type, m.created_by FROM inbox_files f JOIN inbox_messages m ON m.id = f.inbox_id WHERE f.id = ?").get(fileId);
  if (!f || !allowed(user, f)) throw httpError(404, "Not found");
  return f;
}

export function markHandled(db, user, id, { status, result_kind = null, result_id = null, lines = null }) {
  const m = db.prepare("SELECT * FROM inbox_messages WHERE id = ?").get(id);
  if (!m || !allowed(user, m)) throw httpError(404, "Not found");
  if (!["done", "ignored", "ready"].includes(status)) throw httpError(400, "Invalid status");
  // what the person picked for each line is remembered for this customer/supplier
  if (status === "done" && lines && result_id) {
    const table = result_kind === "job" ? "SELECT customer_id AS c FROM jobs WHERE id = ?" : "SELECT contact_id AS c FROM documents WHERE id = ?";
    const contactId = db.prepare(table).get(result_id)?.c;
    if (contactId) rememberLines(db, contactId, lines);
  }
  db.prepare("UPDATE inbox_messages SET status = ?, result_kind = ?, result_id = ?, handled_by = ?, handled_at = datetime('now') WHERE id = ?").run(status, result_kind, result_id, user.id, id);
  if (status === "done" && result_id && ["job", "quote", "bill", "invoice"].includes(result_kind)) attachSource(db, m, result_kind === "job" ? "job" : "document", result_id, user.id);
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
        body_text: (mail.text || "").slice(0, 100000), body_html: typeof mail.html === "string" ? mail.html : null, received_at: (mail.date || new Date()).toISOString().replace("T", " ").slice(0, 19),
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
