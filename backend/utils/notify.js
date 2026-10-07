const Notification = require("../models/Notification");
const User = require("../models/User");
const Student = require("../models/Student");
const mailer = require("./mailer");

// Fire-and-forget email copy of a notification (never blocks or breaks the request)
const emailCopies = (userIds, { title, message, link }) => {
  if (!mailer.isConfigured()) return;
  setImmediate(async () => {
    try {
      const users = await User.find({ _id: { $in: userIds }, isActive: true, emailNotifications: { $ne: false } }).select("name email");
      for (const u of users) {
        if (!u.email) continue;
        await mailer
          .sendMail({ to: u.email, subject: title, text: `${message}\n`, html: mailer.renderEmail({ name: u.name, title, message, link }) })
          .catch((e) => console.error(`email to ${u.email} failed:`, e.message));
      }
    } catch (e) {
      console.error("email batch failed:", e.message);
    }
  });
};

const create = async (users, payload) => {
  const { title, message = "", type = "info", link = "" } = payload;
  const ids = [...new Set(users.filter(Boolean).map(String))];
  if (!ids.length) return;
  try {
    await Notification.insertMany(ids.map((user) => ({ user, title, message, type, link })));
  } catch (e) {
    console.error("notify failed:", e.message); // notifications must never break the main action
  }
  if (payload.email !== false) emailCopies(ids, { title, message, link });
};

const toUser = (userId, payload) => create([userId], payload);

const toStudent = async (studentId, payload) => {
  const s = await Student.findById(studentId).select("user");
  if (s) await create([s.user], payload);
};

// All students of a hostel (or every hostel when hostelId is null)
const toHostelStudents = async (hostelId, payload) => {
  const filter = hostelId ? { hostel: hostelId } : { hostel: { $ne: null } };
  const students = await Student.find(filter).select("user");
  await create(students.map((s) => s.user), payload);
};

const toAdmins = async (hostelId, payload) => {
  const admins = await User.find({ role: { $in: ["admin", "superadmin"] }, isActive: true });
  const targets = admins.filter(
    (a) => a.role === "superadmin" || !a.hostel || !hostelId || String(a.hostel) === String(hostelId)
  );
  await create(targets.map((a) => a._id), payload);
};

module.exports = { toUser, toStudent, toHostelStudents, toAdmins };
