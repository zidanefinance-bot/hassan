// Matching what's on a customer's PO / supplier's bill to our own contacts and items, without AI, and remembering it.
// Order of trust: what a person confirmed before (alias by the party's item code, then by their item name),
// then the same name, then a close name (marked "check"). Their item code is only a memory key: it is their numbering,
// not ours, so it is never compared with our SKUs or shown.
import { round2 } from "./books.js";

export const norm = (s) => String(s || "").toLowerCase().replace(/\(?\b(pvt|private|ltd|limited|co|company|corp|corporation|the)\b\.?\)?/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s) => new Set(norm(s).split(" ").filter((t) => t.length > 1 || /\d/.test(t)));

// share of words in common, with numbers (sizes like 6202, 500gm) counting double: they decide which variant it is
function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let common = 0, total = 0;
  for (const t of new Set([...A, ...B])) {
    const w = /\d/.test(t) ? 2 : 1;
    total += w;
    if (A.has(t) && B.has(t)) common += w;
  }
  // a number on one side that's missing on the other means a different size: not the same product
  for (const t of A) if (/\d/.test(t) && !B.has(t)) return Math.min(common / total, 0.5);
  return common / total;
}

const UNITS = { pc: "pcs", pcs: "pcs", nos: "pcs", no: "pcs", each: "pcs", ea: "pcs", can: "can", box: "box", kg: "kg", kgs: "kg", g: "g", gm: "g", ltr: "ltr", l: "ltr", litre: "ltr", bag: "bag", pkt: "pack", pack: "pack", ctn: "carton", carton: "carton", dozen: "dozen", dz: "dozen", roll: "roll", bottle: "bottle", btl: "bottle", tin: "tin", pouch: "pouch" };
export const unitOf = (u) => UNITS[String(u || "").toLowerCase().replace(/[^a-z]/g, "")] || (u ? String(u).toLowerCase() : "pcs");

export function matchParty(db, name, type) {
  const n = norm(name);
  if (!n) return null;
  const rows = db.prepare("SELECT id, name, company FROM contacts WHERE type = ? AND active = 1").all(type);
  const exact = rows.find((c) => norm(c.name) === n || (c.company && norm(c.company) === n));
  if (exact) return exact.id;
  const first = n.split(" ")[0];
  const close = rows.filter((c) => first.length >= 4 && (norm(c.name).startsWith(first) || n.startsWith(norm(c.name)) || norm(c.name).includes(n)));
  return close.length === 1 ? close[0].id : null;
}

export function matchLines(db, contactId, lines) {
  const items = db.prepare("SELECT id, name, sku FROM items WHERE active = 1").all();
  const alias = (sql, ...a) => db.prepare(sql).get(...a)?.item_id;
  return lines.map((l) => {
    let id = null, conf = "none";
    if (contactId && l.code) id = alias("SELECT item_id FROM item_aliases WHERE contact_id = ? AND code = ?", contactId, l.code);
    if (!id && contactId) id = alias("SELECT item_id FROM item_aliases WHERE contact_id = ? AND name_norm = ?", contactId, norm(l.description));
    if (id) conf = "high";
    if (!id) { id = items.find((i) => norm(i.name) === norm(l.description))?.id || null; if (id) conf = "high"; }
    if (!id) {
      let best = null, score = 0;
      for (const i of items) { const s = similarity(l.description, i.name); if (s > score) { score = s; best = i; } }
      if (best && score >= 0.6) { id = best.id; conf = "low"; }
    }
    // keep a match only if the item still exists
    if (id && !items.some((i) => i.id === id)) { id = null; conf = "none"; }
    return { ...l, item_match_id: id, match_confidence: conf };
  });
}

// what a person chose for each line becomes the rule for next time (per customer / supplier)
export function rememberLines(db, contactId, lines) {
  let n = 0;
  for (const l of lines || []) {
    const itemId = Number(l.item_id);
    if (!contactId || !itemId || !(l.code || l.description)) continue;
    if (!db.prepare("SELECT 1 FROM items WHERE id = ?").get(itemId)) continue;
    db.prepare(`INSERT INTO item_aliases (contact_id, code, name_norm, item_id) VALUES (?, ?, ?, ?)
      ON CONFLICT(contact_id, name_norm) DO UPDATE SET item_id = excluded.item_id, code = COALESCE(excluded.code, item_aliases.code)`)
      .run(contactId, l.code || null, norm(l.description), itemId);
    n++;
  }
  return n;
}

// fill matches for a draft (from the PDF reader or AI): contact, items, tidy dates
export function completeDraft(db, x) {
  const type = x.doc_type === "supplier_bill" ? "supplier" : "customer";
  const party = (x.party_match_id && db.prepare("SELECT id FROM contacts WHERE id = ? AND type = ?").get(x.party_match_id, type)?.id) || matchParty(db, x.party_name, type);
  const lines = matchLines(db, party, x.lines || []).map((l, i) => {
    const ai = x.lines[i];
    // an AI match that we couldn't improve on is kept, if the item exists
    if (l.match_confidence === "none" && ai.item_match_id && db.prepare("SELECT 1 FROM items WHERE id = ? AND active = 1").get(ai.item_match_id)) return { ...l, item_match_id: ai.item_match_id, match_confidence: ai.match_confidence || "low" };
    return l;
  });
  const iso = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : null);
  return { ...x, party_match_id: party || null, date: iso(x.date), required_date: iso(x.required_date), lines, total: x.total != null ? round2(x.total) : null };
}
