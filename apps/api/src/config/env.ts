import dotenv from "dotenv";
import { resolve } from "node:path";
dotenv.config();
dotenv.config({ path: resolve(process.cwd(), "../../.env") });
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  WEB_ORIGIN: z.string().url(),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_TTL: z.string().regex(/^\d+[smhd]$/).default("15m"),
  SALES_TAX_RATE_BPS: z.coerce.number().int().min(0).max(10000).default(0),
  SALES_BUSINESS_TIMEZONE: z.string().default("Asia/Makassar").refine((value) => {
    try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
  }, "Unknown business timezone"),
  COOKIE_DOMAIN: z.string().optional().default(""),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  INITIAL_ADMIN_NAME: z.string().optional(),
  INITIAL_ADMIN_EMAIL: z.string().email().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.string().default("info")
}).superRefine((values, ctx) => {
  if (values.NODE_ENV === "production" && !values.COOKIE_SECURE) {
    ctx.addIssue({ code: "custom", path: ["COOKIE_SECURE"], message: "COOKIE_SECURE must be true in production" });
  }
  if (values.NODE_ENV === "production" && values.JWT_SECRET.toLowerCase().includes("replace-with")) {
    ctx.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "Replace the example JWT secret before production" });
  }
});

export const env = envSchema.parse(process.env);
const ttl = env.JWT_TTL.match(/^(\d+)([smhd])$/)!;
const ttlMultiplier: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
export const accessTokenMaxAgeMs = Number(ttl[1]) * ttlMultiplier[ttl[2]!]!;
export const webOrigin = new URL(env.WEB_ORIGIN).origin;
