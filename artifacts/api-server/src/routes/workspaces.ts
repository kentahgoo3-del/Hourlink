import { Router } from "express";
import { store } from "../lib/store";

const router = Router();

router.post("/workspaces", async (req, res) => {
  const { ownerName } = req.body;

  if (!ownerName || typeof ownerName !== "string" || !ownerName.trim()) {
    res.status(400).json({ error: "ownerName is required" });
    return;
  }

  try {
    const ws = await store.createWorkspace(ownerName.trim());

    res.status(201).json({
      code: ws.code,
      ownerName: ws.ownerName,
      createdAt: ws.createdAt,
      members: ws.members,
    });
  } catch (error) {
    console.error("createWorkspace error:", error);
    res.status(500).json({ error: "Failed to create workspace" });
  }
});

router.put("/workspaces/:code/clients", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { clients } = req.body;

  if (!code) {
    res.status(400).json({ error: "Workspace code is required" });
    return;
  }

  if (!Array.isArray(clients)) {
    res.status(400).json({ error: "clients must be an array" });
    return;
  }

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const validClients = clients
      .filter(
        (c: any) =>
          c &&
          typeof c.name === "string" &&
          typeof c.email === "string" &&
          c.email.includes("@"),
      )
      .map((c: any) => ({
        name: c.name.trim(),
        email: c.email.trim().toLowerCase(),
      }));

    const result = await store.setAllowedClients(code, validClients);

    if (!result?.ok) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    res.json({
      ok: true,
      count: validClients.length,
      credentials: result.credentials || [],
    });
  } catch (error) {
    console.error("setAllowedClients error:", error);
    res.status(500).json({ error: "Failed to save clients" });
  }
});

router.post("/workspaces/:code/login", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const result = await store.loginClient(
      code,
      String(email).trim().toLowerCase(),
      String(password),
    );

    if (!result.ok) {
      if (result.reason === "not_found") {
        res
          .status(404)
          .json({ error: "not_found", message: "Portal not found." });
      } else if (result.reason === "not_allowed") {
        res.status(403).json({
          error: "not_allowed",
          message: "This email is not registered. Contact your freelancer.",
        });
      } else {
        res.status(401).json({
          error: "wrong_password",
          message: "Incorrect password. Please try again.",
        });
      }
      return;
    }

    res.json({
      ok: true,
      name: result.name,
      email: String(email).trim().toLowerCase(),
      firstLogin: result.firstLogin,
    });
  } catch (error) {
    console.error("loginClient error:", error);
    res.status(500).json({ error: "Failed to login client" });
  }
});

router.patch("/workspaces/:code/change-password", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { email, oldPassword, newPassword } = req.body;

  if (!email || !oldPassword || !newPassword) {
    res
      .status(400)
      .json({ error: "email, oldPassword, and newPassword are required" });
    return;
  }

  if (String(newPassword).length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters." });
    return;
  }

  try {
    const result = await store.changePassword(
      code,
      String(email).trim().toLowerCase(),
      String(oldPassword),
      String(newPassword),
    );

    if (!result.ok) {
      res
        .status(result.reason === "wrong_password" ? 401 : 404)
        .json({ error: result.reason });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("changePassword error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

router.patch("/workspaces/:code/keep-password", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  try {
    const ok = await store.markFirstLoginDone(
      code,
      String(email).trim().toLowerCase(),
    );

    if (!ok) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("markFirstLoginDone error:", error);
    res.status(500).json({ error: "Failed to keep password" });
  }
});

router.post("/workspaces/:code/join", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { memberName, email } = req.body;

  if (!memberName || typeof memberName !== "string" || !memberName.trim()) {
    res.status(400).json({ error: "memberName is required" });
    return;
  }

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const validEmail =
      email && typeof email === "string" && email.includes("@")
        ? email.trim().toLowerCase()
        : "";

    const result = await store.joinWorkspace(
      code,
      memberName.trim(),
      validEmail,
    );

    if (result === ("not_allowed" as any)) {
      res.status(403).json({
        error: "not_allowed",
        message: "Your email is not recognised.",
      });
      return;
    }

    if (!result) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    res.json({
      code: result.code,
      ownerName: result.ownerName,
      createdAt: result.createdAt,
      members: result.members,
    });
  } catch (error) {
    console.error("joinWorkspace error:", error);
    res.status(500).json({ error: "Failed to join workspace" });
  }
});

router.get("/workspaces/:code", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    res.json({
      code: ws.code,
      ownerName: ws.ownerName,
      createdAt: ws.createdAt,
      members: ws.members,
    });
  } catch (error) {
    console.error("getWorkspace error:", error);
    res.status(500).json({ error: "Failed to get workspace" });
  }
});

router.post("/workspaces/:code/tasks", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const {
    title,
    description,
    priority,
    fromUser,
    fromEmail,
    forEmail,
    assignedTo,
    dueDate,
    source,
  } = req.body;

  if (!title || !fromUser) {
    res.status(400).json({ error: "title and fromUser are required" });
    return;
  }

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const validSources = ["client", "freelancer", "team"];

    const task = await store.addTask(code, {
      title: String(title),
      description: String(description || ""),
      priority: (["low", "medium", "high"].includes(priority)
        ? priority
        : "medium") as "low" | "medium" | "high",
      fromUser: String(fromUser),
      fromEmail: String(fromEmail || "")
        .trim()
        .toLowerCase(),
      forEmail: String(forEmail || "")
        .trim()
        .toLowerCase(),
      assignedTo: String(assignedTo || "")
        .trim()
        .toLowerCase(),
      dueDate: dueDate ? String(dueDate) : null,
      source: validSources.includes(source) ? source : "client",
    });

    if (!task) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    res.status(201).json(task);
  } catch (error) {
    console.error("addTask error:", error);
    res.status(500).json({ error: "Failed to add task" });
  }
});

router.get("/workspaces/:code/tasks", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const email = req.query.email as string | undefined;

    if (email) {
      res.json(
        await store.getTasksByEmail(code, String(email).trim().toLowerCase()),
      );
    } else {
      res.json(await store.getAllTasks(code));
    }
  } catch (error) {
    console.error("getTasks error:", error);
    res.status(500).json({ error: "Failed to get tasks" });
  }
});

router.get("/workspaces/:code/tasks/pending", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    res.json(await store.getPendingTasks(code));
  } catch (error) {
    console.error("getPendingTasks error:", error);
    res.status(500).json({ error: "Failed to get pending tasks" });
  }
});

router.patch("/workspaces/:code/tasks/:taskId/claim", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { taskId } = req.params;

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const ok = await store.claimTask(code, taskId);

    if (!ok) {
      res.status(404).json({ error: "Task or workspace not found" });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("claimTask error:", error);
    res.status(500).json({ error: "Failed to claim task" });
  }
});

router.patch("/workspaces/:code/tasks/:taskId/status", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { taskId } = req.params;
  const { status } = req.body;

  if (!["pending", "in_progress", "done"].includes(status)) {
    res
      .status(400)
      .json({ error: "status must be pending, in_progress, or done" });
    return;
  }

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const ok = await store.updateTaskStatus(code, taskId, status);

    if (!ok) {
      res.status(404).json({ error: "Task or workspace not found" });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("updateTaskStatus error:", error);
    res.status(500).json({ error: "Failed to update task status" });
  }
});

router.put("/workspaces/:code/team-members", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { members } = req.body;

  if (!Array.isArray(members)) {
    res.status(400).json({ error: "members must be an array" });
    return;
  }

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const validMembers = members
      .filter(
        (m: any) =>
          m &&
          typeof m.name === "string" &&
          typeof m.email === "string" &&
          m.email.includes("@"),
      )
      .map((m: any) => ({
        name: m.name.trim(),
        email: m.email.trim().toLowerCase(),
        role: m.role || "member",
      }));

    const result = await store.setTeamMembers(code, validMembers);

    if (!result?.ok) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    res.json({
      ok: true,
      count: validMembers.length,
      credentials: result.credentials || [],
    });
  } catch (error) {
    console.error("setTeamMembers error:", error);
    res.status(500).json({ error: "Failed to save team members" });
  }
});

router.post("/workspaces/:code/team-login", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const result = await store.loginTeamMember(
      code,
      String(email).trim().toLowerCase(),
      String(password),
    );

    if (!result.ok) {
      if (result.reason === "not_found") {
        res
          .status(404)
          .json({ error: "not_found", message: "Portal not found." });
      } else if (result.reason === "not_allowed") {
        res.status(403).json({
          error: "not_allowed",
          message: "This email is not registered as a team member.",
        });
      } else {
        res.status(401).json({
          error: "wrong_password",
          message: "Incorrect password. Please try again.",
        });
      }
      return;
    }

    res.json({
      ok: true,
      name: result.name,
      email: String(email).trim().toLowerCase(),
      role: result.role,
      firstLogin: result.firstLogin,
      userType: "team",
    });
  } catch (error) {
    console.error("loginTeamMember error:", error);
    res.status(500).json({ error: "Failed to login team member" });
  }
});

router.get("/workspaces/:code/team-tasks", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const email = req.query.email as string;

  if (!email) {
    res.status(400).json({ error: "email query param required" });
    return;
  }

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const tasks = await store.getTeamTasks(
      code,
      String(email).trim().toLowerCase(),
    );
    res.json(tasks);
  } catch (error) {
    console.error("getTeamTasks error:", error);
    res.status(500).json({ error: "Failed to get team tasks" });
  }
});

router.post("/workspaces/:code/time-entries/start", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { taskId, memberEmail, memberName } = req.body;

  if (!taskId || !memberEmail || !memberName) {
    res
      .status(400)
      .json({ error: "taskId, memberEmail, and memberName are required" });
    return;
  }

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const entry = await store.startTimeEntry(
      code,
      taskId,
      String(memberEmail).trim().toLowerCase(),
      String(memberName),
    );

    if (!entry) {
      res
        .status(400)
        .json({ error: "Timer already running or workspace not found" });
      return;
    }

    res.status(201).json(entry);
  } catch (error) {
    console.error("startTimeEntry error:", error);
    res.status(500).json({ error: "Failed to start time entry" });
  }
});

router.patch(
  "/workspaces/:code/time-entries/:entryId/stop",
  async (req, res) => {
    const code = String(req.params.code || "")
      .trim()
      .toUpperCase();
    const { entryId } = req.params;

    try {
      const ws = await store.getWorkspace(code);

      if (!ws) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const entry = await store.stopTimeEntry(code, entryId);

      if (!entry) {
        res.status(404).json({ error: "Entry not found or already stopped" });
        return;
      }

      res.json(entry);
    } catch (error) {
      console.error("stopTimeEntry error:", error);
      res.status(500).json({ error: "Failed to stop time entry" });
    }
  },
);

router.get("/workspaces/:code/time-entries", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const email = req.query.email as string | undefined;
  const taskId = req.query.taskId as string | undefined;

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const entries = await store.getTimeEntries(
      code,
      email ? String(email).trim().toLowerCase() : undefined,
      taskId,
    );

    res.json(entries);
  } catch (error) {
    console.error("getTimeEntries error:", error);
    res.status(500).json({ error: "Failed to get time entries" });
  }
});

router.get("/workspaces/:code/time-entries/running", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const email = req.query.email as string;

  if (!email) {
    res.status(400).json({ error: "email query param required" });
    return;
  }

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const entry = await store.getRunningEntry(
      code,
      String(email).trim().toLowerCase(),
    );

    res.json(entry);
  } catch (error) {
    console.error("getRunningEntry error:", error);
    res.status(500).json({ error: "Failed to get running time entry" });
  }
});

router.post("/workspaces/:code/tasks/:taskId/notes", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { taskId } = req.params;
  const { authorName, authorEmail, text } = req.body;

  if (!text || !authorName) {
    res.status(400).json({ error: "text and authorName are required" });
    return;
  }

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const note = await store.addTaskNote(
      code,
      taskId,
      String(authorName),
      String(authorEmail || "")
        .trim()
        .toLowerCase(),
      String(text),
    );

    if (!note) {
      res.status(404).json({ error: "Task or workspace not found" });
      return;
    }

    res.status(201).json(note);
  } catch (error) {
    console.error("addTaskNote error:", error);
    res.status(500).json({ error: "Failed to add task note" });
  }
});

router.get("/workspaces/:code/tasks/:taskId/notes", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const { taskId } = req.params;

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const notes = await store.getTaskNotes(code, taskId);
    res.json(notes);
  } catch (error) {
    console.error("getTaskNotes error:", error);
    res.status(500).json({ error: "Failed to get task notes" });
  }
});

router.get("/workspaces/:code/notes", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const since = req.query.since as string | undefined;
  const email = req.query.email as string | undefined;

  try {
    const ws = await store.getWorkspace(code);

    if (!ws) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    let notes = await store.getAllTaskNotes(code, since);

    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const tasks = await store.getAllTasks(code);

      const visibleTaskIds = new Set(
        tasks
          .filter(
            (t) =>
              String(t.forEmail || "")
                .trim()
                .toLowerCase() === normalizedEmail ||
              String(t.fromEmail || "")
                .trim()
                .toLowerCase() === normalizedEmail ||
              String(t.assignedTo || "")
                .trim()
                .toLowerCase() === normalizedEmail,
          )
          .map((t) => t.id),
      );

      notes = notes.filter((n) => visibleTaskIds.has(n.taskId));
    }

    res.json(notes);
  } catch (error) {
    console.error("getAllTaskNotes error:", error);
    res.status(500).json({ error: "Failed to get notes" });
  }
});

export default router;
