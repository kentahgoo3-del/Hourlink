import { Router } from "express";
import { store } from "../lib/store";

const router = Router();

router.post("/workspaces", (req, res) => {
  const { ownerName } = req.body;
  if (!ownerName || typeof ownerName !== "string" || !ownerName.trim()) {
    res.status(400).json({ error: "ownerName is required" });
    return;
  }
  const ws = store.createWorkspace(ownerName.trim());
  res.status(201).json({ code: ws.code, ownerName: ws.ownerName, createdAt: ws.createdAt, members: ws.members });
});

router.put("/workspaces/:code/clients", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { clients } = req.body;
  if (!Array.isArray(clients)) {
    res.status(400).json({ error: "clients must be an array" });
    return;
  }
  const valid = clients.filter(
    (c: any) => c && typeof c.name === "string" && typeof c.email === "string" && c.email.includes("@")
  );
  const result = store.setAllowedClients(code, valid.map((c: any) => ({ name: c.name.trim(), email: c.email.trim() })));
  if (!result.ok) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.json({ ok: true, count: valid.length, credentials: result.credentials });
});

router.post("/workspaces/:code/login", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const result = store.loginClient(code, String(email).trim(), String(password));
  if (!result.ok) {
    if (result.reason === "not_found") {
      res.status(404).json({ error: "not_found", message: "Portal not found." });
    } else if (result.reason === "not_allowed") {
      res.status(403).json({ error: "not_allowed", message: "This email is not registered. Contact your freelancer." });
    } else {
      res.status(401).json({ error: "wrong_password", message: "Incorrect password. Please try again." });
    }
    return;
  }
  res.json({ ok: true, name: result.name, email: String(email).trim(), firstLogin: result.firstLogin });
});

router.patch("/workspaces/:code/change-password", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword) {
    res.status(400).json({ error: "email, oldPassword, and newPassword are required" });
    return;
  }
  if (String(newPassword).length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters." });
    return;
  }
  const result = store.changePassword(code, String(email).trim(), String(oldPassword), String(newPassword));
  if (!result.ok) {
    res.status(result.reason === "wrong_password" ? 401 : 404).json({ error: result.reason });
    return;
  }
  res.json({ ok: true });
});

router.patch("/workspaces/:code/keep-password", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "email is required" }); return; }
  const ok = store.markFirstLoginDone(code, String(email).trim());
  if (!ok) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true });
});

router.post("/workspaces/:code/join", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { memberName, email } = req.body;
  if (!memberName || typeof memberName !== "string" || !memberName.trim()) {
    res.status(400).json({ error: "memberName is required" });
    return;
  }
  const validEmail = email && typeof email === "string" && email.includes("@") ? email.trim() : "";
  const result = store.joinWorkspace(code, memberName.trim(), validEmail);
  if (result === "not_allowed" as any) {
    res.status(403).json({ error: "not_allowed", message: "Your email is not recognised." });
    return;
  }
  if (!result) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.json({ code: result.code, ownerName: result.ownerName, createdAt: result.createdAt, members: result.members });
});

router.get("/workspaces/:code", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const ws = store.getWorkspace(code);
  if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.json({ code: ws.code, ownerName: ws.ownerName, createdAt: ws.createdAt, members: ws.members });
});

router.post("/workspaces/:code/tasks", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { title, description, priority, fromUser, fromEmail, forEmail, assignedTo, dueDate, source } = req.body;
  if (!title || !fromUser) { res.status(400).json({ error: "title and fromUser are required" }); return; }
  const validSources = ["client", "freelancer", "team"];
  const task = store.addTask(code, {
    title: String(title),
    description: String(description || ""),
    priority: (["low","medium","high"].includes(priority) ? priority : "medium") as "low" | "medium" | "high",
    fromUser: String(fromUser),
    fromEmail: String(fromEmail || ""),
    forEmail: String(forEmail || ""),
    assignedTo: String(assignedTo || ""),
    dueDate: dueDate ? String(dueDate) : null,
    source: validSources.includes(source) ? source : "client",
  });
  if (!task) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.status(201).json(task);
});

router.get("/workspaces/:code/tasks", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const ws = store.getWorkspace(code);
  if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }
  const email = req.query.email as string | undefined;
  if (email) {
    res.json(store.getTasksByEmail(code, email));
  } else {
    res.json(store.getAllTasks(code));
  }
});

router.get("/workspaces/:code/tasks/pending", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const ws = store.getWorkspace(code);
  if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.json(store.getPendingTasks(code));
});

router.patch("/workspaces/:code/tasks/:taskId/claim", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { taskId } = req.params;
  const ok = store.claimTask(code, taskId);
  if (!ok) { res.status(404).json({ error: "Task or workspace not found" }); return; }
  res.json({ ok: true });
});

router.patch("/workspaces/:code/tasks/:taskId/status", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { taskId } = req.params;
  const { status } = req.body;
  if (!["pending", "in_progress", "done"].includes(status)) {
    res.status(400).json({ error: "status must be pending, in_progress, or done" });
    return;
  }
  const ok = store.updateTaskStatus(code, taskId, status);
  if (!ok) { res.status(404).json({ error: "Task or workspace not found" }); return; }
  res.json({ ok: true });
});

router.put("/workspaces/:code/team-members", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { members } = req.body;
  if (!Array.isArray(members)) {
    res.status(400).json({ error: "members must be an array" });
    return;
  }
  const valid = members.filter(
    (m: any) => m && typeof m.name === "string" && typeof m.email === "string" && m.email.includes("@")
  );
  const result = store.setTeamMembers(code, valid.map((m: any) => ({ name: m.name.trim(), email: m.email.trim(), role: m.role || "member" })));
  if (!result.ok) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.json({ ok: true, count: valid.length, credentials: result.credentials });
});

router.post("/workspaces/:code/team-login", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const result = store.loginTeamMember(code, String(email).trim(), String(password));
  if (!result.ok) {
    if (result.reason === "not_found") {
      res.status(404).json({ error: "not_found", message: "Portal not found." });
    } else if (result.reason === "not_allowed") {
      res.status(403).json({ error: "not_allowed", message: "This email is not registered as a team member." });
    } else {
      res.status(401).json({ error: "wrong_password", message: "Incorrect password. Please try again." });
    }
    return;
  }
  res.json({ ok: true, name: result.name, email: String(email).trim(), role: result.role, firstLogin: result.firstLogin, userType: "team" });
});

router.get("/workspaces/:code/team-tasks", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const email = req.query.email as string;
  if (!email) { res.status(400).json({ error: "email query param required" }); return; }
  const tasks = store.getTeamTasks(code, email);
  res.json(tasks);
});

router.post("/workspaces/:code/time-entries/start", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { taskId, memberEmail, memberName } = req.body;
  if (!taskId || !memberEmail || !memberName) {
    res.status(400).json({ error: "taskId, memberEmail, and memberName are required" });
    return;
  }
  const entry = store.startTimeEntry(code, taskId, String(memberEmail), String(memberName));
  if (!entry) { res.status(400).json({ error: "Timer already running or workspace not found" }); return; }
  res.status(201).json(entry);
});

router.patch("/workspaces/:code/time-entries/:entryId/stop", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { entryId } = req.params;
  const entry = store.stopTimeEntry(code, entryId);
  if (!entry) { res.status(404).json({ error: "Entry not found or already stopped" }); return; }
  res.json(entry);
});

router.get("/workspaces/:code/time-entries", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const email = req.query.email as string | undefined;
  const taskId = req.query.taskId as string | undefined;
  const entries = store.getTimeEntries(code, email, taskId);
  res.json(entries);
});

router.get("/workspaces/:code/time-entries/running", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const email = req.query.email as string;
  if (!email) { res.status(400).json({ error: "email query param required" }); return; }
  const entry = store.getRunningEntry(code, email);
  res.json(entry);
});

router.post("/workspaces/:code/tasks/:taskId/notes", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { taskId } = req.params;
  const { authorName, authorEmail, text } = req.body;
  if (!text || !authorName) { res.status(400).json({ error: "text and authorName are required" }); return; }
  const note = store.addTaskNote(code, taskId, String(authorName), String(authorEmail || ""), String(text));
  if (!note) { res.status(404).json({ error: "Task or workspace not found" }); return; }
  res.status(201).json(note);
});

router.get("/workspaces/:code/tasks/:taskId/notes", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { taskId } = req.params;
  const notes = store.getTaskNotes(code, taskId);
  res.json(notes);
});

router.get("/workspaces/:code/notes", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const since = req.query.since as string | undefined;
  const email = req.query.email as string | undefined;
  let notes = store.getAllTaskNotes(code, since);
  if (email) {
    const tasks = store.getAllTasks(code);
    const visibleTaskIds = new Set(
      tasks
        .filter((t) => t.forEmail === email || t.fromEmail === email || t.assignedTo === email)
        .map((t) => t.id)
    );
    notes = notes.filter((n) => visibleTaskIds.has(n.taskId));
  }
  res.json(notes);
});

export default router;
