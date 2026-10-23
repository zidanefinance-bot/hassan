// AI reading of incoming paperwork: a customer's PO / order message, or a supplier's bill (text, photo or PDF).
// Claude returns a structured draft matched to our own items and contacts; a person always reviews it before anything is saved.
// Needs ANTHROPIC_API_KEY in the server environment. Without it the inbox still collects emails, it just doesn't read them.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
export const aiReady = () => Boolean(process.env.ANTHROPIC_API_KEY);
let client;
const anthropic = () => (client ||= new Anthropic());

const Line = z.object({
  description: z.string().describe("Item as written on the paper"),
  qty: z.number(),
  unit: z.string().nullable(),
  rate: z.number().nullable().describe("Price per unit, excluding tax, if written. null if not given"),
  tax_rate: z.number().nullable().describe("Sales tax % on this line if shown, e.g. 18. null if not shown"),
  item_match_id: z.number().int().nullable().describe("id from OUR ITEMS that is the same product, or null if none is clearly the same"),
  match_confidence: z.enum(["high", "low", "none"]),
});
export const Extraction = z.object({
  doc_type: z.enum(["customer_order", "supplier_bill", "other"]).describe("customer_order: a customer asking us to supply goods (PO, order, enquiry). supplier_bill: a supplier billing us. other: anything else"),
  summary: z.string().describe("One short line, e.g. 'PO 4471 from Al-Noor for 3 items, needed by 21 Oct'"),
  party_name: z.string().nullable().describe("The customer (for orders) or supplier (for bills) as written"),
  party_match_id: z.number().int().nullable().describe("id from OUR CONTACTS of the right type that is the same company, or null"),
  reference: z.string().nullable().describe("Customer PO number, or the supplier's bill/invoice number"),
  date: z.string().nullable().describe("Document date as YYYY-MM-DD"),
  required_date: z.string().nullable().describe("Orders: delivery needed by, YYYY-MM-DD. Bills: due date, YYYY-MM-DD"),
  delivery_location: z.string().nullable(),
  lines: z.array(Line),
  total: z.number().nullable().describe("Grand total if written on the paper"),
  buyer_name: z.string().nullable().describe("The person on the customer's / supplier's side: contact person, buyer, or who prepared the PO"),
  contact_phone: z.string().nullable(),
  payment_terms: z.string().nullable().describe("Payment terms as written, e.g. '30 DAYS CREDIT'"),
  payment_terms_days: z.number().int().nullable().describe("Credit days from the payment terms; 0 for cash/advance; null if not written"),
  party_ntn: z.string().nullable().describe("The customer's / supplier's NTN (not ours)"),
  party_strn: z.string().nullable().describe("The customer's / supplier's sales tax registration number (not ours)"),
  party_address: z.string().nullable().describe("The customer's / supplier's own address (not Zidane's address, which may also be printed)"),
  notes: z.string().nullable().describe("Anything important that doesn't fit above: special instructions, missing information, doubts"),
});

const SYSTEM = `You read business paperwork for Zidane Corporation, a B2B grocery and FMCG supplier in Karachi, Pakistan.
Messages may be in English, Urdu or Roman Urdu, and may be emails, WhatsApp-style text, photos of handwritten or printed paper, or PDFs.
Extract what is actually written. Never invent quantities, rates or dates; use null when something isn't there.
Match products to OUR ITEMS only when they are clearly the same product and pack size (e.g. "atta 10 kg bag" = "Super Fine Atta 10kg"); otherwise item_match_id = null.
Match the company to OUR CONTACTS only when clearly the same business; customers for orders, suppliers for bills.
Convert dates to YYYY-MM-DD (dates in Pakistan are usually written day/month/year). Rates are in Pakistani rupees.`;

const IMAGE = /^image\/(jpeg|png|gif|webp)$/;
// what Claude can read directly; other files are listed by name only
export const readable = (mime) => IMAGE.test(mime) || mime === "application/pdf" || /^text\//.test(mime);

// catalog: [{id, name, sku, unit}], contacts: [{id, type, name}], files: [{filename, mime, buffer}]
export async function readPaperwork({ text = "", subject = "", from = "", files = [], catalog = [], contacts = [] }) {
  if (!aiReady()) throw Object.assign(new Error("AI is not set up yet: add ANTHROPIC_API_KEY on the server"), { status: 503 });
  const content = [];
  const skipped = [];
  for (const f of files) {
    if (IMAGE.test(f.mime)) content.push({ type: "image", source: { type: "base64", media_type: f.mime, data: f.buffer.toString("base64") } });
    else if (f.mime === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.buffer.toString("base64") }, title: f.filename });
    else if (/^text\//.test(f.mime)) content.push({ type: "text", text: `Attached file ${f.filename}:\n${f.buffer.toString("utf8").slice(0, 200000)}` });
    else skipped.push(f.filename);
  }
  const items = catalog.map((i) => `${i.id} | ${i.name}${i.sku ? ` | ${i.sku}` : ""} | ${i.unit}`).join("\n");
  const people = contacts.map((c) => `${c.id} | ${c.type} | ${c.name}`).join("\n");
  content.push({
    type: "text",
    text: [`OUR ITEMS (id | name | sku | unit):\n${items || "(none yet)"}`, `OUR CONTACTS (id | type | name):\n${people || "(none yet)"}`,
      `MESSAGE${from ? ` from ${from}` : ""}${subject ? `, subject "${subject}"` : ""}:\n${text || "(no text, see the attachments)"}`,
      skipped.length ? `Attachments that could not be opened: ${skipped.join(", ")}` : ""].filter(Boolean).join("\n\n"),
  });
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: betaZodOutputFormat(Extraction) },
    // if the main model declines, the API retries on its default fallback model inside the same call
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (response.stop_reason === "refusal") throw new Error("The AI declined to read this message");
  if (response.stop_reason === "max_tokens") throw new Error("The message was too long to read in one go");
  if (!response.parsed_output) throw new Error("The AI reply could not be understood");
  return { ...response.parsed_output, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens }, skipped };
}
