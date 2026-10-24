// Ration programs: a kit (what goes in one bag, at what rate per item), orders of N bags, packing progress, and
// customer paperwork shown as "N bags × rate" with the contents of one bag underneath.
// Inside, a ration order stays item-wise (bags × each item's qty per bag) so buying, stock, DCs, invoices, cost of
// goods and the ledger keep working as for any Job. Labour, packing material, loading and delivery vary per order:
// they are the Job's direct costs.
import { httpError, round2, saveDocument, today } from "./books.js";
import { tx } from "./db.js";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS kits (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, notes TEXT, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS kit_items (
  id INTEGER PRIMARY KEY, kit_id INTEGER NOT NULL REFERENCES kits(id) ON DELETE CASCADE, item_id INTEGER REFERENCES items(id),
  description TEXT, qty REAL NOT NULL, rate REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0,
  internal INTEGER NOT NULL DEFAULT 0 -- packing material etc: goes on the Job for Purchasing to see, never on the customer's quote/DC/invoice
);
-- one order, several places to deliver (each its own DC with its own address)
CREATE TABLE IF NOT EXISTS job_delivery_points (
  id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, name TEXT NOT NULL, address TEXT,
  contact TEXT, phone TEXT, bags REAL
);
CREATE TABLE IF NOT EXISTS job_packing (
  id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, date TEXT NOT NULL, bags REAL NOT NULL CHECK (bags > 0),
  notes TEXT, created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export function setupRation(db) {
  db.exec(SCHEMA);
  const has = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some((x) => x.name === c);
  if (!has("jobs", "bags")) db.exec("ALTER TABLE jobs ADD COLUMN bags REAL; ALTER TABLE jobs ADD COLUMN kit_name TEXT;");
  if (!has("documents", "bags")) db.exec("ALTER TABLE documents ADD COLUMN bags REAL; ALTER TABLE documents ADD COLUMN kit_name TEXT; ALTER TABLE documents ADD COLUMN show_as TEXT;");
  if (!has("documents", "deliver_to")) db.exec("ALTER TABLE documents ADD COLUMN deliver_to TEXT; ALTER TABLE documents ADD COLUMN delivery_point_id INTEGER REFERENCES job_delivery_points(id);");
  if (!has("kit_items", "internal")) db.exec("ALTER TABLE kit_items ADD COLUMN internal INTEGER NOT NULL DEFAULT 0;");
  if (!has("jobs", "kit_id")) db.exec("ALTER TABLE jobs ADD COLUMN kit_id INTEGER REFERENCES kits(id);");
  if (!has("documents", "kit_id")) db.exec("ALTER TABLE documents ADD COLUMN kit_id INTEGER REFERENCES kits(id);");
  // the costs that vary per ration order, as Job cost types (added once; a director can rename or remove them)
  const row = db.prepare("SELECT value FROM settings WHERE key = 'jobExpenseCategories'").get();
  const flag = db.prepare("SELECT 1 FROM settings WHERE key = 'rationCostTypesAdded'").get();
  if (row && !flag) {
    const cats = JSON.parse(row.value);
    for (const c of ["Packing material", "Packing labour", "Loading / Unloading", "Delivery"]) if (!cats.some((x) => x.toLowerCase() === c.toLowerCase())) cats.push(c);
    db.prepare("UPDATE settings SET value = ? WHERE key = 'jobExpenseCategories'").run(JSON.stringify(cats));
    db.prepare("INSERT INTO settings (key, value) VALUES ('rationCostTypesAdded', 'true')").run();
  }
}

// ---- kits
export function kitDetail(db, id) {
  const k = db.prepare("SELECT * FROM kits WHERE id = ?").get(id);
  if (!k) throw httpError(404, "Kit not found");
  const all = db.prepare(`SELECT ki.*, i.name AS item_name, i.unit, i.purchase_rate, i.stock_qty FROM kit_items ki LEFT JOIN items i ON i.id = ki.item_id WHERE ki.kit_id = ? ORDER BY ki.id`).all(id);
  const lines = all.filter((l) => !l.internal); // what the customer's quote/DC/invoice shows
  const materials = all.filter((l) => l.internal); // packing material etc: Purchasing only, never quoted or billed
  const price = round2(lines.reduce((s, l) => s + l.qty * l.rate, 0));
  const cost = round2(lines.reduce((s, l) => s + l.qty * (l.purchase_rate || 0), 0));
  return { ...k, lines, materials, price_per_bag: price, cost_per_bag: cost, margin_per_bag: round2(price - cost), margin_pct: price ? round2(((price - cost) / price) * 100) : 0 };
}
export const kitList = (db) => db.prepare("SELECT id FROM kits ORDER BY active DESC, name").all().map((k) => kitDetail(db, k.id));

export function saveKit(db, input, id = null) {
  const name = String(input.name || "").trim();
  if (!name) throw httpError(400, "Give the kit a name");
  const lines = (input.lines || []).filter((l) => l.item_id || String(l.description || "").trim());
  if (!lines.length) throw httpError(400, "Add at least one item to the bag");
  if (lines.some((l) => !(Number(l.qty) > 0))) throw httpError(400, "Every item needs a quantity per bag above 0");
  if (lines.some((l) => Number(l.rate) < 0)) throw httpError(400, "A rate can't be negative");
  return tx(db, () => {
    try {
      if (id) db.prepare("UPDATE kits SET name = ?, notes = ?, active = ? WHERE id = ?").run(name, input.notes || null, input.active === false || input.active === 0 ? 0 : 1, id);
      else id = Number(db.prepare("INSERT INTO kits (name, notes) VALUES (?, ?)").run(name, input.notes || null).lastInsertRowid);
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) throw httpError(400, "Another kit already has this name");
      throw e;
    }
    db.prepare("DELETE FROM kit_items WHERE kit_id = ?").run(id);
    const ins = db.prepare("INSERT INTO kit_items (kit_id, item_id, description, qty, rate, tax_rate, internal) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const l of lines) ins.run(id, Number(l.item_id) || null, l.description || null, Number(l.qty), round2(Number(l.rate) || 0), Number(l.tax_rate) || 0, l.internal ? 1 : 0);
    return id;
  });
}

// how a ration document is shown to the customer:
//   bags        N bags × rate, then one bag's contents with each item's rate
//   bags_total  N bags × rate, then one bag's contents (items and quantities only, no item rates)
//   items       item by item, like any document
export const SHOW_AS = ["bags", "bags_total", "items"];
export function markBags(db, docId, bags, kitName, showAs = "bags", kitId = undefined) {
  if (kitId === undefined) db.prepare("UPDATE documents SET bags = ?, kit_name = ?, show_as = ? WHERE id = ?").run(bags ? round2(bags) : null, kitName || null, SHOW_AS.includes(showAs) ? showAs : "bags", docId);
  else db.prepare("UPDATE documents SET bags = ?, kit_name = ?, show_as = ?, kit_id = ? WHERE id = ?").run(bags ? round2(bags) : null, kitName || null, SHOW_AS.includes(showAs) ? showAs : "bags", kitId || null, docId);
}

// a quotation for N bags from a kit: the lines hold the full quantities, the PDF shows one bag and × N
export function quoteFromKit(db, userId, kitId, { contact_id, bags, date, notes, terms, reference, show_as } = {}) {
  const k = kitDetail(db, kitId);
  const n = Number(bags);
  if (!contact_id) throw httpError(400, "Pick the customer");
  if (!(n > 0)) throw httpError(400, "How many bags?");
  const lines = k.lines.map((l) => ({ item_id: l.item_id, description: l.item_id ? null : l.description, qty: round2(l.qty * n), rate: l.rate, tax_rate: l.tax_rate }));
  const id = saveDocument(db, userId, { kind: "quote", contact_id, status: "draft", date: date || today(), notes: notes ?? k.notes, terms, reference, lines });
  markBags(db, id, n, k.name, show_as, kitId);
  return id;
}

// ---- a ration Job: bags ordered, packed, delivered, invoiced; what one bag holds
export const isRation = (job) => Boolean(job && job.bags > 0);
export function perBag(db, job) {
  return db.prepare("SELECT ji.*, COALESCE(i.name, ji.description) AS name, i.unit FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE ji.job_id = ? ORDER BY ji.id").all(job.id)
    .map((ji) => ({ ...ji, per_bag: round2(ji.qty / job.bags) }));
}
const docBags = (db, jobId, kind, statuses) => round2(db.prepare(`SELECT COALESCE(SUM(bags), 0) AS b FROM documents WHERE job_id = ? AND kind = ? AND status IN (${statuses.map(() => "?").join(",")})`).get(jobId, kind, ...statuses).b);

// packing material etc from the kit this Job was made from (poly bags, sacks…): Purchasing's own list, scaled to
// this order's bags. Pulled live from the kit, not copied into job_items, so it never reaches a DC/invoice/quote.
export function materialsNeeded(db, job) {
  if (!job.kit_id) return [];
  return db.prepare(`SELECT ki.item_id, ki.description, ki.qty AS per_bag, i.name AS item_name, i.unit FROM kit_items ki
    LEFT JOIN items i ON i.id = ki.item_id WHERE ki.kit_id = ? AND ki.internal = 1 ORDER BY ki.id`).all(job.kit_id)
    .map((m) => ({ ...m, name: m.item_name || m.description, qty: round2(m.per_bag * job.bags) }));
}

export function rationStatus(db, job) {
  if (!isRation(job)) return null;
  const packed = round2(db.prepare("SELECT COALESCE(SUM(bags), 0) AS b FROM job_packing WHERE job_id = ?").get(job.id).b);
  const delivered = docBags(db, job.id, "dc", ["issued", "signed"]);
  const invoiced = docBags(db, job.id, "invoice", ["open", "draft"]);
  const contents = perBag(db, job);
  const materials = materialsNeeded(db, job);
  const pricePerBag = round2(contents.reduce((s, l) => s + l.per_bag * l.sale_rate, 0));
  const packing = db.prepare("SELECT p.*, u.name AS by_name FROM job_packing p LEFT JOIN users u ON u.id = p.created_by WHERE job_id = ? ORDER BY date, id").all(job.id);
  const inDraft = docBags(db, job.id, "dc", ["draft"]);
  return { bags: job.bags, kit_name: job.kit_name, packed, delivered, invoiced, in_draft_dc: inDraft, to_pack: round2(job.bags - packed), ready_to_send: round2(packed - delivered - inDraft), price_per_bag: pricePerBag, contents, materials, packing, points: deliveryPoints(db, job.id) };
}

export function addPacking(db, userId, jobId, { bags, date, notes }) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  if (!isRation(job)) throw httpError(400, "This Job isn't a ration order");
  if (job.closed) throw httpError(400, "This Job is closed");
  const n = round2(Number(bags));
  if (!(n > 0)) throw httpError(400, "How many bags were packed?");
  const st = rationStatus(db, job);
  if (n > st.to_pack + 0.001) throw httpError(400, `Only ${st.to_pack} bags are left to pack on this order`);
  const id = Number(db.prepare("INSERT INTO job_packing (job_id, date, bags, notes, created_by) VALUES (?, ?, ?, ?, ?)").run(jobId, date || today(), n, notes || null, userId ?? null).lastInsertRowid);
  db.prepare("INSERT INTO activity (user_id, action, entity, entity_id, summary) VALUES (?, 'packed bags', 'job', ?, ?)").run(userId ?? null, jobId, `${n} bags packed`);
  return id;
}
export function deletePacking(db, userId, packId) {
  const p = db.prepare("SELECT * FROM job_packing WHERE id = ?").get(packId);
  if (!p) throw httpError(404, "Not found");
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(p.job_id);
  const st = rationStatus(db, job);
  if (st.packed - p.bags < st.delivered - 0.001) throw httpError(400, "Those bags have already gone out on a delivery challan");
  db.prepare("DELETE FROM job_packing WHERE id = ?").run(packId);
  db.prepare("INSERT INTO activity (user_id, action, entity, entity_id, summary) VALUES (?, 'removed packing entry', 'job', ?, ?)").run(userId ?? null, p.job_id, `${p.bags} bags`);
}

// lines for N bags of a ration Job (each item: qty per bag × N, at the Job's rate)
export function bagLines(db, job, n) {
  return perBag(db, job).map((l) => ({ item_id: l.item_id, description: l.description, qty: round2(l.per_bag * n), rate: l.sale_rate, tax_rate: l.tax_rate }));
}
// how many bags a new DC / invoice may carry
export function bagsAllowed(db, job, kind, { admin = false } = {}) {
  const st = rationStatus(db, job);
  if (kind === "dc") return round2((admin ? job.bags : st.packed) - st.delivered - docBags(db, job.id, "dc", ["draft"])); // drafts already claim their bags
  const draftDc = docBags(db, job.id, "dc", ["draft"]);
  const base = st.delivered > 0 || draftDc > 0 ? st.delivered : job.bags; // like item Jobs: bill what went out, or the whole order before any DC
  return round2(base - st.invoiced);
}

// for printing: one bag's contents from a ration document's lines
export function bagView(doc, lines) {
  if (!(doc.bags > 0) || doc.show_as === "items" || ["po", "bill", "vendor_credit"].includes(doc.kind)) return null;
  const contents = lines.map((l) => ({ ...l, per_bag: round2(l.qty / doc.bags), amount_per_bag: round2(l.amount / doc.bags) }));
  const net = round2(lines.reduce((s, l) => s + l.amount, 0));
  return { bags: doc.bags, kit_name: doc.kit_name || "Ration bag", rate_per_bag: round2(net / doc.bags), amount: net, contents, item_rates: doc.show_as !== "bags_total" };
}

// after a ration DC / invoice is edited by hand: count the bags again from its lines; if the lines no longer make
// whole bags of the same contents, show it item by item (the bag count is then what the lines fully cover)
export function syncBags(db, docId) {
  const d = db.prepare("SELECT * FROM documents WHERE id = ?").get(docId);
  if (!(d?.bags > 0) || !d.job_id || !["dc", "invoice"].includes(d.kind)) return;
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(d.job_id);
  if (!isRation(job)) return;
  const key = (x) => (x.item_id ? `i${x.item_id}` : `d${String(x.description || "").toLowerCase()}`);
  const per = new Map(perBag(db, job).map((l) => [key(l), l.per_bag]));
  const lines = db.prepare("SELECT * FROM document_lines WHERE document_id = ?").all(docId);
  const ratios = lines.map((l) => (per.get(key(l)) ? l.qty / per.get(key(l)) : null));
  const same = lines.length === per.size && ratios.every((r) => r !== null && Math.abs(r - ratios[0]) < 0.01);
  const coversAll = [...per.keys()].every((k) => lines.some((l) => key(l) === k));
  const bags = same ? round2(ratios[0]) : coversAll ? Math.floor(Math.min(...ratios.filter((r) => r !== null))) : 0;
  db.prepare("UPDATE documents SET bags = ?, show_as = ? WHERE id = ?").run(bags > 0 ? bags : null, same ? d.show_as : "items", docId);
}

// ---- delivery points: where the bags of one order go. Each DC is for one point and prints that point's address.
export function deliveryPoints(db, jobId) {
  return db.prepare(`SELECT p.*,
      (SELECT COALESCE(SUM(d.bags), 0) FROM documents d WHERE d.delivery_point_id = p.id AND d.kind = 'dc' AND d.status IN ('issued','signed')) AS sent,
      (SELECT COALESCE(SUM(d.bags), 0) FROM documents d WHERE d.delivery_point_id = p.id AND d.kind = 'dc' AND d.status = 'draft') AS drafted
    FROM job_delivery_points p WHERE p.job_id = ? ORDER BY p.id`).all(jobId)
    .map((p) => ({ ...p, sent: round2(p.sent), drafted: round2(p.drafted), left: p.bags ? round2(p.bags - p.sent - p.drafted) : null }));
}
export const pointLabel = (p) => [p.name, p.address, [p.contact, p.phone].filter(Boolean).join(" · ")].filter(Boolean).join("\n");

// replace the Job's list of points; a point that already has a DC stays (its details can still be corrected)
export function savePoints(db, userId, jobId, points) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  if (!job) throw httpError(404, "Job not found");
  const clean = (points || []).map((p) => ({ id: Number(p.id) || null, name: String(p.name || "").trim(), address: p.address || null, contact: p.contact || null, phone: p.phone || null, bags: Number(p.bags) > 0 ? round2(Number(p.bags)) : null }))
    .filter((p) => p.name || p.address);
  if (clean.some((p) => !p.name)) throw httpError(400, "Give every delivery point a name");
  const planned = round2(clean.reduce((s, p) => s + (p.bags || 0), 0));
  if (job.bags > 0 && planned > job.bags + 0.001) throw httpError(400, `The points add up to ${planned} bags, but the order is ${job.bags}`);
  const existing = deliveryPoints(db, jobId);
  return tx(db, () => {
    for (const e of existing) {
      const keep = clean.find((p) => p.id === e.id);
      const used = e.sent > 0 || e.drafted > 0;
      if (!keep && used) throw httpError(400, `${e.name} already has a delivery challan, so it can't be removed`);
      if (keep && keep.bags !== null && keep.bags < e.sent + e.drafted - 0.001) throw httpError(400, `${e.name} has already been sent ${e.sent + e.drafted} bags`);
      if (!keep) db.prepare("DELETE FROM job_delivery_points WHERE id = ?").run(e.id);
    }
    for (const p of clean) {
      if (p.id && existing.some((e) => e.id === p.id)) db.prepare("UPDATE job_delivery_points SET name=?, address=?, contact=?, phone=?, bags=? WHERE id=?").run(p.name, p.address, p.contact, p.phone, p.bags, p.id);
      else db.prepare("INSERT INTO job_delivery_points (job_id, name, address, contact, phone, bags) VALUES (?, ?, ?, ?, ?, ?)").run(jobId, p.name, p.address, p.contact, p.phone, p.bags);
    }
    // a draft DC follows the corrected address
    for (const e of deliveryPoints(db, jobId)) db.prepare("UPDATE documents SET deliver_to = ? WHERE delivery_point_id = ? AND status = 'draft'").run(pointLabel(e), e.id);
    db.prepare("INSERT INTO activity (user_id, action, entity, entity_id, summary) VALUES (?, 'set delivery points', 'job', ?, ?)").run(userId ?? null, jobId, clean.map((p) => `${p.name}${p.bags ? ` (${p.bags})` : ""}`).join(", "));
  });
}
