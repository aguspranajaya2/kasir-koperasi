import { z } from "zod";

export const memberCreateSchema = z.object({
  memberNo: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(32).optional(),
  email: z.string().email().max(254).optional()
}).strict();
export const memberUpdateSchema = memberCreateSchema.omit({ memberNo: true }).partial().strict()
  .refine((value) => Object.keys(value).length > 0, "Minimal satu kolom harus diubah");
export const memberSearchSchema = z.object({ q: z.string().trim().max(120).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
export const savingsDepositSchema = z.object({
  type: z.enum(["mandatory", "voluntary"]),
  amount: z.number().int().positive().safe(),
  note: z.string().trim().max(240).optional()
}).strict();
