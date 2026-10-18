import { Schema, model, type InferSchemaType } from "mongoose";

export const roles = ["admin", "cashier", "board"] as const;
export type Role = typeof roles[number];

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: roles, required: true, default: "cashier" },
  active: { type: Boolean, default: true, index: true },
  lastLoginAt: Date
}, { timestamps: true });
userSchema.index({ email: 1 }, { unique: true });
export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
