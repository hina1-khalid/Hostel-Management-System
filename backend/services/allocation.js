// Room/bed bookkeeping shared by: allocating a student, vacating, changing rooms, the waiting list.
const Room = require("../models/Room");
const Hostel = require("../models/Hostel");
const RoomRequest = require("../models/RoomRequest");
const notify = require("../utils/notify");
const { fail, assertId, assertHostelAccess } = require("../utils/helpers");

const syncStatus = (room) => {
  if (["available", "full"].includes(room.status)) room.status = room.occupiedBeds >= room.capacity ? "full" : "available";
};

// Free the student's current bed. Returns the hostel it belonged to (or null).
const releaseBed = async (student) => {
  if (!student.room) return null;
  const room = await Room.findById(student.room);
  if (room) {
    room.occupiedBeds = Math.max(0, room.occupiedBeds - 1);
    syncStatus(room);
    await room.save();
    return room.hostel;
  }
  return null;
};

// A bed became free: tell the wardens if students are waiting for one in that hostel.
const onBedFreed = async (hostelId) => {
  if (!hostelId) return;
  const waiting = await RoomRequest.countDocuments({ hostel: hostelId, status: "waiting" });
  if (waiting) {
    await notify.toAdmins(hostelId, { title: "A bed is now free", message: `${waiting} student(s) are on the waiting list.`, type: "info", link: "/admin/room-requests" });
  }
};

// Put a student in a room (first allocation or a room change). Throws HttpError on any rule violation.
const allocateStudentToRoom = async (req, student, roomId) => {
  assertId(roomId, "room ID");
  if (student.status !== "active") fail(400, `Student is ${student.status}`);
  const room = await Room.findById(roomId);
  if (!room) fail(404, "Room not found");
  assertHostelAccess(req, room.hostel);
  if (student.room && String(student.room) === String(room._id)) fail(400, "Student is already in this room");
  if (room.status !== "available" || room.occupiedBeds >= room.capacity) fail(400, "Room is not available");
  const hostel = await Hostel.findById(room.hostel);
  if (hostel.type === "boys" && student.gender !== "male") fail(400, "Boys hostel cannot house a female student");
  if (hostel.type === "girls" && student.gender !== "female") fail(400, "Girls hostel cannot house a male student");

  // Atomic bed claim: fails if someone else took the last bed meanwhile
  const claimed = await Room.findOneAndUpdate(
    { _id: room._id, status: "available", occupiedBeds: { $lt: room.capacity } },
    { $inc: { occupiedBeds: 1 } },
    { new: true }
  );
  if (!claimed) fail(409, "Room just became full. Pick another room.");
  syncStatus(claimed);
  await claimed.save();
  const oldHostel = await releaseBed(student);

  student.hostel = room.hostel;
  student.room = room._id;
  student.allocationStatus = "allocated";
  student.allocatedAt = new Date();
  await student.save();
  await notify.toStudent(student._id, { title: "Room allocated", message: `You have been allocated room ${room.roomNumber} in ${hostel.name}.`, type: "success", link: "/student/room" });
  if (oldHostel) await onBedFreed(oldHostel);
  return { room, hostel };
};

module.exports = { syncStatus, releaseBed, onBedFreed, allocateStudentToRoom };
