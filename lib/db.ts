/**
 * Database access layer.
 *
 * The project migrated from MongoDB/Mongoose to PostgreSQL (Neon) + Drizzle ORM.
 * `db` is the Drizzle client. `connectDB()` is kept as a no-op compatibility
 * helper so existing route handlers that `await connectDB()` continue to work —
 * Neon's HTTP driver is connectionless, so there is nothing to "connect".
 */
import { db, schema } from "@/src/db";

export { db, schema };

export async function connectDB() {
  return db;
}
