import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { QRCodeSVG } from "qrcode.react";
import { Alert, Button, Field, Modal, PageHeader, PageState } from "../../components/ui";
import { fmtDate, todayISO } from "../../utils/format";

const MyLeaves = () => {
  const { data, loading, error, reload } = useFetch("/leaves/me");
  const [form, setForm] = useState(null);
  const [pass, setPass] = useState(null);
  const { run, busy, error: formError, setError } = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    run(async () => { await api.post("/leaves", form); setForm(null); reload(); });
  };
  const cancel = (l) => window.confirm("Cancel this request?") && run(async () => { await api.delete(`/leaves/${l._id}`); reload(); });

  return (
    <div>
      <PageHeader title="My Leave" subtitle="Apply for leave before leaving the hostel.">
        <Button variant="gold" onClick={() => { setError(""); setForm({ leaveType: "normal", reason: "", fromDate: todayISO(), toDate: todayISO(), contactDuringLeave: "" }); }}>+ Apply for leave</Button>
      </PageHeader>
      <Alert>{!form && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No leave requests yet." columns={[
          { key: "dates", label: "Dates", render: (l) => `${fmtDate(l.fromDate)} → ${fmtDate(l.toDate)}` },
          { key: "leaveType", label: "Type", render: (l) => <span className="capitalize">{l.leaveType}</span> },
          { key: "reason", label: "Reason", render: (l) => <span className="line-clamp-2 max-w-xs">{l.reason}</span> },
          { key: "status", label: "Status", render: (l) => <Badge status={l.status} /> },
          { key: "approvalRemarks", label: "Warden's remarks", render: (l) => l.approvalRemarks || "—" },
          { key: "act", label: "", render: (l) => l.status === "pending" ? <Button size="sm" variant="outline" onClick={() => cancel(l)}>Cancel</Button>
            : l.status === "approved" && l.toDate.slice(0, 10) >= todayISO() ? <Button size="sm" variant="gold" onClick={() => setPass(l)}>Gate pass</Button> : null },
        ]} />
      </PageState>
      <Modal open={!!pass} title="Leave gate pass" onClose={() => setPass(null)}>
        {pass && (
          <div className="text-center space-y-3">
            <div className="inline-block p-4 bg-white border border-slate-200 rounded-lg" data-testid="leave-qr"><QRCodeSVG value={`HMS|LEAVE|${pass._id}`} size={190} level="M" /></div>
            <p className="font-display text-lg">{fmtDate(pass.fromDate)} → {fmtDate(pass.toDate)}</p>
            <p className="text-sm text-muted capitalize">{pass.leaveType} leave · {pass.reason}</p>
            <p className="text-xs text-muted">Show this code to the guard when you leave and when you return. It only works between these dates.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!form} title="Apply for leave" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="From"><input className="input" type="date" required min={todayISO()} value={form.fromDate} onChange={set("fromDate")} /></Field>
              <Field label="To"><input className="input" type="date" required min={form.fromDate} value={form.toDate} onChange={set("toDate")} /></Field>
            </div>
            <Field label="Type"><select className="input" value={form.leaveType} onChange={set("leaveType")}><option value="normal">Normal</option><option value="emergency">Emergency</option></select></Field>
            <Field label="Reason"><textarea className="input" rows={3} required value={form.reason} onChange={set("reason")} /></Field>
            <Field label="Contact during leave"><input className="input" value={form.contactDuringLeave} onChange={set("contactDuringLeave")} /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>Submit request</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default MyLeaves;
