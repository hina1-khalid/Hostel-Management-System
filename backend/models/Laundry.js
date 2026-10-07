const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

const LaundryMachine = mongoose.model(
  "LaundryMachine",
  new mongoose.Schema(
    {
      hostel: { type: OID, ref: "Hostel", required: true },
      name: { type: String, required: [true, "Machine name is required"], trim: true },
      type: { type: String, enum: ["washer", "dryer"], default: "washer" },
      status: { type: String, enum: ["available", "maintenance"], default: "available" },
    },
    { timestamps: true }
  )
);

const LaundrySlot = mongoose.model(
  "LaundrySlot",
  new mongoose.Schema(
    {
      machine: { type: OID, ref: "LaundryMachine", required: true },
      hostel: { type: OID, ref: "Hostel", required: true },
      date: { type: String, required: true }, // YYYY-MM-DD
      startTime: { type: String, required: true }, // HH:MM
      endTime: { type: String, required: true },
      isBooked: { type: Boolean, default: false },
    },
    { timestamps: true }
  ).index({ machine: 1, date: 1, startTime: 1 }, { unique: true })
);

const LaundryBooking = mongoose.model(
  "LaundryBooking",
  new mongoose.Schema(
    {
      slot: { type: OID, ref: "LaundrySlot", required: true },
      machine: { type: OID, ref: "LaundryMachine", required: true },
      student: { type: OID, ref: "Student", required: true },
      hostel: { type: OID, ref: "Hostel", required: true },
      date: { type: String, required: true },
      status: { type: String, enum: ["booked", "completed", "cancelled", "no_show"], default: "booked" },
      notes: { type: String, trim: true },
    },
    { timestamps: true }
  )
);

module.exports = { LaundryMachine, LaundrySlot, LaundryBooking };
