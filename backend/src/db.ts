// MongoDB connection. If MONGODB_URI is not set or the connection fails, the app
// falls back to an in-memory store so it stays runnable for local dev and demos.
import mongoose from "mongoose";
import { config, hasMongo } from "./config";

let connected = false;

export async function connectDb(): Promise<void> {
  if (!hasMongo) {
    console.log("[yaar] MONGODB_URI not set, using in-memory store.");
    return;
  }
  try {
    await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    console.log("[yaar] connected to MongoDB.");
  } catch (err) {
    console.error("[yaar] MongoDB connection failed, using in-memory store:", err);
  }
}

export function dbConnected(): boolean {
  return connected;
}
