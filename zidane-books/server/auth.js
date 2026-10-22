// Password hashing (scrypt), cookie sessions and role permissions.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { httpError } from "./books.js";

export function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex"), b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

const SESSION_DAYS = 14;
export function createSession(db, userId) {
  const token = randomBytes(32).toString("hex");
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, exp);
  return { token, maxAge: SESSION_DAYS * 864e5 };
}

// What each role may do. The blueprint's rule: Sales owns the customer side, Operations owns fulfilment and cost,
// Accounts owns money, Directors see everything. Every API route checks these on the server.
//   sales.read/write   customers, enquiries, quotes, Jobs (create), customer DCs, invoices
//   ops.read/write     suppliers, purchase orders, supplier bills, Job fulfilment, job expenses
//   buy                record purchases/bills and procurement progress (Field Purchaser)
//   money              receive customer payments, pay suppliers
//   verify             verify invoices and supplier bills
//   price.view / cost.view / profit.view   see selling rates / purchase costs / margins
export const ROLES = {
  director: ["sales.read", "sales.write", "ops.read", "ops.write", "buy", "money", "verify", "expenses", "items.write", "price.view", "cost.view", "profit.view", "reports.finance", "admin"],
  sales: ["sales.read", "sales.write", "price.view"],
  operations: ["ops.read", "ops.write", "buy", "items.write", "cost.view"],
  purchaser: ["ops.read", "buy", "cost.view"],
  accounts: ["sales.read", "ops.read", "money", "verify", "expenses", "items.write", "price.view", "cost.view", "profit.view", "reports.finance"],
};
export const ROLE_LABELS = { director: "Director", sales: "Sales", operations: "Operations", purchaser: "Field Purchaser", accounts: "Accounts" };
export const can = (user, perm) => Boolean(user && ROLES[user.role]?.includes(perm));

// Personal API keys (for an assistant bot such as OpenClaw). Only work while a director has switched them on in Settings,
// act as the key's owner with that person's role, and are limited to reading and drafting (see API_ALLOWED in app.js).
export const hashKey = (key) => createHash("sha256").update(key).digest("hex");
export function createApiKey(db, userId, name) {
  const prefix = randomBytes(4).toString("hex");
  const key = `zb_${prefix}_${randomBytes(24).toString("base64url")}`;
  db.prepare("INSERT INTO api_keys (user_id, name, prefix, key_hash) VALUES (?, ?, ?, ?)").run(userId, String(name || "API key").slice(0, 60), prefix, hashKey(key));
  return key;
}
// The in-app assistant (assistant.js) calls the API as the signed-in user with a short-lived token, under the same
// read-and-draft limits as an API key. Tokens live in memory only.
const assistantTokens = new Map();
export function issueAssistantToken(user, minutes = 10) {
  const token = randomBytes(24).toString("hex");
  assistantTokens.set(token, { user, exp: Date.now() + minutes * 60e3 });
  return token;
}
export const revokeAssistantToken = (token) => assistantTokens.delete(token);
setInterval(() => { for (const [k, t] of assistantTokens) if (t.exp < Date.now()) assistantTokens.delete(k); }, 15 * 60e3).unref();

const apiKeysOn = (db) => JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'apiKeysEnabled'").get()?.value || "false") === true;

export function authMiddleware(db) {
  return (req, _res, next) => {
    const helper = req.headers["x-zb-assistant"];
    if (helper) {
      const t = assistantTokens.get(String(helper));
      const row = t && t.exp > Date.now() && db.prepare("SELECT id, name, email, role, active FROM users WHERE id = ?").get(t.user.id);
      if (row?.active) {
        req.user = { id: row.id, name: row.name, email: row.email, role: row.role };
        req.viaApi = "assistant";
      }
      return next();
    }
    const bearer = req.headers.authorization?.match(/^Bearer (zb_[a-f0-9]{8}_[\w-]+)$/)?.[1];
    if (bearer) {
      if (!apiKeysOn(db)) return next();
      const row = db.prepare("SELECT k.id AS key_id, u.id, u.name, u.email, u.role, u.active FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.key_hash = ? AND k.revoked_at IS NULL").get(hashKey(bearer));
      if (row?.active) {
        req.user = { id: row.id, name: row.name, email: row.email, role: row.role };
        req.viaApi = row.key_id;
        db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(row.key_id);
      }
      return next();
    }
    const token = req.cookies?.zb_session;
    if (token) {
      const row = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.active, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
      if (row && row.active && row.expires_at > new Date().toISOString()) req.user = { id: row.id, name: row.name, email: row.email, role: row.role };
    }
    next();
  };
}

export const requireUser = (req, _res, next) => (req.user ? next() : next(httpError(401, "Please sign in")));
export const requirePerm = (perm) => (req, _res, next) => (can(req.user, perm) ? next() : next(httpError(403, "You don't have access to this")));
