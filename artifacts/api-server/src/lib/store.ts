import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export type SharedTask = {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  fromUser: string;
  sentAt: string;
  claimed: boolean;
};

export type WorkspaceMember = {
  name: string;
  joinedAt: string;
};

export type Workspace = {
  code: string;
  ownerName: string;
  createdAt: string;
  members: WorkspaceMember[];
  tasks: SharedTask[];
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
    const ws: Workspace = { code, ownerName, createdAt: new Date().toISOString(), members: [], tasks: [] };
    data[code] = ws;
    save(data);
    return ws;
  },

  getWorkspace(code: string): Workspace | null {
    const data = load();
    return data[code.toUpperCase()] ?? null;
  },

  joinWorkspace(code: string, memberName: string): Workspace | null {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return null;
    if (!ws.members.find((m) => m.name === memberName)) {
      ws.members.push({ name: memberName, joinedAt: new Date().toISOString() });
      save(data);
    }
    return ws;
  },

  addTask(code: string, task: Omit<SharedTask, "id" | "sentAt" | "claimed">): SharedTask | null {
    const data = load();
    const ws = data[code.toUpperCase()];
    if (!ws) return null;
    const t: SharedTask = { ...task, id: genId(), sentAt: new Date().toISOString(), claimed: false };
    ws.tasks.push(t);
    save(data);
    return t;
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
};
