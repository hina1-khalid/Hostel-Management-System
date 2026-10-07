const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
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

    leaveType: {
      type: String,
      enum: ["normal", "emergency"],
      default: "normal",
    },

    reason: {
      type: String,
      required: [true, "Leave reason is required"],
      trim: true,
    },

    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvalRemarks: {
      type: String,
      trim: true,
    },

    contactDuringLeave: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Leave", leaveSchema);
