const User = require("../models/User");
const Student = require("../models/Student");
const Room = require("../models/Room");
const Hostel = require("../models/Hostel");
const Complaint = require("../models/Complaint");
const { wrap, fail, hostelFilter } = require("../utils/helpers");

// GET /api/search?q=...  (admin / security)
const globalSearch = wrap(async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) fail(400, "Type at least 2 characters");
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const hf = hostelFilter(req);
  const users = await User.find({ role: "student", $or: [{ name: rx }, { email: rx }] }).select("_id").limit(30);
  const [students, rooms, complaints, hostels] = await Promise.all([
    Student.find({ ...hf, $or: [{ registrationNumber: rx }, { user: { $in: users.map((u) => u._id) } }] }).populate("user", "name email").populate("room", "roomNumber").limit(6),
    req.user.role === "security" ? [] : Room.find({ ...hf, roomNumber: rx }).populate("hostel", "name").limit(5),
    req.user.role === "security" ? [] : Complaint.find({ ...hf, title: rx }).select("title status priority").limit(5),
    req.user.role === "security" ? [] : Hostel.find({ ...(hf.hostel ? { _id: hf.hostel } : {}), $or: [{ name: rx }, { code: rx }] }).limit(3),
  ]);
  res.json({
    students: students.map((s) => ({ id: s._id, title: s.user?.name, subtitle: `${s.registrationNumber}${s.room ? " · Room " + s.room.roomNumber : ""}`, link: "/admin/students" })),
    rooms: rooms.map((r) => ({ id: r._id, title: `Room ${r.roomNumber}`, subtitle: `${r.hostel?.name} · ${r.occupiedBeds}/${r.capacity} beds`, link: "/admin/rooms" })),
    complaints: complaints.map((c) => ({ id: c._id, title: c.title, subtitle: `${c.status} · ${c.priority}`, link: "/admin/complaints" })),
    hostels: hostels.map((h) => ({ id: h._id, title: h.name, subtitle: h.code, link: "/admin/hostels" })),
  });
});
module.exports = { globalSearch };
