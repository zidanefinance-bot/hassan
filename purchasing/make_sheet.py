from openpyxl import Workbook
from openpyxl.styles import (Font, PatternFill, Alignment, Border, Side,
                              GradientFill)
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import FormulaRule

wb = Workbook()
ws = wb.active
ws.title = "Purchasing Sheet"

items = [
    ("NYLON WHEEL 6\" WITH BRACKET (REVOLVING)", "PCS", 40),
    ("AIR FRESHNER ROOM SPRAY 300ML TOPIC BRAND", "PCS", 96),
    ("BLEACH 30KG LOCAL", "CAN", 8),
    ("BROOM HARD", "PCS", 200),
    ("BROOM SOFT", "PCS", 200),
    ("CHINA BRUSH", "PCS", 130),
    ("DUSTBIN BAG 30 X 50 BLACK", "KG", 48),
    ("DUSTER FABRIC", "PCS", 100),
    ("GLASS CLEANER GLINT 500 ML", "BTL", 24),
    ("HAND BRUSH", "PCS", 24),
    ("HANDWASH LIFEBOY 140 ML", "BTL", 48),
    ("LEMON MAX BAR 285 GRAMS", "PCS", 48),
    ("LUX SOAP 70 GRAMS", "PCS", 100),
    ("MOP BIG 18 X 18 WOODEN", "PCS", 100),
    ("MOP REFILL (600 GRAM)", "PCS", 300),
    ("MOP STICK", "PCS", 48),
    ("PHENYL ZIP LOCAL 3 LTR", "BTL", 200),
    ("ROOMI BOX", "CTN", 1),
    ("SAFTY MATCH 10 PCS", "PKT", 15),
    ("SCRAPER PLASTIC SUPRI", "PCS", 48),
    ("SURF LOOSE LOCAL", "KG", 50),
    ("TILE WASH SWEEP LOCAL 30KG", "CAN", 9),
    ("TISSUE BOX ROSE PETAL POP UP 150 SHEET", "PKT", 300),
    ("TISSUE PAPER ROLL", "PCS", 200),
    ("VIM TOILET BLEACH POWDER LOSE LOCAL", "PCS", 24),
    ("CERAMIC FIBRE ROPE 10MM DIA X 30M TEMP 150-200C", "PCS", 4),
    ("CERAMIC PLATES WHITE 12INCH", "PCS", 12),
    ("CERAMIC PLATES WHITE 8INCH", "PCS", 12),
    ("GLASS 6 PCS SET", "SET", 1),
    ("TABLE SPOON STAINLESS STEEL", "DZN", 2),
    ("COFFEE (100G)", "PCS", 3),
    ("EVERY DAY TEA WHITENER 2KG 1 POUCH", "PKT", 260),
    ("LIPTON LEMON GREEN TEA 100 BAGS", "PKT", 30),
    ("LIPTON TEA BAG 600 BAGS", "BOX", 10),
    ("NESCAFE (200GM)", "PCS", 23),
    ("NESTLE WATER 500 ML", "CRT", 23),
    ("SUGAR 2 KGS PACK", "PKT", 350),
    ("TAPAL FAMILY MIXTURE (900GM)", "PKT", 176),
]

# Colors
DARK_BLUE   = "1A3A6B"
MED_BLUE    = "2E75B6"
LIGHT_BLUE  = "D6E4F0"
YELLOW      = "FFF2CC"
ORANGE_FILL = "FCE4D6"
GREEN_FILL  = "E2EFDA"
WHITE       = "FFFFFF"
GREY        = "F2F2F2"

def side(style="thin", color="AAAAAA"):
    return Side(style=style, color=color)

def border(all="thin"):
    s = side(all)
    return Border(left=s, right=s, top=s, bottom=s)

def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def font(bold=False, size=11, color="000000", name="Calibri"):
    return Font(bold=bold, size=size, color=color, name=name)

def align(h="center", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

# ── Column widths ──────────────────────────────────────────
ws.column_dimensions["A"].width = 5
ws.column_dimensions["B"].width = 44
ws.column_dimensions["C"].width = 8
ws.column_dimensions["D"].width = 8
ws.column_dimensions["E"].width = 14
ws.column_dimensions["F"].width = 16

# ══════════════════════════════════════════════════════════
# ROW 1 – Company header
# ══════════════════════════════════════════════════════════
ws.merge_cells("A1:F1")
ws.row_dimensions[1].height = 32
c = ws["A1"]
c.value = "ZIDANE CORPORATION  —  PURCHASING SHEET"
c.font = Font(bold=True, size=15, color=WHITE, name="Calibri")
c.fill = fill(DARK_BLUE)
c.alignment = align("center")

# ══════════════════════════════════════════════════════════
# ROW 2 – Meta labels
# ══════════════════════════════════════════════════════════
ws.row_dimensions[2].height = 20
for col, label in [("A",""), ("B","DATE"), ("C",""), ("D","CUSTOMER / ORDER"), ("E",""), ("F","ADVANCE GIVEN (PKR)")]:
    c = ws[f"{col}2"]
    c.value = label
    c.font = font(bold=True, size=9, color="555555")
    c.fill = fill(LIGHT_BLUE)
    c.alignment = align("left")
ws.merge_cells("A2:A2")

# ══════════════════════════════════════════════════════════
# ROW 3 – Meta values (user fills)
# ══════════════════════════════════════════════════════════
ws.row_dimensions[3].height = 22
ws.merge_cells("B3:C3")
ws.merge_cells("D3:E3")

date_cell = ws["B3"]
date_cell.number_format = "DD-MMM-YYYY"
date_cell.font = font(bold=True, size=12, color=DARK_BLUE)
date_cell.fill = fill(YELLOW)
date_cell.alignment = align("center")
date_cell.border = border()

cust_cell = ws["D3"]
cust_cell.font = font(bold=True, size=12, color=DARK_BLUE)
cust_cell.fill = fill(YELLOW)
cust_cell.alignment = align("left")
cust_cell.border = border()

adv_cell = ws["F3"]
adv_cell.number_format = '#,##0'
adv_cell.font = font(bold=True, size=12, color="8B4513")
adv_cell.fill = fill(YELLOW)
adv_cell.alignment = align("right")
adv_cell.border = border()

# ══════════════════════════════════════════════════════════
# ROW 4 – blank spacer
# ══════════════════════════════════════════════════════════
ws.row_dimensions[4].height = 6

# ══════════════════════════════════════════════════════════
# ROW 5 – Table header
# ══════════════════════════════════════════════════════════
ws.row_dimensions[5].height = 22
headers = ["#", "ITEM DESCRIPTION", "UOM", "QTY", "RATE (PKR) ✏", "AMOUNT (PKR)"]
for col_idx, h in enumerate(headers, 1):
    c = ws.cell(row=5, column=col_idx)
    c.value = h
    c.font = font(bold=True, size=11, color=WHITE)
    c.fill = fill(MED_BLUE)
    c.alignment = align("center")
    c.border = border()

# ══════════════════════════════════════════════════════════
# ROWS 6 onwards – Items
# ══════════════════════════════════════════════════════════
DATA_START = 6
for i, (name, uom, qty) in enumerate(items):
    row = DATA_START + i
    ws.row_dimensions[row].height = 18
    row_fill = fill(WHITE) if i % 2 == 0 else fill(GREY)

    # #
    c = ws.cell(row=row, column=1, value=i+1)
    c.font = font(size=10, color="999999")
    c.fill = row_fill; c.alignment = align("center"); c.border = border()

    # Item name
    c = ws.cell(row=row, column=2, value=name)
    c.font = font(size=11)
    c.fill = row_fill; c.alignment = align("left", wrap=True); c.border = border()

    # UOM
    c = ws.cell(row=row, column=3, value=uom)
    c.font = font(size=11, color="666666")
    c.fill = row_fill; c.alignment = align("center"); c.border = border()

    # QTY
    c = ws.cell(row=row, column=4, value=qty)
    c.font = font(bold=True, size=11)
    c.fill = row_fill; c.alignment = align("center"); c.border = border()
    c.number_format = '#,##0'

    # RATE – Kashif fills this
    c = ws.cell(row=row, column=5)
    c.font = font(bold=True, size=12, color="C0392B")
    c.fill = fill(ORANGE_FILL)
    c.alignment = align("right"); c.border = border()
    c.number_format = '#,##0'

    # AMOUNT = QTY * RATE
    rate_ref = f"E{row}"
    qty_ref  = f"D{row}"
    c = ws.cell(row=row, column=6)
    c.value = f"=IF({rate_ref}=\"\",\"\",{qty_ref}*{rate_ref})"
    c.font = font(bold=True, size=11, color=DARK_BLUE)
    c.fill = fill(LIGHT_BLUE)
    c.alignment = align("right"); c.border = border()
    c.number_format = '#,##0'

last_data_row = DATA_START + len(items) - 1

# ══════════════════════════════════════════════════════════
# TOTAL ROW
# ══════════════════════════════════════════════════════════
total_row = last_data_row + 1
ws.row_dimensions[total_row].height = 24
ws.merge_cells(f"A{total_row}:E{total_row}")

c = ws[f"A{total_row}"]
c.value = "TOTAL PURCHASED"
c.font = font(bold=True, size=13, color=WHITE)
c.fill = fill(DARK_BLUE)
c.alignment = align("right")
c.border = border()

c = ws[f"F{total_row}"]
c.value = f"=SUM(F{DATA_START}:F{last_data_row})"
c.font = font(bold=True, size=13, color=WHITE)
c.fill = fill(DARK_BLUE)
c.alignment = align("right")
c.border = border()
c.number_format = '#,##0'

# ══════════════════════════════════════════════════════════
# BALANCE ROW
# ══════════════════════════════════════════════════════════
bal_row = total_row + 1
ws.row_dimensions[bal_row].height = 24
ws.merge_cells(f"A{bal_row}:E{bal_row}")

c = ws[f"A{bal_row}"]
c.value = "BALANCE  (Advance − Total)"
c.font = font(bold=True, size=13, color=DARK_BLUE)
c.fill = fill(GREEN_FILL)
c.alignment = align("right")
c.border = border()

c = ws[f"F{bal_row}"]
c.value = f"=IF(F3=\"\",\"\",F3-F{total_row})"
c.font = font(bold=True, size=13, color=DARK_BLUE)
c.fill = fill(GREEN_FILL)
c.alignment = align("right")
c.border = border()
c.number_format = '#,##0'

# ══════════════════════════════════════════════════════════
# Instructions row
# ══════════════════════════════════════════════════════════
note_row = bal_row + 2
ws.merge_cells(f"A{note_row}:F{note_row}")
c = ws[f"A{note_row}"]
c.value = "📝  KASHIF: Sirf RATE (PKR) column fill karein — orange cells mein.  |  Hassan: Date, Customer aur Advance pehle fill karein."
c.font = Font(italic=True, size=10, color="555555", name="Calibri")
c.fill = fill("FFFDE7")
c.alignment = align("center")

# ══════════════════════════════════════════════════════════
# Freeze header rows
# ══════════════════════════════════════════════════════════
ws.freeze_panes = "A6"

# Print settings
ws.print_title_rows = "1:5"
ws.page_setup.orientation = "portrait"
ws.page_setup.fitToPage = True
ws.page_setup.fitToWidth = 1
ws.sheet_view.showGridLines = True

out = "/home/user/hassan/purchasing/Kashif_Purchasing_Sheet.xlsx"
wb.save(out)
print(f"Saved: {out}")
