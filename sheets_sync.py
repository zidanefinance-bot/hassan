#!/usr/bin/env python3
"""
Gmail → Google Sheets Real-Time Sync
Sheet khula ho ya band — updates live aati hain, kuch karna nahi.
"""

import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import json
import os

SHEET_NAME    = "Hassan Quotation Tracker"
CREDS_FILE    = "google_creds.json"
SEEN_FILE     = "seen_message_ids.json"

HEADERS = [
    "Sr#", "Requester Name", "Email ID", "PR Number",
    "Item Description", "UOM", "Qty", "Rate (PKR)",
    "Query Date", "Query Time", "Status",
    "Quotation Sent Date", "Remarks", "Days Pending"
]

MY_EMAIL = "zidanecorporation@gmail.com"

SKIP_KEYWORDS = [
    "instagram", "facebook", "unsubscribe", "wht deduction",
    "withholding", "purchase order", "delivery challan", "invoice"
]

QUOTATION_KEYWORDS = [
    "quotation", "quote", "rfq", "best rate", "kindly send",
    "price", "pr#", "pr-", "requisition", "request of quotation"
]

REMINDER_KEYWORDS = ["reminder", "follow up", "follow-up", "kindly revert"]

# Colors (Google Sheets RGB 0-1 scale)
COLORS = {
    "header":  {"red": 0.122, "green": 0.306, "blue": 0.475},
    "pending": {"red": 1.0,   "green": 0.843, "blue": 0.0},
    "overdue": {"red": 1.0,   "green": 0.267, "blue": 0.267},
    "sent":    {"red": 0.439, "green": 0.678, "blue": 0.278},
    "white":   {"red": 1.0,   "green": 1.0,   "blue": 1.0},
    "alt":     {"red": 0.867, "green": 0.918, "blue": 0.945},
}

def get_sheet():
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
    creds = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
    gc    = gspread.authorize(creds)
    try:
        sh = gc.open(SHEET_NAME)
    except gspread.SpreadsheetNotFound:
        sh = gc.create(SHEET_NAME)
        sh.share(MY_EMAIL, perm_type="user", role="writer")
        print(f"✅ New sheet created & shared with {MY_EMAIL}")
    return sh.sheet1

def setup_header(ws):
    ws.clear()
    ws.append_row(HEADERS)
    # Bold + blue header
    ws.format("A1:N1", {
        "backgroundColor": COLORS["header"],
        "textFormat": {"bold": True, "foregroundColor": COLORS["white"], "fontSize": 11},
        "horizontalAlignment": "CENTER",
        "verticalAlignment": "MIDDLE"
    })
    ws.freeze(rows=1)
    # Column widths
    widths = [50,180,260,120,400,70,70,110,120,100,110,180,350,110]
    requests = [{"updateDimensionProperties": {
        "range": {"sheetId": ws.id, "dimension": "COLUMNS",
                  "startIndex": i, "endIndex": i+1},
        "properties": {"pixelSize": w}, "fields": "pixelSize"
    }} for i, w in enumerate(widths)]
    ws.spreadsheet.batch_update({"requests": requests})

def get_last_sr(ws):
    vals = ws.col_values(1)
    nums = [int(v) for v in vals[1:] if str(v).isdigit()]
    return max(nums) if nums else 0

def row_exists(ws, msg_id):
    """Check seen_ids file instead of scanning sheet"""
    seen = load_seen()
    return msg_id in seen

def add_row_to_sheet(ws, data_row, status):
    ws.append_row(data_row, value_input_option="USER_ENTERED")
    last = ws.row_count if ws.row_count else len(ws.get_all_values())
    actual_row = len(ws.get_all_values())

    if status == "OVERDUE":
        color = COLORS["overdue"]; fc = COLORS["white"]
    elif status == "Sent":
        color = {"red": 0.91, "green": 0.96, "blue": 0.88}; fc = {"red":0,"green":0,"blue":0}
    else:
        color = {"red": 1.0, "green": 0.992, "blue": 0.902}; fc = {"red":0,"green":0,"blue":0}

    ws.format(f"A{actual_row}:N{actual_row}", {
        "backgroundColor": color,
        "textFormat": {"foregroundColor": fc, "fontSize": 10},
        "horizontalAlignment": "CENTER",
        "verticalAlignment": "MIDDLE",
        "wrapStrategy": "WRAP"
    })
    # Status cell bold
    col_k = f"K{actual_row}"
    if status == "OVERDUE":
        st_color = COLORS["overdue"]
    elif status == "Sent":
        st_color = COLORS["sent"]
    else:
        st_color = COLORS["pending"]
    ws.format(col_k, {
        "backgroundColor": st_color,
        "textFormat": {"bold": True, "foregroundColor": COLORS["white"], "fontSize": 10}
    })

def mark_sent_in_sheet(ws, pr_number, sent_time):
    all_rows = ws.get_all_values()
    for i, row in enumerate(all_rows[1:], 2):
        if len(row) < 11:
            continue
        row_pr     = row[3]
        row_status = row[10]
        if row_status in ("Sent", "sent"):
            continue
        if pr_number and pr_number in row_pr:
            ws.update_cell(i, 11, "Sent")
            ws.update_cell(i, 12, sent_time)
            ws.format(f"A{i}:N{i}", {"backgroundColor": {"red":0.91,"green":0.96,"blue":0.88}})
            ws.format(f"K{i}", {
                "backgroundColor": COLORS["sent"],
                "textFormat": {"bold": True, "foregroundColor": COLORS["white"]}
            })

def mark_overdue_in_sheet(ws, pr_number, company):
    all_rows = ws.get_all_values()
    for i, row in enumerate(all_rows[1:], 2):
        if len(row) < 11:
            continue
        row_pr   = row[3]
        row_co   = row[1]
        row_st   = row[10]
        if row_st in ("Sent",):
            continue
        if (pr_number and pr_number in row_pr) or (company and company in row_co):
            ws.update_cell(i, 11, "OVERDUE")
            existing_rem = row[12] if len(row) > 12 else ""
            ws.update_cell(i, 13, (existing_rem + " | ⚠️ Reminder").strip(" |"))
            ws.format(f"A{i}:N{i}", {"backgroundColor": COLORS["overdue"],
                                      "textFormat": {"foregroundColor": COLORS["white"]}})
            ws.format(f"K{i}", {"backgroundColor": COLORS["overdue"],
                                 "textFormat": {"bold": True, "foregroundColor": COLORS["white"]}})

def refresh_days_pending(ws):
    now = datetime.now()
    all_rows = ws.get_all_values()
    updates = []
    for i, row in enumerate(all_rows[1:], 2):
        if len(row) < 11:
            continue
        status   = row[10]
        date_str = row[8]
        if status not in ("Pending", "OVERDUE") or not date_str:
            continue
        try:
            qd   = datetime.strptime(date_str, "%d-%b-%Y")
            days = (now - qd).days
            updates.append({"range": f"N{i}", "values": [[days]]})
            if days >= 2 and status == "Pending":
                ws.update_cell(i, 11, "OVERDUE")
                ws.format(f"A{i}:N{i}", {"backgroundColor": COLORS["overdue"],
                                          "textFormat": {"foregroundColor": COLORS["white"]}})
        except Exception:
            pass
    if updates:
        ws.spreadsheet.values_batch_update({"valueInputOption": "USER_ENTERED", "data": updates})

def load_seen():
    if os.path.exists(SEEN_FILE):
        with open(SEEN_FILE) as f:
            return set(json.load(f))
    return set()

def save_seen(seen):
    with open(SEEN_FILE, "w") as f:
        json.dump(list(seen), f)

def is_quotation(subject, snippet):
    text = (subject + " " + snippet).lower()
    if any(k in text for k in SKIP_KEYWORDS):
        return False, False
    is_q = any(k in text for k in QUOTATION_KEYWORDS)
    is_r = any(k in text for k in REMINDER_KEYWORDS)
    return is_q, is_r

def company_name(email):
    domain_map = {
        "rajby.com.pk":        "Rajby Industries",
        "hunarfoundation.org": "Hunar Foundation",
        "alkaram.com":         "Al-Karam Textile",
    }
    domain = email.split("@")[-1].lower()
    return domain_map.get(domain, email.split("@")[0].replace(".", " ").title())

def extract_pr(subject):
    import re
    m = re.search(r'PR[#\-\s]*\w+', subject, re.IGNORECASE)
    return m.group(0).strip() if m else "—"

def parse_dt(date_raw):
    try:
        from datetime import timezone
        dt = datetime.fromisoformat(date_raw.replace("Z", "+00:00"))
        dt = dt.replace(tzinfo=None)
        return dt.strftime("%d-%b-%Y"), dt.strftime("%I:%M %p")
    except Exception:
        return datetime.now().strftime("%d-%b-%Y"), datetime.now().strftime("%I:%M %p")

def sync_gmail_to_sheets(raw_threads):
    """Main function — raw_threads Gmail MCP se aata hai"""
    if not os.path.exists(CREDS_FILE):
        print("❌ google_creds.json nahi mila. Setup guide dekho.")
        return 0, 0, 0

    ws   = get_sheet()
    seen = load_seen()

    # Setup header if sheet is empty
    if not ws.get_all_values():
        setup_header(ws)

    added = overdue_marked = sent_marked = 0

    for thread in raw_threads:
        for msg in thread.get("messages", []):
            msg_id  = msg.get("id", "")
            if msg_id in seen:
                continue

            sender  = msg.get("sender", "")
            subject = msg.get("subject", "")
            snippet = msg.get("snippet", "")
            date_raw = msg.get("date", "")

            if sender == MY_EMAIL:
                # Hamne bheja — sent mark karo
                pr = extract_pr(subject)
                date_str, time_str = parse_dt(date_raw)
                mark_sent_in_sheet(ws, pr, f"{date_str} {time_str}")
                sent_marked += 1
                seen.add(msg_id)
                continue

            is_q, is_r = is_quotation(subject, snippet)
            if not is_q and not is_r:
                seen.add(msg_id)
                continue

            date_str, time_str = parse_dt(date_raw)
            co  = company_name(sender)
            pr  = extract_pr(subject)

            if is_r:
                mark_overdue_in_sheet(ws, pr, co)
                overdue_marked += 1
                seen.add(msg_id)
                continue

            # New query row
            sr    = get_last_sr(ws) + 1
            item  = snippet[:100].replace("Dear Concern,","").replace("Dear Sir,","").strip()
            row   = [sr, co, sender, pr, item, "—", "—", "",
                     date_str, time_str, "Pending", "", "", 0]
            add_row_to_sheet(ws, row, "Pending")
            added += 1
            seen.add(msg_id)
            print(f"  ➕ [{sr}] {co} | {subject[:50]}")

    refresh_days_pending(ws)
    save_seen(seen)
    url = ws.spreadsheet.url
    print(f"\n✅ Sync done | +{added} new | {overdue_marked} overdue | {sent_marked} sent")
    print(f"📊 Sheet: {url}")
    return added, overdue_marked, sent_marked
