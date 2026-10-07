import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Field, Modal, PageHeader, PageState, Select } from "../../components/ui";
import { fmtDate, nameOf } from "../../utils/format";

const Leaves = () => {
  const [status, setStatus] = useState("pending");
  const { data, loading, error, reload } = useFetch(`/leaves${status ? `?status=${status}` : ""}`);
  const [target, setTarget] = useState(null);
  const [remarks, setRemarks] = useState("");
  const { run, busy, error: formError, setError } = useAction();

  const decide = (decision) => run(async () => {
    await api.put(`/leaves/${target._id}/decision`, { status: decision, approvalRemarks: remarks || undefined });
    setTarget(null); setRemarks(""); reload();
  });

  return (
    <div>
      <PageHeader title="Leave Requests" subtitle="Review student leave applications.">
        <Select value={status} onChange={setStatus} placeholder="All" options={["pending", "approved", "rejected"]} />
      </PageHeader>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No leave requests." columns={[
          { key: "student", label: "Student", render: (l) => (<div><p className="font-medium">{nameOf(l.student)}</p><p className="text-xs text-muted">{l.student?.registrationNumber}</p></div>) },
          { key: "leaveType", label: "Type", render: (l) => <span className="capitalize">{l.leaveType}</span> },
          { key: "dates", label: "Dates", render: (l) => `${fmtDate(l.fromDate)} → ${fmtDate(l.toDate)}` },
          { key: "reason", label: "Reason", render: (l) => <span className="line-clamp-2 max-w-xs">{l.reason}</span> },
          { key: "status", label: "Status", render: (l) => <Badge status={l.status} /> },
          { key: "act", label: "", render: (l) => l.status === "pending" && <Button size="sm" variant="gold" onClick={() => { setError(""); setRemarks(""); setTarget(l); }}>Review</Button> },
        ]} />
      </PageState>
      <Modal open={!!target} title="Review leave request" onClose={() => setTarget(null)}>
        {target && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><strong>{nameOf(target.student)}</strong> ({target.student?.registrationNumber})</p>
              <p>{fmtDate(target.fromDate)} → {fmtDate(target.toDate)} · <span className="capitalize">{target.leaveType}</span></p>
              <p className="text-muted">{target.reason}</p>
              {target.contactDuringLeave && <p className="text-muted">Contact: {target.contactDuringLeave}</p>}
            </div>
            <Field label="Remarks (optional)"><input className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2">
              <Button variant="danger" disabled={busy} onClick={() => decide("rejected")}>Reject</Button>
              <Button disabled={busy} onClick={() => decide("approved")}>Approve</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default Leaves;
