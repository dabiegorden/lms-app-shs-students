import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "Please define the DATABASE_URL environment variable inside .env",
  );
}

/**
 * A pooled TCP connection (node-postgres) rather than the per-query HTTP
 * driver. On a long-running Next.js server this is far more resilient: the
 * pool keeps connections open and transparently waits for Neon's compute to
 * wake from auto-suspend instead of failing fast with "fetch failed".
 *
 * The pool is cached on the global object so Next.js hot-reloads in dev don't
 * open a new pool (and leak connections) on every change.
 */
const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
};

const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export const db = drizzle(pool, { schema });

export { schema };
