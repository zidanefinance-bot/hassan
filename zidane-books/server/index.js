import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { ensureAdmin } from "./seed.js";

const db = openDb();
ensureAdmin(db);
const app = createApp(db);

// production: serve the built frontend from dist/
const dist = join(import.meta.dirname, "..", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, "index.html")));
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`Zidane Books API on http://localhost:${port}`));
