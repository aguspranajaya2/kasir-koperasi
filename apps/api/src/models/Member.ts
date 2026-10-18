import { Schema, model } from "mongoose";

const memberSchema = new Schema({
  memberNo: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  points: { type: Number, default: 0, min: 0 },
  savings: {
    mandatory: { type: Number, default: 0, min: 0 },
    voluntary: { type: Number, default: 0, min: 0 }
  },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
memberSchema.index({ memberNo: 1 }, { unique: true });
memberSchema.index({ email: 1 }, { unique: true, sparse: true });
memberSchema.index({ name: "text", memberNo: "text", phone: "text" });
export const Member = model("Member", memberSchema);
