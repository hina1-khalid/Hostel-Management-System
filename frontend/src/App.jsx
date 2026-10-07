import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { roleHome } from "./utils/format";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Hostels from "./pages/admin/Hostels";
import Rooms from "./pages/admin/Rooms";
import Students from "./pages/admin/Students";
import Fees from "./pages/admin/Fees";
import Attendance from "./pages/admin/Attendance";
import Leaves from "./pages/admin/Leaves";
import Complaints from "./pages/admin/Complaints";
import Visitors from "./pages/admin/Visitors";
import EntryLogs from "./pages/admin/EntryLogs";
import Notices from "./pages/admin/Notices";
import Mess from "./pages/admin/Mess";
import Laundry from "./pages/admin/Laundry";
import Inventory from "./pages/admin/Inventory";
import Staff from "./pages/admin/Staff";
import Reports from "./pages/admin/Reports";
import Maintenance from "./pages/admin/Maintenance";
import Payroll from "./pages/admin/Payroll";
import AuditLog from "./pages/admin/AuditLog";
import RoomRequests from "./pages/admin/RoomRequests";
import MyRoomRequests from "./pages/student/MyRoomRequests";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import StudentDashboard from "./pages/student/StudentDashboard";
import MyRoom from "./pages/student/MyRoom";
import MyFees from "./pages/student/MyFees";
import MyAttendance from "./pages/student/MyAttendance";
import MyComplaints from "./pages/student/MyComplaints";
import MyLeaves from "./pages/student/MyLeaves";
import MyVisitors from "./pages/student/MyVisitors";
import MyMess from "./pages/student/MyMess";
import MyLaundry from "./pages/student/MyLaundry";
import NoticeFeed from "./pages/student/NoticeFeed";
import SecurityScan from "./pages/security/SecurityScan";
import SecurityVisitors from "./pages/security/SecurityVisitors";

const guard = (roles, element) => <ProtectedRoute allowedRoles={roles}>{element}</ProtectedRoute>;

const Home = () => {
  const { user } = useAuth();
  return <Navigate to={user ? roleHome[user.role] : "/login"} replace />;
};

const App = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password/:token" element={<ResetPassword />} />

    <Route path="/admin" element={guard(["admin", "superadmin"], <Layout />)}>
      <Route index element={<AdminDashboard />} />
      <Route path="hostels" element={guard(["superadmin"], <Hostels />)} />
      <Route path="rooms" element={<Rooms />} />
      <Route path="students" element={<Students />} />
      <Route path="fees" element={<Fees />} />
      <Route path="attendance" element={<Attendance />} />
      <Route path="leaves" element={<Leaves />} />
      <Route path="complaints" element={<Complaints />} />
      <Route path="visitors" element={<Visitors />} />
      <Route path="entry-logs" element={<EntryLogs />} />
      <Route path="notices" element={<Notices />} />
      <Route path="mess" element={<Mess />} />
      <Route path="laundry" element={<Laundry />} />
      <Route path="inventory" element={<Inventory />} />
      <Route path="staff" element={<Staff />} />
      <Route path="reports" element={<Reports />} />
      <Route path="maintenance" element={<Maintenance />} />
      <Route path="payroll" element={<Payroll />} />
      <Route path="room-requests" element={<RoomRequests />} />
      <Route path="audit" element={guard(["superadmin"], <AuditLog />)} />
      <Route path="profile" element={<Profile />} />
    </Route>

    <Route path="/student" element={guard(["student"], <Layout />)}>
      <Route index element={<StudentDashboard />} />
      <Route path="room" element={<MyRoom />} />
      <Route path="room-requests" element={<MyRoomRequests />} />
      <Route path="fees" element={<MyFees />} />
      <Route path="attendance" element={<MyAttendance />} />
      <Route path="complaints" element={<MyComplaints />} />
      <Route path="leaves" element={<MyLeaves />} />
      <Route path="visitors" element={<MyVisitors />} />
      <Route path="mess" element={<MyMess />} />
      <Route path="laundry" element={<MyLaundry />} />
      <Route path="notices" element={<NoticeFeed />} />
      <Route path="profile" element={<Profile />} />
    </Route>

    <Route path="/security" element={guard(["security"], <Layout />)}>
      <Route index element={<SecurityScan />} />
      <Route path="visitors" element={<SecurityVisitors />} />
      <Route path="logs" element={<EntryLogs />} />
      <Route path="notices" element={<NoticeFeed />} />
      <Route path="profile" element={<Profile />} />
    </Route>

    <Route path="*" element={<Home />} />
  </Routes>
);
export default App;
