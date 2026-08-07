"""Clean up ghost/empty rows in Active Orders sheet."""
import json, gspread
from google.oauth2.service_account import Credentials

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SHEET_ID = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"

creds = Credentials.from_service_account_file("google_creds.json", scopes=SCOPES)
gc = gspread.authorize(creds)
ss = gc.open_by_key(SHEET_ID)
ws = ss.worksheet("Active Orders")

# Read all rows
all_rows = ws.get_all_values()
header = all_rows[0]
data_rows = all_rows[1:]

# Keep only rows where Sr# is a valid number OR has real content in PO# (col index 1)
def is_real_row(row):
    # Must have actual content — check Sr# (col 0) is a digit and PO# (col 1) is non-empty
    sr = str(row[0]).strip()
    po = str(row[1]).strip() if len(row) > 1 else ""
    desc = str(row[2]).strip() if len(row) > 2 else ""
    return sr.isdigit() and (po != "" or desc != "")

real_rows = [r for r in data_rows if is_real_row(r)]

print(f"Total rows (excl header): {len(data_rows)}")
print(f"Real rows: {len(real_rows)}")
print(f"Ghost/empty rows to remove: {len(data_rows) - len(real_rows)}")

# Show real rows for confirmation
for i, r in enumerate(real_rows):
    print(f"  Row {i+2}: Sr={r[0]} PO={r[1]} Desc={r[2][:40] if len(r)>2 else ''}")

# Clear everything from row 2 onwards
total_rows_in_sheet = len(all_rows)
if total_rows_in_sheet > 1:
    # Clear all data rows
    clear_range = f"A2:T{total_rows_in_sheet + 10}"
    ws.batch_clear([clear_range])

# Re-number Sr# and write back
for i, row in enumerate(real_rows):
    row[0] = str(i + 1)

# Pad rows to 20 columns
def pad(row, n=20):
    return row[:n] + [""] * max(0, n - len(row))

padded = [pad(r) for r in real_rows]

if padded:
    ws.update(f"A2:T{1 + len(padded)}", padded, value_input_option="USER_ENTERED")

print(f"\nDone! Active Orders now has {len(padded)} clean rows.")
