import React, { useEffect, useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import ExportButton from "../../components/ExportButton";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import useDebounce from "../../hooks/useDebounce";
import { Alert, Button, Field, Modal, PageHeader, PageState, Select } from "../../components/ui";

const blank = { name: "", email: "", password: "", phone: "", registrationNumber: "", department: "", semester: 1, gender: "male", guardianName: "", guardianPhone: "", address: "" };

const Students = () => {
  const { hostelId, Picker } = useHostelPicker({ allowAll: true });
  const [q, setQ] = useState("");
  const [alloc, setAlloc] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  useEffect(() => setPage(1), [hostelId, dq, alloc]);
  const params = new URLSearchParams({ limit: PAGE_SIZE, page });
  if (hostelId) params.set("hostel", hostelId);
  if (dq.trim()) params.set("q", dq.trim());
  if (alloc) params.set("allocationStatus", alloc);
  const { data, total, loading, error, reload } = useFetch(`/students?${params}`);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [target, setTarget] = useState(null); // student being allocated
  const [allocHostel, setAllocHostel] = useState("");
  const [roomId, setRoomId] = useState("");
  const [detail, setDetail] = useState(null);
  const { run, busy, error: formError, setError } = useAction();
  const hostelsRes = useFetch("/hostels");
  const rooms = useFetch(allocHostel ? `/rooms/available/${allocHostel}` : null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { setRoomId(""); }, [allocHostel]);

  const create = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post("/students", { ...form, semester: Number(form.semester), password: form.password || undefined });
      setAddOpen(false); setForm(blank); reload();
    });
  };
  const openAlloc = (s) => {
    setError(""); setRoomId(""); setTarget(s);
    const wanted = hostelsRes.data?.find((h) => h.type === (s.gender === "male" ? "boys" : "girls"));
    setAllocHostel(s.hostel?._id || wanted?._id || hostelsRes.data?.[0]?._id || "");
  };
  const allocate = (e) => {
    e.preventDefault();
    run(async () => { await api.post(`/students/${target._id}/allocate-room`, { roomId }); setTarget(null); reload(); });
  };
  const vacate = (s) => window.confirm(`Vacate ${s.user?.name}'s room?`) && run(async () => { await api.post(`/students/${s._id}/vacate-room`); reload(); });
  const saveDetail = (e) => {
    e.preventDefault();
    run(async () => {
      const { department, semester, guardianName, guardianPhone, address, status } = detail;
      await api.put(`/students/${detail._id}`, { department, semester: Number(semester), guardianName, guardianPhone, address, status });
      setDetail(null); reload();
    });
  };

  return (
    <div>
      <PageHeader title="Students" subtitle="Accounts, profiles and room allocation.">
        {Picker}
        <input className="input !w-48" placeholder="Search name / reg no." aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={alloc} onChange={setAlloc} placeholder="All allocation" options={["allocated", "not_allocated", "vacated"]} />
        <ExportButton type="students" params={{ hostel: hostelId }} />
        <Button variant="gold" onClick={() => { setError(""); setAddOpen(true); }}>+ Add Student</Button>
      </PageHeader>
      <Alert>{!addOpen && !target && !detail && formError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No students found." columns={[
          { key: "name", label: "Name", render: (s) => (<div><p className="font-medium">{s.user?.name}</p><p className="text-xs text-muted">{s.user?.email}</p></div>) },
          { key: "registrationNumber", label: "Reg. No." },
          { key: "department", label: "Dept / Sem", render: (s) => `${s.department} · Sem ${s.semester}` },
          { key: "room", label: "Room", render: (s) => (s.room ? `${s.hostel?.code} · ${s.room.roomNumber}` : "—") },
          { key: "allocationStatus", label: "Allocation", render: (s) => <Badge status={s.allocationStatus} /> },
          { key: "act", label: "", render: (s) => (
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setError(""); setDetail({ ...s }); }}>Details</Button>
              {s.room ? <Button size="sm" variant="outline" onClick={() => vacate(s)}>Vacate</Button> : <Button size="sm" variant="gold" onClick={() => openAlloc(s)}>Allocate</Button>}
            </div>) },
        ]} />
        <Pagination page={page} total={total} onChange={setPage} />
      </PageState>

      <Modal open={addOpen} title="Add Student" onClose={() => setAddOpen(false)} wide>
        <form onSubmit={create} className="space-y-4">
          <p className="text-xs text-muted">This creates the login account and the student profile together. Leave password empty to use <code>Student@123</code>.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name"><input className="input" required value={form.name} onChange={set("name")} /></Field>
            <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set("email")} /></Field>
            <Field label="Password"><input className="input" type="text" minLength={6} value={form.password} onChange={set("password")} placeholder="Student@123" /></Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={set("phone")} /></Field>
            <Field label="Registration no."><input className="input" required value={form.registrationNumber} onChange={set("registrationNumber")} /></Field>
            <Field label="Department"><input className="input" required value={form.department} onChange={set("department")} /></Field>
            <Field label="Semester"><input className="input" type="number" min="1" max="12" required value={form.semester} onChange={set("semester")} /></Field>
            <Field label="Gender"><select className="input" value={form.gender} onChange={set("gender")}><option value="male">Male</option><option value="female">Female</option></select></Field>
            <Field label="Guardian name"><input className="input" value={form.guardianName} onChange={set("guardianName")} /></Field>
            <Field label="Guardian phone"><input className="input" value={form.guardianPhone} onChange={set("guardianPhone")} /></Field>
          </div>
          <Field label="Address"><input className="input" value={form.address} onChange={set("address")} /></Field>
          <Alert>{formError}</Alert>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create Student"}</Button></div>
        </form>
      </Modal>

      <Modal open={!!target} title={`Allocate room — ${target?.user?.name || ""}`} onClose={() => setTarget(null)}>
        <form onSubmit={allocate} className="space-y-4">
          <p className="text-xs text-muted">Boys can only be placed in boys' hostels and girls in girls' hostels.</p>
          <Field label="Hostel">
            <select className="input" value={allocHostel} onChange={(e) => setAllocHostel(e.target.value)}>
              {(hostelsRes.data || []).map((h) => <option key={h._id} value={h._id}>{h.name} ({h.type})</option>)}
            </select>
          </Field>
          <Field label="Available room">
            <select className="input" required value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">{rooms.loading ? "Loading…" : "Select a room"}</option>
              {(rooms.data || []).map((r) => <option key={r._id} value={r._id}>Room {r.roomNumber} · floor {r.floor} · {r.capacity - r.occupiedBeds} bed(s) free</option>)}
            </select>
          </Field>
          {rooms.data?.length === 0 && <p className="text-sm text-warning">No free rooms in this hostel.</p>}
          <Alert>{formError}</Alert>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button><Button type="submit" disabled={busy || !roomId}>{busy ? "Allocating…" : "Allocate"}</Button></div>
        </form>
      </Modal>

      <Modal open={!!detail} title="Student details" onClose={() => setDetail(null)} wide>
        {detail && (
          <form onSubmit={saveDetail} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-2">
              <p><span className="text-muted">Name:</span> {detail.user?.name}</p><p><span className="text-muted">Email:</span> {detail.user?.email}</p>
              <p><span className="text-muted">Reg. no:</span> {detail.registrationNumber}</p><p><span className="text-muted">Gender:</span> <span className="capitalize">{detail.gender}</span></p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Department"><input className="input" value={detail.department || ""} onChange={(e) => setDetail({ ...detail, department: e.target.value })} /></Field>
              <Field label="Semester"><input className="input" type="number" min="1" max="12" value={detail.semester} onChange={(e) => setDetail({ ...detail, semester: e.target.value })} /></Field>
              <Field label="Guardian name"><input className="input" value={detail.guardianName || ""} onChange={(e) => setDetail({ ...detail, guardianName: e.target.value })} /></Field>
              <Field label="Guardian phone"><input className="input" value={detail.guardianPhone || ""} onChange={(e) => setDetail({ ...detail, guardianPhone: e.target.value })} /></Field>
            </div>
            <Field label="Address"><input className="input" value={detail.address || ""} onChange={(e) => setDetail({ ...detail, address: e.target.value })} /></Field>
            <Field label="Student status"><select className="input" value={detail.status} onChange={(e) => setDetail({ ...detail, status: e.target.value })}>{["active", "suspended", "graduated", "left"].map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDetail(null)}>Close</Button><Button type="submit" disabled={busy}>Save changes</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default Students;
