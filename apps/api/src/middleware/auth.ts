import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { Role } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";

type AccessClaims = jwt.JwtPayload & { role: Role; sid: string };

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.["koperasi_access"] as string | undefined;
  if (!token) return next(new HttpError(401, "Silakan masuk terlebih dahulu", "UNAUTHENTICATED"));
  try {
    const claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"], issuer: "koperasi-api", audience: "koperasi-web" }) as AccessClaims;
    if (!claims.sub || !claims.sid || !["admin", "cashier", "board"].includes(claims.role)) throw new Error("Invalid claims");
    req.auth = { userId: claims.sub, role: claims.role };
    next();
  } catch {
    next(new HttpError(401, "Sesi tidak valid atau telah berakhir", "UNAUTHENTICATED"));
  }
};

export const allowRoles = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) return next(new HttpError(403, "Akses tidak diizinkan", "FORBIDDEN"));
  next();
};
