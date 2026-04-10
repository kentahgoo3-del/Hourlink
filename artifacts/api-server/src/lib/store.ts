import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { pool } from "./db";

/* ================= TYPES (UNCHANGED) ================= */

export type WorkspaceMember = {
  name: string;
  email: string;
  joinedAt: string;
};

export type Workspace = {
  code: string;
  ownerName: string;
  createdAt: string;
  members: WorkspaceMember[];
};

/* ================= HELPERS ================= */

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

/* ================= STORE ================= */

export const store = {
  /* ================= POSTGRES (FIXED) ================= */

  async createWorkspace(ownerName: string): Promise<Workspace> {
    let code = genCode();

    // Ensure unique code
    while (true) {
      const existing = await pool.query(
        "SELECT code FROM workspaces WHERE code = $1",
        [code],
      );
      if (existing.rowCount === 0) break;
      code = genCode();
    }

    const result = await pool.query(
      `INSERT INTO workspaces (code, owner_name)
       VALUES ($1, $2)
       RETURNING code, owner_name AS "ownerName", created_at AS "createdAt"`,
      [code, ownerName],
    );

    return {
      ...result.rows[0],
      members: [],
    };
  },

  async getWorkspace(code: string): Promise<Workspace | null> {
    const result = await pool.query(
      `SELECT code, owner_name AS "ownerName", created_at AS "createdAt"
       FROM workspaces
       WHERE code = $1`,
      [code.toUpperCase()],
    );

    if (result.rowCount === 0) return null;

    return {
      ...result.rows[0],
      members: [],
    };
  },

  /* ================= TEMP (KEEP OLD LOGIC FOR NOW) ================= */

  joinWorkspace(
    code: string,
    memberName: string,
    email?: string,
  ): Workspace | null {
    // TEMP until we migrate members table
    return null;
  },

  getAllTasks() {
    return [];
  },
};
