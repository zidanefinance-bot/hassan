// First-run admin account, plus optional demo data: `npm run seed` (adds sample items, contacts and documents).
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { openDb } from "./db.js";
import { hashPassword } from "./auth.js";
import * as B from "./books.js";

export function ensureAdmin(db) {
  if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0) return null;
  const email = process.env.ADMIN_EMAIL || "admin@zidane.com.pk";
  const password = process.env.ADMIN_PASSWORD || randomBytes(6).toString("base64url");
  db.prepare("INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, 'admin', ?)").run("Admin", email, hashPassword(password));
  console.log(`\n  First admin account created\n  email:    ${email}\n  password: ${password}\n  (change it after signing in)\n`);
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

  const bill = B.saveDocument(db, admin, { kind: "bill", contact_id: sup[0], date: d(-40), due_date: d(-10), status: "open", lines: [buy(0, 100), buy(1, 100)] });
  B.recordPayment(db, admin, { direction: "out", document_id: bill, amount: 179000, date: d(-12), mode: "bank" });
  B.saveDocument(db, admin, { kind: "bill", contact_id: sup[2], date: d(-8), due_date: d(7), status: "open", lines: [buy(4, 40), buy(5, 120)] });
  const inv1 = B.saveDocument(db, admin, { kind: "invoice", contact_id: cust[0], date: d(-35), due_date: d(-20), status: "open", lines: [line(0, 40), line(2, 20), line(3, 100), line(4, 10)] });
  B.recordPayment(db, admin, { direction: "in", document_id: inv1, amount: 50000, date: d(-18), mode: "bank" });
  const inv2 = B.saveDocument(db, admin, { kind: "invoice", contact_id: cust[1], date: d(-15), due_date: d(0), status: "open", lines: [line(1, 30), line(6, 25), line(8, 10), line(9, 20)] });
  B.recordPayment(db, admin, { direction: "in", document_id: inv2, amount: B.round2(db.prepare("SELECT total FROM documents WHERE id = ?").get(inv2).total), date: d(-5), mode: "cheque" });
  B.saveDocument(db, admin, { kind: "invoice", contact_id: cust[2], date: d(-3), due_date: d(12), status: "open", lines: [line(1, 50), line(3, 50), line(10, 50), line(11, 50)] });
  B.saveDocument(db, admin, { kind: "quote", contact_id: cust[2], date: d(-1), status: "sent", notes: "Ramadan ration bags, 500 households", lines: [line(1, 500), line(6, 500), line(3, 500), line(10, 500), line(11, 500)] });
  B.saveDocument(db, admin, { kind: "po", contact_id: sup[1], date: d(-2), status: "issued", lines: [buy(2, 60)] });
  for (const [cat, amt, off] of [["Rent", 85000, -30], ["Salaries", 240000, -28], ["Fuel & Transport", 38500, -20], ["Packaging", 22000, -10], ["Utilities", 18400, -6], ["Loading & Labour", 15000, -2]]) {
    db.prepare("INSERT INTO expenses (date, category, amount, paid_through, created_by) VALUES (?, ?, ?, 'bank', ?)").run(d(off), cat, amt, admin);
  }
  console.log("Demo data added: 12 items, 6 contacts, invoices, bills, a quote, a PO and expenses.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = openDb();
  ensureAdmin(db);
  seedDemo(db);
}
