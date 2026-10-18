// Conversation on any record. Type @ to ask someone; they get a notification and answer right here.
import React, { useLayoutEffect, useRef, useState } from "react";
import { api, useAuth, useLoad, useToast } from "../lib.jsx";

const ROLE = { director: "Director", sales: "Sales", operations: "Operations", purchaser: "Purchaser", accounts: "Accounts" };
const when = (at) => new Date(at + "Z").toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

// show "@Name" in bold
function Body({ text, people }) {
  const names = people.map((p) => p.name).sort((a, b) => b.length - a.length);
  if (!names.length) return <p>{text}</p>;
  const re = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  return <p>{text.split(re).map((part, i) => (i % 2 ? <b key={i} className="mention">{part}</b> : part))}</p>;
}

export default function Comments({ entity, id }) {
  const state = useLoad(`/comments?entity=${entity}&entity_id=${id}`);
  const peopleState = useLoad(`/comments/people?entity=${entity}&entity_id=${id}`);
  const { user, can } = useAuth();
  const [text, setText] = useState("");
  const [picker, setPicker] = useState(null); // text typed after "@"
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const caret = useRef(null); // where the cursor goes after inserting a name
  useLayoutEffect(() => { if (caret.current !== null && box.current) { box.current.setSelectionRange(caret.current, caret.current); caret.current = null; } }, [text]);
  const toast = useToast();
  const people = peopleState.data || [];
  const everyone = [...people, { id: user.id, name: user.name }];

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    const m = v.slice(0, e.target.selectionStart).match(/@([\w ().]*)$/);
    setPicker(m ? m[1].toLowerCase() : null);
  };
  const pick = (p) => {
    const el = box.current;
    const before = text.slice(0, el.selectionStart).replace(/@([\w ().]*)$/, `@${p.name} `);
    caret.current = before.length;
    setText(before + text.slice(el.selectionStart));
    setPicker(null);
    el.focus();
  };
  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const mentions = people.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id);
      await api("/comments", { method: "POST", body: { entity, entity_id: id, body: text, mentions } });
      setText("");
      state.reload();
      if (mentions.length) toast(`Sent. ${mentions.length === 1 ? "They'll" : "Everyone tagged will"} get a notification.`);
    } catch (x) { toast(x.message, "err"); } finally { setBusy(false); }
  };
  const remove = async (c) => {
    if (!confirm("Delete this comment?")) return;
    try { await api(`/comments/${c.id}`, { method: "DELETE" }); state.reload(); } catch (x) { toast(x.message, "err"); }
  };
  const list = state.data || [];
  const matches = picker === null ? [] : people.filter((p) => p.name.toLowerCase().includes(picker)).slice(0, 6);

  return (
    <section className="card no-print comments">
      <h3>Comments {list.length > 0 && <span className="muted">({list.length})</span>}</h3>
      {list.length === 0 && <p className="muted small">No comments yet. Ask a question here and type @ to tag someone.</p>}
      <ul className="thread">
        {list.map((c) => (
          <li key={c.id} className={c.user_id === user.id ? "mine" : ""}>
            <div className="avatar sm">{c.user_name[0]}</div>
            <div className="bubble">
              <header><b>{c.user_name}</b><span className="muted small">{ROLE[c.role]} · {when(c.created_at)}</span>
                {(c.user_id === user.id || can("admin")) && <button className="icon-btn sm" aria-label="Delete comment" onClick={() => remove(c)}>×</button>}</header>
              <Body text={c.body} people={everyone} />
            </div>
          </li>
        ))}
      </ul>
      <form className="compose" onSubmit={send}>
        <div className="compose-box">
          <textarea ref={box} rows={2} value={text} onChange={onChange} placeholder="Write a comment or question… type @ to tag someone"
            onKeyDown={(e) => {
              if (matches.length && (e.key === "Enter" || e.key === "Tab")) { e.preventDefault(); pick(matches[0]); }
              else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(e);
              else if (e.key === "Escape") setPicker(null);
            }} />
          {matches.length > 0 && (
            <ul className="mention-list" role="listbox">
              {matches.map((p) => <li key={p.id}><button type="button" onMouseDown={(e) => { e.preventDefault(); pick(p); }}><b>{p.name}</b> <span className="muted small">{ROLE[p.role]}</span></button></li>)}
            </ul>
          )}
        </div>
        <button className="btn primary" disabled={busy || !text.trim()}>{busy ? "Sending…" : "Send"}</button>
      </form>
    </section>
  );
}
