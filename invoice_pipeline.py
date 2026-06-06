import os
import json
import io
import anthropic
import requests
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# ── Config ────────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY       = os.environ["ANTHROPIC_API_KEY"]
ZOHO_ACCESS_TOKEN       = os.environ["ZOHO_ACCESS_TOKEN"]
ZOHO_ORGANIZATION_ID    = os.environ["ZOHO_ORGANIZATION_ID"]
GOOGLE_SERVICE_ACCOUNT_FILE = os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"]
GOOGLE_DRIVE_FOLDER_ID  = os.environ["GOOGLE_DRIVE_FOLDER_ID"]

ZOHO_BASE = "https://books.zoho.com/api/v3"

# ── Pricing Catalog ───────────────────────────────────────────────────────────
# Keys are lowercase normalized service names; add/edit as needed.
PRICING_CATALOG = {
    "web development":        {"unit_price": 500.00},
    "seo audit":              {"unit_price": 250.00},
    "social media management":{"unit_price": 300.00},
    "content writing":        {"unit_price": 150.00},
    "graphic design":         {"unit_price": 200.00},
    "logo design":            {"unit_price": 175.00},
    "email marketing":        {"unit_price": 120.00},
    "ppc campaign":           {"unit_price": 400.00},
    "consulting":             {"unit_price": 180.00},
    "video editing":          {"unit_price": 220.00},
}

# ── Step 1: Parse email with Claude ───────────────────────────────────────────
EMAIL_SCHEMA = {
    "type": "object",
    "properties": {
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
                    "quantity":    {"type": "number"}
                },
                "required": ["description", "quantity"]
            }
        }
    },
    "required": ["customer", "items"]
}

def parse_email_with_claude(email_body: str) -> dict:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        messages=[{
            "role": "user",
            "content": (
                "Extract invoice information from the email below.\n"
                "Return a JSON object with:\n"
                "- customer.name (string)\n"
                "- customer.email (string)\n"
                "- items (array of {description, quantity})\n\n"
                f"Email:\n{email_body}"
            )
        }],
        output_config={
            "format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "invoice_extraction",
                    "schema": EMAIL_SCHEMA
                }
            }
        }
    )
    text_block = next(b for b in response.content if b.type == "text")
    return json.loads(text_block.text)


# ── Step 2: Match items to pricing catalog ────────────────────────────────────
def _best_match(description: str) -> tuple[str, dict] | None:
    """Return (catalog_key, catalog_entry) for the best fuzzy match, or None."""
    desc_lower = description.lower()
    # Exact substring match first
    for key, entry in PRICING_CATALOG.items():
        if key in desc_lower or desc_lower in key:
            return key, entry
    # Word-overlap fallback
    desc_words = set(desc_lower.split())
    best_key, best_entry, best_score = None, None, 0
    for key, entry in PRICING_CATALOG.items():
        score = len(desc_words & set(key.split()))
        if score > best_score:
            best_key, best_entry, best_score = key, entry, score
    if best_score > 0:
        return best_key, best_entry
    return None


def match_to_pricing(parsed_data: dict) -> list[dict]:
    line_items = []
    for item in parsed_data["items"]:
        match = _best_match(item["description"])
        if match is None:
            print(f"  [WARN] No catalog match for '{item['description']}' — skipping")
            continue
        catalog_key, catalog_entry = match
        line_items.append({
            "name":       catalog_key.title(),
            "description": item["description"],
            "rate":       catalog_entry["unit_price"],
            "quantity":   item["quantity"],
        })
    return line_items


# ── Step 3: Create Zoho Invoice ───────────────────────────────────────────────
def create_zoho_invoice(customer_info: dict, line_items: list[dict]) -> dict:
    url = f"{ZOHO_BASE}/invoices"
    headers = {
        "Authorization": f"Zoho-oauthtoken {ZOHO_ACCESS_TOKEN}",
        "Content-Type":  "application/json",
    }
    params = {"organization_id": ZOHO_ORGANIZATION_ID}
    payload = {
        "customer_name": customer_info["name"],
        "line_items":    line_items,
    }
    resp = requests.post(url, headers=headers, params=params, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Zoho API error: {data.get('message')} (code {data.get('code')})")
    return data["invoice"]


# ── Step 4: Email invoice via Zoho ────────────────────────────────────────────
def email_invoice_via_zoho(invoice_id: str, customer_email: str) -> None:
    url = f"{ZOHO_BASE}/invoices/{invoice_id}/email"
    headers = {
        "Authorization": f"Zoho-oauthtoken {ZOHO_ACCESS_TOKEN}",
        "Content-Type":  "application/json",
    }
    params = {"organization_id": ZOHO_ORGANIZATION_ID}
    payload = {
        "to_mail_ids":            [customer_email],
        "send_from_org_email_id": True,
    }
    resp = requests.post(url, headers=headers, params=params, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Zoho email error: {data.get('message')} (code {data.get('code')})")


# ── Step 5: Save invoice link to Google Drive ─────────────────────────────────
def save_link_to_google_drive(invoice_url: str, invoice_number: str) -> str:
    creds = service_account.Credentials.from_service_account_file(
        GOOGLE_SERVICE_ACCOUNT_FILE,
        scopes=["https://www.googleapis.com/auth/drive.file"],
    )
    service = build("drive", "v3", credentials=creds)

    content = f"Invoice Number: {invoice_number}\nInvoice URL: {invoice_url}\n"
    file_stream = io.BytesIO(content.encode("utf-8"))

    file_metadata = {
        "name":    f"Invoice_{invoice_number}.txt",
        "parents": [GOOGLE_DRIVE_FOLDER_ID],
    }
    media = MediaIoBaseUpload(file_stream, mimetype="text/plain")
    uploaded = service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id, webViewLink",
    ).execute()

    return uploaded.get("webViewLink", f"https://drive.google.com/file/d/{uploaded['id']}/view")


# ── Main ──────────────────────────────────────────────────────────────────────
def main(email_body: str) -> None:
    print("Parsing email with Claude...")
    parsed = parse_email_with_claude(email_body)
    print(f"  Customer : {parsed['customer']['name']} <{parsed['customer']['email']}>")
    print(f"  Items    : {len(parsed['items'])} found")

    print("Matching items to pricing catalog...")
    line_items = match_to_pricing(parsed)
    if not line_items:
        raise ValueError("No line items could be matched to the pricing catalog.")
    for li in line_items:
        print(f"  {li['name']:30s}  x{li['quantity']}  @ ${li['rate']:.2f}")

    print("Creating Zoho invoice...")
    invoice = create_zoho_invoice(parsed["customer"], line_items)
    invoice_id     = invoice["invoice_id"]
    invoice_number = invoice.get("invoice_number", invoice_id)
    invoice_url    = invoice.get("invoice_url", "")
    print(f"  Invoice #{invoice_number} created (id: {invoice_id})")

    print("Sending invoice email via Zoho...")
    email_invoice_via_zoho(invoice_id, parsed["customer"]["email"])
    print(f"  Email sent to {parsed['customer']['email']}")

    print("Saving invoice link to Google Drive...")
    drive_link = save_link_to_google_drive(invoice_url, invoice_number)
    print(f"  Drive link: {drive_link}")

    print("\n--- Done ---")
    print(f"Invoice URL : {invoice_url}")
    print(f"Drive link  : {drive_link}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Read email body from a file path passed as argument
        with open(sys.argv[1], "r") as f:
            body = f.read()
    else:
        # Fall back to reading from stdin
        print("Paste email body (Ctrl+D when done):")
        body = sys.stdin.read()

    main(body)
