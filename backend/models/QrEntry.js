const mongoose = require("mongoose");

const qrEntrySchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },

    type: {
      // "entry" when the student scans in, "exit" when they scan out
      type: String,
      enum: ["entry", "exit"],
      required: true,
    },

    scannedBy: {
      // the Security Guard (User) who performed the scan
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },

    isLateEntry: {
      // flagged true if entry happens after the hostel's curfew time
      type: Boolean,
      default: false,
    },

    remarks: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QrEntry", qrEntrySchema);
