// "Start fresh": removes the business records (Jobs, documents, payments, stock, inbox …) so real entries can begin.
// Kept: users and their logins, settings (company, taxes, categories …) and, if asked, customers/suppliers and items.
// A full copy of the database is saved first, so nothing is lost for good.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tx } from "./db.js";
import { httpError, log, setSetting } from "./books.js";

const RECORDS = ["payment_allocations", "refunds", "payments", "document_lines", "stock_moves", "attachments", "expenses", "comments", "notifications",
  "email_log", "inbox_files", "inbox_messages", "item_aliases", "documents", "job_items", "jobs", "activity"];

export function startFresh(db, userId, { confirm, keepContacts = false, keepItems = false } = {}, file = process.env.DB_FILE || "data/zidane-books.db") {
  if (confirm !== "DELETE") throw httpError(400, 'Type DELETE to confirm');
  let backup = null;
  if (file !== ":memory:") {
    const dir = join(dirname(file), "backups");
    mkdirSync(dir, { recursive: true });
    backup = join(dir, `before-start-fresh-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
    db.prepare("VACUUM INTO ?").run(backup);
  }
  const removed = {};
  tx(db, () => {
    db.prepare("UPDATE documents SET source_id = NULL").run();
    for (const t of RECORDS) removed[t] = Number(db.prepare(`DELETE FROM ${t}`).run().changes);
    if (keepItems) db.prepare("UPDATE items SET stock_qty = 0").run(); // stock came from the moves just removed
    else removed.items = Number(db.prepare("DELETE FROM items").run().changes);
    if (!keepContacts) removed.contacts = Number(db.prepare("DELETE FROM contacts").run().changes);
    const next = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'nextNumbers'").get().value);
    setSetting(db, "nextNumbers", Object.fromEntries(Object.keys(next).map((k) => [k, 1])));
    db.prepare("DELETE FROM settings WHERE key = 'lastDailyAlerts'").run();
    log(db, userId, "started fresh", "settings", null, `all records removed${keepContacts ? ", contacts kept" : ""}${keepItems ? ", items kept" : ""}${backup ? `; backup ${backup}` : ""}`);
  });
  return { backup, removed };
}
