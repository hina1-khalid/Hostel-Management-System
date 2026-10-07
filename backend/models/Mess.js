const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

const MessMenu = mongoose.model(
  "MessMenu",
  new mongoose.Schema(
    {
      hostel: { type: OID, ref: "Hostel", required: true },
      day: { type: String, enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"], required: true },
      breakfast: { type: String, trim: true, default: "" },
      lunch: { type: String, trim: true, default: "" },
      dinner: { type: String, trim: true, default: "" },
      updatedBy: { type: OID, ref: "User" },
    },
    { timestamps: true }
  ).index({ hostel: 1, day: 1 }, { unique: true })
);

const MessAttendance = mongoose.model(
  "MessAttendance",
  new mongoose.Schema(
    {
      student: { type: OID, ref: "Student", required: true },
      hostel: { type: OID, ref: "Hostel", required: true },
      date: { type: String, required: true }, // YYYY-MM-DD
      meal: { type: String, enum: ["breakfast", "lunch", "dinner"], required: true },
      status: { type: String, enum: ["booked", "taken", "cancelled"], default: "booked" },
    },
    { timestamps: true }
  ).index({ student: 1, date: 1, meal: 1 }, { unique: true })
);

const MessFeedback = mongoose.model(
  "MessFeedback",
  new mongoose.Schema(
    {
      student: { type: OID, ref: "Student", required: true },
      hostel: { type: OID, ref: "Hostel", required: true },
      date: { type: String, required: true },
      meal: { type: String, enum: ["breakfast", "lunch", "dinner"], required: true },
      rating: { type: Number, min: 1, max: 5, required: true },
      comment: { type: String, trim: true, default: "" },
    },
    { timestamps: true }
  ).index({ student: 1, date: 1, meal: 1 }, { unique: true })
);

const MessBill = mongoose.model(
  "MessBill",
  new mongoose.Schema(
    {
      student: { type: OID, ref: "Student", required: true },
      hostel: { type: OID, ref: "Hostel", required: true },
      month: { type: String, required: true }, // YYYY-MM
      mealsCount: { type: Number, default: 0 },
      ratePerMeal: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      status: { type: String, enum: ["pending", "paid"], default: "pending" },
      paidDate: { type: Date },
    },
    { timestamps: true }
  ).index({ student: 1, month: 1 }, { unique: true })
);

module.exports = { MessMenu, MessAttendance, MessFeedback, MessBill };
