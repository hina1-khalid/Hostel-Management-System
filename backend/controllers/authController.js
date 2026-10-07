const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const crypto = require("crypto");
const mailer = require("../utils/mailer");
const notify = require("../utils/notify");
const { logEvent } = require("../utils/audit");
const { wrap, fail, pick, assertId } = require("../utils/helpers");

const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
const RESET_MINUTES = 30;

const userPayload = (u) => ({
  _id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone, hostel: u.hostel, token: generateToken(u._id),
});

// POST /api/auth/register  (public, students only)
const registerUser = wrap(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) fail(400, "Name, email and password are required");
  if (password.length < 6) fail(400, "Password must be at least 6 characters");
  if (await User.findOne({ email: email.toLowerCase() })) fail(400, "Email already registered");
  const user = await User.create({ name, email, password, phone, role: "student" });
  res.status(201).json(userPayload(user));
});

// POST /api/auth/login
const loginUser = wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) fail(400, "Email and password are required");
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await user.matchPassword(password))) fail(401, "Invalid email or password");
  if (!user.isActive) fail(403, "Your account has been deactivated");
  logEvent(user, "/api/auth/login", { event: "signed in" });
  res.json(userPayload(user));
});

// GET /api/auth/me
const getMe = wrap(async (req, res) => res.json(req.user));

// PUT /api/auth/change-password
const changePassword = wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) fail(400, "Current and new password (min 6 chars) are required");
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.matchPassword(currentPassword))) fail(400, "Current password is incorrect");
  user.password = newPassword;
  await user.save();
  res.json({ message: "Password updated" });
});

// POST /api/auth/forgot-password { email }  -> always the same answer, so nobody can probe which emails exist
const forgotPassword = wrap(async (req, res) => {
  const generic = { message: "If an account with that email exists, a reset link has been sent." };
  const user = await User.findOne({ email: req.body.email, isActive: true });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex"); // only its hash is stored
    user.passwordResetToken = sha256(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    const link = `/reset-password/${token}`;
    setImmediate(async () => {
      try {
        if (mailer.isConfigured()) {
          await mailer.sendMail({
            to: user.email, subject: "Reset your password",
            text: `Open this link within ${RESET_MINUTES} minutes to choose a new password: ${(process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim()}${link}`,
            html: mailer.renderEmail({ name: user.name, title: "Reset your password", message: `Click the button within ${RESET_MINUTES} minutes to choose a new password. If you did not ask for this, ignore this email.`, link }),
          });
        } else {
          console.log(`[password reset] Email is not configured. Reset link for ${user.email}: ${(process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim()}${link}`);
        }
      } catch (e) {
        console.error("reset email failed:", e.message);
      }
    });
  }
  res.json(generic);
});

// POST /api/auth/reset-password { token, password }
const resetPassword = wrap(async (req, res) => {
  const user = await User.findOne({ passwordResetToken: sha256(req.body.token), passwordResetExpires: { $gt: new Date() } }).select("+passwordResetToken +passwordResetExpires");
  if (!user) fail(400, "This reset link is invalid or has expired. Please request a new one.");
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  logEvent(user, "/api/auth/reset-password", { event: "password reset" });
  await notify.toUser(user._id, { title: "Your password was changed", message: "If this was not you, contact the hostel office immediately.", type: "warning" });
  res.json({ message: "Password updated. You can now sign in." });
});

// PUT /api/auth/profile  (name, phone, email-notification preference)
const updateProfile = wrap(async (req, res) => {
  const user = await User.findById(req.user._id);
  const data = pick(req.body, ["name", "phone", "emailNotifications"]);
  if (data.name !== undefined && !String(data.name).trim()) fail(400, "Name cannot be empty");
  if (data.emailNotifications !== undefined) data.emailNotifications = !!data.emailNotifications;
  Object.assign(user, data);
  await user.save();
  res.json({ _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, emailNotifications: user.emailNotifications });
});

// POST /api/auth/create-staff  (superadmin: any staff role; admin: security only)
const createStaffUser = wrap(async (req, res) => {
  const { name, email, password, phone, role, hostel } = req.body;
  if (!name || !email || !password || !role) fail(400, "Name, email, password and role are required");
  if (password.length < 6) fail(400, "Password must be at least 6 characters");
  if (!["admin", "security", "superadmin"].includes(role)) fail(400, "Role must be admin, security or superadmin");
  if (req.user.role !== "superadmin" && role !== "security") fail(403, "Only a superadmin can create admin accounts");
  if (await User.findOne({ email: email.toLowerCase() })) fail(400, "Email already registered");
  const assignedHostel = req.user.role === "admin" ? req.user.hostel : hostel || undefined;
  const user = await User.create({ name, email, password, phone, role, hostel: assignedHostel });
  res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role, hostel: user.hostel });
});

// GET /api/auth/staff
const getStaff = wrap(async (req, res) => {
  const filter = { role: { $in: ["admin", "security", "superadmin"] } };
  if (req.user.role === "admin" && req.user.hostel) filter.hostel = req.user.hostel;
  res.json(await User.find(filter).populate("hostel", "name code").sort({ createdAt: -1 }));
});

// PUT /api/auth/staff/:id  (activate / deactivate / assign hostel)
const updateStaff = wrap(async (req, res) => {
  assertId(req.params.id);
  const target = await User.findById(req.params.id);
  if (!target || target.role === "student") fail(404, "Staff member not found");
  if (String(target._id) === String(req.user._id)) fail(400, "You cannot change your own account here");
  if (req.user.role !== "superadmin" && target.role !== "security") fail(403, "Only a superadmin can modify admin accounts");
  Object.assign(target, pick(req.body, ["isActive", "hostel", "phone", "name"]));
  await target.save();
  res.json(target);
});

module.exports = { registerUser, loginUser, getMe, changePassword, forgotPassword, resetPassword, updateProfile, createStaffUser, getStaff, updateStaff };
