import { Schema, model } from "mongoose";

const cashMovementSchema = new Schema({
  cashierId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["opening", "cash_in", "cash_out", "closing"], required: true },
  amount: { type: Number, required: true, min: 0 },
  note: { type: String, maxlength: 240 },
  createdAt: { type: Date, default: Date.now }
});
cashMovementSchema.index({ cashierId: 1, createdAt: -1 });
export const CashMovement = model("CashMovement", cashMovementSchema);
