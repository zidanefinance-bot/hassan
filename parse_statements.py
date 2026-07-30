#!/usr/bin/env python3
"""Extract transactions from the 3 unique bank statement PDFs -> combined CSV."""
import csv
import re
from datetime import datetime

import pdfplumber

AMT = re.compile(r"^-?[\d,]+\.\d{2}$")
OUT = "transactions.csv"


def to_f(s):
    return float(s.replace(",", ""))


def lines_from_words(words, tol=3):
    rows = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if rows and abs(w["top"] - rows[-1][0]["top"]) <= tol:
            rows[-1].append(w)
        else:
            rows.append([w])
    return rows


def camel_space(s):
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", s)
    s = re.sub(r"(?<=[A-Za-z])(?=\d{2}/\d{2})", " ", s)
    return s


def categorize(desc, debit, credit):
    d = desc.lower()
    if "opening balance" in d:
        return None
    if any(k in d for k in ("tax", "sst", "fed ", "wht")):
        return "Tax"
    if any(k in d for k in ("charges", "fee", "soc -", "subscription")):
        return "Bank Charges"
    if any(k in d for k in ("card", "bill payment")):
        return "Card/Bill Payment"
    if "cash deposit" in d:
        return "Cash Deposit"
    if any(k in d for k in ("funds received", "received from")):
        return "Receipt"
    if any(k in d for k in ("raast", "fund transfer", "funds transfer", "transferred to", "ibft")):
        return "Transfer In" if credit else "Transfer Out"
    if "atm" in d:
        return "ATM Withdrawal"
    if "cheque" in d or "chq" in d:
        return "Cheque"
    return "Other"


def classify_amounts(words, thresholds):
    """words -> (debit, credit, balance) via x1 thresholds [t_debit, t_credit]."""
    debit = credit = balance = None
    for w in words:
        v = to_f(w["text"])
        if w["x1"] < thresholds[0]:
            debit = v
        elif w["x1"] < thresholds[1]:
            credit = v
        else:
            balance = v
    return debit, credit, balance


def parse_hbl(path):
    """HBL Mobile statement: rows start with 'dd-mm-yyyy dd-mm-yyyy', every row has balance.
    Statement is newest-first; debit/credit verified via balance delta."""
    txns = []
    cur = None
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for row in lines_from_words(page.extract_words()):
                texts = [w["text"] for w in row]
                joined = " ".join(texts)
                m = re.match(r"^(\d{2}-\d{2}-\d{4})\s+(\d{2}-\d{2}-\d{4})\s+", joined)
                if m:
                    amts = [w for w in row if AMT.match(w["text"])]
                    desc_words = [w["text"] for w in row[2:] if not AMT.match(w["text"])]
                    d, c, b = classify_amounts(amts, (364, 440))
                    cur = {
                        "date": datetime.strptime(m.group(1), "%d-%m-%Y"),
                        "desc": " ".join(desc_words),
                        "debit": d, "credit": c, "balance": b,
                    }
                    txns.append(cur)
                elif cur and not any(k in joined for k in ("Transaction", "Date ValueDate", "generated through", "Page ")):
                    frag = " ".join(t for t in texts if not AMT.match(t))
                    if frag:
                        cur["desc"] += " " + frag
    # chronological; pairwise balance-delta fixes debit/credit sign (first row keeps x-based)
    txns.reverse()
    for i, t in enumerate(txns):
        amt = t["debit"] if t["debit"] is not None else t["credit"]
        assert amt is not None, f"HBL row without amount: {t}"
        if i == 0:
            continue
        delta = round(t["balance"] - txns[i - 1]["balance"], 2)
        assert abs(abs(delta) - amt) < 0.01, f"HBL mismatch: {t}"
        t["debit"], t["credit"] = (amt, None) if delta < 0 else (None, amt)
    assert abs(txns[-1]["balance"] - 389.00) < 0.01, "HBL closing balance mismatch"
    return [dict(t, bank="HBL - 9503", desc=camel_space(t["desc"])) for t in txns]


def band_rows(page, header_bottom):
    """Split page into bands using horizontal separator lines."""
    ys = sorted({round(l["top"]) for l in page.lines
                 if abs(l["y0"] - l["y1"]) < 1 and (l["x1"] - l["x0"]) > 200})
    ys = [y for y in ys if y > header_bottom]
    if not ys:
        return
    words = [w for w in page.extract_words() if w["top"] > header_bottom]
    bounds = list(zip(ys, ys[1:] + [page.height]))
    for y0, y1 in bounds:
        band = [w for w in words if y0 <= w["top"] < y1]
        if band:
            yield band


def parse_banded(path, date_re, date_fmt, thresholds, bank, opening, header_probe):
    txns = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            hdr = [w for w in page.extract_words() if w["text"] == header_probe]
            header_bottom = hdr[0]["bottom"] if hdr else 0
            for band in band_rows(page, header_bottom):
                joined = " ".join(w["text"] for w in sorted(band, key=lambda w: (w["top"], w["x0"])))
                if "Opening Balance" in joined or "Closing Balance" in joined:
                    continue
                m = date_re.search(joined)
                amts = [w for w in band if AMT.match(w["text"])]
                if not m or not amts:
                    continue
                d, c, b = classify_amounts(amts, thresholds)
                desc = date_re.sub("", " ".join(
                    w["text"] for w in sorted(band, key=lambda w: (w["top"], w["x0"]))
                    if not AMT.match(w["text"]))).strip()
                txns.append({"date": datetime.strptime(m.group(0), date_fmt),
                             "desc": re.sub(r"\s+", " ", desc),
                             "debit": d, "credit": c, "balance": b, "bank": bank})
    # verify with balance checkpoints
    prev = opening
    fixed = 0
    for t in txns:
        expected = round(prev + (t["credit"] or 0) - (t["debit"] or 0), 2)
        if t["balance"] is not None:
            if abs(expected - t["balance"]) >= 0.01:
                # single-amount rows: flip debit/credit if that reconciles
                amt = t["debit"] if t["debit"] is not None else t["credit"]
                alt = round(prev + (amt if t["debit"] is not None else -amt), 2)
                if abs(alt - t["balance"]) < 0.01:
                    t["debit"], t["credit"] = t["credit"], t["debit"]
                    fixed += 1
                else:
                    print(f"  WARN {bank} {t['date']:%d-%b-%Y}: expected {expected}, stated {t['balance']}")
            prev = t["balance"]
        else:
            prev = expected
    print(f"  {bank}: {len(txns)} txns, {fixed} flipped via balance check, final balance {prev:,.2f}")
    return txns


def main():
    print("Parsing HBL...")
    all_txns = parse_hbl("hbl.pdf")
    print(f"  HBL - 9503: {len(all_txns)} txns, closing 389.00 verified")

    print("Parsing HabibMetro (estmt)...")
    all_txns += parse_banded(
        "estmt.pdf", re.compile(r"\d{2}-[A-Za-z]{3}-\d{4}"), "%d-%b-%Y",
        (401, 471), "HabibMetro - 1610", 152675.30, "Particulars")

    print("Parsing Faysal (acct4)...")
    all_txns += parse_banded(
        "acct4.pdf", re.compile(r"[A-Za-z]{3} \d{2}, \d{4}"), "%b %d, %Y",
        (415, 479), "Faysal - 1451", 36506.00, "Description")

    all_txns.sort(key=lambda t: t["date"])
    with open(OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Date", "Description", "Debit", "Credit", "Balance", "Category", "Bank/Account"])
        for t in all_txns:
            w.writerow([t["date"].strftime("%Y-%m-%d"), t["desc"],
                        t["debit"] or "", t["credit"] or "",
                        t["balance"] if t["balance"] is not None else "",
                        categorize(t["desc"], t["debit"], t["credit"]), t["bank"]])
    dr = sum(t["debit"] or 0 for t in all_txns)
    cr = sum(t["credit"] or 0 for t in all_txns)
    print(f"\nTOTAL: {len(all_txns)} transactions | Debits {dr:,.2f} | Credits {cr:,.2f}")
    print(f"CSV written: {OUT}")


if __name__ == "__main__":
    main()
