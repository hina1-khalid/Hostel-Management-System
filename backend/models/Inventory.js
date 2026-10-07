const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;
const s = new mongoose.Schema(
  {
    hostel: { type: OID, ref: "Hostel", required: true },
    room: { type: OID, ref: "Room", default: null },
    itemName: { type: String, required: [true, "Item name is required"], trim: true },
    category: {
      type: String,
      enum: ["furniture", "electrical", "appliance", "bedding", "plumbing", "cleaning", "other"],
      default: "other",
    },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    condition: { type: String, enum: ["new", "good", "fair", "damaged", "under_repair"], default: "good" },
    serialNumber: { type: String, trim: true },
    purchaseDate: { type: Date },
    purchasePrice: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Inventory", s);
