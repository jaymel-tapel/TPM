/**
 * Loads env for anything outside Next.js (drizzle-kit, the seed and reset
 * scripts). Next loads these files itself.
 *
 * Two traps this exists to avoid:
 *
 * 1. **Import hoisting.** ES imports are evaluated before any top-level
 *    statement, so calling `config()` at the top of a script still runs *after*
 *    `./index` has built its pool from `process.env.DATABASE_URL`. Import this
 *    module first, for its side effect, so it wins.
 *
 * 2. **drizzle-kit pre-loads `.env` on its own.** dotenv never overwrites a
 *    variable that is already set, so a plain `config()` here is a no-op for
 *    `DATABASE_URL` — and migrations run against whatever `.env` happens to
 *    say. That silently migrated the wrong database once. `.env.local` is
 *    therefore loaded with `override: true`, matching Next's precedence.
 */
import { config } from "dotenv";

/**
 * Because the override above is unconditional, a caller that deliberately sets
 * DATABASE_URL for one run — the test harness pointing drizzle-kit at the
 * throwaway test database — would have it silently replaced. Such callers set
 * MERIDIAN_SKIP_DOTENV=1 to say "the environment I was given is the truth".
 */
if (process.env.MERIDIAN_SKIP_DOTENV !== "1") {
  config({ path: ".env.local", override: true });
  config({ path: ".env" });
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
