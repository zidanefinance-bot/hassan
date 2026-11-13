// Bank loans we took: the schedule of monthly installments (each split into principal and interest, worked out
// the way Pakistani banks do it: interest = balance × rate × days ÷ 365, a fixed installment, the last one
// clears what is left), reminders before each due date, and "Paid" in one click, which posts the entry:
//   Dr Loan (principal) + Dr Interest on loans (interest) → Cr Bank (installment).
// Taking the loan posts Dr Bank (money received) + Dr Bank charges (any fee kept by the bank) → Cr Loan.
// The bank's own figures can be pasted in, so the schedule matches its print to the paisa.
import { httpError, log, round2, today } from "./books.js";
import { tx } from "./db.js";
import { notify, usersWith } from "./collab.js";
import { expenseAccountFor, nextCode, saveJournal } from "./ledger.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY, number TEXT NOT NULL UNIQUE, lender TEXT NOT NULL, reference TEXT, title TEXT,
  principal REAL NOT NULL CHECK (principal > 0), rate REAL NOT NULL DEFAULT 0, start_date TEXT NOT NULL,
  installment REAL NOT NULL DEFAULT 0, months INTEGER NOT NULL, first_due TEXT NOT NULL,
  bank_account_id INTEGER REFERENCES accounts(id), loan_account_id INTEGER NOT NULL REFERENCES accounts(id),
  interest_account_id INTEGER NOT NULL REFERENCES accounts(id), received REAL, disburse_journal_id INTEGER REFERENCES journal_entries(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')), notes TEXT,
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS loan_installments (
  id INTEGER PRIMARY KEY, loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE, seq INTEGER NOT NULL,
  due_date TEXT NOT NULL, interest REAL NOT NULL DEFAULT 0, principal REAL NOT NULL DEFAULT 0,
  paid_on TEXT, paid_interest REAL, paid_principal REAL, account_id INTEGER REFERENCES accounts(id),
  journal_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL, last_reminded TEXT
);
CREATE INDEX IF NOT EXISTS idx_loan_inst ON loan_installments(loan_id, seq);
CREATE INDEX IF NOT EXISTS idx_loan_due ON loan_installments(paid_on, due_date);`;

export const setupLoans = (db) => db.exec(SCHEMA);

const DAY = 864e5;
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const karachiToday = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
const addMonths = (d, n) => {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(day, last))).toISOString().slice(0, 10);
};

// The bank's way: interest on the balance for the actual days (÷ 365), a fixed installment, the last one clears
// the rest (and its interest counts the maturity day too, as banks print it).
export function buildSchedule({ principal, rate, start_date, installment, months, first_due }) {
  const P = round2(Number(principal) || 0), r = (Number(rate) || 0) / 100, n = Math.round(Number(months) || 0);
  if (!(P > 0)) throw httpError(400, "Loan amount must be more than zero");
  if (!(n > 0 && n <= 600)) throw httpError(400, "Number of installments is required");
  if (!isDate(start_date) || !isDate(first_due)) throw httpError(400, "Start date and first installment date are required");
  if (first_due < start_date) throw httpError(400, "The first installment can't be before the loan starts");
  let inst = round2(Number(installment) || 0);
  if (!(inst > 0)) { // no installment given: the usual monthly installment for this rate
    const i = r / 12;
    inst = round2(i ? (P * i) / (1 - (1 + i) ** -n) : P / n);
  }
  const rows = [];
  let bal = P, from = start_date;
  for (let k = 0; k < n; k++) {
    const due = addMonths(first_due, k), last = k === n - 1;
    const interest = round2(bal * r * (days(from, due) + (last ? 1 : 0)) / 365);
    const principalPart = last ? bal : round2(Math.min(bal, Math.max(0, inst - interest)));
    rows.push({ seq: k + 1, due_date: due, interest, principal: principalPart });
    bal = round2(bal - principalPart);
    from = due;
  }
  return { installment: inst, rows };
}

// The bank's printed schedule, pasted as text: one line per installment, "01NOV2026 4,821,974.92 2,609.59 178,025.08"
// (date, balance after, interest, principal), or in date / interest / principal order. Other lines are skipped.
const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
export function parseSchedule(text, principal) {
  const rows = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/[O](?=\d)/g, "0");
    const m = /(\d{1,2})[\s\-\/]?([A-Za-z]{3})[\s\-\/]?(\d{4})|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/.exec(line);
    if (!m) continue;
    let date;
    if (m[1]) { const mo = MON[m[2].toUpperCase()]; if (!mo) continue; date = `${m[3]}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
    else if (m[4]) date = `${m[4]}-${m[5]}-${m[6]}`;
    else date = `${m[9]}-${m[8].padStart(2, "0")}-${m[7].padStart(2, "0")}`;
    const rest = line.slice(m.index + m[0].length);
    if (/[A-Za-z]{2,}/.test(rest)) continue; // "Loan start Amount : 5,000,000 Rate : 19.05" and other heading lines
    const nums = (line.slice(m.index + m[0].length).match(/-?\d[\d,]*(?:\.\d+)?/g) || []).map((x) => Number(x.replace(/,/g, ""))).filter((x) => Number.isFinite(x));
    if (nums.length < 2) continue;
    // 3+ numbers: balance after, interest, principal (the bank print); 2: interest, principal
    const [interest, princ] = nums.length >= 3 ? [nums[nums.length - 2], nums[nums.length - 1]] : nums;
    rows.push({ due_date: date, interest: round2(interest), principal: round2(princ) });
  }
  rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
  rows.forEach((r, i) => (r.seq = i + 1));
  if (!rows.length) throw httpError(400, "No installment lines found. Each line needs a date, the interest and the principal.");
  const sum = round2(rows.reduce((s, r) => s + r.principal, 0));
  if (principal && Math.abs(sum - principal) > 1) throw httpError(400, `The principal on the pasted lines adds up to ${sum.toLocaleString("en-PK")}, not the loan amount ${Number(principal).toLocaleString("en-PK")}. Check the lines.`);
  return rows;
}

function nextLoanNumber(db) {
  let n = (db.prepare("SELECT COUNT(*) AS c FROM loans").get().c || 0) + 1;
  while (db.prepare("SELECT 1 FROM loans WHERE number = ?").get(`LN-${String(n).padStart(3, "0")}`)) n++;
  return `LN-${String(n).padStart(3, "0")}`;
}

const interestAccount = (db) => db.prepare("SELECT id FROM accounts WHERE system_key = 'loan_interest'").get()?.id
  ?? Number(db.prepare("INSERT INTO accounts (code, name, type, kind, system_key) VALUES (?, 'Interest on loans (finance cost)', 'expense', 'other', 'loan_interest')").run(nextCode(db, "expense")).lastInsertRowid);

function clean(db, input) {
  const lender = String(input.lender || "").trim();
  if (!lender) throw httpError(400, "Which bank / lender?");
  const principal = round2(Number(input.principal) || 0);
  if (!(principal > 0)) throw httpError(400, "Loan amount must be more than zero");
  const rate = Number(input.rate) || 0;
  if (rate < 0 || rate > 100) throw httpError(400, "Interest rate is a yearly % (e.g. 19.05)");
  const months = Math.round(Number(input.months) || 0);
  const first_due = input.first_due || (isDate(input.start_date) ? addMonths(input.start_date.slice(0, 8) + "01", 1) : "");
  const sched = input.schedule_text && String(input.schedule_text).trim()
    ? { installment: round2(Number(input.installment) || 0), rows: parseSchedule(input.schedule_text, principal) }
    : buildSchedule({ principal, rate, start_date: input.start_date, installment: input.installment, months, first_due });
  if (!isDate(input.start_date)) throw httpError(400, "When was the loan given (start date)?");
  return { lender, principal, rate, months: sched.rows.length, first_due: sched.rows[0].due_date, installment: sched.installment || round2(sched.rows[0].interest + sched.rows[0].principal),
    rows: sched.rows, start_date: input.start_date, reference: String(input.reference || "").trim() || null, title: String(input.title || "").trim() || null, notes: String(input.notes || "").trim() || null };
}

export const previewLoan = (db, input) => { const x = clean(db, input); return { installment: x.installment, rows: x.rows, total_interest: round2(x.rows.reduce((s, r) => s + r.interest, 0)) }; };

// Take a loan: its own liability account, the schedule, and (if the money came in) the entry for it
export function createLoan(db, userId, input) {
  const x = clean(db, input);
  const bankId = input.bank_account_id ? Number(input.bank_account_id) : null;
  if (bankId && !db.prepare("SELECT 1 FROM accounts WHERE id = ? AND kind IN ('bank','cash','wallet')").get(bankId)) throw httpError(400, "Pick the bank account the loan money came into");
  const record = input.record_receipt !== false && input.record_receipt !== "false";
  if (record && !bankId) throw httpError(400, "Pick the bank account the loan money came into (or untick 'record the money received')");
  const received = input.received === "" || input.received == null ? x.principal : round2(Number(input.received) || 0);
  if (record && (received <= 0 || received > x.principal)) throw httpError(400, "Money received must be more than zero and not more than the loan");
  return tx(db, () => {
    const number = nextLoanNumber(db);
    let loanAcc = input.loan_account_id ? Number(input.loan_account_id) : null;
    if (loanAcc && !db.prepare("SELECT 1 FROM accounts WHERE id = ? AND type = 'liability'").get(loanAcc)) throw httpError(400, "The loan account must be a liability account");
    if (!loanAcc) {
      const name = `Loan – ${x.lender}${x.reference ? ` (${x.reference})` : ` ${number}`}`;
      loanAcc = Number(db.prepare("INSERT INTO accounts (code, name, type, kind, notes) VALUES (?, ?, 'liability', 'other', ?)").run(nextCode(db, "liability"), name, `${number}${x.title ? ` · ${x.title}` : ""}`).lastInsertRowid);
    }
    const intAcc = interestAccount(db);
    let journalId = null;
    if (record) {
      const fee = round2(x.principal - received);
      journalId = saveJournal(db, userId, { date: x.start_date, memo: `${number} loan received · ${x.lender}${x.reference ? ` ${x.reference}` : ""}`, lines: [
        { account_id: bankId, debit: received }, ...(fee > 0 ? [{ account_id: expenseAccountFor(db, "Bank charges"), debit: fee, memo: "Kept by the bank (processing fee / charges)" }] : []),
        { account_id: loanAcc, credit: x.principal }] });
    }
    const id = Number(db.prepare(`INSERT INTO loans (number, lender, reference, title, principal, rate, start_date, installment, months, first_due, bank_account_id, loan_account_id, interest_account_id, received, disburse_journal_id, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(number, x.lender, x.reference, x.title, x.principal, x.rate, x.start_date, x.installment, x.months, x.first_due,
      bankId, loanAcc, intAcc, record ? received : null, journalId, x.notes, userId ?? null).lastInsertRowid);
    const ins = db.prepare("INSERT INTO loan_installments (loan_id, seq, due_date, interest, principal) VALUES (?, ?, ?, ?, ?)");
    for (const r of x.rows) ins.run(id, r.seq, r.due_date, r.interest, r.principal);
    log(db, userId, "took loan", "loan", id, `${number} · ${x.lender} · Rs ${x.principal} · ${x.months} installments`);
    return id;
  });
}

export function updateLoan(db, userId, id, input) {
  const l = db.prepare("SELECT * FROM loans WHERE id = ?").get(id);
  if (!l) throw httpError(404, "Loan not found");
  const lender = String(input.lender ?? l.lender).trim() || l.lender;
  db.prepare("UPDATE loans SET lender = ?, reference = ?, title = ?, notes = ?, bank_account_id = ? WHERE id = ?")
    .run(lender, String(input.reference ?? l.reference ?? "").trim() || null, String(input.title ?? l.title ?? "").trim() || null, String(input.notes ?? l.notes ?? "").trim() || null,
      input.bank_account_id ? Number(input.bank_account_id) : l.bank_account_id, id);
  log(db, userId, "changed loan", "loan", id, l.number);
}

// correct one unpaid installment to the bank's figures
export function updateInstallment(db, userId, loanId, instId, input) {
  const i = db.prepare("SELECT * FROM loan_installments WHERE id = ? AND loan_id = ?").get(instId, loanId);
  if (!i) throw httpError(404, "Installment not found");
  if (i.paid_on) throw httpError(400, "This installment is already paid. Undo the payment first.");
  const due = input.due_date ?? i.due_date;
  if (!isDate(due)) throw httpError(400, "Due date is required");
  const interest = round2(Number(input.interest ?? i.interest)), principal = round2(Number(input.principal ?? i.principal));
  if (interest < 0 || principal < 0) throw httpError(400, "Amounts can't be negative");
  db.prepare("UPDATE loan_installments SET due_date = ?, interest = ?, principal = ?, last_reminded = CASE WHEN due_date = ? THEN last_reminded END WHERE id = ?").run(due, interest, principal, due, instId);
  log(db, userId, "changed loan installment", "loan", loanId, `#${i.seq} · ${due} · interest ${interest} · principal ${principal}`);
}

const urgency = (due, on = karachiToday()) => {
  const left = days(on, due);
  return { days_left: left, urgency: left < 0 ? "overdue" : left <= 3 ? "soon" : left <= 7 ? "week" : "later" };
};

function summary(db, l) {
  const inst = db.prepare("SELECT * FROM loan_installments WHERE loan_id = ? ORDER BY seq").all(l.id);
  const paid = inst.filter((i) => i.paid_on);
  const next = inst.find((i) => !i.paid_on) || null;
  const paidPrincipal = round2(paid.reduce((s, i) => s + i.paid_principal, 0));
  const ledger = db.prepare(`SELECT COALESCE(SUM(credit - debit), 0) AS v FROM journal_lines WHERE account_id = ?`).get(l.loan_account_id).v
    + (db.prepare("SELECT opening_balance FROM accounts WHERE id = ?").get(l.loan_account_id)?.opening_balance || 0);
  return {
    ...l, outstanding: round2(l.principal - paidPrincipal), paid_count: paid.length, left_count: inst.length - paid.length,
    interest_paid: round2(paid.reduce((s, i) => s + i.paid_interest, 0)), interest_left: round2(inst.filter((i) => !i.paid_on).reduce((s, i) => s + i.interest, 0)),
    total_interest: round2(inst.reduce((s, i) => s + (i.paid_on ? i.paid_interest : i.interest), 0)),
    ledger_balance: round2(ledger),
    next: next && { ...next, amount: round2(next.interest + next.principal), ...urgency(next.due_date) },
  };
}

const SELECT = "SELECT l.*, a.name AS bank_account_name, la.name AS loan_account_name, la.code AS loan_account_code FROM loans l LEFT JOIN accounts a ON a.id = l.bank_account_id JOIN accounts la ON la.id = l.loan_account_id";
export const listLoans = (db, { status = "" } = {}) =>
  db.prepare(`${SELECT} ${status ? "WHERE l.status = ?" : ""} ORDER BY l.status = 'active' DESC, l.start_date DESC`).all(...(status ? [status] : [])).map((l) => summary(db, l));

export function getLoan(db, id) {
  const l = db.prepare(`${SELECT} WHERE l.id = ?`).get(id);
  if (!l) throw httpError(404, "Loan not found");
  let bal = l.principal;
  const rows = db.prepare("SELECT i.*, j.number AS journal_number, a.name AS account_name FROM loan_installments i LEFT JOIN journal_entries j ON j.id = i.journal_id LEFT JOIN accounts a ON a.id = i.account_id WHERE i.loan_id = ? ORDER BY i.seq").all(id)
    .map((i) => {
      const p = i.paid_on ? i.paid_principal : i.principal, int = i.paid_on ? i.paid_interest : i.interest;
      bal = round2(bal - p);
      return { ...i, amount: round2(p + int), balance_after: bal, ...(i.paid_on ? {} : urgency(i.due_date)) };
    });
  const j = l.disburse_journal_id ? db.prepare("SELECT number FROM journal_entries WHERE id = ?").get(l.disburse_journal_id) : null;
  return { ...summary(db, l), disburse_journal_number: j?.number || null, installments: rows };
}

// Paid: Dr Loan (principal) + Dr Interest → Cr Bank. Installments are paid in order.
export function payInstallment(db, userId, loanId, instId, input = {}) {
  const l = db.prepare("SELECT * FROM loans WHERE id = ?").get(loanId);
  if (!l) throw httpError(404, "Loan not found");
  const i = db.prepare("SELECT * FROM loan_installments WHERE id = ? AND loan_id = ?").get(instId, loanId);
  if (!i) throw httpError(404, "Installment not found");
  if (i.paid_on) throw httpError(400, "This installment is already paid");
  const earlier = db.prepare("SELECT seq, due_date FROM loan_installments WHERE loan_id = ? AND seq < ? AND paid_on IS NULL ORDER BY seq LIMIT 1").get(loanId, i.seq);
  if (earlier) throw httpError(400, `Installment #${earlier.seq} (due ${earlier.due_date}) isn't paid yet. Pay them in order.`);
  const accountId = Number(input.account_id || l.bank_account_id) || null;
  if (!accountId || !db.prepare("SELECT 1 FROM accounts WHERE id = ? AND kind IN ('bank','cash','wallet')").get(accountId)) throw httpError(400, "Pick the bank account the installment was paid from");
  const interest = round2(input.interest == null || input.interest === "" ? i.interest : Number(input.interest));
  const principal = round2(input.principal == null || input.principal === "" ? i.principal : Number(input.principal));
  if (!(interest >= 0 && principal >= 0) || interest + principal <= 0) throw httpError(400, "Enter the interest and principal the bank took");
  const date = isDate(input.date) ? input.date : i.due_date;
  const n = db.prepare("SELECT COUNT(*) AS c FROM loan_installments WHERE loan_id = ?").get(loanId).c;
  return tx(db, () => {
    const journalId = saveJournal(db, userId, { date, memo: `${l.number} installment ${i.seq}/${n} · ${l.lender}${l.reference ? ` ${l.reference}` : ""}`, lines: [
      ...(principal > 0 ? [{ account_id: l.loan_account_id, debit: principal, memo: "Principal" }] : []),
      ...(interest > 0 ? [{ account_id: l.interest_account_id, debit: interest, memo: "Interest" }] : []),
      { account_id: accountId, credit: round2(principal + interest) }] });
    db.prepare("UPDATE loan_installments SET paid_on = ?, paid_interest = ?, paid_principal = ?, account_id = ?, journal_id = ? WHERE id = ?").run(date, interest, principal, accountId, journalId, instId);
    if (!db.prepare("SELECT 1 FROM loan_installments WHERE loan_id = ? AND paid_on IS NULL").get(loanId)) db.prepare("UPDATE loans SET status = 'closed' WHERE id = ?").run(loanId);
    log(db, userId, "paid loan installment", "loan", loanId, `${l.number} #${i.seq} · Rs ${round2(principal + interest)} (principal ${principal}, interest ${interest})`);
    return journalId;
  });
}

// a payment recorded by mistake: only the latest one can be undone; its entry goes too
export function undoInstallment(db, userId, loanId, instId) {
  const i = db.prepare("SELECT * FROM loan_installments WHERE id = ? AND loan_id = ?").get(instId, loanId);
  if (!i || !i.paid_on) throw httpError(400, "This installment isn't paid");
  if (db.prepare("SELECT 1 FROM loan_installments WHERE loan_id = ? AND seq > ? AND paid_on IS NOT NULL").get(loanId, i.seq)) throw httpError(400, "Undo the later installments first");
  tx(db, () => {
    db.prepare("UPDATE loan_installments SET paid_on = NULL, paid_interest = NULL, paid_principal = NULL, account_id = NULL, journal_id = NULL WHERE id = ?").run(instId);
    if (i.journal_id) db.prepare("DELETE FROM journal_entries WHERE id = ?").run(i.journal_id);
    db.prepare("UPDATE loans SET status = 'active' WHERE id = ?").run(loanId);
    log(db, userId, "undid loan installment", "loan", loanId, `#${i.seq} · Rs ${round2(i.paid_interest + i.paid_principal)}`);
  });
}

// a loan entered by mistake: only while nothing is paid on it; the money-received entry goes too
export function deleteLoan(db, userId, id) {
  const l = db.prepare("SELECT * FROM loans WHERE id = ?").get(id);
  if (!l) throw httpError(404, "Loan not found");
  if (db.prepare("SELECT 1 FROM loan_installments WHERE loan_id = ? AND paid_on IS NOT NULL").get(id)) throw httpError(400, "Installments are paid on this loan. Undo them first.");
  tx(db, () => {
    db.prepare("DELETE FROM loans WHERE id = ?").run(id);
    if (l.disburse_journal_id) db.prepare("DELETE FROM journal_entries WHERE id = ?").run(l.disburse_journal_id);
    // its own account, if nothing else uses it
    if (!db.prepare("SELECT 1 FROM journal_lines WHERE account_id = ?").get(l.loan_account_id) && !db.prepare("SELECT 1 FROM loans WHERE loan_account_id = ?").get(l.loan_account_id))
      db.prepare("DELETE FROM accounts WHERE id = ? AND system_key IS NULL AND opening_balance = 0").run(l.loan_account_id);
    log(db, userId, "deleted loan", "loan", id, `${l.number} · ${l.lender} · Rs ${l.principal}`);
  });
}

// installments due within a week or overdue (home, morning brief, menu count)
export const dueInstallments = (db, on = karachiToday(), within = 7) =>
  db.prepare(`SELECT i.*, l.number, l.lender, l.reference, l.id AS loan_id, l.bank_account_id, a.name AS bank_account_name FROM loan_installments i JOIN loans l ON l.id = i.loan_id LEFT JOIN accounts a ON a.id = l.bank_account_id
    WHERE i.paid_on IS NULL AND l.status = 'active' AND i.due_date <= date(?, '+' || ? || ' days') ORDER BY i.due_date, i.id`).all(on, within)
    .map((i) => ({ ...i, amount: round2(i.interest + i.principal), ...urgency(i.due_date, on) }));

// reminders: 7, 3, 1 days before and on the day, then daily while it is past and not marked paid
export function remindLoans(db, on = karachiToday()) {
  const sent = [];
  for (const i of dueInstallments(db, on, 7)) {
    const left = i.days_left;
    if (!(left < 0 || [7, 3, 1, 0].includes(left)) || i.last_reminded === on) continue;
    const when = left < 0 ? `${-left} day${left === -1 ? "" : "s"} past due: paid? Mark it paid on the loan` : left === 0 ? "due TODAY: keep the money in the bank" : `due in ${left} day${left === 1 ? "" : "s"} (${i.due_date}): keep the money in the bank`;
    notify(db, [...usersWith(db, "money"), ...usersWith(db, "admin")], { kind: "loan", title: `Loan installment Rs ${Math.round(i.amount).toLocaleString("en-PK")} · ${i.lender}`, body: `${i.number} #${i.seq} ${when}`, link: `/loans?open=${i.loan_id}` });
    db.prepare("UPDATE loan_installments SET last_reminded = ? WHERE id = ?").run(on, i.id);
    sent.push(i.id);
  }
  return sent;
}
export function startLoanReminders(db, logger = console) {
  const tick = () => { try { const n = remindLoans(db).length; if (n) logger.log(`Loan reminders: ${n}`); } catch (e) { logger.error("Loan reminders failed:", e.message); } };
  setTimeout(tick, 40000);
  return setInterval(tick, 60 * 60000);
}
