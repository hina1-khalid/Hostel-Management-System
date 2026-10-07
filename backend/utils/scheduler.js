// Background jobs. They run inside the API process (no extra service to deploy).
const MaintenanceTask = require("../models/Maintenance");
const notify = require("./notify");
const { dateStr, addDays, toDate } = require("./helpers");

const REMIND_DAYS_BEFORE = 3;

// Sends one reminder per task per day for jobs that are overdue, due today, or due within 3 days.
// Returns how many reminders were sent. `now` is a parameter so tests can "travel in time".
const runMaintenanceReminders = async (now = new Date()) => {
  const today = dateStr(now);
  const tasks = await MaintenanceTask.find({
    isActive: true,
    nextDueAt: { $lte: toDate(addDays(today, REMIND_DAYS_BEFORE)) },
    lastReminderOn: { $ne: today },
  }).populate("hostel", "name");
  let sent = 0;
  for (const t of tasks) {
    const due = dateStr(t.nextDueAt);
    const overdue = due < today;
    const when = overdue ? `overdue since ${due}` : due === today ? "due today" : `due on ${due}`;
    await notify.toAdmins(t.hostel._id, {
      title: `${overdue ? "Overdue" : "Maintenance due"}: ${t.title}`,
      message: `${t.hostel.name} · ${when}${t.assignedTo ? ` · ${t.assignedTo}` : ""}`,
      type: overdue ? "alert" : "warning",
      link: "/admin/maintenance",
    });
    t.lastReminderOn = today;
    await t.save();
    sent++;
  }
  return sent;
};

const start = () => {
  if (process.env.DISABLE_SCHEDULER === "true") return;
  const tick = () => runMaintenanceReminders().catch((e) => console.error("maintenance reminders failed:", e.message));
  tick();
  setInterval(tick, 60 * 60 * 1000).unref(); // hourly; the once-a-day rule lives in lastReminderOn
};

module.exports = { runMaintenanceReminders, start };
