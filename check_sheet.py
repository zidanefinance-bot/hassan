import gspread
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request

CREDS_FILE = "/home/user/hassan/google_creds.json"
SHEET_ID = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"

creds = Credentials.from_service_account_file(
    CREDS_FILE, scopes=["https://www.googleapis.com/auth/spreadsheets"]
)
creds.refresh(Request())
gc = gspread.authorize(creds)
sh = gc.open_by_key(SHEET_ID)
ws = sh.worksheet("Active Orders")
all_vals = ws.get_all_values()
header = all_vals[0]
print("Header:", header)
print()
for i, row in enumerate(all_vals[1:], start=2):
    if any(row):
        print(f"Row {i}: {row}")
