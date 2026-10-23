// "Paid into / paid from": the cash, bank or wallet account a payment, refund or expense went through.
// Picks a sensible default from the mode (cash → Cash in hand, anything else → the first bank) until the user chooses.
import React, { useEffect, useRef, useState } from "react";
import { api } from "../lib.jsx";

let cache = null;
const loadAccounts = () => (cache ||= api("/accounts/money").catch((e) => { cache = null; throw e; }));
export const forgetAccounts = () => { cache = null; };
const KIND_LABEL = { cash: "Cash", bank: "Bank", wallet: "Wallet" };

export default function AccountSelect({ value, onChange, mode, required = true }) {
  const [list, setList] = useState([]);
  const touched = useRef(Boolean(value));
  useEffect(() => { loadAccounts().then(setList).catch(() => setList([])); }, []);
  useEffect(() => {
    if (touched.current || !list.length) return;
    const want = mode === "cash" ? "cash" : mode === "online" ? "wallet" : "bank";
    const pick = list.find((a) => a.kind === want) || list.find((a) => a.kind === (want === "cash" ? "cash" : "bank")) || list[0];
    if (pick && String(pick.id) !== String(value)) onChange(String(pick.id));
  }, [mode, list]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <select value={value || ""} required={required} onChange={(e) => { touched.current = true; onChange(e.target.value); }}>
      {!value && <option value="">Choose account…</option>}
      {["cash", "bank", "wallet"].map((k) => {
        const group = list.filter((a) => a.kind === k);
        return group.length ? (
          <optgroup key={k} label={KIND_LABEL[k]}>
            {group.map((a) => <option key={a.id} value={a.id}>{a.name}{a.account_number ? ` · ${a.account_number.slice(-4)}` : ""}</option>)}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}
