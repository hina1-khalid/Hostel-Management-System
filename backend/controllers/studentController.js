const User = require("../models/User");
const Student = require("../models/Student");
const notify = require("../utils/notify");
const { wrap, fail, pick, assertId, hostelFilter, assertHostelAccess, assertOwnerOrAdmin, myStudent, paginate, setTotal } = require("../utils/helpers");
const { releaseBed, onBedFreed, allocateStudentToRoom } = require("../services/allocation");

const FIELDS = [
  "registrationNumber", "cnic", "department", "semester", "gender", "dateOfBirth", "address",
  "guardianName", "guardianRelation", "guardianPhone", "emergencyContact", "admissionDate", "status",
];
const populate = (q) => q.populate("user", "name email phone isActive").populate("hostel", "name code type").populate("room", "roomNumber floor");

// POST /api/students  — pass `user` (existing account id) OR name/email/password to create the account too
const createStudentProfile = wrap(async (req, res) => {
  let userId = req.body.user;
  let createdUser = null;
  if (!userId) {
    const { name, email, password, phone } = req.body;
    if (!name || !email) fail(400, "Provide an existing user ID or name + email (+ password) for the new student");
    if (await User.findOne({ email: email.toLowerCase() })) fail(400, "Email already registered");
    createdUser = await User.create({ name, email, password: password || "Student@123", phone, role: "student" });
    userId = createdUser._id;
  } else {
    assertId(userId, "user ID");
    const u = await User.findById(userId);
    if (!u || u.role !== "student") fail(400, "User not found or is not a student account");
    if (await Student.exists({ user: userId })) fail(400, "This user already has a student profile");
  }
  try {
    const student = await Student.create({ user: userId, ...pick(req.body, FIELDS) });
    res.status(201).json(await populate(Student.findById(student._id)));
  } catch (e) {
    if (createdUser) await createdUser.deleteOne(); // roll back the account if the profile is invalid
    throw e;
  }
});

const getStudents = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  if (req.query.allocationStatus) filter.allocationStatus = req.query.allocationStatus;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({ role: "student", $or: [{ name: rx }, { email: rx }] }).select("_id");
    filter.$or = [{ registrationNumber: rx }, { user: { $in: users.map((u) => u._id) } }];
  }
  const { limit, skip } = paginate(req, 25);
  await setTotal(res, Student, filter);
  res.json(await populate(Student.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)));
});

const getMyStudentProfile = wrap(async (req, res) => {
  const s = await myStudent(req);
  res.json(await populate(Student.findById(s._id)));
});

const getStudentById = wrap(async (req, res) => {
  assertId(req.params.id);
  const s = await populate(Student.findById(req.params.id));
  if (!s) fail(404, "Student not found");
  await assertOwnerOrAdmin(req, s._id, s.hostel?._id);
  res.json(s);
});

const updateStudent = wrap(async (req, res) => {
  assertId(req.params.id);
  const s = await Student.findById(req.params.id);
  if (!s) fail(404, "Student not found");
  if (s.hostel) assertHostelAccess(req, s.hostel);
  Object.assign(s, pick(req.body, FIELDS));
  await s.save();
  if (req.body.name || req.body.phone) await User.findByIdAndUpdate(s.user, pick(req.body, ["name", "phone"]));
  res.json(await populate(Student.findById(s._id)));
});

const deleteStudent = wrap(async (req, res) => {
  assertId(req.params.id);
  const s = await Student.findById(req.params.id);
  if (!s) fail(404, "Student not found");
  const freedHostel = await releaseBed(s);
  await User.deleteOne({ _id: s.user });
  await s.deleteOne();
  await onBedFreed(freedHostel);
  res.json({ message: "Student deleted and room released" });
});

// POST /api/students/:id/allocate-room  { roomId }
const allocateRoom = wrap(async (req, res) => {
  assertId(req.params.id);
  const student = await Student.findById(req.params.id);
  if (!student) fail(404, "Student not found");
  await allocateStudentToRoom(req, student, req.body.roomId);
  res.json({ message: "Room allocated successfully", student: await populate(Student.findById(student._id)) });
});

const vacateRoom = wrap(async (req, res) => {
  assertId(req.params.id);
  const student = await Student.findById(req.params.id);
  if (!student) fail(404, "Student not found");
  if (!student.room) fail(400, "Student has no room to vacate");
  assertHostelAccess(req, student.hostel);
  const freedHostel = await releaseBed(student);
  student.room = null;
  student.hostel = null;
  student.allocationStatus = "vacated";
  await student.save();
  await notify.toStudent(student._id, { title: "Room vacated", message: "Your hostel room has been vacated.", type: "info" });
  await onBedFreed(freedHostel);
  res.json({ message: "Room vacated successfully", student: await populate(Student.findById(student._id)) });
});

module.exports = { createStudentProfile, getStudents, getMyStudentProfile, getStudentById, updateStudent, deleteStudent, allocateRoom, vacateRoom };
