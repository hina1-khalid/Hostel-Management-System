import React, { useState } from "react";
import useFetch from "../../hooks/useFetch";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import StatCard from "../../components/StatCard";
import { PageHeader, PageState } from "../../components/ui";
import { fmtDate, monthISO } from "../../utils/format";

const MyAttendance = () => {
  const [month, setMonth] = useState(monthISO());
  const { data, loading, error, reload } = useFetch(`/attendance/me?month=${month}`);
  return (
    <div>
      <PageHeader title="My Attendance"><input type="month" className="input !w-auto" aria-label="Month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></PageHeader>
      <PageState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6 max-w-xl"><StatCard label="Present" value={data.summary.present} /><StatCard label="Late" value={data.summary.late} /><StatCard label="Absent" value={data.summary.absent} accent /></div>
            <DataTable rows={data.records} emptyText="No attendance recorded for this month." columns={[
              { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
              { key: "session", label: "Session", render: (r) => <span className="capitalize">{r.session}</span> },
              { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
              { key: "remarks", label: "Remarks", render: (r) => r.remarks || "—" },
            ]} />
          </>
        )}
      </PageState>
    </div>
  );
};
export default MyAttendance;
