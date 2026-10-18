import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { User, roles } from "../models/User.js";
import { AuthSession } from "../models/AuthSession.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { writeAudit } from "../utils/audit.js";

export const userRouter = Router();
userRouter.use(requireAuth, allowRoles("admin"));

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  role: z.enum(roles)
}).strict();
const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(12).max(128).optional(),
  role: z.enum(roles).optional(),
  active: z.boolean().optional()
}).strict().refine((value) => Object.keys(value).length > 0, "Minimal satu kolom harus diubah");

userRouter.get("/", asyncHandler(async (_req, res) => {
  const items = await User.find().select("name email role active lastLoginAt createdAt").sort({ name: 1 }).lean();
  res.json({ items });
}));

userRouter.post("/", validateBody(createUserSchema), asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body as { name: string; email: string; password: string; role: typeof roles[number] };
  const session = await mongoose.startSession();
  let userId = "";
  try {
    await session.withTransaction(async () => {
      const [user] = await User.create([{ name, email, passwordHash: await bcrypt.hash(password, 12), role }], { session });
      userId = user!.id;
      await writeAudit(req.auth!.userId, "user.created", "User", userId, { email, role }, session);
    });
  } finally { await session.endSession(); }
  res.status(201).json({ item: await User.findById(userId).select("name email role active") });
}));

userRouter.patch("/:id", validateBody(updateUserSchema), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID pengguna tidak valid");
  const changes = req.body as { name?: string; password?: string; role?: typeof roles[number]; active?: boolean };
  const { password, ...safeChanges } = changes;
  const update: Record<string, unknown> = { ...safeChanges };
  if (password) update.passwordHash = await bcrypt.hash(password, 12);
  const session = await mongoose.startSession();
  let userId = "";
  try {
    await session.withTransaction(async () => {
      const user = await User.findOneAndUpdate({ _id: req.params.id }, { $set: update }, { new: true, runValidators: true, session }).select("name email role active");
      if (!user) throw new HttpError(404, "Pengguna tidak ditemukan", "NOT_FOUND");
      await AuthSession.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } }, { session });
      userId = user.id;
      await writeAudit(req.auth!.userId, "user.updated", "User", userId, { fields: Object.keys(changes), role: user.role, active: user.active }, session);
    });
  } finally { await session.endSession(); }
  res.json({ item: await User.findById(userId).select("name email role active") });
}));
