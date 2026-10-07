const mongoose = require("mongoose");
const OID = mongoose.Schema.Types.ObjectId;

const EXPENSE_CATEGORIES = ["grocery", "vegetables", "meat", "dairy", "gas", "staff", "utilities", "repairs", "other"];
const STOCK_CATEGORIES = ["grocery", "vegetables", "meat", "dairy", "gas", "other"];

const MessExpense = mongoose.model(
  "MessExpense",
  new mongoose.Schema(
    {
      hostel: { type: OID, ref: "Hostel", required: true },
      date: { type: String, required: true }, // YYYY-MM-DD
      category: { type: String, enum: EXPENSE_CATEGORIES, default: "other" },
      description: { type: String, required: [true, "Description is required"], trim: true },
      amount: { type: Number, required: true, min: [1, "Amount must be greater than 0"] },
      paidTo: { type: String, trim: true },
      source: { type: String, enum: ["manual", "stock", "payroll"], default: "manual" },
      payroll: { type: OID, ref: "Payroll" },
      createdBy: { type: OID, ref: "User" },
    },
    { timestamps: true }
  ).index({ hostel: 1, date: 1 })
);

const MessStockItem = mongoose.model(
  "MessStockItem",
  new mongoose.Schema(
    {
      hostel: { type: OID, ref: "Hostel", required: true },
      name: { type: String, required: [true, "Item name is required"], trim: true },
      category: { type: String, enum: STOCK_CATEGORIES, default: "grocery" },
      unit: { type: String, enum: ["kg", "litre", "piece", "pack", "dozen"], default: "kg" },
      quantity: { type: Number, default: 0, min: 0 },
      minQuantity: { type: Number, default: 0, min: 0 }, // alert when stock falls to this level or below
    },
    { timestamps: true }
  ).index({ hostel: 1, name: 1 }, { unique: true })
);

const MessStockMove = mongoose.model(
  "MessStockMove",
  new mongoose.Schema(
    {
      item: { type: OID, ref: "MessStockItem", required: true },
      hostel: { type: OID, ref: "Hostel", required: true },
      type: { type: String, enum: ["in", "out", "adjust"], required: true },
      quantity: { type: Number, required: true },
      resultingQuantity: { type: Number, required: true },
      cost: { type: Number, default: 0 },
      note: { type: String, trim: true },
      by: { type: OID, ref: "User" },
    },
    { timestamps: true }
  )
);

module.exports = { MessExpense, MessStockItem, MessStockMove, EXPENSE_CATEGORIES, STOCK_CATEGORIES };
