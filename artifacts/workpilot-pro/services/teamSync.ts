const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export type SharedTask = {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  fromUser: string;
  sentAt: string;
  claimed: boolean;
};

export type WorkspaceInfo = {
  code: string;
  ownerName: string;
  createdAt: string;
  members: { name: string; joinedAt: string }[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const teamSync = {
  async createWorkspace(ownerName: string): Promise<WorkspaceInfo> {
    return request<WorkspaceInfo>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ ownerName }),
    });
  },

  async joinWorkspace(code: string, memberName: string): Promise<WorkspaceInfo> {
    return request<WorkspaceInfo>(`/workspaces/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ memberName }),
    });
  },

  async getWorkspace(code: string): Promise<WorkspaceInfo> {
    return request<WorkspaceInfo>(`/workspaces/${code}`);
  },

  async pushTask(code: string, task: { title: string; description: string; priority: string; fromUser: string }): Promise<SharedTask> {
    return request<SharedTask>(`/workspaces/${code}/tasks`, {
      method: "POST",
      body: JSON.stringify(task),
    });
  },

  async getPendingTasks(code: string): Promise<SharedTask[]> {
    return request<SharedTask[]>(`/workspaces/${code}/tasks/pending`);
  },

  async claimTask(code: string, taskId: string): Promise<void> {
    await request(`/workspaces/${code}/tasks/${taskId}/claim`, { method: "PATCH" });
  },
};
