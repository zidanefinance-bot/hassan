// Delete requests waiting for a director, and everything everyone did (directors see all; others see their own requests).
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, Loading, PageHead, Search, useAuth, useLoad, useToast } from "../lib.jsx";
import { ActivityList, when } from "../components/Activity.jsx";

function Requests() {
  const state = useLoad("/delete-requests");
  const { can } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [refusing, setRefusing] = useState(null);
  const [note, setNote] = useState("");
  const approve = async (r) => {
    setBusy(r.id);
    try { await api(r.path, { method: "DELETE", headers: { "x-reason": encodeURIComponent(r.reason), "x-approval": String(r.id) } }); toast(`Deleted ${r.title}`); }
    catch (e) { toast(e.message, "error"); }
    setBusy(null); state.reload();
  };
  const reject = async (r) => {
    setBusy(r.id);
    try { await api(`/delete-requests/${r.id}/reject`, { method: "POST", body: { note } }); toast("Request refused"); setRefusing(null); setNote(""); } catch (e) { toast(e.message, "error"); }
    setBusy(null); state.reload();
  };
  return (
    <section className="card">
      <h3>{can("admin") ? "Delete requests" : "My delete requests"}</h3>
      <Loading state={state}>{(rows) => rows.length === 0 ? <p className="muted">{can("admin") ? "Nothing waiting. When Sales, Operations or Accounts want something deleted, it shows here for your OK." : "You haven't asked to delete anything."}</p> : (
        <table className="table">
          <thead><tr><th>Asked</th><th>What</th><th>By</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td className="small">{when(r.created_at)}</td>
              <td>{r.link && r.status === "pending" ? <Link to={r.link}>{r.title}</Link> : r.title}</td>
              <td>{r.requested_by_name}</td>
              <td className="why">{r.reason}</td>
              <td><span className={`badge ${r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "amber"}`}>{r.status === "pending" ? "waiting" : r.status === "approved" ? "deleted" : "refused"}</span>{r.status !== "pending" && <div className="small muted">by {r.decided_by_name}{r.note ? ` · ${r.note}` : ""}</div>}</td>
              <td className="r">{can("admin") && r.status === "pending" && (refusing === r.id
                ? <span className="inline-form"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why not? (optional)" autoFocus /><button className="btn sm" disabled={busy === r.id} onClick={() => reject(r)}>Refuse</button><button className="btn sm ghost" onClick={() => setRefusing(null)}>✕</button></span>
                : <><button className="btn sm primary" disabled={busy === r.id} onClick={() => approve(r)}>Approve delete</button> <button className="btn sm ghost" disabled={busy === r.id} onClick={() => setRefusing(r.id)}>Refuse</button></>)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}</Loading>
    </section>
  );
}

function Log() {
  const [q, setQ] = useState("");
  const state = useLoad(`/activity?q=${encodeURIComponent(q)}&limit=300`, [q]);
  return (
    <section className="card">
      <div className="points-head"><h3>Everything that happened</h3><Search value={q} onChange={setQ} placeholder="Search person, number, reason…" /></div>
      <Loading state={state}>{(rows) => rows.length ? <ActivityList rows={rows} showWhat /> : <p className="muted">Nothing found.</p>}</Loading>
    </section>
  );
}

export default function ActivityLog() {
  const { can } = useAuth();
  return (
    <>
      <PageHead title="Approvals & activity" sub="Every change and delete needs a reason. Only the Director deletes; everyone else's delete waits here for approval." />
      <Requests />
      {can("admin") && <Log />}
    </>
  );
}
