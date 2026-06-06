"""
PO Pipeline
-----------
Polls Gmail for unread emails with PDF attachments, extracts Purchase Order
data from each PDF using Claude (vision), appends a row to a Google Sheet
(order sheet), and creates + emails a Zoho Books invoice automatically.

Required environment variables:
  ANTHROPIC_API_KEY
  ZOHO_ACCESS_TOKEN
  ZOHO_ORGANIZATION_ID
  GOOGLE_DRIVE_FOLDER_ID   – Drive folder to save invoice links
  GOOGLE_SHEET_ID          – Spreadsheet ID of the order sheet
  GMAIL_USER               – Gmail address to monitor (e.g. you@gmail.com)

One-time setup:
  1. Run  python gmail_auth.py  to generate token.json
  2. Then run this script normally

Run once:
  python po_pipeline.py

Run as a polling loop (every 60 s):
  python po_pipeline.py --loop
"""

import os
import sys
import base64
import json
import time
import io
import argparse

import anthropic
import requests
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# ── Config ────────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY      = os.environ["ANTHROPIC_API_KEY"]
ZOHO_ACCESS_TOKEN      = os.environ["ZOHO_ACCESS_TOKEN"]
ZOHO_ORGANIZATION_ID   = os.environ["ZOHO_ORGANIZATION_ID"]
GOOGLE_DRIVE_FOLDER_ID = os.environ["GOOGLE_DRIVE_FOLDER_ID"]
GOOGLE_SHEET_ID        = os.environ["GOOGLE_SHEET_ID"]
GMAIL_USER             = os.environ["GMAIL_USER"]

TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token.json")

ZOHO_BASE = "https://books.zoho.com/api/v3"

GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

# Sheet column headers (must match row building in append_to_sheet)
SHEET_HEADERS = [
    "Date", "PO Number", "Customer Name", "Customer Email",
    "Item", "Quantity", "Unit Price", "Line Total",
    "Invoice Number", "Invoice URL", "Drive Link",
]

# ── Pricing Catalog ───────────────────────────────────────────────────────────
PRICING_CATALOG = {
    "web development":         {"unit_price": 500.00},
    "seo audit":               {"unit_price": 250.00},
    "social media management": {"unit_price": 300.00},
    "content writing":         {"unit_price": 150.00},
    "graphic design":          {"unit_price": 200.00},
    "logo design":             {"unit_price": 175.00},
    "email marketing":         {"unit_price": 120.00},
    "ppc campaign":            {"unit_price": 400.00},
    "consulting":              {"unit_price": 180.00},
    "video editing":           {"unit_price": 220.00},
}

PO_SCHEMA = {
    "type": "object",
    "properties": {
        "po_number":   {"type": "string"},
        "customer": {
            "type": "object",
            "properties": {
                "name":  {"type": "string"},
                "email": {"type": "string"}
            },
            "required": ["name", "email"]
        },
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "quantity":    {"type": "number"},
                    "unit_price":  {"type": "number"}
                },
                "required": ["description", "quantity"]
            }
        }
    },
    "required": ["po_number", "customer", "items"]
}


# ── Google service builders ───────────────────────────────────────────────────
def _load_oauth_credentials() -> Credentials:
    if not os.path.exists(TOKEN_FILE):
        raise FileNotFoundError(
            f"'{TOKEN_FILE}' not found.\n"
            "Run  python gmail_auth.py  first to authorise your Google account."
        )
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, GOOGLE_SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return creds


def _google_services():
    creds  = _load_oauth_credentials()
    gmail  = build("gmail",  "v1", credentials=creds)
    sheets = build("sheets", "v4", credentials=creds)
    drive  = build("drive",  "v3", credentials=creds)
    return gmail, sheets, drive


# ── Step 1: Fetch unread Gmail messages with PDF attachments ──────────────────
def fetch_unread_po_emails(gmail) -> list[dict]:
    """Return list of {message_id, sender_email, pdf_bytes, pdf_name}."""
    query = "is:unread has:attachment filename:pdf"
    result = gmail.users().messages().list(
        userId=GMAIL_USER, q=query, maxResults=20
    ).execute()

    messages = result.get("messages", [])
    emails = []
    for m in messages:
        msg = gmail.users().messages().get(
            userId=GMAIL_USER, id=m["id"], format="full"
        ).execute()

        sender = ""
        for header in msg["payload"].get("headers", []):
            if header["name"].lower() == "from":
                sender = header["value"]

        pdfs = _extract_pdf_parts(gmail, msg)
        if pdfs:
            emails.append({
                "message_id":   m["id"],
                "sender_email": sender,
                "pdfs":         pdfs,
            })
    return emails


def _extract_pdf_parts(gmail, msg: dict) -> list[dict]:
    """Recursively find PDF attachment parts, return list of {name, bytes}."""
    parts = []
    _walk_parts(gmail, msg["id"], msg["payload"], parts)
    return parts


def _walk_parts(gmail, message_id: str, part: dict, out: list):
    mime = part.get("mimeType", "")
    filename = part.get("filename", "")

    if mime == "application/pdf" or filename.lower().endswith(".pdf"):
        attachment_id = part.get("body", {}).get("attachmentId")
        if attachment_id:
            att = gmail.users().messages().attachments().get(
                userId=GMAIL_USER, messageId=message_id, id=attachment_id
            ).execute()
            pdf_bytes = base64.urlsafe_b64decode(att["data"])
            out.append({"name": filename or "attachment.pdf", "bytes": pdf_bytes})

    for sub in part.get("parts", []):
        _walk_parts(gmail, message_id, sub, out)


def mark_as_read(gmail, message_id: str):
    gmail.users().messages().modify(
        userId=GMAIL_USER,
        id=message_id,
        body={"removeLabelIds": ["UNREAD"]}
    ).execute()


# ── Step 2: Extract PO data from PDF using Claude ─────────────────────────────
def extract_po_from_pdf(pdf_bytes: bytes) -> dict:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Encode PDF as base64 for Claude's document block
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": pdf_b64,
                    }
                },
                {
                    "type": "text",
                    "text": (
                        "Extract all purchase order information from this PDF. "
                        "Return a JSON object with: po_number, customer.name, "
                        "customer.email, and items[] (each with description, "
                        "quantity, and unit_price if shown). "
                        "If unit_price is not in the PDF, set it to 0."
                    )
                }
            ]
        }],
        output_config={
            "format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "po_extraction",
                    "schema": PO_SCHEMA
                }
            }
        }
    )
    text_block = next(b for b in response.content if b.type == "text")
    return json.loads(text_block.text)


# ── Step 3: Match items to pricing catalog ────────────────────────────────────
def _best_match(description: str):
    desc_lower = description.lower()
    for key, entry in PRICING_CATALOG.items():
        if key in desc_lower or desc_lower in key:
            return key, entry
    desc_words = set(desc_lower.split())
    best_key, best_entry, best_score = None, None, 0
    for key, entry in PRICING_CATALOG.items():
        score = len(desc_words & set(key.split()))
        if score > best_score:
            best_key, best_entry, best_score = key, entry, score
    if best_score > 0:
        return best_key, best_entry
    return None, None


def build_line_items(po_data: dict) -> list[dict]:
    line_items = []
    for item in po_data["items"]:
        cat_key, cat_entry = _best_match(item["description"])
        # Use PDF price if given, else catalog price, else 0
        pdf_price = item.get("unit_price", 0)
        price = pdf_price if pdf_price > 0 else (cat_entry["unit_price"] if cat_entry else 0)
        name  = cat_key.title() if cat_key else item["description"]

        line_items.append({
            "name":        name,
            "description": item["description"],
            "rate":        price,
            "quantity":    item["quantity"],
        })
    return line_items


# ── Step 4: Create & email Zoho invoice ───────────────────────────────────────
def create_zoho_invoice(customer: dict, line_items: list[dict]) -> dict:
    headers = {
        "Authorization": f"Zoho-oauthtoken {ZOHO_ACCESS_TOKEN}",
        "Content-Type":  "application/json",
    }
    params  = {"organization_id": ZOHO_ORGANIZATION_ID}
    payload = {"customer_name": customer["name"], "line_items": line_items}
    resp = requests.post(
        f"{ZOHO_BASE}/invoices", headers=headers, params=params, json=payload, timeout=30
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Zoho create error: {data.get('message')}")
    return data["invoice"]


def email_zoho_invoice(invoice_id: str, customer_email: str):
    headers = {
        "Authorization": f"Zoho-oauthtoken {ZOHO_ACCESS_TOKEN}",
        "Content-Type":  "application/json",
    }
    params  = {"organization_id": ZOHO_ORGANIZATION_ID}
    payload = {"to_mail_ids": [customer_email], "send_from_org_email_id": True}
    resp = requests.post(
        f"{ZOHO_BASE}/invoices/{invoice_id}/email",
        headers=headers, params=params, json=payload, timeout=30
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Zoho email error: {data.get('message')}")


# ── Step 5: Append row to Google Sheet ───────────────────────────────────────
def ensure_sheet_headers(sheets):
    """Write header row if sheet is empty."""
    result = sheets.spreadsheets().values().get(
        spreadsheetId=GOOGLE_SHEET_ID, range="Sheet1!A1:Z1"
    ).execute()
    if not result.get("values"):
        sheets.spreadsheets().values().update(
            spreadsheetId=GOOGLE_SHEET_ID,
            range="Sheet1!A1",
            valueInputOption="RAW",
            body={"values": [SHEET_HEADERS]}
        ).execute()


def append_to_sheet(sheets, po_data: dict, line_items: list[dict],
                    invoice_number: str, invoice_url: str, drive_link: str):
    from datetime import date
    today = date.today().isoformat()
    customer = po_data["customer"]

    rows = []
    for li in line_items:
        line_total = round(li["rate"] * li["quantity"], 2)
        rows.append([
            today,
            po_data.get("po_number", ""),
            customer["name"],
            customer["email"],
            li["name"],
            li["quantity"],
            li["rate"],
            line_total,
            invoice_number,
            invoice_url,
            drive_link,
        ])

    sheets.spreadsheets().values().append(
        spreadsheetId=GOOGLE_SHEET_ID,
        range="Sheet1!A1",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": rows}
    ).execute()


# ── Step 6: Save invoice link to Google Drive ─────────────────────────────────
def save_link_to_drive(drive, invoice_url: str, invoice_number: str) -> str:
    content = f"Invoice Number: {invoice_number}\nInvoice URL: {invoice_url}\n"
    stream  = io.BytesIO(content.encode("utf-8"))
    metadata = {
        "name":    f"Invoice_{invoice_number}.txt",
        "parents": [GOOGLE_DRIVE_FOLDER_ID],
    }
    media    = MediaIoBaseUpload(stream, mimetype="text/plain")
    uploaded = drive.files().create(
        body=metadata, media_body=media, fields="id,webViewLink"
    ).execute()
    return uploaded.get("webViewLink", f"https://drive.google.com/file/d/{uploaded['id']}/view")


# ── Orchestrator ──────────────────────────────────────────────────────────────
def process_email(gmail, sheets, drive, email_record: dict):
    message_id = email_record["message_id"]

    for pdf in email_record["pdfs"]:
        print(f"\n  PDF: {pdf['name']}")

        print("  Extracting PO data with Claude...")
        po_data = extract_po_from_pdf(pdf["bytes"])
        po_num  = po_data.get("po_number", "N/A")
        customer = po_data["customer"]
        print(f"  PO #{po_num}  |  {customer['name']} <{customer['email']}>")

        print("  Building line items...")
        line_items = build_line_items(po_data)
        if not line_items:
            print("  [WARN] No line items matched — skipping invoice creation")
            continue

        print("  Creating Zoho invoice...")
        invoice = create_zoho_invoice(customer, line_items)
        inv_id     = invoice["invoice_id"]
        inv_number = invoice.get("invoice_number", inv_id)
        inv_url    = invoice.get("invoice_url", "")
        print(f"  Invoice #{inv_number} created")

        print(f"  Emailing invoice to {customer['email']}...")
        email_zoho_invoice(inv_id, customer["email"])

        print("  Saving link to Google Drive...")
        drive_link = save_link_to_drive(drive, inv_url, inv_number)

        print("  Updating order sheet...")
        ensure_sheet_headers(sheets)
        append_to_sheet(sheets, po_data, line_items, inv_number, inv_url, drive_link)

        print(f"  Done — Invoice: {inv_url}")
        print(f"         Sheet : https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}")
        print(f"         Drive : {drive_link}")

    # Mark email as read so it won't be processed again
    mark_as_read(gmail, message_id)


def run_once():
    print("Building Google service clients...")
    gmail, sheets, drive = _google_services()

    print(f"Checking Gmail ({GMAIL_USER}) for unread PO emails...")
    emails = fetch_unread_po_emails(gmail)

    if not emails:
        print("No unread emails with PDF attachments found.")
        return

    print(f"Found {len(emails)} email(s) to process.")
    for email_record in emails:
        print(f"\nProcessing message {email_record['message_id']}...")
        try:
            process_email(gmail, sheets, drive, email_record)
        except Exception as exc:
            print(f"  [ERROR] {exc}")


def run_loop(interval_seconds: int = 60):
    print(f"Starting polling loop (every {interval_seconds}s). Ctrl+C to stop.")
    while True:
        try:
            run_once()
        except Exception as exc:
            print(f"[ERROR] {exc}")
        print(f"\nSleeping {interval_seconds}s...\n")
        time.sleep(interval_seconds)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PO PDF → Order Sheet + Zoho Invoice pipeline")
    parser.add_argument("--loop", action="store_true", help="Poll Gmail continuously")
    parser.add_argument("--interval", type=int, default=60, help="Poll interval in seconds (default 60)")
    args = parser.parse_args()

    if args.loop:
        run_loop(args.interval)
    else:
        run_once()
