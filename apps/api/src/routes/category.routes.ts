import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth, allowRoles } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Category } from "../models/Category.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { writeAudit } from "../utils/audit.js";
import { HttpError } from "../utils/httpError.js";

export const categoryRouter = Router();
categoryRouter.use(requireAuth);
categoryRouter.get("/", asyncHandler(async (_req, res) => res.json({ items: await Category.find({ active: true }).sort({ name: 1 }).lean() })));
const categorySchema = z.object({ name: z.string().trim().min(1).max(80), slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/) }).strict();
categoryRouter.post("/", allowRoles("admin", "board"), validateBody(categorySchema), asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let categoryId = "";
  try {
    await session.withTransaction(async () => {
      const [category] = await Category.create([req.body], { session });
      categoryId = category!.id;
      await writeAudit(req.auth!.userId, "category.created", "Category", categoryId, { slug: category!.slug }, session);
    });
  } finally { await session.endSession(); }
  const category = await Category.findById(categoryId);
  res.status(201).json({ item: category });
}));

categoryRouter.patch("/:id", allowRoles("admin", "board"), validateBody(categorySchema), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID kategori tidak valid");
  const session = await mongoose.startSession();
  let categoryId = "";
  try {
    await session.withTransaction(async () => {
      const category = await Category.findOneAndUpdate({ _id: req.params.id, active: true }, { $set: req.body }, { new: true, runValidators: true, session });
      if (!category) throw new HttpError(404, "Kategori tidak ditemukan", "NOT_FOUND");
      categoryId = category.id;
      await writeAudit(req.auth!.userId, "category.updated", "Category", categoryId, { slug: category.slug }, session);
    });
  } finally { await session.endSession(); }
  res.json({ item: await Category.findById(categoryId) });
}));

categoryRouter.delete("/:id", allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID kategori tidak valid");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const category = await Category.findOneAndUpdate({ _id: req.params.id, active: true }, { $set: { active: false } }, { new: true, session });
      if (!category) throw new HttpError(404, "Kategori tidak ditemukan", "NOT_FOUND");
      await writeAudit(req.auth!.userId, "category.archived", "Category", category.id, { slug: category.slug }, session);
    });
  } finally { await session.endSession(); }
  res.status(204).end();
}));
