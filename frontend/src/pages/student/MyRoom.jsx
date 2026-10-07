import React from "react";
import { QRCodeSVG } from "qrcode.react";
import useFetch from "../../hooks/useFetch";
import Badge from "../../components/Badge";
import { Card, PageHeader, PageState } from "../../components/ui";
import { fmtDate, fmtDateTime } from "../../utils/format";

const Row = ({ k, v }) => <div className="flex justify-between gap-4 py-2 text-sm border-b border-slate-100 last:border-0"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v || "—"}</dd></div>;

const MyRoom = () => {
  const { data: s, loading, error, reload } = useFetch("/students/me");
  const entries = useFetch("/qr-entries/me");
  return (
    <div>
      <PageHeader title="My Room & Gate Pass" subtitle="Show your QR code to the guard at the gate." />
      <PageState loading={loading} error={error} onRetry={reload}>
        {s && (
          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Gate pass" className="text-center">
              <div className="inline-block p-4 bg-white border border-slate-200 rounded-lg"><QRCodeSVG value={`HMS|${s.registrationNumber}`} size={180} level="M" /></div>
              <p className="font-mono text-sm mt-3">{s.registrationNumber}</p>
              <p className="text-xs text-muted">{s.user?.name}</p>
            </Card>
            <Card title="Room details">
              <dl>
                <Row k="Hostel" v={s.hostel?.name} /><Row k="Room" v={s.room?.roomNumber} /><Row k="Floor" v={s.room?.floor} />
                <Row k="Allocation" v={<Badge status={s.allocationStatus} />} /><Row k="Allocated on" v={s.allocatedAt && fmtDate(s.allocatedAt)} />
              </dl>
            </Card>
            <Card title="My profile">
              <dl>
                <Row k="Department" v={s.department} /><Row k="Semester" v={s.semester} /><Row k="Guardian" v={s.guardianName} /><Row k="Guardian phone" v={s.guardianPhone} /><Row k="Email" v={s.user?.email} />
              </dl>
            </Card>
            <Card title="Recent gate activity" className="lg:col-span-3">
              {(entries.data || []).length === 0 ? <p className="text-sm text-muted">No gate activity yet.</p> : (
                <ul className="divide-y divide-slate-100">
                  {entries.data.slice(0, 8).map((e) => (
                    <li key={e._id} className="py-2 flex items-center justify-between text-sm"><span>{fmtDateTime(e.timestamp)}</span><span className="flex gap-2"><Badge status={e.type} />{e.isLateEntry && <Badge status="late" />}</span></li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </PageState>
    </div>
  );
};
export default MyRoom;
