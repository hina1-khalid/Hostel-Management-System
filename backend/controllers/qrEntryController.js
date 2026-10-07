const QrEntry = require("../models/QrEntry");
const Student = require("../models/Student");
const Leave = require("../models/Leave");
const notify = require("../utils/notify");
const { wrap, fail, hostelFilter, assertId, myStudent, hourNow, paginate, setTotal, dateStr } = require("../utils/helpers");

const CURFEW_HOUR = Number(process.env.CURFEW_HOUR || 22); // entries from 10 PM until 5 AM are "late"
const isLate = () => { const h = hourNow(); return h >= CURFEW_HOUR || h < 5; };

const populate = (q) =>
  q.populate({ path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } })
    .populate("hostel", "name code").populate("scannedBy", "name");

// POST /api/qr-entries/scan { studentId | registrationNumber | qr, type? }
// The QR payload is "HMS|<registrationNumber>"; type is auto-toggled when omitted.
const scanQr = wrap(async (req, res) => {
  let code = (req.body.qr || req.body.studentId || req.body.registrationNumber || "").trim();
  if (!code) fail(400, "Scan or enter a student ID / registration number");
  if (code.startsWith("HMS|")) code = code.slice(4);

  // A digital leave pass: "HMS|LEAVE|<leaveId>" (shown to the student once the warden approves a leave)
  let leave = null, student;
  if (code.startsWith("LEAVE|")) {
    const leaveId = code.slice(6);
    if (!/^[a-f\d]{24}$/i.test(leaveId)) fail(400, "Invalid leave pass");
    leave = await Leave.findById(leaveId);
    if (!leave) fail(404, "Leave pass not found");
    if (leave.status !== "approved") fail(400, `This leave request is ${leave.status}, not approved`);
    const today = dateStr(), from = dateStr(leave.fromDate), to = dateStr(leave.toDate);
    if (today < from || today > to) fail(400, `This leave pass is valid only from ${from} to ${to}`);
    student = await Student.findById(leave.student);
  } else {
    student = /^[a-f\d]{24}$/i.test(code) ? await Student.findById(code) : await Student.findOne({ registrationNumber: code });
  }
  if (!student) fail(404, "Student not found");
  if (student.status !== "active") fail(403, `Student is ${student.status}`);
  if (!student.hostel) fail(400, "Student has no hostel allocation");

  let type = req.body.type;
  if (!type) {
    const last = await QrEntry.findOne({ student: student._id }).sort({ timestamp: -1 });
    type = last && last.type === "exit" ? "entry" : "exit";
  }
  if (!["entry", "exit"].includes(type)) fail(400, "type must be entry or exit");

  const late = type === "entry" && isLate() && !leave; // coming back on a leave pass is never "late"
  const entry = await QrEntry.create({
    student: student._id, hostel: student.hostel, type, scannedBy: req.user._id, isLateEntry: late, remarks: leave ? "Leave pass" : req.body.remarks,
  });
  if (late) {
    await notify.toStudent(student._id, { title: "Late entry recorded", message: "You entered the hostel after curfew.", type: "warning" });
    await notify.toAdmins(student.hostel, { title: "Late entry", message: `Student ${student.registrationNumber} entered after curfew.`, type: "warning", link: "/admin/entry-logs" });
  }
  const approvedLeave = leave || (type === "exit" ? await Leave.exists({ student: student._id, status: "approved", fromDate: { $lte: new Date() }, toDate: { $gte: new Date() } }) : null);
  res.status(201).json({
    ...(await populate(QrEntry.findById(entry._id))).toJSON(),
    onApprovedLeave: !!approvedLeave,
    leavePass: leave ? { from: leave.fromDate, to: leave.toDate, leaveType: leave.leaveType, reason: leave.reason } : undefined,
  });
});

const getQrEntries = wrap(async (req, res) => {
  const filter = req.user.role === "security" && req.user.hostel ? { hostel: req.user.hostel } : hostelFilter(req);
  if (req.query.type) filter.type = req.query.type;
  if (req.query.late === "true") filter.isLateEntry = true;
  if (req.query.date) {
    const start = new Date(`${req.query.date}T00:00:00+05:00`);
    filter.timestamp = { $gte: start, $lt: new Date(start.getTime() + 86400000) };
  }
  const { limit, skip } = paginate(req, 25);
  await setTotal(res, QrEntry, filter);
  res.json(await populate(QrEntry.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit)));
});

const getMyEntryHistory = wrap(async (req, res) => {
  const s = await myStudent(req);
  res.json(await populate(QrEntry.find({ student: s._id }).sort({ timestamp: -1 }).limit(100)));
});

const getStudentEntryHistory = wrap(async (req, res) => {
  assertId(req.params.studentId, "student ID");
  res.json(await populate(QrEntry.find({ student: req.params.studentId }).sort({ timestamp: -1 }).limit(100)));
});

module.exports = { scanQr, getQrEntries, getMyEntryHistory, getStudentEntryHistory };
