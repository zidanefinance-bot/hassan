// Share a PDF (invoice, DC, PO, receiving slip…) from the phone: WhatsApp, email, Drive… as a real file, through
// the phone's own share sheet. Where the browser can't share files (most computers), the PDF is downloaded instead.
import React, { useRef, useState } from "react";
import { useToast } from "../lib.jsx";

export default function ShareButton({ url, filename, title, text, className = "btn", label = "Share" }) {
  const toast = useToast();
  const cache = useRef(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (cache.current) return cache.current;
    const r = await fetch(url, { credentials: "same-origin" });
    if (!r.ok) throw new Error("Couldn't make the PDF");
    const blob = await r.blob();
    const name = filename || /filename="([^"]+)"/.exec(r.headers.get("content-disposition") || "")?.[1] || "document.pdf";
    cache.current = new File([blob], name, { type: blob.type || "application/pdf" });
    return cache.current;
  };
  const download = (file) => {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: file.name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`${file.name} downloaded`);
  };
  const share = async () => {
    setBusy(true);
    try {
      const file = await load();
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: title || file.name, text: text || "" }); }
        catch (e) {
          if (e.name === "AbortError") return; // closed the share sheet
          if (e.name === "NotAllowedError") { toast("Ready: tap Share again"); return; } // the PDF took too long; it's cached now
          throw e;
        }
      } else download(file);
    } catch (e) { toast(e.message || "Couldn't share", "err"); } finally { setBusy(false); }
  };
  // start making the PDF as soon as a finger / mouse is on the button, so the share sheet opens straight away
  return <button type="button" className={className} disabled={busy} onPointerDown={() => { load().catch(() => {}); }} onClick={share} title="Send by WhatsApp, email…">{busy ? "Preparing…" : <>📤 {label}</>}</button>;
}
