import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "./db.js";
import * as LOAN from "./loans.js";
import { ensureAdmin, seedDemo } from "./seed.js";

// A term loan: Rs 5,000,000 at 19.05% from 31 Oct 2026, 36 × 180,634.67 from 1 Nov 2026 (a bank's printed schedule,
// as columns: date, balance after, interest, principal). Figures only, no customer data.
const PRINT = `Loan Schedule Enquiry
? Date Principal outstanding Interest Principal repayment
31OCT2026 Loan start Amount : 5,000,000.00 Rate : 19.05
31OCT2026 New instruction
Maturity : 01OCT2029 Payments : 36 Constant : 180,634.67
01NOV2026 4,821,974.92 2,609.59 178,025.08
01DEC2026 4,716,840.49 75,500.24 105,134.43
01JAN2027 4,612,521.71 76,315.89 104,318.78
01FEB2027 4,506,515.11 74,628.07 106,006.60
01MAR2027 4,391,737.29 65,856.85 114,777.82
01APR2027 4,282,158.52 71,055.90 109,578.77
01MAY2027 4,168,571.89 67,048.04 113,586.63
01JUN2027 4,055,382.43 67,445.21 113,189.46
01JUL2027 3,938,245.05 63,497.29 117,137.38
01AUG2027 3,821,329.03 63,718.65 116,916.02
01SEP2027 3,702,521.37 61,827.01 118,807.66 +
01OCT2027 3,579,859.06 57,972.36 122,662.31
01NOV2027 3,457,144.55 57,920.16 122,714.51
01DEC2027 3,330,640.24 54,130.36 126,504.31
01JAN2028 3,203,893.50 53,887.93 126,746.74
01FEB2028 3,075,096.07 51,837.24 128,797.43
01MAR2028 2,941,004.87 46,543.47 134,091.20
01APR2028 2,807,954.05 47,583.85 133,050.82
01MAY2028 2,671,285.02 43,965.64 136,669.03
01JUN2028 2,533,870.28 43,219.93 137,414.74
01JUL2028 2,392,909.77 39,674.16 140,960.51
01AUG2028 2,250,991.07 38,715.97 141,918.70
01SEP2028 2,106,776.20 36,419.80 144,214.87
01OCT2028 1,959,128.45 32,986.92 147,647.75
01NOV2028 1,810,191.40 31,697.62 148,937.05 +
01DEC2028 1,657,899.86 28,343.13 152,291.54
01JAN2029 1,504,089.10 26,823.91 153,810.76
01FEB2029 1,347,789.77 24,335.34 156,299.33
01MAR2029 1,186,851.29 19,696.19 160,938.48
01APR2029 1,025,419.22 19,202.60 161,432.07
01MAY2029 860,840.09 16,055.54 164,579.13
01JUN2029 694,133.34 13,927.92 166,706.75
01JUL2029 524,367.09 10,868.42 169,766.25
01AUG2029 352,216.39 8,483.97 172,150.70
01SEP2029 177,280.39 5,698.67 174,936.00
01OCT2029* 0.00 2,868.30 177,280.39
01OCT2029 Loan maturity
Total scheduled interest: 1,502,362.14`;
const TERMS = { lender: "Test Bank", reference: "TL-1", principal: 5000000, rate: 19.05, start_date: "2026-10-31", first_due: "2026-11-01", months: 36, installment: 180634.67 };

test("the worked-out schedule matches the bank's print to the paisa", () => {
  const bank = LOAN.parseSchedule(PRINT, 5000000);
  assert.equal(bank.length, 36);
  const ours = LOAN.buildSchedule(TERMS).rows;
  for (let k = 0; k < 36; k++) {
    assert.equal(ours[k].due_date, bank[k].due_date, `#${k + 1} date`);
    assert.equal(ours[k].interest, bank[k].interest, `#${k + 1} interest`);
    assert.equal(ours[k].principal, bank[k].principal, `#${k + 1} principal`);
  }
  assert.equal(Math.round(ours.reduce((s, r) => s + r.interest, 0) * 100) / 100, 1502362.14);
});

test("a loan: money in, installments paid in order post principal + interest, undo, reminders, delete guarded", () => {
  const db = openDb(":memory:");
  ensureAdmin(db);
  seedDemo(db);
  const bank = db.prepare("SELECT id FROM accounts WHERE kind = 'bank' LIMIT 1").get().id;
  const bal = (acc) => db.prepare("SELECT COALESCE(SUM(debit - credit), 0) AS v FROM journal_lines WHERE account_id = ?").get(acc).v;
  const before = bal(bank);
  const id = LOAN.createLoan(db, 1, { ...TERMS, bank_account_id: bank, received: 4990000, schedule_text: PRINT });
  let l = LOAN.getLoan(db, id);
  assert.equal(l.installments.length, 36);
  assert.equal(l.ledger_balance, 5000000, "the loan account owes the full amount");
  assert.equal(Math.round((bal(bank) - before) * 100) / 100, 4990000, "only what came in reached the bank; the fee went to bank charges");

  assert.throws(() => LOAN.payInstallment(db, 1, id, l.installments[1].id), /in order/);
  LOAN.payInstallment(db, 1, id, l.installments[0].id, {});
  LOAN.payInstallment(db, 1, id, l.installments[1].id, { date: "2026-12-02" });
  l = LOAN.getLoan(db, id);
  assert.equal(l.outstanding, 4716840.49);
  assert.equal(l.ledger_balance, 4716840.49, "the books agree with the bank's balance");
  assert.equal(l.interest_paid, 2609.59 + 75500.24);
  assert.equal(bal(l.interest_account_id), 2609.59 + 75500.24, "interest is an expense");
  assert.equal(l.next.seq, 3);
  assert.equal(l.installments[1].paid_on, "2026-12-02");

  // a journal of the loan can't be deleted by itself; undo goes from the latest
  assert.throws(() => LOAN.undoInstallment(db, 1, id, l.installments[0].id), /later/);
  LOAN.undoInstallment(db, 1, id, l.installments[1].id);
  assert.equal(LOAN.getLoan(db, id).outstanding, 4821974.92);

  // due soon → reminder once a day; home list
  const due = LOAN.dueInstallments(db, "2026-11-28");
  assert.equal(due.length, 1);
  assert.equal(due[0].days_left, 3);
  assert.deepEqual(LOAN.remindLoans(db, "2026-11-28").length, 1);
  assert.deepEqual(LOAN.remindLoans(db, "2026-11-28").length, 0, "once a day");
  assert.equal(LOAN.remindLoans(db, "2026-11-29").length, 0, "2 days before: no reminder");
  assert.equal(LOAN.remindLoans(db, "2026-12-04").length, 1, "past due: every day");

  assert.throws(() => LOAN.deleteLoan(db, 1, id), /paid/);
  LOAN.undoInstallment(db, 1, id, l.installments[0].id);
  LOAN.deleteLoan(db, 1, id);
  assert.equal(bal(bank), before, "the loan-received entry went with it");
});
