import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __pool?: Pool };

/**
 * `sslmode=require` currently means full certificate verification in `pg`, but
 * v9 will give it libpq's weaker meaning — encrypt, verify nothing. Saying
 * `verify-full` outright keeps today's behaviour when that lands, and stops pg
 * warning about it on every cold start.
 */
function connectionString() {
  const url = process.env.DATABASE_URL ?? "";
  return url.replace(/sslmode=(require|prefer|verify-ca)\b/, "sslmode=verify-full");
}

export const pool =
  globalForDb.__pool ?? new Pool({ connectionString: connectionString(), max: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.__pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
