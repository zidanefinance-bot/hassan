// My account: password, Telegram alerts, and personal API keys (for an assistant bot, once a director allows them).
import React, { useState } from "react";
import { api, Field, Loading, Modal, PageHead, useAuth, useLoad, useToast } from "../lib.jsx";
import { Password } from "./Settings.jsx";

const when = (at) => (at ? new Date(at.replace(" ", "T") + "Z").toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never");

function Telegram() {
  const state = useLoad("/me/telegram");
  const [link, setLink] = useState(null);
  const toast = useToast();
  const start = async () => { try { setLink(await api("/me/telegram", { method: "POST" })); } catch (x) { toast(x.message, "err"); } };
  const remove = async () => { if (!confirm("Stop Telegram alerts?")) return; await api("/me/telegram", { method: "DELETE" }); setLink(null); state.reload(); };
  return (
    <section className="card">
      <h3>Telegram alerts</h3>
      <Loading state={state}>{(t) => !t.ready ? <p className="muted">Telegram isn't set up on the server yet. A director can add a bot (see SETUP-AI-EMAIL.md).</p>
        : t.linked ? <><p className="pos">✓ Linked since {when(t.linked_at)}. Your notifications arrive on Telegram, and you can send bill photos or order messages to the bot.</p><button className="btn ghost danger" onClick={remove}>Unlink</button></>
        : link ? <>
          <p>Open the bot and press <b>Start</b>:</p>
          {link.url ? <a className="btn primary" href={link.url} target="_blank" rel="noreferrer">Open @{link.bot} in Telegram</a> : <p>Send <code>/start {link.code}</code> to the bot.</p>}
          <p className="muted small">After pressing Start, come back and <button className="link-btn" onClick={() => state.reload()}>refresh</button>.</p>
        </> : <><p className="muted">Get your alerts (questions for you, new Jobs, approvals, payments) on your phone, and send bill photos straight to the Orders Inbox.</p><button className="btn primary" onClick={start}>Link my Telegram</button></>}</Loading>
    </section>
  );
}

function ApiKeys() {
  const state = useLoad("/api-keys");
  const { can } = useAuth();
  const [shown, setShown] = useState(null);
  const [name, setName] = useState("OpenClaw");
  const toast = useToast();
  const act = async (fn, msg) => { try { const r = await fn(); if (msg) toast(msg); state.reload(); return r; } catch (x) { toast(x.message, "err"); } };
  return (
    <section className="card">
      <h3>API keys (assistant bots)</h3>
      <Loading state={state}>{(d) => <>
        <p className="muted small">A key lets a bot such as OpenClaw work as <b>you</b>, with your role's limits. It can read, add to the Orders Inbox, comment and save <b>drafts</b>. Issuing, payments, deleting and settings always stay in the app.</p>
        {can("admin") && (
          <label className="check"><input type="checkbox" checked={d.enabled} onChange={(e) => act(() => api("/api-keys/enabled", { method: "POST", body: { enabled: e.target.checked } }), e.target.checked ? "API keys switched on" : "API keys switched off; existing keys stop working")} /> Allow API keys for the team (director only)</label>
        )}
        {!d.enabled ? <p className="muted">API keys are switched off{can("admin") ? "." : ". A director can turn them on."}</p> : (
          <div className="row-2 self-end"><Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <button className="btn primary self-end" onClick={async () => { const r = await act(() => api("/api-keys", { method: "POST", body: { name } })); if (r) setShown(r.key); }}>+ Create key</button></div>
        )}
        {d.keys.length > 0 && <table className="table compact mt"><thead><tr><th>Name</th>{can("admin") && <th>Owner</th>}<th>Key</th><th>Last used</th><th /></tr></thead>
          <tbody>{d.keys.map((k) => <tr key={k.id} className={k.revoked_at ? "muted" : ""}><td>{k.name}</td>{can("admin") && <td>{k.user_name}</td>}<td><code>zb_{k.prefix}_…</code></td><td>{when(k.last_used_at)}</td>
            <td className="r">{k.revoked_at ? "revoked" : <button className="btn sm ghost danger" onClick={() => confirm(`Revoke ${k.name}? The bot using it stops working.`) && act(() => api(`/api-keys/${k.id}`, { method: "DELETE" }), "Key revoked")}>Revoke</button>}</td></tr>)}</tbody></table>}
      </>}</Loading>
      {shown && (
        <Modal title="Your new API key" onClose={() => setShown(null)}>
          <div className="form">
            <p>Copy it now. It won't be shown again.</p>
            <code className="key">{shown}</code>
            <p className="muted small">Give it to the bot as a header: <code>Authorization: Bearer {shown.slice(0, 12)}…</code>. Revoke it here any time.</p>
            <div className="form-actions"><button className="btn" onClick={() => navigator.clipboard?.writeText(shown).then(() => toast("Copied"))}>Copy</button><button className="btn primary" onClick={() => setShown(null)}>Done</button></div>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default function Account() {
  const { user } = useAuth();
  return (
    <>
      <PageHead title="My account" sub={`${user.name} · ${user.email} · ${user.role_label}`} />
      <div className="grid-2">
        <Telegram />
        <Password />
        <ApiKeys />
      </div>
    </>
  );
}
