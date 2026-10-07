const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema(
  {
    student: {
      // which student the visitor is visiting
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },

    visitorName: {
      type: String,
      required: [true, "Visitor name is required"],
      trim: true,
    },
    cnic: {
      type: String,
      required: [true, "Visitor CNIC is required for verification"],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    relation: {
      // relation to the student, e.g. "Father", "Friend"
      type: String,
      trim: true,
    },

    purpose: {
      type: String,
      trim: true,
    },

    entryTime: {
      type: Date,
      default: Date.now,
    },
    exitTime: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["pending_approval", "approved", "checked_in", "checked_out", "rejected"],
      default: "pending_approval",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    registeredBy: {
      // Security Guard who registered the visitor at the gate
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visitor", visitorSchema);
