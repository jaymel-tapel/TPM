import { execSync } from "node:child_process";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://jaymel@localhost:5432/mb_tasks_test";

/**
 * Builds a throwaway database from the same migrations the app uses, so the
 * SQL under test is the SQL that ships. Runs once for the whole suite.
 */
export default function setup() {
  // This function drops a database. Refuse to run it against anything that is
  // not plainly a local test database — a stray DATABASE_URL in the
  // environment must never be able to reach production from here.
  const { hostname, pathname } = new URL(TEST_DATABASE_URL);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  const looksLikeTestDb = /(^|_)test$/.test(pathname.replace(/^\//, ""));

  if (!isLocal || !looksLikeTestDb) {
    throw new Error(
      `Refusing to run destructive test setup against "${hostname}${pathname}". ` +
        "TEST_DATABASE_URL must point at a local database whose name ends in _test.",
    );
  }

  const name = pathname.replace(/^\//, "");
  const admin = TEST_DATABASE_URL.replace(/\/[^/]+$/, "/postgres");

  execSync(`psql "${admin}" -q -c 'DROP DATABASE IF EXISTS ${name}'`, { stdio: "pipe" });
  execSync(`psql "${admin}" -q -c 'CREATE DATABASE ${name}'`, { stdio: "pipe" });
  execSync("pnpm exec drizzle-kit migrate", {
    stdio: "pipe",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      // Stop drizzle.config.ts loading .env.local over the top of the URL we
      // just set — otherwise the schema lands in whatever the app points at.
      MERIDIAN_SKIP_DOTENV: "1",
    },
  });
}
