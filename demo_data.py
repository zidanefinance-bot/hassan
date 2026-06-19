"""Demo script - sample data add karta hai"""
from quotation_tracker import add_query, mark_quotation_sent, refresh_reminders, show_summary
from datetime import datetime, timedelta
import openpyxl
from openpyxl.styles import PatternFill
import os

# Demo: Rajby se pehli query
print("=== DEMO: Sample Queries Add Kar Rahe Hain ===\n")

row1 = add_query(
    requester_name="Rajby Industries",
    email_id="procurement@rajby.com",
    pr_number="PR-2026-001",
    item_desc="Industrial Safety Gloves - Heavy Duty",
    uom="Pairs",
    qty="500",
    rate="",
    remarks="Urgent requirement"
)

# Demo: Rajby se 3 baje dobara query (same day)
row2 = add_query(
    requester_name="Rajby Industries",
    email_id="procurement@rajby.com",
    pr_number="PR-2026-001",
    item_desc="Safety Helmets - Yellow",
    uom="Nos",
    qty="200",
    rate="",
    remarks="Added to same PR - follow up call"
)

# Demo: Hunar Foundation se query
row3 = add_query(
    requester_name="Hunar Foundation",
    email_id="admin@hunarfoundation.org",
    pr_number="PR-HF-045",
    item_desc="A4 Paper Ream 80 GSM",
    uom="Reams",
    qty="100",
    rate="850",
    remarks="Monthly stationery requirement"
)

# Demo: Quotation already sent wali entry
row4 = add_query(
    requester_name="ABC Textiles",
    email_id="purchase@abctextiles.com",
    pr_number="PR-ABC-022",
    item_desc="Industrial Lubricant Oil",
    uom="Litres",
    qty="50",
    rate="1200",
    remarks=""
)

# Mark one as sent
mark_quotation_sent(row4 + 1, "Quotation sent via email - awaiting PO")  # +1 for header

# Manually backdate one entry to simulate overdue (3 days ago)
EXCEL_FILE = "Quotation_Tracker.xlsx"
wb = openpyxl.load_workbook(EXCEL_FILE)
ws = wb.active
# Row 2 = first entry, make it look 4 days old
ws.cell(row=2, column=9, value=(datetime.now() - timedelta(days=4)).strftime("%d-%b-%Y"))
wb.save(EXCEL_FILE)
print("\n(Demo: Rajby ki pehli query 4 din purani set ki - overdue test ke liye)")

print("\n=== Reminders Refresh ===")
refresh_reminders()

print("\n=== Final Summary ===")
show_summary()

print(f"\n✅ Excel file ready: {os.path.abspath(EXCEL_FILE)}")
