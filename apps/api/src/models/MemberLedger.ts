import { Schema, model } from "mongoose";

const memberLedgerSchema = new Schema({
  memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
  type: { type: String, enum: ["mandatory_deposit", "voluntary_deposit", "voluntary_withdrawal", "purchase", "purchase_reversal", "adjustment"], required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  referenceId: { type: Schema.Types.ObjectId },
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  note: { type: String, maxlength: 240 }
}, { timestamps: true });
memberLedgerSchema.index({ memberId: 1, createdAt: -1 });
export const MemberLedger = model("MemberLedger", memberLedgerSchema);
