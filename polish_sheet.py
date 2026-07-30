#!/usr/bin/env python3
"""Classy polish for the Zidane Bank Transactions Tracker."""
import json

import gspread
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds = service_account.Credentials.from_service_account_file(
    "/home/user/hassan/google_creds.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets"])
gc = gspread.authorize(creds)
service = build("sheets", "v4", credentials=creds)
SID = json.load(open("/home/user/hassan/sheet_config.json"))["bank_tracker_sheet_id"]
ss = gc.open_by_key(SID)

NAVY = {"red": 0.10, "green": 0.16, "blue": 0.29}
NAVY_LIGHT = {"red": 0.93, "green": 0.95, "blue": 0.98}
WHITE = {"red": 1, "green": 1, "blue": 1}
RED = {"red": 0.72, "green": 0.11, "blue": 0.11}
GREEN = {"red": 0.09, "green": 0.46, "blue": 0.22}
GREY = {"red": 0.45, "green": 0.45, "blue": 0.45}

txn = ss.worksheet("Bank Transactions")
summ = ss.worksheet("Monthly Summary")
nrows = len(txn.get_all_values())

# ---- Accounts overview tab ----
ACCOUNTS = [
    ["Bank", "Account", "IBAN", "Statement Period", "Transactions", "Closing Balance"],
    ["Habib Bank (HBL)", "76977000009503", "PK09HABB0076977000009503",
     "01-May-2026 to 29-Jul-2026", 46, 389.00],
    ["Habib Metropolitan", "6-01-09-20311-714-121610", "PK16MPBL0109027140121610",
     "01-May-2026 to 27-Jul-2026", 130, 790154.30],
    ["Faysal Bank", "3846-XXXX-XXXX-1451", "PK78-XXXX-XXXXXXXXXXXX-1451",
     "08-May-2026 to 22-Jul-2026", 75, 404616.00],
    ["TOTAL", "", "", "", 251, 1195159.30],
]
try:
    acc = ss.worksheet("Accounts")
    acc.clear()
except gspread.WorksheetNotFound:
    acc = ss.add_worksheet(title="Accounts", rows=20, cols=6, index=0)
acc.update(values=ACCOUNTS, range_name="A1")

def header_fmt(sheet_id, ncols):
    return [
        {"repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1,
                      "startColumnIndex": 0, "endColumnIndex": ncols},
            "cell": {"userEnteredFormat": {
                "backgroundColor": NAVY,
                "textFormat": {"bold": True, "foregroundColor": WHITE, "fontSize": 10},
                "horizontalAlignment": "CENTER", "verticalAlignment": "MIDDLE"}},
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"}},
        {"updateSheetProperties": {
            "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount"}},
        {"updateDimensionProperties": {
            "range": {"sheetId": sheet_id, "dimension": "ROWS", "startIndex": 0, "endIndex": 1},
            "properties": {"pixelSize": 34}, "fields": "pixelSize"}},
    ]

def widths(sheet_id, sizes):
    return [{"updateDimensionProperties": {
        "range": {"sheetId": sheet_id, "dimension": "COLUMNS",
                  "startIndex": i, "endIndex": i + 1},
        "properties": {"pixelSize": px}, "fields": "pixelSize"}}
        for i, px in enumerate(sizes)]

def banding(sheet_id, nrows_, ncols):
    return [{"addBanding": {"bandedRange": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": nrows_,
                  "startColumnIndex": 0, "endColumnIndex": ncols},
        "rowProperties": {"firstBandColor": WHITE, "secondBandColor": NAVY_LIGHT}}}}]

requests = []

# --- Bank Transactions (11 cols: Sr# Date Desc Ref Debit Credit Balance Cat Bank Month Notes)
t = txn.id
requests += header_fmt(t, 11)
requests += widths(t, [45, 92, 470, 70, 105, 105, 115, 130, 135, 80, 90])
requests += banding(t, nrows, 11)
requests += [
    # description + bank: clip
    {"repeatCell": {
        "range": {"sheetId": t, "startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3},
        "cell": {"userEnteredFormat": {"wrapStrategy": "CLIP",
                                       "textFormat": {"fontSize": 9}}},
        "fields": "userEnteredFormat(wrapStrategy,textFormat.fontSize)"}},
    # debit red
    {"repeatCell": {
        "range": {"sheetId": t, "startRowIndex": 1, "startColumnIndex": 4, "endColumnIndex": 5},
        "cell": {"userEnteredFormat": {
            "numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"},
            "textFormat": {"foregroundColor": RED}}},
        "fields": "userEnteredFormat(numberFormat,textFormat.foregroundColor)"}},
    # credit green
    {"repeatCell": {
        "range": {"sheetId": t, "startRowIndex": 1, "startColumnIndex": 5, "endColumnIndex": 6},
        "cell": {"userEnteredFormat": {
            "numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"},
            "textFormat": {"foregroundColor": GREEN}}},
        "fields": "userEnteredFormat(numberFormat,textFormat.foregroundColor)"}},
    # balance grey italicless, bold-ish
    {"repeatCell": {
        "range": {"sheetId": t, "startRowIndex": 1, "startColumnIndex": 6, "endColumnIndex": 7},
        "cell": {"userEnteredFormat": {
            "numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"},
            "textFormat": {"foregroundColor": GREY}}},
        "fields": "userEnteredFormat(numberFormat,textFormat.foregroundColor)"}},
    # date format
    {"repeatCell": {
        "range": {"sheetId": t, "startRowIndex": 1, "startColumnIndex": 1, "endColumnIndex": 2},
        "cell": {"userEnteredFormat": {
            "numberFormat": {"type": "DATE", "pattern": "dd-mmm-yyyy"},
            "horizontalAlignment": "CENTER"}},
        "fields": "userEnteredFormat(numberFormat,horizontalAlignment)"}},
    # filter on full data range
    {"setBasicFilter": {"filter": {"range": {
        "sheetId": t, "startRowIndex": 0, "endRowIndex": nrows,
        "startColumnIndex": 0, "endColumnIndex": 11}}}},
]

# --- Monthly Summary (5 cols)
s = summ.id
srows = len(summ.get_all_values())
requests += header_fmt(s, 5)
requests += widths(s, [110, 160, 160, 160, 100])
requests += banding(s, srows - 1, 5)  # exclude TOTAL row from banding
requests += [
    {"repeatCell": {
        "range": {"sheetId": s, "startRowIndex": srows - 1, "endRowIndex": srows,
                  "startColumnIndex": 0, "endColumnIndex": 5},
        "cell": {"userEnteredFormat": {
            "backgroundColor": NAVY, "textFormat": {"bold": True, "foregroundColor": WHITE}}},
        "fields": "userEnteredFormat(backgroundColor,textFormat)"}},
    {"repeatCell": {
        "range": {"sheetId": s, "startRowIndex": 1, "startColumnIndex": 1, "endColumnIndex": 4},
        "cell": {"userEnteredFormat": {"numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"}}},
        "fields": "userEnteredFormat.numberFormat"}},
]

# --- Accounts (6 cols)
a = acc.id
requests += header_fmt(a, 6)
requests += widths(a, [170, 200, 250, 230, 110, 150])
requests += [
    {"repeatCell": {
        "range": {"sheetId": a, "startRowIndex": 4, "endRowIndex": 5,
                  "startColumnIndex": 0, "endColumnIndex": 6},
        "cell": {"userEnteredFormat": {
            "backgroundColor": NAVY, "textFormat": {"bold": True, "foregroundColor": WHITE}}},
        "fields": "userEnteredFormat(backgroundColor,textFormat)"}},
    {"repeatCell": {
        "range": {"sheetId": a, "startRowIndex": 1, "startColumnIndex": 5, "endColumnIndex": 6},
        "cell": {"userEnteredFormat": {"numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"},
                                       "horizontalAlignment": "RIGHT"}},
        "fields": "userEnteredFormat(numberFormat,horizontalAlignment)"}},
    {"repeatCell": {
        "range": {"sheetId": a, "startRowIndex": 1, "startColumnIndex": 4, "endColumnIndex": 5},
        "cell": {"userEnteredFormat": {"horizontalAlignment": "CENTER"}},
        "fields": "userEnteredFormat.horizontalAlignment"}},
]

# tab order + tab colors
requests += [
    {"updateSheetProperties": {
        "properties": {"sheetId": a, "index": 0, "tabColor": NAVY},
        "fields": "index,tabColor"}},
    {"updateSheetProperties": {
        "properties": {"sheetId": t, "index": 1, "tabColor": GREEN},
        "fields": "index,tabColor"}},
    {"updateSheetProperties": {
        "properties": {"sheetId": s, "index": 2,
                       "tabColor": {"red": 0.85, "green": 0.55, "blue": 0.10}},
        "fields": "index,tabColor"}},
]

service.spreadsheets().batchUpdate(spreadsheetId=SID, body={"requests": requests}).execute()
print("Polish done: Accounts | Bank Transactions | Monthly Summary")
