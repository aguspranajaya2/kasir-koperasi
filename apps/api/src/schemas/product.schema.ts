import { z } from "zod";

export const productCreateSchema = z.object({
  sku: z.string().trim().min(1).max(48).optional(),
  barcode: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(160),
  categoryId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  unit: z.string().trim().min(1).max(24).default("pcs"),
  price: z.number().int().nonnegative().safe(),
  cost: z.number().int().nonnegative().safe(),
  stock: z.number().int().nonnegative().safe().default(0),
  lowStockThreshold: z.number().int().nonnegative().safe().default(5)
}).strict();

export const productUpdateSchema = productCreateSchema.omit({ stock: true }).partial().strict()
  .refine((value) => Object.keys(value).length > 0, "Minimal satu kolom harus diubah");
export const productSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  lowStock: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30)
});
export const stockAdjustmentSchema = z.object({
  delta: z.number().int().safe().refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(240)
}).strict();
