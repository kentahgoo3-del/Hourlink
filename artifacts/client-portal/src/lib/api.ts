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

export async function getWorkspace(code: string): Promise<WorkspaceInfo | null> {
  const res = await fetch(`${API_BASE}/workspaces/${code}`);
  if (!res.ok) return null;
  return res.json();
}

export type JoinResult =
  | { ok: true; workspace: WorkspaceInfo }
  | { ok: false; reason: "not_allowed" | "not_found" | "error"; message: string };

export async function joinWorkspace(code: string, name: string, email: string): Promise<JoinResult> {
  const res = await fetch(`${API_BASE}/workspaces/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberName: name, email }),
  });
  if (res.ok) {
    const ws = await res.json();
    return { ok: true, workspace: ws };
  }
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, reason: "not_allowed", message: body.message || "Your email is not recognised. Please check with the freelancer." };
  }
  if (res.status === 404) {
    return { ok: false, reason: "not_found", message: "This portal no longer exists." };
  }
  return { ok: false, reason: "error", message: "Could not connect. Please try again." };
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
