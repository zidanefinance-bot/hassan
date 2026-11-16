import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { ensureAdmin } from "./seed.js";
import { linkDcToInvoices } from "./books.js";
import { startMailPoller } from "./inbox.js";
import { startMorningBrief } from "./digest.js";
import { startPdcReminders } from "./pdc.js";
import { startLoanReminders } from "./loans.js";
import { startTelegram } from "./telegram.js";
import { startPush } from "./push.js";

const db = openDb();
ensureAdmin(db);
// DCs issued after their Job's invoice, from before this was automatic: join them to it
for (const { id } of db.prepare("SELECT id FROM documents WHERE kind = 'dc' AND status IN ('issued','signed') AND job_id IS NOT NULL ORDER BY date, id").all()) linkDcToInvoices(db, id);
const uploadDir = process.env.UPLOAD_DIR || join(dirname(process.env.DB_FILE || "data/zidane-books.db"), "uploads");
const app = createApp(db, { uploadDir });
if (startMailPoller(db, uploadDir)) console.log("Orders inbox: checking email every few minutes");
startMorningBrief(db); // the director's email every morning (Settings → Morning brief)
startPdcReminders(db); // post-dated cheques: every other day from 7 days before their date
startLoanReminders(db); // loan installments: 7, 3, 1 days before and on the day
if (startTelegram(db, uploadDir)) console.log("Telegram bot: on");
startPush(db);

// production: serve the built frontend from dist/
const dist = join(import.meta.dirname, "..", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, "index.html")));
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`Zidane Books API on http://localhost:${port}`));
