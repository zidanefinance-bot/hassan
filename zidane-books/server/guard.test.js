import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { ensureAdmin, seedDemo } from "./seed.js";

test("edits and deletes need a reason; only a director deletes, others ask for approval", async () => {
  const db = openDb(":memory:");
  const director = ensureAdmin(db);
  seedDemo(db);
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = async (email, password = "demo1234") => {
    const r = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const cookie = r.headers.get("set-cookie").split(";")[0];
    return async (method, path, body, headers = {}) => {
      const x = await fetch(base + path, { method, headers: { "content-type": "application/json", cookie, ...headers }, body: body ? JSON.stringify(body) : undefined });
      return { status: x.status, body: await x.json().catch(() => ({})) };
    };
  };
  const why = (s) => ({ "x-reason": encodeURIComponent(s) });
  try {
    const [dir, sales] = [await login(director.email, director.password), await login("sales@zidane.com.pk")];
    const cust = db.prepare("SELECT id, name FROM contacts WHERE type = 'customer' LIMIT 1").get();

    // editing a customer: no reason → asked for one; with a reason → saved and the reason is in its activity
    const noReason = await sales("PUT", `/contacts/${cust.id}`, { name: cust.name, phone: "0300 0000000" });
    assert.equal(noReason.status, 428);
    assert.equal(noReason.body.code, "reason_required");
    assert.equal((await sales("PUT", `/contacts/${cust.id}`, { name: cust.name, phone: "0300 0000000" }, why("نیا نمبر / new number"))).status, 200);
    const act = (await sales("GET", `/activity?entity=contact&id=${cust.id}`)).body;
    assert.ok(act.some((a) => a.action === "reason for edit" && a.summary.includes("new number")), "reason shows on the record");

    // drafts are scratch work: change or delete them freely
    const draft = (await sales("POST", "/documents", { kind: "quote", contact_id: cust.id, status: "draft", lines: [{ description: "x", qty: 1, rate: 10 }] })).body.id;
    assert.equal((await sales("PUT", `/documents/${draft}`, { contact_id: cust.id, status: "draft", lines: [{ description: "y", qty: 1, rate: 10 }] })).status, 200);
    assert.equal((await sales("DELETE", `/documents/${draft}`)).status, 200);

    // Sales deleting an issued quote: it becomes a request, the quote stays, the director hears about it
    const quote = (await sales("POST", "/documents", { kind: "quote", contact_id: cust.id, status: "sent", lines: [{ description: "x", qty: 1, rate: 10 }] })).body.id;
    assert.equal((await sales("DELETE", `/documents/${quote}`)).status, 428);
    const asked = await sales("DELETE", `/documents/${quote}`, null, why("customer cancelled"));
    assert.equal(asked.status, 202);
    assert.ok(asked.body.pending);
    assert.ok(db.prepare("SELECT 1 FROM documents WHERE id = ?").get(quote));
    assert.equal((await sales("DELETE", `/documents/${quote}`, null, why("again"))).body.request_id, asked.body.request_id, "asking twice doesn't make two requests");
    assert.ok(db.prepare("SELECT 1 FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.role = 'director' AND n.kind = 'approval'").get());
    assert.equal((await sales("GET", "/delete-requests")).body[0].status, "pending");
    assert.equal((await sales("POST", `/delete-requests/${asked.body.request_id}/reject`, {})).status, 403, "Sales can't decide");
    assert.equal((await sales("GET", "/activity")).status, 403, "the full activity log is the director's");

    // the director approves: the delete runs, the request is closed, Sales is told
    const list = (await dir("GET", "/delete-requests")).body;
    const req = list.find((r) => r.id === asked.body.request_id);
    assert.equal(req.reason, "customer cancelled");
    assert.equal(req.requested_by_name, db.prepare("SELECT name FROM users WHERE email = 'sales@zidane.com.pk'").get().name);
    assert.equal((await dir("DELETE", req.path, null, { ...why(req.reason), "x-approval": String(req.id) })).status, 200);
    assert.ok(!db.prepare("SELECT 1 FROM documents WHERE id = ?").get(quote));
    assert.equal(db.prepare("SELECT status FROM delete_requests WHERE id = ?").get(req.id).status, "approved");
    assert.equal((await dir("DELETE", req.path, null, { ...why("x"), "x-approval": String(req.id) })).status, 404, "an approval is used once");

    // or rejects: the record stays
    const q2 = (await sales("POST", "/documents", { kind: "quote", contact_id: cust.id, status: "sent", lines: [{ description: "x", qty: 1, rate: 10 }] })).body.id;
    const r2 = (await sales("DELETE", `/documents/${q2}`, null, why("duplicate"))).body.request_id;
    assert.equal((await dir("POST", `/delete-requests/${r2}/reject`, { note: "keep it, it's sent" })).status, 200);
    assert.ok(db.prepare("SELECT 1 FROM documents WHERE id = ?").get(q2));
    assert.equal((await sales("GET", "/delete-requests")).body.find((r) => r.id === r2).status, "rejected");

    // a director deletes straight away, still with a reason
    assert.equal((await dir("DELETE", `/documents/${q2}`)).status, 428);
    assert.equal((await dir("DELETE", `/documents/${q2}`, null, why("duplicate of an earlier quote"))).status, 200);
    const all = (await dir("GET", "/activity?q=duplicate")).body;
    assert.ok(all.some((a) => a.action === "reason for delete"));
    assert.ok(all.some((a) => a.action === "asked to delete"));
  } finally {
    server.close();
  }
});
