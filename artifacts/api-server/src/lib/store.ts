import { pool } from "./db";

/* ================= TYPES ================= */

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

export type TeamMemberCredential = {
  name: string;
  email: string;
  password: string;
  role: string;
  isNew: boolean;
};

/* ================= HELPERS ================= */

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

function genPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

/* ================= STORE ================= */

export const store = {
  async createWorkspace(ownerName: string): Promise<Workspace> {
    let code = genCode();

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
    const normalizedCode = code.toUpperCase();

    const workspaceResult = await pool.query(
      `SELECT code, owner_name AS "ownerName", created_at AS "createdAt"
       FROM workspaces
       WHERE code = $1`,
      [normalizedCode],
    );

    if (workspaceResult.rowCount === 0) return null;

    const membersResult = await pool.query(
      `SELECT name, email, joined_at AS "joinedAt"
       FROM workspace_members
       WHERE workspace_code = $1
       ORDER BY joined_at ASC`,
      [normalizedCode],
    );

    return {
      ...workspaceResult.rows[0],
      members: membersResult.rows,
    };
  },

  async setTeamMembers(
    code: string,
    members: { name: string; email: string; role?: string }[],
  ): Promise<{
    ok: boolean;
    credentials: TeamMemberCredential[];
  }> {
    const normalizedCode = code.toUpperCase();

    const workspace = await pool.query(
      "SELECT code FROM workspaces WHERE code = $1",
      [normalizedCode],
    );

    if (workspace.rowCount === 0) {
      return { ok: false, credentials: [] };
    }

    const credentials: TeamMemberCredential[] = [];

    for (const member of members) {
      const name = member.name.trim();
      const email = member.email.trim().toLowerCase();
      const role = member.role || "member";

      const existing = await pool.query(
        `SELECT password, role
         FROM team_members
         WHERE workspace_code = $1 AND lower(email) = $2`,
        [normalizedCode, email],
      );

      if (existing.rowCount > 0) {
        await pool.query(
          `UPDATE team_members
           SET name = $3, role = $4
           WHERE workspace_code = $1 AND lower(email) = $2`,
          [normalizedCode, email, name, role],
        );

        credentials.push({
          name,
          email,
          password: existing.rows[0].password,
          role,
          isNew: false,
        });
      } else {
        const password = genPassword();

        await pool.query(
          `INSERT INTO team_members
           (workspace_code, name, email, password, role, first_login)
           VALUES ($1, $2, $3, $4, $5, TRUE)`,
          [normalizedCode, name, email, password, role],
        );

        credentials.push({
          name,
          email,
          password,
          role,
          isNew: true,
        });
      }
    }

    return { ok: true, credentials };
  },

  async joinWorkspace(
    code: string,
    memberName: string,
    email?: string,
  ): Promise<Workspace | null | "not_allowed"> {
    const normalizedCode = code.toUpperCase();
    const trimmedName = memberName.trim();
    const trimmedEmail = (email || "").trim().toLowerCase();

    const workspace = await pool.query(
      "SELECT code FROM workspaces WHERE code = $1",
      [normalizedCode],
    );

    if (workspace.rowCount === 0) return null;

    if (trimmedEmail) {
      const allowedTeamMember = await pool.query(
        `SELECT email
         FROM team_members
         WHERE workspace_code = $1 AND lower(email) = $2`,
        [normalizedCode, trimmedEmail],
      );

      if (allowedTeamMember.rowCount === 0) {
        return "not_allowed";
      }
    }

    const existingMember = await pool.query(
      `SELECT id
       FROM workspace_members
       WHERE workspace_code = $1 AND lower(email) = $2`,
      [normalizedCode, trimmedEmail],
    );

    if (trimmedEmail && existingMember.rowCount === 0) {
      await pool.query(
        `INSERT INTO workspace_members (workspace_code, name, email, joined_at)
         VALUES ($1, $2, $3, NOW())`,
        [normalizedCode, trimmedName, trimmedEmail],
      );
    }

    return this.getWorkspace(normalizedCode);
  },

  async loginTeamMember(
    code: string,
    email: string,
    password: string,
  ): Promise<{
    ok: boolean;
    reason?: string;
    name?: string;
    role?: string;
    firstLogin?: boolean;
  }> {
    const normalizedCode = code.toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT name, email, password, role, first_login AS "firstLogin"
       FROM team_members
       WHERE workspace_code = $1 AND lower(email) = $2`,
      [normalizedCode, normalizedEmail],
    );

    if (result.rowCount === 0) {
      return { ok: false, reason: "not_allowed" };
    }

    const member = result.rows[0];

    if (member.password !== password) {
      return { ok: false, reason: "wrong_password" };
    }

    const existingWorkspaceMember = await pool.query(
      `SELECT id
       FROM workspace_members
       WHERE workspace_code = $1 AND lower(email) = $2`,
      [normalizedCode, normalizedEmail],
    );

    if (existingWorkspaceMember.rowCount === 0) {
      await pool.query(
        `INSERT INTO workspace_members (workspace_code, name, email, joined_at)
         VALUES ($1, $2, $3, NOW())`,
        [normalizedCode, member.name, member.email, normalizedEmail],
      );
    }

    return {
      ok: true,
      name: member.name,
      role: member.role,
      firstLogin: member.firstLogin,
    };
  },

  getAllTasks(): [] {
    return [];
  },
};
