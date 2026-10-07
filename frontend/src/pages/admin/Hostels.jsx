import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Field, Modal, PageHeader, PageState } from "../../components/ui";

const empty = { name: "", code: "", type: "boys", address: "", totalFloors: 1, contactNumber: "" };

const Hostels = () => {
  const { data, loading, error, reload } = useFetch("/hostels");
  const [modal, setModal] = useState(null); // null | {…hostel}
  const { run, busy, error: formError, setError } = useAction();
  const editing = modal && modal._id;
  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.value });

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const body = { name: modal.name, code: modal.code, type: modal.type, address: modal.address, totalFloors: Number(modal.totalFloors), contactNumber: modal.contactNumber, isActive: modal.isActive };
      editing ? await api.put(`/hostels/${modal._id}`, body) : await api.post("/hostels", body);
      setModal(null);
      reload();
    });
  };
  const remove = (h) => window.confirm(`Delete ${h.name}?`) && run(async () => { await api.delete(`/hostels/${h._id}`); reload(); });

  return (
    <div>
      <PageHeader title="Hostels" subtitle="Buildings managed by the university.">
        <Button variant="gold" onClick={() => { setError(""); setModal({ ...empty }); }}>+ Add Hostel</Button>
      </PageHeader>
      <Alert>{!modal && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No hostels yet. Add your first one." columns={[
          { key: "name", label: "Name", render: (h) => <span className="font-medium">{h.name}</span> },
          { key: "code", label: "Code" },
          { key: "type", label: "Type", render: (h) => <span className="capitalize">{h.type}</span> },
          { key: "totalFloors", label: "Floors" },
          { key: "warden", label: "Warden", render: (h) => h.warden?.name || "—" },
          { key: "isActive", label: "Status", render: (h) => <Badge status={h.isActive ? "active" : "blocked"} /> },
          { key: "act", label: "", render: (h) => (
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setError(""); setModal({ ...h }); }}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => remove(h)}>Delete</Button>
            </div>) },
        ]} />
      </PageState>

      <Modal open={!!modal} title={editing ? "Edit Hostel" : "Add Hostel"} onClose={() => setModal(null)}>
        {modal && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Name"><input className="input" required value={modal.name} onChange={set("name")} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Code"><input className="input" required value={modal.code} onChange={set("code")} placeholder="IQB" /></Field>
              <Field label="Type">
                <select className="input" value={modal.type} onChange={set("type")}><option value="boys">Boys</option><option value="girls">Girls</option></select>
              </Field>
            </div>
            <Field label="Address"><input className="input" value={modal.address || ""} onChange={set("address")} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Floors"><input className="input" type="number" min="1" value={modal.totalFloors} onChange={set("totalFloors")} /></Field>
              <Field label="Contact"><input className="input" value={modal.contactNumber || ""} onChange={set("contactNumber")} /></Field>
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={modal.isActive !== false} onChange={(e) => setModal({ ...modal, isActive: e.target.checked })} /> Active</label>
            )}
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default Hostels;
