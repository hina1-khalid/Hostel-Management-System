const mongoose = require("mongoose");
const s = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true, default: "" },
    type: { type: String, enum: ["info", "success", "warning", "alert"], default: "info" },
    link: { type: String, default: "" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Notification", s);
