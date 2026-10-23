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
  description TEXT, qty REAL NOT NULL, rate REAL NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 0
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
  const lines = db.prepare(`SELECT ki.*, i.name AS item_name, i.unit, i.purchase_rate, i.stock_qty FROM kit_items ki LEFT JOIN items i ON i.id = ki.item_id WHERE ki.kit_id = ? ORDER BY ki.id`).all(id);
  const price = round2(lines.reduce((s, l) => s + l.qty * l.rate, 0));
  const cost = round2(lines.reduce((s, l) => s + l.qty * (l.purchase_rate || 0), 0));
  return { ...k, lines, price_per_bag: price, cost_per_bag: cost, margin_per_bag: round2(price - cost), margin_pct: price ? round2(((price - cost) / price) * 100) : 0 };
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
    const ins = db.prepare("INSERT INTO kit_items (kit_id, item_id, description, qty, rate, tax_rate) VALUES (?, ?, ?, ?, ?, ?)");
    for (const l of lines) ins.run(id, Number(l.item_id) || null, l.description || null, Number(l.qty), round2(Number(l.rate) || 0), Number(l.tax_rate) || 0);
    return id;
  });
}

// mark a document as a ration document: shown as bags unless show_as = 'items'
export function markBags(db, docId, bags, kitName, showAs = "bags") {
  db.prepare("UPDATE documents SET bags = ?, kit_name = ?, show_as = ? WHERE id = ?").run(bags ? round2(bags) : null, kitName || null, showAs === "items" ? "items" : "bags", docId);
}

// a quotation for N bags from a kit: the lines hold the full quantities, the PDF shows one bag and × N
export function quoteFromKit(db, userId, kitId, { contact_id, bags, date, notes, terms, reference } = {}) {
  const k = kitDetail(db, kitId);
  const n = Number(bags);
  if (!contact_id) throw httpError(400, "Pick the customer");
  if (!(n > 0)) throw httpError(400, "How many bags?");
  const lines = k.lines.map((l) => ({ item_id: l.item_id, description: l.item_id ? null : l.description, qty: round2(l.qty * n), rate: l.rate, tax_rate: l.tax_rate }));
  const id = saveDocument(db, userId, { kind: "quote", contact_id, status: "draft", date: date || today(), notes: notes ?? k.notes, terms, reference, lines });
  markBags(db, id, n, k.name);
  return id;
}

// ---- a ration Job: bags ordered, packed, delivered, invoiced; what one bag holds
export const isRation = (job) => Boolean(job && job.bags > 0);
export function perBag(db, job) {
  return db.prepare("SELECT ji.*, COALESCE(i.name, ji.description) AS name, i.unit FROM job_items ji LEFT JOIN items i ON i.id = ji.item_id WHERE ji.job_id = ? ORDER BY ji.id").all(job.id)
    .map((ji) => ({ ...ji, per_bag: round2(ji.qty / job.bags) }));
}
const docBags = (db, jobId, kind, statuses) => round2(db.prepare(`SELECT COALESCE(SUM(bags), 0) AS b FROM documents WHERE job_id = ? AND kind = ? AND status IN (${statuses.map(() => "?").join(",")})`).get(jobId, kind, ...statuses).b);

export function rationStatus(db, job) {
  if (!isRation(job)) return null;
  const packed = round2(db.prepare("SELECT COALESCE(SUM(bags), 0) AS b FROM job_packing WHERE job_id = ?").get(job.id).b);
  const delivered = docBags(db, job.id, "dc", ["issued", "signed"]);
  const invoiced = docBags(db, job.id, "invoice", ["open", "draft"]);
  const contents = perBag(db, job);
  const pricePerBag = round2(contents.reduce((s, l) => s + l.per_bag * l.sale_rate, 0));
  const packing = db.prepare("SELECT p.*, u.name AS by_name FROM job_packing p LEFT JOIN users u ON u.id = p.created_by WHERE job_id = ? ORDER BY date, id").all(job.id);
  return { bags: job.bags, kit_name: job.kit_name, packed, delivered, invoiced, to_pack: round2(job.bags - packed), ready_to_send: round2(packed - delivered), price_per_bag: pricePerBag, contents, packing };
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
  if (kind === "dc") return round2((admin ? job.bags : st.packed) - st.delivered);
  const draftDc = docBags(db, job.id, "dc", ["draft"]);
  const base = st.delivered > 0 || draftDc > 0 ? st.delivered : job.bags; // like item Jobs: bill what went out, or the whole order before any DC
  return round2(base - st.invoiced);
}

// for printing: one bag's contents from a ration document's lines
export function bagView(doc, lines) {
  if (!(doc.bags > 0) || doc.show_as === "items" || ["po", "bill", "vendor_credit"].includes(doc.kind)) return null;
  const contents = lines.map((l) => ({ ...l, per_bag: round2(l.qty / doc.bags), amount_per_bag: round2(l.amount / doc.bags) }));
  const net = round2(lines.reduce((s, l) => s + l.amount, 0));
  return { bags: doc.bags, kit_name: doc.kit_name || "Ration bag", rate_per_bag: round2(net / doc.bags), amount: net, contents };
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
