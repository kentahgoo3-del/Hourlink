import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export type SharedTask = {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  fromUser: string;
  fromEmail: string;
  sentAt: string;
  claimed: boolean;
  status: "pending" | "in_progress" | "done";
};

export type AllowedClient = {
  name: string;
  email: string;
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
};

const DATA_PATH = join("/tmp", "workpilot_workspaces.json");

function load(): Record<string, Workspace> {
  if (!existsSync(DATA_PATH)) return {};
  try { return JSON.parse(readFileSync(DATA_PATH, "utf8")); }
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

export const store = {
  createWorkspace(ownerName: string): Workspace {
    const data = load();
    let code = genCode();
    while (data[code]) code = genCode();
    const ws: Workspace = { code, ownerName, createdAt: new Date().toISOString(), members: [], tasks: [], allowedClients: [] };
    data[code] = ws;
    save(data);
    return ws;
  },

  getWorkspace(code: string): Workspace | null {
    const data = load();
    return data[code.toUpperCase()] ?? null;
  },

  setAllowedClients(code: string, clients: AllowedClient[]): boolean {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return false;
    ws.allowedClients = clients;
    save(data);
    return true;
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
    const t: SharedTask = { ...task, id: genId(), sentAt: new Date().toISOString(), claimed: false, status: "pending" };
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
    return ws.tasks.filter((t) => t.fromEmail.toLowerCase() === email.toLowerCase());
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
};
