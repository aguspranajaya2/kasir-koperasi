import { Schema, model } from "mongoose";

const productSchema = new Schema({
  sku: { type: String, required: true, uppercase: true, trim: true },
  barcode: { type: String, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  categoryId: { type: Schema.Types.ObjectId, ref: "Category", index: true },
  unit: { type: String, required: true, default: "pcs", maxlength: 24 },
  price: { type: Number, required: true, min: 0 },
  cost: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, required: true, min: 0, default: 5 },
  lowStock: { type: Boolean, required: true, default: false },
  active: { type: Boolean, default: true, index: true },
  version: { type: Number, default: 0 }
}, { timestamps: true });
productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ barcode: 1 }, { unique: true, sparse: true });
productSchema.index({ name: "text", sku: "text", barcode: "text" });
productSchema.index({ lowStock: 1, active: 1, stock: 1 });
export const Product = model("Product", productSchema);
