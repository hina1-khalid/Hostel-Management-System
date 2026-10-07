const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

// A saved monthly management report (one per hostel+month; hostel=null means "all hostels")
const s = new mongoose.Schema(
  {
    hostel: { type: OID, ref: "Hostel", default: null },
    hostelName: { type: String, default: "All hostels" },
    month: { type: String, required: true }, // YYYY-MM
    stats: { type: mongoose.Schema.Types.Mixed, required: true },
    previous: { type: mongoose.Schema.Types.Mixed },
    narrative: {
      summary: String,
      highlights: [String],
      concerns: [String],
      recommendations: [String],
    },
    source: { type: String, enum: ["claude", "rules"], default: "rules" },
    generatedBy: { type: OID, ref: "User" },
  },
  { timestamps: true }
);
s.index({ hostel: 1, month: 1 }, { unique: true });
module.exports = mongoose.model("Report", s);
