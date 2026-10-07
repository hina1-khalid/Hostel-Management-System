const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

// Hostel workers (cook, cleaner, guard...). They do NOT log in, so they are separate from User accounts.
const StaffMember = mongoose.model(
  "StaffMember",
  new mongoose.Schema(
    {
      hostel: { type: OID, ref: "Hostel", required: true },
      name: { type: String, required: [true, "Name is required"], trim: true },
      role: { type: String, enum: ["cook", "cleaner", "guard", "gardener", "driver", "helper", "other"], default: "other" },
      phone: { type: String, trim: true },
      cnic: { type: String, trim: true },
      joiningDate: { type: Date, required: true },
      monthlySalary: { type: Number, required: true, min: [1, "Salary must be greater than 0"] },
      messStaff: { type: Boolean, default: false }, // salary counts as a mess cost (e.g. cooks)
      isActive: { type: Boolean, default: true },
      notes: { type: String, trim: true },
    },
    { timestamps: true }
  )
);

// Only exceptions are recorded: a day without a record counts as "present".
const StaffAttendance = mongoose.model(
  "StaffAttendance",
  new mongoose.Schema(
    {
      staff: { type: OID, ref: "StaffMember", required: true },
      hostel: { type: OID, ref: "Hostel", required: true },
      date: { type: String, required: true }, // YYYY-MM-DD
      status: { type: String, enum: ["present", "absent", "half_day", "leave"], required: true },
      markedBy: { type: OID, ref: "User" },
    },
    { timestamps: true }
  ).index({ staff: 1, date: 1 }, { unique: true })
);

const Payroll = mongoose.model(
  "Payroll",
  new mongoose.Schema(
    {
      staff: { type: OID, ref: "StaffMember", required: true },
      hostel: { type: OID, ref: "Hostel", required: true },
      month: { type: String, required: true }, // YYYY-MM
      baseSalary: { type: Number, required: true }, // monthly salary, prorated if the person joined mid-month
      daysInMonth: Number,
      presentDays: Number,
      halfDays: { type: Number, default: 0 },
      absentDays: { type: Number, default: 0 },
      leaveDays: { type: Number, default: 0 },
      unpaidLeaveDays: { type: Number, default: 0 },
      deduction: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      advance: { type: Number, default: 0 },
      netSalary: { type: Number, required: true },
      note: { type: String, trim: true },
      status: { type: String, enum: ["pending", "paid"], default: "pending" },
      paidDate: Date,
      paymentMethod: { type: String, enum: ["cash", "bank_transfer", "easypaisa", "jazzcash"] },
    },
    { timestamps: true }
  ).index({ staff: 1, month: 1 }, { unique: true })
);

module.exports = { StaffMember, StaffAttendance, Payroll };
