import React, { useState } from "react";
import useFetch, { useAction } from "../../hooks/useFetch";
import api from "../../api/axios";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import { Alert, Button, Card, PageHeader, PageState } from "../../components/ui";
import { fmtDate, todayISO } from "../../utils/format";

const MyLaundry = () => {
  const [date, setDate] = useState(todayISO());
  const slots = useFetch(`/laundry/slots?date=${date}`);
  const mine = useFetch("/laundry/bookings/me");
  const { run, busy, error: actionError } = useAction();
  const refresh = () => { slots.reload(); mine.reload(); };
  const book = (s) => run(async () => { await api.post("/laundry/bookings", { slot: s._id }); refresh(); });
  const cancel = (b) => run(async () => { await api.delete(`/laundry/bookings/${b._id}`); refresh(); });

  return (
    <div>
      <PageHeader title="Laundry" subtitle="Reserve a washer or dryer. One booking per day."><input type="date" className="input !w-auto" aria-label="Date" min={todayISO()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></PageHeader>
      <div className="mb-3"><Alert>{actionError}</Alert></div>
      <Card title={`Available slots — ${fmtDate(date)}`} className="mb-6">
        <PageState loading={slots.loading} error={slots.error} onRetry={slots.reload}>
          {slots.data?.length === 0 ? <p className="text-sm text-muted">No slots published for this date.</p> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {slots.data?.map((s) => (
                <div key={s._id} className={`border rounded-md p-3 ${s.isBooked ? "bg-slate-50 border-slate-200" : "border-gold/40"}`}>
                  <p className="text-xs text-muted capitalize">{s.machine?.name} · {s.machine?.type}</p>
                  <p className="font-display text-lg">{s.startTime} – {s.endTime}</p>
                  {s.isBooked ? <Badge status="booked" /> : <Button size="sm" variant="gold" className="mt-1" disabled={busy} onClick={() => book(s)}>Book</Button>}
                </div>
              ))}
            </div>
          )}
        </PageState>
      </Card>
      <h3 className="font-display text-lg mb-3">My bookings</h3>
      <PageState loading={mine.loading} error={mine.error} onRetry={mine.reload}>
        <DataTable rows={mine.data} emptyText="You haven't booked any slots." columns={[
          { key: "date", label: "Date", render: (b) => fmtDate(b.date) },
          { key: "slot", label: "Time", render: (b) => `${b.slot?.startTime} – ${b.slot?.endTime}` },
          { key: "machine", label: "Machine", render: (b) => b.machine?.name },
          { key: "status", label: "Status", render: (b) => <Badge status={b.status} /> },
          { key: "act", label: "", render: (b) => b.status === "booked" && <Button size="sm" variant="outline" onClick={() => cancel(b)}>Cancel</Button> },
        ]} />
      </PageState>
    </div>
  );
};
export default MyLaundry;
