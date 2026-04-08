const API_BASE = `${window.location.origin}/api`;

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

export type WorkspaceInfo = {
  code: string;
  ownerName: string;
  createdAt: string;
  members: { name: string; email: string; joinedAt: string }[];
};

export type LoginResult =
  | { ok: true; name: string; email: string; firstLogin: boolean }
  | { ok: false; message: string };

export async function getWorkspace(code: string): Promise<WorkspaceInfo | null> {
  const res = await fetch(`${API_BASE}/workspaces/${code}`);
  if (!res.ok) return null;
  return res.json();
}

export async function loginClient(code: string, email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/workspaces/${code}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.ok) {
    const data = await res.json();
    return { ok: true, name: data.name, email: data.email, firstLogin: data.firstLogin };
  }
  const body = await res.json().catch(() => ({}));
  return { ok: false, message: body.message || "Login failed. Please try again." };
}

export async function changePassword(code: string, email: string, oldPassword: string, newPassword: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/workspaces/${code}/change-password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, oldPassword, newPassword }),
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, message: body.error || "Could not change password." };
}

export async function keepPassword(code: string, email: string): Promise<void> {
  await fetch(`${API_BASE}/workspaces/${code}/keep-password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}

export async function getTasks(code: string, email?: string): Promise<SharedTask[]> {
  const url = email
    ? `${API_BASE}/workspaces/${code}/tasks?email=${encodeURIComponent(email)}`
    : `${API_BASE}/workspaces/${code}/tasks`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function addTask(
  code: string,
  task: { title: string; description: string; priority: string; fromUser: string; fromEmail: string },
): Promise<SharedTask | null> {
  const res = await fetch(`${API_BASE}/workspaces/${code}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok) return null;
  return res.json();
}
