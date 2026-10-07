const Leave = require("../models/Leave");
const notify = require("../utils/notify");
const { wrap, fail, assertId, hostelFilter, assertHostelAccess, myStudent, paginate } = require("../utils/helpers");

const populate = (q) =>
  q.populate({ path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } }).populate("approvedBy", "name");

const applyLeave = wrap(async (req, res) => {
  const { reason, fromDate, toDate, leaveType, contactDuringLeave } = req.body;
  if (!reason || !fromDate || !toDate) fail(400, "reason, fromDate and toDate are required");
  const from = new Date(fromDate), to = new Date(toDate);
  if (isNaN(from) || isNaN(to)) fail(400, "Invalid dates");
  if (to < from) fail(400, "toDate cannot be before fromDate");
  const student = await myStudent(req);
  if (!student.hostel) fail(400, "You need an allocated room to apply for leave");
  const overlap = await Leave.exists({ student: student._id, status: { $in: ["pending", "approved"] }, fromDate: { $lte: to }, toDate: { $gte: from } });
  if (overlap) fail(400, "You already have a pending/approved leave overlapping these dates");
  const leave = await Leave.create({ student: student._id, hostel: student.hostel, reason, fromDate: from, toDate: to, leaveType, contactDuringLeave });
  await notify.toAdmins(student.hostel, { title: "New leave request", message: `${student.registrationNumber}: ${reason.slice(0, 60)}`, link: "/admin/leaves" });
  res.status(201).json(await populate(Leave.findById(leave._id)));
});

const getLeaves = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  if (req.query.status) filter.status = req.query.status;
  const { limit, skip } = paginate(req);
  res.json(await populate(Leave.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)));
});

const getMyLeaves = wrap(async (req, res) => {
  const s = await myStudent(req);
  res.json(await populate(Leave.find({ student: s._id }).sort({ createdAt: -1 })));
});

const decideLeave = wrap(async (req, res) => {
  assertId(req.params.id);
  const { status, approvalRemarks } = req.body;
  if (!["approved", "rejected"].includes(status)) fail(400, "status must be approved or rejected");
  const leave = await Leave.findById(req.params.id);
  if (!leave) fail(404, "Leave request not found");
  assertHostelAccess(req, leave.hostel);
  if (leave.status !== "pending") fail(400, `Leave was already ${leave.status}`);
  leave.status = status;
  leave.approvalRemarks = approvalRemarks;
  leave.approvedBy = req.user._id;
  await leave.save();
  await notify.toStudent(leave.student, { title: `Leave ${status}`, message: approvalRemarks || `Your leave request was ${status}.`, type: status === "approved" ? "success" : "warning", link: "/student/leaves" });
  res.json(await populate(Leave.findById(leave._id)));
});

const deleteLeave = wrap(async (req, res) => {
  assertId(req.params.id);
  const leave = await Leave.findById(req.params.id);
  if (!leave) fail(404, "Leave request not found");
  if (req.user.role === "student") {
    const s = await myStudent(req);
    if (String(s._id) !== String(leave.student)) fail(403, "Not your leave request");
    if (leave.status !== "pending") fail(400, "Only pending requests can be cancelled");
  } else {
    assertHostelAccess(req, leave.hostel);
  }
  await leave.deleteOne();
  res.json({ message: "Leave request removed" });
});

module.exports = { applyLeave, getLeaves, getMyLeaves, decideLeave, deleteLeave };
