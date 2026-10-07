const Fee = require("../models/Fee");
const User = require("../models/User");
const Student = require("../models/Student");
const Room = require("../models/Room");
const notify = require("../utils/notify");
const { receiptPdf } = require("../utils/pdf");
const { wrap, fail, pick, assertId, hostelFilter, assertHostelAccess, assertOwnerOrAdmin, myStudent, monthStr, paginate, setTotal } = require("../utils/helpers");

const populate = (q) =>
  q.populate({ path: "student", select: "registrationNumber user", populate: { path: "user", select: "name email" } }).populate("hostel", "name code");

// Anything unpaid whose due date has passed becomes "overdue"
const markOverdue = () => Fee.updateMany({ status: "pending", dueDate: { $lt: new Date() } }, { status: "overdue" });

const createFee = wrap(async (req, res) => {
  const { student: studentId, feeType, amount, dueDate } = req.body;
  if (!studentId || !feeType || amount === undefined || !dueDate) fail(400, "student, feeType, amount and dueDate are required");
  assertId(studentId, "student ID");
  const student = await Student.findById(studentId);
  if (!student) fail(404, "Student not found");
  const hostel = student.hostel || req.body.hostel;
  if (!hostel) fail(400, "Student has no hostel yet. Allocate a room first.");
  assertHostelAccess(req, hostel);
  const lateFee = Number(req.body.lateFee) || 0;
  const fee = await Fee.create({
    ...pick(req.body, ["feeType", "month", "amount", "dueDate", "remarks"]),
    student: student._id, hostel, lateFee, totalAmount: Number(amount) + lateFee,
  });
  await notify.toStudent(student._id, { title: "New fee generated", message: `${feeType.replace("_", " ")} of Rs ${fee.totalAmount} is due on ${new Date(dueDate).toDateString()}.`, type: "warning", link: "/student/fees" });
  res.status(201).json(await populate(Fee.findById(fee._id)));
});

// POST /api/fees/generate-monthly { month?: "YYYY-MM", dueDate }  -> hostel fee for every allocated student
const generateMonthly = wrap(async (req, res) => {
  const month = req.body.month || monthStr();
  const dueDate = req.body.dueDate;
  if (!dueDate) fail(400, "dueDate is required");
  const filter = { room: { $ne: null }, status: "active", ...hostelFilter(req) };
  if (req.body.hostel && req.user.role === "superadmin") filter.hostel = req.body.hostel;
  const students = await Student.find(filter);
  let created = 0, skipped = 0;
  for (const s of students) {
    if (await Fee.exists({ student: s._id, feeType: "hostel_fee", month })) { skipped++; continue; }
    const room = await Room.findById(s.room);
    const rent = room?.monthlyRent || 0;
    await Fee.create({ student: s._id, hostel: s.hostel, feeType: "hostel_fee", month, amount: rent, totalAmount: rent, dueDate });
    await notify.toStudent(s._id, { title: "Monthly hostel fee", message: `Fee for ${month}: Rs ${rent}.`, type: "warning", link: "/student/fees" });
    created++;
  }
  res.status(201).json({ message: `Generated ${created} fee(s), skipped ${skipped} existing`, created, skipped });
});

const getFees = wrap(async (req, res) => {
  await markOverdue();
  const filter = hostelFilter(req);
  ["status", "feeType", "month", "student"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
  if (req.query.q) {
    const rx = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({ role: "student", name: rx }).select("_id");
    const studs = await Student.find({ $or: [{ registrationNumber: rx }, { user: { $in: users.map((u) => u._id) } }] }).select("_id");
    filter.student = { $in: studs.map((x) => x._id) };
  }
  const { limit, skip } = paginate(req, 25);
  await setTotal(res, Fee, filter);
  res.json(await populate(Fee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)));
});

const getMyFees = wrap(async (req, res) => {
  await markOverdue();
  const s = await myStudent(req);
  res.json(await populate(Fee.find({ student: s._id }).sort({ dueDate: -1 })));
});

const getFeeById = wrap(async (req, res) => {
  assertId(req.params.id);
  const fee = await populate(Fee.findById(req.params.id));
  if (!fee) fail(404, "Fee not found");
  await assertOwnerOrAdmin(req, fee.student._id, fee.hostel._id);
  res.json(fee);
});

const updateFee = wrap(async (req, res) => {
  assertId(req.params.id);
  const fee = await Fee.findById(req.params.id);
  if (!fee) fail(404, "Fee not found");
  assertHostelAccess(req, fee.hostel);
  if (fee.status === "paid") fail(400, "A paid fee cannot be edited");
  Object.assign(fee, pick(req.body, ["feeType", "month", "amount", "lateFee", "dueDate", "remarks"]));
  fee.totalAmount = Number(fee.amount) + Number(fee.lateFee || 0);
  if (fee.status === "overdue" && fee.dueDate > new Date()) fee.status = "pending";
  await fee.save();
  res.json(await populate(Fee.findById(fee._id)));
});

const deleteFee = wrap(async (req, res) => {
  assertId(req.params.id);
  const fee = await Fee.findByIdAndDelete(req.params.id);
  if (!fee) fail(404, "Fee not found");
  res.json({ message: "Fee deleted" });
});

const recordPayment = wrap(async (req, res) => {
  assertId(req.params.id);
  const fee = await Fee.findById(req.params.id);
  if (!fee) fail(404, "Fee not found");
  assertHostelAccess(req, fee.hostel);
  if (fee.status === "paid") fail(400, "Fee is already paid");
  const method = req.body.paymentMethod || "cash";
  if (!["cash", "bank_transfer", "easypaisa", "jazzcash", "card"].includes(method)) fail(400, "Invalid payment method");
  fee.status = "paid";
  fee.paidDate = new Date();
  fee.paymentMethod = method;
  fee.transactionId = req.body.transactionId;
  fee.receiptNumber = `RCP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  await fee.save();
  await notify.toStudent(fee.student, { title: "Payment received", message: `Receipt ${fee.receiptNumber} for Rs ${fee.totalAmount}.`, type: "success", link: "/student/fees" });
  res.json(await populate(Fee.findById(fee._id)));
});

// GET /api/fees/:id/receipt  -> PDF (paid fees only; student may download only their own)
const downloadReceipt = wrap(async (req, res) => {
  assertId(req.params.id);
  const fee = await populate(Fee.findById(req.params.id));
  if (!fee) fail(404, "Fee not found");
  await assertOwnerOrAdmin(req, fee.student._id, fee.hostel._id);
  if (fee.status !== "paid") fail(400, "A receipt is available only after the fee is paid");
  const student = await Student.findById(fee.student._id).populate("room", "roomNumber");
  const doc = receiptPdf(fee, student?.room);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="receipt-${fee.receiptNumber}.pdf"`);
  doc.pipe(res);
  doc.end();
});

module.exports = { downloadReceipt, createFee, generateMonthly, getFees, getMyFees, getFeeById, updateFee, deleteFee, recordPayment };
