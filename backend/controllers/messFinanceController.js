const { MessExpense, MessStockItem, MessStockMove, EXPENSE_CATEGORIES, STOCK_CATEGORIES } = require("../models/MessFinance");
const { MessBill, MessAttendance } = require("../models/Mess");
const notify = require("../utils/notify");
const { wrap, fail, pick, assertId, hostelFilter, assertHostelAccess, bodyHostel, dateStr, monthStr } = require("../utils/helpers");

const round1 = (n) => Math.round(n * 10) / 10;
const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
const monthCheck = (m) => { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) fail(400, "month must be YYYY-MM"); return m; };
const oneOf = (v, list, label) => { if (v !== undefined && !list.includes(v)) fail(400, `${label} must be one of: ${list.join(", ")}`); };

// ---------------- Expenses ----------------
const listExpenses = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  const month = monthCheck(req.query.month || monthStr());
  filter.date = new RegExp(`^${month}`);
  if (req.query.category) filter.category = req.query.category;
  const items = await MessExpense.find(filter).populate("hostel", "name code").sort({ date: -1, createdAt: -1 }).limit(500);
  res.json({ month, total: sum(items, (e) => e.amount), items });
});

const createExpense = wrap(async (req, res) => {
  const hostel = bodyHostel(req);
  oneOf(req.body.category, EXPENSE_CATEGORIES, "category");
  const date = req.body.date || dateStr();
  if (date > dateStr()) fail(400, "date cannot be in the future");
  const e = await MessExpense.create({ hostel, date, category: req.body.category || "other", description: req.body.description, amount: req.body.amount, paidTo: req.body.paidTo, createdBy: req.user._id });
  res.status(201).json(e);
});

const deleteExpense = wrap(async (req, res) => {
  assertId(req.params.id);
  const e = await MessExpense.findById(req.params.id);
  if (!e) fail(404, "Expense not found");
  assertHostelAccess(req, e.hostel);
  if (e.source === "payroll") fail(400, "This expense comes from a paid salary and cannot be deleted here");
  await e.deleteOne();
  res.json({ message: "Expense deleted" });
});

// ---------------- Stock ----------------
const withLow = (i) => ({ ...i.toJSON(), low: i.quantity <= i.minQuantity });

const listStock = wrap(async (req, res) => {
  const items = await MessStockItem.find(hostelFilter(req)).populate("hostel", "name code").sort({ name: 1 });
  res.json(items.map(withLow));
});

const createItem = wrap(async (req, res) => {
  const hostel = bodyHostel(req);
  oneOf(req.body.category, STOCK_CATEGORIES, "category");
  const item = await MessStockItem.create({ hostel, ...pick(req.body, ["name", "category", "unit", "quantity", "minQuantity"]) });
  res.status(201).json(withLow(item));
});

const updateItem = wrap(async (req, res) => {
  assertId(req.params.id);
  const item = await MessStockItem.findById(req.params.id);
  if (!item) fail(404, "Item not found");
  assertHostelAccess(req, item.hostel);
  oneOf(req.body.category, STOCK_CATEGORIES, "category");
  Object.assign(item, pick(req.body, ["name", "category", "unit", "minQuantity"]));
  await item.save();
  res.json(withLow(item));
});

const deleteItem = wrap(async (req, res) => {
  assertId(req.params.id);
  const item = await MessStockItem.findById(req.params.id);
  if (!item) fail(404, "Item not found");
  assertHostelAccess(req, item.hostel);
  await MessStockMove.deleteMany({ item: item._id });
  await item.deleteOne();
  res.json({ message: "Item deleted" });
});

// POST /api/mess-finance/stock/:id/move { type: "in"|"out"|"adjust", quantity, cost?, note? }
//   in     -> add stock (a cost also creates a mess expense)
//   out    -> use stock (cannot go below zero)
//   adjust -> set the counted quantity (stock-take)
const moveStock = wrap(async (req, res) => {
  assertId(req.params.id);
  const { type, quantity, cost = 0, note } = req.body;
  const item = await MessStockItem.findById(req.params.id);
  if (!item) fail(404, "Item not found");
  assertHostelAccess(req, item.hostel);
  if (type !== "adjust" && !(quantity > 0)) fail(400, "quantity must be greater than 0");
  const before = item.quantity;
  let after;
  if (type === "in") {
    after = (await MessStockItem.findByIdAndUpdate(item._id, { $inc: { quantity } }, { new: true })).quantity;
  } else if (type === "out") {
    const updated = await MessStockItem.findOneAndUpdate({ _id: item._id, quantity: { $gte: quantity } }, { $inc: { quantity: -quantity } }, { new: true });
    if (!updated) fail(400, `Only ${before} ${item.unit} of ${item.name} left`);
    after = updated.quantity;
  } else {
    after = (await MessStockItem.findByIdAndUpdate(item._id, { quantity }, { new: true })).quantity;
  }
  await MessStockMove.create({ item: item._id, hostel: item.hostel, type, quantity, resultingQuantity: after, cost: type === "in" ? cost : 0, note, by: req.user._id });
  if (type === "in" && cost > 0) {
    await MessExpense.create({ hostel: item.hostel, date: dateStr(), category: item.category, description: `Purchased ${quantity} ${item.unit} ${item.name}`, amount: cost, source: "stock", createdBy: req.user._id });
  }
  if (type !== "in" && before > item.minQuantity && after <= item.minQuantity) {
    await notify.toAdmins(item.hostel, { title: `Low stock: ${item.name}`, message: `Only ${after} ${item.unit} left (alert level ${item.minQuantity}).`, type: "warning", link: "/admin/mess" });
  }
  res.json(withLow(await MessStockItem.findById(item._id)));
});

const stockHistory = wrap(async (req, res) => {
  assertId(req.params.id);
  const item = await MessStockItem.findById(req.params.id);
  if (!item) fail(404, "Item not found");
  assertHostelAccess(req, item.hostel);
  res.json(await MessStockMove.find({ item: item._id }).populate("by", "name").sort({ createdAt: -1 }).limit(50));
});

// ---------------- Cost analysis ----------------
const monthsBack = (month, n) => {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => monthStr(new Date(y, m - 1 - (n - 1 - i), 15)));
};

// GET /api/mess-finance/summary?month=YYYY-MM  -> spending, cost per meal, billing and profit/loss
const analysis = wrap(async (req, res) => {
  const month = monthCheck(req.query.month || monthStr());
  const hf = hostelFilter(req);
  const months = monthsBack(month, 6);
  const [expenses, bills, meals, items, trendExp, trendBills] = await Promise.all([
    MessExpense.find({ ...hf, date: new RegExp(`^${month}`) }),
    MessBill.find({ ...hf, month }),
    MessAttendance.countDocuments({ ...hf, date: new RegExp(`^${month}`), status: { $in: ["booked", "taken"] } }),
    MessStockItem.find(hf),
    MessExpense.find({ ...hf, date: { $gte: `${months[0]}-01`, $lte: `${month}-31` } }).select("date amount"),
    MessBill.find({ ...hf, month: { $in: months } }).select("month amount"),
  ]);
  const spent = sum(expenses, (e) => e.amount);
  const billed = sum(bills, (b) => b.amount);
  const collected = sum(bills.filter((b) => b.status === "paid"), (b) => b.amount);
  const byCat = {};
  expenses.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
  res.json({
    month, spent, mealsServed: meals, costPerMeal: meals ? round1(spent / meals) : null,
    billed, collected, profit: billed - spent, // billed minus spending: positive = surplus, negative = loss
    avgBilledPerMeal: meals ? round1(billed / meals) : null,
    byCategory: Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    lowStock: items.filter((i) => i.quantity <= i.minQuantity).length,
    trend: months.map((m) => ({ month: m, spent: sum(trendExp.filter((e) => e.date.startsWith(m)), (e) => e.amount), billed: sum(trendBills.filter((b) => b.month === m), (b) => b.amount) })),
  });
});

module.exports = { listExpenses, createExpense, deleteExpense, listStock, createItem, updateItem, deleteItem, moveStock, stockHistory, analysis };
