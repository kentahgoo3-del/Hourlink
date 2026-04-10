import { pool } from "./lib/db";

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      code TEXT PRIMARY KEY,
      owner_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("DB initialized");
  await pool.end();
  process.exit(0);
}

init().catch(async (err) => {
  console.error("DB init failed:", err);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
