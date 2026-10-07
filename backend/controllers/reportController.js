const Report = require("../models/Report");
const Hostel = require("../models/Hostel");
const Room = require("../models/Room");
const Student = require("../models/Student");
const Fee = require("../models/Fee");
const Complaint = require("../models/Complaint");
const Attendance = require("../models/Attendance");
const QrEntry = require("../models/QrEntry");
const Visitor = require("../models/Visitor");
const Leave = require("../models/Leave");
const Inventory = require("../models/Inventory");
const { MessFeedback, MessBill, MessAttendance } = require("../models/Mess");
const { LaundryBooking, LaundrySlot } = require("../models/Laundry");
const MaintenanceTask = require("../models/Maintenance");
const { MessExpense } = require("../models/MessFinance");
const { Payroll } = require("../models/Workforce");
const { wrap, fail, assertId, assertHostelAccess, monthStr, dateStr } = require("../utils/helpers");

const UTC_OFFSET = process.env.APP_UTC_OFFSET || "+05:00"; // matches APP_TIMEZONE (Asia/Karachi)
const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const round1 = (n) => Math.round(n * 10) / 10;
const prevMonth = (m) => { const [y, mo] = m.split("-").map(Number); return monthStr(new Date(y, mo - 2, 15)); };
const range = (m) => {
  const [y, mo] = m.split("-").map(Number);
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  return { start: new Date(`${m}-01T00:00:00${UTC_OFFSET}`), end: new Date(`${next}-01T00:00:00${UTC_OFFSET}`) };
};
const countBy = (arr, key) => Object.entries(arr.reduce((a, x) => ((a[x[key]] = (a[x[key]] || 0) + 1), a), {})).map(([name, value]) => ({ name, value }));

// ---------- Numbers ----------
const buildStats = async (hostelId, month) => {
  const h = hostelId ? { hostel: hostelId } : {};
  const { start, end } = range(month);
  const inMonth = { $gte: start, $lt: end };

  const [rooms, students, fees, complaints, attendance, entries, visitors, leaves, feedback, bills, mealsBooked, laundry, slots, inventory, messExpenses, tasks, payrolls] = await Promise.all([
    Room.find(h).select("capacity occupiedBeds"),
    Student.find(h).select("allocationStatus"),
    Fee.find({ ...h, dueDate: inMonth }).select("status totalAmount"),
    Complaint.find({ ...h, createdAt: inMonth }).select("status category priority createdAt resolvedAt"),
    Attendance.find({ ...h, date: new RegExp(`^${month}`) }).select("status"),
    QrEntry.find({ ...h, timestamp: inMonth }).populate({ path: "student", select: "registrationNumber user", populate: { path: "user", select: "name" } }),
    Visitor.countDocuments({ ...h, createdAt: inMonth }),
    Leave.find({ ...h, createdAt: inMonth }).select("status"),
    MessFeedback.find({ ...h, date: new RegExp(`^${month}`) }).select("meal rating"),
    MessBill.find({ ...h, month }).select("status amount"),
    MessAttendance.countDocuments({ ...h, date: new RegExp(`^${month}`), status: { $in: ["booked", "taken"] } }),
    LaundryBooking.find({ ...h, date: new RegExp(`^${month}`) }).select("status"),
    LaundrySlot.countDocuments({ ...h, date: new RegExp(`^${month}`) }),
    Inventory.find(h).select("condition quantity"),
    MessExpense.find({ ...h, date: new RegExp(`^${month}`) }).select("amount"),
    MaintenanceTask.find(h).select("history nextDueAt isActive"),
    Payroll.find({ ...h, month }).select("netSalary status"),
  ]);

  const totalBeds = sum(rooms, (r) => r.capacity), occupied = sum(rooms, (r) => r.occupiedBeds);
  const billed = sum(fees, (f) => f.totalAmount), collected = sum(fees.filter((f) => f.status === "paid"), (f) => f.totalAmount);
  const resolved = complaints.filter((c) => c.resolvedAt);
  const avgRes = resolved.length ? round1(sum(resolved, (c) => (c.resolvedAt - c.createdAt) / 3600000) / resolved.length) : null;
  const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const lateEntries = entries.filter((e) => e.isLateEntry);
  const lateByStudent = {};
  lateEntries.forEach((e) => { const k = e.student?.user?.name || "Unknown"; lateByStudent[k] = (lateByStudent[k] || 0) + 1; });
  const ratings = (meal) => { const f = meal ? feedback.filter((x) => x.meal === meal) : feedback; return f.length ? { average: round1(sum(f, (x) => x.rating) / f.length), count: f.length } : { average: null, count: 0 }; };
  const messSpent = sum(messExpenses, (e) => e.amount), messBilled = sum(bills, (b) => b.amount);
  const doneInMonth = tasks.flatMap((t) => t.history.filter((x) => x.doneAt && dateStr(x.doneAt).startsWith(month)));
  const bookedLaundry = laundry.filter((b) => b.status !== "cancelled").length;

  return {
    month,
    occupancy: { totalBeds, occupiedBeds: occupied, rate: pct(occupied, totalBeds), students: students.length, allocated: students.filter((s) => s.allocationStatus === "allocated").length },
    fees: { billed, collected, outstanding: billed - collected, collectionRate: pct(collected, billed), overdueCount: fees.filter((f) => f.status === "overdue").length, count: fees.length },
    complaints: { total: complaints.length, resolved: complaints.filter((c) => c.status === "resolved").length, open: complaints.filter((c) => ["pending", "in_progress"].includes(c.status)).length, avgResolutionHours: avgRes, byCategory: countBy(complaints, "category"), highPriority: complaints.filter((c) => c.priority === "high").length },
    attendance: { records: attendance.length, presentRate: pct(present, attendance.length), absent: attendance.filter((a) => a.status === "absent").length },
    gate: { entries: entries.length, lateEntries: lateEntries.length, topLate: Object.entries(lateByStudent).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count })), visitors },
    leaves: { total: leaves.length, approved: leaves.filter((l) => l.status === "approved").length, rejected: leaves.filter((l) => l.status === "rejected").length, pending: leaves.filter((l) => l.status === "pending").length },
    mess: { mealsBooked, rating: ratings(), byMeal: ["breakfast", "lunch", "dinner"].map((m) => ({ meal: m, ...ratings(m) })), billed: sum(bills, (b) => b.amount), billsPaid: bills.filter((b) => b.status === "paid").length, billsTotal: bills.length },
    laundry: { bookings: bookedLaundry, noShows: laundry.filter((b) => b.status === "no_show").length, slots, utilization: pct(bookedLaundry, slots) },
    ops: {
      mess: { spent: messSpent, costPerMeal: mealsBooked ? round1(messSpent / mealsBooked) : null, billed: messBilled, result: messBilled - messSpent },
      maintenance: { completed: doneInMonth.length, cost: sum(doneInMonth, (x) => x.cost), overdueNow: tasks.filter((t) => t.isActive && dateStr(t.nextDueAt) < dateStr()).length },
      payroll: { paid: sum(payrolls.filter((p) => p.status === "paid"), (p) => p.netSalary), pending: sum(payrolls.filter((p) => p.status !== "paid"), (p) => p.netSalary) },
    },
    inventory: { needsAttention: inventory.filter((i) => ["damaged", "under_repair"].includes(i.condition)).length, items: inventory.length },
  };
};

// ---------- Narrative: built-in rules (always available) ----------
const delta = (cur, prev, unit = "", better = "up") => {
  if (prev === null || prev === undefined || cur === null || cur === undefined) return "";
  const d = round1(cur - prev);
  if (d === 0) return " (unchanged from last month)";
  return ` (${d > 0 ? "up" : "down"} ${Math.abs(d)}${unit} from last month)`;
};

const rulesNarrative = (s, p, name) => {
  const highlights = [], concerns = [], recommendations = [];
  const { occupancy: o, fees: f, complaints: c, attendance: a, gate: g, mess: m, laundry: l, inventory: inv } = s;

  highlights.push(`Occupancy stands at ${o.rate}% (${o.occupiedBeds} of ${o.totalBeds} beds) with ${o.allocated} students allocated.`);
  if (f.count) (f.collectionRate >= 80 ? highlights : concerns).push(`Fee collection is ${f.collectionRate}% — Rs ${f.collected.toLocaleString()} of Rs ${f.billed.toLocaleString()} billed${delta(f.collectionRate, p.fees.count ? p.fees.collectionRate : null, " pts")}.`);
  if (c.total) highlights.push(`${c.resolved} of ${c.total} complaints were resolved${c.avgResolutionHours !== null ? `, taking ${c.avgResolutionHours} hours on average` : ""}.`);
  if (a.records) (a.presentRate >= 90 ? highlights : concerns).push(`Attendance rate is ${a.presentRate}% across ${a.records} roll-call records.`);
  if (m.rating.count) (m.rating.average >= 3.5 ? highlights : concerns).push(`Mess rating averages ${m.rating.average}/5 from ${m.rating.count} reviews.`);
  if (l.slots) highlights.push(`Laundry slots were ${l.utilization}% utilised (${l.bookings} bookings).`);

  const ops = s.ops;
  if (ops?.mess?.spent > 0) {
    highlights.push(`Mess spending was Rs ${ops.mess.spent.toLocaleString()}${ops.mess.costPerMeal !== null ? ` (about Rs ${ops.mess.costPerMeal} per meal)` : ""}.`);
    if (ops.mess.billed > 0 && ops.mess.result < 0) {
      concerns.push(`Mess spending exceeded mess billing by Rs ${Math.abs(ops.mess.result).toLocaleString()}.`);
      recommendations.push("Review mess costs or the per-meal rate: this month's spending is higher than what was billed.");
    }
  }
  if (ops?.maintenance?.completed) highlights.push(`${ops.maintenance.completed} maintenance job(s) were completed (Rs ${ops.maintenance.cost.toLocaleString()}).`);
  if (ops?.maintenance?.overdueNow) {
    concerns.push(`${ops.maintenance.overdueNow} scheduled maintenance job(s) are overdue.`);
    recommendations.push("Complete the overdue maintenance jobs under Maintenance.");
  }
  if (ops?.payroll?.pending > 0) concerns.push(`Salaries of Rs ${ops.payroll.pending.toLocaleString()} are still unpaid for this month.`);
  if (f.overdueCount) concerns.push(`${f.overdueCount} fee(s) are overdue.`);
  if (c.open) concerns.push(`${c.open} complaint(s) are still open${c.highPriority ? `, ${c.highPriority} marked high priority` : ""}.`);
  if (c.avgResolutionHours !== null && c.avgResolutionHours > 72) concerns.push(`Average complaint resolution time (${c.avgResolutionHours} h) exceeds 72 hours.`);
  if (g.lateEntries) concerns.push(`${g.lateEntries} late entries were recorded${g.topLate.length ? ` (most: ${g.topLate.map((t) => `${t.name} ×${t.count}`).join(", ")})` : ""}.`);
  if (inv.needsAttention) concerns.push(`${inv.needsAttention} inventory item type(s) are damaged or under repair.`);
  if (o.rate < 60 && o.totalBeds) concerns.push(`Occupancy is below 60%, leaving many beds unused.`);
  if (l.noShows) concerns.push(`${l.noShows} laundry no-show(s) wasted machine slots.`);

  if (f.overdueCount || f.collectionRate < 80) recommendations.push("Send fee reminders and follow up with students who have overdue balances.");
  if (c.open) recommendations.push("Assign open complaints to staff and clear the high-priority ones first.");
  if (g.lateEntries >= 3) recommendations.push("Review the curfew policy with students who repeatedly enter late.");
  if (m.rating.count && m.rating.average < 3.5) recommendations.push("Review the mess menu and vendor quality using the lowest-rated meals.");
  if (inv.needsAttention) recommendations.push("Schedule repair or replacement for damaged inventory.");
  if (o.rate < 60 && o.totalBeds) recommendations.push("Allocate waiting students to free rooms to improve occupancy.");
  if (!recommendations.length) recommendations.push("Operations look healthy. Keep monitoring fees, complaints and attendance each month.");

  const bits = [`In ${s.month}, ${name} had ${o.rate}% occupancy`];
  if (f.count) bits.push(`${f.collectionRate}% fee collection`);
  if (c.total) bits.push(`${c.total} complaint(s) with ${c.resolved} resolved`);
  const summary = bits.join(", ") + `. ${concerns.length ? `${concerns.length} area(s) need attention.` : "No major concerns were detected."}`;
  return { summary, highlights, concerns, recommendations };
};

// ---------- Narrative: Claude (optional) ----------
const cleanList = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, 400)).slice(0, 8) : []);
const parseNarrative = (text) => {
  const cleaned = String(text).replace(/```(?:json)?/gi, "").trim();
  const json = cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1);
  const o = JSON.parse(json);
  if (typeof o.summary !== "string" || !o.summary.trim()) throw new Error("missing summary");
  return { summary: o.summary.trim().slice(0, 1200), highlights: cleanList(o.highlights), concerns: cleanList(o.concerns), recommendations: cleanList(o.recommendations) };
};

const claudeNarrative = async (stats, prev, name) => {
  const prompt = `You are an analyst writing the monthly report for a university hostel warden. Use ONLY the numbers below; never invent data. Compare with the previous month where useful.
Hostel: ${name}
Month: ${stats.month}
Current month data: ${JSON.stringify(stats)}
Previous month data: ${JSON.stringify(prev)}

Reply with ONLY a JSON object (no markdown) of this shape:
{"summary": "3-4 sentence overview", "highlights": ["3-5 positives"], "concerns": ["0-5 problems"], "recommendations": ["3-5 concrete actions"]}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Claude API ${r.status}`);
  const data = await r.json();
  return parseNarrative(data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"));
};

const makeNarrative = async (stats, prev, name) => {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return { narrative: await claudeNarrative(stats, prev, name), source: "claude" };
    } catch (e) {
      console.error("Report fell back to rules:", e.message);
    }
  }
  return { narrative: rulesNarrative(stats, prev, name), source: "rules" };
};

// ---------- Endpoints ----------
// POST /api/reports/generate { month?: "YYYY-MM", hostel? }
const generateReport = wrap(async (req, res) => {
  const month = req.body.month || prevMonth(monthStr());
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail(400, "month must be YYYY-MM");
  if (month > monthStr()) fail(400, "Cannot generate a report for a future month");
  let hostelId = req.user.role === "admin" && req.user.hostel ? req.user.hostel : req.body.hostel || null;
  let name = "All hostels";
  if (hostelId) {
    assertId(hostelId, "hostel ID");
    assertHostelAccess(req, hostelId);
    const h = await Hostel.findById(hostelId);
    if (!h) fail(404, "Hostel not found");
    name = h.name;
  }
  const [stats, previous] = await Promise.all([buildStats(hostelId, month), buildStats(hostelId, prevMonth(month))]);
  const { narrative, source } = await makeNarrative(stats, previous, name);
  const report = await Report.findOneAndUpdate(
    { hostel: hostelId, month },
    { hostel: hostelId, hostelName: name, month, stats, previous, narrative, source, generatedBy: req.user._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json(report);
});

const listReports = wrap(async (req, res) => {
  const filter = req.user.role === "admin" && req.user.hostel ? { hostel: req.user.hostel } : {};
  res.json(await Report.find(filter).select("hostel hostelName month source createdAt updatedAt").sort({ month: -1, updatedAt: -1 }).limit(60));
});

const getReport = wrap(async (req, res) => {
  assertId(req.params.id);
  const r = await Report.findById(req.params.id);
  if (!r) fail(404, "Report not found");
  if (r.hostel) assertHostelAccess(req, r.hostel);
  else if (req.user.role === "admin" && req.user.hostel) fail(403, "Only a superadmin can view the all-hostels report");
  res.json(r);
});

module.exports = { generateReport, listReports, getReport, buildStats, rulesNarrative, parseNarrative, makeNarrative };
