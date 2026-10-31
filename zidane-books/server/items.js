// Item 360: every transaction an item appears in, its buying and selling rate history, change log, and CSV import.
import { tx } from "./db.js";
import { adjustStock, httpError, log, round2, today } from "./books.js";

import { DOC_READ } from "./collab.js";

const SALES_KINDS = ["quote", "dc", "invoice", "credit_note"];
const BUY_KINDS = ["po", "bill", "vendor_credit"];
const CHANGE_FIELDS = { name: "name", sku: "SKU", unit: "unit", category: "category", purchase_rate: "purchase rate", sale_rate: "selling rate", tax_rate: "tax %", reorder_level: "reorder level", notes: "notes" };

// kinds the viewer may see, from their caps
export const visibleKinds = (can) => [...(can("sales.read") ? SALES_KINDS : []), ...(can("ops.read") ? BUY_KINDS : [])];

export function itemTransactions(db, itemId, can) {
  const kinds = visibleKinds(can);
  if (kinds.length === 0) return [];
  const rows = db.prepare(`SELECT d.id, d.kind, d.number, d.date, d.status, c.name AS contact_name, j.number AS job_number, l.qty, l.rate, l.discount_pct, l.amount
    FROM document_lines l JOIN documents d ON d.id = l.document_id JOIN contacts c ON c.id = d.contact_id LEFT JOIN jobs j ON j.id = d.job_id
    WHERE l.item_id = ? AND d.kind IN (${kinds.map(() => "?").join(",")}) ORDER BY d.date DESC, d.id DESC LIMIT 300`).all(itemId, ...kinds);
  return rows.map((r) => {
    const showRate = SALES_KINDS.includes(r.kind) ? can("price.view") : can("cost.view");
    return showRate ? r : { ...r, rate: undefined, amount: undefined, discount_pct: undefined };
  });
}

// buying side from issued supplier bills, selling side from issued invoices
export function itemRates(db, itemId, can) {
  const out = {};
  const since = (days) => new Date(Date.parse(today()) - days * 864e5).toISOString().slice(0, 10);
  if (can("cost.view")) {
    const bills = db.prepare(`SELECT d.date, c.id AS contact_id, c.name, l.qty, l.rate * (1 - l.discount_pct / 100) AS rate FROM document_lines l JOIN documents d ON d.id = l.document_id
      JOIN contacts c ON c.id = d.contact_id WHERE l.item_id = ? AND d.kind = 'bill' AND d.status = 'open' ORDER BY d.date DESC, d.id DESC`).all(itemId);
    const avg = (rows) => { const q = rows.reduce((a, r) => a + r.qty, 0); return q ? round2(rows.reduce((a, r) => a + r.qty * r.rate, 0) / q) : null; };
    const bySupplier = new Map();
    for (const b of bills) {
      const s = bySupplier.get(b.contact_id) || { contact_id: b.contact_id, name: b.name, last_rate: round2(b.rate), last_date: b.date, lowest: b.rate, qty: 0, bills: 0 };
      s.lowest = Math.min(s.lowest, b.rate); s.qty = round2(s.qty + b.qty); s.bills++;
      bySupplier.set(b.contact_id, s);
    }
    const suppliers = [...bySupplier.values()].map((s) => ({ ...s, lowest: round2(s.lowest) }));
    out.purchase = {
      last: bills[0] ? { rate: round2(bills[0].rate), date: bills[0].date, supplier: bills[0].name } : null,
      avg_30: avg(bills.filter((b) => b.date >= since(30))), avg_90: avg(bills.filter((b) => b.date >= since(90))),
      lowest_supplier: suppliers.length ? suppliers.reduce((a, b) => (b.last_rate < a.last_rate ? b : a)) : null,
      suppliers,
    };
  }
  if (can("price.view")) {
    const inv = db.prepare(`SELECT d.date, c.id AS contact_id, c.name, l.qty, l.rate * (1 - l.discount_pct / 100) AS rate FROM document_lines l JOIN documents d ON d.id = l.document_id
      JOIN contacts c ON c.id = d.contact_id WHERE l.item_id = ? AND d.kind = 'invoice' AND d.status = 'open' ORDER BY d.date DESC, d.id DESC`).all(itemId);
    const byCustomer = new Map();
    for (const r of inv) {
      const c = byCustomer.get(r.contact_id) || { contact_id: r.contact_id, name: r.name, last_rate: round2(r.rate), last_date: r.date, qty: 0, invoices: 0 };
      c.qty = round2(c.qty + r.qty); c.invoices++;
      byCustomer.set(r.contact_id, c);
    }
    out.sales = { last: inv[0] ? { rate: round2(inv[0].rate), date: inv[0].date, customer: inv[0].name } : null, customers: [...byCustomer.values()] };
  }
  return out;
}

// for the line editor: what we last charged this customer / paid this supplier for the item
export function lastRate(db, itemId, contactId, side, can) {
  const kinds = side === "sale" ? (can("price.view") ? ["invoice", "quote"] : []) : can("cost.view") ? ["bill", "po"] : [];
  if (!kinds.length) return null;
  const r = db.prepare(`SELECT d.kind, d.number, d.date, l.rate, l.discount_pct FROM document_lines l JOIN documents d ON d.id = l.document_id
    WHERE l.item_id = ? AND d.contact_id = ? AND d.kind IN (${kinds.map(() => "?").join(",")}) AND d.status NOT IN ('void','draft','enquiry','declined','cancelled') AND l.rate > 0
    ORDER BY d.date DESC, d.id DESC LIMIT 1`).get(itemId, contactId, ...kinds);
  return r ? { rate: round2(r.rate * (1 - r.discount_pct / 100)), date: r.date, number: r.number, kind: r.kind } : null;
}

// change log, with rate changes the viewer isn't allowed to see taken out
export function itemHistory(db, itemId, can = () => true) {
  const hide = [...(can("cost.view") ? [] : ["purchase rate"]), ...(can("price.view") ? [] : ["selling rate"])];
  return db.prepare("SELECT a.*, u.name AS user_name FROM activity a LEFT JOIN users u ON u.id = a.user_id WHERE a.entity = 'item' AND a.entity_id = ? ORDER BY a.id DESC LIMIT 200").all(itemId)
    .map((a) => (a.action === "changed" && a.summary ? { ...a, summary: a.summary.split(" · ").filter((part) => !hide.some((h) => part.startsWith(h))).join(" · ") } : a))
    .filter((a) => a.action !== "changed" || a.summary);
}

// stock moves name the document that caused them; hide the other department's document numbers
export function shapeMoves(moves, can) {
  return moves.map((m) => {
    if (!m.document_kind) return m;
    if ((DOC_READ[m.document_kind] || ["admin"]).some(can)) return m;
    const out = { credit_note: "returned by customer", vendor_credit: "returned to supplier", dc: "delivered to customer", invoice: "delivered to customer" }[m.document_kind] || "purchase received";
    return { ...m, reason: out, document_id: null, document_kind: null };
  });
}

// write the before → after of every changed field to the activity log (blueprint: audit trail with before/after)
export function logItemChanges(db, userId, before, after, can) {
  const changes = [];
  for (const [k, label] of Object.entries(CHANGE_FIELDS)) {
    if (after[k] === undefined || String(before[k] ?? "") === String(after[k] ?? "")) continue;
    if (k === "purchase_rate" && !can("cost.view")) continue;
    if (k === "sale_rate" && !can("price.view")) continue;
    changes.push(`${label}: ${before[k] ?? "—"} → ${after[k] ?? "—"}`);
  }
  if (changes.length) log(db, userId, "changed", "item", before.id, changes.join(" · "));
}

// rows already parsed from CSV; header names from a Zoho Books item export or our own export are both understood
const pick = (row, names) => { for (const n of names) { const v = row[n]; if (v !== undefined && String(v).trim() !== "") return String(v).trim(); } return undefined; };
const money = (v) => (v === undefined ? undefined : Number(String(v).replace(/[^0-9.-]/g, "")) || 0);
// the item's category, as written in the list (Settings → item categories); required on every item
export function itemCategory(db, value) {
  const list = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'itemCategories'").get()?.value || "[]");
  const hit = list.find((c) => c.toLowerCase() === String(value || "").trim().toLowerCase());
  if (!hit) throw httpError(400, value ? `"${value}" is not one of the item categories` : "Choose a category for the item");
  return hit;
}

export function importItems(db, userId, rows, can) {
  if (!Array.isArray(rows) || rows.length === 0) throw httpError(400, "The file has no rows");
  if (rows.length > 5000) throw httpError(400, "Import at most 5,000 items at a time");
  let created = 0, updated = 0, skipped = 0;
  const norm = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase().replace(/[^a-z]/g, ""), v])));
  tx(db, () => {
    for (const r of norm) {
      const name = pick(r, ["itemname", "name", "item"]);
      if (!name) { skipped++; continue; }
      const f = {
        sku: pick(r, ["sku", "itemcode", "code"]), unit: pick(r, ["unit", "usageunit", "uom"]), category: pick(r, ["category", "categoryname"]),
        sale_rate: can("price.view") ? money(pick(r, ["rate", "sellingprice", "salerate", "sellingrate", "salesrate"])) : undefined,
        purchase_rate: can("cost.view") ? money(pick(r, ["purchaserate", "purchaseprice", "costprice", "cost", "buyrate"])) : undefined,
        tax_rate: money(pick(r, ["taxpercentage", "taxrate", "tax"])), reorder_level: money(pick(r, ["reorderlevel", "reorderpoint"])),
      };
      // a category we don't have becomes General (fix it on the item later)
      if (f.category) { try { f.category = itemCategory(db, f.category); } catch { f.category = "General"; } }
      const stock = money(pick(r, ["openingstock", "stockonhand", "stock", "quantity"]));
      const existing = (f.sku && db.prepare("SELECT * FROM items WHERE sku = ? AND active = 1").get(f.sku)) || db.prepare("SELECT * FROM items WHERE name = ? COLLATE NOCASE AND active = 1").get(name);
      if (existing) {
        const next = { ...existing, ...Object.fromEntries(Object.entries({ name, ...f }).filter(([, v]) => v !== undefined)) };
        db.prepare("UPDATE items SET name=?, sku=?, unit=?, category=?, purchase_rate=?, sale_rate=?, tax_rate=?, reorder_level=? WHERE id=?")
          .run(next.name, next.sku, next.unit, next.category, next.purchase_rate, next.sale_rate, next.tax_rate, next.reorder_level, existing.id);
        logItemChanges(db, userId, existing, next, can);
        updated++;
      } else {
        const id = Number(db.prepare("INSERT INTO items (name, sku, unit, category, purchase_rate, sale_rate, tax_rate, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(name, f.sku || null, f.unit || "pcs", f.category || "General", f.purchase_rate || 0, f.sale_rate || 0, f.tax_rate || 0, f.reorder_level || 0).lastInsertRowid);
        if (stock) adjustStock(db, userId, id, stock, "opening stock (import)", false);
        log(db, userId, "imported", "item", id, name);
        created++;
      }
    }
  });
  return { created, updated, skipped };
}
