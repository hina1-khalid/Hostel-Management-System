import React, { useEffect, useState } from "react";
import useFetch from "../../hooks/useFetch";
import DataTable from "../../components/DataTable";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import Badge from "../../components/Badge";
import { PageHeader, PageState, Select } from "../../components/ui";
import { fmtDateTime, nameOf } from "../../utils/format";

// Shared by admins and security staff
const EntryLogs = () => {
  const [type, setType] = useState("");
  const [late, setLate] = useState(false);
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [type, late, date]);
  const params = new URLSearchParams({ limit: PAGE_SIZE, page });
  if (type) params.set("type", type);
  if (late) params.set("late", "true");
  if (date) params.set("date", date);
  const { data, total, loading, error, reload } = useFetch(`/qr-entries?${params}`);

  return (
    <div>
      <PageHeader title="Entry Logs" subtitle="Gate entries and exits recorded by security.">
        <input type="date" className="input !w-auto" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select value={type} onChange={setType} placeholder="Entry & exit" options={["entry", "exit"]} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} /> Late entries only</label>
      </PageHeader>
      <PageState loading={loading} error={error} onRetry={reload}>
        <DataTable rows={data} emptyText="No entries match these filters." columns={[
          { key: "student", label: "Student", render: (l) => (<div><p className="font-medium">{nameOf(l.student)}</p><p className="text-xs text-muted">{l.student?.registrationNumber}</p></div>) },
          { key: "type", label: "Type", render: (l) => <Badge status={l.type} /> },
          { key: "timestamp", label: "Time", render: (l) => fmtDateTime(l.timestamp) },
          { key: "isLateEntry", label: "Late?", render: (l) => (l.isLateEntry ? <Badge status="late" /> : "—") },
          { key: "hostel", label: "Hostel", render: (l) => l.hostel?.code },
          { key: "scannedBy", label: "Guard", render: (l) => l.scannedBy?.name },
        ]} />
        <Pagination page={page} total={total} onChange={setPage} />
      </PageState>
    </div>
  );
};
export default EntryLogs;
