const mongoose = require("mongoose");

const hostelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hostel name is required"],
      trim: true,
    },
    code: {
      // short unique code, e.g. "H1", "BOYS-A"
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["boys", "girls"],
      required: true,
    },
    address: {
      type: String,
      trim: true,
    },
    totalFloors: {
      type: Number,
      default: 1,
    },
    warden: {
      // reference to a User with role "admin"
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    contactNumber: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hostel", hostelSchema);
