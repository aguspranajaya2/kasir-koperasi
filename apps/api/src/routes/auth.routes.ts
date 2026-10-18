import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { accessTokenMaxAgeMs, env } from "../config/env.js";
import { User } from "../models/User.js";
import { AuthSession } from "../models/AuthSession.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { loginSchema } from "../schemas/auth.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";

export const authRouter = Router();
const accessCookie = "koperasi_access";
const refreshCookie = "koperasi_refresh";
const csrfCookie = "koperasi_csrf";
const cookieOptions = {
  secure: env.COOKIE_SECURE,
  sameSite: "strict" as const,
  path: "/",
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {})
};
const refreshOptions = { ...cookieOptions, path: "/api/v1/auth", httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 };
const refreshClearOptions = { ...cookieOptions, path: "/api/v1/auth", httpOnly: true };
const refreshHash = (token: string): string => createHash("sha256").update(token).digest("hex");
const issueAccessToken = (user: { _id: { toString(): string }; role: string }, sessionId: string): string => jwt.sign(
  { role: user.role, sid: sessionId }, env.JWT_SECRET,
  { algorithm: "HS256", issuer: "koperasi-api", audience: "koperasi-web", subject: user._id.toString(), expiresIn: env.JWT_TTL as NonNullable<jwt.SignOptions["expiresIn"]> }
);

authRouter.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }), validateBody(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await User.findOne({ email, active: true }).select("+passwordHash");
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) throw new HttpError(401, "Email atau kata sandi salah", "INVALID_CREDENTIALS");

  const refreshSecret = randomBytes(48).toString("base64url");
  const session = await AuthSession.create({ userId: user._id, refreshHash: refreshHash(refreshSecret), expiresAt: new Date(Date.now() + refreshOptions.maxAge) });
  const token = issueAccessToken(user, session.id);
  const csrf = randomBytes(32).toString("base64url");
  user.lastLoginAt = new Date();
  await user.save();
  res.cookie(accessCookie, token, { ...cookieOptions, httpOnly: true, maxAge: accessTokenMaxAgeMs });
  res.cookie(refreshCookie, `${session.id}.${refreshSecret}`, refreshOptions);
  res.cookie(csrfCookie, csrf, { ...cookieOptions, httpOnly: false, maxAge: refreshOptions.maxAge });
  res.json({ user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role }, csrfToken: csrf });
}));

authRouter.post("/refresh", asyncHandler(async (req, res) => {
  const raw = req.cookies?.[refreshCookie] as string | undefined;
  const [sessionId, secret] = raw?.split(".") ?? [];
  if (!sessionId || !secret || !/^[a-f\d]{24}$/i.test(sessionId)) throw new HttpError(401, "Sesi perlu masuk ulang", "UNAUTHENTICATED");
  const session = await AuthSession.findOne({ _id: sessionId, revokedAt: null, expiresAt: { $gt: new Date() } }).select("+refreshHash");
  if (!session) throw new HttpError(401, "Sesi perlu masuk ulang", "UNAUTHENTICATED");
  const expected = Buffer.from(session.refreshHash, "hex");
  const actual = Buffer.from(refreshHash(secret), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new HttpError(401, "Sesi perlu masuk ulang", "UNAUTHENTICATED");
  const user = await User.findOne({ _id: session.userId, active: true }).select("name email role active");
  if (!user) {
    await AuthSession.updateOne({ _id: session.id }, { $set: { revokedAt: new Date() } });
    throw new HttpError(401, "Akun tidak aktif", "UNAUTHENTICATED");
  }
  const nextSecret = randomBytes(48).toString("base64url");
  const rotated = await AuthSession.updateOne(
    { _id: session.id, refreshHash: session.refreshHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { refreshHash: refreshHash(nextSecret), lastUsedAt: new Date() } }
  );
  if (rotated.modifiedCount !== 1) throw new HttpError(401, "Sesi perlu masuk ulang", "UNAUTHENTICATED");
  res.cookie(accessCookie, issueAccessToken(user, session.id), { ...cookieOptions, httpOnly: true, maxAge: accessTokenMaxAgeMs });
  res.cookie(refreshCookie, `${session.id}.${nextSecret}`, refreshOptions);
  res.json({ user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role } });
}));

authRouter.post("/logout", requireAuth, asyncHandler(async (_req, res) => {
  const raw = _req.cookies?.[refreshCookie] as string | undefined;
  const sessionId = raw?.split(".")[0];
  if (sessionId && /^[a-f\d]{24}$/i.test(sessionId)) await AuthSession.updateOne({ _id: sessionId, userId: _req.auth!.userId }, { $set: { revokedAt: new Date() } });
  res.clearCookie(accessCookie, { ...cookieOptions, httpOnly: true });
  res.clearCookie(refreshCookie, refreshClearOptions);
  res.clearCookie(csrfCookie, { ...cookieOptions, httpOnly: false });
  res.status(204).end();
}));

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth?.userId).select("name email role active");
  if (!user?.active) throw new HttpError(401, "Akun tidak aktif", "UNAUTHENTICATED");
  const csrf = req.cookies?.[csrfCookie] as string | undefined ?? randomBytes(32).toString("base64url");
  res.cookie(csrfCookie, csrf, { ...cookieOptions, httpOnly: false, maxAge: refreshOptions.maxAge });
  res.json({ user, csrfToken: csrf });
}));
