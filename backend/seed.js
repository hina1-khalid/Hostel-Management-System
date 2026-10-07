// Demo data loader.  Usage:  npm run seed          (only if the database is empty)
//                            npm run seed -- --force (wipes everything first!)
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Hostel = require("./models/Hostel");
const Room = require("./models/Room");
const Student = require("./models/Student");
const Fee = require("./models/Fee");
const Complaint = require("./models/Complaint");
const Notice = require("./models/Notice");
const Inventory = require("./models/Inventory");
const { MessMenu, MessAttendance } = require("./models/Mess");
const { LaundryMachine, LaundrySlot } = require("./models/Laundry");
const { dateStr } = require("./utils/helpers");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  if (await User.exists({})) {
    if (!process.argv.includes("--force")) {
      console.log("⚠️  Database already has data. Run `npm run seed -- --force` to wipe and reseed.");
      return;
    }
  }

  // Start from a clean slate: drop every collection (this also removes stale indexes left by older versions of the
  // project), then rebuild the indexes our models need. Works with a plain "read and write" Atlas user.
  for (const c of await mongoose.connection.db.collections()) await c.drop().catch(() => {});
  // make sure EVERY model is registered, so every collection gets its indexes back (unique rules, TTL, ...)
  require("fs").readdirSync(__dirname + "/models").filter((f) => f.endsWith(".js")).forEach((f) => require("./models/" + f));
  for (const m of Object.values(mongoose.models)) {
    try { await m.syncIndexes(); } catch (e) { console.warn(`⚠️  Could not build all indexes for ${m.modelName}: ${e.message}`); }
  }
  console.log("🧹 Database cleaned");

  const [iqbal, fatima] = await Hostel.create([
    { name: "Iqbal Hostel", code: "IQB", type: "boys", address: "North Campus", totalFloors: 2, contactNumber: "021-111-0001" },
    { name: "Fatima Jinnah Hostel", code: "FJH", type: "girls", address: "South Campus", totalFloors: 2, contactNumber: "021-111-0002" },
  ]);

  const mk = (hostel, nums, floor, capacity, rent, type) => nums.map((n) => ({ hostel: hostel._id, roomNumber: n, floor, capacity, roomType: type, monthlyRent: rent, amenities: ["Fan", "Wi-Fi"] }));
  const rooms = await Room.create([
    ...mk(iqbal, ["101", "102", "103"], 1, 2, 8000, "double"),
    ...mk(iqbal, ["201", "202"], 2, 3, 6500, "triple"),
    ...mk(fatima, ["101", "102", "103"], 1, 2, 8500, "double"),
    ...mk(fatima, ["201"], 2, 3, 7000, "triple"),
  ]);
  const room = (h, n) => rooms.find((r) => String(r.hostel) === String(h._id) && r.roomNumber === n);

  const superadmin = await User.create({ name: "Super Admin", email: "admin@hostel.com", password: "Admin@123", role: "superadmin" });
  const warden = await User.create({ name: "Warden Iqbal", email: "warden@hostel.com", password: "Warden@123", role: "admin", hostel: iqbal._id });
  const wardenF = await User.create({ name: "Warden Fatima", email: "warden.f@hostel.com", password: "Warden@123", role: "admin", hostel: fatima._id });
  await User.create({ name: "Gate Guard", email: "guard@hostel.com", password: "Guard@123", role: "security" });
  await Hostel.updateOne({ _id: iqbal._id }, { warden: warden._id });
  await Hostel.updateOne({ _id: fatima._id }, { warden: wardenF._id });

  const people = [
    ["Ali Khan", "ali@student.com", "male", "CS-2023-001", "Computer Science", 5, iqbal, "101"],
    ["Hamza Sheikh", "hamza@student.com", "male", "CS-2023-002", "Computer Science", 5, iqbal, "101"],
    ["Usman Raza", "usman@student.com", "male", "EE-2022-014", "Electrical Engineering", 7, iqbal, "102"],
    ["Bilal Ahmed", "bilal@student.com", "male", "BBA-2024-020", "Business Administration", 3, null, null],
    ["Ayesha Noor", "ayesha@student.com", "female", "CS-2023-045", "Computer Science", 5, fatima, "101"],
    ["Sana Malik", "sana@student.com", "female", "SE-2022-033", "Software Engineering", 7, fatima, "102"],
  ];
  const students = [];
  for (const [name, email, gender, reg, dept, sem, hostel, rn] of people) {
    const user = await User.create({ name, email, password: "Student@123", role: "student", phone: "0300-1234567" });
    const st = await Student.create({
      user: user._id, registrationNumber: reg, department: dept, semester: sem, gender,
      guardianName: "Guardian of " + name.split(" ")[0], guardianPhone: "0321-7654321",
      ...(hostel ? { hostel: hostel._id, room: room(hostel, rn)._id, allocationStatus: "allocated", allocatedAt: new Date() } : {}),
    });
    if (hostel) await Room.updateOne({ _id: room(hostel, rn)._id }, { $inc: { occupiedBeds: 1 } });
    students.push(st);
  }
  for (const r of await Room.find()) if (r.occupiedBeds >= r.capacity) await Room.updateOne({ _id: r._id }, { status: "full" });

  const day = 86400000;
  const allocated = students.filter((s) => s.room);
  for (const s of allocated) {
    const rent = (await Room.findById(s.room)).monthlyRent;
    await Fee.create({ student: s._id, hostel: s.hostel, feeType: "hostel_fee", month: dateStr().slice(0, 7), amount: rent, totalAmount: rent, dueDate: new Date(Date.now() + 10 * day) });
  }
  await Fee.create({ student: allocated[0]._id, hostel: allocated[0].hostel, feeType: "electricity", month: "previous", amount: 1200, totalAmount: 1200, dueDate: new Date(Date.now() - 5 * day), status: "overdue" });
  await Fee.create({ student: allocated[1]._id, hostel: allocated[1].hostel, feeType: "hostel_fee", month: "previous", amount: 8000, totalAmount: 8000, dueDate: new Date(Date.now() - 30 * day), status: "paid", paidDate: new Date(Date.now() - 28 * day), paymentMethod: "cash", receiptNumber: "RCP-DEMO-0001" });

  await Complaint.create([
    { student: allocated[0]._id, hostel: allocated[0].hostel, room: allocated[0].room, category: "electricity", priority: "high", title: "Fan sparking in room", description: "The ceiling fan is making sparks, urgent." },
    { student: allocated[2]._id, hostel: allocated[2].hostel, room: allocated[2].room, category: "internet", priority: "medium", title: "WiFi very slow", description: "Internet is slow on second floor since Monday." },
  ]);
  await Notice.create([
    { title: "Welcome to the new semester", content: "Please complete your fee payments before the due date. Hostel office is open 9 AM to 5 PM.", category: "general", postedBy: superadmin._id, isPinned: true },
    { title: "Water supply maintenance", content: "Water supply will be off tomorrow from 10 AM to 1 PM for tank cleaning.", category: "maintenance", hostel: iqbal._id, postedBy: warden._id },
  ]);

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const meals = [["Paratha & Omelette", "Chicken Biryani", "Daal Chawal"], ["Halwa Puri", "Aloo Gosht & Roti", "Chicken Karahi"], ["Egg & Toast", "Daal Mash & Roti", "Mix Sabzi"]];
  for (const h of [iqbal, fatima])
    await MessMenu.create(days.map((d, i) => ({ hostel: h._id, day: d, breakfast: meals[i % 3][0], lunch: meals[i % 3][1], dinner: meals[i % 3][2] })));
  for (const s of allocated) await MessAttendance.create(["breakfast", "lunch"].map((meal) => ({ student: s._id, hostel: s.hostel, date: dateStr(), meal, status: "booked" })));

  for (const h of [iqbal, fatima]) {
    const ms = await LaundryMachine.create([{ hostel: h._id, name: "Washer 1", type: "washer" }, { hostel: h._id, name: "Dryer 1", type: "dryer" }]);
    for (const m of ms)
      for (const offset of [0, 1])
        for (const hr of [8, 10, 12, 14, 16, 18])
          await LaundrySlot.create({ machine: m._id, hostel: h._id, date: dateStr(new Date(Date.now() + offset * day)), startTime: `${String(hr).padStart(2, "0")}:00`, endTime: `${String(hr + 2).padStart(2, "0")}:00` });
  }
  await Inventory.create([
    { hostel: iqbal._id, itemName: "Single Bed", category: "furniture", quantity: 12, condition: "good", purchasePrice: 15000 },
    { hostel: iqbal._id, itemName: "Ceiling Fan", category: "electrical", quantity: 8, condition: "fair", purchasePrice: 9000 },
    { hostel: iqbal._id, itemName: "Water Cooler", category: "appliance", quantity: 2, condition: "damaged", purchasePrice: 45000, notes: "Compressor issue" },
    { hostel: fatima._id, itemName: "Mattress", category: "bedding", quantity: 10, condition: "new", purchasePrice: 7000 },
  ]);

  console.log(`
✅ Demo data created. Login accounts:
   Super Admin : admin@hostel.com      / Admin@123
   Warden      : warden@hostel.com     / Warden@123   (Iqbal Hostel only)
   Security    : guard@hostel.com      / Guard@123
   Student     : ali@student.com       / Student@123  (also hamza, usman, ayesha, sana; bilal has no room)
`);
};

run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect());
