const Room = require("../models/Room");
const Student = require("../models/Student");
const { wrap, fail, pick, assertId, hostelFilter, assertHostelAccess } = require("../utils/helpers");

const FIELDS = ["hostel", "roomNumber", "floor", "capacity", "roomType", "monthlyRent", "status", "amenities"];

const { syncStatus } = require("../services/allocation");

const createRoom = wrap(async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (!data.hostel) fail(400, "Hostel is required");
  assertHostelAccess(req, data.hostel);
  delete data.status;
  res.status(201).json(await Room.create(data));
});

const getRooms = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  ["status", "floor", "roomType"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
  res.json(await Room.find(filter).populate("hostel", "name code").sort({ roomNumber: 1 }));
});

const getAvailableRooms = wrap(async (req, res) => {
  assertId(req.params.hostelId, "hostel ID");
  const rooms = await Room.find({ hostel: req.params.hostelId, status: "available" }).sort({ roomNumber: 1 });
  res.json(rooms.filter((r) => r.occupiedBeds < r.capacity));
});

const getRoomById = wrap(async (req, res) => {
  assertId(req.params.id);
  const room = await Room.findById(req.params.id).populate("hostel", "name code");
  if (!room) fail(404, "Room not found");
  const occupants = await Student.find({ room: room._id }).populate("user", "name email");
  res.json({ ...room.toJSON(), occupants });
});

const updateRoom = wrap(async (req, res) => {
  assertId(req.params.id);
  const room = await Room.findById(req.params.id);
  if (!room) fail(404, "Room not found");
  assertHostelAccess(req, room.hostel);
  const data = pick(req.body, FIELDS.filter((f) => f !== "hostel"));
  if (data.capacity !== undefined && Number(data.capacity) < room.occupiedBeds)
    fail(400, `Capacity cannot be lower than current occupancy (${room.occupiedBeds})`);
  Object.assign(room, data);
  syncStatus(room);
  await room.save();
  res.json(room);
});

const deleteRoom = wrap(async (req, res) => {
  assertId(req.params.id);
  const room = await Room.findById(req.params.id);
  if (!room) fail(404, "Room not found");
  assertHostelAccess(req, room.hostel);
  if (room.occupiedBeds > 0) fail(400, "Room still has students. Vacate them first.");
  await room.deleteOne();
  res.json({ message: "Room deleted successfully" });
});

module.exports = { createRoom, getRooms, getAvailableRooms, getRoomById, updateRoom, deleteRoom, syncStatus };
