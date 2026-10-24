// Click a column heading on any list table to sort by it (click again to reverse), like Zoho.
// Works on every <table class="table"> without changes to the pages: statuses sort by their stage
// (new → … → delivered), amounts and dates by value, the rest A→Z. The choice is remembered per list.
// Tables with inputs (forms) or merged cells (report sections) are left alone.

const STAGES = ["enquiry", "draft", "new", "procurement_started", "partially_purchased", "purchase_complete", "material_ready", "dispatched", "delivered", "sent", "open", "issued", "partial", "overdue", "accepted", "converted", "signed", "invoiced", "billed", "paid", "closed", "declined", "void", "cancelled"];
const PRIORITY = ["low", "normal", "medium", "high", "urgent"];
const DATE = /^\d{1,2} [A-Z][a-z]{2} \d{4}$/;
const NUM = /^\(?-?(Rs\.?\s*)?-?[\d,]+(\.\d+)?\)?\s*(%|bags?|pcs|kg)?$/i;

function valueOf(td) {
  if (!td) return { t: 9 };
  const text = td.textContent.trim();
  if (!text || text === "—" || text === "-") return { t: 9 };
  const badge = td.querySelector(".badge");
  const key = (badge ? badge.textContent : text).trim().toLowerCase().replace(/\s+/g, "_");
  if (STAGES.includes(key)) return { t: 0, v: STAGES.indexOf(key) };
  if (PRIORITY.includes(key)) return { t: 0, v: PRIORITY.indexOf(key) };
  if (DATE.test(text)) return { t: 1, v: Date.parse(text) };
  if (NUM.test(text)) { const n = Number(text.replace(/[^\d.-]/g, "")) || 0; return { t: 1, v: /^\(|^-|Rs\.?\s*-/.test(text) ? -Math.abs(n) : n }; }
  return { t: 2, v: text.toLowerCase() };
}

const cmp = (a, b) => {
  if (a.t === 9 || b.t === 9) return a.t === b.t ? 0 : a.t === 9 ? 1 : -1; // blanks always last
  if (a.t !== b.t) return a.t - b.t;
  return a.t === 2 ? a.v.localeCompare(b.v, undefined, { numeric: true }) : a.v - b.v;
};

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("sort:" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("sort:" + k, JSON.stringify(v)); } catch {} },
};

function usable(table) {
  const body = table.tBodies[0];
  if (!table.tHead || !body) return false;
  if (body.querySelector("input, select, textarea")) return false;
  return ![...body.rows].some((r) => [...r.cells].some((c) => c.colSpan > 1));
}

const tableKey = (table) => location.pathname.replace(/\/\d+(?=\/|$)/g, "/:id") + "#" + [...document.querySelectorAll("table.table")].indexOf(table);

function apply(table, state) {
  const body = table.tBodies[0];
  const rows = [...body.rows];
  if (rows.length < 2) return;
  const sign = state.dir === "asc" ? 1 : -1;
  const vals = new Map(rows.map((r) => [r, valueOf(r.cells[state.col])]));
  const sorted = rows.map((r, i) => [r, i]).sort(([a, i], [b, j]) => {
    const x = vals.get(a), y = vals.get(b);
    const c = x.t === 9 || y.t === 9 ? cmp(x, y) : cmp(x, y) * sign;
    return c || i - j;
  }).map(([r]) => r);
  if (sorted.every((r, i) => r === rows[i])) return;
  sorted.forEach((r) => body.appendChild(r));
}

function mark(table, state) {
  [...table.tHead.rows[0].cells].forEach((th, i) => {
    th.classList.toggle("sort-asc", !!state && state.col === i && state.dir === "asc");
    th.classList.toggle("sort-desc", !!state && state.col === i && state.dir === "desc");
  });
}

function setup(table) {
  if (!usable(table)) { if (table.dataset.sortable) { table.removeAttribute("data-sortable"); mark(table, null); } return; }
  const head = table.tHead.rows[0];
  if (!table.dataset.sortable) {
    table.dataset.sortable = "1";
    [...head.cells].forEach((th, i) => {
      if (!th.textContent.trim() || th.classList.contains("no-sort")) return;
      th.classList.add("sortable");
      th.title = "Click to sort";
      th.addEventListener("click", () => {
        if (!table.dataset.sortable) return;
        const k = tableKey(table), cur = store.get(k);
        // First click: statuses, amounts and dates go high → low (e.g. delivered first), text A → Z
        const first = valueOf(table.tBodies[0].rows[0]?.cells[i]).t === 2 ? "asc" : "desc";
        const next = { col: i, dir: cur && cur.col === i ? (cur.dir === "asc" ? "desc" : "asc") : first };
        store.set(k, next); mark(table, next); apply(table, next);
      });
    });
  }
  const state = store.get(tableKey(table));
  if (state && state.col < head.cells.length) { mark(table, state); apply(table, state); }
}

export function startTableSorting() {
  let queued = false;
  const run = () => { queued = false; document.querySelectorAll("table.table").forEach(setup); };
  const obs = new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } });
  obs.observe(document.body, { childList: true, subtree: true });
  run();
  return () => obs.disconnect();
}
