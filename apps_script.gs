// Hassan Quotation Tracker - Auto Gmail Sync
// Har 30 minute mein automatically chalti hai

var SHEET_NAME = "Sheet1";

var SKIP_WORDS = ["instagram","facebook","unsubscribe","withholding","wht","purchase order","delivery challan"];
var QUERY_WORDS = ["quotation","quote","rfq","best rate","kindly send","pr#","pr-","requisition","request for quotation","request of quotation"];
var REMINDER_WORDS = ["reminder","follow up","follow-up","kindly revert"];

var COMPANIES = {
  "rajby.com.pk": "Rajby Industries",
  "hunarfoundation.org": "Hunar Foundation",
  "alkaram.com": "Al-Karam Textile"
};

function autoSync() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  // Setup header if empty
  if (ws.getLastRow() < 1) setupHeader(ws);

  var seen = getSeen();
  var threads = GmailApp.search("newer_than:2d", 0, 50);
  var added = 0, overdue = 0, sent = 0;

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    messages.forEach(function(msg) {
      var msgId = msg.getId();
      if (seen[msgId]) return;

      var sender  = msg.getFrom();
      var subject = msg.getSubject();
      var body    = msg.getPlainBody().substring(0, 300);
      var date    = msg.getDate();
      var isMe    = sender.indexOf("zidanecorporation@gmail.com") > -1 ||
                    sender.indexOf("zidane.finance@gmail.com") > -1;

      var text = (subject + " " + body).toLowerCase();

      // Skip irrelevant
      var skip = SKIP_WORDS.some(function(w){ return text.indexOf(w) > -1; });
      if (skip) { seen[msgId] = true; return; }

      var isQuery    = QUERY_WORDS.some(function(w){ return text.indexOf(w) > -1; });
      var isReminder = REMINDER_WORDS.some(function(w){ return text.indexOf(w) > -1; });

      if (!isQuery && !isReminder) { seen[msgId] = true; return; }

      var dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "dd-MMM-yyyy");
      var timeStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "hh:mm a");
      var company = getCompany(sender);
      var pr      = extractPR(subject);

      if (isMe) {
        // Hamne bheja — sent mark karo
        markSent(ws, pr, dateStr + " " + timeStr);
        sent++;
        seen[msgId] = true;
        return;
      }

      if (isReminder) {
        markOverdue(ws, pr, company);
        overdue++;
        seen[msgId] = true;
        return;
      }

      // New query — row add karo
      var sr   = ws.getLastRow();
      var item = body.replace(/Dear (Sir|Concern),?/gi,"").replace(/Disclaimer:.*/gi,"").trim().substring(0,120);
      ws.appendRow([sr, company, sender, pr, item, "—", "—", "", dateStr, timeStr, "Pending", "", "", 0]);
      colorRow(ws, ws.getLastRow(), "Pending");
      added++;
      seen[msgId] = true;
    });
  });

  refreshDays(ws);
  saveSeen(seen);

  Logger.log("Sync done | +" + added + " new | " + overdue + " overdue | " + sent + " sent");
}

function setupHeader(ws) {
  var headers = ["Sr#","Requester Name","Email ID","PR Number","Item Description","UOM","Qty","Rate (PKR)","Query Date","Query Time","Status","Quotation Sent Date","Remarks","Days Pending"];
  ws.appendRow(headers);
  var range = ws.getRange(1, 1, 1, headers.length);
  range.setBackground("#1F4E79");
  range.setFontColor("#FFFFFF");
  range.setFontWeight("bold");
  range.setHorizontalAlignment("center");
  ws.setFrozenRows(1);
}

function colorRow(ws, rowNum, status) {
  var range = ws.getRange(rowNum, 1, 1, 14);
  if (status === "OVERDUE") {
    range.setBackground("#FF4444"); range.setFontColor("#FFFFFF");
    ws.getRange(rowNum, 11).setBackground("#FF4444").setFontColor("#FFFFFF").setFontWeight("bold");
  } else if (status === "Sent") {
    range.setBackground("#E2F4D8"); range.setFontColor("#000000");
    ws.getRange(rowNum, 11).setBackground("#70AD47").setFontColor("#FFFFFF").setFontWeight("bold");
  } else {
    range.setBackground("#FFFDE7"); range.setFontColor("#000000");
    ws.getRange(rowNum, 11).setBackground("#FFD700").setFontColor("#000000").setFontWeight("bold");
  }
}

function markSent(ws, pr, sentTime) {
  var data = ws.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][10] === "Sent") continue;
    if (pr && data[i][3] && data[i][3].toString().indexOf(pr.replace(/PR[#\-\s]*/i,"").trim()) > -1) {
      ws.getRange(i+1, 11).setValue("Sent");
      ws.getRange(i+1, 12).setValue(sentTime);
      colorRow(ws, i+1, "Sent");
    }
  }
}

function markOverdue(ws, pr, company) {
  var data = ws.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][10] === "Sent") continue;
    var rowPR = data[i][3] ? data[i][3].toString() : "";
    var rowCo = data[i][1] ? data[i][1].toString() : "";
    if ((pr && rowPR.indexOf(pr.replace(/PR[#\-\s]*/i,"").trim()) > -1) || (company && rowCo === company)) {
      ws.getRange(i+1, 11).setValue("OVERDUE");
      colorRow(ws, i+1, "OVERDUE");
      var rem = data[i][12] ? data[i][12] + " | ⚠️ Reminder" : "⚠️ Reminder received";
      ws.getRange(i+1, 13).setValue(rem);
    }
  }
}

function refreshDays(ws) {
  var data = ws.getDataRange().getValues();
  var now = new Date();
  for (var i = 1; i < data.length; i++) {
    var status  = data[i][10];
    var dateStr = data[i][8];
    if ((status === "Pending" || status === "OVERDUE") && dateStr) {
      var qd   = new Date(dateStr);
      var days = Math.floor((now - qd) / (1000*60*60*24));
      ws.getRange(i+1, 14).setValue(days);
      if (days >= 2 && status === "Pending") {
        ws.getRange(i+1, 11).setValue("OVERDUE");
        colorRow(ws, i+1, "OVERDUE");
      }
    }
  }
}

function getCompany(email) {
  for (var domain in COMPANIES) {
    if (email.indexOf(domain) > -1) return COMPANIES[domain];
  }
  var match = email.match(/^(.+?)\s*</);
  return match ? match[1].trim() : email.split("@")[0];
}

function extractPR(subject) {
  var m = subject.match(/PR[#\-\s]*\w+/i);
  return m ? m[0].trim() : "—";
}

function getSeen() {
  var props = PropertiesService.getScriptProperties();
  var raw   = props.getProperty("seen_ids");
  return raw ? JSON.parse(raw) : {};
}

function saveSeen(seen) {
  // Keep max 500 to avoid size limit
  var keys = Object.keys(seen);
  if (keys.length > 500) {
    var trimmed = {};
    keys.slice(-500).forEach(function(k){ trimmed[k] = true; });
    seen = trimmed;
  }
  PropertiesService.getScriptProperties().setProperty("seen_ids", JSON.stringify(seen));
}

// Trigger setup — ek baar run karo
function setupTrigger() {
  // Purane triggers delete karo
  ScriptApp.getProjectTriggers().forEach(function(t){ ScriptApp.deleteTrigger(t); });
  // Har 30 minute mein
  ScriptApp.newTrigger("autoSync")
    .timeBased()
    .everyMinutes(30)
    .create();
  Logger.log("Trigger set! autoSync will run every 30 minutes.");
}
