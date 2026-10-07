import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Field, Modal, PageHeader, PageState, Tabs } from "../../components/ui";
import { fmtDate, nameOf } from "../../utils/format";

const RoomRequests = () => {
  const { data, loading, error, reload } = useFetch("/room-requests");
  const [tab, setTab] = useState("waiting");
  const [target, setTarget] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [remarks, setRemarks] = useState("");
  const rooms = useFetch(target ? `/rooms/available/${target.hostel._id}` : null);
  const { run, busy, error: formError, setError } = useAction();

  const all = data || [];
  const waiting = all.filter((r) => r.status === "waiting");
  const pending = all.filter((r) => r.status === "pending");
  const history = all.filter((r) => !["waiting", "pending"].includes(r.status)).reverse();
  const rows = { waiting, pending, history }[tab];

  const open = (r) => { setError(""); setRemarks(""); setRoomId(r.requestedRoom?._id || ""); setTarget(r); };
  const decide = (status) => run(async () => {
    await api.put(`/room-requests/${target._id}/decision`, { status, roomId: roomId || undefined, remarks: remarks || undefined });
    setTarget(null); reload();
  });

  return (
    <div>
      <PageHeader title="Room Requests" subtitle="Room-change requests from students and the waiting list for students who don't have a room yet (first come, first served)." />
      <Tabs value={tab} onChange={setTab} tabs={[["waiting", `Waiting list (${waiting.length})`], ["pending", `Change requests (${pending.length})`], ["history", "History"]]} />
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={rows} emptyText={tab === "waiting" ? "Nobody is waiting for a room." : tab === "pending" ? "No pending change requests." : "No past requests."} columns={[
          ...(tab === "waiting" ? [{ key: "pos", label: "#", render: (r) => waiting.indexOf(r) + 1 }] : []),
          { key: "student", label: "Student", render: (r) => (<div><p className="font-medium">{nameOf(r.student)}</p><p className="text-xs text-muted">{r.student?.registrationNumber}</p></div>) },
          { key: "hostel", label: "Hostel", render: (r) => r.hostel?.name },
          { key: "room", label: "Room", render: (r) => (r.type === "change" ? `${r.currentRoom?.roomNumber || "—"} → ${r.requestedRoom?.roomNumber || "any"}` : "No room yet") },
          { key: "reason", label: "Reason", render: (r) => <span className="line-clamp-2 max-w-xs">{r.reason}</span> },
          { key: "createdAt", label: "Requested", render: (r) => fmtDate(r.createdAt) },
          { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
          { key: "act", label: "", render: (r) => ["waiting", "pending"].includes(r.status) && <Button size="sm" variant="gold" onClick={() => open(r)}>{r.status === "waiting" ? "Allocate" : "Review"}</Button> },
        ]} />
      </PageState>

      <Modal open={!!target} title={target?.status === "waiting" ? "Allocate a room" : "Review room change"} onClose={() => setTarget(null)}>
        {target && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><strong>{nameOf(target.student)}</strong> ({target.student?.registrationNumber}) · {target.hostel?.name}</p>
              <p className="text-muted">{target.reason}</p>
            </div>
            <Field label={target.type === "change" ? "Move to room" : "Allocate room"}>
              <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">{rooms.loading ? "Loading…" : "Select a room"}</option>
                {(rooms.data || []).filter((r) => r._id !== target.currentRoom?._id).map((r) => <option key={r._id} value={r._id}>Room {r.roomNumber} · floor {r.floor} · {r.capacity - r.occupiedBeds} bed(s) free</option>)}
              </select>
            </Field>
            {rooms.data?.length === 0 && <p className="text-sm text-warning">No free rooms in this hostel right now.</p>}
            <Field label="Remarks (optional)"><input className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
            <Alert>{formError}</Alert>
            <div className="flex justify-end gap-2">
              <Button variant="danger" disabled={busy} onClick={() => decide("rejected")}>Reject</Button>
              <Button disabled={busy || !roomId} onClick={() => decide("approved")}>{target.status === "waiting" ? "Allocate" : "Approve & move"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default RoomRequests;
