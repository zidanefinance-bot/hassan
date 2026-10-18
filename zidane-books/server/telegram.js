// Telegram: each user can link their Telegram to get their notifications on the phone, and send a bill photo or a
// customer's order message to the bot, which drops it into the Orders Inbox for AI to read.
// Needs TELEGRAM_BOT_TOKEN (from @BotFather). Uses long polling, so no webhook or extra nginx setup is needed.
import { randomBytes } from "node:crypto";
import { can } from "./auth.js";
import { onNotify } from "./collab.js";
import { addMessage, canUseInbox, enqueue } from "./inbox.js";

const token = () => process.env.TELEGRAM_BOT_TOKEN;
export const telegramReady = () => Boolean(token());
const apiUrl = (method) => `https://api.telegram.org/bot${token()}/${method}`;

async function tg(method, body) {
  const r = await fetch(apiUrl(method), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || `Telegram ${method} failed`);
  return j.result;
}

let botName = null;
export async function botUsername() {
  if (!botName && telegramReady()) botName = (await tg("getMe")).username;
  return botName;
}

// a one-time code the user sends to the bot as /start CODE
export async function linkCode(db, userId) {
  const code = randomBytes(9).toString("base64url");
  db.prepare("INSERT INTO user_telegram (user_id, link_code) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET link_code = excluded.link_code").run(userId, code);
  const name = await botUsername();
  return { code, url: name ? `https://t.me/${name}?start=${code}` : null, bot: name };
}
export const telegramStatus = (db, userId) => {
  const r = db.prepare("SELECT chat_id, linked_at FROM user_telegram WHERE user_id = ?").get(userId);
  return { ready: telegramReady(), linked: Boolean(r?.chat_id), linked_at: r?.linked_at || null };
};
export const unlink = (db, userId) => db.prepare("UPDATE user_telegram SET chat_id = NULL, link_code = NULL, linked_at = NULL WHERE user_id = ?").run(userId);

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const appLink = (link) => (process.env.APP_URL && link ? `${process.env.APP_URL.replace(/\/$/, "")}${link}` : null);

export function startTelegram(db, uploadDir, log = console) {
  if (!telegramReady()) return false;
  // every in-app notification also goes to the user's linked Telegram
  onNotify((db2, user, n) => {
    const chat = db2.prepare("SELECT chat_id FROM user_telegram WHERE user_id = ? AND chat_id IS NOT NULL").get(user.id)?.chat_id;
    if (!chat) return;
    const url = appLink(n.link);
    tg("sendMessage", { chat_id: chat, parse_mode: "HTML", disable_web_page_preview: true, text: `🔔 <b>${esc(n.title)}</b>${n.body ? `\n${esc(n.body)}` : ""}${url ? `\n<a href="${url}">Open</a>` : ""}` }).catch((e) => log.error("Telegram send failed:", e.message));
  });

  let offset = 0;
  const loop = async () => {
    for (;;) {
      try {
        const updates = await tg("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] });
        for (const u of updates) { offset = u.update_id + 1; await handle(db, uploadDir, u.message).catch((e) => log.error("Telegram message failed:", e.message)); }
      } catch (e) {
        log.error("Telegram polling:", e.message);
        await new Promise((r) => setTimeout(r, 15000));
      }
    }
  };
  loop();
  return true;
}

const reply = (msg, text) => tg("sendMessage", { chat_id: msg.chat.id, text, reply_to_message_id: msg.message_id }).catch(() => {});

async function download(fileId) {
  const f = await tg("getFile", { file_id: fileId });
  const r = await fetch(`https://api.telegram.org/file/bot${token()}/${f.file_path}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function handle(db, uploadDir, msg) {
  if (!msg?.chat || msg.chat.type !== "private") return;
  const text = msg.text || msg.caption || "";
  const start = text.match(/^\/start\s+(\S+)/);
  if (start) {
    const row = db.prepare("SELECT user_id FROM user_telegram WHERE link_code = ?").get(start[1]);
    if (!row) return reply(msg, "This link has expired. Open Zidane Books → Settings → Telegram and try again.");
    db.prepare("UPDATE user_telegram SET chat_id = ?, link_code = NULL, linked_at = datetime('now') WHERE user_id = ?").run(String(msg.chat.id), row.user_id);
    const u = db.prepare("SELECT name FROM users WHERE id = ?").get(row.user_id);
    return reply(msg, `Salaam ${u.name}! Telegram is linked. Your Zidane Books alerts will come here.\n\nYou can also send me a supplier bill photo or a customer's order message and I'll put it in the Orders Inbox.`);
  }
  const link = db.prepare("SELECT u.* FROM user_telegram t JOIN users u ON u.id = t.user_id WHERE t.chat_id = ? AND u.active = 1").get(String(msg.chat.id));
  if (!link) return reply(msg, "Hi! I only work for the Zidane Books team. Link your account from Settings → Telegram in the app.");
  if (/^\/(help|start)/.test(text)) return reply(msg, "Send a supplier bill photo/PDF or forward a customer's order and I'll add it to the Orders Inbox for AI to read. Alerts from the app arrive here automatically.");
  if (!canUseInbox(link)) return reply(msg, "Your role can't add orders or bills. Your alerts still arrive here.");

  const files = [];
  const photo = msg.photo?.at(-1); // largest size
  if (photo) files.push({ filename: `telegram-${msg.message_id}.jpg`, mime: "image/jpeg", buffer: await download(photo.file_id) });
  if (msg.document && /^(image\/|application\/pdf)/.test(msg.document.mime_type || "")) files.push({ filename: msg.document.file_name || "file", mime: msg.document.mime_type, buffer: await download(msg.document.file_id) });
  if (!files.length && text.trim().length < 10) return reply(msg, "Send a photo of the bill, a PDF, or paste the order message.");
  const id = addMessage(db, uploadDir, { source: "telegram", message_id: `tg-${msg.chat.id}-${msg.message_id}`, from_addr: `${link.name} (Telegram)`, subject: msg.caption || null, body_text: text, files, created_by: link.id });
  if (!id) return;
  enqueue(db, uploadDir, id);
  reply(msg, `Got it ✓ Added to the Orders Inbox${can(link, "admin") || can(link, "buy") || can(link, "sales.write") ? ". I'll tell you when AI has read it." : "."}`);
}
