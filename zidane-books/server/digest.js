// Morning brief: one email every morning to the director with everything that is stuck, each as a plain question
// ("DC went 9 days ago, why no invoice?"), oldest first, with a link to open it. Nothing to say → a short "all clear".
import nodemailer from "nodemailer";
import { getSetting, PAID_SQL, round2, setSetting, today } from "./books.js";
import { jobList, netBought, OPS_STATUSES, procurementList } from "./jobs.js";
import { DOC_PATH } from "./collab.js";

const TZ = "Asia/Karachi";
const step = (s) => OPS_STATUSES.indexOf(s);
const rs = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString("en-PK")}`;
const days = (from, to = today()) => Math.max(0, Math.round((Date.parse(to) - Date.parse(String(from).slice(0, 10))) / 864e5));
const dd = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
const ago = (n) => (n === 0 ? "aaj" : n === 1 ? "1 din" : `${n} din`);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const base = () => (process.env.APP_URL || "https://books.zidane.com.pk").replace(/\/$/, "");
const karachiNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

// every section: an icon, a title, a one-line "what to do", and its rows (oldest / biggest first)
export function buildBrief(db) {
  const t = karachiNow().date;
  const docs = (sql, ...args) => db.prepare(`SELECT d.*, c.name AS contact_name, j.number AS job_number, j.customer_po_number AS job_po, ${PAID_SQL} AS paid
    FROM documents d JOIN contacts c ON c.id = d.contact_id LEFT JOIN jobs j ON j.id = d.job_id WHERE ${sql}`).all(...args).map((d) => ({ ...d, balance: round2(d.total - d.paid) }));
  const docLink = (d) => `/${DOC_PATH[d.kind]}/${d.id}`;
  const po = (x) => (x.job_po || x.customer_po_number ? ` · PO ${x.job_po || x.customer_po_number}` : "");
  const jobs = jobList(db, { scope: "active" });
  const jobName = (j) => `${j.number}${po(j)} · ${j.customer_name}`;
  const signDays = getSetting(db, "dcSignDays") || 3;
  const S = [];
  const add = (icon, title, todo, rows, tone = "amber") => { if (rows.length) S.push({ icon, title, todo, tone, rows }); };

  // 1. money stuck with customers
  const overdue = docs("d.kind = 'invoice' AND d.status = 'open' AND d.due_date < ?", t).filter((d) => d.balance > 0.5).sort((a, b) => a.due_date.localeCompare(b.due_date));
  add("💰", "Overdue invoices: paisa phansa hua hai", "Customer ko call karo, payment ki date lo.",
    overdue.map((d) => ({ text: `${d.number}${po(d)} · ${d.contact_name}`, ask: `${rs(d.balance)} · ${ago(days(d.due_date, t))} se overdue. Payment kab aayegi?`, link: docLink(d), days: days(d.due_date, t) })), "red");

  // 2. goods went out on a DC, no invoice for it yet
  const billedDcs = new Set(db.prepare("SELECT dc_numbers FROM documents WHERE kind = 'invoice' AND status != 'void' AND dc_numbers IS NOT NULL").all().flatMap((r) => r.dc_numbers.split(",").map((x) => x.trim())));
  const notInvoiced = [];
  for (const j of jobs.filter((x) => x.out_qty > x.invoiced_qty + 0.001)) {
    const dcs = db.prepare("SELECT id, number, date FROM documents WHERE job_id = ? AND kind = 'dc' AND status IN ('issued','signed') ORDER BY date").all(j.id).filter((d) => !billedDcs.has(d.number));
    const first = dcs[0] || db.prepare("SELECT id, number, date FROM documents WHERE job_id = ? AND kind = 'dc' AND status IN ('issued','signed') ORDER BY date DESC LIMIT 1").get(j.id);
    if (!first) continue;
    notInvoiced.push({ text: jobName(j), ask: `${(dcs.length ? dcs : [first]).map((d) => d.number).join(", ")} ko gaye ${ago(days(first.date, t))} ho gaye. Invoice kyun nahi bani?`, link: `/jobs/${j.id}`, days: days(first.date, t) });
  }
  add("🧾", "Maal chala gaya, invoice nahi bani", "Job kholo → Create invoice.", notInvoiced.sort((a, b) => b.days - a.days), "red");

  // 3. DC out, the customer's signed copy hasn't come back
  const unsigned = docs("d.kind = 'dc' AND d.status = 'issued' AND d.date <= date(?, ?)", t, `-${signDays} days`).sort((a, b) => a.date.localeCompare(b.date));
  add("✍️", "DC signed ho kar wapas nahi aayi", "Driver / customer se signed copy mangwao aur upload karo.",
    unsigned.map((d) => ({ text: `${d.number}${po(d)} · ${d.contact_name}`, ask: `${ago(days(d.date, t))} se bina sign. Signed copy kahan hai?`, link: docLink(d), days: days(d.date, t) })));

  // 4. bought / ready, nothing delivered
  const lastBill = (jobId) => db.prepare("SELECT MAX(d.date) AS d FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE COALESCE(l.job_id, d.job_id) = ? AND d.kind = 'bill' AND d.status = 'open'").get(jobId).d;
  const waiting = jobs.filter((j) => ["purchase_complete", "material_ready"].includes(j.ops_status) && j.out_qty < j.ordered_qty - 0.001 && !j.draft_dc_count)
    .map((j) => { const since = lastBill(j.id) || j.created_at; return { text: jobName(j), ask: `Maal ${ago(days(since, t))} se ready${j.out_qty > 0 ? ` (kuch ja chuka)` : ""}. DC kab jayegi?`, link: `/jobs/${j.id}`, days: days(since, t) }; });
  add("🚚", "Maal khareed liya, DC nahi gayi", "Delivery plan karo, DC banao.", waiting.sort((a, b) => b.days - a.days));

  // 5. a draft DC waiting to be issued
  const draftDc = docs("d.kind = 'dc' AND d.status = 'draft' AND d.date <= date(?, '-1 days')", t);
  add("📄", "Draft DC para hai", "Check karke Issue karo, warna delete.",
    draftDc.map((d) => ({ text: `${d.number}${po(d)} · ${d.contact_name}`, ask: `${ago(days(d.date, t))} se draft. Maal gaya ya nahi?`, link: docLink(d), days: days(d.date, t) })));

  // 6. marked bought (or delivered) with no supplier bill behind it
  const noBill = [];
  for (const j of jobs.filter((x) => step(x.ops_status) >= step("partially_purchased"))) {
    const net = netBought(db, j.id);
    const items = db.prepare("SELECT ji.*, COALESCE(i.name, ji.description) AS name, i.unit FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE ji.job_id = ? AND ji.procurement_status IN ('bought','partial')").all(j.id)
      .filter((ji) => net(ji).qty < ji.qty - 0.001 && ji.procurement_status === "bought");
    if (!items.length) continue;
    const gone = j.out_qty > 0 ? "Maal deliver bhi ho gaya. " : "";
    noBill.push({ text: jobName(j), ask: `${gone}${items.slice(0, 4).map((i) => i.name).join(", ")}${items.length > 4 ? ` +${items.length - 4}` : ""}: "bought" hai par supplier bill nahi. Bill kahan hai?`, link: `/jobs/${j.id}`, days: days(j.created_at, t) });
  }
  add("❓", "Khareeda hua dikh raha hai, supplier bill nahi", "Supplier se bill lo aur Books mein daalo, warna profit galat dikhega.", noBill.sort((a, b) => b.days - a.days));

  // 7. late Jobs
  const late = jobs.filter((j) => j.required_date && j.required_date < t && step(j.ops_status) < step("dispatched")).sort((a, b) => a.required_date.localeCompare(b.required_date))
    .map((j) => ({ text: jobName(j), ask: `${ago(days(j.required_date, t))} late. ${j.ops_status === "new" ? "Purchasing abhi tak shuru nahi hui. Foran start karo!" : `Abhi "${j.ops_status.replace(/_/g, " ")}" par hai.`}`, link: `/jobs/${j.id}`, days: days(j.required_date, t) }));
  add("⏰", "Job overdue: customer ki date guzar gayi", "Aaj hi customer ko update do aur kaam tez karo.", late, "red");

  // 8. new Jobs nobody started
  const fresh = jobs.filter((j) => j.ops_status === "new" && !(j.required_date && j.required_date < t) && days(j.created_at, t) >= 2)
    .map((j) => ({ text: jobName(j), ask: `${ago(days(j.created_at, t))} se "New". Procurement kab shuru hogi?`, link: `/jobs/${j.id}`, days: days(j.created_at, t) }));
  add("🆕", "Job bani, kaam shuru nahi hua", "Operations: Start procurement.", fresh.sort((a, b) => b.days - a.days));

  // 9. still to buy, and not on any PO yet
  const plist = procurementList(db);
  const toOrder = plist.filter((g) => g.not_ordered_qty > 0).map((g) => ({ text: `${g.name} · ${g.not_ordered_qty} ${g.unit}`, ask: `${g.jobs.length} Job${g.jobs.length > 1 ? "s" : ""}${g.earliest ? ` · chahiye ${dd(g.earliest)}` : ""}. Abhi PO bhi nahi bana.`, link: "/procurement", days: g.earliest ? days(g.earliest, t) : 0 }));
  add("🛒", "Khareedna baqi hai (PO bhi nahi bana)", "What to buy → Not on PO yet.", toOrder);

  // 10. PO sent, goods / bill not in
  const openPo = docs("d.kind = 'po' AND d.status = 'issued' AND d.date <= date(?, '-3 days')", t).sort((a, b) => a.date.localeCompare(b.date));
  add("📦", "PO diya, maal / bill nahi aaya", "Supplier se pucho, maal kab aayega.",
    openPo.map((d) => ({ text: `${d.number} · ${d.contact_name}`, ask: `${ago(days(d.date, t))} se PO open. Maal aaya? Bill kahan hai?`, link: docLink(d), days: days(d.date, t) })));

  // 11. what we owe suppliers
  const pay = docs("d.kind = 'bill' AND d.status = 'open' AND d.due_date <= date(?, '+3 days')", t).filter((d) => d.balance > 0.5).sort((a, b) => a.due_date.localeCompare(b.due_date));
  add("💸", "Supplier ko payment karni hai", "Overdue pehle, phir 3 din wali.",
    pay.map((d) => ({ text: `${d.number} · ${d.contact_name}`, ask: `${rs(d.balance)} · ${d.due_date < t ? `${ago(days(d.due_date, t))} se overdue` : `due ${dd(d.due_date)}`}`, link: docLink(d), days: d.due_date < t ? days(d.due_date, t) : 0 })), "blue");

  // 12. quotes sent, no answer
  const quotes = docs("d.kind = 'quote' AND d.status = 'sent' AND d.date <= date(?, '-5 days')", t).sort((a, b) => a.date.localeCompare(b.date));
  add("📨", "Quotation bheji, jawab nahi aaya", "Follow-up call karo.",
    quotes.map((d) => ({ text: `${d.number} · ${d.contact_name}`, ask: `${rs(d.total)} · ${ago(days(d.date, t))} se pending. Order mila?`, link: docLink(d), days: days(d.date, t) })), "blue");

  // 13. waiting on the director
  const approvals = db.prepare("SELECT r.*, u.name AS who FROM delete_requests r LEFT JOIN users u ON u.id = r.requested_by WHERE r.status = 'pending' ORDER BY r.id").all();
  add("✅", "Aap ki approval chahiye", "Approvals & activity kholo.",
    approvals.map((r) => ({ text: `Delete: ${r.title}`, ask: `${r.who} · reason: ${r.reason}`, link: "/activity", days: days(r.created_at, t) })), "red");
  const inbox = db.prepare("SELECT id, subject, from_addr, received_at, status, extraction FROM inbox_messages WHERE status IN ('ready','error') AND doc_type = 'customer_order' AND received_at <= datetime('now', '-12 hours') ORDER BY received_at").all();
  add("📥", "Orders Inbox: customer ki query pari hai", "Quote ya Job banao.",
    inbox.map((m) => ({ text: m.subject || m.from_addr || "Email", ask: `${ago(days(m.received_at, t))} se pari hai. Quote bheja?`, link: `/inbox?open=${m.id}`, days: days(m.received_at, t) })));

  // 14. stock running out
  const low = db.prepare("SELECT id, name, unit, stock_qty, reorder_level FROM items WHERE active = 1 AND track_stock = 1 AND reorder_level > 0 AND stock_qty <= reorder_level ORDER BY name").all();
  add("📉", "Stock khatam hone wala hai", "Reorder karo.", low.map((i) => ({ text: i.name, ask: `${i.stock_qty} ${i.unit} bacha (reorder at ${i.reorder_level})`, link: `/items/${i.id}`, days: 0 })), "blue");

  // yesterday, in four numbers; and what's owed overall
  const y = new Date(Date.parse(t) - 864e5).toISOString().slice(0, 10);
  const v = (sql, ...a) => round2(db.prepare(sql).get(...a).v);
  const yesterday = {
    date: y,
    invoiced: v("SELECT COALESCE(SUM(total), 0) AS v FROM documents WHERE kind = 'invoice' AND status = 'open' AND date = ?", y),
    received: v("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE direction = 'in' AND date = ?", y),
    paid: v("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE direction = 'out' AND date = ?", y),
    jobs: v("SELECT COUNT(*) AS v FROM jobs WHERE date(created_at) = ?", y),
  };
  const owedToUs = round2(docs("d.kind = 'invoice' AND d.status = 'open'").reduce((s, d) => s + Math.max(0, d.balance), 0));
  const overdueTotal = round2(overdue.reduce((s, d) => s + d.balance, 0));
  return { date: t, sections: S, yesterday, owedToUs, overdueTotal, count: S.reduce((n, s) => n + s.rows.length, 0) };
}

const TONE = { red: "#B42318", amber: "#B45309", blue: "#1D4ED8" };
export function briefHtml(b, { company = "Zidane Corporation" } = {}) {
  const url = base();
  const pretty = new Date(`${b.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const stat = (label, value) => `<td style="padding:10px 12px;background:#F6F7F9;border-radius:8px"><div style="font-size:12px;color:#6B7587">${label}</div><div style="font-size:17px;font-weight:700;color:#1D2433">${value}</div></td>`;
  const sections = b.sections.map((s) => `
    <tr><td style="padding:22px 0 6px"><div style="font-size:17px;font-weight:800;color:${TONE[s.tone]}">${s.icon} ${esc(s.title)} <span style="font-weight:600;color:#6B7587">(${s.rows.length})</span></div>
      <div style="font-size:13px;color:#6B7587;margin-top:2px">${esc(s.todo)}</div></td></tr>
    ${s.rows.slice(0, 15).map((r) => `<tr><td style="padding:9px 12px;border-left:3px solid ${TONE[s.tone]};background:#FAFAFB">
      <a href="${url}${r.link}" style="color:#1D2433;font-weight:700;text-decoration:none;font-size:14px">${esc(r.text)}</a>
      <div style="font-size:14px;color:#374151;margin-top:2px">${esc(r.ask)}</div></td></tr><tr><td style="height:6px"></td></tr>`).join("")}
    ${s.rows.length > 15 ? `<tr><td style="font-size:13px;color:#6B7587">…aur ${s.rows.length - 15} — <a href="${url}">Books mein dekho</a></td></tr>` : ""}`).join("");
  return `<!doctype html><html><body style="margin:0;background:#EEF0F3;font-family:Segoe UI,Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:14px;padding:26px">
    <tr><td><div style="font-size:13px;color:#C22A2F;font-weight:800;letter-spacing:.08em">${esc(company.toUpperCase())} · MORNING BRIEF</div>
      <div style="font-size:24px;font-weight:800;color:#1D2433;margin-top:4px">Assalam o Alaikum! ${b.count ? `Aaj ${b.count} cheezein aap ka intezar kar rahi hain.` : "Sab clear hai ✓"}</div>
      <div style="font-size:14px;color:#6B7587;margin-top:4px">${pretty}</div></td></tr>
    <tr><td style="padding-top:16px"><table role="presentation" width="100%" cellspacing="6" cellpadding="0"><tr>
      ${stat("Kal invoices", rs(b.yesterday.invoiced))}${stat("Kal payment aayi", rs(b.yesterday.received))}${stat("Kal payment di", rs(b.yesterday.paid))}${stat("Kal nayi Jobs", b.yesterday.jobs)}
    </tr><tr>${stat("Customers par kul baqi", rs(b.owedToUs))}${stat("Is mein overdue", `<span style="color:#B42318">${rs(b.overdueTotal)}</span>`)}<td></td><td></td></tr></table></td></tr>
    ${sections || `<tr><td style="padding:24px 0;font-size:16px;color:#15803D;font-weight:700">Koi invoice overdue nahi, koi DC bina invoice nahi, koi Job late nahi. Shabash! ✓</td></tr>`}
    <tr><td style="padding-top:26px;font-size:12px;color:#9AA1AE">Har line par click karo, Books mein wahi cheez khul jayegi. Yeh email har subah khud aati hai (Settings → Morning brief).</td></tr>
  </table></td></tr></table></body></html>`;
}

export function briefText(b) {
  const lines = [`MORNING BRIEF · ${b.date}`, b.count ? `${b.count} cheezein pending` : "Sab clear ✓", "", `Kal: invoices ${rs(b.yesterday.invoiced)} · payment aayi ${rs(b.yesterday.received)} · payment di ${rs(b.yesterday.paid)} · nayi Jobs ${b.yesterday.jobs}`, `Customers par baqi ${rs(b.owedToUs)} (overdue ${rs(b.overdueTotal)})`];
  for (const s of b.sections) { lines.push("", `${s.icon} ${s.title} (${s.rows.length})`); for (const r of s.rows.slice(0, 15)) lines.push(`- ${r.text}: ${r.ask}`); }
  return lines.join("\n");
}

// sending: the company mailbox (SMTP) like document emails; tests swap in a fake
let fake = null;
export const useBriefTransport = (fn) => { fake = fn; };
const recipients = (db) => {
  const set = getSetting(db, "morningBrief") || {};
  const typed = String(set.to || "").split(/[,;\s]+/).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  return typed.length ? typed : db.prepare("SELECT email FROM users WHERE role = 'director' AND active = 1").all().map((u) => u.email);
};
export async function sendBrief(db, { to } = {}) {
  if (!fake && !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)) throw Object.assign(new Error("Email is not set up yet: add the SMTP settings on the server"), { status: 503 });
  const b = buildBrief(db);
  const co = getSetting(db, "company") || {};
  const addr = to ? [to] : recipients(db);
  if (!addr.length) throw Object.assign(new Error("No email to send to. Add one in Settings → Morning brief."), { status: 400 });
  const mail = {
    from: process.env.MAIL_FROM || `${co.name || "Zidane Books"} <${process.env.SMTP_USER}>`, to: addr.join(", "),
    subject: `☀️ Morning brief · ${b.count ? `${b.count} pending${b.overdueTotal ? ` · ${rs(b.overdueTotal)} overdue` : ""}` : "sab clear"} · ${b.date}`,
    html: briefHtml(b, { company: co.name }), text: briefText(b),
  };
  if (fake) await fake(mail);
  else await nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 465, secure: (Number(process.env.SMTP_PORT) || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }).sendMail(mail);
  return { to: mail.to, subject: mail.subject, count: b.count };
}

// every few minutes: once it's past the set time in Karachi and today's brief hasn't gone, send it
export function startMorningBrief(db, log = console) {
  const tick = async () => {
    const set = getSetting(db, "morningBrief") || {};
    if (set.enabled === false) return;
    const now = karachiNow();
    if (now.time < (set.time || "08:00") || getSetting(db, "morningBriefLast") === now.date) return;
    setSetting(db, "morningBriefLast", now.date); // once a day, even if sending fails (the error is logged)
    try { const r = await sendBrief(db); log.log(`Morning brief sent to ${r.to} (${r.count} items)`); } catch (e) { log.error("Morning brief failed:", e.message); }
  };
  setTimeout(tick, 20000);
  return setInterval(tick, 5 * 60000);
}
