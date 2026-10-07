const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

// type "change":     student already has a room and asks for another one
// type "allocation": student has no room yet and joins the hostel's waiting list
const s = new mongoose.Schema(
  {
    student: { type: OID, ref: "Student", required: true },
    hostel: { type: OID, ref: "Hostel", required: true },
    type: { type: String, enum: ["change", "allocation"], required: true },
    currentRoom: { type: OID, ref: "Room" },
    requestedRoom: { type: OID, ref: "Room" },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "waiting", "approved", "fulfilled", "rejected", "cancelled"], required: true },
    adminRemarks: { type: String, trim: true },
    decidedBy: { type: OID, ref: "User" },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);
module.exports = mongoose.model("RoomRequest", s);
