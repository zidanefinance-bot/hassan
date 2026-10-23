// Sending email (documents as PDF attachments) through the company's own mailbox (SMTP).
// Settings come from the server environment: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM.
import nodemailer from "nodemailer";
import { getSetting, httpError } from "./books.js";
import { documentPdf } from "./pdf.js";

// tests swap in a fake transport that captures mail instead of sending it
let fake = null;
export const useTransport = (fn) => { fake = fn; };
export const mailReady = () => Boolean(fake || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD));
let transport;
const smtp = () => (transport ||= nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 465, secure: (Number(process.env.SMTP_PORT) || 465) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
}));

const LABEL = { invoice: "Invoice", dc: "Delivery Challan", quote: "Quotation", po: "Purchase Order", credit_note: "Credit Note" };

// email one or more documents of the same contact
export async function emailDocuments(db, userId, docIds, { to, cc, message } = {}) {
  const send = fake;
  if (!send && !mailReady()) throw httpError(503, "Email is not set up yet: add the SMTP settings on the server");
  const docs = docIds.map((id) => db.prepare("SELECT d.*, c.name AS contact_name, c.email AS contact_email FROM documents d JOIN contacts c ON c.id = d.contact_id WHERE d.id = ?").get(id)).filter(Boolean);
  if (!docs.length) throw httpError(404, "Nothing to send");
  if (new Set(docs.map((d) => d.contact_id)).size > 1) throw httpError(400, "Send documents for one customer or supplier at a time");
  if (docs.some((d) => d.status === "draft" || d.status === "void")) throw httpError(400, "Issue the documents before emailing them");
  const toAddr = String(to || docs[0].contact_email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+(\s*,\s*[^@\s]+@[^@\s]+\.[^@\s]+)*$/.test(toAddr)) throw httpError(400, `No valid email for ${docs[0].contact_name}. Add it on the contact or type one.`);
  const co = getSetting(db, "company") || {};
  const names = docs.map((d) => `${LABEL[d.kind] || d.kind} ${d.number}`).join(" and ");
  const subject = `${names} from ${co.name || "Zidane Corporation"}`;
  const inv = docs.find((d) => d.kind === "invoice");
  const text = [`Dear ${docs[0].contact_name},`, "", message || `Please find attached ${names}.${inv ? ` Amount due: Rs ${inv.total.toLocaleString("en-PK")}${inv.due_date ? `, by ${inv.due_date}` : ""}.` : ""}`,
    "", "Regards,", co.name || "Zidane Corporation", co.phone || "", co.website || ""].join("\n");
  const attachments = [];
  for (const d of docs) { const p = await documentPdf(db, d.id); attachments.push({ filename: p.filename, content: p.buffer, contentType: "application/pdf" }); }
  const mail = { from: process.env.MAIL_FROM || `${co.name || "Zidane Books"} <${process.env.SMTP_USER}>`, to: toAddr, cc: cc || undefined, subject, text, attachments };
  try {
    await (send ? send(mail) : smtp().sendMail(mail));
    db.prepare("INSERT INTO email_log (to_addr, subject, document_ids, status, sent_by) VALUES (?, ?, ?, 'sent', ?)").run(toAddr, subject, docIds.join(","), userId);
    for (const d of docs) {
      db.prepare("INSERT INTO activity (user_id, action, entity, entity_id, summary) VALUES (?, 'emailed', ?, ?, ?)").run(userId, d.kind, d.id, `${d.number} to ${toAddr}`);
      if (d.kind === "invoice" && !d.submitted_date) db.prepare("UPDATE documents SET submitted_date = date('now') WHERE id = ?").run(d.id);
    }
    return { to: toAddr, subject, count: docs.length };
  } catch (e) {
    db.prepare("INSERT INTO email_log (to_addr, subject, document_ids, status, error, sent_by) VALUES (?, ?, ?, 'failed', ?, ?)").run(toAddr, subject, docIds.join(","), String(e.message).slice(0, 300), userId);
    throw httpError(502, `Email could not be sent: ${e.message}`);
  }
}
