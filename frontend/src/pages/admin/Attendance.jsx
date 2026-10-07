import React, { useEffect, useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import { Alert, Button, PageHeader, PageState, Select } from "../../components/ui";
import ExportButton from "../../components/ExportButton";
import { todayISO } from "../../utils/format";

const OPTIONS = [["present", "Present", "bg-success text-white"], ["late", "Late", "bg-warning text-white"], ["absent", "Absent", "bg-danger text-white"]];

const Attendance = () => {
  const { hostelId, Picker } = useHostelPicker();
  const [date, setDate] = useState(todayISO());
  const [session, setSession] = useState("night");
  const { data, loading, error, reload } = useFetch(hostelId ? `/attendance/sheet?hostel=${hostelId}&date=${date}&session=${session}` : null);
  const [marks, setMarks] = useState({});
  const [saved, setSaved] = useState("");
  const { run, busy, error: saveError } = useAction();

  useEffect(() => {
    if (data) setMarks(Object.fromEntries(data.students.filter((s) => s.status).map((s) => [s._id, s.status])));
    setSaved("");
  }, [data]);

  const markAll = (status) => setMarks(Object.fromEntries((data?.students || []).map((s) => [s._id, status])));
  const save = () => run(async () => {
    const records = Object.entries(marks).map(([student, status]) => ({ student, status }));
    const { data: r } = await api.post("/attendance/bulk", { date, session, records });
    setSaved(r.message);
    reload();
  });
  const unmarked = (data?.students || []).filter((s) => !marks[s._id]).length;

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark hostel roll call for a session.">
        {Picker}
        <input type="date" className="input !w-auto" aria-label="Date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        <Select value={session} onChange={setSession} options={["morning", "evening", "night"]} />
        <ExportButton type="attendance" params={{ hostel: hostelId, month: date.slice(0, 7) }} label="Export month" />
      </PageHeader>
      <div className="space-y-3 mb-3"><Alert type="success">{saved}</Alert><Alert>{saveError}</Alert></div>
      <PageState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Button size="sm" variant="outline" onClick={() => markAll("present")}>Mark all present</Button>
              <span className="text-sm text-muted">{unmarked} not marked yet</span>
              <div className="flex-1" />
              <Button onClick={save} disabled={busy || Object.keys(marks).length === 0}>{busy ? "Saving…" : "Save attendance"}</Button>
            </div>
            <DataTable rows={data.students} emptyText="No allocated students in this hostel." columns={[
              { key: "name", label: "Student", render: (s) => <span className="font-medium">{s.name}</span> },
              { key: "registrationNumber", label: "Reg. No." },
              { key: "room", label: "Room" },
              { key: "mark", label: "Status", render: (s) => (
                <div className="flex gap-1.5" role="group" aria-label={`Attendance for ${s.name}`}>
                  {OPTIONS.map(([val, label, on]) => (
                    <button key={val} onClick={() => setMarks({ ...marks, [s._id]: val })} aria-pressed={marks[s._id] === val}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition ${marks[s._id] === val ? `${on} border-transparent` : "bg-white border-slate-300 text-muted hover:bg-slate-50"}`}>{label}</button>
                  ))}
                </div>) },
            ]} />
          </>
        )}
      </PageState>
    </div>
  );
};
export default Attendance;
