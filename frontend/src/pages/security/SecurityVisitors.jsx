import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Field, Modal, PageHeader, PageState } from "../../components/ui";
import { fmtDateTime, nameOf } from "../../utils/format";

const blank = { registrationNumber: "", visitorName: "", cnic: "", phone: "", relation: "", purpose: "" };

const SecurityVisitors = () => {
  const { data, loading, error, reload } = useFetch("/visitors");
  const [form, setForm] = useState(null);
  const { run, busy, error: formError, setError } = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const register = (e) => {
    e.preventDefault();
    run(async () => { await api.post("/visitors", form); setForm(null); reload(); });
  };
  const act = (v, path) => run(async () => { await api.post(`/visitors/${v._id}/${path}`); reload(); });

  return (
    <div>
      <PageHeader title="Visitors" subtitle="Register guests, then check them in once the student or warden approves.">
        <Button variant="gold" onClick={() => { setError(""); setForm({ ...blank }); }}>+ Register visitor</Button>
      </PageHeader>
      <Alert>{!form && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No visitors yet." columns={[
          { key: "visitorName", label: "Visitor", render: (v) => (<div><p className="font-medium">{v.visitorName}</p><p className="text-xs text-muted">CNIC {v.cnic}</p></div>) },
          { key: "student", label: "Visiting", render: (v) => (<div><p>{nameOf(v.student)}</p><p className="text-xs text-muted">{v.student?.registrationNumber}</p></div>) },
          { key: "relation", label: "Relation", render: (v) => v.relation || "—" },
          { key: "entryTime", label: "Registered", render: (v) => fmtDateTime(v.entryTime) },
          { key: "status", label: "Status", render: (v) => <Badge status={v.status} /> },
          { key: "act", label: "", render: (v) => v.status === "approved" ? <Button size="sm" variant="gold" onClick={() => act(v, "check-in")}>Check in</Button>
            : v.status === "checked_in" ? <Button size="sm" variant="outline" onClick={() => act(v, "check-out")}>Check out</Button> : null },
        ]} />
      </PageState>

      <Modal open={!!form} title="Register visitor" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={register} className="space-y-4">
            <Field label="Student registration no."><input className="input" required value={form.registrationNumber} onChange={set("registrationNumber")} placeholder="CS-2023-001" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Visitor name"><input className="input" required value={form.visitorName} onChange={set("visitorName")} /></Field>
              <Field label="CNIC"><input className="input" required value={form.cnic} onChange={set("cnic")} placeholder="42101-1234567-1" /></Field>
              <Field label="Phone"><input className="input" value={form.phone} onChange={set("phone")} /></Field>
              <Field label="Relation"><input className="input" value={form.relation} onChange={set("relation")} placeholder="Father" /></Field>
            </div>
            <Field label="Purpose"><input className="input" value={form.purpose} onChange={set("purpose")} /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>Register</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default SecurityVisitors;
