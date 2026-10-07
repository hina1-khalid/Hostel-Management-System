import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Card, Field, Modal, PageHeader, PageState, Tabs } from "../../components/ui";
import { fmtDate, nameOf, todayISO } from "../../utils/format";

const Machines = ({ hostelId }) => {
  const [date, setDate] = useState(todayISO());
  const machines = useFetch(`/laundry/machines${hostelId ? `?hostel=${hostelId}` : ""}`);
  const slots = useFetch(`/laundry/slots?date=${date}${hostelId ? `&hostel=${hostelId}` : ""}`);
  const [form, setForm] = useState(null);
  const [info, setInfo] = useState("");
  const { run, busy, error: actionError, setError } = useAction();

  const addMachine = (e) => {
    e.preventDefault();
    run(async () => { await api.post("/laundry/machines", { ...form, hostel: hostelId || undefined }); setForm(null); machines.reload(); });
  };
  const toggle = (m) => run(async () => { await api.put(`/laundry/machines/${m._id}`, { status: m.status === "available" ? "maintenance" : "available" }); machines.reload(); slots.reload(); });
  const remove = (m) => window.confirm(`Delete ${m.name}?`) && run(async () => { await api.delete(`/laundry/machines/${m._id}`); machines.reload(); slots.reload(); });
  const generate = (m) => run(async () => { const { data } = await api.post("/laundry/slots", { machine: m._id, date }); setInfo(`${m.name}: ${data.message}`); slots.reload(); });

  return (
    <div className="space-y-6">
      <div className="space-y-3"><Alert type="success">{info}</Alert><Alert>{!form && actionError}</Alert></div>
      <Card title="Machines" action={<Button size="sm" variant="gold" disabled={!hostelId} onClick={() => { setError(""); setForm({ name: "", type: "washer" }); }}>+ Add machine</Button>}>
        <PageState loading={machines.loading} error={machines.error} onRetry={machines.reload}>
          <DataTable rows={machines.data} emptyText={hostelId ? "No machines yet." : "Select a hostel to add machines."} columns={[
            { key: "name", label: "Machine", render: (m) => <span className="font-medium">{m.name}</span> },
            { key: "type", label: "Type", render: (m) => <span className="capitalize">{m.type}</span> },
            { key: "hostel", label: "Hostel", render: (m) => m.hostel?.code },
            { key: "status", label: "Status", render: (m) => <Badge status={m.status} /> },
            { key: "act", label: "", render: (m) => (
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => generate(m)}>Create slots for {date}</Button>
                <Button size="sm" variant="outline" onClick={() => toggle(m)}>{m.status === "available" ? "Maintenance" : "Make available"}</Button>
                <Button size="sm" variant="outline" onClick={() => remove(m)}>Delete</Button>
              </div>) },
          ]} />
        </PageState>
      </Card>
      <Card title="Slots" action={<input type="date" className="input !w-auto" aria-label="Slot date" value={date} onChange={(e) => setDate(e.target.value)} />}>
        <PageState loading={slots.loading} error={slots.error} onRetry={slots.reload}>
          <DataTable rows={slots.data} emptyText="No slots for this date. Use “Create slots” on a machine above." columns={[
            { key: "machine", label: "Machine", render: (s) => s.machine?.name },
            { key: "time", label: "Time", render: (s) => `${s.startTime} – ${s.endTime}` },
            { key: "isBooked", label: "Status", render: (s) => <Badge status={s.isBooked ? "booked" : "available"} /> },
          ]} />
        </PageState>
      </Card>
      <Modal open={!!form} title="Add machine" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={addMachine} className="space-y-4">
            <Field label="Name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Washer 2" /></Field>
            <Field label="Type"><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="washer">Washer</option><option value="dryer">Dryer</option></select></Field>
            <Alert>{actionError}</Alert>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>Add</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
};

const Bookings = ({ hostelId }) => {
  const [date, setDate] = useState("");
  const params = new URLSearchParams();
  if (hostelId) params.set("hostel", hostelId);
  if (date) params.set("date", date);
  const { data, loading, error, reload } = useFetch(`/laundry/bookings?${params}`);
  const { run, error: actionError } = useAction();
  const setStatus = (b, status) => run(async () => { await api.put(`/laundry/bookings/${b._id}/status`, { status }); reload(); });
  const cancel = (b) => run(async () => { await api.delete(`/laundry/bookings/${b._id}`); reload(); });
  return (
    <div>
      <div className="flex items-center gap-3 mb-4"><input type="date" className="input !w-auto" aria-label="Filter date" value={date} onChange={(e) => setDate(e.target.value)} />{date && <Button size="sm" variant="outline" onClick={() => setDate("")}>Clear</Button>}</div>
      <Alert>{actionError}</Alert>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No bookings." columns={[
          { key: "date", label: "Date", render: (b) => fmtDate(b.date) },
          { key: "slot", label: "Slot", render: (b) => `${b.slot?.startTime} – ${b.slot?.endTime}` },
          { key: "machine", label: "Machine", render: (b) => b.machine?.name },
          { key: "student", label: "Student", render: (b) => nameOf(b.student) },
          { key: "status", label: "Status", render: (b) => <Badge status={b.status} /> },
          { key: "act", label: "", render: (b) => b.status === "booked" && (
            <div className="flex gap-2 justify-end"><Button size="sm" variant="gold" onClick={() => setStatus(b, "completed")}>Completed</Button><Button size="sm" variant="outline" onClick={() => setStatus(b, "no_show")}>No-show</Button><Button size="sm" variant="outline" onClick={() => cancel(b)}>Cancel</Button></div>) },
        ]} />
      </PageState>
    </div>
  );
};

const Laundry = () => {
  const { hostelId, Picker } = useHostelPicker();
  const [tab, setTab] = useState("machines");
  return (
    <div>
      <PageHeader title="Laundry" subtitle="Washing machines, time slots and bookings.">{Picker}</PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[["machines", "Machines & slots"], ["bookings", "Bookings"]]} />
      {tab === "machines" ? <Machines hostelId={hostelId} /> : <Bookings hostelId={hostelId} />}
    </div>
  );
};
export default Laundry;
