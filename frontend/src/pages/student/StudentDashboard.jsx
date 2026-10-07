import React from "react";
import { Link } from "react-router-dom";
import useFetch from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import StatCard from "../../components/StatCard";
import Badge from "../../components/Badge";
import { Card, PageHeader, PageState } from "../../components/ui";
import { fmtDate, money } from "../../utils/format";

const StudentDashboard = () => {
  const { user } = useAuth();
  const profile = useFetch("/students/me");
  const fees = useFetch("/fees/me");
  const notices = useFetch("/notices/me");
  const menu = useFetch(profile.data?.hostel ? "/mess/menu" : null);
  const s = profile.data;
  const unpaid = (fees.data || []).filter((f) => f.status !== "paid");
  const due = unpaid.reduce((a, f) => a + f.totalAmount, 0);
  const today = menu.data?.days.find((d) => d.day === menu.data.today);

  return (
    <div>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} subtitle="Your hostel at a glance." />
      <PageState loading={profile.loading} error={profile.error} onRetry={profile.reload}>
        {s && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Room" value={s.room ? s.room.roomNumber : "—"} hint={s.hostel?.name || "Not allocated yet"} accent />
              <StatCard label="Allocation" value={<Badge status={s.allocationStatus} />} />
              <StatCard label="Amount due" value={money(due)} hint={`${unpaid.length} unpaid fee(s)`} />
              <StatCard label="Registration" value={<span className="text-xl font-mono">{s.registrationNumber}</span>} hint={`${s.department} · Sem ${s.semester}`} />
            </div>
            {!s.room && <div className="mb-6 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm px-4 py-3">You don't have a room yet. The hostel office will allocate one soon.</div>}
            <div className="grid lg:grid-cols-2 gap-4">
              <Card title="Upcoming dues" action={<Link to="/student/fees" className="text-xs text-gold-dark hover:underline">All fees</Link>}>
                {unpaid.length === 0 ? <p className="text-sm text-muted">Nothing due. 🎉</p> : (
                  <ul className="divide-y divide-slate-100">
                    {unpaid.slice(0, 4).map((f) => (
                      <li key={f._id} className="py-2.5 flex items-center justify-between text-sm">
                        <span><span className="capitalize">{f.feeType.replace("_", " ")}</span><span className="text-xs text-muted block">Due {fmtDate(f.dueDate)}</span></span>
                        <span className="flex items-center gap-3"><strong>{money(f.totalAmount)}</strong><Badge status={f.status} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Today's mess menu" action={<Link to="/student/mess" className="text-xs text-gold-dark hover:underline">Book meals</Link>}>
                {today && (today.breakfast || today.lunch || today.dinner) ? (
                  <dl className="text-sm space-y-2">
                    {["breakfast", "lunch", "dinner"].map((m) => <div key={m} className="flex gap-3"><dt className="w-24 capitalize text-muted">{m}</dt><dd>{today[m] || "—"}</dd></div>)}
                  </dl>
                ) : <p className="text-sm text-muted">Today's menu hasn't been published.</p>}
              </Card>
              <Card title="Latest notices" action={<Link to="/student/notices" className="text-xs text-gold-dark hover:underline">All notices</Link>} className="lg:col-span-2">
                {(notices.data || []).length === 0 ? <p className="text-sm text-muted">No notices.</p> : (
                  <ul className="divide-y divide-slate-100">
                    {notices.data.slice(0, 3).map((n) => (
                      <li key={n._id} className="py-2.5 text-sm"><span className="font-medium">{n.isPinned && "📌 "}{n.title}</span><span className="block text-muted line-clamp-1">{n.content}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </PageState>
    </div>
  );
};
export default StudentDashboard;
