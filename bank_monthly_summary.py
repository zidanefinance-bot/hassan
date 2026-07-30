#!/usr/bin/env python3
"""Monthly Summary worksheet — Bank Transactions se month-wise grouping.

monthly_pnl.py jaisa pattern: transactions parho, month-wise Credit (inflow),
Debit (outflow) aur Net nikaalo, 'Monthly Summary' worksheet mein likho.

Usage:
    python3 bank_monthly_summary.py
    python3 bank_monthly_summary.py --sheet-id <ID>
"""

import argparse
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import gspread
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDS_FILE = Path(__file__).parent / "google_creds.json"
DEFAULT_SHEET_ID = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

SOURCE_WS = "Bank Transactions"
SUMMARY_WS = "Monthly Summary"
SUMMARY_HEADERS = ["Month", "Total Credit (Inflow)", "Total Debit (Outflow)", "Net", "Txn Count"]


def to_float(v):
    try:
        return float(str(v).replace(",", ""))
    except (ValueError, TypeError):
        return 0.0


def month_key(month_label):
    try:
        return datetime.strptime(month_label, "%b-%Y")
    except ValueError:
        return datetime.min


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet-id", default=DEFAULT_SHEET_ID)
    args = ap.parse_args()

    creds = service_account.Credentials.from_service_account_file(str(CREDS_FILE), scopes=SCOPES)
    gc = gspread.authorize(creds)
    service = build("sheets", "v4", credentials=creds)
    ss = gc.open_by_key(args.sheet_id)

    records = ss.worksheet(SOURCE_WS).get_all_records()
    months = defaultdict(lambda: {"credit": 0.0, "debit": 0.0, "count": 0})
    for rec in records:
        m = str(rec.get("Month", "")).strip()
        if not m:
            continue
        months[m]["credit"] += to_float(rec.get("Credit"))
        months[m]["debit"] += to_float(rec.get("Debit"))
        months[m]["count"] += 1

    rows = [SUMMARY_HEADERS]
    total_cr = total_dr = total_n = 0
    for m in sorted(months, key=month_key):
        cr, dr = months[m]["credit"], months[m]["debit"]
        rows.append([m, round(cr, 2), round(dr, 2), round(cr - dr, 2), months[m]["count"]])
        total_cr += cr
        total_dr += dr
        total_n += months[m]["count"]
    rows.append(["TOTAL", round(total_cr, 2), round(total_dr, 2),
                 round(total_cr - total_dr, 2), total_n])

    try:
        ws = ss.worksheet(SUMMARY_WS)
        ws.clear()
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title=SUMMARY_WS, rows=100, cols=len(SUMMARY_HEADERS))
    ws.update("A1", rows, value_input_option="USER_ENTERED")

    service.spreadsheets().batchUpdate(spreadsheetId=ss.id, body={"requests": [
        {"repeatCell": {
            "range": {"sheetId": ws.id, "startRowIndex": 0, "endRowIndex": 1},
            "cell": {"userEnteredFormat": {
                "backgroundColor": {"red": 0.12, "green": 0.29, "blue": 0.49},
                "textFormat": {"bold": True,
                               "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
                "horizontalAlignment": "CENTER",
            }},
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
        }},
        {"updateSheetProperties": {
            "properties": {"sheetId": ws.id, "gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount",
        }},
        {"repeatCell": {
            "range": {"sheetId": ws.id, "startRowIndex": 1,
                      "startColumnIndex": 1, "endColumnIndex": 4},
            "cell": {"userEnteredFormat": {
                "numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"}}},
            "fields": "userEnteredFormat.numberFormat",
        }},
        {"repeatCell": {
            "range": {"sheetId": ws.id,
                      "startRowIndex": len(rows) - 1, "endRowIndex": len(rows)},
            "cell": {"userEnteredFormat": {"textFormat": {"bold": True}}},
            "fields": "userEnteredFormat.textFormat",
        }},
    ]}).execute()

    print(f"'{SUMMARY_WS}' update ho gaya — {len(months)} months, {total_n} transactions.")


if __name__ == "__main__":
    main()
