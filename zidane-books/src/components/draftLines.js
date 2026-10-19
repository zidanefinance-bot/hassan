// Helpers for forms filled from an Orders Inbox draft (a customer's PO or a supplier's bill).
import { api } from "../lib.jsx";

const UNITS = { pc: "pcs", pcs: "pcs", nos: "pcs", no: "pcs", each: "pcs", ea: "pcs", can: "can", box: "box", kg: "kg", kgs: "kg", g: "g", gm: "g", ltr: "ltr", l: "ltr", bag: "bag", pkt: "pack", pack: "pack", ctn: "carton", carton: "carton", dozen: "dozen", dz: "dozen", roll: "roll", bottle: "bottle", btl: "bottle", tin: "tin", pouch: "pouch" };
export const unitOf = (u) => UNITS[String(u || "").toLowerCase().replace(/[^a-z]/g, "")] || (u ? String(u).toLowerCase() : "pcs");

// lines that came from the paper but aren't one of our items yet
export const missingLines = (lines) => lines.filter((l) => !l.item_id && l.ai_text);

// a first guess at a new item's category: the category of our most similar item, else a few telling words
const WORDS = [
  ["Mechanical", /bearing|grease|bolt|nut\b|washer|valve|pipe|belt|gear|spring|seal|gasket|coupling|chain|pulley|wd\s*-?\s*40|lubric|oil seal|elfy|cementex|contact cleaner|spanner|drill|hose|clamp/i],
  ["Electrical", /cable|wire|bulb|led|light|switch|breaker|socket|plug|fuse|tube ?light|battery|motor|fan|contactor|relay|holder/i],
  ["Stationery", /\bpen\b|pencil|paper|register|file|folder|marker|stapler|staple|envelope|ink|toner|notebook|highlighter|glue|tape|calculator|a4/i],
  ["House Keeping", /clean|phenyl|harpic|mop|broom|detergent|soap|tissue|brush|bucket|wiper|dust|bin|bag liner|garbage|sanitizer|air freshener|glass ?cleaner|scrub|sponge|duster|surf|vim/i],
  ["Grocery", /rice|atta|flour|oil|ghee|sugar|tea|coffee|daal|dal\b|spice|salt|milk|masala|biscuit|water bottle|juice|dates/i],
  ["Furniture & Fittings", /hinge|handle|lock|drawer|channel|fitting|door|curtain|blind/i],
  ["Furniture", /chair|table|desk|cabinet|sofa|rack|shelf|almirah|bench|stool/i],
];
const words = (s) => new Set(String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !/^\d+$/.test(w)));
export function guessCategory(name, items = [], list = []) {
  const w = words(name);
  let best = null, score = 0;
  for (const i of items) {
    if (!i.category) continue;
    const iw = words(i.name);
    const common = [...w].filter((x) => iw.has(x)).length;
    const s = common / Math.max(1, Math.min(w.size, iw.size));
    if (common && s > score) { score = s; best = i.category; }
  }
  if (best && score >= 0.5) return best;
  const hit = WORDS.find(([c, re]) => list.includes(c) && re.test(name));
  return hit ? hit[0] : "";
}

// make each missing line a new item (name, unit and rate from the paper, the category the person chose), one after another
export async function createMissingItems(lines, rateField, categories = {}) {
  const out = [...lines];
  for (let i = 0; i < out.length; i++) {
    const l = out[i];
    if (l.item_id || !l.ai_text) continue;
    const r = await api("/items", { method: "POST", body: { name: l.ai_text, unit: unitOf(l.ai_unit), category: categories[i], [rateField]: l.ai_rate ?? 0, tax_rate: 0, track_stock: true } });
    out[i] = { ...l, item_id: r.id, description: "", ai: null };
  }
  return out;
}

// what was chosen for each paper line, so the same name matches by itself next time
export const learnedLines = (lines) => lines.filter((l) => l.ai_text && l.item_id).map((l) => ({ description: l.ai_text, item_id: Number(l.item_id) }));

// a new customer/supplier from the paper: the details it prints about them
export const partyPreset = (x) => !x ? {} : Object.fromEntries(Object.entries({
  company: x.buyer_name, phone: x.contact_phone, address: x.party_address, ntn: x.party_ntn,
  payment_terms_days: x.payment_terms_days ?? null, notes: x.party_strn ? `STRN ${x.party_strn}` : null,
}).filter(([, v]) => v != null && v !== ""));

// strip the helper fields before saving
export const cleanLine = ({ ai, ai_text, ai_unit, ai_rate, ...x }) => x;
