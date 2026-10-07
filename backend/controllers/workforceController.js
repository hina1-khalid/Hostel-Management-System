const { StaffMember, StaffAttendance, Payroll } = require("../models/Workforce");
const { MessExpense } = require("../models/MessFinance");
const Hostel = require("../models/Hostel");
const { calcPayroll } = require("../services/payroll");
const { payslipPdf } = require("../utils/pdf");
const notify = require("../utils/notify");
const { wrap, fail, pick, assertId, hostelFilter, assertHostelAccess, bodyHostel, dateStr, monthStr, toDate } = require("../utils/helpers");

const ROLES = ["cook", "cleaner", "guard", "gardener", "driver", "helper", "other"];
const staffPop = (q) => q.populate("hostel", "name code");
const ymdOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");

// ---------------- Staff members ----------------
const listStaff = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  if (req.query.all !== "true") filter.isActive = true;
  if (req.query.role) filter.role = req.query.role;
  res.json(await staffPop(StaffMember.find(filter).sort({ name: 1 })));
});

const createStaff = wrap(async (req, res) => {
  const hostel = bodyHostel(req);
  if (req.body.role && !ROLES.includes(req.body.role)) fail(400, `role must be one of: ${ROLES.join(", ")}`);
  const s = await StaffMember.create({ hostel, ...pick(req.body, ["name", "role", "phone", "cnic", "joiningDate", "monthlySalary", "messStaff", "notes"]) });
  res.status(201).json(await staffPop(StaffMember.findById(s._id)));
});

const updateStaff = wrap(async (req, res) => {
  assertId(req.params.id);
  const s = await StaffMember.findById(req.params.id);
  if (!s) fail(404, "Staff member not found");
  assertHostelAccess(req, s.hostel);
  if (req.body.role && !ROLES.includes(req.body.role)) fail(400, `role must be one of: ${ROLES.join(", ")}`);
  Object.assign(s, pick(req.body, ["name", "role", "phone", "cnic", "joiningDate", "monthlySalary", "messStaff", "notes", "isActive"]));
  await s.save();
  res.json(await staffPop(StaffMember.findById(s._id)));
});

const deleteStaff = wrap(async (req, res) => {
  assertId(req.params.id);
  const s = await StaffMember.findById(req.params.id);
  if (!s) fail(404, "Staff member not found");
  assertHostelAccess(req, s.hostel);
  if ((await StaffAttendance.exists({ staff: s._id })) || (await Payroll.exists({ staff: s._id }))) fail(400, "This person has attendance or salary records. Deactivate them instead of deleting.");
  await s.deleteOne();
  res.json({ message: "Staff member deleted" });
});

// ---------------- Attendance ----------------
// GET /api/workforce/attendance?date=  -> every active worker with the status recorded for that day (null = nothing recorded = present)
const attendanceSheet = wrap(async (req, res) => {
  const date = req.query.date || dateStr();
  if (!ymdOk(date)) fail(400, "date must be YYYY-MM-DD");
  const staff = await StaffMember.find({ ...hostelFilter(req), isActive: true, joiningDate: { $lte: toDate(date) } }).populate("hostel", "name code").sort({ name: 1 });
  const marks = await StaffAttendance.find({ staff: { $in: staff.map((s) => s._id) }, date });
  const by = new Map(marks.map((m) => [String(m.staff), m.status]));
  res.json({ date, staff: staff.map((s) => ({ _id: s._id, name: s.name, role: s.role, hostel: s.hostel, status: by.get(String(s._id)) || null })) });
});

const markAttendance = wrap(async (req, res) => {
  const { date, records } = req.body;
  if (date > dateStr()) fail(400, "You cannot mark attendance for a future date");
  const staff = await StaffMember.find({ _id: { $in: records.map((r) => r.staff) } });
  const by = new Map(staff.map((s) => [String(s._id), s]));
  const ops = [];
  for (const r of records) {
    const s = by.get(String(r.staff));
    if (!s) fail(404, "Staff member not found");
    assertHostelAccess(req, s.hostel);
    if (date < dateStr(s.joiningDate)) continue; // before they joined
    ops.push({ updateOne: { filter: { staff: s._id, date }, update: { $set: { hostel: s.hostel, status: r.status, markedBy: req.user._id } }, upsert: true } });
  }
  if (!ops.length) fail(400, "Nothing to save (all selected people had not joined yet)");
  await StaffAttendance.bulkWrite(ops);
  res.status(201).json({ message: `Attendance saved for ${ops.length} person(s)`, count: ops.length });
});

// GET /api/workforce/attendance/summary?month=  -> counts of recorded absences etc. per person
const attendanceSummary = wrap(async (req, res) => {
  const month = req.query.month || monthStr();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail(400, "month must be YYYY-MM");
  const staff = await StaffMember.find({ ...hostelFilter(req), isActive: true }).sort({ name: 1 });
  const marks = await StaffAttendance.find({ staff: { $in: staff.map((s) => s._id) }, date: new RegExp(`^${month}`) });
  res.json(staff.map((s) => {
    const mine = marks.filter((m) => String(m.staff) === String(s._id));
    const n = (st) => mine.filter((m) => m.status === st).length;
    return { _id: s._id, name: s.name, role: s.role, absent: n("absent"), half_day: n("half_day"), leave: n("leave") };
  }));
});

// ---------------- Payroll ----------------
const payPop = (q) => q.populate({ path: "staff", select: "name role messStaff monthlySalary" }).populate("hostel", "name code");

// POST /api/workforce/payroll/generate { month, hostel? } -> creates/refreshes PENDING payroll for every active worker. Paid ones are untouched.
const generatePayroll = wrap(async (req, res) => {
  const { month } = req.body;
  if (month > monthStr()) fail(400, "You cannot run payroll for a future month");
  const filter = { ...hostelFilter(req), isActive: true };
  if (req.user.role === "superadmin" && req.body.hostel) filter.hostel = req.body.hostel;
  const lastDay = `${month}-31`;
  const staff = await StaffMember.find({ ...filter, joiningDate: { $lte: toDate(lastDay) } });
  let created = 0, updated = 0, skipped = 0;
  for (const s of staff) {
    const existing = await Payroll.findOne({ staff: s._id, month });
    if (existing?.status === "paid") { skipped++; continue; }
    const records = await StaffAttendance.find({ staff: s._id, date: new RegExp(`^${month}`) }).select("date status");
    const calc = calcPayroll({ monthlySalary: s.monthlySalary, joiningDate: s.joiningDate, month, records, bonus: existing?.bonus, advance: existing?.advance });
    if (existing) { Object.assign(existing, calc); await existing.save(); updated++; }
    else { await Payroll.create({ staff: s._id, hostel: s.hostel, month, ...calc }); created++; }
  }
  res.status(201).json({ message: `Payroll for ${month}: ${created} created, ${updated} refreshed, ${skipped} already paid`, created, updated, skipped });
});

const listPayroll = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  filter.month = req.query.month || monthStr();
  if (req.query.status) filter.status = req.query.status;
  const rows = await payPop(Payroll.find(filter));
  rows.sort((a, b) => (a.staff?.name || "").localeCompare(b.staff?.name || ""));
  res.json({ month: filter.month, totalNet: rows.reduce((t, r) => t + r.netSalary, 0), paid: rows.filter((r) => r.status === "paid").reduce((t, r) => t + r.netSalary, 0), rows });
});

// PUT /api/workforce/payroll/:id { bonus?, advance?, note? }  (pending only)
const adjustPayroll = wrap(async (req, res) => {
  assertId(req.params.id);
  const p = await Payroll.findById(req.params.id);
  if (!p) fail(404, "Payroll record not found");
  assertHostelAccess(req, p.hostel);
  if (p.status === "paid") fail(400, "A paid salary cannot be changed");
  const staff = await StaffMember.findById(p.staff);
  const records = await StaffAttendance.find({ staff: p.staff, date: new RegExp(`^${p.month}`) }).select("date status");
  const bonus = req.body.bonus ?? p.bonus, advance = req.body.advance ?? p.advance;
  Object.assign(p, calcPayroll({ monthlySalary: staff.monthlySalary, joiningDate: staff.joiningDate, month: p.month, records, bonus, advance }));
  if (req.body.note !== undefined) p.note = req.body.note;
  await p.save();
  res.json(await payPop(Payroll.findById(p._id)));
});

// POST /api/workforce/payroll/:id/pay { paymentMethod? }
const payPayroll = wrap(async (req, res) => {
  assertId(req.params.id);
  const p = await Payroll.findById(req.params.id);
  if (!p) fail(404, "Payroll record not found");
  assertHostelAccess(req, p.hostel);
  if (p.status === "paid") fail(400, "Already paid");
  const method = req.body.paymentMethod || "cash";
  if (!["cash", "bank_transfer", "easypaisa", "jazzcash"].includes(method)) fail(400, "Invalid payment method");
  const staff = await StaffMember.findById(p.staff);
  p.status = "paid"; p.paidDate = new Date(); p.paymentMethod = method;
  await p.save();
  // a cook's salary is part of what the mess costs to run
  if (staff?.messStaff && p.netSalary > 0 && !(await MessExpense.exists({ payroll: p._id }))) {
    await MessExpense.create({ hostel: p.hostel, date: dateStr(), category: "staff", description: `Salary ${staff.name} (${p.month})`, amount: p.netSalary, source: "payroll", payroll: p._id, createdBy: req.user._id });
  }
  res.json(await payPop(Payroll.findById(p._id)));
});

// GET /api/workforce/payroll/:id/payslip -> PDF
const payslip = wrap(async (req, res) => {
  assertId(req.params.id);
  const p = await Payroll.findById(req.params.id);
  if (!p) fail(404, "Payroll record not found");
  assertHostelAccess(req, p.hostel);
  const [staff, hostel] = await Promise.all([StaffMember.findById(p.staff), Hostel.findById(p.hostel)]);
  const doc = payslipPdf(p, staff, hostel);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="payslip-${staff.name.replace(/[^a-z0-9]+/gi, "-")}-${p.month}.pdf"`);
  doc.pipe(res);
  doc.end();
});

module.exports = { listStaff, createStaff, updateStaff, deleteStaff, attendanceSheet, markAttendance, attendanceSummary, generatePayroll, listPayroll, adjustPayroll, payPayroll, payslip };
