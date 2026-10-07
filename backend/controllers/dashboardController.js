const Hostel = require("../models/Hostel");
const Room = require("../models/Room");
const Student = require("../models/Student");
const Fee = require("../models/Fee");
const Complaint = require("../models/Complaint");
const Leave = require("../models/Leave");
const Visitor = require("../models/Visitor");
const QrEntry = require("../models/QrEntry");
const MaintenanceTask = require("../models/Maintenance");
const { MessStockItem } = require("../models/MessFinance");
const { wrap, hostelFilter, dateStr, monthStr } = require("../utils/helpers");

const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
const startOfToday = () => new Date(`${dateStr()}T00:00:00+05:00`);

const getDashboardSummary = wrap(async (req, res) => {
  const hf = hostelFilter(req);
  const roomFilter = hf;
  const hostelIdFilter = hf.hostel ? { _id: hf.hostel } : {};
  const today = startOfToday();
  const todayRange = { $gte: today, $lt: new Date(today.getTime() + 86400000) };
  await Fee.updateMany({ status: "pending", dueDate: { $lt: new Date() } }, { status: "overdue" });

  const [hostels, rooms, students, fees, pendingComplaints, pendingLeaves, visitorsToday, entriesToday, lateToday, awaitingVisitors, tasks, stock] = await Promise.all([
    Hostel.countDocuments(hostelIdFilter),
    Room.find(roomFilter).select("capacity occupiedBeds status"),
    Student.find(hf).select("allocationStatus status"),
    Fee.find(hf).select("status totalAmount"),
    Complaint.countDocuments({ ...hf, status: { $in: ["pending", "in_progress"] } }),
    Leave.countDocuments({ ...hf, status: "pending" }),
    Visitor.countDocuments({ ...hf, createdAt: todayRange }),
    QrEntry.countDocuments({ ...hf, timestamp: todayRange }),
    QrEntry.countDocuments({ ...hf, isLateEntry: true, timestamp: todayRange }),
    Visitor.countDocuments({ ...hf, status: "pending_approval" }),
    MaintenanceTask.find({ ...hf, isActive: true }).select("nextDueAt"),
    MessStockItem.find(hf).select("quantity minQuantity"),
  ]);
  const totalBeds = sum(rooms, (r) => r.capacity), occupiedBeds = sum(rooms, (r) => r.occupiedBeds);
  res.json({
    totalHostels: hostels,
    totalRooms: rooms.length,
    totalBeds, occupiedBeds, availableBeds: totalBeds - occupiedBeds,
    occupancyRate: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    totalStudents: students.length,
    allocatedStudents: students.filter((s) => s.allocationStatus === "allocated").length,
    unallocatedStudents: students.filter((s) => s.allocationStatus !== "allocated").length,
    totalFeesCollected: sum(fees.filter((f) => f.status === "paid"), (f) => f.totalAmount),
    pendingFeesAmount: sum(fees.filter((f) => f.status === "pending"), (f) => f.totalAmount),
    overdueFeesAmount: sum(fees.filter((f) => f.status === "overdue"), (f) => f.totalAmount),
    maintenanceOverdue: tasks.filter((t) => dateStr(t.nextDueAt) < dateStr()).length,
    lowStockItems: stock.filter((i) => i.quantity <= i.minQuantity).length,
    pendingComplaints, pendingLeaves, visitorsToday, awaitingVisitors, entriesToday, lateEntriesToday: lateToday,
  });
});

// Last 6 months: collected vs outstanding (grouped in JS so it works with any hostel filter)
const getFeeChart = wrap(async (req, res) => {
  const fees = await Fee.find(hostelFilter(req)).select("status totalAmount dueDate");
  const months = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) months.push(monthStr(new Date(d.getFullYear(), d.getMonth() - i, 15)));
  const data = months.map((m) => {
    const inMonth = fees.filter((f) => monthStr(f.dueDate) === m);
    return {
      month: m,
      collected: sum(inMonth.filter((f) => f.status === "paid"), (f) => f.totalAmount),
      outstanding: sum(inMonth.filter((f) => f.status !== "paid"), (f) => f.totalAmount),
    };
  });
  res.json(data);
});

const getOccupancyChart = wrap(async (req, res) => {
  const hf = hostelFilter(req, "_id");
  const hostels = await Hostel.find(hf.hostel ? { _id: hf.hostel } : hf._id ? { _id: hf._id } : {});
  const rooms = await Room.find({ hostel: { $in: hostels.map((h) => h._id) } }).select("hostel capacity occupiedBeds");
  res.json(
    hostels.map((h) => {
      const rs = rooms.filter((r) => String(r.hostel) === String(h._id));
      const total = sum(rs, (r) => r.capacity), occupied = sum(rs, (r) => r.occupiedBeds);
      return { hostel: h.name, code: h.code, totalBeds: total, occupiedBeds: occupied, availableBeds: total - occupied };
    })
  );
});

const getComplaintStats = wrap(async (req, res) => {
  const complaints = await Complaint.find(hostelFilter(req)).select("status category priority");
  const count = (key) => Object.entries(complaints.reduce((a, c) => ((a[c[key]] = (a[c[key]] || 0) + 1), a), {})).map(([name, value]) => ({ name, value }));
  res.json({ total: complaints.length, byStatus: count("status"), byCategory: count("category"), byPriority: count("priority") });
});

module.exports = { getDashboardSummary, getFeeChart, getOccupancyChart, getComplaintStats };
