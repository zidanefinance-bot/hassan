// Reads computer-made PDFs (a customer's ERP purchase order, a supplier's printed invoice) without AI: free, instant
// and exact. It finds the item table from its header row (Qty / Rate / Amount …), reads each line, and checks that
// qty × rate = amount. Scanned papers and photos have no text layer; those still go to AI (if it is set up).
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const num = (s) => { const t = String(s ?? "").replace(/,/g, "").replace(/[^\d.\-]/g, ""); if (!/\d/.test(t)) return null; const v = Number(t); return Number.isFinite(v) ? v : null; };
const isNum = (s) => /^-?[\d,]+(\.\d+)?$/.test(String(s).trim());
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
export function parseDate(s) {
  const t = String(s || "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[-/ .]([A-Za-z]{3,4})[-/ .,]*(\d{2,4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/); // Pakistan: day/month/year
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

// text pieces of every page, grouped into visual rows (top to bottom), each row's cells left to right
export async function pdfRows(buffer) {
  const pdf = await getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false }).promise;
  const rows = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 10); p++) {
    const page = await pdf.getPage(p);
    const items = (await page.getTextContent()).items.filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, s: i.str.trim() })).sort((a, b) => b.y - a.y || a.x - b.x);
    const pageRows = [];
    for (const it of items) {
      const row = pageRows.find((r) => Math.abs(r.y - it.y) <= 3);
      if (row) row.cells.push(it); else pageRows.push({ y: it.y, page: p, cells: [it] });
    }
    for (const r of pageRows) r.cells.sort((a, b) => a.x - b.x);
    rows.push(...pageRows);
  }
  return rows;
}

const COLS = [
  ["sno", /^(s\.?\s*#|s\.?\s*no\.?|sr\.?\s*(no\.?|#)?|#|line(\s*no\.?)?)$/i],
  ["code", /(item\s*code|product\s*code|^code$|sku|part\s*(no|#))/i],
  ["name", /(item\s*name|description|^item$|product|particulars|material)/i],
  ["note", /(narration|remarks?|specification|spec|brand|make)/i],
  ["qty", /^(qty|quantity|qnty|order\s*qty)/i],
  ["unit", /^(uom|unit|u\/m|pack)$/i],
  ["rate", /^(rate|price|unit\s*price|u\.?\s*price)/i],
  ["amount", /^(amount|total|value|net\s*amount|line\s*total)/i],
  ["tax", /^(tax|gst|s\.?\s*tax|sales\s*tax)\s*(%|rate)/i],
];

// Headings are often printed on 2-4 lines ("Amount / Excluding / Tax"): the rows of a heading band are joined
// column by column (pieces stacked at about the same x), and every column is kept, also ones we don't use
// (Location, Cost Center …), so their numbers and words don't end up in ours.
function headerBand(rows, i) {
  let a = i, b = i;
  while (a > 0 && rows[a - 1].y - rows[a].y <= 6) a--;
  while (b < rows.length - 1 && rows[b].y - rows[b + 1].y <= 6) b++;
  const cells = rows.slice(a, b + 1).flatMap((r) => r.cells.map((c) => ({ ...c, y: r.y }))).sort((p, q) => p.x - q.x);
  const groups = [];
  for (const c of cells) {
    const g = groups.find((x) => Math.abs(x.x0 - c.x) <= 12);
    if (g) g.cells.push(c); else groups.push({ x0: c.x, cells: [c] });
  }
  const cols = groups.map((g) => {
    const title = g.cells.sort((p, q) => q.y - p.y || p.x - q.x).map((c) => c.s).join(" ").replace(/\s+/g, " ").trim();
    // x: where the heading starts (left), cx: its middle; numbers are matched by middles (they're often right-aligned)
    return { title, x: Math.min(...g.cells.map((c) => c.x)), cx: g.cells.reduce((t, c) => t + c.x + (c.w || 0) / 2, 0) / g.cells.length };
  });
  const used = new Set();
  for (const c of cols) {
    const hit = COLS.find(([key, re]) => !used.has(key) && re.test(c.title));
    c.key = hit ? hit[0] : "other";
    if (hit) used.add(hit[0]);
  }
  return { end: b, cols: cols.sort((p, q) => p.x - q.x) };
}

export function findHeader(rows) {
  for (let i = 0; i < rows.length; i++) {
    const keys = new Set();
    for (const c of rows[i].cells) { const hit = COLS.find(([, re]) => re.test(c.s)); if (hit) keys.add(hit[0]); }
    if (keys.has("qty") && (keys.has("rate") || keys.has("amount")) && (keys.has("name") || keys.has("code"))) {
      const band = headerBand(rows, i);
      if (band.cols.some((c) => c.key === "qty")) return { index: band.end, cols: band.cols };
    }
  }
  return null;
}

// Numbers on the right (qty, rate, amount, tax …) sit close to their headings, so they go to the nearest column.
// Text on the left is often centred under its heading, so it is sorted by what it looks like instead:
// a small number first is the line number, a long code with digits is their item code, the rest is the name,
// and text far to the right of the name (under "Narration"/"Remarks") is a note. Text right under a column we
// don't use (Location, Requester …) or the unit column goes there.
const looksLikeCode = (s) => /^[A-Z0-9][A-Z0-9\-\/.]{4,}$/i.test(s) && /\d{3,}/.test(s) && !/\s/.test(s);
const longCode = (s) => /^[A-Z0-9][A-Z0-9\-\/.]{7,}$/i.test(s) && (s.match(/\d/g) || []).length >= 6;
const nearest = (list, x, k = "x") => list.reduce((best, c) => (Math.abs(c[k] - x) < Math.abs(best[k] - x) ? c : best), list[0]);
function splitRow(cols, cells) {
  const rec = {};
  const firstNumX = Math.min(...cols.filter((c) => ["qty", "rate", "amount"].includes(c.key)).map((c) => c.x));
  const right = cols.filter((c) => c.x >= firstNumX - 40);
  const note = cols.find((c) => c.key === "note");
  const hasCode = cols.some((c) => c.key === "code");
  const add = (k, v) => { if (k !== "other") rec[k] = rec[k] ? `${rec[k]} ${v}` : v; };
  cells.forEach((cell, i) => {
    if (cell.x >= firstNumX - 20) {
      // "100.00 PC" is one piece: place it by its number part, which sits under the Qty heading
      const lead = cell.s.match(/^[\d,.]+(?=\s+\S)/)?.[0];
      const w = (cell.w || 0) * (lead ? lead.length / cell.s.length : 1);
      return add(nearest(right, cell.x + w / 2, "cx").key, cell.s);
    }
    const near = nearest(cols, cell.x);
    if (["unit", "other", "tax"].includes(near.key) && Math.abs(near.x - cell.x) <= 25) return add(near.key, cell.s);
    if (i === 0 && /^\d{1,3}\.?$/.test(cell.s)) return add("sno", cell.s);
    if (!rec.code && !rec.name && looksLikeCode(cell.s) && hasCode) return add("code", cell.s);
    if (longCode(cell.s)) return add("code", cell.s); // their own item number, printed with the name
    if (note && rec.name && cell.x >= note.x - 40) return add("note", cell.s);
    add("name", cell.s);
  });
  return rec;
}

export function tableFromRows(rows) {
  const head = findHeader(rows);
  if (!head) return null;
  const items = [], texts = [], sections = [];
  for (const r of rows.slice(head.index + 1)) {
    const text = r.cells.map((c) => c.s).join(" ");
    if (/^(grand\s*)?(sub\s*)?total\b/i.test(r.cells[0].s) || /^total\s*amount/i.test(text)) break;
    const rec = splitRow(head.cols, r.cells);
    // "15.00 PC" in the qty column: number plus unit
    if (rec.qty && !isNum(rec.qty)) { const m = rec.qty.match(/^([\d,]+(?:\.\d+)?)\s+(.+)$/); if (m) { rec.qty = m[1]; rec.unit ||= m[2]; } }
    // a group's total ("Mechanical Items Total"): skip it, and its heading row above
    if (/\btotal\b/i.test(text) && !rec.sno) { sections.push(text.replace(/\s*\btotal\b.*$/i, "").trim().toLowerCase()); continue; }
    const hasNumbers = num(rec.qty) !== null && (num(rec.rate) !== null || num(rec.amount) !== null);
    if (hasNumbers) items.push({ y: r.y, rec, parts: [{ y: r.y, name: rec.name, note: rec.note }] });
    else if (rec.name || rec.note) texts.push({ y: r.y, name: rec.name, note: rec.note, tax: rec.tax, unit: rec.unit });
    else if (items.length && !texts.length && !rec.tax) break;
  }
  if (!items.length) return null;
  // words printed above or below an item's numbers (wrapped names) belong to the closest item
  for (const t of texts) {
    if (sections.includes([t.name, t.note].filter(Boolean).join(" ").toLowerCase())) continue;
    const it = items.reduce((best, x) => (Math.abs(x.y - t.y) < Math.abs(best.y - t.y) ? x : best), items[0]);
    if (Math.abs(it.y - t.y) > 16) continue;
    it.parts.push(t);
    if (t.tax && !it.rec.tax) it.rec.tax = t.tax;
    if (t.unit && !it.rec.unit) it.rec.unit = t.unit;
  }
  const lines = [];
  for (const { rec, parts } of items) {
    parts.sort((a, b) => b.y - a.y);
    const name = parts.map((p) => p.name).filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || rec.code || "";
    const note = parts.map((p) => p.note).filter(Boolean).join(" ").trim();
    if (!name) continue;
    const qty = num(rec.qty), rate = num(rec.rate), amount = num(rec.amount);
    lines.push({
      code: rec.code?.trim() || null,
      description: name,
      note: note || null,
      qty, unit: rec.unit?.trim() || null,
      rate: rate ?? (amount !== null && qty ? Math.round((amount / qty) * 100) / 100 : null),
      amount,
      tax_rate: rec.tax ? num(rec.tax) : null,
      checks: rate !== null && amount !== null ? Math.abs(qty * rate - amount) <= Math.max(1, amount * 0.001) : true,
    });
  }
  return lines.length ? lines : null;
}

const BARE = /^(payment\s*terms|terms\s*of\s*payment|credit\s*terms|buyer|ship\s*to|deliver\s*to|delivery\s*address)$/i;
// "Label : value" pairs anywhere on the page (value is the cell after the colon)
function fields(rows) {
  const out = {};
  for (const r of rows) {
    const cells = r.cells.map((c) => c.s);
    for (let i = 0; i < cells.length; i++) {
      let label = cells[i], value = null;
      if (cells[i + 1] === ":") { if (cells[i + 2] !== undefined && cells[i + 2] !== ":" && cells[i + 3] !== ":") value = cells[i + 2]; else continue; } // "C. Person : Contact # :" is two empty fields
      else if (/:\s*\S/.test(label)) [label, value] = [label.split(":")[0], label.split(":").slice(1).join(":")];
      // (the next cell is the value unless it is itself a label, like "Buyer:  Print By: X" when Buyer is blank)
      else if (/:$/.test(label) && cells[i + 1] && !/^[A-Za-z][A-Za-z .#\/]*:/.test(cells[i + 1])) [label, value] = [label.slice(0, -1), cells[i + 1]];
      // a few labels are often printed without a colon: "Payment Terms   30 DAYS CREDIT"
      else if (BARE.test(label) && cells[i + 1] && !cells[i + 1].endsWith(":") && !BARE.test(cells[i + 1])) value = cells[i + 1];
      if (value === null) continue;
      out[label.replace(/\s+/g, " ").trim().toLowerCase()] = String(value).trim();
    }
  }
  return out;
}
// signature blocks: "Prepared By" with the name printed on the row below it
function signedBy(rows, re) {
  const i = rows.findIndex((r) => r.cells.some((c) => re.test(c.s)));
  if (i < 0) return null;
  const head = rows[i].cells.find((c) => re.test(c.s));
  for (const r of rows.slice(i + 1, i + 3)) {
    const c = r.cells.filter((c) => !/:/.test(c.s) && /[a-z]{3}/i.test(c.s)).sort((a, b) => Math.abs(a.x - head.x) - Math.abs(b.x - head.x))[0];
    if (c && Math.abs(c.x - head.x) < 80) return c.s;
  }
  return null;
}
// a labelled value that wraps onto the next line(s), right under where it started ("Description: CS # 13531 …")
function wrapped(rows, re) {
  const i = rows.findIndex((r) => r.cells.some((c, k) => re.test(c.s.replace(/:$/, "")) && r.cells[k + 1]));
  if (i < 0) return null;
  const k = rows[i].cells.findIndex((c) => re.test(c.s.replace(/:$/, "")));
  const v = rows[i].cells[k + 1];
  const out = [v.s];
  const labelX = rows[i].cells[k].x;
  let y = rows[i].y;
  for (const r of rows.slice(i + 1, i + 4)) {
    if (r.page !== rows[i].page || y - r.y > 15) break;
    const c = r.cells.find((x) => Math.abs(x.x - v.x) <= 4) || (r.cells.length === 1 && Math.abs(r.cells[0].x - labelX) <= 4 ? r.cells[0] : null);
    if (!c || /:\s*$/.test(c.s) || r.cells.some((x) => x !== c && x.x > v.x - 90 && x.x < v.x - 4)) break; // the next label isn't part of the value
    out.push(c.s);
    y = r.y;
  }
  return out.join(" ");
}

// a "SHIP TO" block (its own column of Name: / Address: lines) is where the goods go
function shipTo(rows) {
  const re = /^(ship|deliver)\s*(to|at):?$/i;
  const i = rows.findIndex((r) => r.cells.some((c) => re.test(c.s)));
  if (i < 0) return null;
  const head = rows[i].cells.find((c) => re.test(c.s));
  const x0 = head.x - 5;
  const out = [rows[i].cells.filter((c) => c.x > head.x).map((c) => c.s).join(" ")];
  for (const r of rows.slice(i + 1, i + 6)) {
    if (r.page !== rows[i].page) break;
    const cells = r.cells.filter((c) => c.x >= x0);
    if (!cells.length) continue;
    const label = cells[0].s.replace(/:$/, "").toLowerCase();
    if (/phone|fax|email|payment|description|terms|invoice\s*to|bill\s*to/.test(label)) break;
    if (/^(name|address|location|site|store)$/.test(label)) out.push(cells.slice(1).map((c) => c.s).join(" "));
    else if (!cells[0].s.endsWith(":")) out.push(cells.map((c) => c.s).join(" ")); // a plain address block under "Deliver At:"
  }
  return out.filter(Boolean).join(", ") || null;
}
const termsDays = (t) => { const m = String(t || "").match(/(\d{1,3})\s*days?/i); return m ? Number(m[1]) : /cash|advance|immediate/i.test(t || "") ? 0 : null; };
const pick = (f, res) => { for (const re of res) for (const [k, v] of Object.entries(f)) if (re.test(k) && v && v !== "-") return v; return null; };

// Returns the same shape the AI reader returns (see ai.js), or null if this isn't a readable order/bill
export async function parseOrderPdf(buffer, { ourName = "zidane" } = {}) {
  let rows;
  try { rows = await pdfRows(buffer); } catch { return null; }
  if (!rows.length) return null;
  const lines = tableFromRows(rows);
  if (!lines) return null;
  const all = rows.map((r) => r.cells.map((c) => c.s).join(" ")).join("\n");
  const f = fields(rows);
  const isPo = /purchase\s*order|\bP\.?\s?O\.?\s*(#|no)/i.test(all);
  const supplierField = pick(f, [/^supplier(\s*name)?$/, /^vendor(\s*name)?$/, /^to$/]);
  // a PO addressed to us is a customer order; a bill/invoice addressed to us is a supplier bill
  const docType = isPo && (!supplierField || supplierField.toLowerCase().includes(ourName)) ? "customer_order"
    : /invoice|bill|challan/i.test(all) ? "supplier_bill" : isPo ? "customer_order" : "other";
  // the issuing company is the first line of the letterhead that isn't the document title
  // the letterhead of the page that has the item table (a terms & conditions page may come first)
  const tablePage = rows[findHeader(rows)?.index ?? 0]?.page;
  const pageRows = rows.filter((r) => r.page === tablePage);
  const top = pageRows.slice(0, 4).map((r) => r.cells[0].s).find((s) => !/purchase order|invoice|strn|ntn|page|terms|conditions/i.test(s) && s.length > 3) || null;
  // "Total Amount   50,100.00": the last number on the row that names the grand total
  const totalRow = rows.find((r) => /^(grand\s*total|total\s*amount|net\s*(amount|total)|total\s*payable)/i.test(r.cells.map((c) => c.s).join(" ").replace(/^.*?(grand|total|net)/i, "$1")));
  const total = (totalRow && num([...totalRow.cells].reverse().find((c) => isNum(c.s))?.s)) || num(pick(f, [/^total amount$/, /^grand total$/])) || lines.reduce((a, l) => a + (l.amount || 0), 0);
  const reference = pick(f, docType === "customer_order" ? [/^(p\.?\s?o\.?|purchase\s*order)\s*(#|no\.?|number)$/, /^order\s*(#|no\.?)$/] : [/^(invoice|bill)\s*(#|no\.?|number)$/, /^inv\.?\s*#$/])
    || (docType === "customer_order" ? pageRows.map((r) => r.cells.map((c) => c.s).join(" ")).join("\n").match(/(?:purchase\s*order|p\.?\s?o\.?)\s*(?:#|no\.?|number)\s*:?\s*((?=[A-Z\-\/]*\d)[A-Z0-9][A-Z0-9\-\/]{2,})/i)?.[1] : null) || null;
  const date = parseDate(pick(f, [/^(p\.?\s?o\.?|purchase\s*order)\s*date$/, /^(invoice|bill|order)\s*date$/, /^date$/]));
  const required = parseDate(pick(f, docType === "customer_order" ? [/^delivery\s*date$/, /^required\s*(by|date)$/, /^due\s*date$/] : [/^due\s*date$/]));
  // where to deliver: their address / store / warehouse, plus the plant or branch printed in the letterhead
  const location = pick(f, [/^(dlv\.?|delivery)\s*(location|address)$/, /^ship\s*to$/, /^deliver\s*(to|at)$/, /^(store|warehouse|site)$/]) || shipTo(rows);
  const plant = rows.slice(0, 3).flatMap((r) => r.cells.map((c) => c.s)).find((s) => /^(plant|unit|branch|site|factory)\b/i.test(s)) || null;
  const terms = pick(f, [/^payment\s*terms$/, /^terms\s*of\s*payment$/, /^credit\s*terms$/, /^terms$/]);
  // the person on their side: named contact / buyer, else whoever prepared the PO
  const buyer = pick(f, [/^(c\.?|contact)\s*person$/, /^buyer$/, /^attn\.?$/, /^attention$/]) || (docType === "customer_order" ? signedBy(rows, /^prepared\s*by$/i) : null);
  const phone = pick(f, [/^contact\s*(#|no\.?)$/, /^(phone|tel|cell|mobile)(\s*(#|no\.?))?$/]);
  // their tax numbers sit in the letterhead, above the "Supplier : ZIDANE …" block (which is about us)
  const head = rows.slice(0, rows.findIndex((r) => /^(supplier|vendor|to|bill\s*to)\b/i.test(r.cells[0].s)) >>> 0 || 4).map((r) => r.cells.map((c) => c.s).join(" ")).join(" ");
  const ntn = head.match(/\bNTN\s*(?:#|no\.?)?\s*:?\s*([\d][\d-]{4,})/i)?.[1] || null;
  const strn = head.match(/\b(?:STRN|GST|S\.?T\.?\s*No)\s*(?:#|no\.?)?\s*:?\s*([\d][\d-]{6,})/i)?.[1] || null;
  const bad = lines.filter((l) => !l.checks).length;
  return {
    doc_type: docType,
    summary: `${docType === "customer_order" ? "PO" : "Bill"} ${reference || ""} from ${top || "unknown"}: ${lines.length} item${lines.length > 1 ? "s" : ""}, Rs ${Math.round(total).toLocaleString("en-PK")}`.replace(/\s+/g, " "),
    party_name: top, party_match_id: null, reference, date, required_date: required,
    delivery_location: [location, plant && !(location || "").includes(plant) ? plant : null].filter(Boolean).join(", ") || null, total,
    buyer_name: buyer, contact_phone: phone, payment_terms: terms, payment_terms_days: termsDays(terms), party_ntn: ntn, party_strn: strn, party_address: null,
    notes: [wrapped(rows, /^(description|subject|remarks?)$/i), bad ? `${bad} line(s) don't add up (qty × rate ≠ amount). Check them.` : null].filter(Boolean).join(". ") || null,
    // their item code column is read only to keep it out of the name: it is their numbering, not ours, so it isn't kept
    lines: lines.map((l) => ({ description: l.note ? `${l.description} (${l.note})` : l.description, qty: l.qty, unit: l.unit, rate: l.rate, tax_rate: l.tax_rate ?? null, item_match_id: null, match_confidence: "none" })),
    reader: "pdf-text",
  };
}
