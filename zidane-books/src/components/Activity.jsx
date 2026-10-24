// What happened on a record: who did what and when, with the reasons given for changes and deletes.
import React, { useEffect, useState } from "react";
import { useLoad } from "../lib.jsx";

export const when = (at) => (at ? new Date(at.replace(" ", "T") + "Z").toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
export const isReason = (a) => /^reason for|asked to delete|refused delete/.test(a.action);

export function ActivityList({ rows, showWhat }) {
  return (
    <ul className="activity">{rows.map((a) => (
      <li key={a.id} className={isReason(a) ? "reason" : ""}>
        <div><b>{a.user_name || "System"}</b> {a.action}{showWhat && a.entity ? <span className="muted"> · {a.entity.replace(/_/g, " ")}</span> : null}</div>
        {a.summary && <div className={isReason(a) ? "why" : "muted small"}>{a.summary}</div>}
        <div className="muted small">{when(a.at)}</div>
      </li>
    ))}</ul>
  );
}

export default function Activity({ entity, id }) {
  const state = useLoad(`/activity?entity=${entity}&id=${id}`, [entity, id]);
  const [all, setAll] = useState(false);
  const { reload } = state;
  useEffect(() => { window.addEventListener("zb:changed", reload); return () => window.removeEventListener("zb:changed", reload); }, [reload]);
  const rows = state.data || [];
  if (!rows.length) return null;
  return (
    <section className="card no-print">
      <h3>Recent activity <span className="muted">({rows.length})</span></h3>
      <ActivityList rows={all ? rows : rows.slice(0, 6)} showWhat={entity === "job"} />
      {rows.length > 6 && <button className="btn sm ghost" onClick={() => setAll(!all)}>{all ? "Show less" : `Show all ${rows.length}`}</button>}
    </section>
  );
}
