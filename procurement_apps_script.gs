// ═══════════════════════════════════════════════════════
//  ZIDANE PROCUREMENT TRACKER — Apps Script
//  Paste this in: Extensions → Apps Script → Save → Run setupTrigger once
// ═══════════════════════════════════════════════════════

const ACTIVE_SHEET  = "Active Orders";
const DELIV_SHEET   = "Delivered";
const STATUS_COL    = 12;   // Column L  (1-indexed)
const DELIV_DATE_COL = 13;  // Column M
const INVOICE_COL   = 14;  // Column N

const PENDING_COLOR = "#FFF2CC";   // light yellow
const DELIV_COLOR   = "#D4EDDA";  // light green
const HDR_COLOR     = "#1F4E79";

// ── Run this ONCE to set up the onEdit trigger ──
function setupTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Remove old triggers first
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "onStatusChange") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("onStatusChange")
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  SpreadsheetApp.getUi().alert("✅ Trigger set up! Status changes will now auto-move rows.");
}

// ── Fires on every edit ──
function onStatusChange(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== ACTIVE_SHEET) return;

  const range = e.range;
  if (range.getColumn() !== STATUS_COL) return;
  if (range.getValue() !== "Delivered") return;

  const row = range.getRow();
  if (row === 1) return; // header

  moveToDelivered(sheet, row);
}

function moveToDelivered(activeSheet, row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const delivSheet = ss.getSheetByName(DELIV_SHEET);

  const rowData = activeSheet.getRange(row, 1, 1, 14).getValues()[0];

  // Set delivered date
  rowData[DELIV_DATE_COL - 1] = Utilities.formatDate(
    new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy"
  );

  // Append to Delivered sheet
  delivSheet.appendRow(rowData);

  // Format the new row in Delivered sheet green
  const newRow = delivSheet.getLastRow();
  delivSheet.getRange(newRow, 1, 1, 14)
    .setBackground(DELIV_COLOR)
    .setFontSize(9)
    .setVerticalAlignment("middle");

  // Delete from Active Orders
  activeSheet.deleteRow(row);

  // Re-number Sr# in Active Orders
  renumberSr(activeSheet);

  // Toast notification
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `✅ Moved to Delivered sheet`, "Row Delivered", 4
  );
}

// Re-number Sr# column after a row is removed
function renumberSr(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  for (let r = 2; r <= lastRow; r++) {
    sheet.getRange(r, 1).setValue(r - 1);
  }
}

// ═══════════════════════════════════════════════════════
//  MENU: Add a custom menu to the sheet
// ═══════════════════════════════════════════════════════
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚚 Procurement")
    .addItem("Mark Selected as Delivered", "markSelectedDelivered")
    .addSeparator()
    .addItem("Show Pending Summary", "showPendingSummary")
    .addItem("Setup Trigger (run once)", "setupTrigger")
    .addToUi();
}

// Mark selected rows as Delivered via menu (easier than typing)
function markSelectedDelivered() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  if (sheet.getName() !== ACTIVE_SHEET) {
    SpreadsheetApp.getUi().alert("Please select rows in the Active Orders sheet.");
    return;
  }

  const selected = sheet.getActiveRange();
  const startRow = selected.getRow();
  const numRows  = selected.getNumRows();

  if (startRow === 1) {
    SpreadsheetApp.getUi().alert("Please select data rows, not the header.");
    return;
  }

  // Process from bottom up so row deletion doesn't shift indices
  for (let r = startRow + numRows - 1; r >= startRow; r--) {
    sheet.getRange(r, STATUS_COL).setValue("Delivered");
    moveToDelivered(sheet, r);
  }
}

// Show a quick summary of pending items grouped by PO
function showPendingSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ACTIVE_SHEET);
  const data = sheet.getDataRange().getValues();

  const summary = {};
  for (let i = 1; i < data.length; i++) {
    const po    = data[i][1];
    const unit  = data[i][2];
    const total = data[i][9];
    if (!summary[po]) summary[po] = { unit, total: 0, count: 0 };
    summary[po].total += total;
    summary[po].count++;
  }

  let msg = "📋 PENDING ORDERS SUMMARY\n\n";
  let grand = 0;
  for (const [po, info] of Object.entries(summary)) {
    msg += `PO# ${po} (${info.unit})\n  ${info.count} items — PKR ${info.total.toLocaleString()}\n\n`;
    grand += info.total;
  }
  msg += `─────────────────────\nGRAND TOTAL: PKR ${grand.toLocaleString()}`;
  SpreadsheetApp.getUi().alert(msg);
}
