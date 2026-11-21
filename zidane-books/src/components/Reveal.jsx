// Profit figures stay hidden on the home screen (someone may be looking over your shoulder): tap to see, hides again by itself.
import React, { useEffect, useState } from "react";

export default function Reveal({ children, seconds = 20, label = "Show" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const t = setTimeout(() => setOpen(false), seconds * 1000); return () => clearTimeout(t); }, [open, seconds]);
  if (open) return <span className="reveal-open" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} title="Tap to hide">{children}</span>;
  return <button type="button" className="reveal-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} title="Tap to show for a moment">•••••• <span>👁 {label}</span></button>;
}
