import { Router } from "express";
import { store } from "../lib/store";

const router = Router();

// Create a new workspace
router.post("/workspaces", (req, res) => {
  const { ownerName } = req.body;
  if (!ownerName || typeof ownerName !== "string" || !ownerName.trim()) {
    res.status(400).json({ error: "ownerName is required" });
    return;
  }
  const ws = store.createWorkspace(ownerName.trim());
  res.status(201).json({ code: ws.code, ownerName: ws.ownerName, createdAt: ws.createdAt, members: ws.members });
});

// Get workspace info (join)
router.post("/workspaces/:code/join", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { memberName } = req.body;
  if (!memberName || typeof memberName !== "string" || !memberName.trim()) {
    res.status(400).json({ error: "memberName is required" });
    return;
  }
  const ws = store.joinWorkspace(code, memberName.trim());
  if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.json({ code: ws.code, ownerName: ws.ownerName, createdAt: ws.createdAt, members: ws.members });
});

// Get workspace info (read-only, for verifying code)
router.get("/workspaces/:code", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const ws = store.getWorkspace(code);
  if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.json({ code: ws.code, ownerName: ws.ownerName, createdAt: ws.createdAt, members: ws.members });
});

// Push a task to the workspace owner's to-do list
router.post("/workspaces/:code/tasks", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { title, description, priority, fromUser } = req.body;
  if (!title || !fromUser) { res.status(400).json({ error: "title and fromUser are required" }); return; }
  const task = store.addTask(code, {
    title: String(title),
    description: String(description || ""),
    priority: (["low","medium","high"].includes(priority) ? priority : "medium") as "low" | "medium" | "high",
    fromUser: String(fromUser),
  });
  if (!task) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.status(201).json(task);
});

// Get pending (unclaimed) tasks for the workspace
router.get("/workspaces/:code/tasks/pending", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const ws = store.getWorkspace(code);
  if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.json(store.getPendingTasks(code));
});

// Claim (acknowledge) a task — removes it from pending
router.patch("/workspaces/:code/tasks/:taskId/claim", (req, res) => {
  const code = req.params.code?.toUpperCase();
  const { taskId } = req.params;
  const ok = store.claimTask(code, taskId);
  if (!ok) { res.status(404).json({ error: "Task or workspace not found" }); return; }
  res.json({ ok: true });
});

export default router;
