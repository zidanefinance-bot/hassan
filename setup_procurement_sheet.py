#!/usr/bin/env python3
"""
One-time setup script: creates the Procurement Tracker Google Sheet
with Active Orders and Delivered tabs, then loads all current PO data.
Run once, then use Apps Script for ongoing automation.
"""
import gspread
from google.oauth2.service_account import Credentials

SCOPES = ["https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive"]
creds = Credentials.from_service_account_file("google_creds.json", scopes=SCOPES)
gc = gspread.authorize(creds)

# ── Create new spreadsheet ──
sh = gc.open_by_key("1CRR7pbz7cJJVyDcqytPD_EtHpHN6RMJW0OaoDZTNQ68")
print(f"Sheet opened: {sh.title}")

COLS = ["Sr#", "PO#", "Unit", "Item Description", "UOM",
        "Qty", "Rate (PKR)", "Amount (PKR)", "Tax%", "Total incl. Tax",
        "PO Date", "Status", "Delivered Date", "Zoho Invoice #"]

HDR_FMT = {
    "backgroundColor": {"red": 0.122, "green": 0.306, "blue": 0.475},
    "textFormat": {"foregroundColor": {"red":1,"green":1,"blue":1},
                   "bold": True, "fontSize": 10},
    "horizontalAlignment": "CENTER",
    "verticalAlignment": "MIDDLE",
}
PENDING_CLR = {"red": 1.0,   "green": 0.949, "blue": 0.8}    # light yellow
DELIV_CLR   = {"red": 0.839, "green": 0.937, "blue": 0.859}  # light green

def make_tab(sh, title, tab_color_rgb):
    try:
        ws = sh.add_worksheet(title=title, rows=500, cols=14)
    except Exception:
        ws = sh.worksheet(title)
    # Tab color
    sh.batch_update({"requests": [{"updateSheetProperties": {
        "properties": {"sheetId": ws.id, "title": title,
                       "tabColor": {"red": tab_color_rgb[0], "green": tab_color_rgb[1], "blue": tab_color_rgb[2]}},
        "fields": "title,tabColor"}}]})
    return ws

def format_sheet(ws, sheet_id, client):
    requests = [
        # Header row format
        {"repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1,
                      "startColumnIndex": 0, "endColumnIndex": 14},
            "cell": {"userEnteredFormat": HDR_FMT},
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
        }},
        # Freeze header
        {"updateSheetProperties": {
            "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount"
        }},
        # Column widths: Sr(50), PO(70), Unit(110), Item(280), UOM(55),
        #                Qty(55), Rate(90), Amt(100), Tax(55), Total(110),
        #                Date(90), Status(90), DelDate(95), InvNum(110)
        {"updateDimensionProperties": {
            "range": {"sheetId": sheet_id, "dimension": "COLUMNS",
                      "startIndex": 0, "endIndex": 14},
            "properties": {"pixelSize": 0}, "fields": "pixelSize"
        }},
    ]
    widths = [50, 70, 110, 280, 55, 55, 90, 100, 55, 110, 90, 90, 95, 110]
    for i, w in enumerate(widths):
        requests.append({"updateDimensionProperties": {
            "range": {"sheetId": sheet_id, "dimension": "COLUMNS",
                      "startIndex": i, "endIndex": i+1},
            "properties": {"pixelSize": w}, "fields": "pixelSize"
        }})
    # Row height for header
    requests.append({"updateDimensionProperties": {
        "range": {"sheetId": sheet_id, "dimension": "ROWS", "startIndex": 0, "endIndex": 1},
        "properties": {"pixelSize": 32}, "fields": "pixelSize"
    }})
    client.batch_update({"requests": requests})

# ── All PO data ──
PO_DATA = [
    # (po, unit, item, uom, qty, rate, tax_pct, date)
    # PO 1183
    ("1183","Washing PVT","Pyodine 60ml","PCS",30,225,0,"02-Jul-2026"),
    ("1183","Washing PVT","Cotton Medicated 25grm","PKT",20,20,0,"02-Jul-2026"),
    ("1183","Washing PVT",'Bandages 3"',"PCS",60,25,0,"02-Jul-2026"),
    ("1183","Washing PVT",'Bandages 4"',"PCS",60,30,0,"02-Jul-2026"),
    ("1183","Washing PVT",'Bandages 5"',"PCS",60,34,0,"02-Jul-2026"),
    ("1183","Washing PVT","Tourniquet","PCS",20,200,0,"02-Jul-2026"),
    ("1183","Washing PVT","Ointment (Polyfax)","PCS",20,240,0,"02-Jul-2026"),
    ("1183","Washing PVT","Betnesol 7.5ml","PCS",20,230,0,"02-Jul-2026"),
    ("1183","Washing PVT","Dettol Bottle 50ml","PCS",20,260,0,"02-Jul-2026"),
    ("1183","Washing PVT","Paratule","PKT",15,320,0,"02-Jul-2026"),
    # PO 17427
    ("17427","Cut to Pack PVT","Pyodine 60ml","PCS",40,233,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT",'Bandages 2"',"PCS",36,25,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT",'Bandages 3"',"PCS",36,34,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Saniplast","PKT",12,357,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Crepe Bandage","PCS",24,49,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Surgical Cotton","PCS",24,118,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Poly Flex","PCS",12,250,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Burnol 20gm (Tube)","PCS",12,123,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Iodex Mini Jar","PCS",20,123,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Surgical Tape","PCS",12,93,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Benzoin Compound Tincture","PCS",24,82,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Dettol Bottle 50ml","PCS",24,270,5,"02-Jul-2026"),
    ("17427","Cut to Pack PVT","Surgical Safety Pin","PKT",4,49,5,"02-Jul-2026"),
    # PO 17412
    ("17412","Cut to Pack PVT","Rice Spoon","PCS",24,50,0,"02-Jul-2026"),
    ("17412","Cut to Pack PVT",'Ceramic Plates White 8"',"PCS",6,295,5,"02-Jul-2026"),
    ("17412","Cut to Pack PVT",'Ceramic Plates White 12"',"PCS",6,300,5,"02-Jul-2026"),
    ("17412","Cut to Pack PVT","Glass Jug 1.5 Ltr","PCS",2,700,5,"02-Jul-2026"),
    ("17412","Cut to Pack PVT","Deli Glass 6 pcs (Set)","SET",2,800,5,"02-Jul-2026"),
    # PO 17426
    ("17426","Cut to Pack PVT","Plastic Jar (Small Size)","PCS",36,70,5,"02-Jul-2026"),
    # PO 1163
    ("1163","Washing PVT","Kafgeer 1 KG (Steel)","PCS",2,1000,0,"30-Jun-2026"),
    ("1163","Washing PVT","Kafgeer 2 KG (Steel)","PCS",3,3000,0,"30-Jun-2026"),
    # PO 17257
    ("17257","Cut to Pack PVT","Air Freshner Room Spray 300ml Topic Brand","PCS",96,260,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Bleach 30KG Local","CAN",14,970,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Broom Hard","PCS",200,235,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Broom Soft PP","PCS",200,200,0,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","China Brush","PCS",60,300,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Dustbin Bag 18x24 Black","KG",50,300,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Dustbin Bag 30x50 Black","KG",50,300,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Duster Fabric","PCS",96,37,0,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Glass Cleaner Glint 500ml","BTL",96,250,0,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Hand Brush","PCS",12,300,0,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Hand Wash Lose Local","KG",200,270,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Handwash Lifeboy 140ml","BTL",48,300,0,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Harpic 500ml","BTL",96,380,0,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Lux Soap 70 Grams","PCS",100,150,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Mop Big 18x18 Wooden","PCS",100,394,0,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Mop Refill (600 Gram)","PCS",200,347,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Mop Stick","PCS",60,473,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Mortein Spray","PCS",48,590,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Phenyl Zip Local 3 Ltr","BTL",200,420,0,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Roomi Box","CTN",2,18000,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Safety Match 10 PCS","PKT",15,100,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Scotch Bright","PCS",24,70,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Scraper Plastic Supri","PCS",60,105,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Tile Wash Sweep Local 30KG","CAN",7,1180,0,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Tissue Box Rose Petal Pop Up 150 Sheet","PKT",150,270,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Tissue Paper Roll","PCS",300,120,5,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","VIM Toilet Bleach Powder Lose Local","PCS",25,180,0,"29-Jun-2026"),
    ("17257","Cut to Pack PVT","Viper Large 4ft","PCS",50,579,0,"29-Jun-2026"),
    # PO 17308
    ("17308","Cut to Pack PVT","Coffee (100g)","PCS",3,1600,0,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Every Day Tea Whitener 2KG Pouch","PKT",260,4185,0,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Lipton Lemon Green Tea 100 Bags","PKT",30,1150,0,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Lipton Tea Bag 600 Bags","BOX",11,3300,0,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Nescafe (200gm)","PCS",18,2800,0,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Nestle Water 500ml","CRT",23,680,0,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Sugar 2 KGS Pack","PKT",350,305,0,"30-Jun-2026"),
    ("17308","Cut to Pack PVT","Tapal Family Mixture (900gm)","PKT",176,1850,0,"30-Jun-2026"),
    # PO 1194
    ("1194","Washing PVT","Molty Foam Sheet (3'x6'x2\") 980","SHT",6,3579,0,"06-Jul-2026"),
    # PO 406
    ("406","Utilities PVT","Ceramic Fibre Rope 10mm Dia x 30m (Temp 150-200°C)","ROL",4,15789,0,"03-Jul-2026"),
    # PO 891
    ("891","Washing PVT","Nylon Wheel 6\" With Bracket (Revolving)","PCS",40,1495,0,"16-May-2026"),
    # PO 1145
    ("1145","Washing PVT","Nylon Wheel 6\" With Bracket (Revolving)","PCS",100,1495,0,"29-Jun-2026"),
    # PO 76
    ("76","Denim Unit","Bench Vise / Wood Working Vice Set","PCS",1,5000,0,"30-Jun-2026"),
    ("76","Denim Unit","C-Clamp Set","PCS",6,1040,0,"30-Jun-2026"),
    ("76","Denim Unit","Center Punch Set","PCS",2,300,0,"30-Jun-2026"),
    ("76","Denim Unit","File Set (Rasp & File Set / Ruff File - 10mm)","PCS",1,530,0,"30-Jun-2026"),
    ("76","Denim Unit","Flat Chisel Set","PCS",1,1875,0,"30-Jun-2026"),
    ("76","Denim Unit","Hammer 1KG","PCS",6,480,0,"30-Jun-2026"),
    ("76","Denim Unit","Hammer 5KG","PCS",1,1125,0,"30-Jun-2026"),
    ("76","Denim Unit","Hand Level 2'","PCS",2,313,0,"30-Jun-2026"),
    ("76","Denim Unit","Hole Saw Set 20mm to 50mm","PCS",1,938,0,"30-Jun-2026"),
    ("76","Denim Unit","Iron Chisel Rod 1'","PCS",6,570,0,"30-Jun-2026"),
    ("76","Denim Unit","Iron Chisel Rod 1.5'","PCS",6,570,0,"30-Jun-2026"),
    ("76","Denim Unit","Measuring Tape / Inch Tape 16FT","PCS",6,230,0,"30-Jun-2026"),
    ("76","Denim Unit","Nail Punch Set","PCS",2,875,0,"30-Jun-2026"),
    ("76","Denim Unit","Screw Extractor Set 3mm-6mm Total Brand","PCS",1,813,0,"30-Jun-2026"),
    ("76","Denim Unit","Try Square 2 Ft x 6 Inch (Steel)","PCS",1,500,0,"30-Jun-2026"),
    ("76","Denim Unit","Try Square Steel Type","PCS",2,350,0,"30-Jun-2026"),
    ("76","Denim Unit","Yato Screw Wrench Set","PCS",1,3000,0,"30-Jun-2026"),
]

def build_rows(data):
    rows = []
    for sr, (po, unit, item, uom, qty, rate, tax_pct, date) in enumerate(data, 1):
        amt   = qty * rate
        tax   = round(amt * tax_pct / 100, 2)
        total = amt + tax
        rows.append([
            sr, po, unit, item, uom, qty, rate, amt,
            f"{tax_pct}%" if tax_pct else "0%",
            total, date, "Pending", "", ""
        ])
    return rows

# ── Setup Active Orders tab ──
ws_active = sh.get_worksheet(0)
ws_active.update_title("Active Orders")
ws_active.update([COLS] + build_rows(PO_DATA), value_input_option="USER_ENTERED")
format_sheet(ws_active, ws_active.id, sh)

# Color data rows light yellow (pending)
active_sheet_id = ws_active.id
n = len(PO_DATA)
sh.batch_update({"requests": [{"repeatCell": {
    "range": {"sheetId": active_sheet_id, "startRowIndex": 1, "endRowIndex": n+1,
              "startColumnIndex": 0, "endColumnIndex": 14},
    "cell": {"userEnteredFormat": {
        "backgroundColor": PENDING_CLR,
        "verticalAlignment": "MIDDLE",
        "textFormat": {"fontSize": 9},
    }},
    "fields": "userEnteredFormat(backgroundColor,verticalAlignment,textFormat)"
}}]})

# ── Setup Delivered tab ──
ws_deliv = make_tab(sh, "Delivered", (0.2, 0.6, 0.3))
ws_deliv.append_row(COLS)
format_sheet(ws_deliv, ws_deliv.id, sh)

# ── Data Validation: Status dropdown in Active Orders col L (index 11) ──
sh.batch_update({"requests": [{"setDataValidation": {
    "range": {"sheetId": active_sheet_id, "startRowIndex": 1, "endRowIndex": 500,
              "startColumnIndex": 11, "endColumnIndex": 12},
    "rule": {
        "condition": {"type": "ONE_OF_LIST",
                      "values": [{"userEnteredValue": "Pending"},
                                 {"userEnteredValue": "Delivered"}]},
        "showCustomUi": True, "strict": True
    }
}}]})

print(f"\n✅ Done! Open your sheet:")
print(f"   https://docs.google.com/spreadsheets/d/{sh.id}")
print(f"\nNext: paste the Apps Script in the sheet's Apps Script editor.")
print(f"Sheet ID for reference: {sh.id}")
