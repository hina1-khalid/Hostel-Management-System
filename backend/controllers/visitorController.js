const Visitor = require("../models/Visitor");
const Student = require("../models/Student");
const notify = require("../utils/notify");
const { wrap, fail, assertId, hostelFilter, assertHostelAccess, myStudent, paginate } = require("../utils/helpers");

const populate = (q) =>
  q.populate({ path: "student", select: "registrationNumber user room", populate: [{ path: "user", select: "name" }, { path: "room", select: "roomNumber" }] }).populate("approvedBy registeredBy", "name");

// POST /api/visitors (security) { studentId | registrationNumber, visitorName, cnic, phone, relation, purpose }
const registerVisitor = wrap(async (req, res) => {
  const { studentId, registrationNumber, visitorName, cnic } = req.body;
  if (!visitorName || !cnic) fail(400, "Visitor name and CNIC are required");
  const code = (studentId || registrationNumber || "").trim();
  if (!code) fail(400, "Student ID or registration number is required");
  const student = /^[a-f\d]{24}$/i.test(code) ? await Student.findById(code) : await Student.findOne({ registrationNumber: code });
  if (!student?.hostel) fail(404, "Student not found or not allocated to a hostel");
  const v = await Visitor.create({
    student: student._id, hostel: student.hostel, visitorName, cnic, phone: req.body.phone, relation: req.body.relation, purpose: req.body.purpose, registeredBy: req.user._id,
  });
  await notify.toStudent(student._id, { title: "Visitor at the gate", message: `${visitorName} (${req.body.relation || "visitor"}) is waiting for approval.`, type: "info", link: "/student/visitors" });
  await notify.toAdmins(student.hostel, { title: "Visitor awaiting approval", message: `${visitorName} for ${student.registrationNumber}`, link: "/admin/visitors" });
  res.status(201).json(await populate(Visitor.findById(v._id)));
});

const getVisitors = wrap(async (req, res) => {
  const filter = req.user.role === "security" && req.user.hostel ? { hostel: req.user.hostel } : hostelFilter(req);
  if (req.query.status) filter.status = req.query.status;
  const { limit, skip } = paginate(req);
  res.json(await populate(Visitor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)));
});

const getMyVisitors = wrap(async (req, res) => {
  const s = await myStudent(req);
  res.json(await populate(Visitor.find({ student: s._id }).sort({ createdAt: -1 })));
});

// Admin approves/rejects. A student may also approve/reject their own visitors.
const decideVisitor = wrap(async (req, res) => {
  assertId(req.params.id);
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) fail(400, "status must be approved or rejected");
  const v = await Visitor.findById(req.params.id);
  if (!v) fail(404, "Visitor not found");
  if (req.user.role === "student") {
    const s = await myStudent(req);
    if (String(s._id) !== String(v.student)) fail(403, "Not your visitor");
  } else assertHostelAccess(req, v.hostel);
  if (v.status !== "pending_approval") fail(400, `Visitor is already ${v.status.replace("_", " ")}`);
  v.status = status;
  v.approvedBy = req.user._id;
  await v.save();
  res.json(await populate(Visitor.findById(v._id)));
});

const checkInVisitor = wrap(async (req, res) => {
  assertId(req.params.id);
  const v = await Visitor.findById(req.params.id);
  if (!v) fail(404, "Visitor not found");
  if (v.status !== "approved") fail(400, "Only approved visitors can be checked in");
  v.status = "checked_in";
  v.entryTime = new Date();
  await v.save();
  res.json(await populate(Visitor.findById(v._id)));
});

const checkOutVisitor = wrap(async (req, res) => {
  assertId(req.params.id);
  const v = await Visitor.findById(req.params.id);
  if (!v) fail(404, "Visitor not found");
  if (v.status !== "checked_in") fail(400, "Visitor is not checked in");
  v.status = "checked_out";
  v.exitTime = new Date();
  await v.save();
  res.json(await populate(Visitor.findById(v._id)));
});

module.exports = { registerVisitor, getVisitors, getMyVisitors, decideVisitor, checkInVisitor, checkOutVisitor };
