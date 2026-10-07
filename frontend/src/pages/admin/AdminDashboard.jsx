import React from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useFetch from "../../hooks/useFetch";
import useHostelPicker from "../../hooks/useHostelPicker";
import { useAuth } from "../../context/AuthContext";
import StatCard from "../../components/StatCard";
import { Card, PageHeader, PageState } from "../../components/ui";
import { money } from "../../utils/format";

const COLORS = ["#C9A227", "#16213E", "#2F855A", "#C0392B", "#64748B", "#B7791F", "#1F2E52", "#DDBE5C"];

const AdminDashboard = () => {
  const { user } = useAuth();
  const { hostelId, Picker } = useHostelPicker({ allowAll: true });
  const q = hostelId ? `?hostel=${hostelId}` : "";
  const summary = useFetch(`/dashboard/summary${q}`);
  const fees = useFetch(`/dashboard/fee-chart${q}`);
  const occ = useFetch(`/dashboard/occupancy-chart${q}`);
  const cmp = useFetch(`/dashboard/complaint-stats${q}`);
  const s = summary.data;

  return (
    <div>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="Here is what is happening across your hostel today.">{Picker}</PageHeader>
      <PageState loading={summary.loading} error={summary.error} onRetry={summary.reload}>
        {s && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <StatCard label="Students" value={s.totalStudents} hint={`${s.allocatedStudents} allocated · ${s.unallocatedStudents} waiting`} />
              <StatCard label="Occupancy" value={`${s.occupancyRate}%`} hint={`${s.occupiedBeds} of ${s.totalBeds} beds`} accent />
              <StatCard label="Rooms" value={s.totalRooms} hint={`${s.availableBeds} beds free`} />
              <StatCard label="Hostels" value={s.totalHostels} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <StatCard label="Fees collected" value={money(s.totalFeesCollected)} accent />
              <StatCard label="Fees pending" value={money(s.pendingFeesAmount)} />
              <StatCard label="Fees overdue" value={money(s.overdueFeesAmount)} />
              <StatCard label="Open complaints" value={s.pendingComplaints} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Pending leaves" value={s.pendingLeaves} />
              <StatCard label="Visitors today" value={s.visitorsToday} hint={`${s.awaitingVisitors} awaiting approval`} />
              <StatCard label="Gate entries today" value={s.entriesToday} />
              <StatCard label="Late entries today" value={s.lateEntriesToday} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Link to="/admin/maintenance"><StatCard label="Maintenance overdue" value={s.maintenanceOverdue} accent={s.maintenanceOverdue > 0} hint="Open Maintenance" /></Link>
              <Link to="/admin/mess"><StatCard label="Low stock items" value={s.lowStockItems} accent={s.lowStockItems > 0} hint="Open Mess → Stock" /></Link>
            </div>
          </>
        )}
      </PageState>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Fees — last 6 months">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fees.data || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} />
                <Tooltip formatter={(v) => money(v)} /><Legend />
                <Bar dataKey="collected" name="Collected" fill="#2F855A" radius={[3, 3, 0, 0]} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#C9A227" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Bed occupancy by hostel">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occ.data || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="code" fontSize={12} /><YAxis fontSize={12} allowDecimals={false} />
                <Tooltip /><Legend />
                <Bar dataKey="occupiedBeds" name="Occupied" stackId="a" fill="#16213E" />
                <Bar dataKey="availableBeds" name="Available" stackId="a" fill="#DDBE5C" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Complaints by status" action={<Link to="/admin/complaints" className="text-xs text-gold-dark hover:underline">View all</Link>}>
          <div className="h-64">
            {cmp.data?.total ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cmp.data.byStatus} dataKey="value" nameKey="name" outerRadius={85} label>
                    {cmp.data.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="h-full flex items-center justify-center text-sm text-muted">No complaints yet.</p>}
          </div>
        </Card>
        <Card title="Complaints by category">
          <div className="h-64">
            {cmp.data?.total ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cmp.data.byCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} /><YAxis type="category" dataKey="name" width={80} fontSize={12} />
                  <Tooltip /><Bar dataKey="value" fill="#C9A227" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="h-full flex items-center justify-center text-sm text-muted">No complaints yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};
export default AdminDashboard;
