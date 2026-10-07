const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },

    feeType: {
      type: String,
      enum: [
        "hostel_fee",
        "admission_fee",
        "electricity",
        "mess",
        "laundry",
        "internet",
        "security_deposit",
        "fine",
      ],
      required: true,
    },

    month: {
      // e.g. "2026-08" - relevant for recurring fees like mess/electricity
      type: String,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    lateFee: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      // amount + lateFee, kept in sync by controller logic
      type: Number,
      required: true,
      min: 0,
    },

    dueDate: {
      type: Date,
      required: true,
    },
    paidDate: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "overdue", "partially_paid"],
      default: "pending",
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "easypaisa", "jazzcash", "card", ""],
      default: "",
    },
    transactionId: {
      type: String,
      trim: true,
    },

    receiptNumber: {
      type: String,
      unique: true,
      sparse: true, // only enforced uniqueness when a value exists (unpaid fees won't have one yet)
    },

    remarks: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Fee", feeSchema);
