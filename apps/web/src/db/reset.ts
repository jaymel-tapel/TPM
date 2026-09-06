import "dotenv/config";
import { pool } from "./index";

/** Drops everything so `db:reset` can rebuild from migrations. */
async function main() {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log("Schema dropped.");
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
