from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

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

# ── Styles ─────────────────────────────────────────────────
DARK_BLUE  = "1A3A6B"
MED_BLUE   = "2E75B6"
LIGHT_BLUE = "D6E4F0"
YELLOW     = "FFF2CC"
ORANGE     = "FCE4D6"
GREEN      = "E2EFDA"
PURPLE     = "EAD1DC"
WHITE      = "FFFFFF"
GREY       = "F5F5F5"
RED_FONT   = "C0392B"
DARK_GREEN = "1E6B3A"

def S(style="thin", color="BBBBBB"):
    return Side(style=style, color=color)

def bdr():
    s = S()
    return Border(left=s, right=s, top=s, bottom=s)

def thick_bdr():
    t = S("medium", "888888")
    return Border(left=t, right=t, top=t, bottom=t)

def fill(c):
    return PatternFill("solid", fgColor=c)

def font(bold=False, sz=11, color="000000"):
    return Font(bold=bold, size=sz, color=color, name="Calibri")

def aln(h="center", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

# ── Column widths ───────────────────────────────────────────
cols = {"A":5, "B":40, "C":7, "D":7, "E":13, "F":14, "G":22, "H":10}
for col, w in cols.items():
    ws.column_dimensions[col].width = w

# ══════════════════════════════════════════════════════════
# ROW 1 – Title
# ══════════════════════════════════════════════════════════
ws.row_dimensions[1].height = 30
ws.merge_cells("A1:H1")
c = ws["A1"]
c.value = "ZIDANE CORPORATION  ·  PURCHASING SHEET"
c.font = Font(bold=True, size=14, color=WHITE, name="Calibri")
c.fill = fill(DARK_BLUE)
c.alignment = aln("center")

# ══════════════════════════════════════════════════════════
# ROWS 2-3 – Meta section (labels + inputs)
# ══════════════════════════════════════════════════════════
meta_labels = [
    ("B2", "DATE"),
    ("C2", ""),
    ("D2", "CUSTOMER / ORDER"),
    ("E2", ""),
    ("F2", "ADVANCE GIVEN (PKR)"),
    ("G2", "PAID FROM (ACCOUNT)"),
    ("H2", ""),
]
for cell, lbl in meta_labels:
    c = ws[cell]
    c.value = lbl
    c.font = font(bold=True, sz=9, color="444444")
    c.fill = fill(LIGHT_BLUE)
    c.alignment = aln("left")
ws.row_dimensions[2].height = 16

ws.row_dimensions[3].height = 22
ws.merge_cells("B3:C3")
ws.merge_cells("D3:E3")
ws.merge_cells("G3:H3")

for cell, num_fmt in [("B3", "DD-MMM-YYYY"), ("D3", "@"), ("F3", "#,##0"), ("G3", "@")]:
    c = ws[cell]
    c.number_format = num_fmt
    c.font = font(bold=True, sz=12, color=DARK_BLUE)
    c.fill = fill(YELLOW)
    c.alignment = aln("left" if cell in ("D3","G3") else "center")
    c.border = bdr()

# Dropdown for "Paid From"
dv_account = DataValidation(
    type="list",
    formula1='"Petty Cash,NEW CASH APRIL ONWARD,HBL,Habib Metro Bank,Faysal Bank"',
    allow_blank=True, showDropDown=False
)
ws.add_data_validation(dv_account)
dv_account.add("G3")

# ══════════════════════════════════════════════════════════
# ROW 4 – spacer
# ══════════════════════════════════════════════════════════
ws.row_dimensions[4].height = 5

# ══════════════════════════════════════════════════════════
# ROW 5 – Table headers
# ══════════════════════════════════════════════════════════
ws.row_dimensions[5].height = 22
headers = [
    ("A5", "#"),
    ("B5", "ITEM DESCRIPTION"),
    ("C5", "UOM"),
    ("D5", "QTY"),
    ("E5", "RATE (PKR) ✏"),
    ("F5", "AMOUNT (PKR)"),
    ("G5", "VENDOR / SUPPLIER"),
    ("H5", "CASH / CREDIT"),
]
for cell, h in headers:
    c = ws[cell]
    c.value = h
    c.font = font(bold=True, sz=11, color=WHITE)
    c.fill = fill(MED_BLUE)
    c.alignment = aln("center")
    c.border = bdr()

# ══════════════════════════════════════════════════════════
# Data rows
# ══════════════════════════════════════════════════════════
DATA_START = 6

# Dropdowns for vendor and cash/credit
dv_type = DataValidation(
    type="list", formula1='"Cash,Credit"',
    allow_blank=True, showDropDown=False
)
ws.add_data_validation(dv_type)

for i, (name, uom, qty) in enumerate(items):
    row = DATA_START + i
    ws.row_dimensions[row].height = 18
    rf = fill(WHITE) if i % 2 == 0 else fill(GREY)

    # # serial
    c = ws.cell(row=row, column=1, value=i+1)
    c.font = font(sz=10, color="999999"); c.fill = rf
    c.alignment = aln("center"); c.border = bdr()

    # Item name
    c = ws.cell(row=row, column=2, value=name)
    c.font = font(sz=11); c.fill = rf
    c.alignment = aln("left", wrap=True); c.border = bdr()

    # UOM
    c = ws.cell(row=row, column=3, value=uom)
    c.font = font(sz=11, color="555555"); c.fill = rf
    c.alignment = aln("center"); c.border = bdr()

    # QTY
    c = ws.cell(row=row, column=4, value=qty)
    c.font = font(bold=True, sz=11); c.fill = rf
    c.alignment = aln("center"); c.border = bdr()
    c.number_format = "#,##0"

    # RATE – Kashif fills
    c = ws.cell(row=row, column=5)
    c.font = font(bold=True, sz=12, color=RED_FONT)
    c.fill = fill(ORANGE); c.alignment = aln("right"); c.border = bdr()
    c.number_format = "#,##0"

    # AMOUNT
    c = ws.cell(row=row, column=6)
    c.value = f"=IF(E{row}=\"\",\"\",D{row}*E{row})"
    c.font = font(bold=True, sz=11, color=DARK_BLUE)
    c.fill = fill(LIGHT_BLUE); c.alignment = aln("right"); c.border = bdr()
    c.number_format = "#,##0"

    # VENDOR
    c = ws.cell(row=row, column=7)
    c.font = font(sz=11, color="333333"); c.fill = fill(PURPLE if i%2==0 else "F5E6EE")
    c.alignment = aln("left"); c.border = bdr()

    # CASH / CREDIT
    c = ws.cell(row=row, column=8)
    c.value = "Cash"
    c.font = font(bold=True, sz=11, color=DARK_GREEN)
    c.fill = fill(GREEN); c.alignment = aln("center"); c.border = bdr()
    dv_type.add(f"H{row}")

last_row = DATA_START + len(items) - 1

# ══════════════════════════════════════════════════════════
# SUMMARY SECTION
# ══════════════════════════════════════════════════════════
sum_row = last_row + 2
ws.row_dimensions[sum_row - 1].height = 6  # spacer

# Total row
ws.row_dimensions[sum_row].height = 24
ws.merge_cells(f"A{sum_row}:E{sum_row}")
c = ws[f"A{sum_row}"]
c.value = "TOTAL PURCHASED (ALL ITEMS)"
c.font = font(bold=True, sz=13, color=WHITE)
c.fill = fill(DARK_BLUE); c.alignment = aln("right"); c.border = bdr()

c = ws[f"F{sum_row}"]
c.value = f"=SUM(F{DATA_START}:F{last_row})"
c.font = font(bold=True, sz=13, color=WHITE)
c.fill = fill(DARK_BLUE); c.alignment = aln("right"); c.border = bdr()
c.number_format = "#,##0"

# Cash total
cash_row = sum_row + 1
ws.row_dimensions[cash_row].height = 20
ws.merge_cells(f"A{cash_row}:E{cash_row}")
c = ws[f"A{cash_row}"]
c.value = "  → Cash Purchases Total"
c.font = font(sz=11, color=DARK_GREEN); c.fill = fill(GREEN); c.alignment = aln("right"); c.border = bdr()
c = ws[f"F{cash_row}"]
c.value = f'=SUMIF(H{DATA_START}:H{last_row},"Cash",F{DATA_START}:F{last_row})'
c.font = font(bold=True, sz=11, color=DARK_GREEN)
c.fill = fill(GREEN); c.alignment = aln("right"); c.border = bdr()
c.number_format = "#,##0"

# Credit total
cred_row = sum_row + 2
ws.row_dimensions[cred_row].height = 20
ws.merge_cells(f"A{cred_row}:E{cred_row}")
c = ws[f"A{cred_row}"]
c.value = "  → Credit Purchases Total"
c.font = font(sz=11, color="8B0000"); c.fill = fill("FDEDEC"); c.alignment = aln("right"); c.border = bdr()
c = ws[f"F{cred_row}"]
c.value = f'=SUMIF(H{DATA_START}:H{last_row},"Credit",F{DATA_START}:F{last_row})'
c.font = font(bold=True, sz=11, color="8B0000")
c.fill = fill("FDEDEC"); c.alignment = aln("right"); c.border = bdr()
c.number_format = "#,##0"

# Balance
bal_row = sum_row + 3
ws.row_dimensions[bal_row].height = 22
ws.merge_cells(f"A{bal_row}:E{bal_row}")
c = ws[f"A{bal_row}"]
c.value = "BALANCE  (Advance − Total)"
c.font = font(bold=True, sz=12, color=DARK_BLUE); c.fill = fill(YELLOW); c.alignment = aln("right"); c.border = bdr()
c = ws[f"F{bal_row}"]
c.value = f"=IF(F3=\"\",\"\",F3-F{sum_row})"
c.font = font(bold=True, sz=12, color=DARK_BLUE)
c.fill = fill(YELLOW); c.alignment = aln("right"); c.border = bdr()
c.number_format = "#,##0"

# ── Zoho Entries Summary box ────────────────────────────
box_row = bal_row + 2
ws.row_dimensions[box_row].height = 18
ws.merge_cells(f"A{box_row}:H{box_row}")
c = ws[f"A{box_row}"]
c.value = "ZOHO ENTRIES THAT WILL BE CREATED AUTOMATICALLY"
c.font = font(bold=True, sz=11, color=WHITE)
c.fill = fill("7B3F00"); c.alignment = aln("center")

entries = [
    ("1", "Expense Entry", "Advance paid to Kashif", "Paid From account → Kashif Advance", "F3"),
    ("2", "Vendor Bills (Cash)", "One bill per vendor for cash items", "COGS Dr / Vendor Cr (adjust vs advance)", f"F{cash_row}"),
    ("3", "Vendor Bills (Credit)", "One bill per credit vendor", "COGS Dr / Accounts Payable Cr", f"F{cred_row}"),
    ("4", "Customer Invoice", "Sales invoice for customer", "Customer Receivable Dr / Sales Cr", f"F{sum_row}"),
]

for j, (num, etype, desc, account, ref) in enumerate(entries):
    r = box_row + 1 + j
    ws.row_dimensions[r].height = 18
    rf2 = fill("FFF8F0") if j % 2 == 0 else fill("FEF0E0")
    for col, val, alignment in [
        (1, num, "center"),
        (2, etype, "left"),
        (3, desc, "left"),
        (4, account, "left"),
    ]:
        c = ws.cell(row=r, column=col if col < 4 else col + 3)
        pass

    ws.merge_cells(f"A{r}:A{r}")
    ws.merge_cells(f"B{r}:C{r}")
    ws.merge_cells(f"D{r}:F{r}")
    ws.merge_cells(f"G{r}:H{r}")

    ws[f"A{r}"].value = num
    ws[f"A{r}"].font = font(bold=True, sz=11, color=WHITE)
    ws[f"A{r}"].fill = fill("7B3F00"); ws[f"A{r}"].alignment = aln("center"); ws[f"A{r}"].border = bdr()

    ws[f"B{r}"].value = etype
    ws[f"B{r}"].font = font(bold=True, sz=11); ws[f"B{r}"].fill = rf2
    ws[f"B{r}"].alignment = aln("left"); ws[f"B{r}"].border = bdr()

    ws[f"D{r}"].value = desc
    ws[f"D{r}"].font = font(sz=10, color="333333"); ws[f"D{r}"].fill = rf2
    ws[f"D{r}"].alignment = aln("left"); ws[f"D{r}"].border = bdr()

    ws[f"G{r}"].value = account
    ws[f"G{r}"].font = font(sz=10, color="555555"); ws[f"G{r}"].fill = rf2
    ws[f"G{r}"].alignment = aln("left"); ws[f"G{r}"].border = bdr()

# ── Freeze & print ──────────────────────────────────────
ws.freeze_panes = "A6"
ws.print_title_rows = "1:5"
ws.page_setup.orientation = "portrait"
ws.page_setup.fitToPage = True
ws.page_setup.fitToWidth = 1

out = "/home/user/hassan/purchasing/Kashif_Purchasing_Sheet.xlsx"
wb.save(out)
print(f"Done: {out}")
