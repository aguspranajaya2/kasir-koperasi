import { Schema, model } from "mongoose";

const transactionSchema = new Schema({
  receiptNo: { type: String, required: true },
  idempotencyKey: { type: String, required: true },
  requestHash: { type: String, required: true },
  cashierId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  memberId: { type: Schema.Types.ObjectId, ref: "Member" },
  items: [{
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  }],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paidAmount: { type: Number, required: true },
  changeAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ["cash", "member_balance"], required: true },
  status: { type: String, enum: ["paid", "voided"], default: "paid", index: true },
  voidedAt: Date,
  voidedBy: { type: Schema.Types.ObjectId, ref: "User" },
  voidReason: String
}, { timestamps: true });
transactionSchema.index({ receiptNo: 1 }, { unique: true });
transactionSchema.index({ idempotencyKey: 1 }, { unique: true });
transactionSchema.index({ createdAt: -1, status: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ cashierId: 1, createdAt: -1 });
transactionSchema.index({ memberId: 1, createdAt: -1 });
export const Transaction = model("Transaction", transactionSchema);
