import { Schema, model } from "mongoose";

const categorySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, lowercase: true, trim: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });
categorySchema.index({ slug: 1 }, { unique: true });
export const Category = model("Category", categorySchema);
