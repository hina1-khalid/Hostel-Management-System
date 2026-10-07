const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const { wrap, fail, assertId, hostelFilter, assertHostelAccess, myStudent, dateStr, monthStr, paginate } = require("../utils/helpers");

const SESSIONS = ["morning", "evening", "night"];
const STATUSES = ["present", "absent", "late"];
const checkDateSession = (date, session) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) fail(400, "date must be YYYY-MM-DD");
  if (!SESSIONS.includes(session)) fail(400, `session must be one of ${SESSIONS.join(", ")}`);
};

const markAttendance = wrap(async (req, res) => {
  const { student: studentId, date, session, status = "present", remarks } = req.body;
  checkDateSession(date, session);
  if (!STATUSES.includes(status)) fail(400, "Invalid status");
  assertId(studentId, "student ID");
  const student = await Student.findById(studentId);
  if (!student?.hostel) fail(400, "Student not found or has no hostel");
  assertHostelAccess(req, student.hostel);
  const rec = await Attendance.findOneAndUpdate(
    { student: student._id, date, session },
    { student: student._id, hostel: student.hostel, date, session, status, remarks, markedBy: req.user._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json(rec);
});

// POST /api/attendance/bulk { date, session, records: [{ student, status }] }
const bulkMarkAttendance = wrap(async (req, res) => {
  const { date, session, records } = req.body;
  checkDateSession(date, session);
  if (!Array.isArray(records) || !records.length) fail(400, "records array is required");
  const students = await Student.find({ _id: { $in: records.map((r) => r.student) } }).select("hostel");
  const map = new Map(students.map((s) => [String(s._id), s]));
  const ops = [];
  for (const r of records) {
    const s = map.get(String(r.student));
    if (!s?.hostel) continue;
    assertHostelAccess(req, s.hostel);
    if (!STATUSES.includes(r.status || "present")) continue;
    ops.push({
      updateOne: {
        filter: { student: s._id, date, session },
        update: { $set: { hostel: s.hostel, status: r.status || "present", remarks: r.remarks, markedBy: req.user._id } },
        upsert: true,
      },
    });
  }
  if (!ops.length) fail(400, "No valid records to save");
  await Attendance.bulkWrite(ops);
  res.status(201).json({ message: `Attendance saved for ${ops.length} student(s)`, count: ops.length });
});

// GET /api/attendance/sheet?hostel=&date=&session=  -> every allocated student with their current mark
const getSheet = wrap(async (req, res) => {
  const date = req.query.date || dateStr();
  const session = req.query.session || "night";
  checkDateSession(date, session);
  const filter = { room: { $ne: null }, status: "active", ...hostelFilter(req) };
  if (!filter.hostel) fail(400, "Select a hostel");
  const students = await Student.find(filter).populate("user", "name").populate("room", "roomNumber").sort({ registrationNumber: 1 });
  const marks = await Attendance.find({ hostel: filter.hostel, date, session });
  const byStudent = new Map(marks.map((m) => [String(m.student), m.status]));
  res.json({
    date, session,
    students: students.map((s) => ({ _id: s._id, name: s.user?.name, registrationNumber: s.registrationNumber, room: s.room?.roomNumber, status: byStudent.get(String(s._id)) || null })),
  });
});

const getAttendance = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  ["date", "session", "status", "student"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
  const { limit, skip } = paginate(req);
  res.json(
    await Attendance.find(filter)
      .populate({ path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } })
      .sort({ date: -1 }).skip(skip).limit(limit)
  );
});

const getMyAttendance = wrap(async (req, res) => {
  const s = await myStudent(req);
  const month = req.query.month || monthStr();
  const records = await Attendance.find({ student: s._id, date: new RegExp(`^${month}`) }).sort({ date: -1 });
  const summary = { present: 0, absent: 0, late: 0 };
  records.forEach((r) => summary[r.status]++);
  res.json({ month, summary, records });
});

module.exports = { markAttendance, bulkMarkAttendance, getSheet, getAttendance, getMyAttendance };
