const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    user: {
      // links to the User account (which holds email/password/role="student")
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    registrationNumber: {
      // university roll number / registration number
      type: String,
      required: [true, "Registration number is required"],
      unique: true,
      trim: true,
    },
    cnic: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    semester: {
      type: Number,
      min: 1,
      max: 12,
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
    },
    dateOfBirth: {
      type: Date,
    },
    address: {
      type: String,
      trim: true,
    },

    // Room allocation
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      default: null,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    allocationStatus: {
      type: String,
      enum: ["not_allocated", "allocated", "pending", "vacated"],
      default: "not_allocated",
    },
    allocatedAt: {
      type: Date,
    },

    // Guardian / emergency contact
    guardianName: {
      type: String,
      trim: true,
    },
    guardianRelation: {
      type: String,
      trim: true,
    },
    guardianPhone: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true },
    },

    admissionDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "graduated", "left"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
