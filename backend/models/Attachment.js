const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

// Image files are stored in MongoDB (works on any host, no separate file storage needed).
const s = new mongoose.Schema(
  {
    data: { type: Buffer, required: true, select: false },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    owner: { type: OID, ref: "User", required: true },
    complaint: { type: OID, ref: "Complaint" },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Attachment", s);
