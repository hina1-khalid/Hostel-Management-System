import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Card, Field, PageHeader, PageState } from "../../components/ui";
import { fmtDate, money } from "../../utils/format";

const MyRoomRequests = () => {
  const mine = useFetch("/room-requests/me");
  const options = useFetch("/room-requests/options");
  const [form, setForm] = useState({ reason: "", requestedRoom: "", hostel: "" });
  const [msg, setMsg] = useState("");
  const { run, busy, error } = useAction();
  const hasRoom = options.data?.hasRoom;
  const hasOpen = (mine.data || []).some((r) => ["pending", "waiting"].includes(r.status));

  const submit = (e) => {
    e.preventDefault();
    setMsg("");
    run(async () => {
      await api.post("/room-requests", { reason: form.reason, requestedRoom: form.requestedRoom || undefined, hostel: form.hostel || undefined });
      setForm({ reason: "", requestedRoom: "", hostel: "" });
      setMsg(hasRoom ? "Request sent to the warden." : "You are on the waiting list. You'll be notified when a room is allocated.");
      mine.reload(); options.reload();
    });
  };
  const cancel = (r) => run(async () => { await api.delete(`/room-requests/${r._id}`); mine.reload(); });

  return (
    <div>
      <PageHeader title="Room Requests" subtitle={hasRoom ? "Ask the warden to move you to another room." : "You don't have a room yet. Join the waiting list of a hostel."} />
      <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
        <Card title={hasRoom ? "Request a room change" : "Join the waiting list"}>
          <PageState loading={options.loading} error={options.error} onRetry={options.reload}>
            {hasOpen ? <p className="text-sm text-muted">You already have an open request. Cancel it first if you want to send a new one.</p> : (
              <form onSubmit={submit} className="space-y-4">
                {hasRoom ? (
                  <Field label="Preferred room (optional)">
                    <select className="input" value={form.requestedRoom} onChange={(e) => setForm({ ...form, requestedRoom: e.target.value })}>
                      <option value="">Any available room</option>
                      {options.data?.rooms.map((r) => <option key={r._id} value={r._id}>{r.hostel.code} · Room {r.roomNumber} · floor {r.floor} · {money(r.monthlyRent)}/mo · {r.freeBeds} free</option>)}
                    </select>
                  </Field>
                ) : (
                  <Field label="Hostel">
                    <select className="input" required value={form.hostel} onChange={(e) => setForm({ ...form, hostel: e.target.value })}>
                      <option value="">Select a hostel</option>
                      {options.data?.hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Reason"><textarea className="input" rows={3} required minLength={5} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={hasRoom ? "e.g. Too noisy, want to be near my friends" : "e.g. Newly admitted, need accommodation"} /></Field>
                <Alert>{error}</Alert>
                <Button type="submit" disabled={busy}>{busy ? "Sending…" : hasRoom ? "Send request" : "Join waiting list"}</Button>
              </form>
            )}
            <div className="mt-3"><Alert type="success">{msg}</Alert></div>
          </PageState>
        </Card>
        <div>
          <h3 className="font-display text-lg mb-3">My requests</h3>
          <PageState loading={mine.loading} error={mine.error} onRetry={mine.reload}>
            <DataTable rows={mine.data} emptyText="No requests yet." columns={[
              { key: "createdAt", label: "Sent", render: (r) => fmtDate(r.createdAt) },
              { key: "type", label: "Type", render: (r) => (r.type === "change" ? `Change ${r.currentRoom?.roomNumber || ""} → ${r.requestedRoom?.roomNumber || "any"}` : `Waiting list · ${r.hostel?.code}`) },
              { key: "reason", label: "Reason", render: (r) => <span className="line-clamp-2 max-w-xs">{r.reason}</span> },
              { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
              { key: "adminRemarks", label: "Warden's note", render: (r) => r.adminRemarks || "—" },
              { key: "act", label: "", render: (r) => ["pending", "waiting"].includes(r.status) && <Button size="sm" variant="outline" onClick={() => cancel(r)}>Cancel</Button> },
            ]} />
          </PageState>
        </div>
      </div>
    </div>
  );
};
export default MyRoomRequests;
