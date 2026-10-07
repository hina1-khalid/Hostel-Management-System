const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Attachment = require("../models/Attachment");
const notify = require("../utils/notify");
const { sniffImage } = require("../utils/upload");
const { wrap, fail, pick, assertId, hostelFilter, assertHostelAccess, assertOwnerOrAdmin, myStudent, isAdmin, paginate, setTotal } = require("../utils/helpers");

// Simple keyword classifier used when the student doesn't pick a category/priority
const CATEGORY_KEYWORDS = {
  electricity: ["light", "bulb", "electric", "socket", "switch", "power", "fan", "ac ", "heater", "wiring", "short circuit"],
  water: ["water", "tap", "leak", "geyser", "plumb", "drain", "toilet", "flush", "washroom", "bathroom"],
  internet: ["wifi", "wi-fi", "internet", "network", "router", "lan"],
  cleaning: ["clean", "dust", "garbage", "dirty", "sweep", "trash", "mosquito", "pest", "insect"],
  food: ["food", "mess", "meal", "breakfast", "lunch", "dinner", "roti", "chicken", "rice"],
  furniture: ["bed", "chair", "table", "cupboard", "mattress", "almirah", "door", "window", "lock", "desk"],
  security: ["theft", "stolen", "security", "guard", "unsafe", "harass", "fight", "intruder"],
};
const HIGH = ["urgent", "emergency", "fire", "spark", "short circuit", "shock", "flood", "stolen", "theft", "harass", "danger", "injur", "gas"];
const LOW = ["minor", "small", "slight", "whenever", "no hurry"];

const classify = (text) => {
  const t = ` ${text.toLowerCase()} `;
  let category = "other", best = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const hits = words.filter((w) => t.includes(w)).length;
    if (hits > best) { best = hits; category = cat; }
  }
  const priority = HIGH.some((w) => t.includes(w)) ? "high" : LOW.some((w) => t.includes(w)) ? "low" : "medium";
  return { category, priority };
};

const populate = (q) =>
  q.populate({ path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } })
    .populate("hostel", "name code").populate("room", "roomNumber")
    .populate("assignedTo", "name role").populate("comments.author", "name role");

const createComplaint = wrap(async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) fail(400, "Title and description are required");
  const student = await myStudent(req);
  if (!student.hostel) fail(400, "You need an allocated room before filing a complaint");
  // photos: check the real file type from the first bytes (never trust the browser's label)
  const files = req.files || [];
  const kinds = files.map((f) => sniffImage(f.buffer));
  if (kinds.some((k) => !k)) fail(400, "Only JPG, PNG or WebP photos are allowed");
  const auto = classify(`${title} ${description}`);
  const complaint = await Complaint.create({
    student: student._id, hostel: student.hostel, room: student.room, title, description,
    category: req.body.category || auto.category, priority: req.body.priority || auto.priority,
  });
  if (files.length) {
    const saved = await Attachment.insertMany(files.map((f, i) => ({ data: f.buffer, contentType: kinds[i], size: f.size, owner: req.user._id, complaint: complaint._id })));
    complaint.attachments = saved.map((a) => a._id);
    await complaint.save();
  }
  await notify.toAdmins(student.hostel, {
    title: `New ${complaint.priority} priority complaint`, message: complaint.title, type: complaint.priority === "high" ? "alert" : "info", link: "/admin/complaints",
  });
  res.status(201).json(await populate(Complaint.findById(complaint._id)));
});

const getComplaints = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  ["status", "category", "priority"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
  if (req.query.q) filter.title = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const { limit, skip } = paginate(req, 25);
  await setTotal(res, Complaint, filter);
  res.json(await populate(Complaint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)));
});

const getMyComplaints = wrap(async (req, res) => {
  const s = await myStudent(req);
  res.json(await populate(Complaint.find({ student: s._id }).sort({ createdAt: -1 })));
});

const getComplaintById = wrap(async (req, res) => {
  assertId(req.params.id);
  const c = await populate(Complaint.findById(req.params.id));
  if (!c) fail(404, "Complaint not found");
  await assertOwnerOrAdmin(req, c.student._id, c.hostel._id);
  res.json(c);
});

const updateComplaint = wrap(async (req, res) => {
  assertId(req.params.id);
  const c = await Complaint.findById(req.params.id);
  if (!c) fail(404, "Complaint not found");
  assertHostelAccess(req, c.hostel);
  const before = c.status;
  Object.assign(c, pick(req.body, ["status", "priority", "category", "assignedTo"]));
  if (req.body.assignedTo) {
    const staff = await User.findById(req.body.assignedTo);
    if (!staff || staff.role === "student") fail(400, "assignedTo must be a staff member");
  }
  if (c.status === "resolved" && before !== "resolved") c.resolvedAt = new Date();
  if (c.status !== "resolved") c.resolvedAt = undefined;
  await c.save();
  if (before !== c.status)
    await notify.toStudent(c.student, { title: "Complaint update", message: `"${c.title}" is now ${c.status.replace("_", " ")}.`, type: c.status === "resolved" ? "success" : "info", link: "/student/complaints" });
  res.json(await populate(Complaint.findById(c._id)));
});

const addComment = wrap(async (req, res) => {
  assertId(req.params.id);
  if (!req.body.text?.trim()) fail(400, "Comment text is required");
  const c = await Complaint.findById(req.params.id);
  if (!c) fail(404, "Complaint not found");
  await assertOwnerOrAdmin(req, c.student, c.hostel);
  c.comments.push({ author: req.user._id, text: req.body.text.trim() });
  await c.save();
  if (isAdmin(req.user)) await notify.toStudent(c.student, { title: "New reply on your complaint", message: req.body.text.slice(0, 80), link: "/student/complaints" });
  res.status(201).json(await populate(Complaint.findById(c._id)));
});

const deleteComplaint = wrap(async (req, res) => {
  assertId(req.params.id);
  const c = await Complaint.findById(req.params.id);
  if (!c) fail(404, "Complaint not found");
  assertHostelAccess(req, c.hostel);
  await c.deleteOne();
  res.json({ message: "Complaint deleted" });
});

module.exports = { createComplaint, getComplaints, getMyComplaints, getComplaintById, updateComplaint, addComment, deleteComplaint, classify };
