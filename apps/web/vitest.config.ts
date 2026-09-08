import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * The SQL tests run against a real Postgres. Testing the completion-rate
 * definition without a database would be theatre — the whole risk lives in the
 * SQL, not in the TypeScript around it.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // `server-only` throws outside a React Server Component. The modules
      // under test are server modules; in Node they are just modules.
      "server-only": path.resolve(import.meta.dirname, "./test/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts"],
    // Suites share one Postgres database; running them in parallel would let
    // one suite's fixture truncate another's mid-assertion.
    fileParallelism: false,
  },
});
