"""Move PO 17257 items to Delivered except Bleach, Hand Wash Lose Local, Tile Wash."""
import gspread
from google.oauth2.service_account import Credentials
from datetime import date

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SHEET_ID = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"
SKIP_ITEMS = {"bleach 30kg local", "hand wash lose local", "tile wash sweep local 30kg"}
TODAY = date.today().strftime("%d-%b-%Y")
INVOICE_NUM = "PENDING"  # will update after creation

creds = Credentials.from_service_account_file("google_creds.json", scopes=SCOPES)
gc = gspread.authorize(creds)
ss = gc.open_by_key(SHEET_ID)
active_ws = ss.worksheet("Active Orders")
deliv_ws = ss.worksheet("Delivered")

rows = active_ws.get_all_values()
header = rows[0]

to_deliver = []
to_keep = []

for r in rows[1:]:
    if str(r[1]).strip() != "17257":
        to_keep.append(r)
        continue
    item_name = str(r[3]).strip().lower()
    if item_name in SKIP_ITEMS:
        to_keep.append(r)
    else:
        to_deliver.append(r)

print(f"Items to deliver: {len(to_deliver)}")
print(f"Items to keep (non-17257 + 3 pending): {len(to_keep)}")

# Add to Delivered sheet
deliv_last = len(deliv_ws.get_all_values())
deliv_rows = []
for r in to_deliver:
    row = list(r[:20]) + [""] * max(0, 20 - len(r))
    row[16] = TODAY          # Col Q: Delivered Date
    row[15] = "Delivered"    # Col P: Status
    deliv_rows.append(row)

if deliv_rows:
    start = deliv_last + 1
    end = deliv_last + len(deliv_rows)
    deliv_ws.update(f"A{start}:T{end}", deliv_rows, value_input_option="USER_ENTERED")
    print(f"Added {len(deliv_rows)} rows to Delivered (rows {start}-{end})")

# Re-number and write back Active Orders
for i, r in enumerate(to_keep):
    r[0] = str(i + 1)

def pad(row, n=20):
    return row[:n] + [""] * max(0, n - len(row))

padded_keep = [pad(r) for r in to_keep]
total_rows = len(rows)
active_ws.batch_clear([f"A2:T{total_rows + 5}"])

if padded_keep:
    active_ws.update(f"A2:T{1 + len(padded_keep)}", padded_keep, value_input_option="USER_ENTERED")

print("Active Orders updated.")
print(f"\nDelivered rows {start}-{end} need invoice number written in col R (index 17).")
print(f"Store start row for later: {start}")

# Save start row to file
with open("/tmp/deliv_start_row.txt", "w") as f:
    f.write(str(start))
    f.write(f"\n{len(deliv_rows)}")
