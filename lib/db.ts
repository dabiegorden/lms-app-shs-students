import mongoose, { type Mongoose } from "mongoose";

const MONGODB_URL = process.env.MONGODB_URL as string;

if (!MONGODB_URL) {
  throw new Error(
    "Please define the MONGODB_URL environment variable inside .env.local",
  );
}

/**
 * In Next.js (App Router), we cache the DB connection on the global object
 * to avoid creating new connections on every hot reload or route call.
 */

declare global {
  var myMongoose:
    | {
        conn: Mongoose | null;
        promise: Promise<Mongoose> | null;
      }
    | undefined;
}

let cached = global.myMongoose;

if (!cached) {
  cached = global.myMongoose = { conn: null, promise: null };
}

export async function connectDB(): Promise<Mongoose> {
  if (cached!.conn) return cached!.conn;
  if (cached!.promise) return cached!.promise;

  const opts = { bufferCommands: false };

  cached!.promise = mongoose
    .connect(MONGODB_URL, opts)
    .then((mongooseInstance) => mongooseInstance);

  try {
    cached!.conn = await cached!.promise;
    console.log("MongoDB is connected");
  } catch (err) {
    cached!.promise = null;
    throw err;
  }

  return cached!.conn;
}
