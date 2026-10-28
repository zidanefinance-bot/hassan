// The item list as a picture to send on WhatsApp: grouped by category (A→Z), items A→Z inside each,
// with the unit and (if asked, and allowed) the selling rate. Drawn in the browser; a long list becomes parts.
const W = 1080, PAD = 48, ROW = 40, HEAD = 52, TOP = 210, FOOT = 70, MAX_H = 16000;
const RED = "#c22a2f", INK = "#1d2433", MUTED = "#6b7587", LINE = "#e4e7ed", SHADE = "#f6f7f9";
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const rs = (n) => `Rs ${new Intl.NumberFormat("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n) || 0)}`;

const loadImage = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > width) t = t.slice(0, -1);
  return t + "…";
}

// rows to draw: a header per category, then its items
export function categoryRows(items) {
  const byCat = new Map();
  for (const i of items) {
    const c = (i.category || "").trim() || "Other";
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(i);
  }
  const cats = [...byCat.keys()].sort((a, b) => (a === "Other") - (b === "Other") || a.localeCompare(b));
  const rows = [];
  for (const c of cats) {
    const list = byCat.get(c).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    rows.push({ cat: c, count: list.length });
    list.forEach((i, n) => rows.push({ item: i, n: n + 1 }));
  }
  return rows;
}

export async function downloadItemsPng(items, { withRates = false, title = "Item list", company = "Zidane Corporation", file = "zidane-items" } = {}) {
  const rows = categoryRows(items);
  // split into parts so no picture gets too tall for a phone (or the browser)
  const perPart = Math.floor((MAX_H - TOP - FOOT) / ROW);
  const parts = [];
  for (let i = 0; i < rows.length; i += perPart) {
    const part = rows.slice(i, i + perPart);
    // a part never starts with an orphan item: repeat its category's header
    if (part[0] && !part[0].cat) { const head = [...rows.slice(0, i)].reverse().find((r) => r.cat); if (head) part.unshift({ ...head, cont: true }); }
    parts.push(part);
  }
  const logo = await loadImage("/logo.svg");
  const stamp = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const files = [];
  for (const [pi, part] of parts.entries()) {
    const h = TOP + part.reduce((t, r) => t + (r.cat ? HEAD : ROW), 0) + FOOT;
    const c = document.createElement("canvas");
    c.width = W; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, h);
    // header: logo, title, date
    if (logo) { const lh = 70, lw = (logo.width / logo.height) * lh || 175; ctx.drawImage(logo, PAD, 36, lw, lh); }
    else { ctx.fillStyle = RED; ctx.font = `800 44px ${FONT}`; ctx.fillText(company, PAD, 90); }
    ctx.textAlign = "right";
    ctx.fillStyle = INK; ctx.font = `800 34px ${FONT}`; ctx.fillText(title, W - PAD, 70);
    ctx.fillStyle = MUTED; ctx.font = `500 20px ${FONT}`;
    ctx.fillText(`${items.length} items · ${stamp}${parts.length > 1 ? ` · part ${pi + 1} of ${parts.length}` : ""}`, W - PAD, 102);
    ctx.textAlign = "left";
    // column titles
    const rateX = W - PAD, unitX = withRates ? W - PAD - 220 : W - PAD;
    ctx.fillStyle = MUTED; ctx.font = `700 16px ${FONT}`;
    ctx.fillText("ITEM", PAD + 56, 178);
    ctx.textAlign = "right"; ctx.fillText("UNIT", unitX, 178); if (withRates) ctx.fillText("RATE", rateX, 178); ctx.textAlign = "left";
    ctx.fillStyle = LINE; ctx.fillRect(PAD, 192, W - 2 * PAD, 2);
    let y = TOP;
    for (const r of part) {
      if (r.cat) {
        ctx.fillStyle = RED; ctx.fillRect(PAD, y + 8, W - 2 * PAD, HEAD - 14);
        ctx.fillStyle = "#fff"; ctx.font = `800 21px ${FONT}`;
        ctx.fillText(`${r.cat}${r.cont ? " (continued)" : ""}`, PAD + 16, y + 8 + (HEAD - 14) / 2 + 7);
        ctx.textAlign = "right"; ctx.font = `600 17px ${FONT}`; ctx.fillText(`${r.count} items`, W - PAD - 16, y + 8 + (HEAD - 14) / 2 + 6); ctx.textAlign = "left";
        y += HEAD;
        continue;
      }
      if (r.n % 2 === 0) { ctx.fillStyle = SHADE; ctx.fillRect(PAD, y, W - 2 * PAD, ROW); }
      const mid = y + ROW / 2 + 7;
      ctx.fillStyle = MUTED; ctx.font = `500 17px ${FONT}`; ctx.fillText(String(r.n), PAD + 12, mid);
      ctx.fillStyle = INK; ctx.font = `600 19px ${FONT}`;
      ctx.fillText(fit(ctx, r.item.name, unitX - 120 - (PAD + 56) - 20), PAD + 56, mid);
      ctx.textAlign = "right";
      ctx.fillStyle = MUTED; ctx.font = `500 18px ${FONT}`; ctx.fillText(fit(ctx, r.item.unit || "", 110), unitX, mid);
      if (withRates) { ctx.fillStyle = INK; ctx.font = `700 19px ${FONT}`; ctx.fillText(r.item.sale_rate > 0 ? rs(r.item.sale_rate) : "—", rateX, mid); }
      ctx.textAlign = "left";
      y += ROW;
    }
    ctx.fillStyle = LINE; ctx.fillRect(PAD, h - FOOT + 14, W - 2 * PAD, 2);
    ctx.fillStyle = MUTED; ctx.font = `500 17px ${FONT}`;
    ctx.fillText(withRates ? `${company} · rates in PKR, before tax · subject to change` : company, PAD, h - FOOT + 46);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
    files.push({ blob, name: `${file}${parts.length > 1 ? `-part${pi + 1}` : ""}.png` });
  }
  for (const [k, f] of files.entries()) {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(f.blob), download: f.name });
    setTimeout(() => { a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, k * 600);
  }
  return files.length;
}
