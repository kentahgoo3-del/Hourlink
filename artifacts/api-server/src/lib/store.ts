import { pool } from "./db";

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

export type ClientCredential = {
  name: string;
  email: string;
  password: string;
  isNew: boolean;
};

export type SharedTask = {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  fromUser: string;
  fromEmail: string;
  forEmail: string;
  assignedTo: string;
  dueDate: string | null;
  sentAt: string;
  claimed: boolean;
  status: "pending" | "in_progress" | "done";
  source: "client" | "freelancer" | "team";
};

export type TimeEntry = {
  id: string;
  taskId: string;
  memberEmail: string;
  memberName: string;
  startedAt: string;
  stoppedAt: string | null;
  duration: number | null;
};

export type TaskNote = {
  id: string;
  taskId: string;
  authorName: string;
  authorEmail: string;
  text: string;
  createdAt: string;
};

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

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

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

      if ((existing.rowCount ?? 0) > 0) {
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

  async setAllowedClients(
    code: string,
    clients: { name: string; email: string }[],
  ): Promise<{
    ok: boolean;
    credentials: ClientCredential[];
  }> {
    const normalizedCode = code.toUpperCase();

    const workspace = await pool.query(
      "SELECT code FROM workspaces WHERE code = $1",
      [normalizedCode],
    );

    if (workspace.rowCount === 0) {
      return { ok: false, credentials: [] };
    }

    const credentials: ClientCredential[] = [];

    for (const client of clients) {
      const name = String(client.name || "").trim();
      const email = String(client.email || "")
        .trim()
        .toLowerCase();

      if (!name || !email) continue;

      const existing = await pool.query(
        `SELECT password, first_login AS "firstLogin"
         FROM team_members
         WHERE workspace_code = $1
           AND lower(email) = $2
           AND role = 'client'`,
        [normalizedCode, email],
      );

      if ((existing.rowCount ?? 0) > 0) {
        await pool.query(
          `UPDATE team_members
           SET name = $3
           WHERE workspace_code = $1
             AND lower(email) = $2
             AND role = 'client'`,
          [normalizedCode, email, name],
        );

        credentials.push({
          name,
          email,
          password: existing.rows[0].password,
          isNew: false,
        });
      } else {
        const password = genPassword();

        await pool.query(
          `INSERT INTO team_members
           (workspace_code, name, email, password, role, first_login)
           VALUES ($1, $2, $3, $4, 'client', TRUE)`,
          [normalizedCode, name, email, password],
        );

        credentials.push({
          name,
          email,
          password,
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

    if (trimmedEmail) {
      const existingMember = await pool.query(
        `SELECT id
         FROM workspace_members
         WHERE workspace_code = $1 AND lower(email) = $2`,
        [normalizedCode, trimmedEmail],
      );

      if (existingMember.rowCount === 0) {
        await pool.query(
          `INSERT INTO workspace_members (workspace_code, name, email, joined_at)
           VALUES ($1, $2, $3, NOW())`,
          [normalizedCode, trimmedName, trimmedEmail],
        );
      }
    }

    return await this.getWorkspace(normalizedCode);
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

    const workspaceCheck = await pool.query(
      `SELECT code FROM workspaces WHERE code = $1`,
      [normalizedCode],
    );

    if (workspaceCheck.rowCount === 0) {
      return { ok: false, reason: "not_found" };
    }

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
        [normalizedCode, member.name, member.email],
      );
    }

    return {
      ok: true,
      name: member.name,
      role: member.role,
      firstLogin: member.firstLogin,
    };
  },

  async loginClient(
    code: string,
    email: string,
    password: string,
  ): Promise<{
    ok: boolean;
    reason?: string;
    name?: string;
    firstLogin?: boolean;
  }> {
    const normalizedCode = code.toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    const workspaceCheck = await pool.query(
      `SELECT code FROM workspaces WHERE code = $1`,
      [normalizedCode],
    );

    if (workspaceCheck.rowCount === 0) {
      return { ok: false, reason: "not_found" };
    }

    const result = await pool.query(
      `SELECT name, email, password, first_login AS "firstLogin"
       FROM team_members
       WHERE workspace_code = $1
         AND lower(email) = $2
         AND role = 'client'`,
      [normalizedCode, normalizedEmail],
    );

    if (result.rowCount === 0) {
      return { ok: false, reason: "not_allowed" };
    }

    const client = result.rows[0];

    if (client.password !== password) {
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
        [normalizedCode, client.name, client.email],
      );
    }

    return {
      ok: true,
      name: client.name,
      firstLogin: client.firstLogin,
    };
  },

  async markFirstLoginDone(code: string, email: string): Promise<boolean> {
    const normalizedCode = code.toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `UPDATE team_members
       SET first_login = FALSE
       WHERE workspace_code = $1 AND lower(email) = $2`,
      [normalizedCode, normalizedEmail],
    );

    return (result.rowCount ?? 0) > 0;
  },

  async changePassword(
    code: string,
    email: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const normalizedCode = code.toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT password
       FROM team_members
       WHERE workspace_code = $1 AND lower(email) = $2`,
      [normalizedCode, normalizedEmail],
    );

    if (result.rowCount === 0) {
      return { ok: false, reason: "not_found" };
    }

    const member = result.rows[0];

    if (member.password !== oldPassword) {
      return { ok: false, reason: "wrong_password" };
    }

    await pool.query(
      `UPDATE team_members
       SET password = $3, first_login = FALSE
       WHERE workspace_code = $1 AND lower(email) = $2`,
      [normalizedCode, normalizedEmail, newPassword],
    );

    return { ok: true };
  },

  async addTask(
    code: string,
    task: Omit<SharedTask, "id" | "sentAt" | "claimed" | "status">,
  ): Promise<SharedTask | null> {
    const normalizedCode = code.toUpperCase();

    const workspace = await pool.query(
      `SELECT code FROM workspaces WHERE code = $1`,
      [normalizedCode],
    );

    if (workspace.rowCount === 0) {
      return null;
    }

    const id = genId();

    const result = await pool.query(
      `INSERT INTO tasks (
        id, workspace_code, title, description, priority,
        from_user, from_email, for_email, assigned_to, due_date,
        claimed, status, source
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        FALSE, 'pending', $11
      )
      RETURNING
        id,
        title,
        description,
        priority,
        from_user AS "fromUser",
        from_email AS "fromEmail",
        for_email AS "forEmail",
        assigned_to AS "assignedTo",
        due_date AS "dueDate",
        sent_at AS "sentAt",
        claimed,
        status,
        source`,
      [
        id,
        normalizedCode,
        task.title,
        task.description || "",
        task.priority,
        task.fromUser,
        task.fromEmail || "",
        task.forEmail || "",
        task.assignedTo || "",
        task.dueDate || null,
        task.source || "client",
      ],
    );

    return result.rows[0];
  },

  async getAllTasks(code: string): Promise<SharedTask[]> {
    const normalizedCode = code.toUpperCase();

    const result = await pool.query(
      `SELECT
         id,
         title,
         description,
         priority,
         from_user AS "fromUser",
         from_email AS "fromEmail",
         for_email AS "forEmail",
         assigned_to AS "assignedTo",
         due_date AS "dueDate",
         sent_at AS "sentAt",
         claimed,
         status,
         source
       FROM tasks
       WHERE workspace_code = $1
       ORDER BY sent_at DESC`,
      [normalizedCode],
    );

    return result.rows;
  },

  async getTasksByEmail(code: string, email: string): Promise<SharedTask[]> {
    const normalizedCode = code.toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT
         id,
         title,
         description,
         priority,
         from_user AS "fromUser",
         from_email AS "fromEmail",
         for_email AS "forEmail",
         assigned_to AS "assignedTo",
         due_date AS "dueDate",
         sent_at AS "sentAt",
         claimed,
         status,
         source
       FROM tasks
       WHERE workspace_code = $1
         AND (
           lower(from_email) = $2
           OR lower(for_email) = $2
         )
       ORDER BY sent_at DESC`,
      [normalizedCode, normalizedEmail],
    );

    return result.rows;
  },

  async getTeamTasks(code: string, email: string): Promise<SharedTask[]> {
    const normalizedCode = code.toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT
         id,
         title,
         description,
         priority,
         from_user AS "fromUser",
         from_email AS "fromEmail",
         for_email AS "forEmail",
         assigned_to AS "assignedTo",
         due_date AS "dueDate",
         sent_at AS "sentAt",
         claimed,
         status,
         source
       FROM tasks
       WHERE workspace_code = $1
         AND lower(assigned_to) = $2
       ORDER BY sent_at DESC`,
      [normalizedCode, normalizedEmail],
    );

    return result.rows;
  },

  async getPendingTasks(code: string): Promise<SharedTask[]> {
    const normalizedCode = code.toUpperCase();

    const result = await pool.query(
      `SELECT
         id,
         title,
         description,
         priority,
         from_user AS "fromUser",
         from_email AS "fromEmail",
         for_email AS "forEmail",
         assigned_to AS "assignedTo",
         due_date AS "dueDate",
         sent_at AS "sentAt",
         claimed,
         status,
         source
       FROM tasks
       WHERE workspace_code = $1 AND claimed = FALSE
       ORDER BY sent_at DESC`,
      [normalizedCode],
    );

    return result.rows;
  },

  async claimTask(code: string, taskId: string): Promise<boolean> {
    const normalizedCode = code.toUpperCase();

    const result = await pool.query(
      `UPDATE tasks
       SET claimed = TRUE
       WHERE workspace_code = $1 AND id = $2`,
      [normalizedCode, taskId],
    );

    return (result.rowCount ?? 0) > 0;
  },

  async updateTaskStatus(
    code: string,
    taskId: string,
    status: "pending" | "in_progress" | "done",
  ): Promise<boolean> {
    const normalizedCode = code.toUpperCase();

    const result = await pool.query(
      `UPDATE tasks
       SET status = $3,
           claimed = CASE WHEN $3 = 'done' THEN TRUE ELSE claimed END
       WHERE workspace_code = $1 AND id = $2`,
      [normalizedCode, taskId, status],
    );

    return (result.rowCount ?? 0) > 0;
  },

  async startTimeEntry(
    code: string,
    taskId: string,
    memberEmail: string,
    memberName: string,
  ): Promise<TimeEntry | null> {
    const normalizedCode = code.toUpperCase();
    const normalizedEmail = memberEmail.trim().toLowerCase();

    const taskCheck = await pool.query(
      `SELECT id
       FROM tasks
       WHERE workspace_code = $1 AND id = $2`,
      [normalizedCode, taskId],
    );

    if (taskCheck.rowCount === 0) {
      return null;
    }

    const running = await pool.query(
      `SELECT id
       FROM time_entries
       WHERE workspace_code = $1
         AND lower(member_email) = $2
         AND stopped_at IS NULL`,
      [normalizedCode, normalizedEmail],
    );

    if (running.rowCount > 0) {
      return null;
    }

    const id = genId();

    const result = await pool.query(
      `INSERT INTO time_entries (
        id, workspace_code, task_id, member_email, member_name
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        task_id AS "taskId",
        member_email AS "memberEmail",
        member_name AS "memberName",
        started_at AS "startedAt",
        stopped_at AS "stoppedAt",
        duration`,
      [id, normalizedCode, taskId, normalizedEmail, memberName],
    );

    return result.rows[0];
  },

  async stopTimeEntry(
    code: string,
    entryId: string,
  ): Promise<TimeEntry | null> {
    const normalizedCode = code.toUpperCase();

    const current = await pool.query(
      `SELECT started_at AS "startedAt"
       FROM time_entries
       WHERE workspace_code = $1
         AND id = $2
         AND stopped_at IS NULL`,
      [normalizedCode, entryId],
    );

    if (current.rowCount === 0) {
      return null;
    }

    const startedAt = new Date(current.rows[0].startedAt).getTime();
    const stoppedAt = new Date();
    const duration = Math.round((stoppedAt.getTime() - startedAt) / 1000);

    const result = await pool.query(
      `UPDATE time_entries
       SET stopped_at = $3, duration = $4
       WHERE workspace_code = $1 AND id = $2
       RETURNING
         id,
         task_id AS "taskId",
         member_email AS "memberEmail",
         member_name AS "memberName",
         started_at AS "startedAt",
         stopped_at AS "stoppedAt",
         duration`,
      [normalizedCode, entryId, stoppedAt.toISOString(), duration],
    );

    return result.rows[0] ?? null;
  },

  async getTimeEntries(
    code: string,
    email?: string,
    taskId?: string,
  ): Promise<TimeEntry[]> {
    const normalizedCode = code.toUpperCase();
    const values: any[] = [normalizedCode];
    const conditions = [`workspace_code = $1`];

    if (email) {
      values.push(email.trim().toLowerCase());
      conditions.push(`lower(member_email) = $${values.length}`);
    }

    if (taskId) {
      values.push(taskId);
      conditions.push(`task_id = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT
         id,
         task_id AS "taskId",
         member_email AS "memberEmail",
         member_name AS "memberName",
         started_at AS "startedAt",
         stopped_at AS "stoppedAt",
         duration
       FROM time_entries
       WHERE ${conditions.join(" AND ")}
       ORDER BY started_at DESC`,
      values,
    );

    return result.rows;
  },

  async getRunningEntry(
    code: string,
    email: string,
  ): Promise<TimeEntry | null> {
    const normalizedCode = code.toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT
         id,
         task_id AS "taskId",
         member_email AS "memberEmail",
         member_name AS "memberName",
         started_at AS "startedAt",
         stopped_at AS "stoppedAt",
         duration
       FROM time_entries
       WHERE workspace_code = $1
         AND lower(member_email) = $2
         AND stopped_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`,
      [normalizedCode, normalizedEmail],
    );

    return result.rows[0] ?? null;
  },

  async addTaskNote(
    code: string,
    taskId: string,
    authorName: string,
    authorEmail: string,
    text: string,
  ): Promise<TaskNote | null> {
    const normalizedCode = code.toUpperCase();

    const taskCheck = await pool.query(
      `SELECT id
       FROM tasks
       WHERE workspace_code = $1 AND id = $2`,
      [normalizedCode, taskId],
    );

    if (taskCheck.rowCount === 0) {
      return null;
    }

    const id = genId();

    const result = await pool.query(
      `INSERT INTO task_notes (
        id, workspace_code, task_id, author_name, author_email, text
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        task_id AS "taskId",
        author_name AS "authorName",
        author_email AS "authorEmail",
        text,
        created_at AS "createdAt"`,
      [id, normalizedCode, taskId, authorName, authorEmail || "", text],
    );

    return result.rows[0];
  },

  async getTaskNotes(code: string, taskId: string): Promise<TaskNote[]> {
    const normalizedCode = code.toUpperCase();

    const result = await pool.query(
      `SELECT
         id,
         task_id AS "taskId",
         author_name AS "authorName",
         author_email AS "authorEmail",
         text,
         created_at AS "createdAt"
       FROM task_notes
       WHERE workspace_code = $1 AND task_id = $2
       ORDER BY created_at ASC`,
      [normalizedCode, taskId],
    );

    return result.rows;
  },

  async getAllTaskNotes(code: string, since?: string): Promise<TaskNote[]> {
    const normalizedCode = code.toUpperCase();

    if (since) {
      const result = await pool.query(
        `SELECT
           id,
           task_id AS "taskId",
           author_name AS "authorName",
           author_email AS "authorEmail",
           text,
           created_at AS "createdAt"
         FROM task_notes
         WHERE workspace_code = $1 AND created_at > $2
         ORDER BY created_at DESC`,
        [normalizedCode, since],
      );

      return result.rows;
    }

    const result = await pool.query(
      `SELECT
         id,
         task_id AS "taskId",
         author_name AS "authorName",
         author_email AS "authorEmail",
         text,
         created_at AS "createdAt"
       FROM task_notes
       WHERE workspace_code = $1
       ORDER BY created_at DESC`,
      [normalizedCode],
    );

    return result.rows;
  },
};
