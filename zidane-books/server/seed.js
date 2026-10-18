// First-run admin account, plus optional demo data: `npm run seed` (adds sample items, contacts and documents).
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { openDb } from "./db.js";
import { hashPassword } from "./auth.js";
import * as B from "./books.js";
import * as J from "./jobs.js";

export function ensureAdmin(db) {
  if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0) return null;
  const email = process.env.ADMIN_EMAIL || "admin@zidane.com.pk";
  const password = process.env.ADMIN_PASSWORD || randomBytes(6).toString("base64url");
  db.prepare("INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, 'director', ?)").run("Director", email, hashPassword(password));
  // only print a password we generated; one passed in through ADMIN_PASSWORD never goes to the logs
  console.log(`\n  First director account created\n  email:    ${email}\n  password: ${process.env.ADMIN_PASSWORD ? "(the ADMIN_PASSWORD you set)" : password}\n  (change it after signing in)\n`);
  return { email, password };
}

// Sample data only: names and rates are illustrative, not real prices.
const ITEMS = [
  ["Super Fine Atta 10kg", "ATTA-10", "bag", "Atta & Flour", 1180, 1290, 0, 120],
  ["Super Fine Atta 5kg", "ATTA-05", "bag", "Atta & Flour", 610, 670, 0, 200],
  ["Basmati Rice 5kg", "RICE-05", "bag", "Rice", 1650, 1840, 0, 80],
  ["Sugar Danedar 1kg", "SUG-01", "kg", "Sugar", 142, 155, 0, 400],
  ["Cooking Oil 5L", "OIL-05", "tin", "Oil & Ghee", 2650, 2890, 18, 60],
  ["Cooking Oil 1L Pouch", "OIL-01", "pouch", "Oil & Ghee", 560, 615, 18, 300],
  ["Daal Chana 1kg", "DAAL-CH", "kg", "Pulses", 285, 320, 0, 150],
  ["Daal Moong 1kg", "DAAL-MG", "kg", "Pulses", 330, 370, 0, 150],
  ["Tapal Danedar 430g", "TEA-430", "pack", "Tea & Coffee", 1180, 1290, 18, 90],
  ["Red Chilli Powder 100g", "SPC-RC", "pack", "Spices", 120, 140, 18, 250],
  ["Dates 500g", "DATE-500", "pack", "Essentials", 560, 640, 0, 100],
  ["Rooh Afza 800ml", "RA-800", "bottle", "Essentials", 480, 540, 18, 80],
];
const CUSTOMERS = [["Al-Noor Textile Mills", "Procurement Dept", "021 3500 0001"], ["Crescent Hospital Kitchen", "Admin", "021 3500 0002"], ["Helping Hands Welfare Trust", "Program Office", "0300 000 0003"]];
const SUPPLIERS = [["Karachi Flour Mills", "Sales", "021 3600 0001"], ["Metro Rice Traders", "Owner", "021 3600 0002"], ["Edible Oil Distributors", "Accounts", "021 3600 0003"]];

export function seedDemo(db) {
  if (db.prepare("SELECT COUNT(*) AS n FROM items").get().n > 0) return console.log("Items already exist; demo data skipped.");
  const admin = db.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get()?.id;
  const itemIds = ITEMS.map(([name, sku, unit, cat, pr, sr, tax, stock]) => {
    const id = Number(db.prepare("INSERT INTO items (name, sku, unit, category, purchase_rate, sale_rate, tax_rate, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(name, sku, unit, cat, pr, sr, tax, Math.round(stock / 5)).lastInsertRowid);
    B.adjustStock(db, admin, id, stock, "opening stock");
    return id;
  });
  const add = (type, [name, company, phone]) => Number(db.prepare("INSERT INTO contacts (type, name, company, phone) VALUES (?, ?, ?, ?)").run(type, name, company, phone).lastInsertRowid);
  const cust = CUSTOMERS.map((c) => add("customer", c));
  const sup = SUPPLIERS.map((c) => add("supplier", c));
  const d = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
  const line = (i, qty) => ({ item_id: itemIds[i], qty, rate: ITEMS[i][5], tax_rate: ITEMS[i][6] });
  const buy = (i, qty) => ({ item_id: itemIds[i], qty, rate: ITEMS[i][4], tax_rate: ITEMS[i][6] });

  // one demo login per role (password: DEMO_PASSWORD or demo1234)
  const pw = hashPassword(process.env.DEMO_PASSWORD || "demo1234");
  for (const [name, role] of [["Sana (Sales)", "sales"], ["Kashif (Operations)", "operations"], ["Bilal (Purchaser)", "purchaser"], ["Ayesha (Accounts)", "accounts"]]) {
    db.prepare("INSERT OR IGNORE INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)").run(name, `${role}@zidane.com.pk`, role, pw);
  }
  const user = (role) => db.prepare("SELECT id FROM users WHERE role = ?").get(role).id;
  const [sales, ops, acc] = [user("sales"), user("operations"), user("accounts")];

  // Sales pipeline: an enquiry still missing rates, and a quote out with the customer
  B.saveDocument(db, sales, { kind: "quote", contact_id: cust[2], date: d(0), status: "enquiry", notes: "Ramadan ration bags, 500 households. Rates pending.", lines: [{ item_id: itemIds[1], qty: 500, rate: 0 }, { item_id: itemIds[3], qty: 500, rate: 0 }, { item_id: itemIds[10], qty: 500, rate: 0 }] });
  B.saveDocument(db, sales, { kind: "quote", contact_id: cust[1], date: d(-2), status: "sent", lines: [line(1, 30), line(6, 25), line(8, 10)] });

  // JOB 1: fully through the flow. Quote → Job → bought → ready → DC signed → invoice → part paid
  const q1 = B.saveDocument(db, sales, { kind: "quote", contact_id: cust[0], date: d(-20), status: "accepted", lines: [line(0, 40), line(2, 20), line(4, 10)] });
  const job1 = J.jobFromQuote(db, sales, q1, { customer_po_number: "ANT-PO-4471", customer_po_date: d(-19), required_date: d(-14), delivery_location: "Al-Noor Mills, Korangi Industrial Area", priority: "high" });
  const b1 = B.saveDocument(db, ops, { kind: "bill", contact_id: sup[0], job_id: job1, date: d(-16), due_date: d(5), status: "open", reference: "KFM-8812", lines: [buy(0, 40), buy(2, 20)] });
  for (const ji of db.prepare("SELECT id, item_id FROM job_items WHERE job_id = ?").all(job1)) J.setItemProcurement(db, ops, ji.id, ji.item_id === itemIds[4] ? "from_stock" : "bought");
  db.prepare("INSERT INTO expenses (date, category, amount, paid_through, job_id, created_by) VALUES (?, 'Freight', 6500, 'cash', ?, ?)").run(d(-15), job1, ops);
  J.setOpsStatus(db, ops, job1, "material_ready");
  const dc1 = J.dcFromJob(db, sales, job1);
  B.setStatus(db, sales, dc1, "issued");
  J.signDc(db, sales, dc1, { name: "Store Incharge, Al-Noor", date: d(-13) });
  const inv1 = J.invoiceFromJob(db, sales, job1);
  B.setStatus(db, sales, inv1, "open");
  db.prepare("UPDATE documents SET date = ?, due_date = ?, submitted_date = ?, verified_at = datetime('now'), verified_by = ? WHERE id = ?").run(d(-13), d(-1), d(-12), acc, inv1);
  db.prepare("UPDATE documents SET verified_at = datetime('now'), verified_by = ? WHERE id = ?").run(acc, b1);
  B.recordPayment(db, acc, { direction: "in", document_id: inv1, amount: 60000, date: d(-4), mode: "bank", reference: "Meezan IBFT" });

  // JOB 2: just handed to Operations
  J.createJob(db, sales, { customer_id: cust[1], required_date: d(3), delivery_location: "Crescent Hospital, main kitchen store", items: [{ item_id: itemIds[1], qty: 30, sale_rate: ITEMS[1][5] }, { item_id: itemIds[6], qty: 25, sale_rate: ITEMS[6][5] }, { item_id: itemIds[9], qty: 40, sale_rate: ITEMS[9][5], tax_rate: 18 }] });

  // JOB 3: half bought, due tomorrow, direct delivery from supplier
  const job3 = J.createJob(db, sales, { customer_id: cust[2], required_date: d(1), priority: "urgent", fulfilment_type: "direct", delivery_location: "Helping Hands Trust, Lyari distribution point", items: [{ item_id: itemIds[3], qty: 200, sale_rate: ITEMS[3][5] }, { item_id: itemIds[7], qty: 100, sale_rate: ITEMS[7][5] }] });
  J.setOpsStatus(db, ops, job3, "procurement_started");
  const ji3 = db.prepare("SELECT id FROM job_items WHERE job_id = ? ORDER BY id LIMIT 1").get(job3).id;
  J.setItemProcurement(db, ops, ji3, "bought");
  B.saveDocument(db, ops, { kind: "bill", contact_id: sup[1], job_id: job3, date: d(0), due_date: d(30), status: "open", reference: "MRT-221", lines: [buy(3, 200)] });

  // general stock purchase (not for a Job) and its payment
  const bill = B.saveDocument(db, ops, { kind: "bill", contact_id: sup[2], date: d(-30), due_date: d(-5), status: "open", lines: [buy(4, 40), buy(5, 120)] });
  B.recordPayment(db, acc, { direction: "out", document_id: bill, amount: 100000, date: d(-6), mode: "bank" });
  B.saveDocument(db, ops, { kind: "po", contact_id: sup[1], date: d(-1), status: "issued", lines: [buy(2, 60)] });

  // advances: the NGO paid ahead for Ramadan bags; we paid the oil distributor ahead to lock a rate
  B.recordPayment(db, acc, { direction: "in", contact_id: cust[2], amount: 50000, date: d(-2), mode: "bank", reference: "Advance for Ramadan bags" });
  B.recordPayment(db, acc, { direction: "out", contact_id: sup[2], amount: 30000, date: d(-3), mode: "bank", reference: "Advance, rate lock" });
  for (const [cat, amt, off] of [["Rent", 85000, -30], ["Salaries", 240000, -28], ["Fuel & Transport", 38500, -20], ["Packaging", 22000, -10], ["Utilities", 18400, -6], ["Loading & Labour", 15000, -2]]) {
    db.prepare("INSERT INTO expenses (date, category, amount, paid_through, created_by) VALUES (?, ?, ?, 'bank', ?)").run(d(off), cat, amt, admin);
  }
  console.log(`Demo data added: 12 items, 6 contacts, 3 Jobs at different stages, quotes, bills and expenses.\nDemo logins (password ${process.env.DEMO_PASSWORD || "demo1234"}): sales@, operations@, purchaser@, accounts@zidane.com.pk`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = openDb();
  ensureAdmin(db);
  seedDemo(db);
}
