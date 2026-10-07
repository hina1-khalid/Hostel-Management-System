// Adds sample data for Maintenance, Mess stock/expenses and Payroll (does NOT wipe anything).
//   npm run seed:extras        (run once, after `npm run seed`)
require("dotenv").config();
const mongoose = require("mongoose");
const Hostel = require("./models/Hostel");
const User = require("./models/User");
const MaintenanceTask = require("./models/Maintenance");
const { MessExpense, MessStockItem, MessStockMove } = require("./models/MessFinance");
const { StaffMember, StaffAttendance, Payroll } = require("./models/Workforce");
const { calcPayroll } = require("./services/payroll");
const { dateStr, addDays, toDate, monthStr } = require("./utils/helpers");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  if (await StaffMember.exists({})) return console.log("⚠️  Sample workers already exist, nothing added.");
  const hostels = await Hostel.find().sort({ name: 1 });
  if (!hostels.length) return console.log("⚠️  Run `npm run seed` first.");
  const admin = await User.findOne({ role: "superadmin" });
  const today = dateStr();
  const month = monthStr();
  const day = Number(today.slice(8, 10));
  const inThisMonth = (back) => `${month}-${String(Math.max(1, day - back)).padStart(2, "0")}`;
  const prev = monthStr(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15));

  for (const h of hostels) {
    // ---- maintenance
    await MaintenanceTask.create([
      { hostel: h._id, title: "Service all ACs", category: "ac", intervalDays: 90, assignedTo: "CoolTech Services", estimatedCost: 12000, nextDueAt: toDate(addDays(today, 5)) },
      { hostel: h._id, title: "Clean overhead water tank", category: "water_tank", intervalDays: 30, assignedTo: "Maintenance staff", estimatedCost: 3000, nextDueAt: toDate(addDays(today, -3)) },
      { hostel: h._id, title: "Geyser descaling", category: "geyser", intervalDays: 60, estimatedCost: 4500, lastDoneAt: toDate(addDays(today, -20)), nextDueAt: toDate(addDays(today, 40)),
        history: [{ doneAt: toDate(addDays(today, -20)), doneBy: admin._id, cost: 4500, notes: "All geysers descaled" }] },
      { hostel: h._id, title: "Pest control spray", category: "pest_control", intervalDays: 180, assignedTo: "SafeHome Pest Control", nextDueAt: toDate(addDays(today, 60)) },
    ]);

    // ---- mess stock + expenses
    const items = await MessStockItem.create([
      { hostel: h._id, name: "Basmati rice", category: "grocery", unit: "kg", quantity: 40, minQuantity: 25 },
      { hostel: h._id, name: "Wheat flour", category: "grocery", unit: "kg", quantity: 18, minQuantity: 25 },
      { hostel: h._id, name: "Cooking oil", category: "grocery", unit: "litre", quantity: 20, minQuantity: 10 },
      { hostel: h._id, name: "Sugar", category: "grocery", unit: "kg", quantity: 8, minQuantity: 5 },
      { hostel: h._id, name: "Gas cylinder", category: "gas", unit: "piece", quantity: 2, minQuantity: 1 },
    ]);
    await MessStockMove.create(items.map((i) => ({ item: i._id, hostel: h._id, type: "adjust", quantity: i.quantity, resultingQuantity: i.quantity, note: "Opening stock", by: admin._id })));
    await MessExpense.create([
      { hostel: h._id, date: inThisMonth(1), category: "grocery", description: "Basmati rice 50 kg", amount: 15000, paidTo: "City Karyana Store", createdBy: admin._id },
      { hostel: h._id, date: inThisMonth(3), category: "meat", description: "Chicken 40 kg", amount: 24000, paidTo: "Al-Madina Meat Shop", createdBy: admin._id },
      { hostel: h._id, date: inThisMonth(4), category: "vegetables", description: "Weekly vegetables", amount: 8500, paidTo: "Sabzi Mandi", createdBy: admin._id },
      { hostel: h._id, date: inThisMonth(6), category: "dairy", description: "Milk and yogurt", amount: 6200, paidTo: "Fresh Dairy", createdBy: admin._id },
      { hostel: h._id, date: inThisMonth(8), category: "gas", description: "2 LPG cylinders", amount: 9000, paidTo: "Gas agency", createdBy: admin._id },
    ]);

    // ---- workers, last month's attendance exceptions, last month's salaries (still pending so you can try "Pay")
    const people = await StaffMember.create([
      { hostel: h._id, name: "Ramzan Ali", role: "cook", phone: "0300-1112223", joiningDate: "2024-03-01", monthlySalary: 32000, messStaff: true },
      { hostel: h._id, name: "Bashir Khan", role: "cleaner", phone: "0301-4445556", joiningDate: "2024-06-15", monthlySalary: 18000 },
      { hostel: h._id, name: "Gul Zaman", role: "guard", phone: "0302-7778889", joiningDate: "2023-11-01", monthlySalary: 22000 },
    ]);
    const d = (n) => `${prev}-${String(n).padStart(2, "0")}`;
    const marks = [[1, 5, "absent"], [1, 6, "absent"], [1, 12, "half_day"], [0, 9, "leave"], [2, 20, "leave"], [2, 21, "leave"], [2, 22, "leave"]];
    await StaffAttendance.create(marks.map(([i, n, status]) => ({ staff: people[i]._id, hostel: h._id, date: d(n), status, markedBy: admin._id })));
    for (const p of people) {
      const records = await StaffAttendance.find({ staff: p._id, date: new RegExp(`^${prev}`) }).select("date status");
      await Payroll.create({ staff: p._id, hostel: h._id, month: prev, ...calcPayroll({ monthlySalary: p.monthlySalary, joiningDate: p.joiningDate, month: prev, records }) });
    }
  }
  console.log(`✅ Sample data added for ${hostels.length} hostel(s): maintenance jobs, mess stock and expenses, workers, attendance and ${prev} salaries (pending).`);
};

run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect());
