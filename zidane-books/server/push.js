// Phone / desktop push alerts for the installed app (Web Push). Every in-app notification is also pushed to
// each device the user switched alerts on for. Keys are made on first start and kept in the database.
import webpush from "web-push";
import { getSetting, httpError, setSetting } from "./books.js";
import { onNotify } from "./collab.js";

let ready = false;
export function vapidKeys(db) {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  let k = getSetting(db, "vapid");
  if (!k?.publicKey) { k = webpush.generateVAPIDKeys(); setSetting(db, "vapid", k); }
  return k;
}

// test hook: capture pushes instead of sending them
let fake = null;
export const usePushSender = (fn) => { fake = fn; };

export function startPush(db) {
  const k = vapidKeys(db);
  const contact = process.env.APP_URL || `mailto:${getSetting(db, "company")?.email || "admin@zidane.com.pk"}`;
  webpush.setVapidDetails(contact.startsWith("http") || contact.startsWith("mailto:") ? contact : `mailto:${contact}`, k.publicKey, k.privateKey);
  if (ready) return;
  ready = true;
  onNotify((db2, user, n) => {
    const subs = db2.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?").all(user.id);
    const payload = JSON.stringify({ title: n.title, body: n.body || "", link: n.link || "/", tag: `zb-${n.id}` });
    for (const s of subs) {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      Promise.resolve(fake ? fake(sub, payload) : webpush.sendNotification(sub, payload, { TTL: 86400 }))
        .then(() => db2.prepare("UPDATE push_subscriptions SET last_ok_at = datetime('now') WHERE id = ?").run(s.id))
        .catch((e) => {
          // the browser threw the subscription away (app uninstalled, alerts blocked): forget it
          if (e.statusCode === 404 || e.statusCode === 410) db2.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(s.id);
          else console.error("Push failed:", e.statusCode || "", e.message);
        });
    }
  });
}

export function subscribe(db, userId, sub, userAgent) {
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw httpError(400, "Invalid push subscription");
  db.prepare(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`)
    .run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, String(userAgent || "").slice(0, 200));
}
export const unsubscribe = (db, userId, endpoint) => db.prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?").run(userId, endpoint);
export const devices = (db, userId) => db.prepare("SELECT id, user_agent, created_at, last_ok_at FROM push_subscriptions WHERE user_id = ? ORDER BY id DESC").all(userId);
