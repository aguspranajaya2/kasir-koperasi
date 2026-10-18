import { Router } from "express";
import mongoose from "mongoose";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Product } from "../models/Product.js";
import { Category } from "../models/Category.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { writeAudit } from "../utils/audit.js";
import { productCreateSchema, productSearchSchema, productUpdateSchema, stockAdjustmentSchema } from "../schemas/product.schema.js";
import { allocateCode, previewCode } from "../utils/identifiers.js";

export const productRouter = Router();
productRouter.use(requireAuth);

productRouter.get("/", asyncHandler(async (req, res) => {
  const { q, categoryId, lowStock, page, limit } = productSearchSchema.parse(req.query);
  const fields = "sku barcode name categoryId unit price stock lowStockThreshold" + (req.auth?.role === "admin" || req.auth?.role === "board" ? " cost" : "");
  if (q) {
    const exactFilter: Record<string, unknown> = { active: true, $or: [{ sku: q.toUpperCase() }, { barcode: q }] };
    if (categoryId) exactFilter.categoryId = categoryId;
    if (lowStock === "true") exactFilter.lowStock = true;
    const exact = await Product.findOne(exactFilter)
      .select(fields).lean();
    if (exact) return res.json({ items: [exact], page, limit, total: 1 });
  }
  const filter: Record<string, unknown> = { active: true };
  if (categoryId) filter.categoryId = categoryId;
  if (q) filter.$text = { $search: q };
  if (lowStock === "true") filter.lowStock = true;
  const [items, total] = await Promise.all([
    Product.find(filter).select(fields).sort(q ? { score: { $meta: "textScore" } } : { name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter)
  ]);
  res.json({ items, page, limit, total });
}));

productRouter.get("/low-stock", asyncHandler(async (_req, res) => {
  const items = await Product.find({ active: true, lowStock: true }).select("sku name stock lowStockThreshold").sort({ stock: 1 }).lean();
  res.json({ items });
}));

productRouter.get("/next-code", asyncHandler(async (_req, res) => {
  const sku = await previewCode("product-sku", "BRG", Product, "sku");
  res.json({ sku, barcode: sku });
}));

productRouter.post("/", allowRoles("admin", "board"), validateBody(productCreateSchema), asyncHandler(async (req, res) => {
  const body = req.body as { sku?: string; barcode?: string; stock: number; lowStockThreshold: number; categoryId?: string };
  const sku = body.sku?.trim() || await allocateCode("product-sku", "BRG", Product, "sku");
  const barcode = body.barcode?.trim() || sku;
  const session = await mongoose.startSession();
  let productId = "";
  try {
    await session.withTransaction(async () => {
      const input = body;
      const categoryId = body.categoryId;
      if (categoryId && !await Category.exists({ _id: categoryId, active: true }).session(session)) {
        throw new HttpError(400, "Kategori tidak ditemukan atau tidak aktif", "INVALID_CATEGORY");
      }
      const [product] = await Product.create([{ ...body, sku, barcode, lowStock: input.stock <= input.lowStockThreshold }], { session });
      productId = product!.id;
      await writeAudit(req.auth!.userId, "product.created", "Product", productId, { sku: product!.sku }, session);
    });
  } finally { await session.endSession(); }
  const product = await Product.findById(productId);
  res.status(201).json({ item: product });
}));

productRouter.patch("/:id", allowRoles("admin", "board"), validateBody(productUpdateSchema), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID produk tidak valid");
  const session = await mongoose.startSession();
  let productId = "";
  try {
    await session.withTransaction(async () => {
      const before = await Product.findOne({ _id: req.params.id, active: true }).session(session);
      if (!before) throw new HttpError(404, "Produk tidak ditemukan", "NOT_FOUND");
      const changes = req.body as Record<string, unknown>;
      if (typeof changes.categoryId === "string" && !await Category.exists({ _id: changes.categoryId, active: true }).session(session)) {
        throw new HttpError(400, "Kategori tidak ditemukan atau tidak aktif", "INVALID_CATEGORY");
      }
      const nextThreshold = typeof changes.lowStockThreshold === "number" ? changes.lowStockThreshold : before.lowStockThreshold;
      const product = await Product.findOneAndUpdate({ _id: before._id, active: true, version: before.version }, { $set: { ...changes, lowStock: before.stock <= nextThreshold }, $inc: { version: 1 } }, { new: true, runValidators: true, session });
      if (!product) throw new HttpError(409, "Produk berubah oleh pengguna lain", "WRITE_CONFLICT");
      productId = product.id;
      const beforeValues = Object.fromEntries(Object.keys(changes).map((key) => [key, before.get(key)]));
      const afterValues = Object.fromEntries(Object.keys(changes).map((key) => [key, product.get(key)]));
      await writeAudit(req.auth!.userId, "product.updated", "Product", product.id, {
        before: beforeValues, after: afterValues,
        lowStock: { before: before.lowStock, after: product.lowStock }
      }, session);
    });
  } finally { await session.endSession(); }
  const product = await Product.findById(productId);
  res.json({ item: product });
}));

productRouter.delete("/:id", allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID produk tidak valid");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const product = await Product.findOneAndUpdate({ _id: req.params.id, active: true }, { $set: { active: false } }, { new: true, session });
      if (!product) throw new HttpError(404, "Produk tidak ditemukan", "NOT_FOUND");
      await writeAudit(req.auth!.userId, "product.archived", "Product", product.id, { sku: product.sku }, session);
    });
  } finally { await session.endSession(); }
  res.status(204).end();
}));

productRouter.post("/:id/stock-adjustments", allowRoles("admin", "board"), validateBody(stockAdjustmentSchema), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID produk tidak valid");
  const { delta, reason } = req.body as { delta: number; reason: string };
  const session = await mongoose.startSession();
  let updatedId = "";
  try {
    await session.withTransaction(async () => {
      const updated = await Product.findOneAndUpdate(
        { _id: req.params.id, active: true, stock: { $gte: Math.max(0, -delta) } },
        [
          { $set: { stock: { $add: ["$stock", delta] }, version: { $add: ["$version", 1] } } },
          { $set: { lowStock: { $lte: ["$stock", "$lowStockThreshold"] } } }
        ], { new: true, session }
      );
      if (!updated) throw new HttpError(409, "Stok tidak cukup atau produk tidak ditemukan", "STOCK_CONFLICT");
      updatedId = updated.id;
      await writeAudit(req.auth!.userId, "stock.adjusted", "Product", updated.id, { delta, reason }, session);
    });
  } finally { await session.endSession(); }
  res.json({ item: await Product.findById(updatedId) });
}));
