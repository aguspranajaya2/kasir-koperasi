import dotenv from "dotenv";
import mongoose from "mongoose";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is required");

async function initializeLocalReplica() {
  const directUri = new URL(mongoUri);
  directUri.searchParams.delete("replicaSet");
  directUri.searchParams.set("directConnection", "true");

  try {
    await mongoose.connect(directUri.toString(), { serverSelectionTimeoutMS: 10_000 });
    try {
      await mongoose.connection.db.admin().command({
        replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] }
      });
      console.info("Local replica set rs0 initialized.");
    } catch (error) {
      if (error.code !== 23 && error.codeName !== "AlreadyInitialized") throw error;
      console.info("Local replica set rs0 was already initialized.");
    }
  } finally {
    await mongoose.disconnect();
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15_000 });
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (hello.isWritablePrimary !== true) throw new Error("Local MongoDB replica set did not elect a primary");
    console.info("Local MongoDB replica set is ready for transactions.");
  } finally {
    await mongoose.disconnect();
  }
}

initializeLocalReplica().catch(async (error) => {
  console.error("Could not initialize the local MongoDB replica set:", error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
