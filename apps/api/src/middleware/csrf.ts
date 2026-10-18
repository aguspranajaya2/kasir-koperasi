import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { webOrigin } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const equal = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (safeMethods.has(req.method) || req.path === "/auth/login") return next();
  const origin = req.get("origin");
  if (origin && origin !== webOrigin) return next(new HttpError(403, "Origin tidak diizinkan", "CSRF_REJECTED"));
  const cookie = req.cookies?.["koperasi_csrf"] as string | undefined;
  const header = req.get("x-csrf-token");
  if (!cookie || !header || !equal(cookie, header)) {
    return next(new HttpError(403, "Token CSRF tidak valid", "CSRF_REJECTED"));
  }
  next();
};
