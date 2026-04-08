import { useState, useEffect, useCallback } from "react";
import { getTasks, addTask, type SharedTask, type WorkspaceInfo } from "../lib/api";

interface Props {
  workspace: WorkspaceInfo;
  portalCode: string;
  user: { name: string; email: string };
  onLogout: () => void;
}

const PRIORITY_COLORS = {
  low: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  high: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-muted-foreground" },
  in_progress: { label: "In Progress", color: "text-blue-600" },
  done: { label: "Done", color: "text-emerald-600" },
};

export function TaskBoard({ workspace, portalCode, user, onLogout }: Props) {
  const [tasks, setTasks] = useState<SharedTask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "done">("all");

  const loadTasks = useCallback(async () => {
    const t = await getTasks(portalCode, user.email);
    setTasks(t.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()));
  }, [portalCode, user.email]);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 10000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const task = await addTask(portalCode, {
      title: title.trim(),
      description: description.trim(),
      priority,
      fromUser: user.name,
      fromEmail: user.email,
    });
    setSubmitting(false);
    if (task) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setShowForm(false);
      loadTasks();
    }
  };

  const filteredTasks = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}hourlink_icon.png`} alt="HourLink" className="w-8 h-8 rounded-lg" />
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">Task Portal</h1>
              <p className="text-xs text-muted-foreground">{workspace.ownerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <button
              onClick={onLogout}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Switch user"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Your Tasks</h2>
            <p className="text-sm text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""} submitted</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="h-9 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Task
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Task Title</label>
              <input
                type="text"
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Description (optional)</label>
              <textarea
                placeholder="Add more details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Priority</label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium capitalize transition-all ${
                      priority === p
                        ? `${PRIORITY_COLORS[p].bg} ${PRIORITY_COLORS[p].text} ring-2 ring-offset-1 ring-current`
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 h-10 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="flex-1 h-10 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Task"}
              </button>
            </div>
          </form>
        )}

        <div className="flex gap-1 mb-4 bg-secondary rounded-lg p-1">
          {(["all", "pending", "in_progress", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 h-8 rounded-md text-xs font-medium capitalize transition-all ${
                filter === f
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "in_progress" ? "In Progress" : f} ({counts[f]})
            </button>
          ))}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">
              {filter === "all"
                ? "No tasks yet. Click \"New Task\" to submit your first one."
                : `No ${filter === "in_progress" ? "in progress" : filter} tasks.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => {
              const pColor = PRIORITY_COLORS[task.priority];
              const sLabel = STATUS_LABELS[task.status] || STATUS_LABELS.pending;
              return (
                <div
                  key={task.id}
                  className={`bg-card border border-border rounded-xl p-4 transition-all ${
                    task.status === "done" ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-medium text-foreground ${
                        task.status === "done" ? "line-through" : ""
                      }`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pColor.bg} ${pColor.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${pColor.dot}`} />
                        {task.priority}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className={`text-xs font-medium ${sLabel.color}`}>
                      {sLabel.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(task.sentAt).toLocaleDateString("en-ZA", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <footer className="mt-12 pb-8 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-medium">HourLink</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
