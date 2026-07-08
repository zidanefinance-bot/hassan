#!/usr/bin/env python3
"""
Checks Active Orders for rows marked "Delivered",
moves them to the Delivered tab with a date stamp,
then removes them from Active Orders and renumbers Sr#.

Run anytime after marking items as Delivered:
    python3 sync_delivered.py
"""
import gspread
from datetime import date
from google.oauth2.service_account import Credentials

SHEET_ID   = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"
STATUS_COL = 16   # Column P — Status (1-indexed)
DATE_COL   = 17   # Column Q — Delivered Date
NUM_COLS   = 19

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
creds  = Credentials.from_service_account_file("google_creds.json", scopes=SCOPES)
gc     = gspread.authorize(creds)
sh     = gc.open_by_key(SHEET_ID)

ws_active = sh.worksheet("Active Orders")
ws_deliv  = sh.worksheet("Delivered")

today = date.today().strftime("%d-%b-%Y")

# ── Read all active rows ──────────────────────────────────────────────────────
all_rows = ws_active.get_all_values()
header   = all_rows[0]
data     = all_rows[1:]

to_move   = []   # (original_row_index_1based, row_data)
to_keep   = []   # row_data

for i, row in enumerate(data):
    # Pad short rows
    while len(row) < NUM_COLS:
        row.append("")
    status = row[STATUS_COL - 1].strip().lower()
    if status == "delivered":
        row[DATE_COL - 1] = today   # fill delivered date
        to_move.append(row)
    else:
        to_keep.append(row)

if not to_move:
    print("✅ Koi delivered item nahi mila. Sab pending hain.")
    exit(0)

print(f"📦 {len(to_move)} item(s) delivered mila — move kar raha hoon...\n")

# ── Append to Delivered tab ───────────────────────────────────────────────────
for row in to_move:
    ws_deliv.append_row(row, value_input_option="USER_ENTERED")
    print(f"  ✅ Moved: PO#{row[1]} — {row[3]}")

# ── Rebuild Active Orders with renumbered Sr# ─────────────────────────────────
new_rows = []
for sr, row in enumerate(to_keep, 1):
    row[0] = sr   # renumber
    new_rows.append(row)

# Clear data area and rewrite
if new_rows:
    # Clear from row 2 downward
    ws_active.batch_clear([f"A2:S{len(data) + 2}"])
    ws_active.update(
        values=new_rows,
        range_name=f"A2:S{len(new_rows) + 1}",
        value_input_option="USER_ENTERED"
    )
else:
    ws_active.batch_clear([f"A2:S{len(data) + 2}"])

print(f"\n✅ Done!")
print(f"   Moved   : {len(to_move)} items → Delivered tab")
print(f"   Pending : {len(to_keep)} items remaining in Active Orders")
