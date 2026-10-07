import React from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, PageHeader, PageState } from "../../components/ui";
import { fmtDateTime } from "../../utils/format";

const MyVisitors = () => {
  const { data, loading, error, reload } = useFetch("/visitors/me");
  const { run, error: actionError } = useAction();
  const decide = (v, status) => run(async () => { await api.put(`/visitors/${v._id}/decision`, { status }); reload(); });
  return (
    <div>
      <PageHeader title="My Visitors" subtitle="Guests are registered by the guard at the gate. You (or the warden) approve them before they enter." />
      <div className="mb-3"><Alert>{actionError}</Alert></div>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No visitors yet." columns={[
          { key: "visitorName", label: "Visitor", render: (v) => (<div><p className="font-medium">{v.visitorName}</p><p className="text-xs text-muted">{v.relation || "Visitor"}{v.phone ? ` · ${v.phone}` : ""}</p></div>) },
          { key: "purpose", label: "Purpose", render: (v) => v.purpose || "—" },
          { key: "entryTime", label: "Arrived", render: (v) => fmtDateTime(v.entryTime) },
          { key: "status", label: "Status", render: (v) => <Badge status={v.status} /> },
          { key: "act", label: "", render: (v) => v.status === "pending_approval" && (
            <div className="flex gap-2 justify-end"><Button size="sm" variant="outline" onClick={() => decide(v, "rejected")}>Reject</Button><Button size="sm" variant="gold" onClick={() => decide(v, "approved")}>Approve</Button></div>) },
        ]} />
      </PageState>
    </div>
  );
};
export default MyVisitors;
