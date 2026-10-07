import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, PageHeader, PageState, Select } from "../../components/ui";
import { fmtDateTime, nameOf } from "../../utils/format";

const Visitors = () => {
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useFetch(`/visitors${status ? `?status=${status}` : ""}`);
  const { run, error: actionError } = useAction();
  const decide = (v, s) => run(async () => { await api.put(`/visitors/${v._id}/decision`, { status: s }); reload(); });

  return (
    <div>
      <PageHeader title="Visitors" subtitle="Guests registered at the gate.">
        <Select value={status} onChange={setStatus} placeholder="All statuses" options={["pending_approval", "approved", "checked_in", "checked_out", "rejected"]} />
      </PageHeader>
      <div className="mb-3"><Alert>{actionError}</Alert></div>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No visitors recorded." columns={[
          { key: "visitorName", label: "Visitor", render: (v) => (<div><p className="font-medium">{v.visitorName}</p><p className="text-xs text-muted">CNIC {v.cnic}{v.phone ? ` · ${v.phone}` : ""}</p></div>) },
          { key: "student", label: "Visiting", render: (v) => (<div><p>{nameOf(v.student)}</p><p className="text-xs text-muted">Room {v.student?.room?.roomNumber || "—"}</p></div>) },
          { key: "relation", label: "Relation", render: (v) => v.relation || "—" },
          { key: "purpose", label: "Purpose", render: (v) => v.purpose || "—" },
          { key: "time", label: "Time", render: (v) => fmtDateTime(v.entryTime) },
          { key: "status", label: "Status", render: (v) => <Badge status={v.status} /> },
          { key: "act", label: "", render: (v) => v.status === "pending_approval" && (
            <div className="flex gap-2 justify-end"><Button size="sm" variant="outline" onClick={() => decide(v, "rejected")}>Reject</Button><Button size="sm" variant="gold" onClick={() => decide(v, "approved")}>Approve</Button></div>) },
        ]} />
      </PageState>
    </div>
  );
};
export default Visitors;
