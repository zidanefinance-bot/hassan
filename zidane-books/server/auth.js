// Password hashing (scrypt), cookie sessions and role permissions.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
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

// What each role may do. Everyone signed in can see the dashboard and read items.
export const ROLES = {
  admin: ["sales", "purchases", "items:write", "expenses", "reports", "admin"],
  accountant: ["sales", "purchases", "items:write", "expenses", "reports"],
  sales: ["sales"],
};
export const can = (user, perm) => Boolean(user && ROLES[user.role]?.includes(perm));

export function authMiddleware(db) {
  return (req, _res, next) => {
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
