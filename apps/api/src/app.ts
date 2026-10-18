import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import { env, webOrigin } from "./config/env.js";
import { logger } from "./config/logger.js";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { productRouter } from "./routes/product.routes.js";
import { categoryRouter } from "./routes/category.routes.js";
import { memberRouter } from "./routes/member.routes.js";
import { transactionRouter } from "./routes/transaction.routes.js";
import { cashMovementRouter, reportRouter } from "./routes/report.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { configRouter } from "./routes/config.routes.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === webOrigin) return callback(null, true);
    callback(new Error("origin is not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  maxAge: 600
}));
app.use(express.json({ limit: "256kb", type: "application/json" }));
app.use(cookieParser());
app.use(pinoHttp({
  logger,
  quietReqLogger: true,
  quietResLogger: true,
  customSuccessObject: (req, res, fields) => ({
    req: { id: req.id, method: req.method, url: req.url?.split("?")[0] },
    statusCode: res.statusCode,
    responseTime: fields.responseTime
  }),
  customErrorObject: (req, res, error, fields) => ({
    req: { id: req.id, method: req.method, url: req.url?.split("?")[0] },
    statusCode: res.statusCode,
    err: { type: error.name, message: error.message },
    responseTime: fields.responseTime
  }),
  autoLogging: { ignore: (req) => req.url === "/healthz" }
}));

app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/readyz", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready" });
});
const api = express.Router();
api.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }));
api.use(csrfProtection);
api.use("/auth", authRouter);
api.use("/users", userRouter);
api.use("/config", configRouter);
api.use("/products", productRouter);
api.use("/categories", categoryRouter);
api.use("/members", memberRouter);
api.use("/transactions", transactionRouter);
api.use("/cash-movements", cashMovementRouter);
api.use("/reports", reportRouter);
app.use("/api/v1", api);

app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Endpoint tidak ditemukan" } }));
app.use(errorHandler);

export { app };
