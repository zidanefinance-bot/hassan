import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { ensureAdmin, seedDemo } from "./seed.js";
import { issueAssistantToken } from "./auth.js";
import * as AS from "./assistant.js";

const serve = (db) => {
  const server = createApp(db).listen(0);
  return { server, base: `http://127.0.0.1:${server.address().port}` };
};
const userByEmail = (db, email) => db.prepare("SELECT id, name, email, role FROM users WHERE email = ?").get(email);

test("assistant token: acts as its user, can read and save drafts, nothing more", async () => {
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const { server, base } = serve(db);
  const sales = userByEmail(db, "sales@zidane.com.pk");
  const token = issueAssistantToken(sales);
  const call = (path, { method = "GET", body } = {}) => fetch(`${base}/api${path}`, { method, headers: { "x-zb-assistant": token, "content-type": "application/json" }, body: body && JSON.stringify(body) });
  try {
    assert.equal((await call("/documents?kind=invoice")).status, 200, "reads what Sales can read");
    assert.equal((await call("/documents?kind=bill")).status, 403, "still limited by the role");
    assert.equal((await (await call("/items")).json())[0].purchase_rate, undefined, "no purchase cost for Sales");
    const cust = db.prepare("SELECT id FROM contacts WHERE type = 'customer' LIMIT 1").get().id;
    const item = db.prepare("SELECT id FROM items LIMIT 1").get().id;
    const lines = [{ item_id: item, qty: 2, rate: 100 }];
    assert.equal((await call("/documents", { method: "POST", body: { kind: "invoice", status: "open", contact_id: cust, lines } })).status, 403, "can't issue");
    const draft = await call("/documents", { method: "POST", body: { kind: "quote", status: "draft", contact_id: cust, lines } });
    assert.equal(draft.status, 200, "can save a draft");
    const { id } = await draft.json();
    assert.equal((await call(`/documents/${id}/status`, { method: "POST", body: { status: "sent" } })).status, 403, "can't change status");
    assert.equal((await call(`/documents/${id}`, { method: "DELETE" })).status, 403, "can't delete");
    assert.equal((await call("/payments", { method: "POST", body: { direction: "in", contact_id: cust, amount: 5 } })).status, 403, "no money");
    assert.equal((await call("/assistant/chat", { method: "POST", body: { text: "hi" } })).status, 403, "can't call itself");
    assert.equal((await call("/api-keys")).status, 403, "no key management");
    assert.equal((await fetch(`${base}/api/items`, { headers: { "x-zb-assistant": "wrong" } })).status, 401, "unknown token is nobody");
    assert.ok(db.prepare("SELECT 1 FROM activity WHERE entity = 'assistant'").get(), "assistant writes are in the activity log");
  } finally {
    server.close();
  }
});

test("assistant chat: runs the tool loop against the app and keeps the conversation", async () => {
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const { server, base } = serve(db);
  // a stand-in for the Claude API: first asks to search, then answers using what the search returned
  const seen = [];
  const fake = createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const body = JSON.parse(raw);
      seen.push(body);
      const last = body.messages.at(-1);
      const toolResult = Array.isArray(last.content) && last.content.find((b) => b.type === "tool_result");
      const content = toolResult
        ? [{ type: "text", text: `Mil gaya: ${toolResult.content.length > 2 ? "results" : "none"}. See /items/1` }]
        : [{ type: "tool_use", id: "tu_1", name: "books_api", input: { method: "GET", path: "/search?q=atta", body: null } }];
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: `msg_${seen.length}`, type: "message", role: "assistant", model: body.model, content,
        stop_reason: toolResult ? "end_turn" : "tool_use", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 } }));
    });
  }).listen(0);
  const env = { key: process.env.ANTHROPIC_API_KEY, url: process.env.ANTHROPIC_BASE_URL };
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
  try {
    const user = userByEmail(db, "sales@zidane.com.pk");
    const r1 = await AS.chat({ user, text: "atta dhoondo", base });
    assert.match(r1.reply, /Mil gaya: results/);
    assert.equal(seen.length, 2);
    assert.equal(seen[0].fallbacks, "default");
    assert.equal(seen[0].tools[0].name, "books_api");
    const r2 = await AS.chat({ user, chatId: r1.chatId, text: "aur?", base });
    assert.equal(r2.chatId, r1.chatId, "same conversation");
    assert.equal(seen[2].messages.length, 5, "history is kept: user, tool use, tool result, answer, new question");
    const other = userByEmail(db, "operations@zidane.com.pk");
    const r3 = await AS.chat({ user: other, chatId: r1.chatId, text: "hi", base });
    assert.notEqual(r3.chatId, r1.chatId, "someone else can't continue my chat");
  } finally {
    process.env.ANTHROPIC_API_KEY = env.key ?? "";
    if (env.url === undefined) delete process.env.ANTHROPIC_BASE_URL; else process.env.ANTHROPIC_BASE_URL = env.url;
    if (!env.key) delete process.env.ANTHROPIC_API_KEY;
    fake.close();
    server.close();
  }
});
