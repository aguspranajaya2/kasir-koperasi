import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";

export const configRouter = Router();
configRouter.get("/checkout", requireAuth, (_req, res) => {
  res.set("Cache-Control", "private, max-age=300").json({ taxRateBps: env.SALES_TAX_RATE_BPS });
});
