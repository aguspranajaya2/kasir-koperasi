import bcrypt from "bcryptjs";
import { connectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { logger } from "../config/logger.js";

async function createInitialAdmin(): Promise<void> {
  const { INITIAL_ADMIN_EMAIL: email, INITIAL_ADMIN_NAME: name, INITIAL_ADMIN_PASSWORD: password } = env;
  if (!email || !name || !password || password.length < 12) {
    throw new Error("Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and INITIAL_ADMIN_PASSWORD (minimum 12 characters) in .env");
  }
  const normalizedEmail = email.toLowerCase();
  await connectDatabase();
  if (await User.exists({ email: normalizedEmail })) throw new Error("User for INITIAL_ADMIN_EMAIL already exists; refusing to reset credentials");
  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ name, email: normalizedEmail, passwordHash, role: "admin" });
  logger.info({ email: normalizedEmail }, "Initial administrator created");
  await (await import("mongoose")).default.disconnect();
}

createInitialAdmin().catch(async (error: unknown) => {
  logger.error({ err: error }, "Could not create initial administrator");
  await (await import("mongoose")).default.disconnect();
  process.exitCode = 1;
});
