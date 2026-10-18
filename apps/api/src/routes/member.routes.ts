import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, allowRoles } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Member } from "../models/Member.js";
import { MemberLedger } from "../models/MemberLedger.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { memberCreateSchema, memberSearchSchema, memberUpdateSchema, savingsDepositSchema } from "../schemas/member.schema.js";
import { writeAudit } from "../utils/audit.js";
import { allocateCode, previewCode } from "../utils/identifiers.js";

export const memberRouter = Router();
memberRouter.use(requireAuth);
memberRouter.get("/", asyncHandler(async (req, res) => {
  const { q, limit } = memberSearchSchema.parse(req.query);
  const filter: Record<string, unknown> = { active: true };
  if (q) filter.$text = { $search: q };
  const items = await Member.find(filter).select("memberNo name phone points savings").sort(q ? { score: { $meta: "textScore" } } : { name: 1 }).limit(limit).lean();
  res.json({ items });
}));
memberRouter.get("/next-number", asyncHandler(async (_req, res) => {
  res.json({ memberNo: await previewCode("member-number", "KOP", Member, "memberNo") });
}));
memberRouter.post("/", allowRoles("admin", "board"), validateBody(memberCreateSchema), asyncHandler(async (req, res) => {
  const body = req.body as { memberNo?: string; name: string; phone?: string; email?: string };
  const memberNo = body.memberNo?.trim() || await allocateCode("member-number", "KOP", Member, "memberNo");
  const session = await mongoose.startSession();
  let memberId = "";
  try {
    await session.withTransaction(async () => {
      const [member] = await Member.create([{ ...body, memberNo }], { session });
      memberId = member!.id;
      await writeAudit(req.auth!.userId, "member.created", "Member", memberId, { memberNo: member!.memberNo }, session);
    });
  } finally { await session.endSession(); }
  const member = await Member.findById(memberId);
  res.status(201).json({ item: member });
}));
memberRouter.patch("/:id", allowRoles("admin", "board"), validateBody(memberUpdateSchema), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID anggota tidak valid");
  const session = await mongoose.startSession();
  let memberId = "";
  try {
    await session.withTransaction(async () => {
      const member = await Member.findOneAndUpdate({ _id: req.params.id, active: true }, { $set: req.body }, { new: true, runValidators: true, session });
      if (!member) throw new HttpError(404, "Anggota tidak ditemukan", "NOT_FOUND");
      memberId = member.id;
      await writeAudit(req.auth!.userId, "member.updated", "Member", memberId, { fields: Object.keys(req.body as object) }, session);
    });
  } finally { await session.endSession(); }
  res.json({ item: await Member.findById(memberId) });
}));
memberRouter.delete("/:id", allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID anggota tidak valid");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const member = await Member.findOneAndUpdate({ _id: req.params.id, active: true }, { $set: { active: false } }, { new: true, session });
      if (!member) throw new HttpError(404, "Anggota tidak ditemukan", "NOT_FOUND");
      await writeAudit(req.auth!.userId, "member.archived", "Member", member.id, { memberNo: member.memberNo }, session);
    });
  } finally { await session.endSession(); }
  res.status(204).end();
}));
memberRouter.get("/:id/ledger", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID anggota tidak valid");
  const items = await MemberLedger.find({ memberId: req.params.id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ items });
}));
memberRouter.post("/:id/savings-deposits", allowRoles("admin", "board"), validateBody(savingsDepositSchema), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID anggota tidak valid");
  const { type, amount, note } = req.body as { type: "mandatory" | "voluntary"; amount: number; note?: string };
  const session = await mongoose.startSession();
  let memberId = "";
  try {
    await session.withTransaction(async () => {
      const member = await Member.findOneAndUpdate({ _id: req.params.id, active: true }, { $inc: { [`savings.${type}`]: amount } }, { new: true, session });
      if (!member) throw new HttpError(404, "Anggota tidak ditemukan", "NOT_FOUND");
      memberId = member.id;
      const balanceAfter = type === "mandatory" ? member.savings?.mandatory ?? 0 : member.savings?.voluntary ?? 0;
      await MemberLedger.create([{ memberId: member.id, type: type === "mandatory" ? "mandatory_deposit" : "voluntary_deposit", amount, balanceAfter, actorId: req.auth!.userId, note }], { session });
      await writeAudit(req.auth!.userId, "member.savings_deposited", "Member", member.id, { type, amount }, session);
    });
  } finally { await session.endSession(); }
  res.status(201).json({ item: await Member.findById(memberId) });
}));
