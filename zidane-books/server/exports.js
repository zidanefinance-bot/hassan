// Excel downloads. "What to buy": every line still to buy, with the item, customer, Job and qty,
// stamped with when it was downloaded (Karachi time) so an old printout is easy to spot.
import ExcelJS from "exceljs";
import { procurementList } from "./jobs.js";

const TZ = "Asia/Karachi";
const stamp = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
const fileStamp = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d).replace(" ", "-").replace(":", "");
const round = (n) => Math.round(n * 1000) / 1000;
const day = (s) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

// canSale (directors only): each line's selling rate and value, so the buy list shows what it sells for
// filterable in Excel: lines with no PO yet are the ones still to order
const poStatus = (j) => (!j.po_qty ? "Not ordered" : j.not_ordered > 0 ? "Partly on PO" : "On PO");

export async function procurementXlsx(db, user, { canCost = false, canSale = false } = {}) {
  const now = new Date();
  const groups = procurementList(db, { withSale: canSale });
  const wb = new ExcelJS.Workbook();
  wb.creator = "Zidane Books";
  wb.created = now;
  const head = (ws, title, width) => {
    ws.mergeCells(1, 1, 1, width);
    ws.getCell(1, 1).value = title;
    ws.getCell(1, 1).font = { bold: true, size: 14 };
    ws.mergeCells(2, 1, 2, width);
    ws.getCell(2, 1).value = `Downloaded: ${stamp(now)}${user?.name ? ` · by ${user.name}` : ""}`;
    ws.getCell(2, 1).font = { color: { argb: "FF6B7587" } };
  };
  const header = (ws, row, names) => {
    const r = ws.getRow(row);
    names.forEach((n, i) => { const c = r.getCell(i + 1); c.value = n; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC22A2F" } }; c.alignment = { vertical: "middle" }; });
    ws.views = [{ state: "frozen", ySplit: row }];
    ws.autoFilter = { from: { row, column: 1 }, to: { row, column: names.length } };
  };

  // 1. every customer line, grouped by item (the same item sits together, shaded alike)
  const ws = wb.addWorksheet("What to buy");
  const cols = ["#", "Item", "Category", "Customer", "Job", "To buy", "Unit", "Ordered", "Already bought", "PO status", "On PO", "PO #", "Not on PO yet", "Needed by", "Priority", ...(canSale ? ["Selling rate (Rs)", "Selling value (Rs)"] : []), ...(canSale && canCost ? ["Last cost (Rs)"] : []), "Bought now", "Notes"];
  head(ws, "What to buy", cols.length);
  header(ws, 4, cols);
  [5, 42, 16, 30, 13, 9, 8, 9, 14, 14, 9, 22, 13, 14, 10, ...(canSale ? [15, 16] : []), ...(canSale && canCost ? [14] : []), 12, 28].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  let n = 0;
  groups.forEach((g, gi) => {
    for (const j of g.jobs) {
      const sale = canSale ? [j.sale_rate ?? "", j.sale_rate != null ? Math.round(j.qty * j.sale_rate * 100) / 100 : ""] : [];
      const r = ws.addRow([++n, g.name, g.category, j.customer_name, j.job_number, j.qty, g.unit, j.ordered, j.bought || "", poStatus(j), j.po_qty || "", j.pos.map((p) => p.number).join(", "), j.not_ordered || "", day(j.required_date), j.priority || "", ...sale, ...(canSale && canCost ? [g.purchase_rate || ""] : []), null, null]);
      r.getCell(6).font = { bold: true };
      if (!j.po_qty) r.getCell(10).font = { bold: true, color: { argb: "FFB42318" } };
      if (gi % 2) r.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F6F9" } }; });
    }
  });
  if (!n) ws.addRow(["", "Nothing to buy right now"]);

  // 2. one line per item: how much in all, what's in stock, the earliest date
  const tot = wb.addWorksheet("Totals by item");
  const tcols = ["Item", "Category", "Total to buy", "Unit", "In stock", "On PO", "Not on PO yet", "Earliest needed", "Customers", ...(canCost ? ["Last cost (Rs)"] : []), ...(canSale ? ["Selling value (Rs)"] : [])];
  head(tot, "What to buy: totals by item", tcols.length);
  header(tot, 4, tcols);
  [42, 16, 11, 8, 10, 10, 13, 16, 50, 14, 16].forEach((w, i) => { tot.getColumn(i + 1).width = w; });
  for (const g of groups) {
    tot.addRow([g.name, g.category, g.total_qty, g.unit, g.stock_qty ?? "", round(g.po_qty + g.po_unassigned) || "", g.not_ordered_qty || "", day(g.earliest), [...new Set(g.jobs.map((j) => j.customer_name))].join(", "), ...(canCost ? [g.purchase_rate || ""] : []),
      ...(canSale ? [Math.round(g.jobs.reduce((t, j) => t + j.qty * (j.sale_rate || 0), 0) * 100) / 100] : [])]);
  }
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename: `what-to-buy-${fileStamp(now)}.xlsx` };
}
