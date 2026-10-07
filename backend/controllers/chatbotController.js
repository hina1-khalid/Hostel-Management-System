const Student = require("../models/Student");
const Fee = require("../models/Fee");
const Complaint = require("../models/Complaint");
const Leave = require("../models/Leave");
const Notice = require("../models/Notice");
const { MessMenu } = require("../models/Mess");
const { wrap, fail, dayName, isAdmin } = require("../utils/helpers");

const HOSTEL_RULES = [
  "Curfew: students must be inside the hostel by 10:00 PM; later entries are logged as late entries.",
  "Visitors must be registered at the gate with CNIC and approved before entering.",
  "Leave must be applied for through the portal and approved by the warden.",
  "Complaints can be filed from the Complaints page; urgent ones are flagged automatically.",
];

// Gather the signed-in student's own data so the assistant can answer personally
const studentContext = async (user) => {
  const s = await Student.findOne({ user: user._id }).populate("hostel", "name").populate("room", "roomNumber floor monthlyRent");
  if (!s) return { name: user.name, note: "No student profile yet" };
  const [fees, complaints, leaves, notices, menu] = await Promise.all([
    Fee.find({ student: s._id, status: { $ne: "paid" } }).select("feeType totalAmount dueDate status"),
    Complaint.find({ student: s._id, status: { $in: ["pending", "in_progress"] } }).select("title status"),
    Leave.find({ student: s._id, status: { $in: ["pending", "approved"] }, toDate: { $gte: new Date() } }).select("fromDate toDate status"),
    Notice.find({ $or: [{ hostel: null }, { hostel: s.hostel?._id }] }).sort({ createdAt: -1 }).limit(3).select("title"),
    s.hostel ? MessMenu.findOne({ hostel: s.hostel._id, day: dayName() }) : null,
  ]);
  return {
    name: user.name, registrationNumber: s.registrationNumber, hostel: s.hostel?.name || "not allocated",
    room: s.room ? `Room ${s.room.roomNumber}, floor ${s.room.floor}, rent Rs ${s.room.monthlyRent}/month` : "not allocated",
    unpaidFees: fees.map((f) => ({ type: f.feeType, amount: f.totalAmount, due: f.dueDate.toDateString(), status: f.status })),
    openComplaints: complaints.map((c) => ({ title: c.title, status: c.status })),
    upcomingLeaves: leaves.map((l) => ({ from: l.fromDate.toDateString(), to: l.toDate.toDateString(), status: l.status })),
    latestNotices: notices.map((n) => n.title),
    todaysMenu: menu ? { breakfast: menu.breakfast, lunch: menu.lunch, dinner: menu.dinner } : "not published yet",
  };
};

// Used when no ANTHROPIC_API_KEY is configured, so the widget still works offline
const ruleBased = (msg, ctx) => {
  const t = msg.toLowerCase();
  const has = (...w) => w.some((x) => t.includes(x));
  if (has("fee", "fees", "due", "payment", "pay")) {
    if (!ctx.unpaidFees) return "Fees are shown on your Fees page. Pending items must be paid at the hostel office.";
    return ctx.unpaidFees.length
      ? "You have unpaid fees: " + ctx.unpaidFees.map((f) => `${f.type.replace("_", " ")} Rs ${f.amount} (due ${f.due})`).join("; ") + "."
      : "Great news, you have no unpaid fees right now.";
  }
  if (has("room", "bed", "hostel")) return ctx.room ? `You are in ${ctx.hostel}, ${ctx.room}.` : "Room details are on the My Room page.";
  if (has("menu", "mess", "food", "lunch", "dinner", "breakfast")) {
    const m = ctx.todaysMenu;
    return m && typeof m === "object" ? `Today: breakfast ${m.breakfast || "-"}, lunch ${m.lunch || "-"}, dinner ${m.dinner || "-"}.` : "Today's menu has not been published yet.";
  }
  if (has("complaint", "problem", "broken", "repair"))
    return ctx.openComplaints?.length ? `You have ${ctx.openComplaints.length} open complaint(s): ${ctx.openComplaints.map((c) => c.title).join(", ")}.` : "You have no open complaints. You can file one from the Complaints page.";
  if (has("leave", "holiday", "home")) return ctx.upcomingLeaves?.length ? `Your leave: ${ctx.upcomingLeaves.map((l) => `${l.from} to ${l.to} (${l.status})`).join("; ")}.` : "You have no upcoming leave. Apply from the Leave page.";
  if (has("curfew", "rule", "visitor", "timing", "late")) return HOSTEL_RULES.join(" ");
  if (has("laundry", "washing")) return "Book a washing machine slot from the Laundry page. One booking per day is allowed.";
  if (has("notice", "announcement")) return ctx.latestNotices?.length ? `Latest notices: ${ctx.latestNotices.join("; ")}.` : "No new notices.";
  return "I can help with your fees, room, mess menu, complaints, leave, laundry, notices and hostel rules. What would you like to know?";
};

const askClaude = async (system, messages) => {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: 500, system, messages }),
  });
  if (!r.ok) throw new Error(`Claude API ${r.status}`);
  const data = await r.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
};

// POST /api/chatbot { message, history?: [{role, content}] }
const chat = wrap(async (req, res) => {
  const message = (req.body.message || "").trim();
  if (!message) fail(400, "Message is required");
  if (message.length > 1000) fail(400, "Message is too long");
  const ctx = isAdmin(req.user) || req.user.role === "security" ? { name: req.user.name, role: req.user.role } : await studentContext(req.user);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const history = (Array.isArray(req.body.history) ? req.body.history : [])
        .filter((m) => ["user", "assistant"].includes(m.role) && typeof m.content === "string").slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
      while (history.length && history[0].role !== "user") history.shift();
      const system = `You are the friendly assistant of a university Hostel Management System. Answer briefly (max 4 sentences), in the same language the user writes (English, Urdu or Roman Urdu). Use only the data below; if something is not in the data, say you don't know and suggest contacting the hostel office. Never invent fees, dates or rules.\n\nHostel rules:\n- ${HOSTEL_RULES.join("\n- ")}\n\nSigned-in user data (JSON):\n${JSON.stringify(ctx)}`;
      return res.json({ reply: await askClaude(system, [...history, { role: "user", content: message }]), source: "claude" });
    } catch (e) {
      console.error("Chatbot fell back to rules:", e.message);
    }
  }
  res.json({ reply: ruleBased(message, ctx), source: "rules" });
});

module.exports = { chat };
