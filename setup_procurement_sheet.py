#!/usr/bin/env python3
"""
Setup / reset the Procurement Tracker Google Sheet.
Run whenever columns change or to reload fresh data.
"""
import gspread
from gspread.exceptions import WorksheetNotFound
from google.oauth2.service_account import Credentials

SHEET_ID = "1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68"

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
creds  = Credentials.from_service_account_file("google_creds.json", scopes=SCOPES)
gc     = gspread.authorize(creds)
sh     = gc.open_by_key(SHEET_ID)

# ── Column layout (17 cols) ──────────────────────────────────────────────────
# A   B    C     D        E    F    G       H         I
# Sr  PO#  Unit  Item     UOM  Qty  Vendor  BuyRate   BuyAmt
# J          K        L           M        N       O             P             Q
# SellRate   SellAmt  Commission  PODate   Status  DelivDate     ZohoInvoice#  ZohoBill#

COLS = [
    "Sr#", "PO#", "Unit", "Item Description", "UOM", "Qty",
    "Vendor", "Buy Rate (PKR)", "Buy Amt (PKR)",
    "Sell Rate (PKR)", "Sell Amt (PKR)",
    "Commission 5.5%", "WHT 5% (Rajby)", "Net Receivable",
    "PO Date", "Status", "Delivered Date", "Zoho Invoice #", "Zoho Bill #"
]
NUM_COLS = len(COLS)  # 19

HDR_BG   = {"red": 0.122, "green": 0.306, "blue": 0.475}
WHITE    = {"red": 1, "green": 1, "blue": 1}
PEND_BG  = {"red": 1.0,   "green": 0.961, "blue": 0.8}
DELIV_BG = {"red": 0.839, "green": 0.937, "blue": 0.859}

# Column widths (px) for A–Q
COL_WIDTHS = [40, 65, 110, 270, 55, 50, 130, 90, 90, 90, 90, 105, 105, 110, 90, 85, 95, 110, 100]


def apply_formats(sid, nrows):
    def cell_range(r0, r1, c0, c1):
        return {"sheetId": sid, "startRowIndex": r0, "endRowIndex": r1,
                "startColumnIndex": c0, "endColumnIndex": c1}

    requests = [
        # Header
        {"repeatCell": {
            "range": cell_range(0, 1, 0, NUM_COLS),
            "cell": {"userEnteredFormat": {
                "backgroundColor": HDR_BG,
                "textFormat": {"foregroundColor": WHITE, "bold": True, "fontSize": 10},
                "horizontalAlignment": "CENTER", "verticalAlignment": "MIDDLE",
            }},
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
        }},
        # Buy columns header (G–I = 6–8): dark green
        {"repeatCell": {
            "range": cell_range(0, 1, 6, 9),
            "cell": {"userEnteredFormat": {
                "backgroundColor": {"red": 0.18, "green": 0.49, "blue": 0.2},
                "textFormat": {"foregroundColor": WHITE, "bold": True, "fontSize": 10},
            }},
            "fields": "userEnteredFormat(backgroundColor,textFormat)"
        }},
        # Sell columns header (J–K = 9–10): dark blue
        {"repeatCell": {
            "range": cell_range(0, 1, 9, 11),
            "cell": {"userEnteredFormat": {
                "backgroundColor": {"red": 0.1, "green": 0.35, "blue": 0.6},
                "textFormat": {"foregroundColor": WHITE, "bold": True, "fontSize": 10},
            }},
            "fields": "userEnteredFormat(backgroundColor,textFormat)"
        }},
        # Commission + WHT + Net (L–N = 11–13): orange
        {"repeatCell": {
            "range": cell_range(0, 1, 11, 14),
            "cell": {"userEnteredFormat": {
                "backgroundColor": {"red": 0.8, "green": 0.4, "blue": 0.0},
                "textFormat": {"foregroundColor": WHITE, "bold": True, "fontSize": 10},
            }},
            "fields": "userEnteredFormat(backgroundColor,textFormat)"
        }},
        # Freeze header + 2 cols
        {"updateSheetProperties": {
            "properties": {"sheetId": sid,
                           "gridProperties": {"frozenRowCount": 1, "frozenColumnCount": 2}},
            "fields": "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
        }},
        # Header row height
        {"updateDimensionProperties": {
            "range": {"sheetId": sid, "dimension": "ROWS", "startIndex": 0, "endIndex": 1},
            "properties": {"pixelSize": 34}, "fields": "pixelSize"
        }},
        # Data rows height
        {"updateDimensionProperties": {
            "range": {"sheetId": sid, "dimension": "ROWS", "startIndex": 1, "endIndex": max(nrows+2, 10)},
            "properties": {"pixelSize": 22}, "fields": "pixelSize"
        }},
        # Data rows background
        {"repeatCell": {
            "range": cell_range(1, max(nrows+1, 2), 0, NUM_COLS),
            "cell": {"userEnteredFormat": {
                "backgroundColor": PEND_BG,
                "textFormat": {"fontSize": 9},
                "verticalAlignment": "MIDDLE",
            }},
            "fields": "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)"
        }},
        # Status dropdown
        {"setDataValidation": {
            "range": cell_range(1, 500, 15, 16),
            "rule": {
                "condition": {"type": "ONE_OF_LIST",
                              "values": [{"userEnteredValue": "Pending"},
                                         {"userEnteredValue": "Delivered"}]},
                "showCustomUi": True, "strict": True
            }
        }},
    ]

    # Column widths
    for i, w in enumerate(COL_WIDTHS):
        requests.append({"updateDimensionProperties": {
            "range": {"sheetId": sid, "dimension": "COLUMNS", "startIndex": i, "endIndex": i+1},
            "properties": {"pixelSize": w}, "fields": "pixelSize"
        }})

    sh.batch_update({"requests": requests})


def get_or_create(title, tab_rgb, cols=500):
    try:
        ws = sh.worksheet(title)
        ws.clear()
    except WorksheetNotFound:
        ws = sh.add_worksheet(title=title, rows=cols, cols=NUM_COLS)
    sh.batch_update({"requests": [{"updateSheetProperties": {
        "properties": {"sheetId": ws.id, "tabColor": {
            "red": tab_rgb[0], "green": tab_rgb[1], "blue": tab_rgb[2]}},
        "fields": "tabColor"}}]})
    return ws


# ── PO DATA: (po, unit, item, uom, qty, sell_rate, date) ──
PO_DATA = [
    # PO 1183
    ("1183","Washing PVT","Pyodine 60ml","PCS",30,225,"02-Jul-2026"),
    ("1183","Washing PVT","Cotton Medicated 25grm","PKT",20,20,"02-Jul-2026"),
    ("1183","Washing PVT",'Bandages 3"',"PCS",60,25,"02-Jul-2026"),
    ("1183","Washing PVT",'Bandages 4"',"PCS",60,30,"02-Jul-2026"),
    ("1183","Washing PVT",'Bandages 5"',"PCS",60,34,"02-Jul-2026"),
    ("1183","Washing PVT","Tourniquet","PCS",20,200,"02-Jul-2026"),
    ("1183","Washing PVT","Ointment (Polyfax)","PCS",20,240,"02-Jul-2026"),
    ("1183","Washing PVT","Betnesol 7.5ml","PCS",20,230,"02-Jul-2026"),
    ("1183","Washing PVT","Dettol Bottle 50ml","PCS",20,260,"02-Jul-2026"),
    ("1183","Washing PVT","Paratule","PKT",15,320,"02-Jul-2026"),
    # PO 17427
    ("17427","Cut to Pack PVT","Pyodine 60ml","PCS",40,233,"02-Jul-2026"),
    ("17427","Cut to Pack PVT",'Bandages 2"',"PCS",36,25,"02-Jul-2026"),
    ("17427","Cut to Pack PVT",'Bandages 3"',"PCS",36,34,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Saniplast","PKT",12,357,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Crepe Bandage","PCS",24,49,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Surgical Cotton","PCS",24,118,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Poly Flex","PCS",12,250,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Burnol 20gm (Tube)","PCS",12,123,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Iodex Mini Jar","PCS",20,123,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Surgical Tape","PCS",12,93,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Benzoin Compound Tincture","PCS",24,82,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Dettol Bottle 50ml","PCS",24,270,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Surgical Safety Pin","PKT",4,49,"02-Jul-2026"),
    # PO 17412
    ("17412","Cut to Pack PVT","Rice Spoon","PCS",24,50,"02-Jul-2026"),
    ("17412","Cut to Pack PVT",'Ceramic Plates White 8"',"PCS",6,295,"02-Jul-2026"),
    ("17412","Cut to Pack PVT",'Ceramic Plates White 12"',"PCS",6,300,"02-Jul-2026"),
    ("17412","Cut to Pack PVT","Glass Jug 1.5 Ltr","PCS",2,700,"02-Jul-2026"),
    ("17412","Cut to Pack PVT","Deli Glass 6 pcs (Set)","SET",2,800,"02-Jul-2026"),
    # PO 17426
    ("17426","Cut to Pack PVT","Plastic Jar (Small Size)","PCS",36,70,"02-Jul-2026"),
    # PO 1163
    ("1163","Washing PVT","Kafgeer 1 KG (Steel)","PCS",2,1000,"30-Jun-2026"),
    ("1163","Washing PVT","Kafgeer 2 KG (Steel)","PCS",3,3000,"30-Jun-2026"),
    # PO 17257
    ("17257","Cut to Pack PVT","Air Freshner Room Spray 300ml Topic Brand","PCS",96,260,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Bleach 30KG Local","CAN",14,970,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Broom Hard","PCS",200,235,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Broom Soft PP","PCS",200,200,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","China Brush","PCS",60,300,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Dustbin Bag 18x24 Black","KG",50,300,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Dustbin Bag 30x50 Black","KG",50,300,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Duster Fabric","PCS",96,37,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Glass Cleaner Glint 500ml","BTL",96,250,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Hand Brush","PCS",12,300,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Hand Wash Lose Local","KG",200,270,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Handwash Lifeboy 140ml","BTL",48,300,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Harpic 500ml","BTL",96,380,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Lux Soap 70 Grams","PCS",100,150,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Mop Big 18x18 Wooden","PCS",100,394,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Mop Refill (600 Gram)","PCS",200,347,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Mop Stick","PCS",60,473,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Mortein Spray","PCS",48,590,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Phenyl Zip Local 3 Ltr","BTL",200,420,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Roomi Box","CTN",2,18000,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Safety Match 10 PCS","PKT",15,100,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Scotch Bright","PCS",24,70,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Scraper Plastic Supri","PCS",60,105,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Tile Wash Sweep Local 30KG","CAN",7,1180,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Tissue Box Rose Petal Pop Up 150 Sheet","PKT",150,270,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Tissue Paper Roll","PCS",300,120,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","VIM Toilet Bleach Powder Lose Local","PCS",25,180,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Viper Large 4ft","PCS",50,579,"29-Jun-2026"),
    # PO 17308
    ("17308","Cut to Pack PVT","Coffee (100g)","PCS",3,1600,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Every Day Tea Whitener 2KG Pouch","PKT",260,4185,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Lipton Lemon Green Tea 100 Bags","PKT",30,1150,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Lipton Tea Bag 600 Bags","BOX",11,3300,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Nescafe (200gm)","PCS",18,2800,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Nestle Water 500ml","CRT",23,680,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Sugar 2 KGS Pack","PKT",350,305,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Tapal Family Mixture (900gm)","PKT",176,1850,"30-Jun-2026"),
    # PO 1194
    ("1194","Washing PVT","Molty Foam Sheet (3'x6'x2\") 980","SHT",6,3579,"06-Jul-2026"),
    # PO 406
    ("406","Utilities PVT","Ceramic Fibre Rope 10mm Dia x 30m (Temp 150-200°C)","ROL",4,15789,"03-Jul-2026"),
    # PO 891
    ("891","Washing PVT","Nylon Wheel 6\" With Bracket (Revolving)","PCS",40,1495,"16-May-2026"),
    # PO 1145
    ("1145","Washing PVT","Nylon Wheel 6\" With Bracket (Revolving)","PCS",100,1495,"29-Jun-2026"),
    # PO 76
    ("76","Denim Unit","Bench Vise / Wood Working Vice Set","PCS",1,5000,"30-Jun-2026"),
    ("76","Denim Unit","C-Clamp Set","PCS",6,1040,"30-Jun-2026"),
    ("76","Denim Unit","Center Punch Set","PCS",2,300,"30-Jun-2026"),
    ("76","Denim Unit","File Set (Rasp & File Set / Ruff File - 10mm)","PCS",1,530,"30-Jun-2026"),
    ("76","Denim Unit","Flat Chisel Set","PCS",1,1875,"30-Jun-2026"),
    ("76","Denim Unit","Hammer 1KG","PCS",6,480,"30-Jun-2026"),
    ("76","Denim Unit","Hammer 5KG","PCS",1,1125,"30-Jun-2026"),
    ("76","Denim Unit","Hand Level 2'","PCS",2,313,"30-Jun-2026"),
    ("76","Denim Unit","Hole Saw Set 20mm to 50mm","PCS",1,938,"30-Jun-2026"),
    ("76","Denim Unit","Iron Chisel Rod 1'","PCS",6,570,"30-Jun-2026"),
    ("76","Denim Unit","Iron Chisel Rod 1.5'","PCS",6,570,"30-Jun-2026"),
    ("76","Denim Unit","Measuring Tape / Inch Tape 16FT","PCS",6,230,"30-Jun-2026"),
    ("76","Denim Unit","Nail Punch Set","PCS",2,875,"30-Jun-2026"),
    ("76","Denim Unit","Screw Extractor Set 3mm-6mm Total Brand","PCS",1,813,"30-Jun-2026"),
    ("76","Denim Unit","Try Square 2 Ft x 6 Inch (Steel)","PCS",1,500,"30-Jun-2026"),
    ("76","Denim Unit","Try Square Steel Type","PCS",2,350,"30-Jun-2026"),
    ("76","Denim Unit","Yato Screw Wrench Set","PCS",1,3000,"30-Jun-2026"),
]


def build_rows(data):
    rows = []
    for sr, (po, unit, item, uom, qty, sell_rate, date) in enumerate(data, 1):
        sell_amt = qty * sell_rate
        rows.append([
            sr, po, unit, item, uom, qty,
            "",           # Vendor
            "",           # Buy Rate
            "",           # Buy Amt (formula)
            sell_rate,
            sell_amt,
            "",           # Commission 5.5% (formula)
            "",           # WHT 5% (formula)
            "",           # Net Receivable (formula)
            date,
            "Pending",
            "", "", ""    # Delivered Date, Invoice#, Bill#
        ])
    return rows


# ── Active Orders ────────────────────────────────────────────────────────────
ws_active = get_or_create("Active Orders", (0.122, 0.306, 0.475))
rows = build_rows(PO_DATA)
ws_active.update([COLS] + rows, value_input_option="USER_ENTERED")

n = len(rows)

# Formulas:
# I = Buy Amt    = F × H
# L = Commission = K × 5.5%
# M = WHT        = K × 5%
# N = Net Recv   = K − M
formulas_I = [[f"=IF(H{r}<>\"\",F{r}*H{r},\"\")"]   for r in range(2, n+2)]
formulas_L = [[f"=IFERROR(K{r}*0.055,\"\")"]         for r in range(2, n+2)]
formulas_M = [[f"=IFERROR(K{r}*0.05,\"\")"]          for r in range(2, n+2)]
formulas_N = [[f"=IFERROR(K{r}-M{r},\"\")"]          for r in range(2, n+2)]
ws_active.update(f"I2:I{n+1}", formulas_I, value_input_option="USER_ENTERED")
ws_active.update(f"L2:L{n+1}", formulas_L, value_input_option="USER_ENTERED")
ws_active.update(f"M2:M{n+1}", formulas_M, value_input_option="USER_ENTERED")
ws_active.update(f"N2:N{n+1}", formulas_N, value_input_option="USER_ENTERED")

apply_formats(ws_active.id, n)

# Number formats for amount columns
sh.batch_update({"requests": [
    {"repeatCell": {
        "range": {"sheetId": ws_active.id,
                  "startRowIndex": 1, "endRowIndex": n+1,
                  "startColumnIndex": c, "endColumnIndex": c+1},
        "cell": {"userEnteredFormat": {
            "numberFormat": {"type": "NUMBER", "pattern": "#,##0.00"}}},
        "fields": "userEnteredFormat.numberFormat"
    }}
    for c in [7, 8, 9, 10, 11, 12, 13]  # Buy Rate/Amt, Sell Rate/Amt, Commission, WHT, Net
]})

print(f"✅ Active Orders — {n} items loaded")

# ── Delivered tab ────────────────────────────────────────────────────────────
ws_deliv = get_or_create("Delivered", (0.2, 0.6, 0.3))
ws_deliv.update([COLS], value_input_option="USER_ENTERED")
apply_formats(ws_deliv.id, 0)
print("✅ Delivered tab ready")

print(f"\n🔗 https://docs.google.com/spreadsheets/d/{SHEET_ID}")
