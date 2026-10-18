import type { ErrorRequestHandler } from "express";
import { logger } from "../config/logger.js";
import { HttpError } from "../utils/httpError.js";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof Error && error.message.includes("origin is not allowed")) {
    return res.status(403).json({ error: { code: "CORS_REJECTED", message: "Origin tidak diizinkan" } });
  }
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
  }
  if (error instanceof ZodError) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Parameter tidak valid" } });
  const mongoCode = (error as { code?: number })?.code;
  if (mongoCode === 11000) return res.status(409).json({ error: { code: "DUPLICATE", message: "Data sudah digunakan" } });
  logger.error({ err: error, path: req.path }, "Unhandled request error");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server" } });
};
