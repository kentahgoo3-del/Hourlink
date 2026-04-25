const BASE = "https://hourlink-api.onrender.com/api";

export type TaskNote = {
  id: string;
  taskId: string;
  authorName: string;
  authorEmail: string;
  text: string;
  createdAt: string;
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
  clientRef?: string;
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

export type TeamMemberCredential = {
  name: string;
  email: string;
  password: string;
  role: string;
  isNew: boolean;
};

export type WorkspaceInfo = {
  code: string;
  ownerName: string;
  createdAt: string;
  members: { name: string; email: string; joinedAt: string }[];
  teamMembers?: TeamMemberCredential[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as any).message ||
        (body as any).error ||
        `Request failed: ${res.status}`,
    );
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

  async joinWorkspace(
    code: string,
    memberName: string,
    email?: string,
  ): Promise<WorkspaceInfo> {
    return request<WorkspaceInfo>(`/workspaces/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ memberName, email: email || "" }),
    });
  },

  async getWorkspace(code: string): Promise<WorkspaceInfo> {
    return request<WorkspaceInfo>(`/workspaces/${code}`);
  },

  async pushTask(
    code: string,
    task: {
      title: string;
      description: string;
      priority: string;
      fromUser: string;
      assignedTo?: string;
      clientRef?: string;
    },
  ): Promise<SharedTask> {
    return request<SharedTask>(`/workspaces/${code}/tasks`, {
      method: "POST",
      body: JSON.stringify({ ...task, source: "team" }),
    });
  },

  async getPendingTasks(code: string): Promise<SharedTask[]> {
    return request<SharedTask[]>(`/workspaces/${code}/tasks/pending`);
  },

  async claimTask(code: string, taskId: string): Promise<void> {
    await request(`/workspaces/${code}/tasks/${taskId}/claim`, {
      method: "PATCH",
    });
  },

  async setTeamMembers(
    code: string,
    members: { name: string; email: string; role?: string }[],
  ): Promise<{ ok: boolean; credentials: TeamMemberCredential[] }> {
    return request(`/workspaces/${code}/team-members`, {
      method: "PUT",
      body: JSON.stringify({ members }),
    });
  },

  async getTeamTasks(code: string, email: string): Promise<SharedTask[]> {
    return request<SharedTask[]>(
      `/workspaces/${code}/team-tasks?email=${encodeURIComponent(email)}`,
    );
  },

  async getTimeEntries(code: string, email?: string): Promise<TimeEntry[]> {
    const params = email ? `?email=${encodeURIComponent(email)}` : "";
    return request<TimeEntry[]>(`/workspaces/${code}/time-entries${params}`);
  },

  async getAllTasks(code: string): Promise<SharedTask[]> {
    return request<SharedTask[]>(`/workspaces/${code}/tasks`);
  },

  async getTaskNotes(code: string, taskId: string): Promise<TaskNote[]> {
    return request<TaskNote[]>(`/workspaces/${code}/tasks/${taskId}/notes`);
  },

  async addTaskNote(
    code: string,
    taskId: string,
    authorName: string,
    authorEmail: string,
    text: string,
  ): Promise<TaskNote> {
    return request<TaskNote>(`/workspaces/${code}/tasks/${taskId}/notes`, {
      method: "POST",
      body: JSON.stringify({ authorName, authorEmail, text }),
    });
  },
};
