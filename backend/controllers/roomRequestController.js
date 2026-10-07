const RoomRequest = require("../models/RoomRequest");
const Room = require("../models/Room");
const Hostel = require("../models/Hostel");
const Student = require("../models/Student");
const notify = require("../utils/notify");
const { allocateStudentToRoom } = require("../services/allocation");
const { wrap, fail, assertId, hostelFilter, assertHostelAccess, myStudent } = require("../utils/helpers");

const populate = (q) =>
  q.populate({ path: "student", select: "registrationNumber gender user", populate: { path: "user", select: "name" } })
    .populate("hostel", "name code type").populate("currentRoom", "roomNumber").populate("requestedRoom", "roomNumber floor");

const hostelTypeFor = (student) => (student.gender === "male" ? "boys" : "girls");

// GET /api/room-requests/options  (student) -> hostels + rooms the student could ask for
const options = wrap(async (req, res) => {
  const student = await myStudent(req);
  const hostels = await Hostel.find({ type: hostelTypeFor(student), isActive: true }).select("name code");
  const rooms = await Room.find({ hostel: { $in: hostels.map((h) => h._id) }, status: "available" }).populate("hostel", "name code");
  res.json({
    hostels,
    hasRoom: !!student.room,
    rooms: rooms
      .filter((r) => r.occupiedBeds < r.capacity && String(r._id) !== String(student.room))
      .map((r) => ({ _id: r._id, roomNumber: r.roomNumber, floor: r.floor, monthlyRent: r.monthlyRent, freeBeds: r.capacity - r.occupiedBeds, hostel: r.hostel })),
  });
});

// POST /api/room-requests  (student)
const createRequest = wrap(async (req, res) => {
  const student = await myStudent(req);
  if (student.status !== "active") fail(400, `Your student status is ${student.status}`);
  if (await RoomRequest.exists({ student: student._id, status: { $in: ["pending", "waiting"] } })) fail(400, "You already have an open room request");
  const { reason, requestedRoom, hostel } = req.body;

  let doc;
  if (student.room) {
    let target = null;
    if (requestedRoom) {
      target = await Room.findById(requestedRoom).populate("hostel");
      if (!target) fail(404, "Requested room not found");
      if (String(target._id) === String(student.room)) fail(400, "That is your current room");
      if (target.hostel.type !== hostelTypeFor(student)) fail(400, "You cannot request a room in that hostel");
      if (target.status !== "available" || target.occupiedBeds >= target.capacity) fail(400, "That room is not available");
    }
    doc = await RoomRequest.create({ student: student._id, hostel: student.hostel, type: "change", currentRoom: student.room, requestedRoom: target?._id, reason, status: "pending" });
  } else {
    if (!hostel) fail(400, "Choose a hostel to join its waiting list");
    const h = await Hostel.findById(hostel);
    if (!h || h.type !== hostelTypeFor(student)) fail(400, "You cannot join the waiting list of that hostel");
    doc = await RoomRequest.create({ student: student._id, hostel: h._id, type: "allocation", reason, status: "waiting" });
  }
  await notify.toAdmins(doc.hostel, {
    title: doc.type === "change" ? "Room change request" : "New student on the waiting list",
    message: `${student.registrationNumber}: ${reason.slice(0, 80)}`, link: "/admin/room-requests",
  });
  res.status(201).json(await populate(RoomRequest.findById(doc._id)));
});

const getMyRequests = wrap(async (req, res) => {
  const s = await myStudent(req);
  res.json(await populate(RoomRequest.find({ student: s._id }).sort({ createdAt: -1 })));
});

// DELETE /api/room-requests/:id  (student cancels own open request)
const cancelRequest = wrap(async (req, res) => {
  assertId(req.params.id);
  const s = await myStudent(req);
  const rr = await RoomRequest.findById(req.params.id);
  if (!rr || String(rr.student) !== String(s._id)) fail(404, "Request not found");
  if (!["pending", "waiting"].includes(rr.status)) fail(400, `Request is already ${rr.status}`);
  rr.status = "cancelled";
  await rr.save();
  res.json(rr);
});

// GET /api/room-requests?status=&type=  (admin)
const getRequests = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  ["status", "type"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
  // oldest first for the waiting list (first come, first served)
  res.json(await populate(RoomRequest.find(filter).sort({ createdAt: 1 }).limit(300)));
});

// PUT /api/room-requests/:id/decision { status: "approved"|"rejected", roomId?, remarks? }
const decide = wrap(async (req, res) => {
  assertId(req.params.id);
  const { status, roomId, remarks } = req.body;
  if (!["approved", "rejected"].includes(status)) fail(400, "status must be approved or rejected");
  const rr = await RoomRequest.findById(req.params.id);
  if (!rr) fail(404, "Request not found");
  assertHostelAccess(req, rr.hostel);
  if (!["pending", "waiting"].includes(rr.status)) fail(400, `Request is already ${rr.status}`);
  const student = await Student.findById(rr.student);
  if (!student) fail(404, "Student no longer exists");

  if (status === "approved") {
    const target = roomId || rr.requestedRoom;
    if (!target) fail(400, "Choose a room to allocate");
    if (rr.type === "allocation" && student.room) fail(400, "This student already has a room");
    if (rr.type === "change" && !student.room) fail(400, "Student has no current room to change from");
    await allocateStudentToRoom(req, student, target);
    rr.status = rr.type === "allocation" ? "fulfilled" : "approved";
  } else {
    rr.status = "rejected";
  }
  rr.adminRemarks = remarks;
  rr.decidedBy = req.user._id;
  rr.decidedAt = new Date();
  await rr.save();
  if (status === "rejected") await notify.toStudent(student._id, { title: "Room request rejected", message: remarks || "Your room request was not approved.", type: "warning", link: "/student/room-requests" });
  else await notify.toStudent(student._id, { title: "Room request approved", message: remarks || "Your room request was approved.", type: "success", link: "/student/room" });
  res.json(await populate(RoomRequest.findById(rr._id)));
});

module.exports = { options, createRequest, getMyRequests, cancelRequest, getRequests, decide };
