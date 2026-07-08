#!/usr/bin/env python3
"""
Reads the 'Delivered' tab of the Procurement Tracker sheet,
groups items by PO#, creates one Zoho invoice per PO,
then writes the Zoho invoice number back to the sheet.

Usage:
    python3 create_zoho_from_delivered.py

Set SHEET_ID below after running setup_procurement_sheet.py.
"""
import gspread
import requests
import json
from google.oauth2.service_account import Credentials

# ── CONFIG ──────────────────────────────────────────────
SHEET_ID    = "PASTE_YOUR_SHEET_ID_HERE"   # from setup script output
ORG_ID      = "891277388"
CUSTOMER_ID = "6476846000000705045"         # RAJBY INDUSTRIES
ZOHO_TOKEN_FILE = "zoho_token.json"         # refresh token file (see below)
# ────────────────────────────────────────────────────────

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
creds = Credentials.from_service_account_file("google_creds.json", scopes=SCOPES)
gc = gspread.authorize(creds)

def get_access_token():
    """Read cached access token or refresh it."""
    with open(ZOHO_TOKEN_FILE) as f:
        tok = json.load(f)
    if "access_token" in tok:
        return tok["access_token"]
    raise ValueError("No access_token in zoho_token.json. Run zoho_auth.py first.")

def create_zoho_invoice(po_num, date_str, line_items, access_token):
    """date_str: dd-Mon-yyyy → convert to yyyy-mm-dd"""
    from datetime import datetime
    try:
        d = datetime.strptime(date_str, "%d-%b-%Y")
        date_fmt = d.strftime("%Y-%m-%d")
    except Exception:
        date_fmt = ""

    payload = {
        "customer_id": CUSTOMER_ID,
        "reference_number": f"PO# {po_num}",
        "date": date_fmt,
        "line_items": [
            {"name": it["name"], "unit": it["uom"],
             "quantity": it["qty"], "rate": it["rate"]}
            for it in line_items
        ]
    }
    resp = requests.post(
        f"https://www.zohoapis.com/books/v3/invoices?organization_id={ORG_ID}",
        headers={"Authorization": f"Zoho-oauthtoken {access_token}",
                 "Content-Type": "application/json"},
        json=payload,
        timeout=30
    )
    data = resp.json()
    if data.get("code") == 0:
        inv = data["invoice"]
        return inv["invoice_number"], inv["invoice_id"]
    else:
        raise RuntimeError(f"Zoho error for PO {po_num}: {data}")

def main():
    sh = gc.open_by_key(SHEET_ID)
    ws = sh.worksheet("Delivered")
    rows = ws.get_all_values()

    if len(rows) <= 1:
        print("No delivered items found.")
        return

    headers = rows[0]
    # Cols: Sr#(0) PO#(1) Unit(2) Item(3) UOM(4) Qty(5) Rate(6) Amt(7)
    #       Tax%(8) Total(9) PODate(10) Status(11) DelivDate(12) ZohoInv#(13)

    # Group by PO#, skip rows that already have an invoice number
    po_groups = {}
    row_indices = {}  # po -> list of sheet row indices (1-based, accounting for header)

    for i, row in enumerate(rows[1:], start=2):
        po      = str(row[1]).strip()
        inv_num = str(row[13]).strip()
        if inv_num:
            continue  # already invoiced
        if po not in po_groups:
            po_groups[po] = []
            row_indices[po] = []
        po_groups[po].append({
            "name": row[3], "uom": row[4],
            "qty": float(row[5]) if row[5] else 0,
            "rate": float(row[6]) if row[6] else 0,
            "date": row[10],
        })
        row_indices[po].append(i)

    if not po_groups:
        print("All delivered items already have invoices.")
        return

    token = get_access_token()
    print(f"Found {len(po_groups)} PO(s) to invoice: {list(po_groups.keys())}\n")

    for po, items in po_groups.items():
        date = items[0]["date"] if items else ""
        try:
            inv_num, inv_id = create_zoho_invoice(po, date, items, token)
            print(f"✅ PO# {po} → {inv_num} ({len(items)} items)")

            # Write invoice number back to sheet for each row
            for sheet_row in row_indices[po]:
                ws.update_cell(sheet_row, 14, inv_num)
        except Exception as ex:
            print(f"❌ PO# {po} failed: {ex}")

    print("\nDone!")

if __name__ == "__main__":
    main()
