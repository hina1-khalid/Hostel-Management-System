const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Notice title is required"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Notice content is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["general", "emergency", "holiday", "maintenance", "exam"],
      default: "general",
    },

    hostel: {
      // if null, this notice applies to ALL hostels
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      default: null,
    },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notice", noticeSchema);
