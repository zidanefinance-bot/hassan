// Printable PDF of a document (invoice, delivery challan, quote, purchase order...) for emailing.
// Delivery challans carry quantities only, no rates, with a receiving signature box.
import PDFDocument from "pdfkit";
import { getSetting } from "./books.js";

const TITLE = { quote: "QUOTATION", invoice: "INVOICE", dc: "DELIVERY CHALLAN", po: "PURCHASE ORDER", bill: "SUPPLIER BILL", credit_note: "CREDIT NOTE", vendor_credit: "VENDOR CREDIT" };
const RED = "#C22A2F", INK = "#1D2433", MUTED = "#6B7587", LINE = "#E2E5EB";
const rs = (n) => `Rs ${Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n) => Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
const date = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

export function documentPdf(db, docId) {
  const d = db.prepare("SELECT * FROM documents WHERE id = ?").get(docId);
  const c = db.prepare("SELECT * FROM contacts WHERE id = ?").get(d.contact_id);
  const job = d.job_id ? db.prepare("SELECT number, customer_po_number, delivery_location FROM jobs WHERE id = ?").get(d.job_id) : null;
  const lines = db.prepare("SELECT l.*, i.name AS item_name, i.unit FROM document_lines l LEFT JOIN items i ON i.id = l.item_id WHERE document_id = ? ORDER BY l.id").all(docId);
  const co = getSetting(db, "company") || {};
  const isDc = d.kind === "dc";
  const supplierSide = ["po", "bill", "vendor_credit"].includes(d.kind);
  // the thank-you line is for customers' quotes / invoices / credit notes, not DCs or our supplier paperwork
  const footer = ["quote", "invoice", "credit_note"].includes(d.kind) ? getSetting(db, "invoiceFooter") || "" : "";
  // the customer's DCs and invoices of the same Job are named on each other
  const linked = d.job_id && (d.kind === "invoice" || isDc) ? db.prepare(`SELECT number FROM documents WHERE job_id = ? AND kind = ? AND status IN (${isDc ? "'open'" : "'issued','signed'"}) ORDER BY id`).all(d.job_id, isDc ? "invoice" : "dc").map((x) => x.number) : [];
  // a supplier never sees which customer's PO the goods are for
  const ref = supplierSide ? d.reference : job?.customer_po_number || d.reference;

  const pdf = new PDFDocument({ size: "A4", margin: 48, info: { Title: `${TITLE[d.kind]} ${d.number}`, Author: co.name } });
  const chunks = [];
  pdf.on("data", (b) => chunks.push(b));
  const done = new Promise((ok) => pdf.on("end", () => ok(Buffer.concat(chunks))));
  const W = pdf.page.width - 96, L = 48;

  // header: company left, document title right
  pdf.fillColor(RED).font("Helvetica-Bold").fontSize(20).text(co.name || "Zidane Wholesale Solutions", L, 48, { width: W * 0.6 });
  pdf.fillColor(MUTED).font("Helvetica").fontSize(9).text([co.address, co.phone, co.email, co.website, co.ntn && `NTN ${co.ntn}`, co.strn && `STRN ${co.strn}`].filter(Boolean).join("\n"), L, pdf.y + 4, { width: W * 0.6 });
  const headBottom = pdf.y;
  pdf.fillColor(RED).font("Helvetica-Bold").fontSize(18).text(TITLE[d.kind], L, 48, { width: W, align: "right" });
  pdf.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(d.number, { width: W, align: "right" });
  pdf.font("Helvetica").fontSize(9).fillColor(MUTED).text([`Date: ${date(d.date)}`, d.due_date && !isDc && `Due: ${date(d.due_date)}`, job && !supplierSide && `Job: ${job.number}`, ref && `${!supplierSide && job?.customer_po_number ? "Your PO" : "Ref"}: ${ref}`, linked.length && `${isDc ? "Invoice" : "DC"}: ${linked.join(", ")}`].filter(Boolean).join("\n"), { width: W, align: "right" });
  let y = Math.max(headBottom, pdf.y) + 18;

  // bill to / deliver to
  pdf.fillColor(MUTED).fontSize(8).text(d.kind === "po" || d.kind === "bill" || d.kind === "vendor_credit" ? "SUPPLIER" : isDc ? "DELIVER TO" : "BILL TO", L, y);
  pdf.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(c.name, L, pdf.y + 2);
  // a DC goes to the Job's delivery location (store / plant), when it has one
  pdf.font("Helvetica").fontSize(9).fillColor(MUTED).text([isDc && job?.delivery_location ? `At: ${job.delivery_location}` : null, c.company, isDc && job?.delivery_location ? null : c.address, c.phone, c.ntn && `NTN ${c.ntn}`].filter(Boolean).join("\n"));
  y = pdf.y + 16;

  // lines
  const cols = isDc ? [["#", 24, "left"], ["Item", W - 24 - 140, "left"], ["Quantity", 140, "right"]]
    : [["#", 24, "left"], ["Item", W - 24 - 60 - 80 - 50 - 90, "left"], ["Qty", 60, "right"], ["Rate", 80, "right"], ["Tax", 50, "right"], ["Amount", 90, "right"]];
  const row = (vals, bold) => {
    let x = L;
    const h = Math.max(...vals.map((v, i) => pdf.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).heightOfString(String(v), { width: cols[i][1] - 6 })));
    if (y + h > pdf.page.height - 120) { pdf.addPage(); y = 48; }
    vals.forEach((v, i) => { pdf.fillColor(bold ? MUTED : INK).text(String(v), x + 3, y, { width: cols[i][1] - 6, align: cols[i][2] }); x += cols[i][1]; });
    y += h + 8;
    pdf.moveTo(L, y - 4).lineTo(L + W, y - 4).strokeColor(LINE).lineWidth(0.5).stroke();
  };
  pdf.rect(L, y - 4, W, 18).fill("#F3F4F7");
  row(cols.map((c) => c[0].toUpperCase()), true);
  lines.forEach((l, i) => {
    const name = l.item_name || l.description || "";
    const label = l.item_name && l.description && l.description !== l.item_name ? `${name}\n${l.description}` : name;
    row(isDc ? [i + 1, label, `${qty(l.qty)} ${l.unit || ""}`] : [i + 1, label, `${qty(l.qty)} ${l.unit || ""}`, rs(l.rate), `${qty(l.tax_rate)}%`, rs(l.amount)]);
  });

  if (!isDc) {
    y += 6;
    const tot = [["Subtotal", d.subtotal], d.discount_total > 0 && ["Discount", -d.discount_total], d.doc_discount > 0 && ["Discount", -d.doc_discount], ["Tax", d.tax_total], d.charges ? [d.charges_label || "Charges", d.charges] : null, d.adjustment ? ["Adjustment", d.adjustment] : null].filter(Boolean);
    for (const [k, v] of tot) { pdf.font("Helvetica").fontSize(9).fillColor(MUTED).text(k, L + W - 230, y, { width: 120 }); pdf.fillColor(INK).text(rs(v), L + W - 110, y, { width: 110, align: "right" }); y += 15; }
    pdf.moveTo(L + W - 230, y).lineTo(L + W, y).strokeColor(INK).lineWidth(0.8).stroke(); y += 6;
    pdf.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("Total", L + W - 230, y, { width: 120 }).text(rs(d.total), L + W - 130, y, { width: 130, align: "right" });
    y += 24;
  }
  if (d.notes) { pdf.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Notes", L, y); pdf.font("Helvetica").fillColor(MUTED).text(d.notes, L, pdf.y + 2, { width: W }); y = pdf.y + 10; }
  if (d.terms) { pdf.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Terms", L, y); pdf.font("Helvetica").fillColor(MUTED).text(d.terms, L, pdf.y + 2, { width: W }); y = pdf.y + 10; }

  if (isDc) {
    y = Math.max(y + 30, pdf.page.height - 200);
    pdf.font("Helvetica").fontSize(9).fillColor(MUTED).text("Received the above goods in good condition.", L, y);
    y += 40;
    for (const [i, t] of ["Receiver's name & signature", "Stamp", "Date"].entries()) {
      const x = L + i * (W / 3);
      pdf.moveTo(x, y).lineTo(x + W / 3 - 20, y).strokeColor(INK).lineWidth(0.6).stroke();
      pdf.fontSize(8).fillColor(MUTED).text(t, x, y + 4);
    }
    if (d.signed_by_name) pdf.fontSize(9).fillColor(INK).text(`Signed by ${d.signed_by_name}${d.signed_at ? ` on ${date(String(d.signed_at).slice(0, 10))}` : ""}`, L, y - 18);
  }
  if (footer) pdf.font("Helvetica").fontSize(8).fillColor(MUTED).text(footer, L, pdf.page.height - 70, { width: W, align: "center" });
  pdf.end();
  return done.then((buf) => ({ buffer: buf, filename: `${d.number}.pdf` }));
}
