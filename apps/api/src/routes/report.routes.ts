import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth, allowRoles } from "../middleware/auth.js";
import { Transaction } from "../models/Transaction.js";
import { CashMovement } from "../models/CashMovement.js";
import { AuditLog } from "../models/AuditLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody } from "../middleware/validate.js";
import { writeAudit } from "../utils/audit.js";
import { env } from "../config/env.js";

export const reportRouter = Router();
reportRouter.use(requireAuth, allowRoles("admin", "board"));

const rangeSchema = z.object({
  from: z.string().date(),
  to: z.string().date()
}).refine((value) => value.from <= value.to, "Tanggal awal harus sebelum tanggal akhir");

function localMidnightToUtc(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: env.SALES_BUSINESS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += target - represented;
  }
  return new Date(guess);
}

function nextCalendarDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);
}

reportRouter.get("/sales", asyncHandler(async (req, res) => {
  const { from, to } = rangeSchema.parse(req.query);
  const start = localMidnightToUtc(from);
  const end = localMidnightToUtc(nextCalendarDate(to));
  const [summary, daily] = await Promise.all([
    Transaction.aggregate([
      { $match: { status: "paid", createdAt: { $gte: start, $lt: end } } },
      { $unwind: "$items" },
      { $group: {
        _id: "$_id",
        subtotal: { $first: "$subtotal" },
        discount: { $first: "$discount" },
        tax: { $first: "$tax" },
        itemCost: { $sum: { $multiply: ["$items.unitCost", "$items.qty"] } }
      } },
      { $group: {
        _id: null,
        orders: { $sum: 1 },
        subtotal: { $sum: "$subtotal" },
        discount: { $sum: "$discount" },
        itemCost: { $sum: "$itemCost" },
        tax: { $sum: "$tax" },
      } },
      { $project: { _id: 0, orders: 1, revenue: { $subtract: ["$subtotal", "$discount"] }, itemCost: 1, grossProfit: { $subtract: [{ $subtract: ["$subtotal", "$discount"] }, "$itemCost"] }, tax: 1, discount: 1 } }
    ]),
    Transaction.aggregate([
      { $match: { status: "paid", createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: env.SALES_BUSINESS_TIMEZONE } }, orders: { $sum: 1 }, revenue: { $sum: { $subtract: ["$subtotal", "$discount"] } } } },
      { $sort: { _id: 1 } }
    ])
  ]);
  res.json({ from, to, summary: summary[0] ?? { orders: 0, revenue: 0, itemCost: 0, grossProfit: 0, tax: 0, discount: 0 }, daily });
}));

reportRouter.get("/cash-movements", asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const items = await CashMovement.find().populate("cashierId", "name").sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ items });
}));

reportRouter.get("/audit-logs", asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const items = await AuditLog.find().populate("actorId", "name email role").sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ items });
}));

export const cashMovementRouter = Router();
cashMovementRouter.use(requireAuth);
const movementSchema = z.object({ type: z.enum(["opening", "cash_in", "cash_out", "closing"]), amount: z.number().int().nonnegative().safe(), note: z.string().trim().max(240).optional() }).strict();
cashMovementRouter.post("/", validateBody(movementSchema), asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let movementId = "";
  try {
    await session.withTransaction(async () => {
      const [movement] = await CashMovement.create([{ ...req.body, cashierId: req.auth!.userId }], { session });
      movementId = movement!.id;
      await writeAudit(req.auth!.userId, "cash.movement_recorded", "CashMovement", movementId, { type: movement!.type, amount: movement!.amount }, session);
    });
  } finally { await session.endSession(); }
  const movement = await CashMovement.findById(movementId);
  res.status(201).json({ item: movement });
}));
