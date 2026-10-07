import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Field, Modal, PageHeader, PageState, Select } from "../../components/ui";
import { money } from "../../utils/format";

const Rooms = () => {
  const { hostelId, Picker, hostels } = useHostelPicker({ allowAll: true });
  const [status, setStatus] = useState("");
  const params = new URLSearchParams();
  if (hostelId) params.set("hostel", hostelId);
  if (status) params.set("status", status);
  const { data, loading, error, reload } = useFetch(`/rooms?${params}`);
  const [modal, setModal] = useState(null);
  const { run, busy, error: formError, setError } = useAction();
  const editing = modal && modal._id;
  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.value });
  const blank = () => ({ hostel: hostelId || hostels[0]?._id || "", roomNumber: "", floor: 1, capacity: 2, roomType: "double", monthlyRent: 8000, amenities: "" });

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const body = { roomNumber: modal.roomNumber, floor: Number(modal.floor), capacity: Number(modal.capacity), roomType: modal.roomType, monthlyRent: Number(modal.monthlyRent),
        amenities: typeof modal.amenities === "string" ? modal.amenities.split(",").map((a) => a.trim()).filter(Boolean) : modal.amenities };
      if (editing) await api.put(`/rooms/${modal._id}`, { ...body, status: modal.status });
      else await api.post("/rooms", { ...body, hostel: modal.hostel });
      setModal(null);
      reload();
    });
  };
  const remove = (r) => window.confirm(`Delete room ${r.roomNumber}?`) && run(async () => { await api.delete(`/rooms/${r._id}`); reload(); });

  return (
    <div>
      <PageHeader title="Rooms" subtitle="Capacity, rent and live occupancy.">
        {Picker}
        <Select value={status} onChange={setStatus} placeholder="All statuses" options={["available", "full", "under_maintenance", "blocked"]} />
        <Button variant="gold" onClick={() => { setError(""); setModal(blank()); }}>+ Add Room</Button>
      </PageHeader>
      <Alert>{!modal && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No rooms match these filters." columns={[
          { key: "roomNumber", label: "Room", render: (r) => <span className="font-medium">{r.roomNumber}</span> },
          { key: "hostel", label: "Hostel", render: (r) => r.hostel?.name },
          { key: "floor", label: "Floor" },
          { key: "roomType", label: "Type", render: (r) => <span className="capitalize">{r.roomType}</span> },
          { key: "occ", label: "Beds", render: (r) => `${r.occupiedBeds} / ${r.capacity}` },
          { key: "monthlyRent", label: "Rent", render: (r) => money(r.monthlyRent) },
          { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
          { key: "act", label: "", render: (r) => (
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setError(""); setModal({ ...r, amenities: (r.amenities || []).join(", ") }); }}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => remove(r)}>Delete</Button>
            </div>) },
        ]} />
      </PageState>

      <Modal open={!!modal} title={editing ? `Edit Room ${modal?.roomNumber}` : "Add Room"} onClose={() => setModal(null)}>
        {modal && (
          <form onSubmit={save} className="space-y-4">
            {!editing && !(hostels.length === 1) && (
              <Field label="Hostel"><select className="input" required value={modal.hostel} onChange={set("hostel")}>{hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}</select></Field>
            )}
            <div className="grid grid-cols-3 gap-4">
              <Field label="Room no."><input className="input" required value={modal.roomNumber} onChange={set("roomNumber")} /></Field>
              <Field label="Floor"><input className="input" type="number" min="0" value={modal.floor} onChange={set("floor")} /></Field>
              <Field label="Beds"><input className="input" type="number" min="1" value={modal.capacity} onChange={set("capacity")} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type"><select className="input" value={modal.roomType} onChange={set("roomType")}>{["single", "double", "triple", "dormitory"].map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Monthly rent (Rs)"><input className="input" type="number" min="0" value={modal.monthlyRent} onChange={set("monthlyRent")} /></Field>
            </div>
            {editing && (
              <Field label="Status"><select className="input" value={modal.status} onChange={set("status")}>{["available", "full", "under_maintenance", "blocked"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></Field>
            )}
            <Field label="Amenities" hint="Comma separated, e.g. AC, Wi-Fi, Balcony"><input className="input" value={modal.amenities} onChange={set("amenities")} /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default Rooms;
