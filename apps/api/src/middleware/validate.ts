import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { HttpError } from "../utils/httpError.js";

export const validateBody = (schema: ZodType): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(new HttpError(400, "Input tidak valid", "VALIDATION_ERROR"));
  req.body = result.data;
  next();
};

export const validateQuery = (schema: ZodType): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) return next(new HttpError(400, "Parameter pencarian tidak valid", "VALIDATION_ERROR"));
  Object.assign(req.query, result.data);
  next();
};
