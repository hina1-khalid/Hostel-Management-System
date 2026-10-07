const MaintenanceTask = require("../models/Maintenance");
const { wrap, fail, pick, assertId, hostelFilter, assertHostelAccess, bodyHostel, dateStr, addDays, toDate } = require("../utils/helpers");

// due state, calculated in the hostel's time zone
const stateOf = (t, today = dateStr()) => {
  const due = dateStr(t.nextDueAt);
  const daysUntil = Math.round((toDate(due) - toDate(today)) / 86400000);
  return { dueDate: due, daysUntil, state: !t.isActive ? "paused" : daysUntil < 0 ? "overdue" : daysUntil <= 7 ? "due_soon" : "ok" };
};
const present = (t, today) => ({ ...t.toJSON(), ...stateOf(t, today) });
const populate = (q) => q.populate("hostel", "name code").populate("history.doneBy", "name");

const list = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  if (req.query.category) filter.category = req.query.category;
  if (req.query.all !== "true") filter.isActive = true;
  const today = dateStr();
  let tasks = (await populate(MaintenanceTask.find(filter).sort({ nextDueAt: 1 }))).map((t) => present(t, today));
  if (req.query.state) tasks = tasks.filter((t) => t.state === req.query.state);
  res.json(tasks);
});

const summary = wrap(async (req, res) => {
  const today = dateStr();
  const tasks = (await MaintenanceTask.find({ ...hostelFilter(req), isActive: true })).map((t) => stateOf(t, today).state);
  const n = (s) => tasks.filter((x) => x === s).length;
  res.json({ total: tasks.length, overdue: n("overdue"), dueSoon: n("due_soon"), ok: n("ok") });
});

const create = wrap(async (req, res) => {
  const hostel = bodyHostel(req);
  const { title, category, intervalDays, firstDueDate, lastDoneDate, assignedTo, estimatedCost, notes } = req.body;
  const today = dateStr();
  const next = firstDueDate || addDays(lastDoneDate || today, intervalDays);
  const task = await MaintenanceTask.create({
    hostel, title, category: category || "other", intervalDays, assignedTo, estimatedCost, notes,
    nextDueAt: toDate(next), lastDoneAt: lastDoneDate ? toDate(lastDoneDate) : undefined,
  });
  res.status(201).json(present(await populate(MaintenanceTask.findById(task._id))));
});

const update = wrap(async (req, res) => {
  assertId(req.params.id);
  const t = await MaintenanceTask.findById(req.params.id);
  if (!t) fail(404, "Task not found");
  assertHostelAccess(req, t.hostel);
  Object.assign(t, pick(req.body, ["title", "category", "notes", "intervalDays", "assignedTo", "estimatedCost", "isActive"]));
  if (req.body.nextDueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.nextDueDate)) fail(400, "nextDueDate must be YYYY-MM-DD");
    t.nextDueAt = toDate(req.body.nextDueDate);
    t.lastReminderOn = undefined;
  }
  await t.save();
  res.json(present(await populate(MaintenanceTask.findById(t._id))));
});

// POST /api/maintenance/:id/complete { doneDate?, cost?, notes? } -> logs it and schedules the next one
const complete = wrap(async (req, res) => {
  assertId(req.params.id);
  const t = await MaintenanceTask.findById(req.params.id);
  if (!t) fail(404, "Task not found");
  assertHostelAccess(req, t.hostel);
  const today = dateStr();
  const done = req.body.doneDate || today;
  if (done > today) fail(400, "doneDate cannot be in the future");
  t.history.push({ doneAt: toDate(done), doneBy: req.user._id, cost: req.body.cost || 0, notes: req.body.notes });
  if (!t.lastDoneAt || done >= dateStr(t.lastDoneAt)) {
    t.lastDoneAt = toDate(done);
    t.nextDueAt = toDate(addDays(done, t.intervalDays));
  }
  t.lastReminderOn = undefined;
  await t.save();
  res.json(present(await populate(MaintenanceTask.findById(t._id))));
});

const remove = wrap(async (req, res) => {
  assertId(req.params.id);
  const t = await MaintenanceTask.findById(req.params.id);
  if (!t) fail(404, "Task not found");
  assertHostelAccess(req, t.hostel);
  await t.deleteOne();
  res.json({ message: "Task deleted" });
});

module.exports = { list, summary, create, update, complete, remove, stateOf };
