#!/usr/bin/env python3
"""
Checks Active Orders for rows marked "Delivered",
moves them to the Delivered tab with a date stamp,
then removes them from Active Orders and sorts by PO#.

Formulas are preserved automatically — no reapply needed.

Run anytime after marking items as Delivered:
    python3 sync_delivered.py
"""
import gspread, time
from datetime import date
from google.oauth2.service_account import Credentials

SHEET_ID   = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"
STATUS_COL = 16   # Column P (1-indexed)
DATE_COL   = 17   # Column Q
NUM_COLS   = 20

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
creds  = Credentials.from_service_account_file("google_creds.json", scopes=SCOPES)
gc     = gspread.authorize(creds)
sh     = gc.open_by_key(SHEET_ID)

ws_active = sh.worksheet("Active Orders")
ws_deliv  = sh.worksheet("Delivered")

today = date.today().strftime("%d-%b-%Y")

# ── Read with FORMULA render so formulas are preserved ──────────────────────
def get_with_formulas(ws):
    result = ws.spreadsheet.values_get(
        f"'{ws.title}'!A1:T500",
        params={"valueRenderOption": "FORMULA", "dateTimeRenderOption": "FORMATTED_STRING"}
    )
    rows = result.get("values", [])
    # Pad all rows to NUM_COLS
    for r in rows:
        while len(r) < NUM_COLS:
            r.append("")
    return rows

all_rows = get_with_formulas(ws_active)
header   = all_rows[0]
data     = all_rows[1:]

to_move = []
to_keep = []

for row in data:
    # Status is a plain value not a formula — check col P (index 15)
    status = str(row[STATUS_COL - 1]).strip().lower()
    if status == "delivered":
        row[DATE_COL - 1] = today
        to_move.append(row)
    else:
        to_keep.append(row)

if not to_move:
    print("✅ Koi delivered item nahi mila. Sab pending hain.")
    exit(0)

print(f"📦 {len(to_move)} item(s) delivered — move kar raha hoon...\n")

# ── Append to Delivered tab (with formulas intact) ───────────────────────────
for row in to_move:
    ws_deliv.append_row(row, value_input_option="USER_ENTERED")
    print(f"  ✅ Moved: PO#{row[1]} — {row[3]}")
    time.sleep(1.5)

# ── Sort remaining rows by PO# ────────────────────────────────────────────────
def po_sort_key(r):
    po = str(r[1]).strip()
    return (int(po) if po.isdigit() else float('inf'), po)

to_keep.sort(key=po_sort_key)
for i, row in enumerate(to_keep, 1):
    row[0] = i   # renumber Sr#

# ── Clear and rewrite Active Orders (formulas preserved) ─────────────────────
ws_active.batch_clear([f"A2:T{len(data) + 2}"])
time.sleep(3)

if to_keep:
    ws_active.update(
        range_name=f"A2:T{len(to_keep) + 1}",
        values=to_keep,
        value_input_option="USER_ENTERED"
    )

print(f"\n✅ Done!")
print(f"   Moved   : {len(to_move)} items → Delivered tab")
print(f"   Pending : {len(to_keep)} items remaining in Active Orders")
