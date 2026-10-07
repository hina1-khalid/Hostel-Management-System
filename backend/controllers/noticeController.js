const Notice = require("../models/Notice");
const Student = require("../models/Student");
const notify = require("../utils/notify");
const { wrap, fail, pick, assertId, hostelFilter, assertHostelAccess } = require("../utils/helpers");

const FIELDS = ["title", "content", "category", "hostel", "isPinned", "expiresAt"];
const populate = (q) => q.populate("postedBy", "name").populate("hostel", "name code");

const createNotice = wrap(async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (req.user.role === "admin" && req.user.hostel) data.hostel = req.user.hostel; // wardens post for their own hostel
  if (data.hostel) assertHostelAccess(req, data.hostel); else data.hostel = null;
  const notice = await Notice.create({ ...data, postedBy: req.user._id });
  await notify.toHostelStudents(data.hostel, { title: `Notice: ${notice.title}`, message: notice.content.slice(0, 100), type: notice.category === "emergency" ? "alert" : "info", link: "/student/notices" });
  res.status(201).json(await populate(Notice.findById(notice._id)));
});

const getNotices = wrap(async (req, res) => {
  const filter = {};
  if (req.user.role === "admin" && req.user.hostel) filter.$or = [{ hostel: req.user.hostel }, { hostel: null }];
  else if (req.query.hostel) filter.hostel = req.query.hostel;
  res.json(await populate(Notice.find(filter).sort({ isPinned: -1, createdAt: -1 })));
});

// Any logged-in role: notices for my hostel + global ones, not expired
const getMyNotices = wrap(async (req, res) => {
  const filter = { $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] }] };
  let hostel = req.user.hostel;
  if (req.user.role === "student") hostel = (await Student.findOne({ user: req.user._id }))?.hostel;
  if (hostel) filter.$and.push({ $or: [{ hostel: null }, { hostel }] });
  res.json(await populate(Notice.find(filter).sort({ isPinned: -1, createdAt: -1 })));
});

const updateNotice = wrap(async (req, res) => {
  assertId(req.params.id);
  const n = await Notice.findById(req.params.id);
  if (!n) fail(404, "Notice not found");
  if (n.hostel) assertHostelAccess(req, n.hostel);
  Object.assign(n, pick(req.body, FIELDS.filter((f) => f !== "hostel")));
  await n.save();
  res.json(await populate(Notice.findById(n._id)));
});

const deleteNotice = wrap(async (req, res) => {
  assertId(req.params.id);
  const n = await Notice.findById(req.params.id);
  if (!n) fail(404, "Notice not found");
  if (n.hostel) assertHostelAccess(req, n.hostel);
  await n.deleteOne();
  res.json({ message: "Notice deleted" });
});

module.exports = { createNotice, getNotices, getMyNotices, updateNotice, deleteNotice };
