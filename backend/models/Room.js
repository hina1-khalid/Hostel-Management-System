const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    roomNumber: {
      type: String,
      required: [true, "Room number is required"],
      trim: true,
    },
    floor: {
      type: Number,
      required: true,
      default: 1,
    },
    capacity: {
      // total number of beds in this room
      type: Number,
      required: true,
      min: 1,
      default: 2,
    },
    occupiedBeds: {
      // how many beds are currently taken - kept in sync via room-allocation logic
      type: Number,
      default: 0,
      min: 0,
    },
    roomType: {
      type: String,
      enum: ["single", "double", "triple", "dormitory"],
      default: "double",
    },
    monthlyRent: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["available", "full", "under_maintenance", "blocked"],
      default: "available",
    },
    amenities: {
      // e.g. ["AC", "Attached Bathroom", "Balcony"]
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Prevent duplicate room numbers within the same hostel
roomSchema.index({ hostel: 1, roomNumber: 1 }, { unique: true });

// Virtual: is this room currently available for allocation?
roomSchema.virtual("isAvailable").get(function () {
  return this.status === "available" && this.occupiedBeds < this.capacity;
});

roomSchema.set("toJSON", { virtuals: true });
roomSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Room", roomSchema);
