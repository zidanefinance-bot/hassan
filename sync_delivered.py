#!/usr/bin/env python3
"""
Checks Active Orders for rows marked "Delivered",
moves them to the Delivered tab with a date stamp,
then removes them from Active Orders, sorts by PO#, and re-applies all formulas.

Run anytime after marking items as Delivered:
    python3 sync_delivered.py
"""
import gspread, time
from datetime import date
from google.oauth2.service_account import Credentials

SHEET_ID   = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"
STATUS_COL = 16   # Column P — Status (1-indexed)
DATE_COL   = 17   # Column Q — Delivered Date
NUM_COLS   = 20

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
creds  = Credentials.from_service_account_file("google_creds.json", scopes=SCOPES)
gc     = gspread.authorize(creds)
sh     = gc.open_by_key(SHEET_ID)

ws_active = sh.worksheet("Active Orders")
ws_deliv  = sh.worksheet("Delivered")

today = date.today().strftime("%d-%b-%Y")


def reapply_formulas(ws, n):
    """Re-apply all calculated columns for rows 2..n+1"""
    if n == 0:
        return
    # Col I  = Buy Amt        = F * H
    # Col L  = Commission 5.5% = K * 0.055
    # Col M  = WHT 5%          = K * 0.05
    # Col N  = Net Receivable  = K - M
    # Col T  = P&L             = K - I
    formulas = {
        "I": lambda r: f"=IF(AND(F{r}<>\"\",H{r}<>\"\"),F{r}*H{r},\"\")",
        "L": lambda r: f"=IFERROR(K{r}*0.055,\"\")",
        "M": lambda r: f"=IFERROR(K{r}*0.05,\"\")",
        "N": lambda r: f"=IFERROR(K{r}-M{r},\"\")",
        "T": lambda r: f"=IF(AND(K{r}<>\"\",I{r}<>\"\"),K{r}-I{r},\"\")",
    }
    for col, fn in formulas.items():
        vals = [[fn(r)] for r in range(2, n + 2)]
        ws.update(
            range_name=f"{col}2:{col}{n+1}",
            values=vals,
            value_input_option="USER_ENTERED"
        )
        time.sleep(1)


# ── Read all active rows ──────────────────────────────────────────────────────
all_rows = ws_active.get_all_values()
header   = all_rows[0]
data     = all_rows[1:]

to_move = []
to_keep = []

for row in data:
    while len(row) < NUM_COLS:
        row.append("")
    status = row[STATUS_COL - 1].strip().lower()
    if status == "delivered":
        row[DATE_COL - 1] = today
        to_move.append(row)
    else:
        to_keep.append(row)

if not to_move:
    print("✅ Koi delivered item nahi mila. Sab pending hain.")
    # Still re-apply formulas to fix any broken calculations
    print("🔧 Formulas re-apply kar raha hoon...")
    reapply_formulas(ws_active, len(to_keep))
    exit(0)

print(f"📦 {len(to_move)} item(s) delivered — move kar raha hoon...\n")

# ── Append to Delivered tab ───────────────────────────────────────────────────
for row in to_move:
    ws_deliv.append_row(row, value_input_option="USER_ENTERED")
    print(f"  ✅ Moved: PO#{row[1]} — {row[3]}")
    time.sleep(1.5)

# ── Rebuild Active Orders sorted by PO# ──────────────────────────────────────
to_keep.sort(key=lambda r: int(str(r[1]).strip()) if str(r[1]).strip().isdigit() else 0)
for i, row in enumerate(to_keep, 1):
    row[0] = i

ws_active.batch_clear([f"A2:T{len(data) + 2}"])
time.sleep(3)

if to_keep:
    ws_active.update(
        range_name=f"A2:T{len(to_keep) + 1}",
        values=to_keep,
        value_input_option="USER_ENTERED"
    )
    time.sleep(3)

# ── Re-apply formulas on Active Orders ───────────────────────────────────────
print("\n🔧 Formulas re-apply kar raha hoon (Active Orders)...")
reapply_formulas(ws_active, len(to_keep))

# ── Re-apply formulas on Delivered tab ───────────────────────────────────────
deliv_rows = ws_deliv.get_all_values()
n_deliv = len(deliv_rows) - 1
if n_deliv > 0:
    print("🔧 Formulas re-apply kar raha hoon (Delivered)...")
    reapply_formulas(ws_deliv, n_deliv)

print(f"\n✅ Done!")
print(f"   Moved   : {len(to_move)} items → Delivered tab")
print(f"   Pending : {len(to_keep)} items remaining in Active Orders")
