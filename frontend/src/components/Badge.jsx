import React from "react";

const good = "bg-success/10 text-success";
const warn = "bg-warning/10 text-warning";
const bad = "bg-danger/10 text-danger";
const grey = "bg-slate-200 text-muted";
const styles = {
  paid: good, resolved: good, available: good, allocated: good, approved: good, fulfilled: good, ok: good, present: good, completed: good, active: good, taken: good, checked_in: good, new: good, good: good, entry: good, booked: good,
  pending: warn, waiting: warn, due_soon: warn, in_progress: warn, partially_paid: warn, under_maintenance: warn, maintenance: warn, medium: warn, late: warn, pending_approval: warn, fair: warn, under_repair: warn, not_allocated: warn,
  overdue: bad, rejected: bad, full: bad, high: bad, absent: bad, damaged: bad, no_show: bad, suspended: bad,
  blocked: grey, paused: grey, low: grey, cancelled: grey, vacated: grey, checked_out: grey, exit: grey, left: grey, graduated: grey,
};

const Badge = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap ${styles[status] || grey}`}>
    {(status || "").replace(/_/g, " ")}
  </span>
);
export default Badge;
