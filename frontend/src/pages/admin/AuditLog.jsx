import React, { useEffect, useState } from "react";
import useFetch from "../../hooks/useFetch";
import useDebounce from "../../hooks/useDebounce";
import DataTable from "../../components/DataTable";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import { PageHeader, PageState, Select } from "../../components/ui";
import { fmtDateTime } from "../../utils/format";

const ENTITIES = ["auth", "students", "rooms", "hostels", "fees", "complaints", "leaves", "visitors", "notices", "attendance", "inventory", "mess", "laundry", "room-requests", "qr-entries", "reports"];
const tone = { POST: "bg-success/10 text-success", PUT: "bg-warning/10 text-warning", PATCH: "bg-warning/10 text-warning", DELETE: "bg-danger/10 text-danger" };

// Compact "key: value" summary of what was sent (passwords are never stored)
const summary = (d) => (d && typeof d === "object" ? Object.entries(d).filter(([, v]) => typeof v !== "object").slice(0, 4).map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(" · ") : "");

const AuditLog = () => {
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  useEffect(() => setPage(1), [dq, entity, method, from, to]);

  const params = new URLSearchParams({ limit: PAGE_SIZE, page });
  if (dq.trim()) params.set("q", dq.trim());
  if (entity) params.set("entity", entity);
  if (method) params.set("method", method);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const { data, total, loading, error, reload } = useFetch(`/audit?${params}`);

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Every change made in the system: who did it, what, and when. Kept for 180 days. Passwords are never recorded.">
        <input className="input !w-48" placeholder="Search user or route" aria-label="Search audit log" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={entity} onChange={setEntity} placeholder="All areas" options={ENTITIES} aria-label="Area" />
        <Select value={method} onChange={setMethod} placeholder="All actions" options={[["POST", "Create / action (POST)"], ["PUT", "Update (PUT)"], ["DELETE", "Delete"]]} aria-label="Action" />
        <input type="date" className="input !w-auto" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input !w-auto" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
      </PageHeader>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No activity matches these filters." columns={[
          { key: "createdAt", label: "When", render: (l) => fmtDateTime(l.createdAt) },
          { key: "userName", label: "Who", render: (l) => (<div><p className="font-medium">{l.userName}</p><p className="text-xs text-muted capitalize">{l.role === "admin" ? "warden" : l.role}</p></div>) },
          { key: "route", label: "What", render: (l) => (<div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${tone[l.method] || "bg-slate-200 text-muted"}`}>{l.method}</span><code className="text-xs">{l.route}</code></div>) },
          { key: "details", label: "Details", render: (l) => <span className="text-xs text-muted">{summary(l.details) || l.details?.event || "—"}</span> },
          { key: "ip", label: "IP", render: (l) => <span className="text-xs text-muted">{l.ip}</span> },
        ]} />
        <Pagination page={page} total={total} onChange={setPage} />
      </PageState>
    </div>
  );
};
export default AuditLog;
