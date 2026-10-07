// Maintenance reminder job, tested in-process with "time travel":  MONGO_URI=... node tests/scheduler.test.js (needs seeded data)
require("dotenv").config();
const mongoose = require("mongoose");
const MaintenanceTask = require("../models/Maintenance");
const Notification = require("../models/Notification");
const Hostel = require("../models/Hostel");
const User = require("../models/User");
const { runMaintenanceReminders } = require("../utils/scheduler");
const { toDate, addDays, dateStr } = require("../utils/helpers");

let pass = 0, failed = 0;
const ok = (n, c, x = "") => { c ? (pass++, console.log("  ✓", n)) : (failed++, console.log("  ✗ FAIL:", n, x)); };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const iqbal = await Hostel.findOne({ code: "IQB" });
  const warden = await User.findOne({ email: "warden@hostel.com" }), wardenF = await User.findOne({ email: "warden.f@hostel.com" });
  const today = dateStr();
  const mk = (title, dueIn, extra = {}) => MaintenanceTask.create({ hostel: iqbal._id, title, intervalDays: 30, nextDueAt: toDate(addDays(today, dueIn)), ...extra });
  await mk("Overdue geyser", -4);
  await mk("Due in two days", 2);
  await mk("Due in ten days", 10);
  await mk("Paused and overdue", -9, { isActive: false });
  const titles = async (u) => (await Notification.find({ user: u._id }).sort({ createdAt: 1 })).map((n) => n.title);

  console.log("MAINTENANCE REMINDERS");
  ok("first run reminds about the overdue and the near-due task only", (await runMaintenanceReminders()) === 2);
  let t = await titles(warden);
  ok("warden is notified with the right wording", t.includes("Overdue: Overdue geyser") && t.includes("Maintenance due: Due in two days") && t.length === 2, JSON.stringify(t));
  ok("a task due in ten days is not mentioned yet, paused ones never", !t.some((x) => /ten days|Paused/.test(x)));
  ok("superadmin is told too", (await titles(await User.findOne({ email: "admin@hostel.com" }))).length === 2);
  ok("another hostel's warden is not told", (await titles(wardenF)).length === 0);
  ok("running again the same day sends nothing (one reminder per day)", (await runMaintenanceReminders()) === 0 && (await titles(warden)).length === 2);
  const tomorrow = new Date(Date.now() + 864e5);
  ok("the next day the open jobs are reminded again", (await runMaintenanceReminders(tomorrow)) === 2);
  ok("eight days later the ten-day task enters the window", (await runMaintenanceReminders(new Date(Date.now() + 8 * 864e5))) === 3);
  const done = await MaintenanceTask.findOne({ title: "Overdue geyser" });
  done.nextDueAt = toDate(addDays(today, 60)); await done.save(); // as if it had been completed
  ok("a completed (rescheduled) job stops reminding", (await runMaintenanceReminders(new Date(Date.now() + 9 * 864e5))) === 2);
  const stale = await Notification.findOne({ user: warden._id, title: /Overdue: Overdue geyser/ });
  ok("reminders link to the maintenance page", stale.link === "/admin/maintenance" && stale.type === "alert");

  console.log(`\nRESULT: ${pass} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})();
