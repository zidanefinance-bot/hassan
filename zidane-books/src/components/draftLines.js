// Helpers for forms filled from an Orders Inbox draft (a customer's PO or a supplier's bill).
import { api } from "../lib.jsx";

const UNITS = { pc: "pcs", pcs: "pcs", nos: "pcs", no: "pcs", each: "pcs", ea: "pcs", can: "can", box: "box", kg: "kg", kgs: "kg", g: "g", gm: "g", ltr: "ltr", l: "ltr", bag: "bag", pkt: "pack", pack: "pack", ctn: "carton", carton: "carton", dozen: "dozen", dz: "dozen", roll: "roll", bottle: "bottle", btl: "bottle", tin: "tin", pouch: "pouch" };
export const unitOf = (u) => UNITS[String(u || "").toLowerCase().replace(/[^a-z]/g, "")] || (u ? String(u).toLowerCase() : "pcs");

// lines that came from the paper but aren't one of our items yet
export const missingLines = (lines) => lines.filter((l) => !l.item_id && l.ai_text);

// make each missing line a new item (name, unit and rate from the paper), one after another
export async function createMissingItems(lines, rateField) {
  const out = [...lines];
  for (let i = 0; i < out.length; i++) {
    const l = out[i];
    if (l.item_id || !l.ai_text) continue;
    const r = await api("/items", { method: "POST", body: { name: l.ai_text, unit: unitOf(l.ai_unit), [rateField]: l.ai_rate ?? 0, tax_rate: 0, track_stock: true } });
    out[i] = { ...l, item_id: r.id, description: "", ai: null };
  }
  return out;
}

// what was chosen for each paper line, so the same code/name matches by itself next time
export const learnedLines = (lines) => lines.filter((l) => l.ai_text && l.item_id).map((l) => ({ code: l.ai_code || null, description: l.ai_text, item_id: Number(l.item_id) }));

// a new customer/supplier from the paper: the details it prints about them
export const partyPreset = (x) => !x ? {} : Object.fromEntries(Object.entries({
  company: x.buyer_name, phone: x.contact_phone, address: x.party_address, ntn: x.party_ntn,
  payment_terms_days: x.payment_terms_days ?? null, notes: x.party_strn ? `STRN ${x.party_strn}` : null,
}).filter(([, v]) => v != null && v !== ""));

// strip the helper fields before saving
export const cleanLine = ({ ai, ai_text, ai_unit, ai_rate, ai_code, ...x }) => x;
