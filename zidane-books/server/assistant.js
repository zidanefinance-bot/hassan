// Zidane Books assistant: chat with Claude inside the app. It works through the app's own API as the signed-in user,
// with the same limits as an assistant API key: it can read, add to the Orders Inbox, comment and save drafts.
// Issuing, money, verifying, deleting and settings always stay with a person in the app.
// Needs ANTHROPIC_API_KEY (same as the Orders Inbox). Conversations live in memory and end when the server restarts.
import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "node:crypto";
import { issueAssistantToken, revokeAssistantToken, ROLE_LABELS } from "./auth.js";
import { aiReady, MODEL } from "./ai.js";

let client;
const anthropic = () => (client ||= new Anthropic());

const chats = new Map(); // id -> { userId, messages, updated }
const MAX_STEPS = 12;
const MAX_RESULT = 30000;
setInterval(() => {
  const old = Date.now() - 6 * 3600e3;
  for (const [k, c] of chats) if (c.updated < old) chats.delete(k);
}, 15 * 60e3).unref();

const SYSTEM = `You are the assistant inside Zidane Books, the business app of Zidane Corporation, a B2B grocery and FMCG supplier in Karachi, Pakistan.
You talk with one team member at a time. Reply in the language they use: English, Roman Urdu or a mix (Roman Urdu means Urdu written in Latin letters). Keep replies short and practical, like a trusted colleague. Amounts are Pakistani rupees (Rs).

You work through the app's API with the books_api tool, as the signed-in user and with their role's limits.
Look things up before you answer; never invent numbers, names, rates or dates. If the API says you don't have access, tell the user plainly.

What you may do:
- read anything the user's role can see (GET);
- save drafts: POST /documents or PUT /documents/{id} with status "draft" (quotes may also be "enquiry");
- add a comment: POST /comments {entity, entity_id, body} where entity is document, job, payment, expense, contact or item;
- add a customer's order or a supplier's bill text to the Orders Inbox: POST /inbox {text, subject}.
You cannot issue, send, email, verify, pay, delete or change settings. When the user asks for one of these, prepare what you can (for example a draft) and tell them which button to press in the app.
Before saving a draft or comment, say in one line what you will save. After saving, give the document number or id and the app link, e.g. /invoices/12.

Useful endpoints (all GET unless noted):
/search?q=   one search across Jobs (incl. customer PO number), documents, contacts and items
/contacts?type=customer|supplier&q=    /contacts/{id}    /contacts/{id}/statement    /contacts/{id}/open-documents    /contacts/{id}/credit-status
/items?q=    /items/{id}    /items/last-rate?item_id=&contact_id=&side=customer|supplier
/documents?kind=quote|invoice|dc|credit_note|po|bill|vendor_credit&q=    /documents/{id}
/jobs    /jobs/{id}    /procurement    /procurement/needs
/payments?direction=in|out    /payments/{id}    /expenses
/reports/home    /reports/receivables    /reports/payables    /reports/pnl?from=&to=    /reports/sales-by-customer?from=&to=    /reports/sales-by-item?from=&to=    /reports/job-profit    /reports/inventory    /reports/tax?from=&to=
/inbox    /inbox/{id}    /comments?entity=&entity_id=    /notifications
/accounts (Chart of Accounts with balances)    /accounts/{id}/ledger?from=&to=    /reports/balance-sheet?to=    /reports/trial-balance?to=    /journals
Dates are YYYY-MM-DD.
A draft document body: {"kind":"quote","status":"draft","contact_id":12,"date":"2026-10-22","reference":"customer PO no. if any","lines":[{"item_id":5,"description":"Super Fine Atta 10kg","qty":40,"rate":1850,"discount_pct":0,"tax_rate":0}],"notes":""}.
Find contact_id and item_id first (search or /contacts, /items). Use the last rate for that customer or supplier when the user gives no rate, and say so.
App links: /jobs/{id}, /quotes/{id}, /invoices/{id}, /delivery-challans/{id}, /purchase-orders/{id}, /bills/{id}, /contacts/{id}, /items/{id}.`;

const tools = [{
  name: "books_api",
  description: "Call the Zidane Books API as the signed-in user. GET reads anything the user's role can see. POST/PUT are allowed only for drafts (/documents), comments (/comments) and the Orders Inbox (/inbox). Returns the JSON response, or the error message.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["method", "path", "body"],
    properties: {
      method: { type: "string", enum: ["GET", "POST", "PUT"] },
      path: { type: "string", description: "Path after /api, with the query string, e.g. /search?q=al-noor or /documents/12" },
      body: { type: ["object", "null"], description: "JSON body for POST/PUT, null for GET" },
    },
  },
}];

async function callApi(base, token, { method, path, body }) {
  if (!/^\/[\w\-./?=&%,:+@]*$/.test(path) || path.includes("..")) return { error: "Invalid path" };
  const r = await fetch(`${base}/api${path}`, {
    method,
    headers: { "x-zb-assistant": token, ...(body ? { "content-type": "application/json" } : {}) },
    body: method === "GET" || !body ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return r.ok ? data : { error: (data && data.error) || `HTTP ${r.status}` };
}

const asText = (v) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > MAX_RESULT ? `${s.slice(0, MAX_RESULT)}\n…(cut: ${s.length} characters in total; narrow the query)` : s;
};

// one user turn: runs the tool loop until Claude answers. base = this server's own address.
export async function chat({ user, chatId, text, base }) {
  if (!aiReady()) throw Object.assign(new Error("AI is not set up yet: add ANTHROPIC_API_KEY on the server"), { status: 503 });
  const msg = String(text || "").trim();
  if (!msg) throw Object.assign(new Error("Write something first"), { status: 400 });
  let c = chatId && chats.get(chatId);
  if (!c || c.userId !== user.id) { chatId = randomBytes(12).toString("hex"); c = { userId: user.id, messages: [] }; chats.set(chatId, c); }
  c.updated = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  c.messages.push({ role: "user", content: `${msg}\n\n(Today is ${today}. I am ${user.name}, role ${ROLE_LABELS[user.role]}.)` });
  const token = issueAssistantToken(user);
  const mark = c.messages.length - 1; // roll back to here if the turn fails, so the history stays valid
  const actions = [];
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await anthropic().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        tools,
        messages: c.messages,
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        // if the main model declines, the API retries on its default fallback model inside the same call
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      c.messages.push({ role: "assistant", content: response.content });
      if (response.stop_reason === "refusal") return { chatId, reply: "Maaf kijiye, main is par madad nahi kar sakta.", actions };
      if (response.stop_reason === "max_tokens") return { chatId, reply: "Jawab bohat lamba ho gaya. Sawal thoda chhota kar ke poochein.", actions };
      if (response.stop_reason === "pause_turn") continue;
      const uses = response.content.filter((b) => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || !uses.length) {
        const reply = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
        return { chatId, reply: reply || "…", actions };
      }
      const results = await Promise.all(uses.map(async (u) => {
        const input = u.input || {};
        const ok = ["GET", "POST", "PUT"].includes(input.method) && typeof input.path === "string";
        const out = ok ? await callApi(base, token, input) : { error: "method and path are required" };
        if (ok && input.method !== "GET") actions.push({ method: input.method, path: input.path, ok: !out?.error, result: out?.error || out?.id || null });
        return { type: "tool_result", tool_use_id: u.id, content: asText(out), ...(out?.error ? { is_error: true } : {}) };
      }));
      c.messages.push({ role: "user", content: results });
    }
    return { chatId, reply: "Ye kaam bohat steps ka ho gaya. Thoda chhota kar ke dobara poochein.", actions };
  } catch (e) {
    c.messages.length = mark;
    throw e;
  } finally {
    revokeAssistantToken(token);
  }
}

export const forgetChat = (user, chatId) => { const c = chats.get(chatId); if (c?.userId === user.id) chats.delete(chatId); };
