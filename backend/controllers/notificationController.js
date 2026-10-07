const Notification = require("../models/Notification");
const { wrap, fail, assertId } = require("../utils/helpers");
const mailer = require("../utils/mailer");

const list = wrap(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  res.json({ unread, items });
});
const markRead = wrap(async (req, res) => {
  assertId(req.params.id);
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { new: true });
  if (!n) fail(404, "Notification not found");
  res.json(n);
});
const markAllRead = wrap(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ message: "All notifications marked as read" });
});
const remove = wrap(async (req, res) => {
  assertId(req.params.id);
  await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ message: "Deleted" });
});
// POST /api/notifications/test-email  -> sends a test mail to the signed-in user (to verify SMTP settings)
const testEmail = wrap(async (req, res) => {
  if (!mailer.isConfigured()) fail(400, "Email is not configured on the server. Set SMTP_HOST, SMTP_USER and SMTP_PASS in backend/.env and restart.");
  try {
    await mailer.sendMail({
      to: req.user.email,
      subject: "Test email from Hostel Management System",
      text: "Email notifications are working.",
      html: mailer.renderEmail({ name: req.user.name, title: "Email is working", message: "This is a test message. You will now receive notifications by email.", link: "/" }),
    });
  } catch (e) {
    fail(502, `Could not send email: ${e.message}`);
  }
  res.json({ message: `Test email sent to ${req.user.email}` });
});

module.exports = { list, markRead, markAllRead, remove, testEmail };
