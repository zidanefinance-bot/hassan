import gspread
from google.oauth2.service_account import Credentials
import time

CREDS_FILE = "google_creds.json"
SHEET_ID = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"

RAJBY_CUSTOMERS = ["cut to pack", "denim unit", "dyeing pvt", "utilities pvt", "washing pvt"]
NO_WHT_CUSTOMERS = ["pak pulses"]

def parse_num(val):
    if not val or str(val).strip() == "":
        return None
    try:
        return float(str(val).replace(",", "").strip())
    except:
        return None

def is_rajby(customer):
    return any(r in customer.lower() for r in RAJBY_CUSTOMERS)

def is_no_wht(customer):
    return any(r in customer.lower() for r in NO_WHT_CUSTOMERS)

creds = Credentials.from_service_account_file(
    CREDS_FILE, scopes=["https://www.googleapis.com/auth/spreadsheets"]
)
gc = gspread.authorize(creds)
sh = gc.open_by_key(SHEET_ID)
ws = sh.worksheet("Delivered")

all_vals = ws.get_all_values()
header = all_vals[0]
col = {h: i for i, h in enumerate(header)}

QTY      = col["Qty"]
BUY_RT   = col["Buy Rate (PKR)"]
BUY_AMT  = col["Buy Amt (PKR)"]
SELL_RT  = col["Sell Rate (PKR)"]
SELL_AMT = col["Sell Amt (PKR)"]
WHT_COL  = col["WHT 5% (Rajby)"]
NET_COL  = col["Net Receivable"]
COMM_COL = col["Commission (PKR)"]
CUST_COL = col["Customer / Unit"]

# Build all batch data per row (use update range per row = 1 API call per row)
batch_data = []

for i, row in enumerate(all_vals[1:], start=2):
    if not any(row):
        continue
    while len(row) < 20:
        row.append("")

    customer = row[CUST_COL].strip()
    qty    = parse_num(row[QTY])
    buy_r  = parse_num(row[BUY_RT])
    sell_r = parse_num(row[SELL_RT])

    if qty is None or sell_r is None:
        continue

    buy_amt  = round(qty * buy_r, 2) if buy_r is not None else ""
    sell_amt = round(qty * sell_r, 2)
    wht      = round(sell_amt * 0.05, 2) if not is_no_wht(customer) else ""
    net_rec  = round(sell_amt - (wht if wht != "" else 0), 2)
    comm     = round(sell_amt * 0.055, 2) if is_rajby(customer) else ""

    batch_data.append({
        "row": i,
        "buy_amt": buy_amt,
        "sell_amt": sell_amt,
        "wht": wht,
        "net": net_rec,
        "comm": comm,
        "customer": customer,
    })

print(f"Rows to update: {len(batch_data)}")

# Update using batch_update (single API call for all cols of each row)
from googleapiclient.discovery import build
service = build("sheets", "v4", credentials=creds)

value_ranges = []
for d in batch_data:
    r = d["row"]
    # Buy Amt col (I), Sell Amt col (K), WHT col (L), Net col (M), Comm col (T)
    # Using A1 notation: col indices BUY_AMT=8 → col I, SELL_AMT=10→K, WHT=11→L, NET=12→M, COMM=19→T
    def col_letter(idx):
        # 0-based idx to letter
        letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        if idx < 26:
            return letters[idx]
        return letters[idx // 26 - 1] + letters[idx % 26]

    if d["buy_amt"] != "":
        value_ranges.append({
            "range": f"Delivered!{col_letter(BUY_AMT)}{r}",
            "values": [[d["buy_amt"]]]
        })
    value_ranges.append({
        "range": f"Delivered!{col_letter(SELL_AMT)}{r}",
        "values": [[d["sell_amt"]]]
    })
    value_ranges.append({
        "range": f"Delivered!{col_letter(WHT_COL)}{r}",
        "values": [[d["wht"]]]
    })
    value_ranges.append({
        "range": f"Delivered!{col_letter(NET_COL)}{r}",
        "values": [[d["net"]]]
    })
    value_ranges.append({
        "range": f"Delivered!{col_letter(COMM_COL)}{r}",
        "values": [[d["comm"]]]
    })

# Split into chunks of 100 to avoid payload limits
chunk_size = 100
for start in range(0, len(value_ranges), chunk_size):
    chunk = value_ranges[start:start + chunk_size]
    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SHEET_ID,
        body={"valueInputOption": "USER_ENTERED", "data": chunk}
    ).execute()
    print(f"  Sent batch {start//chunk_size + 1} ({len(chunk)} cells)")
    time.sleep(1)

print(f"\nDone! {len(batch_data)} rows updated.")
for d in batch_data:
    wht_disp = f"{d['wht']:,.2f}" if d['wht'] != "" else "—"
    comm_disp = f"{d['comm']:,.2f}" if d['comm'] != "" else "—"
    print(f"  Row {d['row']} | {d['customer'][:22]:22} | Sell={d['sell_amt']:>10,.2f} | WHT={wht_disp:>8} | Net={d['net']:>10,.2f} | Comm={comm_disp:>8}")
