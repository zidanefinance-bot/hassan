import csv, re
from collections import defaultdict

BANK_PREFIX = re.compile(r"^(UBANK|MMBL|BAHL|MBL|HMB|FBL|HBL|MEZ|BIP|MPBL|FAYS|BKIP)")

def extract_name(desc):
    d = ' '.join(desc.split())
    m = re.search(r"Title:\s*([A-Za-z][A-Za-z .']+?)\s*(?:Acc\b|A/c|$)", d)
    if m: return m.group(1)
    m = re.search(r"Acc:\s*([A-Za-z][A-Za-z .']+?)\s*\(", d)
    if m: return m.group(1)
    m = re.search(r"Sender\s*\(\s*([A-Za-z][^)]*?)\s*\)", d)
    if m: return m.group(1)
    # squished Raast: "TO FATIMAZAINIBANXXXX" / "FR ZIDANECORPORATIONIBANXXXX"
    m = re.search(r"\b(?:TO|FR)\s+([A-Z][A-Z+\-.&']*?)IBAN\s*XXXX", d)
    if m: return m.group(1)
    m = re.search(r"(?:TRANSFERRED TO|RECEIVED FROM|Transfer to|Mobile to|Mobile from|Funds Transfer to|Web FROM|FUNDS RECEIVED FROM)\s+(.+)", d, re.I)
    if m:
        rest = re.split(r"\s*(?:,\(|\(|A/C|A/c|IBAN|FAYSAL BANK|MMFB|MPBL|MB\b|Thru|THRU|,?\s*DT[:.]?|Dt:|REF|Ref:|VIA|\d{5,})", m.group(1))[0].strip(" ,.-*")
        if len(rest) >= 3 and not rest.isdigit(): return rest
    m = re.search(r"<>\s*TO\s*(.+?)\s*(?:IBAN|Thru|MB\d|$)", d)
    if m and len(m.group(1)) >= 3: return m.group(1).strip(' ,.-')
    # Digital Banking squished: "...Thru Digital Banking UBANKHASSANSAL" / "...PK77HABB0053 GREENLEAV"
    m = re.search(r"Thru Digital Banking\s*(.*)$", d)
    if m:
        tail = m.group(1).strip()
        toks = [t for t in re.split(r"[ ]", tail) if t.isalpha() and len(t) >= 6]
        if toks:
            name = BANK_PREFIX.sub("", toks[-1])
            if len(name) >= 4: return name
    # utility bills
    m = re.search(r"UBPS to ([A-Z0-9\- ]+?)\s*(?:INVOICE)?\s*\(", d)
    if m: return m.group(1).strip() + " (bill)"
    if "K-ELECTRIC" in d.upper(): return "K-ELECTRIC (bill)"
    if "NOOR CARD" in d.upper(): return "NOOR CARD (bill)"
    return None

rows = list(csv.DictReader(open('transactions_may.csv')))
agg = defaultdict(lambda: {"sent": 0.0, "recv": 0.0, "n": 0, "banks": set()})
skipped = defaultdict(int)
for r in rows:
    name = extract_name(r['Description'])
    if not name:
        d = r['Description'].lower()
        if any(k in d for k in ("tax", "charges", "soc -", "cert")): skipped['Tax/Bank Charges'] += 1
        elif any(k in d for k in ("cash deposit", "cash withdrawal")): skipped['Cash Deposit/Withdrawal'] += 1
        elif any(k in d for k in ("chq", "cheque", "clearing")): skipped['Cheque (clearing)'] += 1
        else: skipped['Unidentified'] += 1
        continue
    key = re.sub(r"\s+", " ", name.upper()).strip()
    a = agg[key]
    a["sent"] += float(r['Debit'] or 0)
    a["recv"] += float(r['Credit'] or 0)
    a["n"] += 1
    a["banks"].add(r['Bank/Account'].split(' - ')[0])

print(f"named: {sum(a['n'] for a in agg.values())}/{len(rows)} | counterparties: {len(agg)} | skipped: {dict(skipped)}")
out = [["Counterparty", "Sent (Debit)", "Received (Credit)", "Net", "Txns", "Banks"]]
for k, a in sorted(agg.items(), key=lambda kv: -(kv[1]['sent'] + kv[1]['recv'])):
    out.append([k.title(), round(a['sent'],2) or "", round(a['recv'],2) or "",
                round(a['recv']-a['sent'],2), a['n'], ", ".join(sorted(a['banks']))])
for k, n in sorted(skipped.items()):
    out.append([f"({k} — no counterparty)", "", "", "", n, ""])
with open('counterparties.csv','w',newline='') as f:
    csv.writer(f).writerows(out)
for row in out[:12]: print(row)
