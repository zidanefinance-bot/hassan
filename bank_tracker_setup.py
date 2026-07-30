#!/usr/bin/env python3
"""Zidane Bank Transactions Tracker — Google Sheet setup + CSV import.

Same pattern as the procurement tracker: gspread for read/write,
service account creds from google_creds.json, Sheets API v4 for formatting.

Usage:
    python3 bank_tracker_setup.py                     # worksheets banao (existing Sheet ID mein)
    python3 bank_tracker_setup.py --csv bank.csv      # worksheets + CSV import
    python3 bank_tracker_setup.py --new-spreadsheet   # alag nayi spreadsheet banao
"""

import argparse
import csv
import re
import sys
from datetime import datetime
from pathlib import Path

import gspread
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDS_FILE = Path(__file__).parent / "google_creds.json"
DEFAULT_SHEET_ID = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"
SHARE_WITH = "zidane.finance@gmail.com"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

WORKSHEET_NAME = "Bank Transactions"
HEADERS = [
    "Sr#", "Date", "Description", "Reference#", "Debit", "Credit",
    "Balance", "Category", "Bank/Account", "Month", "Notes",
]
MONEY_COLS = ["Debit", "Credit", "Balance"]

# CSV header → tracker column mapping (lowercase substring match)
CSV_ALIASES = {
    "Date": ["date", "txn date", "transaction date", "value date"],
    "Description": ["description", "narration", "details", "particulars", "memo"],
    "Reference#": ["reference", "ref", "cheque", "chq", "instrument"],
    "Debit": ["debit", "withdrawal", "dr"],
    "Credit": ["credit", "deposit", "cr"],
    "Balance": ["balance", "running balance"],
    "Category": ["category"],
    "Bank/Account": ["bank", "account"],
    "Notes": ["notes", "remark"],
}


def get_clients():
    if not CREDS_FILE.exists():
        sys.exit(f"ERROR: {CREDS_FILE} nahi mili — service account creds file yahan rakhein.")
    creds = service_account.Credentials.from_service_account_file(str(CREDS_FILE), scopes=SCOPES)
    return gspread.authorize(creds), build("sheets", "v4", credentials=creds)


def open_spreadsheet(gc, sheet_id, new_spreadsheet):
    if new_spreadsheet:
        ss = gc.create("Zidane Bank Transactions Tracker")
        ss.share(SHARE_WITH, perm_type="user", role="writer")
        print(f"Nayi spreadsheet bani: {ss.id} (shared with {SHARE_WITH})")
        return ss
    return gc.open_by_key(sheet_id)


def get_or_create_worksheet(ss, name, cols):
    try:
        return ss.worksheet(name)
    except gspread.WorksheetNotFound:
        return ss.add_worksheet(title=name, rows=1000, cols=cols)


def format_worksheet(service, spreadsheet_id, ws):
    money_idx = [HEADERS.index(c) for c in MONEY_COLS]
    date_idx = HEADERS.index("Date")
    requests = [
        {  # header: dark blue, white bold, frozen
            "repeatCell": {
                "range": {"sheetId": ws.id, "startRowIndex": 0, "endRowIndex": 1},
                "cell": {"userEnteredFormat": {
                    "backgroundColor": {"red": 0.12, "green": 0.29, "blue": 0.49},
                    "textFormat": {"bold": True,
                                   "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
                    "horizontalAlignment": "CENTER",
                }},
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            }
        },
        {"updateSheetProperties": {
            "properties": {"sheetId": ws.id, "gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount",
        }},
        {"repeatCell": {
            "range": {"sheetId": ws.id, "startRowIndex": 1,
                      "startColumnIndex": date_idx, "endColumnIndex": date_idx + 1},
            "cell": {"userEnteredFormat": {
                "numberFormat": {"type": "DATE", "pattern": "dd-mmm-yyyy"}}},
            "fields": "userEnteredFormat.numberFormat",
        }},
    ]
    for idx in money_idx:
        requests.append({"repeatCell": {
            "range": {"sheetId": ws.id, "startRowIndex": 1,
                      "startColumnIndex": idx, "endColumnIndex": idx + 1},
            "cell": {"userEnteredFormat": {
                "numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"}}},
            "fields": "userEnteredFormat.numberFormat",
        }})
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id, body={"requests": requests}).execute()


def map_csv_columns(fieldnames):
    mapping = {}
    for col, aliases in CSV_ALIASES.items():
        for fn in fieldnames:
            name = fn.lower().strip()
            # short aliases (dr/cr/ref) whole-word match, warna substring
            if any(re.search(rf"\b{a}\b", name) if len(a) <= 3 else a in name
                   for a in aliases):
                mapping[col] = fn
                break
    return mapping


def parse_date(raw):
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d-%b-%Y", "%d %b %Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw.strip(), fmt)
        except ValueError:
            continue
    return None


def clean_amount(raw):
    raw = (raw or "").replace(",", "").replace("(", "-").replace(")", "").strip()
    try:
        return float(raw)
    except ValueError:
        return ""


def import_csv(ws, csv_path):
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        mapping = map_csv_columns(reader.fieldnames or [])
        if "Date" not in mapping:
            sys.exit(f"ERROR: CSV mein date column nahi mila. Headers: {reader.fieldnames}")
        print(f"Column mapping: {mapping}")

        rows, sr = [], 1
        for rec in reader:
            date = parse_date(rec.get(mapping["Date"], ""))
            row = {h: "" for h in HEADERS}
            row["Sr#"] = sr
            row["Date"] = date.strftime("%Y-%m-%d") if date else rec.get(mapping["Date"], "")
            row["Month"] = date.strftime("%b-%Y") if date else ""
            for col in ("Description", "Reference#", "Balance", "Category", "Bank/Account", "Notes"):
                if col in mapping:
                    row[col] = rec.get(mapping[col], "").strip()
            if "Balance" in mapping:
                row["Balance"] = clean_amount(rec.get(mapping["Balance"], ""))
            if "Debit" in mapping or "Credit" in mapping:
                row["Debit"] = clean_amount(rec.get(mapping.get("Debit", ""), ""))
                row["Credit"] = clean_amount(rec.get(mapping.get("Credit", ""), ""))
            else:
                # single amount column: negative = debit, positive = credit
                amt_field = next((fn for fn in reader.fieldnames if "amount" in fn.lower()), None)
                amt = clean_amount(rec.get(amt_field, "")) if amt_field else ""
                if amt != "":
                    row["Debit" if amt < 0 else "Credit"] = abs(amt)
            rows.append([row[h] for h in HEADERS])
            sr += 1

    ws.append_rows(rows, value_input_option="USER_ENTERED")
    print(f"{len(rows)} transactions import ho gayeen.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet-id", default=DEFAULT_SHEET_ID)
    ap.add_argument("--csv", help="bank transactions CSV import karne ke liye")
    ap.add_argument("--new-spreadsheet", action="store_true",
                    help="existing sheet mein worksheet add karne ke bajaye nayi spreadsheet banao")
    args = ap.parse_args()

    gc, service = get_clients()
    ss = open_spreadsheet(gc, args.sheet_id, args.new_spreadsheet)
    ws = get_or_create_worksheet(ss, WORKSHEET_NAME, len(HEADERS))

    if ws.acell("A1").value != "Sr#":
        ws.update("A1", [HEADERS])
    format_worksheet(service, ss.id, ws)
    print(f"'{WORKSHEET_NAME}' worksheet ready: https://docs.google.com/spreadsheets/d/{ss.id}")

    if args.csv:
        import_csv(ws, args.csv)


if __name__ == "__main__":
    main()
