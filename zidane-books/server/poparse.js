// Reads computer-made PDFs (a customer's ERP purchase order, a supplier's printed invoice) without AI: free, instant
// and exact. It finds the item table from its header row (Qty / Rate / Amount …), reads each line, and checks that
// qty × rate = amount. Scanned papers and photos have no text layer; those still go to AI (if it is set up).
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const num = (s) => { const v = Number(String(s ?? "").replace(/,/g, "").replace(/[^\d.\-]/g, "")); return Number.isFinite(v) ? v : null; };
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
      if (row) row.cells.push(it); else pageRows.push({ y: it.y, cells: [it] });
    }
    for (const r of pageRows) r.cells.sort((a, b) => a.x - b.x);
    rows.push(...pageRows);
  }
  return rows;
}

const COLS = [
  ["sno", /^(s\.?\s*#|s\.?\s*no\.?|sr\.?\s*(no\.?|#)?|#|line)$/i],
  ["code", /(item\s*code|product\s*code|code|sku|part\s*(no|#))/i],
  ["name", /(item\s*name|description|item|product|particulars|material)/i],
  ["note", /(narration|remarks?|specification|spec|brand|make)/i],
  ["qty", /^(qty|quantity|qnty|order\s*qty)/i],
  ["unit", /^(uom|unit|u\/m|pack)/i],
  ["rate", /^(rate|price|unit\s*price|u\.?\s*price)/i],
  ["amount", /^(amount|total|value|net\s*amount|line\s*total)/i],
];

function findHeader(rows) {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].cells;
    const cols = [];
    for (const c of cells) {
      const hit = COLS.find(([key, re]) => re.test(c.s) && !cols.some((x) => x.key === key));
      if (hit) cols.push({ key: hit[0], x: c.x, w: c.w });
    }
    if (cols.some((c) => c.key === "qty") && cols.some((c) => c.key === "rate" || c.key === "amount") && cols.some((c) => c.key === "name" || c.key === "code")) {
      return { index: i, cols: cols.sort((a, b) => a.x - b.x) };
    }
  }
  return null;
}

// Numbers on the right (qty, unit, rate, amount) sit close to their headers, so they go to the nearest one.
// Text on the left is often centred under its header, so it is sorted by what it looks like instead:
// a small number first is the line number, a long code with digits is the item code, the rest is the name,
// and text far to the right of the name (under "Narration"/"Remarks") is a note.
const NUMERIC = ["qty", "unit", "rate", "amount"];
const looksLikeCode = (s) => /^[A-Z0-9][A-Z0-9\-\/.]{4,}$/i.test(s) && /\d{3,}/.test(s) && !/\s/.test(s);
function splitRow(cols, cells) {
  const rec = {};
  const right = cols.filter((c) => NUMERIC.includes(c.key));
  const firstNumX = Math.min(...right.map((c) => c.x));
  const note = cols.find((c) => c.key === "note");
  const add = (k, v) => { rec[k] = rec[k] ? `${rec[k]} ${v}` : v; };
  cells.forEach((cell, i) => {
    if (cell.x >= firstNumX - 20) {
      let best = right[0], dist = Infinity;
      for (const c of right) { const d = Math.abs(cell.x - c.x); if (d < dist) { dist = d; best = c; } }
      return add(best.key, cell.s);
    }
    if (i === 0 && /^\d{1,3}\.?$/.test(cell.s)) return add("sno", cell.s);
    if (!rec.code && !rec.name && looksLikeCode(cell.s) && cols.some((c) => c.key === "code")) return add("code", cell.s);
    if (note && rec.name && cell.x >= note.x - 40) return add("note", cell.s);
    add("name", cell.s);
  });
  return rec;
}

export function tableFromRows(rows) {
  const head = findHeader(rows);
  if (!head) return null;
  const lines = [];
  for (const r of rows.slice(head.index + 1)) {
    const text = r.cells.map((c) => c.s).join(" ");
    if (/^(grand\s*)?(sub\s*)?total\b/i.test(r.cells[0].s) || /^total\s*amount/i.test(text)) break;
    const rec = splitRow(head.cols, r.cells);
    // "15.00 PC" in the qty column: number plus unit
    if (rec.qty && !isNum(rec.qty)) { const m = rec.qty.match(/^([\d,]+(?:\.\d+)?)\s+(.+)$/); if (m) { rec.qty = m[1]; rec.unit ||= m[2]; } }
    const hasNumbers = num(rec.qty) !== null && (num(rec.rate) !== null || num(rec.amount) !== null);
    if (!hasNumbers) {
      // a wrapped description line continues the previous item
      if (lines.length && (rec.name || rec.note) && !rec.sno) lines.at(-1).description += ` ${[rec.name, rec.note].filter(Boolean).join(" ")}`;
      else if (lines.length && !rec.name && !rec.code) break;
      continue;
    }
    const qty = num(rec.qty), rate = num(rec.rate), amount = num(rec.amount);
    const name = (rec.name || rec.code || "").trim();
    if (!name) continue;
    lines.push({
      code: rec.code?.trim() || null,
      description: name,
      note: rec.note?.trim() || null,
      qty, unit: rec.unit?.trim() || null,
      rate: rate ?? (amount !== null && qty ? Math.round((amount / qty) * 100) / 100 : null),
      amount,
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
      else if (/:$/.test(label) && cells[i + 1] && !cells[i + 1].endsWith(":")) [label, value] = [label.slice(0, -1), cells[i + 1]];
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
    const c = r.cells.filter((c) => !/:$/.test(c.s) && /[a-z]{3}/i.test(c.s)).sort((a, b) => Math.abs(a.x - head.x) - Math.abs(b.x - head.x))[0];
    if (c && Math.abs(c.x - head.x) < 80) return c.s;
  }
  return null;
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
  const supplierField = pick(f, [/^supplier$/, /^vendor$/, /^to$/]);
  // a PO addressed to us is a customer order; a bill/invoice addressed to us is a supplier bill
  const docType = isPo && (!supplierField || supplierField.toLowerCase().includes(ourName)) ? "customer_order"
    : /invoice|bill|challan/i.test(all) ? "supplier_bill" : isPo ? "customer_order" : "other";
  // the issuing company is the first line of the letterhead that isn't the document title
  const top = rows.slice(0, 4).map((r) => r.cells[0].s).find((s) => !/purchase order|invoice|strn|ntn|page/i.test(s) && s.length > 3) || null;
  // "Total Amount   50,100.00": the last number on the row that names the grand total
  const totalRow = rows.find((r) => /^(grand\s*total|total\s*amount|net\s*(amount|total)|total\s*payable)/i.test(r.cells.map((c) => c.s).join(" ").replace(/^.*?(grand|total|net)/i, "$1")));
  const total = (totalRow && num([...totalRow.cells].reverse().find((c) => isNum(c.s))?.s)) || num(pick(f, [/^total amount$/, /^grand total$/])) || lines.reduce((a, l) => a + (l.amount || 0), 0);
  const reference = pick(f, docType === "customer_order" ? [/^p\.?\s?o\.?\s*(#|no\.?|number)$/, /^order\s*(#|no\.?)$/] : [/^(invoice|bill)\s*(#|no\.?|number)$/, /^inv\.?\s*#$/]);
  const date = parseDate(pick(f, [/^p\.?\s?o\.?\s*date$/, /^(invoice|bill|order)\s*date$/, /^date$/]));
  const required = parseDate(pick(f, docType === "customer_order" ? [/^delivery\s*date$/, /^required\s*(by|date)$/, /^due\s*date$/] : [/^due\s*date$/]));
  // where to deliver: their address / store / warehouse, plus the plant or branch printed in the letterhead
  const location = pick(f, [/^(dlv\.?|delivery)\s*(location|address)$/, /^ship\s*to$/, /^deliver\s*to$/, /^(store|warehouse|site)$/]);
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
    notes: bad ? `${bad} line(s) don't add up (qty × rate ≠ amount). Check them.` : null,
    // their item code column is read only to keep it out of the name: it is their numbering, not ours, so it isn't kept
    lines: lines.map((l) => ({ description: l.note ? `${l.description} (${l.note})` : l.description, qty: l.qty, unit: l.unit, rate: l.rate, tax_rate: null, item_match_id: null, match_confidence: "none" })),
    reader: "pdf-text",
  };
}
