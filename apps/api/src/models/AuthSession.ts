import { Schema, model } from "mongoose";

const authSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  refreshHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  lastUsedAt: { type: Date, default: Date.now },
  revokedAt: Date
}, { timestamps: true });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AuthSession = model("AuthSession", authSessionSchema);
