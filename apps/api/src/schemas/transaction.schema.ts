import { z } from "zod";

export const checkoutSchema = z.object({
  idempotencyKey: z.string().uuid(),
  items: z.array(z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i), qty: z.number().int().min(1).max(1000) }).strict()).min(1).max(100),
  memberId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  paymentMethod: z.enum(["cash", "member_balance"]),
  paidAmount: z.number().int().nonnegative().safe(),
  discount: z.number().int().nonnegative().safe().default(0)
}).strict().superRefine((data, ctx) => {
  const ids = data.items.map((item) => item.productId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Produk duplikat harus digabungkan", path: ["items"] });
  if (data.paymentMethod === "member_balance" && !data.memberId) ctx.addIssue({ code: "custom", message: "Anggota wajib dipilih untuk pembayaran saldo", path: ["memberId"] });
});

export const voidTransactionSchema = z.object({ reason: z.string().trim().min(5).max(240) }).strict();
