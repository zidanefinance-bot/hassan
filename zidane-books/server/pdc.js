// Post-dated cheques we give suppliers. A PDC is a promise, not money yet: the bank isn't touched until the cheque
// date. Until then it is tracked here (and shown on the bills it is for, so nobody pays them twice); from 7 days
// before its date there's a reminder every other day (7, 5, 3, 1 days before, the day itself), then daily once
// it's past. "Cleared" turns it into a real payment from the bank, applied to its bills. A receiving slip
// (cheque number, bank, date, amount, the bills it covers, a signature box) can be printed for the supplier.
import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getSetting, httpError, log, nextNumber, paidAmount, recordPayment, round2, today } from "./books.js";
import { tx } from "./db.js";
import { notify, usersWith } from "./collab.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pdcs (
  id INTEGER PRIMARY KEY, number TEXT NOT NULL UNIQUE, contact_id INTEGER NOT NULL REFERENCES contacts(id),
  amount REAL NOT NULL CHECK (amount > 0), cheque_no TEXT NOT NULL, bank_name TEXT, account_id INTEGER REFERENCES accounts(id),
  cheque_date TEXT NOT NULL, issued_date TEXT NOT NULL, notes TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','cleared','cancelled','bounced')),
  payment_id INTEGER REFERENCES payments(id), last_reminded TEXT, created_by INTEGER REFERENCES users(id), closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pdc_bills (
  pdc_id INTEGER NOT NULL REFERENCES pdcs(id) ON DELETE CASCADE, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, amount REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pdc_status ON pdcs(status, cheque_date);
CREATE INDEX IF NOT EXISTS idx_pdc_bills_doc ON pdc_bills(document_id);`;

export function setupPdc(db) {
  db.exec(SCHEMA);
  const next = getSetting(db, "nextNumbers"), prefixes = getSetting(db, "prefixes");
  if (prefixes && !prefixes.pdc) db.prepare("UPDATE settings SET value = ? WHERE key = 'prefixes'").run(JSON.stringify({ ...prefixes, pdc: "PDC-" }));
  if (next && !next.pdc) db.prepare("UPDATE settings SET value = ? WHERE key = 'nextNumbers'").run(JSON.stringify({ ...next, pdc: 1 }));
}

const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const karachiToday = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);

// how close it is: shown on every list so a due cheque stands out
export function pdcUrgency(p, on = karachiToday()) {
  if (p.status !== "issued") return { days_left: null, urgency: p.status };
  const left = days(on, p.cheque_date);
  return { days_left: left, urgency: left < 0 ? "overdue" : left <= 3 ? "soon" : left <= 7 ? "week" : "later" };
}

const withBills = (db, p) => ({
  ...p, ...pdcUrgency(p),
  bills: db.prepare("SELECT b.document_id, b.amount, d.number, d.total, d.reference FROM pdc_bills b JOIN documents d ON d.id = b.document_id WHERE b.pdc_id = ?").all(p.id),
});
const SELECT = "SELECT p.*, c.name AS contact_name, a.name AS account_name, pay.number AS payment_number FROM pdcs p JOIN contacts c ON c.id = p.contact_id LEFT JOIN accounts a ON a.id = p.account_id LEFT JOIN payments pay ON pay.id = p.payment_id";

export function listPdcs(db, { status = "", contact_id } = {}) {
  const w = [], args = [];
  if (status === "open") w.push("p.status = 'issued'");
  else if (status) { w.push("p.status = ?"); args.push(status); }
  if (contact_id) { w.push("p.contact_id = ?"); args.push(Number(contact_id)); }
  return db.prepare(`${SELECT} ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY p.status = 'issued' DESC, p.cheque_date, p.id`).all(...args).map((p) => withBills(db, p));
}
export function getPdc(db, id) {
  const p = db.prepare(`${SELECT} WHERE p.id = ?`).get(id);
  if (!p) throw httpError(404, "PDC not found");
  return withBills(db, p);
}
// open cheques given against a bill (shown on the bill, so it isn't paid again)
export const pdcsForDocument = (db, docId) => db.prepare("SELECT p.id, p.number, p.cheque_no, p.cheque_date, p.status, b.amount FROM pdc_bills b JOIN pdcs p ON p.id = b.pdc_id WHERE b.document_id = ? AND p.status = 'issued'").all(docId);

function clean(db, input, id = 0) {
  const contactId = Number(input.contact_id);
  const c = db.prepare("SELECT id, type FROM contacts WHERE id = ?").get(contactId);
  if (!c || c.type !== "supplier") throw httpError(400, "Pick the supplier");
  const amount = round2(Number(input.amount) || 0);
  if (!(amount > 0)) throw httpError(400, "Amount must be more than zero");
  const chequeNo = String(input.cheque_no || "").trim();
  if (!chequeNo) throw httpError(400, "Cheque number is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.cheque_date || "")) throw httpError(400, "Cheque date is required");
  const dup = db.prepare("SELECT number FROM pdcs WHERE cheque_no = ? AND IFNULL(account_id, 0) = IFNULL(?, 0) AND status != 'cancelled' AND id != ?").get(chequeNo, input.account_id ? Number(input.account_id) : null, id);
  if (dup) throw httpError(400, `Cheque ${chequeNo} is already recorded (${dup.number})`);
  let accountId = null, bankName = String(input.bank_name || "").trim() || null;
  if (input.account_id) {
    const a = db.prepare("SELECT id, name, kind, bank_name FROM accounts WHERE id = ?").get(Number(input.account_id));
    if (!a || a.kind !== "bank") throw httpError(400, "Pick the bank account the cheque is drawn on");
    accountId = a.id; bankName ||= a.bank_name || a.name;
  }
  const bills = (input.bills || []).filter((b) => Number(b.amount) > 0).map((b) => {
    const d = db.prepare("SELECT id, number, kind, contact_id, status, total FROM documents WHERE id = ?").get(Number(b.document_id));
    if (!d || d.kind !== "bill" || d.contact_id !== contactId || d.status !== "open") throw httpError(400, "Only this supplier's open bills can be covered");
    return { document_id: d.id, amount: round2(Number(b.amount)) };
  });
  if (round2(bills.reduce((s, b) => s + b.amount, 0)) > amount + 0.001) throw httpError(400, "The bills add up to more than the cheque");
  return { contactId, amount, chequeNo, accountId, bankName, bills, chequeDate: input.cheque_date, issuedDate: input.issued_date || today(), notes: String(input.notes || "").trim() || null };
}

export function savePdc(db, userId, input, id = null) {
  const x = clean(db, input, id || 0);
  return tx(db, () => {
    if (id) {
      const p = db.prepare("SELECT * FROM pdcs WHERE id = ?").get(id);
      if (!p) throw httpError(404, "PDC not found");
      if (p.status !== "issued") throw httpError(400, "Only a cheque still with the supplier can be changed");
      db.prepare("UPDATE pdcs SET contact_id=?, amount=?, cheque_no=?, bank_name=?, account_id=?, cheque_date=?, issued_date=?, notes=?, last_reminded = CASE WHEN cheque_date = ? THEN last_reminded END WHERE id=?")
        .run(x.contactId, x.amount, x.chequeNo, x.bankName, x.accountId, x.chequeDate, x.issuedDate, x.notes, x.chequeDate, id);
      db.prepare("DELETE FROM pdc_bills WHERE pdc_id = ?").run(id);
      log(db, userId, "changed PDC", "pdc", id, `${p.number} · cheque ${x.chequeNo} · Rs ${x.amount} · ${x.chequeDate}`);
    } else {
      const number = nextNumber(db, "pdc");
      id = Number(db.prepare("INSERT INTO pdcs (number, contact_id, amount, cheque_no, bank_name, account_id, cheque_date, issued_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(number, x.contactId, x.amount, x.chequeNo, x.bankName, x.accountId, x.chequeDate, x.issuedDate, x.notes, userId ?? null).lastInsertRowid);
      log(db, userId, "gave PDC", "pdc", id, `${number} · cheque ${x.chequeNo} · Rs ${x.amount} · dated ${x.chequeDate}`);
    }
    for (const b of x.bills) db.prepare("INSERT INTO pdc_bills (pdc_id, document_id, amount) VALUES (?, ?, ?)").run(id, b.document_id, b.amount);
    return id;
  });
}

// the cheque was cashed: a payment from its bank, applied to its bills (as far as they are still unpaid)
export function clearPdc(db, userId, id, { date } = {}) {
  const p = getPdc(db, id);
  if (p.status !== "issued") throw httpError(400, `This cheque is already ${p.status}`);
  return tx(db, () => {
    const allocations = p.bills.map((b) => ({ document_id: b.document_id, amount: round2(Math.max(0, Math.min(b.amount, b.total - paidAmount(db, b.document_id)))) })).filter((a) => a.amount > 0);
    const paymentId = recordPayment(db, userId, { direction: "out", contact_id: p.contact_id, amount: p.amount, date: date || p.cheque_date, mode: "cheque",
      reference: `Cheque ${p.cheque_no}${p.bank_name ? ` · ${p.bank_name}` : ""}`, notes: `${p.number} cleared`, account_id: p.account_id || undefined, allocations });
    db.prepare("UPDATE pdcs SET status = 'cleared', payment_id = ?, closed_at = datetime('now') WHERE id = ?").run(paymentId, id);
    log(db, userId, "PDC cleared", "pdc", id, `${p.number} · cheque ${p.cheque_no} · Rs ${p.amount}`);
    return paymentId;
  });
}

export function closePdc(db, userId, id, status, note) {
  if (!["cancelled", "bounced"].includes(status)) throw httpError(400, "Unknown status");
  const p = getPdc(db, id);
  if (p.status !== "issued") throw httpError(400, `This cheque is already ${p.status}`);
  db.prepare("UPDATE pdcs SET status = ?, closed_at = datetime('now'), notes = TRIM(IFNULL(notes, '') || ' ' || ?) WHERE id = ?").run(status, note ? `[${status}: ${note}]` : `[${status}]`, id);
  log(db, userId, status === "bounced" ? "PDC bounced" : "PDC cancelled", "pdc", id, `${p.number} · cheque ${p.cheque_no}${note ? ` · ${note}` : ""}`);
}

// reminders: 7, 5, 3, 1 days before the cheque date and on the day, then every day while it is past and not cleared
export function remindDue(db, on = karachiToday()) {
  const sent = [];
  for (const p of db.prepare(`${SELECT} WHERE p.status = 'issued'`).all()) {
    const left = days(on, p.cheque_date);
    const due = left < 0 || (left <= 7 && left % 2 === 1) || left === 0;
    if (!due || p.last_reminded === on) continue;
    const when = left < 0 ? `${-left} day${left === -1 ? "" : "s"} past its date: clear it or mark it bounced` : left === 0 ? "dated TODAY: keep the money in the bank" : `in ${left} day${left === 1 ? "" : "s"} (${p.cheque_date}): keep the money ready`;
    notify(db, [...usersWith(db, "money"), ...usersWith(db, "admin")], { kind: "pdc", title: `PDC cheque ${p.cheque_no} · Rs ${Math.round(p.amount).toLocaleString("en-PK")} to ${p.contact_name}`, body: `${p.number} ${when}`, link: `/pdcs?open=${p.id}` });
    db.prepare("UPDATE pdcs SET last_reminded = ? WHERE id = ?").run(on, p.id);
    sent.push(p.id);
  }
  return sent;
}
export function startPdcReminders(db, log = console) {
  const tick = () => { try { const n = remindDue(db).length; if (n) log.log(`PDC reminders: ${n}`); } catch (e) { log.error("PDC reminders failed:", e.message); } };
  setTimeout(tick, 30000);
  return setInterval(tick, 60 * 60000);
}

// receiving slip for the supplier to sign: who got which cheque, for which bills
const LOGO = join(import.meta.dirname, "logo.png");
const RED = "#C22A2F", INK = "#1D2433", MUTED = "#6B7587", LINE = "#E2E5EB";
const rs = (n) => `Rs ${Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
export function receivingPdf(db, id) {
  const p = getPdc(db, id);
  const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(p.contact_id);
  const co = getSetting(db, "company") || {};
  const pdf = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Cheque receiving ${p.number}`, Author: co.name } });
  const chunks = [];
  pdf.on("data", (b) => chunks.push(b));
  const done = new Promise((ok) => pdf.on("end", () => ok(Buffer.concat(chunks))));
  const L = 48, W = pdf.page.width - 96;
  if (existsSync(LOGO)) { pdf.image(LOGO, L, 44, { width: 150 }); pdf.y = 44 + 150 * (392 / 1000) + 2; }
  else pdf.fillColor(RED).font("Helvetica-Bold").fontSize(20).text(co.name || "Zidane Corporation", L, 48);
  pdf.fillColor(MUTED).font("Helvetica").fontSize(9).text([co.address, co.phone, co.email].filter(Boolean).join("\n"), L, pdf.y + 4, { width: W * 0.55 });
  const top = pdf.y;
  pdf.fillColor(RED).font("Helvetica-Bold").fontSize(17).text("CHEQUE RECEIVING", L, 48, { width: W, align: "right" });
  pdf.fillColor(INK).fontSize(11).text(p.number, { width: W, align: "right" });
  pdf.font("Helvetica").fontSize(9).fillColor(MUTED).text(`Date given: ${dt(p.issued_date)}`, { width: W, align: "right" });
  let y = Math.max(top, pdf.y) + 22;
  pdf.fillColor(MUTED).fontSize(8).text("RECEIVED BY (SUPPLIER)", L, y);
  pdf.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(c.name, L, pdf.y + 2);
  pdf.font("Helvetica").fontSize(9).fillColor(MUTED).text([c.company, c.address, c.phone].filter(Boolean).join("\n"));
  y = pdf.y + 18;
  // the cheque, in a box
  const rows = [["Cheque number", p.cheque_no], ["Bank", p.bank_name || "—"], ["Cheque date", dt(p.cheque_date)], ["Amount", rs(p.amount)]];
  pdf.rect(L, y, W, rows.length * 26 + 16).lineWidth(1).strokeColor(INK).stroke();
  let ry = y + 10;
  for (const [k, v] of rows) {
    pdf.font("Helvetica").fontSize(10).fillColor(MUTED).text(k, L + 14, ry + 4, { width: 150 });
    pdf.font("Helvetica-Bold").fontSize(k === "Amount" ? 14 : 12).fillColor(INK).text(v, L + 170, ry + (k === "Amount" ? 1 : 3), { width: W - 190 });
    ry += 26;
  }
  y = ry + 22;
  pdf.font("Helvetica").fontSize(10).fillColor(INK).text(`Post-dated cheque, to be presented on or after ${dt(p.cheque_date)}.`, L, y, { width: W });
  y = pdf.y + 14;
  if (p.bills.length) {
    pdf.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("AGAINST YOUR BILLS", L, y);
    y = pdf.y + 4;
    for (const b of p.bills) {
      pdf.moveTo(L, y).lineTo(L + W, y).strokeColor(LINE).lineWidth(0.5).stroke();
      pdf.font("Helvetica").fontSize(10).fillColor(INK).text(`${b.reference ? `Bill # ${b.reference}` : b.number}  (${b.number})`, L, y + 5, { width: W - 140 });
      pdf.text(rs(b.amount), L + W - 140, y + 5, { width: 140, align: "right" });
      y += 22;
    }
    pdf.moveTo(L, y).lineTo(L + W, y).strokeColor(LINE).lineWidth(0.5).stroke();
    y += 10;
  }
  if (p.notes) { pdf.font("Helvetica").fontSize(9).fillColor(MUTED).text(p.notes, L, y, { width: W }); y = pdf.y + 10; }
  // signatures
  y = Math.max(y + 40, pdf.page.height - 200);
  const half = (W - 40) / 2;
  for (const [i, label] of [[0, "Received by (name, signature, stamp)"], [1, `For ${co.name || "Zidane Corporation"}`]]) {
    const x = L + i * (half + 40);
    pdf.moveTo(x, y + 40).lineTo(x + half, y + 40).strokeColor(INK).lineWidth(0.8).stroke();
    pdf.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, x, y + 46, { width: half });
    if (i === 0) pdf.text("CNIC / Phone: ____________________   Date: ____________", x, y + 64, { width: half + 30 });
  }
  pdf.end();
  return done.then((buffer) => ({ buffer, filename: `Cheque-receiving-${p.number}-${String(c.name).replace(/[^\w]+/g, "-")}.pdf` }));
}
