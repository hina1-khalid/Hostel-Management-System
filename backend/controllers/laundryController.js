const { LaundryMachine, LaundrySlot, LaundryBooking } = require("../models/Laundry");
const { wrap, fail, pick, assertId, hostelFilter, assertHostelAccess, myStudent, dateStr } = require("../utils/helpers");

const checkDate = (d) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) fail(400, "date must be YYYY-MM-DD"); };
const studentPop = { path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } };

// ---------- Machines ----------
const createMachine = wrap(async (req, res) => {
  const data = pick(req.body, ["hostel", "name", "type", "status"]);
  if (req.user.role === "admin" && req.user.hostel) data.hostel = req.user.hostel;
  if (!data.hostel) fail(400, "Hostel is required");
  assertHostelAccess(req, data.hostel);
  res.status(201).json(await LaundryMachine.create(data));
});
const getMachines = wrap(async (req, res) => {
  let filter = hostelFilter(req);
  if (req.user.role === "student") filter = { hostel: (await myStudent(req)).hostel };
  res.json(await LaundryMachine.find(filter).populate("hostel", "name code").sort({ name: 1 }));
});
const updateMachine = wrap(async (req, res) => {
  assertId(req.params.id);
  const m = await LaundryMachine.findById(req.params.id);
  if (!m) fail(404, "Machine not found");
  assertHostelAccess(req, m.hostel);
  Object.assign(m, pick(req.body, ["name", "type", "status"]));
  await m.save();
  res.json(m);
});
const deleteMachine = wrap(async (req, res) => {
  assertId(req.params.id);
  const m = await LaundryMachine.findById(req.params.id);
  if (!m) fail(404, "Machine not found");
  assertHostelAccess(req, m.hostel);
  await LaundrySlot.deleteMany({ machine: m._id, isBooked: false });
  await m.deleteOne();
  res.json({ message: "Machine deleted" });
});

// ---------- Slots ----------
// POST { machine, date, slots?: [{startTime,endTime}] }  — defaults to 2-hour slots from 08:00 to 20:00
const createSlots = wrap(async (req, res) => {
  const { machine, date } = req.body;
  checkDate(date);
  assertId(machine, "machine ID");
  const m = await LaundryMachine.findById(machine);
  if (!m) fail(404, "Machine not found");
  assertHostelAccess(req, m.hostel);
  const slots = req.body.slots?.length
    ? req.body.slots
    : [8, 10, 12, 14, 16, 18].map((h) => ({ startTime: `${String(h).padStart(2, "0")}:00`, endTime: `${String(h + 2).padStart(2, "0")}:00` }));
  let created = 0;
  for (const s of slots) {
    if (!/^\d{2}:\d{2}$/.test(s.startTime) || !/^\d{2}:\d{2}$/.test(s.endTime) || s.endTime <= s.startTime) fail(400, "Invalid slot times (use HH:MM, end after start)");
    const exists = await LaundrySlot.exists({ machine: m._id, date, startTime: s.startTime });
    if (!exists) { await LaundrySlot.create({ machine: m._id, hostel: m.hostel, date, startTime: s.startTime, endTime: s.endTime }); created++; }
  }
  res.status(201).json({ message: `${created} slot(s) created`, created });
});

const getSlots = wrap(async (req, res) => {
  const date = req.query.date || dateStr();
  checkDate(date);
  let filter = hostelFilter(req);
  if (req.user.role === "student") filter = { hostel: (await myStudent(req)).hostel };
  const slots = await LaundrySlot.find({ ...filter, date }).populate("machine", "name type status").sort({ startTime: 1 });
  res.json(slots.filter((s) => s.machine && s.machine.status === "available"));
});

// ---------- Bookings ----------
const bookSlot = wrap(async (req, res) => {
  assertId(req.body.slot, "slot ID");
  const student = await myStudent(req);
  const slot = await LaundrySlot.findById(req.body.slot);
  if (!slot) fail(404, "Slot not found");
  if (String(slot.hostel) !== String(student.hostel)) fail(403, "This slot is in a different hostel");
  if (slot.date < dateStr()) fail(400, "Cannot book a past slot");
  const mine = await LaundryBooking.countDocuments({ student: student._id, date: slot.date, status: "booked" });
  if (mine >= 1) fail(400, "You already have a laundry booking on this date");
  // Atomic claim so two students can't take the same slot
  const claimed = await LaundrySlot.findOneAndUpdate({ _id: slot._id, isBooked: false }, { isBooked: true }, { new: true });
  if (!claimed) fail(409, "Slot was just booked by someone else");
  const booking = await LaundryBooking.create({ slot: slot._id, machine: slot.machine, student: student._id, hostel: slot.hostel, date: slot.date, notes: req.body.notes });
  res.status(201).json(booking);
});

const getMyBookings = wrap(async (req, res) => {
  const s = await myStudent(req);
  res.json(await LaundryBooking.find({ student: s._id }).populate("slot machine").sort({ date: -1 }));
});

const getBookings = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  ["date", "status"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
  res.json(await LaundryBooking.find(filter).populate("slot machine").populate(studentPop).sort({ date: -1 }).limit(200));
});

const cancelBooking = wrap(async (req, res) => {
  assertId(req.params.id);
  const b = await LaundryBooking.findById(req.params.id);
  if (!b) fail(404, "Booking not found");
  if (req.user.role === "student") {
    const s = await myStudent(req);
    if (String(s._id) !== String(b.student)) fail(403, "Not your booking");
  } else assertHostelAccess(req, b.hostel);
  if (b.status !== "booked") fail(400, `Booking is already ${b.status}`);
  b.status = "cancelled";
  await b.save();
  await LaundrySlot.findByIdAndUpdate(b.slot, { isBooked: false });
  res.json(b);
});

const updateBookingStatus = wrap(async (req, res) => {
  assertId(req.params.id);
  const { status } = req.body;
  if (!["completed", "no_show"].includes(status)) fail(400, "status must be completed or no_show");
  const b = await LaundryBooking.findById(req.params.id);
  if (!b) fail(404, "Booking not found");
  assertHostelAccess(req, b.hostel);
  if (b.status !== "booked") fail(400, `Booking is already ${b.status}`);
  b.status = status;
  await b.save();
  res.json(b);
});

module.exports = { createMachine, getMachines, updateMachine, deleteMachine, createSlots, getSlots, bookSlot, getMyBookings, getBookings, cancelBooking, updateBookingStatus };
