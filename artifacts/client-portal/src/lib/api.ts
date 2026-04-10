const API_BASE = "https://hourlink-api.onrender.com/api";

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

export type WorkspaceInfo = {
  code: string;
  ownerName: string;
  createdAt: string;
  members: { name: string; email: string; joinedAt: string }[];
};

export type LoginResult =
  | { ok: true; name: string; email: string; firstLogin: boolean }
  | { ok: false; message: string };

export type TeamLoginResult =
  | {
      ok: true;
      name: string;
      email: string;
      role: string;
      firstLogin: boolean;
      userType: "team";
    }
  | { ok: false; message: string };

export type JoinWorkspaceResult = { ok: true } | { ok: false; message: string };

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function createWorkspace(
  ownerName: string,
): Promise<WorkspaceInfo | null> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerName }),
  });

  if (!res.ok) return null;
  return parseJsonSafe<WorkspaceInfo>(res);
}

export async function getWorkspace(
  code: string,
): Promise<WorkspaceInfo | null> {
  const res = await fetch(`${API_BASE}/workspaces/${code}`);
  if (!res.ok) return null;
  return parseJsonSafe<WorkspaceInfo>(res);
}

export async function joinWorkspace(
  code: string,
  name: string,
  email: string,
): Promise<JoinWorkspaceResult> {
  const res = await fetch(`${API_BASE}/workspaces/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberName: name, email }),
  });

  if (res.ok) {
    return { ok: true };
  }

  const body = await parseJsonSafe<{ message?: string }>(res);
  return {
    ok: false,
    message: body?.message || "Unable to verify your access.",
  };
}

export async function loginClient(
  code: string,
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/workspaces/${code}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (res.ok) {
    const data = await parseJsonSafe<{
      name: string;
      email: string;
      firstLogin: boolean;
    }>(res);

    if (!data) {
      return { ok: false, message: "Invalid server response." };
    }

    return {
      ok: true,
      name: data.name,
      email: data.email,
      firstLogin: data.firstLogin,
    };
  }

  const body = await parseJsonSafe<{ message?: string }>(res);
  return {
    ok: false,
    message: body?.message || "Login failed. Please try again.",
  };
}

export async function changePassword(
  code: string,
  email: string,
  oldPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/workspaces/${code}/change-password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, oldPassword, newPassword }),
  });

  if (res.ok) return { ok: true };

  const body = await parseJsonSafe<{ error?: string; message?: string }>(res);
  return {
    ok: false,
    message: body?.error || body?.message || "Could not change password.",
  };
}

export async function keepPassword(code: string, email: string): Promise<void> {
  await fetch(`${API_BASE}/workspaces/${code}/keep-password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}

export async function getTasks(
  code: string,
  email?: string,
): Promise<SharedTask[]> {
  const url = email
    ? `${API_BASE}/workspaces/${code}/tasks?email=${encodeURIComponent(email)}`
    : `${API_BASE}/workspaces/${code}/tasks`;

  const res = await fetch(url);
  if (!res.ok) return [];
  return (await parseJsonSafe<SharedTask[]>(res)) ?? [];
}

export async function addTask(
  code: string,
  task: {
    title: string;
    description: string;
    priority: string;
    fromUser: string;
    fromEmail: string;
    dueDate?: string | null;
  },
): Promise<SharedTask | null> {
  const res = await fetch(`${API_BASE}/workspaces/${code}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });

  if (!res.ok) return null;
  return parseJsonSafe<SharedTask>(res);
}

export async function loginTeamMember(
  code: string,
  email: string,
  password: string,
): Promise<TeamLoginResult> {
  const res = await fetch(`${API_BASE}/workspaces/${code}/team-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (res.ok) {
    const data = await parseJsonSafe<{
      name: string;
      email: string;
      role: string;
      firstLogin: boolean;
    }>(res);

    if (!data) {
      return { ok: false, message: "Invalid server response." };
    }

    return {
      ok: true,
      name: data.name,
      email: data.email,
      role: data.role,
      firstLogin: data.firstLogin,
      userType: "team",
    };
  }

  const body = await parseJsonSafe<{ message?: string }>(res);
  return {
    ok: false,
    message: body?.message || "Login failed. Please try again.",
  };
}

export async function getTeamTasks(
  code: string,
  email: string,
): Promise<SharedTask[]> {
  const res = await fetch(
    `${API_BASE}/workspaces/${code}/team-tasks?email=${encodeURIComponent(email)}`,
  );
  if (!res.ok) return [];
  return (await parseJsonSafe<SharedTask[]>(res)) ?? [];
}

export async function startTimeEntry(
  code: string,
  taskId: string,
  memberEmail: string,
  memberName: string,
): Promise<TimeEntry | null> {
  const res = await fetch(`${API_BASE}/workspaces/${code}/time-entries/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, memberEmail, memberName }),
  });

  if (!res.ok) return null;
  return parseJsonSafe<TimeEntry>(res);
}

export async function stopTimeEntry(
  code: string,
  entryId: string,
): Promise<TimeEntry | null> {
  const res = await fetch(
    `${API_BASE}/workspaces/${code}/time-entries/${entryId}/stop`,
    {
      method: "PATCH",
    },
  );

  if (!res.ok) return null;
  return parseJsonSafe<TimeEntry>(res);
}

export async function getTimeEntries(
  code: string,
  email?: string,
  taskId?: string,
): Promise<TimeEntry[]> {
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (taskId) params.set("taskId", taskId);

  const qs = params.toString();
  const res = await fetch(
    `${API_BASE}/workspaces/${code}/time-entries${qs ? `?${qs}` : ""}`,
  );

  if (!res.ok) return [];
  return (await parseJsonSafe<TimeEntry[]>(res)) ?? [];
}

export async function getRunningEntry(
  code: string,
  email: string,
): Promise<TimeEntry | null> {
  const res = await fetch(
    `${API_BASE}/workspaces/${code}/time-entries/running?email=${encodeURIComponent(email)}`,
  );
  if (!res.ok) return null;
  return parseJsonSafe<TimeEntry>(res);
}

export async function updateTaskStatus(
  code: string,
  taskId: string,
  status: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/workspaces/${code}/tasks/${taskId}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );

  return res.ok;
}

export async function addTaskNote(
  code: string,
  taskId: string,
  authorName: string,
  authorEmail: string,
  text: string,
): Promise<TaskNote | null> {
  const res = await fetch(
    `${API_BASE}/workspaces/${code}/tasks/${taskId}/notes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName, authorEmail, text }),
    },
  );

  if (!res.ok) return null;
  return parseJsonSafe<TaskNote>(res);
}

export async function getTaskNotes(
  code: string,
  taskId: string,
): Promise<TaskNote[]> {
  const res = await fetch(
    `${API_BASE}/workspaces/${code}/tasks/${taskId}/notes`,
  );
  if (!res.ok) return [];
  return (await parseJsonSafe<TaskNote[]>(res)) ?? [];
}

export async function getAllNotes(
  code: string,
  since?: string,
  email?: string,
): Promise<TaskNote[]> {
  const params = new URLSearchParams();
  if (since) params.set("since", since);
  if (email) params.set("email", email);

  const qs = params.toString();
  const res = await fetch(
    `${API_BASE}/workspaces/${code}/notes${qs ? `?${qs}` : ""}`,
  );

  if (!res.ok) return [];
  return (await parseJsonSafe<TaskNote[]>(res)) ?? [];
}
