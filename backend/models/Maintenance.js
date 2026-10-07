const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

// A repeating maintenance job (e.g. "Service all ACs" every 90 days).
const s = new mongoose.Schema(
  {
    hostel: { type: OID, ref: "Hostel", required: true },
    title: { type: String, required: [true, "Title is required"], trim: true },
    category: { type: String, enum: ["ac", "geyser", "water_tank", "pest_control", "electrical", "plumbing", "cleaning", "fire_safety", "generator", "other"], default: "other" },
    notes: { type: String, trim: true },
    intervalDays: { type: Number, required: true, min: [1, "Interval must be at least 1 day"] },
    nextDueAt: { type: Date, required: true },
    lastDoneAt: { type: Date },
    assignedTo: { type: String, trim: true }, // person or vendor
    estimatedCost: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    lastReminderOn: { type: String }, // YYYY-MM-DD, so a reminder goes out at most once a day
    history: [{ doneAt: Date, doneBy: { type: OID, ref: "User" }, cost: { type: Number, default: 0 }, notes: String }],
  },
  { timestamps: true }
);
module.exports = mongoose.model("MaintenanceTask", s);
