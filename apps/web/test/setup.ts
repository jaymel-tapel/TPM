import { afterAll } from "vitest";
import { TEST_DATABASE_URL } from "./global-setup";

// Set before any module reads it: `@/db` builds its pool at import time.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.APP_TIMEZONE ??= "Asia/Manila";
process.env.AUTH_SECRET ??= "test-secret-not-used-for-anything-real";

// Close the shared pool once per test file, after every suite in it has run.
// Doing this in a suite's own afterAll would pull the pool out from under the
// suites that follow it in the same file.
afterAll(async () => {
  const { pool } = await import("@/db");
  await pool.end();
});
