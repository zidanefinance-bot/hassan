// Chat with the Zidane Books assistant (server/assistant.js). Floating button bottom-right; the panel keeps the
// conversation until you start a new chat. Optional voice typing uses the browser's own speech recognition.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib.jsx";

const SpeechRec = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
const HINTS = ["Aaj kis ki payment due hai?", "Al-Noor ka last invoice dikhao", "Dalda 5L ke 40 ka quote draft bana do", "Is hafte kya kharidna hai?"];
const LINK = /(\/(?:jobs|quotes|invoices|delivery-challans|credit-notes|purchase-orders|bills|vendor-credits|contacts|items|payments)\/\d+)/g;

function Text({ text, go }) {
  return text.split("\n").map((line, i) => (
    <p key={i}>{line.split(LINK).map((part, j) => (j % 2 ? <a key={j} href={part} onClick={(e) => { e.preventDefault(); go(part); }}>{part}</a> : part))}</p>
  ));
}

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState("en-PK");
  const rec = useRef(null);
  const end = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { if (open && ready === null) api("/assistant/status").then((r) => setReady(r.ready)).catch(() => setReady(false)); }, [open, ready]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const send = async (q = text) => {
    const t = q.trim();
    if (!t || busy) return;
    setText("");
    setMsgs((m) => [...m, { who: "me", text: t }]);
    setBusy(true);
    try {
      const r = await api("/assistant/chat", { method: "POST", body: { chat_id: chatId, text: t } });
      setChatId(r.chatId);
      setMsgs((m) => [...m, { who: "ai", text: r.reply, actions: r.actions }]);
    } catch (e) {
      setMsgs((m) => [...m, { who: "ai", text: e.message || "Kuch ghalat ho gaya, dobara try karein.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const fresh = () => {
    if (chatId) api(`/assistant/chat/${chatId}`, { method: "DELETE" }).catch(() => {});
    setChatId(null); setMsgs([]);
  };

  const mic = () => {
    if (listening) { rec.current?.stop(); return; }
    const r = new SpeechRec();
    r.lang = lang; r.interimResults = true; r.continuous = false;
    const before = text ? `${text} ` : "";
    r.onresult = (e) => setText(before + Array.from(e.results).map((x) => x[0].transcript).join(""));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; setListening(true); r.start();
  };

  const go = (path) => { navigate(path); if (window.innerWidth < 760) setOpen(false); };

  return (
    <>
      {!open && <button className="ai-fab" onClick={() => setOpen(true)} aria-label="Assistant">✦<span>Ask AI</span></button>}
      {open && (
        <div className="ai-panel" role="dialog" aria-label="Assistant">
          <div className="ai-head">
            <b>✦ Zidane Assistant</b>
            <div className="spacer" />
            {msgs.length > 0 && <button className="btn sm ghost" onClick={fresh}>New chat</button>}
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <div className="ai-body">
            {ready === false && <div className="ai-note">AI abhi set nahi hai. Server par ANTHROPIC_API_KEY daalni hogi (deploy/SETUP-AI-EMAIL.md).</div>}
            {msgs.length === 0 && ready !== false && (
              <div className="ai-empty">
                <p>Salaam! Main Books mein se cheezein dhoond sakta hoon, reports bata sakta hoon, aur quotes, POs ya bills ke <b>drafts</b> bana sakta hoon. Issue, payment aur email aap khud app mein karein ge.</p>
                <div className="ai-hints">{HINTS.map((h) => <button key={h} className="btn sm" onClick={() => send(h)}>{h}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.who}${m.error ? " error" : ""}`}>
                <Text text={m.text} go={go} />
                {m.actions?.length > 0 && (
                  <div className="ai-actions">{m.actions.map((a, j) => <span key={j} className={`badge ${a.ok ? "green" : "red"}`}>{a.ok ? "✓" : "✕"} {a.method} {a.path}</span>)}</div>
                )}
              </div>
            ))}
            {busy && <div className="ai-msg ai typing"><span /><span /><span /></div>}
            <div ref={end} />
          </div>
          <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            {SpeechRec && (
              <>
                <button type="button" className={`icon-btn ai-mic ${listening ? "on" : ""}`} onClick={mic} title="Bol kar likhein" aria-label="Voice typing">🎤</button>
                <button type="button" className="btn sm ghost ai-lang" onClick={() => setLang((l) => (l === "en-PK" ? "ur-PK" : "en-PK"))} title="Voice language">{lang === "en-PK" ? "EN" : "اردو"}</button>
              </>
            )}
            <textarea value={text} rows={1} placeholder={listening ? "Sun raha hoon…" : "Kuch bhi poochein…"} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="btn primary" disabled={busy || !text.trim()}>Send</button>
          </form>
        </div>
      )}
    </>
  );
}
