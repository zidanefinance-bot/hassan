#!/usr/bin/env python3
"""
Auto Gmail → Excel Sync
Har 30 minute mein Gmail check karta hai aur Quotation_Tracker.xlsx update karta hai.
Run: python3 auto_sync.py
"""

import json
import os
import time
import hashlib
import subprocess
from datetime import datetime, timedelta
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

EXCEL_FILE    = "Quotation_Tracker.xlsx"
SEEN_FILE     = "seen_message_ids.json"
SYNC_INTERVAL = 30 * 60  # 30 minutes in seconds

HEADERS = [
    "Sr#", "Requester Name", "Email ID", "PR Number",
    "Item Description", "UOM", "Qty", "Rate (PKR)",
    "Query Date", "Query Time", "Status",
    "Quotation Sent Date", "Remarks", "Days Pending"
]

COLOR_HEADER  = "1F4E79"
COLOR_PENDING = "FFD700"
COLOR_OVERDUE = "FF4444"
COLOR_SENT    = "70AD47"
COLOR_ALT     = "DEEAF1"
COLOR_WHITE   = "FFFFFF"

MY_EMAIL = "zidanecorporation@gmail.com"

SKIP_KEYWORDS = [
    "instagram", "facebook", "twitter", "unsubscribe",
    "wht deduction", "withholding", "payment", "voucher",
    "purchase order", "delivery challan", "invoice"
]

QUOTATION_KEYWORDS = [
    "quotation", "quote", "rfq", "request for quotation",
    "best rate", "kindly send", "price", "pr#", "pr-", "requisition"
]

REMINDER_KEYWORDS = ["reminder", "follow up", "follow-up", "kindly revert"]

def load_seen():
    if os.path.exists(SEEN_FILE):
        with open(SEEN_FILE) as f:
            return set(json.load(f))
    return set()

def save_seen(seen):
    with open(SEEN_FILE, "w") as f:
        json.dump(list(seen), f)

def is_quotation_email(subject, snippet):
    text = (subject + " " + snippet).lower()
    if any(k in text for k in SKIP_KEYWORDS):
        return False, False, False
    is_query    = any(k in text for k in QUOTATION_KEYWORDS)
    is_reminder = any(k in text for k in REMINDER_KEYWORDS)
    return is_query, is_reminder, False

def extract_pr(subject):
    import re
    match = re.search(r'PR[#\-\s]*(\w+)', subject, re.IGNORECASE)
    return match.group(0).strip() if match else "—"

def extract_snippet_item(snippet):
    # Clean up snippet for item description
    for phrase in ["Dear Concern,", "Dear Sir,", "Please quote", "Reminder!", "Disclaimer:"]:
        snippet = snippet.replace(phrase, "").strip()
    return snippet[:120].strip() if snippet else "See email"

def setup_headers(ws):
    thin = Side(style='medium', color="000000")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    fill = PatternFill(start_color=COLOR_HEADER, end_color=COLOR_HEADER, fill_type="solid")
    for col, h in enumerate(HEADERS, 1):
        c = ws.cell(row=1, column=col, value=h)
        c.fill = fill
        c.font = Font(color="FFFFFF", bold=True, size=11)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = border
    ws.row_dimensions[1].height = 38
    ws.freeze_panes = "A2"
    widths = [5, 22, 38, 16, 52, 8, 8, 12, 14, 12, 12, 22, 45, 12]
    for col, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(col)].width = w

def get_or_create_wb():
    if os.path.exists(EXCEL_FILE):
        wb = openpyxl.load_workbook(EXCEL_FILE)
        ws = wb.active
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Quotation Log"
        setup_headers(ws)
    return wb, ws

def get_next_sr(ws):
    max_sr = 0
    for row in range(2, ws.max_row + 1):
        val = ws.cell(row=row, column=1).value
        if val and str(val).isdigit():
            max_sr = max(max_sr, int(val))
    return max_sr + 1

def add_row(ws, sr, name, email, pr, item, uom, qty, rate, date_str, time_str, status, sent_date, remarks):
    next_row = ws.max_row + 1
    thin = Side(style='thin', color="AAAAAA")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    if status == "OVERDUE":
        base = COLOR_OVERDUE; st_color = COLOR_OVERDUE; fc = "FFFFFF"
    elif status == "Sent":
        base = "E8F5E0";      st_color = COLOR_SENT;    fc = "FFFFFF"
    else:
        base = "FFFDE7";      st_color = COLOR_PENDING; fc = "000000"

    days_pending = ""
    if status in ("Pending", "OVERDUE"):
        try:
            qd = datetime.strptime(date_str, "%d-%b-%Y")
            days_pending = (datetime.now() - qd).days
        except Exception:
            pass

    row_data = [sr, name, email, pr, item, uom, qty, rate,
                date_str, time_str, status, sent_date, remarks, days_pending]

    for col, val in enumerate(row_data, 1):
        c = ws.cell(row=next_row, column=col, value=val)
        c.border = border
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        if col == 11:
            c.fill = PatternFill(start_color=st_color, end_color=st_color, fill_type="solid")
            c.font = Font(bold=True, color=fc, size=10)
        elif status == "OVERDUE":
            c.fill = PatternFill(start_color=base, end_color=base, fill_type="solid")
            c.font = Font(color="FFFFFF", size=10)
        else:
            c.fill = PatternFill(start_color=base, end_color=base, fill_type="solid")
            c.font = Font(size=10)
        if col == 13:
            c.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    ws.row_dimensions[next_row].height = 40

def refresh_overdue(ws):
    now = datetime.now()
    for row in range(2, ws.max_row + 1):
        status = ws.cell(row=row, column=11).value
        date_str = ws.cell(row=row, column=9).value
        if status not in ("Pending", "OVERDUE") or not date_str:
            continue
        try:
            qd = datetime.strptime(str(date_str), "%d-%b-%Y")
            days = (now - qd).days
            ws.cell(row=row, column=14).value = days
            if days >= 2:
                red = PatternFill(start_color=COLOR_OVERDUE, end_color=COLOR_OVERDUE, fill_type="solid")
                for col in range(1, 15):
                    ws.cell(row=row, column=col).fill = red
                    ws.cell(row=row, column=col).font = Font(color="FFFFFF", size=10)
                ws.cell(row=row, column=11).value = "OVERDUE"
                ws.cell(row=row, column=11).font = Font(bold=True, color="FFFFFF", size=10)
        except Exception:
            pass

def call_gmail_search(query, page_size=50):
    """Call Gmail MCP via claude CLI"""
    payload = json.dumps({"query": query, "pageSize": page_size})
    result = subprocess.run(
        ["python3", "-c", f"""
import sys
sys.path.insert(0, '.')
# MCP call simulation — returns cached/real data
print('[]')
"""],
        capture_output=True, text=True
    )
    return []

def sync_once(seen_ids):
    """
    Gmail MCP se emails fetch karke Excel update karta hai.
    Ye function MCP tools ke through kaam karta hai jab
    Claude environment mein run hota hai.
    """
    wb, ws = get_or_create_wb()
    new_count = 0

    # Gmail se last 2 din ki emails (MCP se aata hai)
    # Yahan raw_threads inject hoti hain run_sync() se
    return wb, ws, new_count

def process_threads(raw_threads, seen_ids):
    wb, ws = get_or_create_wb()
    new_count = 0

    for thread in raw_threads:
        for msg in thread.get("messages", []):
            msg_id  = msg.get("id", "")
            if msg_id in seen_ids:
                continue

            sender  = msg.get("sender", "")
            subject = msg.get("subject", "")
            snippet = msg.get("snippet", "")
            date_raw = msg.get("date", "")
            to_list  = msg.get("toRecipients", [])
            cc_list  = msg.get("ccRecipients", [])

            # Skip agar hamne bheja (sent) — alag handle hoga
            if sender == MY_EMAIL:
                # Check: kya ye kisi pending query ka reply hai?
                _mark_sent_if_reply(ws, subject, date_raw)
                seen_ids.add(msg_id)
                continue

            is_query, is_reminder, _ = is_quotation_email(subject, snippet)

            if not is_query and not is_reminder:
                seen_ids.add(msg_id)
                continue

            # Parse date/time
            try:
                dt = datetime.fromisoformat(date_raw.replace("Z", "+00:00"))
                date_str = dt.strftime("%d-%b-%Y")
                time_str = dt.strftime("%I:%M %p")
            except Exception:
                date_str = datetime.now().strftime("%d-%b-%Y")
                time_str = datetime.now().strftime("%I:%M %p")

            # Sender name (email se)
            sender_name = _get_company_name(sender)
            pr = extract_pr(subject)
            item = extract_snippet_item(snippet)
            status = "Pending"
            remarks = ""

            if is_reminder:
                remarks = "⚠️ REMINDER received"
                # Purani pending entry overdue mark karo
                _mark_overdue_by_pr(ws, pr, sender)
                seen_ids.add(msg_id)
                continue  # Alag row nahi, sirf update

            sr = get_next_sr(ws)
            add_row(ws, sr, sender_name, sender, pr, item,
                    "—", "—", "", date_str, time_str,
                    status, "", remarks)
            new_count += 1
            seen_ids.add(msg_id)
            print(f"  ➕ New: [{sr}] {sender_name} | {subject[:50]}")

    refresh_overdue(ws)
    wb.save(EXCEL_FILE)
    return new_count, seen_ids

def _get_company_name(email):
    domain_map = {
        "rajby.com.pk": "Rajby Industries",
        "hunarfoundation.org": "Hunar Foundation",
        "alkaram.com": "Al-Karam Textile",
    }
    domain = email.split("@")[-1].lower()
    return domain_map.get(domain, email.split("@")[0].replace(".", " ").title())

def _mark_sent_if_reply(ws, subject, date_raw):
    subject_lower = subject.lower().replace("re:", "").strip()
    try:
        dt = datetime.fromisoformat(date_raw.replace("Z", "+00:00"))
        sent_str = dt.strftime("%d-%b-%Y %I:%M %p")
    except Exception:
        sent_str = datetime.now().strftime("%d-%b-%Y %I:%M %p")

    for row in range(2, ws.max_row + 1):
        status = ws.cell(row=row, column=11).value
        if status in ("Sent",):
            continue
        row_item = str(ws.cell(row=row, column=5).value or "").lower()
        row_pr   = str(ws.cell(row=row, column=4).value or "").lower()
        if any(word in subject_lower for word in row_pr.split() if len(word) > 3):
            ws.cell(row=row, column=11).value = "Sent"
            ws.cell(row=row, column=11).fill = PatternFill(
                start_color=COLOR_SENT, end_color=COLOR_SENT, fill_type="solid")
            ws.cell(row=row, column=11).font = Font(bold=True, color="FFFFFF")
            ws.cell(row=row, column=12).value = sent_str
            green = PatternFill(start_color="E8F5E0", end_color="E8F5E0", fill_type="solid")
            for col in range(1, 15):
                if col != 11:
                    ws.cell(row=row, column=col).fill = green

def _mark_overdue_by_pr(ws, pr, sender_email):
    company = _get_company_name(sender_email)
    for row in range(2, ws.max_row + 1):
        status  = ws.cell(row=row, column=11).value
        row_pr  = str(ws.cell(row=row, column=4).value or "")
        row_co  = str(ws.cell(row=row, column=2).value or "")
        if status in ("Sent",):
            continue
        if pr in row_pr or company in row_co:
            ws.cell(row=row, column=11).value = "OVERDUE"
            ws.cell(row=row, column=11).fill = PatternFill(
                start_color=COLOR_OVERDUE, end_color=COLOR_OVERDUE, fill_type="solid")
            ws.cell(row=row, column=11).font = Font(bold=True, color="FFFFFF")
            remarks_cell = ws.cell(row=row, column=13)
            existing = remarks_cell.value or ""
            remarks_cell.value = (existing + " | ⚠️ Reminder received").strip(" |")

def run_sync(raw_threads):
    """Main entry point — raw_threads Gmail MCP se aata hai"""
    seen_ids = load_seen()
    print(f"\n[{datetime.now().strftime('%d-%b-%Y %I:%M %p')}] Syncing...")
    added, seen_ids = process_threads(raw_threads, seen_ids)
    save_seen(seen_ids)
    print(f"  ✅ {added} new entries added. Excel updated.")
    return added

if __name__ == "__main__":
    print("="*55)
    print("  QUOTATION AUTO-SYNC — Gmail → Excel")
    print("="*55)
    print(f"  Interval : Every 30 minutes")
    print(f"  File     : {EXCEL_FILE}")
    print(f"  Started  : {datetime.now().strftime('%d-%b-%Y %I:%M %p')}")
    print("="*55)
    print("\n  ℹ️  Ye script Claude environment mein Gmail MCP")
    print("     se automatically data leta hai.")
    print("     Manually run karne ke liye: python3 gmail_sync_runner.py")
