import "./load-env";
import { pool } from "./index";

/**
 * How far away the database is.
 *
 * Worth having as a script because it is the number that decides how the whole
 * app feels, and it is invisible from the code. Every query costs one round
 * trip; a page makes about ten. At 194ms (London, from Manila) that is two
 * seconds of a page doing nothing but waiting. At 43ms (Singapore) it is four
 * hundred milliseconds. The SQL is identical either way.
 *
 * `select 1` is the point: it does no work, so whatever it costs is distance.
 * The comparison against a real aggregate is there to make that obvious — if
 * the two numbers match, the query is not what is slow.
 */
async function main() {
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/?]+)/)?.[1] ?? "unknown";
  console.log(`host: ${host}\n`);

  // Warm the pool first, or the first sample times the TLS handshake instead.
  await pool.query("select 1");

  const sample = async (label: string, sql: string) => {
    const times: number[] = [];
    for (let i = 0; i < 8; i++) {
      const started = performance.now();
      await pool.query(sql);
      times.push(performance.now() - started);
    }
    times.sort((a, b) => a - b);
    console.log(`${label.padEnd(28)} ${times[4]!.toFixed(0).padStart(4)} ms (median of 8)`);
  };

  await sample("select 1 — pure distance", "select 1");
  await sample("count(*) over tasks", "select count(*) from tasks");

  console.log(
    "\nIf those two are close, the cost is the network and not the query.\n" +
      "A page makes roughly ten round trips, so multiply by ten for a page load.",
  );
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
