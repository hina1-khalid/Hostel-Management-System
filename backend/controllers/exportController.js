const ExcelJS = require("exceljs");
const Student = require("../models/Student");
const Fee = require("../models/Fee");
const Attendance = require("../models/Attendance");
const Complaint = require("../models/Complaint");
const { MessBill } = require("../models/Mess");
const { MessExpense } = require("../models/MessFinance");
const { Payroll } = require("../models/Workforce");
const { wrap, fail, hostelFilter, monthStr } = require("../utils/helpers");

const MAX_ROWS = 10000;
const d = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const dt = (v) => (v ? new Date(v).toISOString().replace("T", " ").slice(0, 16) : "");

const sendWorkbook = async (res, filename, sheetName, columns, rows) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hostel Management System";
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16 }));
  rows.forEach((r) => ws.addRow(r));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16213E" } };
  head.alignment = { vertical: "middle" };
  head.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
};

const exporters = {
  async students(req) {
    const rows = await Student.find(hostelFilter(req)).populate("user", "name email phone").populate("hostel", "name").populate("room", "roomNumber").limit(MAX_ROWS);
    return {
      sheet: "Students",
      columns: [
        { header: "Registration No.", key: "reg", width: 18 }, { header: "Name", key: "name", width: 24 }, { header: "Email", key: "email", width: 28 },
        { header: "Phone", key: "phone" }, { header: "Department", key: "dept", width: 22 }, { header: "Semester", key: "sem", width: 10 }, { header: "Gender", key: "gender", width: 10 },
        { header: "Hostel", key: "hostel", width: 22 }, { header: "Room", key: "room", width: 10 }, { header: "Allocation", key: "alloc" }, { header: "Status", key: "status" },
        { header: "Guardian", key: "guardian", width: 22 }, { header: "Guardian Phone", key: "gphone", width: 16 },
      ],
      rows: rows.map((s) => ({
        reg: s.registrationNumber, name: s.user?.name, email: s.user?.email, phone: s.user?.phone, dept: s.department, sem: s.semester, gender: s.gender,
        hostel: s.hostel?.name, room: s.room?.roomNumber, alloc: s.allocationStatus, status: s.status, guardian: s.guardianName, gphone: s.guardianPhone,
      })),
    };
  },
  async fees(req) {
    const filter = hostelFilter(req);
    ["status", "month", "feeType"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
    const rows = await Fee.find(filter).populate({ path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } }).populate("hostel", "name").sort({ dueDate: -1 }).limit(MAX_ROWS);
    return {
      sheet: "Fees",
      columns: [
        { header: "Student", key: "name", width: 24 }, { header: "Reg. No.", key: "reg", width: 16 }, { header: "Hostel", key: "hostel", width: 20 },
        { header: "Fee Type", key: "type", width: 16 }, { header: "Month", key: "month", width: 10 }, { header: "Amount", key: "amount", width: 12 }, { header: "Late Fee", key: "late", width: 10 },
        { header: "Total", key: "total", width: 12 }, { header: "Due Date", key: "due", width: 12 }, { header: "Status", key: "status", width: 10 },
        { header: "Paid On", key: "paid", width: 12 }, { header: "Method", key: "method", width: 14 }, { header: "Receipt No.", key: "receipt", width: 22 },
      ],
      rows: rows.map((f) => ({
        name: f.student?.user?.name, reg: f.student?.registrationNumber, hostel: f.hostel?.name, type: (f.feeType || "").replace(/_/g, " "), month: f.month,
        amount: f.amount, late: f.lateFee, total: f.totalAmount, due: d(f.dueDate), status: f.status, paid: d(f.paidDate), method: f.paymentMethod, receipt: f.receiptNumber,
      })),
    };
  },
  async attendance(req) {
    const month = req.query.month || monthStr();
    if (!/^\d{4}-\d{2}$/.test(month)) fail(400, "month must be YYYY-MM");
    const rows = await Attendance.find({ ...hostelFilter(req), date: new RegExp(`^${month}`) })
      .populate({ path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } }).populate("hostel", "name").sort({ date: -1 }).limit(MAX_ROWS);
    return {
      sheet: `Attendance ${month}`,
      columns: [
        { header: "Date", key: "date", width: 12 }, { header: "Session", key: "session", width: 10 }, { header: "Student", key: "name", width: 24 },
        { header: "Reg. No.", key: "reg", width: 16 }, { header: "Hostel", key: "hostel", width: 20 }, { header: "Status", key: "status", width: 10 }, { header: "Remarks", key: "remarks", width: 24 },
      ],
      rows: rows.map((a) => ({ date: a.date, session: a.session, name: a.student?.user?.name, reg: a.student?.registrationNumber, hostel: a.hostel?.name, status: a.status, remarks: a.remarks })),
    };
  },
  async complaints(req) {
    const filter = hostelFilter(req);
    ["status", "category", "priority"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
    const rows = await Complaint.find(filter).populate({ path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } })
      .populate("hostel", "name").populate("room", "roomNumber").populate("assignedTo", "name").sort({ createdAt: -1 }).limit(MAX_ROWS);
    return {
      sheet: "Complaints",
      columns: [
        { header: "Filed On", key: "filed", width: 17 }, { header: "Title", key: "title", width: 30 }, { header: "Student", key: "name", width: 22 }, { header: "Hostel", key: "hostel", width: 20 },
        { header: "Room", key: "room", width: 8 }, { header: "Category", key: "cat", width: 12 }, { header: "Priority", key: "prio", width: 10 }, { header: "Status", key: "status", width: 12 },
        { header: "Assigned To", key: "assigned", width: 18 }, { header: "Resolved On", key: "resolved", width: 17 },
      ],
      rows: rows.map((c) => ({ filed: dt(c.createdAt), title: c.title, name: c.student?.user?.name, hostel: c.hostel?.name, room: c.room?.roomNumber, cat: c.category, prio: c.priority, status: c.status, assigned: c.assignedTo?.name, resolved: dt(c.resolvedAt) })),
    };
  },
  async "mess-expenses"(req) {
    const month = req.query.month || monthStr();
    if (!/^\d{4}-\d{2}$/.test(month)) fail(400, "month must be YYYY-MM");
    const rows = await MessExpense.find({ ...hostelFilter(req), date: new RegExp(`^${month}`) }).populate("hostel", "name").sort({ date: 1 }).limit(MAX_ROWS);
    return {
      sheet: `Mess expenses ${month}`,
      columns: [{ header: "Date", key: "date", width: 12 }, { header: "Hostel", key: "hostel", width: 20 }, { header: "Category", key: "cat", width: 12 }, { header: "Description", key: "desc", width: 36 }, { header: "Paid To", key: "to", width: 20 }, { header: "Amount", key: "amount", width: 12 }],
      rows: rows.map((e) => ({ date: e.date, hostel: e.hostel?.name, cat: e.category, desc: e.description, to: e.paidTo, amount: e.amount })),
    };
  },
  async payroll(req) {
    const month = req.query.month || monthStr();
    if (!/^\d{4}-\d{2}$/.test(month)) fail(400, "month must be YYYY-MM");
    const rows = await Payroll.find({ ...hostelFilter(req), month }).populate("staff", "name role").populate("hostel", "name").limit(MAX_ROWS);
    return {
      sheet: `Payroll ${month}`,
      columns: [
        { header: "Name", key: "name", width: 22 }, { header: "Role", key: "role", width: 10 }, { header: "Hostel", key: "hostel", width: 20 }, { header: "Base Salary", key: "base", width: 12 },
        { header: "Absent", key: "absent", width: 8 }, { header: "Half Days", key: "half", width: 10 }, { header: "Unpaid Leave", key: "leave", width: 12 }, { header: "Deduction", key: "ded", width: 11 },
        { header: "Bonus", key: "bonus", width: 9 }, { header: "Advance", key: "adv", width: 9 }, { header: "Net Salary", key: "net", width: 12 }, { header: "Status", key: "status", width: 9 }, { header: "Paid On", key: "paid", width: 12 },
      ],
      rows: rows.map((p) => ({ name: p.staff?.name, role: p.staff?.role, hostel: p.hostel?.name, base: p.baseSalary, absent: p.absentDays, half: p.halfDays, leave: p.unpaidLeaveDays, ded: p.deduction, bonus: p.bonus, adv: p.advance, net: p.netSalary, status: p.status, paid: d(p.paidDate) })),
    };
  },
  async "mess-bills"(req) {
    const filter = hostelFilter(req);
    ["month", "status"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
    const rows = await MessBill.find(filter).populate({ path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } }).populate("hostel", "name").sort({ month: -1 }).limit(MAX_ROWS);
    return {
      sheet: "Mess Bills",
      columns: [
        { header: "Month", key: "month", width: 10 }, { header: "Student", key: "name", width: 24 }, { header: "Reg. No.", key: "reg", width: 16 }, { header: "Hostel", key: "hostel", width: 20 },
        { header: "Meals", key: "meals", width: 8 }, { header: "Rate/Meal", key: "rate", width: 11 }, { header: "Amount", key: "amount", width: 12 }, { header: "Status", key: "status", width: 10 }, { header: "Paid On", key: "paid", width: 12 },
      ],
      rows: rows.map((b) => ({ month: b.month, name: b.student?.user?.name, reg: b.student?.registrationNumber, hostel: b.hostel?.name, meals: b.mealsCount, rate: b.ratePerMeal, amount: b.amount, status: b.status, paid: d(b.paidDate) })),
    };
  },
};

// GET /api/export/:type   (students | fees | attendance | complaints | mess-bills | mess-expenses | payroll)
const exportData = wrap(async (req, res) => {
  const fn = exporters[req.params.type];
  if (!fn) fail(404, `Unknown export "${req.params.type}". Use: ${Object.keys(exporters).join(", ")}`);
  const { sheet, columns, rows } = await fn(req);
  await sendWorkbook(res, req.params.type, sheet, columns, rows);
});

module.exports = { exportData };
