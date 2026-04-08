import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

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

export type TaskNote = {
  id: string;
  taskId: string;
  authorName: string;
  authorEmail: string;
  text: string;
  createdAt: string;
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

export type AllowedClient = {
  name: string;
  email: string;
  password: string;
  firstLogin: boolean;
};

export type TeamMember = {
  name: string;
  email: string;
  password: string;
  firstLogin: boolean;
  role: string;
};

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
  tasks: SharedTask[];
  allowedClients: AllowedClient[];
  teamMembers: TeamMember[];
  timeEntries: TimeEntry[];
  taskNotes: TaskNote[];
};

const DATA_PATH = join("/tmp", "workpilot_workspaces.json");

function load(): Record<string, Workspace> {
  if (!existsSync(DATA_PATH)) return {};
  try {
    const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
    for (const key of Object.keys(data)) {
      if (!data[key].allowedClients) data[key].allowedClients = [];
      if (!data[key].tasks) data[key].tasks = [];
      if (!data[key].members) data[key].members = [];
      if (!data[key].teamMembers) data[key].teamMembers = [];
      if (!data[key].timeEntries) data[key].timeEntries = [];
      if (!data[key].taskNotes) data[key].taskNotes = [];
      for (const t of data[key].tasks) {
        if (!t.forEmail) t.forEmail = "";
        if (!t.assignedTo) t.assignedTo = "";
        if (t.dueDate === undefined) t.dueDate = null;
        if (!t.source) t.source = "client";
      }
    }
    return data;
  }
  catch { return {}; }
}

function save(data: Record<string, Workspace>) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function genPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const store = {
  createWorkspace(ownerName: string): Workspace {
    const data = load();
    let code = genCode();
    while (data[code]) code = genCode();
    const ws: Workspace = {
      code, ownerName, createdAt: new Date().toISOString(),
      members: [], tasks: [], allowedClients: [],
      teamMembers: [], timeEntries: [], taskNotes: [],
    };
    data[code] = ws;
    save(data);
    return ws;
  },

  getWorkspace(code: string): Workspace | null {
    const data = load();
    return data[code.toUpperCase()] ?? null;
  },

  setAllowedClients(code: string, clients: { name: string; email: string }[]): { ok: boolean; credentials: { name: string; email: string; password: string; isNew: boolean }[] } {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return { ok: false, credentials: [] };

    const existingMap = new Map<string, AllowedClient>();
    for (const c of ws.allowedClients) {
      existingMap.set(c.email.toLowerCase(), c);
    }

    const credentials: { name: string; email: string; password: string; isNew: boolean }[] = [];
    const newAllowed: AllowedClient[] = [];

    for (const c of clients) {
      const existing = existingMap.get(c.email.toLowerCase());
      if (existing) {
        existing.name = c.name;
        newAllowed.push(existing);
        credentials.push({ name: c.name, email: c.email, password: existing.password, isNew: false });
      } else {
        const password = genPassword();
        newAllowed.push({ name: c.name, email: c.email, password, firstLogin: true });
        credentials.push({ name: c.name, email: c.email, password, isNew: true });
      }
    }

    ws.allowedClients = newAllowed;
    save(data);
    return { ok: true, credentials };
  },

  setTeamMembers(code: string, members: { name: string; email: string; role?: string }[]): { ok: boolean; credentials: { name: string; email: string; password: string; role: string; isNew: boolean }[] } {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return { ok: false, credentials: [] };

    const existingMap = new Map<string, TeamMember>();
    for (const m of ws.teamMembers) {
      existingMap.set(m.email.toLowerCase(), m);
    }

    const credentials: { name: string; email: string; password: string; role: string; isNew: boolean }[] = [];
    const newTeam: TeamMember[] = [];

    for (const m of members) {
      const existing = existingMap.get(m.email.toLowerCase());
      if (existing) {
        existing.name = m.name;
        if (m.role) existing.role = m.role;
        newTeam.push(existing);
        credentials.push({ name: m.name, email: m.email, password: existing.password, role: existing.role, isNew: false });
      } else {
        const password = genPassword();
        const role = m.role || "member";
        newTeam.push({ name: m.name, email: m.email, password, firstLogin: true, role });
        credentials.push({ name: m.name, email: m.email, password, role, isNew: true });
      }
    }

    ws.teamMembers = newTeam;
    save(data);
    return { ok: true, credentials };
  },

  loginClient(code: string, email: string, password: string): { ok: boolean; reason?: string; name?: string; firstLogin?: boolean } {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return { ok: false, reason: "not_found" };

    const client = ws.allowedClients.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (!client) return { ok: false, reason: "not_allowed" };
    if (client.password !== password) return { ok: false, reason: "wrong_password" };

    const existing = ws.members.find((m) => m.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
      ws.members.push({ name: client.name, email: client.email, joinedAt: new Date().toISOString() });
      save(data);
    }

    return { ok: true, name: client.name, firstLogin: client.firstLogin };
  },

  loginTeamMember(code: string, email: string, password: string): { ok: boolean; reason?: string; name?: string; role?: string; firstLogin?: boolean } {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return { ok: false, reason: "not_found" };

    const member = ws.teamMembers.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (!member) return { ok: false, reason: "not_allowed" };
    if (member.password !== password) return { ok: false, reason: "wrong_password" };

    const existing = ws.members.find((m) => m.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
      ws.members.push({ name: member.name, email: member.email, joinedAt: new Date().toISOString() });
      save(data);
    }

    return { ok: true, name: member.name, role: member.role, firstLogin: member.firstLogin };
  },

  changePassword(code: string, email: string, oldPassword: string, newPassword: string): { ok: boolean; reason?: string } {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return { ok: false, reason: "not_found" };

    const client = ws.allowedClients.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (client) {
      if (client.password !== oldPassword) return { ok: false, reason: "wrong_password" };
      client.password = newPassword;
      client.firstLogin = false;
      save(data);
      return { ok: true };
    }

    const member = ws.teamMembers.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (member) {
      if (member.password !== oldPassword) return { ok: false, reason: "wrong_password" };
      member.password = newPassword;
      member.firstLogin = false;
      save(data);
      return { ok: true };
    }

    return { ok: false, reason: "not_found" };
  },

  markFirstLoginDone(code: string, email: string): boolean {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return false;
    const client = ws.allowedClients.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (client) { client.firstLogin = false; save(data); return true; }
    const member = ws.teamMembers.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (member) { member.firstLogin = false; save(data); return true; }
    return false;
  },

  isClientAllowed(code: string, name: string, email: string): boolean {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return false;
    if (ws.allowedClients.length === 0) return true;
    return ws.allowedClients.some(
      (c) => c.email.toLowerCase() === email.toLowerCase()
    );
  },

  joinWorkspace(code: string, memberName: string, email?: string): Workspace | null {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return null;
    if (email && ws.allowedClients.length > 0) {
      const allowed = ws.allowedClients.some(
        (c) => c.email.toLowerCase() === email.toLowerCase()
      );
      if (!allowed) return "not_allowed" as any;
    }
    const existing = ws.members.find((m) => m.email === email || m.name === memberName);
    if (!existing) {
      ws.members.push({ name: memberName, email: email || "", joinedAt: new Date().toISOString() });
      save(data);
    }
    return ws;
  },

  addTask(code: string, task: Omit<SharedTask, "id" | "sentAt" | "claimed" | "status">): SharedTask | null {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return null;
    const t: SharedTask = {
      ...task,
      forEmail: task.forEmail || "",
      assignedTo: task.assignedTo || "",
      dueDate: task.dueDate || null,
      source: task.source || "client",
      id: genId(),
      sentAt: new Date().toISOString(),
      claimed: false,
      status: "pending",
    };
    ws.tasks.push(t);
    save(data);
    return t;
  },

  getAllTasks(code: string): SharedTask[] {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return [];
    return ws.tasks;
  },

  getTasksByEmail(code: string, email: string): SharedTask[] {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return [];
    const e = email.toLowerCase();
    return ws.tasks.filter((t) =>
      t.fromEmail.toLowerCase() === e || (t.forEmail && t.forEmail.toLowerCase() === e)
    );
  },

  getTeamTasks(code: string, email: string): SharedTask[] {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return [];
    const e = email.toLowerCase();
    return ws.tasks.filter((t) => t.assignedTo && t.assignedTo.toLowerCase() === e);
  },

  getPendingTasks(code: string): SharedTask[] {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return [];
    return ws.tasks.filter((t) => !t.claimed);
  },

  claimTask(code: string, taskId: string): boolean {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return false;
    const task = ws.tasks.find((t) => t.id === taskId);
    if (!task) return false;
    task.claimed = true;
    save(data);
    return true;
  },

  updateTaskStatus(code: string, taskId: string, status: "pending" | "in_progress" | "done"): boolean {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return false;
    const task = ws.tasks.find((t) => t.id === taskId);
    if (!task) return false;
    task.status = status;
    if (status === "done") task.claimed = true;
    save(data);
    return true;
  },

  startTimeEntry(code: string, taskId: string, memberEmail: string, memberName: string): TimeEntry | null {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return null;
    const running = ws.timeEntries.find((e) => e.memberEmail.toLowerCase() === memberEmail.toLowerCase() && !e.stoppedAt);
    if (running) return null;
    const entry: TimeEntry = {
      id: genId(),
      taskId,
      memberEmail,
      memberName,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      duration: null,
    };
    ws.timeEntries.push(entry);
    save(data);
    return entry;
  },

  stopTimeEntry(code: string, entryId: string): TimeEntry | null {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return null;
    const entry = ws.timeEntries.find((e) => e.id === entryId);
    if (!entry || entry.stoppedAt) return null;
    entry.stoppedAt = new Date().toISOString();
    entry.duration = Math.round((new Date(entry.stoppedAt).getTime() - new Date(entry.startedAt).getTime()) / 1000);
    save(data);
    return entry;
  },

  getTimeEntries(code: string, email?: string, taskId?: string): TimeEntry[] {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return [];
    let entries = ws.timeEntries;
    if (email) entries = entries.filter((e) => e.memberEmail.toLowerCase() === email.toLowerCase());
    if (taskId) entries = entries.filter((e) => e.taskId === taskId);
    return entries;
  },

  getRunningEntry(code: string, email: string): TimeEntry | null {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return null;
    return ws.timeEntries.find((e) => e.memberEmail.toLowerCase() === email.toLowerCase() && !e.stoppedAt) || null;
  },

  addTaskNote(code: string, taskId: string, authorName: string, authorEmail: string, text: string): TaskNote | null {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return null;
    const task = ws.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    const note: TaskNote = {
      id: genId(),
      taskId,
      authorName,
      authorEmail,
      text,
      createdAt: new Date().toISOString(),
    };
    ws.taskNotes.push(note);
    save(data);
    return note;
  },

  getTaskNotes(code: string, taskId: string): TaskNote[] {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return [];
    return ws.taskNotes.filter((n) => n.taskId === taskId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },
};
