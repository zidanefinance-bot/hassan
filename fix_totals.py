import gspread
from google.oauth2.service_account import Credentials

CREDS_FILE = "google_creds.json"
SHEET_ID = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"

creds = Credentials.from_service_account_file(
    CREDS_FILE, scopes=["https://www.googleapis.com/auth/spreadsheets"]
)
gc = gspread.authorize(creds)
sh = gc.open_by_key(SHEET_ID)
ws = sh.worksheet("Active Orders")

all_vals = ws.get_all_values()
header = all_vals[0]

col = {h: i for i, h in enumerate(header)}
# Cols: Qty=5, SellRate=9, SellAmt=10, Comm=11, WHT=12, NetRec=13

updates = []
for i, row in enumerate(all_vals[1:], start=2):
    po = row[col["PO#"]].strip() if len(row) > col["PO#"] else ""
    if po != "18115":
        continue

    qty_str = row[col["Qty"]].strip() if len(row) > col["Qty"] else ""
    sell_rate_str = row[col["Sell Rate (PKR)"]].strip() if len(row) > col["Sell Rate (PKR)"] else ""

    if not qty_str or not sell_rate_str:
        continue

    qty = float(qty_str.replace(",", ""))
    sell_rate = float(sell_rate_str.replace(",", ""))
    sell_amt = qty * sell_rate
    commission = round(sell_amt * 0.055, 2)
    wht = round(sell_amt * 0.05, 2)
    net_receivable = round(sell_amt - wht, 2)

    # Sheet is 1-indexed, col is 0-indexed -> col+1 for gspread
    updates.append({
        "row": i,
        "sell_amt": sell_amt,
        "commission": commission,
        "wht": wht,
        "net_rec": net_receivable,
        "item": row[3][:30]
    })

print(f"Rows to update: {len(updates)}")
for u in updates:
    r = u["row"]
    # Update SellAmt(col K=11), Comm(col L=12), WHT(col M=13), NetRec(col N=14) — 1-based
    ws.update_cell(r, col["Sell Amt (PKR)"] + 1, u["sell_amt"])
    ws.update_cell(r, col["Commission 5.5%"] + 1, u["commission"])
    ws.update_cell(r, col["WHT 5% (Rajby)"] + 1, u["wht"])
    ws.update_cell(r, col["Net Receivable"] + 1, u["net_rec"])
    print(f"  Row {r}: {u['item'][:30]} | Sell={u['sell_amt']:,.0f} | Comm={u['commission']:,.0f} | WHT={u['wht']:,.0f} | Net={u['net_rec']:,.0f}")

print("\nDone!")
