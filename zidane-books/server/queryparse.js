// Reads a customer's RFQ / quotation request typed into the email itself (no PDF), without AI. Buyers paste a table
// out of their ERP: Requisition | Item code | Item Description | UOM | Quantity (columns vary, some have no header,
// the requisition is sometimes only on the first row). In the email's text every cell is its own line, and in all
// of them the item's name comes right before its unit, which comes right before the quantity. That is what we read.

const UNIT = /^(pcs?|pieces?|piece|nos?|numbers?|no|set|sets|packets?|pkts?|pk|packs?|box(es)?|kgs?|kilograms?|grams?|gms?|gm|ltrs?|litres?|liters?|ml|bottles?|dozens?|doz|dzn|pairs?|prs?|rolls?|meters?|metres?|mtrs?|mtr|m|ft|feet|sq\.? ?ft|sqft|rft|r\.ft|yards?|yds?|lbs?|pounds?|each|ea|cartons?|ctns?|bags?|cans?|reams?|gallons?|gals?|tins?|sheets?|units?|lots?|bundles?|bdls?|coils?|tubes?|jars?|sacks?|bunch|cylinders?|drums?|pouch(es)?|strips?|vials?|tablets?|jobs?|lengths?|blocks?|cases?|trays?)\.?$/i;
const NUMBER = /^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$/;
const CODE = /^\d{2,4}(-\d{2,}){2,}$/; // 510-00001878-00000-01-000-000
const HEADER = /^(s\.?\s?no\.?|sr\.?\s?#?|#|item|items|item code|code|requisition|req(uisition)?\.?\s?#?|pr\s?#?|item description|description|particulars|product|material|uom|unit|units|qty|quantity|qty\.|rate|price|amount|remarks?|operating unit|brand|specs?|specification)$/i;
const NOTE = /^(note|notes|importance|remarks?|brand|delivery|required by|deadline)\s*[:\-]/i;
const num = (s) => Number(String(s).replace(/,/g, ""));

// an email's HTML as lines: each table cell, paragraph and line break on its own line
export function htmlLines(html) {
  return String(html || "")
    .replace(/<(style|head|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/(td|th|p|div|tr|li|h\d)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .split("\n");
}

// a reply's / forward's earlier email starts here
const QUOTED = /^(from:\s|-----original message|on .{6,80} wrote:$|_{8,})/i;

// the email's lines: pictures ([cid:…]) dropped, cells that arrive on one line split by tabs, the footer cut off
function cleanLines(rawLines) {
  const out = [];
  for (const raw of rawLines) {
    for (const cell of String(raw).replace(/\[cid:[^\]]*\]/gi, " ").split(/\t+/)) {
      const t = cell.replace(/\s+/g, " ").trim();
      if (!t) continue;
      if (/^disclaimer\b/i.test(t)) return out;
      out.push(t);
    }
  }
  return out;
}

export function readQueryLines(rawLines) {
  const all = cleanLines(rawLines);
  // the newest part first (a reply above a quoted email); if it has no items (a forward, "please see below"), all of it
  const cut = all.findIndex((t, i) => i > 0 && QUOTED.test(t));
  const first = cut > 0 ? readItems(all.slice(0, cut)) : null;
  return first && first.items.length ? first : readItems(all);
}

function readItems(lines) {
  const items = [];
  const notes = [];
  const refs = new Set();
  let from = 0; // where the current item's cells start
  for (let i = 1; i < lines.length - 1; i++) {
    if (NOTE.test(lines[i]) && lines[i].length < 300) notes.push(lines[i].replace(/[\s.]+$/, ""));
    if (!UNIT.test(lines[i]) || !NUMBER.test(lines[i + 1])) continue;
    const desc = lines[i - 1];
    if (!/[a-z]/i.test(desc) || HEADER.test(desc) || UNIT.test(desc) || desc.length > 400) continue;
    const qty = num(lines[i + 1]);
    if (!(qty > 0)) continue;
    // cells before the name on this row: their requisition number and item code
    const before = lines.slice(Math.max(from, i - 4), i - 1).filter((c) => !HEADER.test(c));
    // a requisition cell that spans several rows is only on the first one; the rows under it share it
    const req = before.find((c) => /^\d{2,6}$/.test(c)) || items[items.length - 1]?.requisition;
    const code = before.find((c) => CODE.test(c));
    if (req) refs.add(req);
    items.push({ description: desc, qty, unit: lines[i], code: code || null, requisition: req || null });
    from = i + 2;
    i += 1;
  }
  if (!items.length) return { ...byHeader(lines), notes, refs: [...refs] };
  return { items, notes, refs: [...refs] };
}

// a table without a unit column (Description | Qty, S.No | Item | Qty …): read it row by row under its header
function byHeader(lines) {
  const start = lines.findIndex((t, i) => HEADER.test(t) && HEADER.test(lines[i + 1] || ""));
  if (start < 0) return { items: [] };
  let n = 0;
  while (HEADER.test(lines[start + n] || "")) n++;
  const head = lines.slice(start, start + n).map((h) => h.toLowerCase());
  const col = (re) => head.findIndex((h) => re.test(h));
  const q = col(/^(qty|quantity|qty\.)$/), d = col(/descr|particular|product|material|^items?$/), u = col(/^(uom|units?)$/);
  if (q < 0 || d < 0) return { items: [] };
  const items = [];
  for (let i = start + n; i + n <= lines.length; i += n) {
    const row = lines.slice(i, i + n);
    if (!NUMBER.test(row[q]) || !/[a-z]/i.test(row[d])) break;
    items.push({ description: row[d], qty: num(row[q]), unit: u >= 0 ? row[u] : null, code: null, requisition: null });
  }
  return { items };
}

const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|live|icloud|aol|proton(mail)?|ymail)\./i;
export const senderDomain = (from) => { const m = /@([\w.-]+\.\w+)/.exec(String(from || "")); return m && !FREE_MAIL.test("@" + m[1]) ? m[1].toLowerCase() : null; };
const companyFromDomain = (d) => d ? d.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
const displayName = (from) => (/^\s*"?([^"<@]+?)"?\s*</.exec(String(from || "")) || [])[1]?.trim() || null;

// RFQ / quotation request in the email body → an inbox draft (null if the email has no item list we can read)
export function parseQueryEmail({ subject = "", text = "", html = "", from = "" }) {
  let r = readQueryLines(String(text || "").split(/\r?\n/));
  if (r.items.length < 1 && html) r = readQueryLines(htmlLines(html));
  if (!r.items.length) return null;
  // PR numbers in the subject too ("RFQ Against PR # 496, 1481", "Quotation Required PR# 1510", "1450 RFQ")
  for (const m of String(subject).matchAll(/\b(\d{2,6})\b/g)) if (r.refs.length < 12 && !r.refs.includes(m[1])) r.refs.push(m[1]);
  const domain = senderDomain(from);
  const company = companyFromDomain(domain) || displayName(from);
  const dupes = r.items.length - new Set(r.items.map((l) => `${l.code || ""}|${l.description}|${l.qty}`)).size;
  const refText = r.refs.length ? `PR / requisition ${r.refs.join(", ")}` : null;
  // most are RFQs; a confirmed order typed into the email ("PO# 24099 …") keeps its PO number
  const po = /\b(?:p\.?\s?o\.?|purchase\s+order)\s*(?:no\.?|number|#)?\s*[:#-]?\s*(\d[\w-]*)/i.exec(subject);
  const rfq = !po || /\b(rfq|quot\w*|inquiry|enquiry|rates?)\b/i.test(`${subject}\n${String(text).slice(0, 600)}`);
  return {
    doc_type: "customer_order", request: rfq ? "rfq" : "order",
    summary: `${rfq ? "RFQ" : "PO " + po[1]}${r.refs.length ? " " + r.refs.slice(0, 3).join(", ") : ""} from ${company || "unknown"}: ${r.items.length} item${r.items.length > 1 ? "s" : ""} to quote`,
    party_name: company, party_match_id: null, sender_domain: domain, reference: rfq ? null : po[1], date: null, required_date: null, delivery_location: null, total: null,
    buyer_name: displayName(from), contact_phone: null,
    // notes go on the quote the customer sees; the PR numbers go in its reference, our own warnings stay in the inbox
    notes: r.notes.join(". ") || null,
    check: dupes ? `${dupes} line(s) appear twice in their list (${refText || "same PR"}). Check with the buyer before quoting.` : null,
    their_refs: r.refs,
    lines: r.items.map((l) => ({ description: l.description, qty: l.qty, unit: l.unit, rate: null, tax_rate: null, item_match_id: null, match_confidence: "none", their_code: l.code, requisition: l.requisition })),
    reader: "email-text",
  };
}

// "RE: RFQ …" with "REMINDER" on top is the same query again
export const plainSubject = (s) => String(s || "").replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").replace(/\s+/g, " ").trim().toLowerCase();
export const isReminder = (subject, text) => /^\s*((re|fw|fwd)\s*:\s*)+/i.test(subject || "") && /^\s*(gentle\s+)?reminder|^\s*any update|^\s*follow\s*-?up/i.test(String(text || "").trim());
