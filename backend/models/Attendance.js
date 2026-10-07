const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
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

    date: {
      // stored as "YYYY-MM-DD" for easy per-day querying
      type: String,
      required: true,
    },

    session: {
      type: String,
      enum: ["morning", "evening", "night"],
      required: true,
    },

    status: {
      type: String,
      enum: ["present", "absent", "late"],
      default: "present",
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    remarks: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate attendance entries for the same student/date/session
attendanceSchema.index({ student: 1, date: 1, session: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
