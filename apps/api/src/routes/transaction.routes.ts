import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Member } from "../models/Member.js";
import { MemberLedger } from "../models/MemberLedger.js";
import { Product } from "../models/Product.js";
import { Transaction } from "../models/Transaction.js";
import { CashMovement } from "../models/CashMovement.js";
import { env } from "../config/env.js";
import { checkoutSchema, voidTransactionSchema } from "../schemas/transaction.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { writeAudit } from "../utils/audit.js";

export const transactionRouter = Router();
transactionRouter.use(requireAuth);

transactionRouter.post("/checkout", validateBody(checkoutSchema), asyncHandler(async (req, res) => {
  const body = req.body as {
    idempotencyKey: string;
    items: Array<{ productId: string; qty: number }>;
    memberId?: string;
    paymentMethod: "cash" | "member_balance";
    paidAmount: number;
    discount: number;
  };
  if (body.discount > 0 && req.auth!.role === "cashier") throw new HttpError(403, "Diskon harus disetujui pengurus", "FORBIDDEN");
  const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const prior = await Transaction.findOne({ idempotencyKey: body.idempotencyKey, cashierId: req.auth!.userId }).lean();
  if (prior) {
    if (prior.requestHash !== requestHash) throw new HttpError(409, "Kunci transaksi sudah dipakai untuk keranjang berbeda", "IDEMPOTENCY_KEY_REUSED");
    return res.status(200).json({ item: prior });
  }
  const session = await mongoose.startSession();
  const receiptNo = `KOP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  let saved: unknown;
  try {
    await session.withTransaction(async () => {
      const ids = body.items.map((item) => item.productId);
      const products = await Product.find({ _id: { $in: ids }, active: true }).session(session);
      if (products.length !== ids.length) throw new HttpError(409, "Ada produk yang tidak tersedia", "PRODUCT_UNAVAILABLE");
      const byId = new Map(products.map((product) => [product.id, product]));
      const subtotal = body.items.reduce((sum, item) => sum + (byId.get(item.productId)?.price ?? 0) * item.qty, 0);
      if (!Number.isSafeInteger(subtotal) || body.discount > subtotal) throw new HttpError(400, "Nilai transaksi tidak valid", "INVALID_TOTAL");
      const tax = Math.round(((subtotal - body.discount) * env.SALES_TAX_RATE_BPS) / 10000);
      const total = subtotal - body.discount + tax;
      if (!Number.isSafeInteger(total)) throw new HttpError(400, "Nilai total transaksi terlalu besar", "INVALID_TOTAL");
      if (body.paymentMethod === "cash" && body.paidAmount < total) throw new HttpError(400, "Pembayaran tunai kurang", "INSUFFICIENT_PAYMENT");
      if (body.paymentMethod === "member_balance" && body.paidAmount !== total) throw new HttpError(400, "Jumlah pembayaran saldo harus sama dengan total", "INVALID_PAYMENT");
      if (body.paymentMethod === "member_balance" && !body.memberId) throw new HttpError(400, "Pilih anggota koperasi", "MEMBER_REQUIRED");

      const lines = body.items.map(({ productId, qty }) => {
        const product = byId.get(productId)!;
        const lineTotal = product.price * qty;
        return { productId: product._id, sku: product.sku, name: product.name, qty, unitPrice: product.price, unitCost: product.cost, discount: 0, lineTotal };
      });
      for (const line of lines) {
        const changed = await Product.updateOne(
          { _id: line.productId, active: true, stock: { $gte: line.qty } },
          [
            { $set: { stock: { $subtract: ["$stock", line.qty] }, version: { $add: ["$version", 1] } } },
            { $set: { lowStock: { $lte: ["$stock", "$lowStockThreshold"] } } }
          ], { session }
        );
        if (changed.modifiedCount !== 1) throw new HttpError(409, `Stok ${line.name} tidak mencukupi`, "STOCK_CONFLICT");
      }
      if (body.paymentMethod === "member_balance") {
        const member = await Member.findOneAndUpdate(
          { _id: body.memberId, active: true, "savings.voluntary": { $gte: total } },
          { $inc: { "savings.voluntary": -total, points: Math.floor(total / 10000) } },
          { new: true, session }
        );
        if (!member) throw new HttpError(409, "Saldo sukarela anggota tidak cukup", "INSUFFICIENT_MEMBER_BALANCE");
        await MemberLedger.create([{ memberId: member.id, type: "purchase", amount: -total, balanceAfter: member.savings?.voluntary ?? 0, actorId: req.auth!.userId, note: `Pembelian ${receiptNo}` }], { session });
      } else if (body.memberId) {
        const member = await Member.findOneAndUpdate({ _id: body.memberId, active: true }, { $inc: { points: Math.floor(total / 10000) } }, { new: true, session });
        if (!member) throw new HttpError(404, "Anggota tidak ditemukan", "MEMBER_NOT_FOUND");
      }
      const [transaction] = await Transaction.create([{
        receiptNo, idempotencyKey: body.idempotencyKey, requestHash, cashierId: req.auth!.userId, memberId: body.memberId,
        items: lines, subtotal, discount: body.discount, tax, total,
        paidAmount: body.paymentMethod === "member_balance" ? total : body.paidAmount,
        changeAmount: body.paymentMethod === "cash" ? body.paidAmount - total : 0,
        paymentMethod: body.paymentMethod
      }], { session });
      await writeAudit(req.auth!.userId, "transaction.completed", "Transaction", transaction!.id, { receiptNo, total, paymentMethod: body.paymentMethod }, session);
      saved = transaction!.toObject();
    });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      const existing = await Transaction.findOne({ idempotencyKey: body.idempotencyKey, cashierId: req.auth!.userId }).lean();
      if (existing) {
        if (existing.requestHash !== requestHash) throw new HttpError(409, "Kunci transaksi sudah dipakai untuk keranjang berbeda", "IDEMPOTENCY_KEY_REUSED");
        return res.status(200).json({ item: existing });
      }
    }
    throw error;
  } finally { await session.endSession(); }
  res.status(201).json({ item: saved });
}));

transactionRouter.post("/:id/void", allowRoles("admin", "board"), validateBody(voidTransactionSchema), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "ID transaksi tidak valid");
  const { reason } = req.body as { reason: string };
  const session = await mongoose.startSession();
  let voidedId = "";
  try {
    await session.withTransaction(async () => {
      const transaction = await Transaction.findOneAndUpdate(
        { _id: req.params.id, status: "paid" },
        { $set: { status: "voided", voidedAt: new Date(), voidedBy: req.auth!.userId, voidReason: reason } },
        { new: true, session }
      );
      if (!transaction) throw new HttpError(404, "Transaksi tidak ditemukan atau sudah dibatalkan", "NOT_FOUND");
      voidedId = transaction.id;
      for (const line of transaction.items) await Product.updateOne({ _id: line.productId }, [
        { $set: { stock: { $add: ["$stock", line.qty] }, version: { $add: ["$version", 1] } } },
        { $set: { lowStock: { $lte: ["$stock", "$lowStockThreshold"] } } }
      ], { session });
      if (transaction.memberId) {
        const points = Math.floor(transaction.total / 10000);
        const member = await Member.findByIdAndUpdate(transaction.memberId, { $inc: { points: -points, ...(transaction.paymentMethod === "member_balance" ? { "savings.voluntary": transaction.total } : {}) } }, { new: true, session });
        if (transaction.paymentMethod === "member_balance" && member) {
          await MemberLedger.create([{ memberId: member.id, type: "purchase_reversal", amount: transaction.total, balanceAfter: member.savings?.voluntary ?? 0, referenceId: transaction._id, actorId: req.auth!.userId, note: reason }], { session });
        }
      }
      if (transaction.paymentMethod === "cash") {
        await CashMovement.create([{
          cashierId: transaction.cashierId, type: "cash_out", amount: transaction.total,
          note: `Pengembalian transaksi ${transaction.receiptNo}: ${reason}`
        }], { session });
      }
      await writeAudit(req.auth!.userId, "transaction.voided", "Transaction", transaction.id, { receiptNo: transaction.receiptNo, reason }, session);
    });
  } finally { await session.endSession(); }
  res.json({ item: await Transaction.findById(voidedId) });
}));

transactionRouter.get("/", allowRoles("admin", "board"), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const items = await Transaction.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  res.json({ items, page, limit });
}));
