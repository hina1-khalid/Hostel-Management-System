const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

// Who changed what, and when. Written automatically for every successful write request (see utils/audit.js).
const s = new mongoose.Schema(
  {
    user: { type: OID, ref: "User", index: true },
    userName: String,
    role: String,
    method: String,
    route: String, // e.g. /api/fees/:id/pay
    path: String, // e.g. /api/fees/64ab.../pay
    entity: { type: String, index: true }, // fees, students, rooms...
    entityId: String,
    status: Number,
    details: { type: mongoose.Schema.Types.Mixed },
    ip: String,
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
s.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 }); // keep 180 days
module.exports = mongoose.model("AuditLog", s);
