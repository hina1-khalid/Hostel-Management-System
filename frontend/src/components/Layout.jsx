import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Seal from "./Seal";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "./GlobalSearch";
import ChatbotWidget from "./ChatbotWidget";

const adminNav = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/hostels", label: "Hostels", only: ["superadmin"] },
  { to: "/admin/rooms", label: "Rooms" },
  { to: "/admin/students", label: "Students" },
  { to: "/admin/room-requests", label: "Room Requests" },
  { to: "/admin/fees", label: "Fees" },
  { to: "/admin/attendance", label: "Attendance" },
  { to: "/admin/leaves", label: "Leave Requests" },
  { to: "/admin/complaints", label: "Complaints" },
  { to: "/admin/visitors", label: "Visitors" },
  { to: "/admin/entry-logs", label: "Entry Logs" },
  { to: "/admin/notices", label: "Notices" },
  { to: "/admin/mess", label: "Mess" },
  { to: "/admin/laundry", label: "Laundry" },
  { to: "/admin/inventory", label: "Inventory" },
  { to: "/admin/maintenance", label: "Maintenance" },
  { to: "/admin/payroll", label: "Payroll" },
  { to: "/admin/reports", label: "Monthly Report" },
  { to: "/admin/staff", label: "Staff" },
  { to: "/admin/audit", label: "Audit Log", only: ["superadmin"] },
  { to: "/admin/profile", label: "My Profile" },
];

const navByRole = {
  superadmin: adminNav,
  admin: adminNav,
  student: [
    { to: "/student", label: "Dashboard", end: true },
    { to: "/student/room", label: "My Room & QR" },
    { to: "/student/room-requests", label: "Room Requests" },
    { to: "/student/fees", label: "Fees" },
    { to: "/student/attendance", label: "Attendance" },
    { to: "/student/complaints", label: "Complaints" },
    { to: "/student/leaves", label: "Leave" },
    { to: "/student/visitors", label: "Visitors" },
    { to: "/student/mess", label: "Mess" },
    { to: "/student/laundry", label: "Laundry" },
    { to: "/student/notices", label: "Notices" },
    { to: "/student/profile", label: "My Profile" },
  ],
  security: [
    { to: "/security", label: "Scan Entry", end: true },
    { to: "/security/visitors", label: "Visitors" },
    { to: "/security/logs", label: "Entry Logs" },
    { to: "/security/notices", label: "Notices" },
    { to: "/security/profile", label: "My Profile" },
  ],
};

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const links = (navByRole[user?.role] || []).filter((l) => !l.only || l.only.includes(user.role));
  const current = links.find((l) => (l.end ? pathname === l.to : pathname.startsWith(l.to)));
  const staff = user.role !== "student";

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="min-h-screen flex bg-paper">
      {menu && <div className="fixed inset-0 bg-ink/50 z-30 lg:hidden" onClick={() => setMenu(false)} />}
      <aside className={`print:hidden fixed lg:static inset-y-0 left-0 z-40 w-64 bg-ink flex flex-col shrink-0 transition-transform ${menu ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-2.5 px-6 py-6 border-b border-white/10">
          <Seal small />
          <span className="font-display text-white text-base leading-tight">Hostel MS</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenu(false)}
              className={({ isActive }) => `block px-3 py-2 rounded-md text-sm transition ${isActive ? "bg-gold text-ink font-medium" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-white/50 text-xs capitalize">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-md text-sm text-white/70 hover:bg-white/5 hover:text-white transition">Sign out</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="print:hidden h-16 bg-white border-b border-slate-200 flex items-center gap-3 px-4 sm:px-8 shrink-0">
          <button className="lg:hidden p-2 -ml-2" onClick={() => setMenu(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="font-display text-xl text-ink truncate">{current?.label || "Hostel Management"}</h1>
          <div className="flex-1" />
          {staff && <div className="hidden md:block flex-1 max-w-xs"><GlobalSearch /></div>}
          <NotificationBell />
        </header>
        <main className="flex-1 p-4 sm:p-8 overflow-auto print:p-0 print:overflow-visible"><Outlet /></main>
      </div>
      <ChatbotWidget />
    </div>
  );
};
export default Layout;
