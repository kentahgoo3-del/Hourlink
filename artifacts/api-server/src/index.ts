import app from "./app";
import { pool } from "./lib/db";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      code TEXT PRIMARY KEY,
      owner_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
      workspace_code TEXT NOT NULL REFERENCES workspaces(code) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      first_login BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (workspace_code, email)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id SERIAL PRIMARY KEY,
      workspace_code TEXT NOT NULL REFERENCES workspaces(code) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_code, email)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      workspace_code TEXT NOT NULL REFERENCES workspaces(code) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      from_user TEXT NOT NULL,
      from_email TEXT NOT NULL DEFAULT '',
      for_email TEXT NOT NULL DEFAULT '',
      assigned_to TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      claimed BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'client'
    );
  `);

  logger.info("DB initialized");
}

initDB()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize database");
    process.exit(1);
  });
