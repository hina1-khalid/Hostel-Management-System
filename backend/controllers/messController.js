const { MessMenu, MessAttendance, MessFeedback, MessBill } = require("../models/Mess");
const Student = require("../models/Student");
const notify = require("../utils/notify");
const { wrap, fail, assertId, hostelFilter, assertHostelAccess, myStudent, dateStr, monthStr, dayName } = require("../utils/helpers");

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MEALS = ["breakfast", "lunch", "dinner"];
const studentPop = { path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } };
const checkDate = (d) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) fail(400, "date must be YYYY-MM-DD"); };

// ---------- Menu ----------
const getMenu = wrap(async (req, res) => {
  let hostel = hostelFilter(req).hostel;
  if (req.user.role === "student") hostel = (await myStudent(req)).hostel;
  if (!hostel) fail(400, "No hostel selected");
  const menu = await MessMenu.find({ hostel });
  const byDay = Object.fromEntries(menu.map((m) => [m.day, m]));
  res.json({ today: dayName(), hostel, days: DAYS.map((d) => byDay[d] || { day: d, breakfast: "", lunch: "", dinner: "" }) });
});

const setMenu = wrap(async (req, res) => {
  const { day, breakfast = "", lunch = "", dinner = "" } = req.body;
  const hostel = req.user.role === "admin" && req.user.hostel ? req.user.hostel : req.body.hostel;
  if (!hostel) fail(400, "Hostel is required");
  assertHostelAccess(req, hostel);
  if (!DAYS.includes(day)) fail(400, "Invalid day");
  const m = await MessMenu.findOneAndUpdate({ hostel, day }, { hostel, day, breakfast, lunch, dinner, updatedBy: req.user._id }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json(m);
});

// ---------- Meal booking / attendance ----------
// Student books or cancels a meal: POST { date, meal, status: "booked" | "cancelled" }
const bookMeal = wrap(async (req, res) => {
  const { date = dateStr(), meal, status = "booked" } = req.body;
  checkDate(date);
  if (!MEALS.includes(meal)) fail(400, "meal must be breakfast, lunch or dinner");
  if (!["booked", "cancelled"].includes(status)) fail(400, "status must be booked or cancelled");
  if (date < dateStr()) fail(400, "You cannot change meals for past dates");
  const student = await myStudent(req);
  if (!student.hostel) fail(400, "You need a hostel allocation first");
  const existing = await MessAttendance.findOne({ student: student._id, date, meal });
  if (existing?.status === "taken") fail(400, "This meal is already marked as taken");
  const rec = await MessAttendance.findOneAndUpdate(
    { student: student._id, date, meal },
    { student: student._id, hostel: student.hostel, date, meal, status },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json(rec);
});

const getMyMeals = wrap(async (req, res) => {
  const s = await myStudent(req);
  const month = req.query.month || monthStr();
  res.json(await MessAttendance.find({ student: s._id, date: new RegExp(`^${month}`) }).sort({ date: -1 }));
});

// Admin: who booked what on a date (with meal counts for the kitchen)
const getMealRoster = wrap(async (req, res) => {
  const date = req.query.date || dateStr();
  checkDate(date);
  const filter = { ...hostelFilter(req), date, status: { $ne: "cancelled" } };
  if (req.query.meal) filter.meal = req.query.meal;
  const records = await MessAttendance.find(filter).populate(studentPop);
  const counts = { breakfast: 0, lunch: 0, dinner: 0 };
  records.forEach((r) => counts[r.meal]++);
  res.json({ date, counts, records });
});

// Admin marks booked meals as taken: PUT { ids: [...] }
const markMealsTaken = wrap(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) fail(400, "ids array is required");
  const recs = await MessAttendance.find({ _id: { $in: ids } });
  recs.forEach((r) => assertHostelAccess(req, r.hostel));
  await MessAttendance.updateMany({ _id: { $in: recs.map((r) => r._id) }, status: "booked" }, { status: "taken" });
  res.json({ message: `${recs.length} meal(s) marked as taken` });
});

// ---------- Feedback ----------
const submitFeedback = wrap(async (req, res) => {
  const { date = dateStr(), meal, rating, comment } = req.body;
  checkDate(date);
  if (!MEALS.includes(meal)) fail(400, "Invalid meal");
  if (!(Number(rating) >= 1 && Number(rating) <= 5)) fail(400, "Rating must be 1 to 5");
  const student = await myStudent(req);
  if (!student.hostel) fail(400, "You need a hostel allocation first");
  const fb = await MessFeedback.findOneAndUpdate(
    { student: student._id, date, meal },
    { student: student._id, hostel: student.hostel, date, meal, rating: Number(rating), comment },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json(fb);
});

const getFeedback = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  if (req.query.meal) filter.meal = req.query.meal;
  const items = await MessFeedback.find(filter).populate(studentPop).sort({ createdAt: -1 }).limit(200);
  const avg = items.length ? Math.round((items.reduce((a, f) => a + f.rating, 0) / items.length) * 10) / 10 : 0;
  const byMeal = MEALS.map((m) => {
    const fs = items.filter((f) => f.meal === m);
    return { meal: m, count: fs.length, average: fs.length ? Math.round((fs.reduce((a, f) => a + f.rating, 0) / fs.length) * 10) / 10 : 0 };
  });
  res.json({ average: avg, count: items.length, byMeal, items });
});

// ---------- Bills ----------
// POST { hostel?, month: "YYYY-MM", ratePerMeal }
const generateBills = wrap(async (req, res) => {
  const month = req.body.month || monthStr();
  if (!/^\d{4}-\d{2}$/.test(month)) fail(400, "month must be YYYY-MM");
  const rate = Number(req.body.ratePerMeal ?? process.env.MESS_RATE_PER_MEAL ?? 150);
  if (!(rate > 0)) fail(400, "ratePerMeal must be greater than 0");
  const hostel = req.user.role === "admin" && req.user.hostel ? req.user.hostel : req.body.hostel;
  if (!hostel) fail(400, "Hostel is required");
  assertHostelAccess(req, hostel);
  const meals = await MessAttendance.find({ hostel, date: new RegExp(`^${month}`), status: { $in: ["booked", "taken"] } });
  const counts = {};
  meals.forEach((m) => (counts[m.student] = (counts[m.student] || 0) + 1));
  let created = 0, updated = 0;
  for (const [student, mealsCount] of Object.entries(counts)) {
    const existing = await MessBill.findOne({ student, month });
    if (existing?.status === "paid") continue;
    if (existing) { Object.assign(existing, { mealsCount, ratePerMeal: rate, amount: mealsCount * rate }); await existing.save(); updated++; }
    else {
      await MessBill.create({ student, hostel, month, mealsCount, ratePerMeal: rate, amount: mealsCount * rate });
      await notify.toStudent(student, { title: "Mess bill generated", message: `${month}: ${mealsCount} meals, Rs ${mealsCount * rate}.`, type: "warning", link: "/student/mess" });
      created++;
    }
  }
  res.status(201).json({ message: `Mess bills: ${created} created, ${updated} updated`, created, updated });
});

const getBills = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  ["month", "status"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
  res.json(await MessBill.find(filter).populate(studentPop).sort({ month: -1, createdAt: -1 }));
});

const getMyBills = wrap(async (req, res) => {
  const s = await myStudent(req);
  res.json(await MessBill.find({ student: s._id }).sort({ month: -1 }));
});

const payBill = wrap(async (req, res) => {
  assertId(req.params.id);
  const bill = await MessBill.findById(req.params.id);
  if (!bill) fail(404, "Bill not found");
  assertHostelAccess(req, bill.hostel);
  if (bill.status === "paid") fail(400, "Bill already paid");
  bill.status = "paid";
  bill.paidDate = new Date();
  await bill.save();
  await notify.toStudent(bill.student, { title: "Mess bill paid", message: `${bill.month}: Rs ${bill.amount} received.`, type: "success", link: "/student/mess" });
  res.json(bill);
});

module.exports = { getMenu, setMenu, bookMeal, getMyMeals, getMealRoster, markMealsTaken, submitFeedback, getFeedback, generateBills, getBills, getMyBills, payBill };
