// The bell in the top bar: your alerts, checked every 45 seconds. Optional browser pop-ups while the app is open.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, useToast } from "../lib.jsx";
import { enablePush, pushSubscription, pushSupported } from "../pwa.js";

const ICON = { mention: "@", comment: "💬", approval: "✋", job: "▣", verify: "✓", payment: "₨", stock: "⚠", overdue: "⏰" };
const ago = (at) => {
  const m = Math.round((Date.now() - Date.parse(at + "Z")) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(at + "Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};
const canPopup = () => typeof Notification !== "undefined";

export default function Bell() {
  const [data, setData] = useState({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState(canPopup() ? Notification.permission : "unsupported");
  const [pushOn, setPushOn] = useState(false); // this device gets real push alerts, so no in-page pop-ups needed
  const toast = useToast();
  useEffect(() => { pushSubscription().then((s) => setPushOn(Boolean(s))).catch(() => {}); }, []);
  const seen = useRef(null);
  const wrap = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const d = await api("/notifications");
      setData(d);
      // pop up anything new since the last check (not on first load)
      if (seen.current && !pushOn && canPopup() && Notification.permission === "granted") {
        for (const n of d.items.filter((x) => !x.read_at && x.id > seen.current).slice(0, 3)) {
          const pop = new Notification(n.title, { body: n.body || "", tag: `zb-${n.id}` });
          pop.onclick = () => { window.focus(); if (n.link) navigate(n.link); pop.close(); };
        }
      }
      seen.current = Math.max(seen.current || 0, ...d.items.map((x) => x.id), 0);
    } catch { /* offline or signed out: try again next tick */ }
  }, [navigate, pushOn]);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);
  // a document page (quote/invoice/DC/bill/PO) takes over the title while open, so its "Print / PDF"
  // saves the file under the document number -- this poll (every 45s, or on window focus) must not
  // clobber that mid-visit, so it backs off while window.__docTitleLock is set (see DocumentView.jsx)
  useEffect(() => { if (!window.__docTitleLock) document.title = data.unread ? `(${data.unread}) Zidane Books` : "Zidane Books"; }, [data.unread]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const go = async (n) => {
    setOpen(false);
    if (!n.read_at) { await api("/notifications/read", { method: "POST", body: { ids: [n.id] } }).catch(() => {}); load(); }
    if (n.link) navigate(n.link);
  };
  const readAll = async () => { await api("/notifications/read", { method: "POST", body: { ids: "all" } }); load(); };
  const enable = async () => {
    if (pushSupported()) {
      try { await enablePush(); setPushOn(true); setPerm("granted"); toast("Alerts on for this device"); } catch (x) { toast(x.message, "err"); setPerm(Notification.permission); }
    } else setPerm(await Notification.requestPermission());
  };

  return (
    <div className="bell-wrap" ref={wrap}>
      <button className="icon-btn bell" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ""}`}>
        🔔{data.unread > 0 && <span className="bell-count">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <header><b>Notifications</b>{data.unread > 0 && <button className="btn sm ghost" onClick={readAll}>Mark all read</button>}</header>
          {!pushOn && perm !== "denied" && perm !== "unsupported" && <button className="bell-enable" onClick={enable}>🔔 Turn on alerts on this device</button>}
          {data.items.length === 0 ? <p className="muted small pad">Nothing yet. When someone tags you or something needs you, it shows here.</p> : (
            <ul>
              {data.items.map((n) => (
                <li key={n.id} className={n.read_at ? "" : "unread"}>
                  <button onClick={() => go(n)}>
                    <span className={`bell-icon k-${n.kind}`}>{ICON[n.kind] || "•"}</span>
                    <span className="bell-text"><b>{n.title}</b>{n.body && <span className="muted small">{n.body}</span>}<time className="muted small">{ago(n.created_at)}</time></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
