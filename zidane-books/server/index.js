import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { ensureAdmin } from "./seed.js";
import { startMailPoller } from "./inbox.js";
import { startTelegram } from "./telegram.js";

const db = openDb();
ensureAdmin(db);
const uploadDir = process.env.UPLOAD_DIR || join(dirname(process.env.DB_FILE || "data/zidane-books.db"), "uploads");
const app = createApp(db, { uploadDir });
if (startMailPoller(db, uploadDir)) console.log("Orders inbox: checking email every few minutes");
if (startTelegram(db, uploadDir)) console.log("Telegram bot: on");

// production: serve the built frontend from dist/
const dist = join(import.meta.dirname, "..", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, "index.html")));
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`Zidane Books API on http://localhost:${port}`));
