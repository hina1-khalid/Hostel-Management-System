const mongoose = require("mongoose");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.statusCode = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};

// Wrap async controllers so any thrown error reaches the global error handler
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const pick = (obj, fields) =>
  fields.reduce((acc, f) => {
    if (obj[f] !== undefined) acc[f] = obj[f];
    return acc;
  }, {});

const isAdmin = (u) => ["admin", "superadmin"].includes(u.role);

// An admin tied to one hostel only sees that hostel; superadmin can filter with ?hostel=
const hostelFilter = (req, key = "hostel") => {
  if (req.user.role === "admin" && req.user.hostel) return { [key]: req.user.hostel };
  if (req.query.hostel) return { [key]: req.query.hostel };
  return {};
};
const canAccessHostel = (req, hostelId) =>
  !(req.user.role === "admin" && req.user.hostel && String(req.user.hostel) !== String(hostelId));
const assertHostelAccess = (req, hostelId) => {
  if (!canAccessHostel(req, hostelId)) fail(403, "You can only manage your own hostel");
};

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const assertId = (id, label = "ID") => {
  if (!validId(id)) fail(400, `Invalid ${label}`);
};

const TZ = process.env.APP_TIMEZONE || "Asia/Karachi";
const dateStr = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD
const monthStr = (d = new Date()) => dateStr(d).slice(0, 7); // YYYY-MM
// Date-only values are stored at 12:00 UTC so they read as the same calendar day in any time zone
const toDate = (ymd) => new Date(`${ymd}T12:00:00Z`);
const addDays = (ymd, n) => new Date(toDate(ymd).getTime() + n * 86400000).toISOString().slice(0, 10);
const daysInMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const hourNow = (d = new Date()) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d)) % 24;
const dayName = (d = new Date()) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(d).toLowerCase();

// Lazy requires avoid circular imports
const myStudent = async (req) => {
  const Student = require("../models/Student");
  const s = await Student.findOne({ user: req.user._id });
  if (!s) fail(404, "Student profile not found. Please ask the hostel office to create your profile.");
  return s;
};

// Student may touch only their own record; admins only within their hostel
const assertOwnerOrAdmin = async (req, studentId, hostelId) => {
  if (req.user.role === "student") {
    const s = await myStudent(req);
    if (String(s._id) !== String(studentId?._id || studentId)) fail(403, "Not allowed to access this record");
  } else if (req.user.role === "admin") {
    if (hostelId) assertHostelAccess(req, hostelId);
  } else if (req.user.role === "security") {
    fail(403, "Not allowed");
  }
};

// Which hostel a create-request is for: a warden always uses their own; a superadmin must choose one.
const bodyHostel = (req) => {
  const h = req.user.role === "admin" && req.user.hostel ? req.user.hostel : req.body.hostel;
  if (!h) fail(400, "Hostel is required");
  assertId(h, "hostel ID");
  assertHostelAccess(req, h);
  return h;
};

const paginate = (req, def = 100) => {
  const limit = Math.min(Number(req.query.limit) || def, 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  return { limit, skip: (page - 1) * limit };
};

// Put the total number of matching records in the X-Total-Count header (used by paginated lists)
const setTotal = async (res, Model, filter) => res.set("X-Total-Count", String(await Model.countDocuments(filter)));

module.exports = {
  bodyHostel, setTotal, toDate, addDays, daysInMonth,
  HttpError, fail, wrap, pick, isAdmin, hostelFilter, canAccessHostel, assertHostelAccess,
  validId, assertId, dateStr, monthStr, hourNow, dayName, myStudent, assertOwnerOrAdmin, paginate, TZ,
};
