import { useState, useEffect, useCallback, useRef } from "react";
import {
  getTeamTasks,
  getTimeEntries,
  getRunningEntry,
  startTimeEntry,
  stopTimeEntry,
  updateTaskStatus,
  addTaskNote,
  getTaskNotes,
  getAllNotes,
  type SharedTask,
  type WorkspaceInfo,
  type TimeEntry,
  type TaskNote,
} from "../lib/api";

interface Props {
  workspace: WorkspaceInfo;
  portalCode: string;
  user: { name: string; email: string; role: string };
  onLogout: () => void;
}

const PRIORITY_COLORS = {
  low: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  high: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-ZA", {
    hour: "2-digit", minute: "2-digit",
  });
}

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isDueSoon(dateStr: string | null) {
  if (!dateStr) return false;
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff >= 0 && diff < 2 * 24 * 60 * 60 * 1000;
}

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  const due = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

export function TeamTaskBoard({ workspace, portalCode, user, onLogout }: Props) {
  const [tasks, setTasks] = useState<SharedTask[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, TaskNote[]>>({});
  const [noteText, setNoteText] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "done">("all");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [newComments, setNewComments] = useState<TaskNote[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const lastSeenRef = useRef<string>(new Date().toISOString());

  const [showEndTimeInput, setShowEndTimeInput] = useState(false);
  const [endTimeValue, setEndTimeValue] = useState("");
  const [stoppingWithTime, setStoppingWithTime] = useState(false);

  const loadData = useCallback(async () => {
    const [t, entries, running] = await Promise.all([
      getTeamTasks(portalCode, user.email),
      getTimeEntries(portalCode, user.email),
      getRunningEntry(portalCode, user.email),
    ]);
    setTasks(t.sort((a, b) => {
      const statusOrder = { pending: 0, in_progress: 1, done: 2 };
      const so = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
      if (so !== 0) return so;
      const po = { high: 0, medium: 1, low: 2 };
      return (po[a.priority] ?? 1) - (po[b.priority] ?? 1);
    }));
    setTimeEntries(entries);
    setRunningEntry(running);
  }, [portalCode, user.email]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (runningEntry) {
      const start = new Date(runningEntry.startedAt).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [runningEntry]);

  const handleStartTimer = async (taskId: string) => {
    const entry = await startTimeEntry(portalCode, taskId, user.email, user.name);
    if (entry) {
      setRunningEntry(entry);
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status === "pending") {
        await updateTaskStatus(portalCode, taskId, "in_progress");
        loadData();
      }
    }
  };

  const handleStopTimer = async () => {
    if (!runningEntry) return;
    const stopped = await stopTimeEntry(portalCode, runningEntry.id);
    if (stopped) {
      setRunningEntry(null);
      setShowEndTimeInput(false);
      loadData();
    }
  };

  const handleStopWithEndTime = async () => {
    if (!runningEntry || !endTimeValue) return;
    setStoppingWithTime(true);
    try {
      const localDate = new Date(endTimeValue);
      const isoString = localDate.toISOString();
      const stopped = await stopTimeEntry(portalCode, runningEntry.id, isoString);
      if (stopped) {
        setRunningEntry(null);
        setShowEndTimeInput(false);
        setEndTimeValue("");
        loadData();
      }
    } finally {
      setStoppingWithTime(false);
    }
  };

  const openEndTimeInput = () => {
    setEndTimeValue(toLocalDatetimeInputValue(new Date()));
    setShowEndTimeInput(true);
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    if (runningEntry && runningEntry.taskId === taskId && status === "done") {
      await stopTimeEntry(portalCode, runningEntry.id);
      setRunningEntry(null);
    }
    await updateTaskStatus(portalCode, taskId, status);
    loadData();
  };

  useEffect(() => {
    const pollNotifications = async () => {
      const recent = await getAllNotes(portalCode, lastSeenRef.current, user.email);
      const fromOthers = recent.filter((n) => n.authorEmail !== user.email);
      if (fromOthers.length > 0) {
        setNewComments((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...fromOthers.filter((n) => !ids.has(n.id))];
        });
      }
    };
    const interval = setInterval(pollNotifications, 12000);
    return () => clearInterval(interval);
  }, [portalCode, user.email]);

  const dismissNotifications = () => {
    lastSeenRef.current = new Date().toISOString();
    setNewComments([]);
    setShowNotifications(false);
  };

  const loadNotes = async (taskId: string) => {
    const n = await getTaskNotes(portalCode, taskId);
    setNotes((prev) => ({ ...prev, [taskId]: n }));
  };

  const handleAddNote = async (taskId: string) => {
    const text = noteText[taskId]?.trim();
    if (!text) return;
    await addTaskNote(portalCode, taskId, user.name, user.email, text);
    setNoteText((prev) => ({ ...prev, [taskId]: "" }));
    loadNotes(taskId);
  };

  const toggleExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
      loadNotes(taskId);
    }
  };

  const getTaskTime = (taskId: string): number => {
    return timeEntries
      .filter((e) => e.taskId === taskId && e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0);
  };

  const totalTimeToday = (): number => {
    const todayStr = new Date().toISOString().split("T")[0];
    return timeEntries
      .filter((e) => e.startedAt.startsWith(todayStr) && e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0);
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
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img src={`${import.meta.env.BASE_URL}hourlink_icon.png`} alt="HourLink" className="w-7 h-7 rounded-lg flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground leading-tight truncate">Team Portal</h1>
              <p className="text-xs text-muted-foreground truncate">{workspace.ownerName}'s workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg hover:bg-muted transition-colors"
                title="Notifications"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {newComments.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {newComments.length > 9 ? "9+" : newComments.length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-11 w-72 max-w-[calc(100vw-1rem)] bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-xs font-semibold text-foreground">New Comments</span>
                    {newComments.length > 0 && (
                      <button onClick={dismissNotifications} className="text-[10px] text-primary font-medium">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {newComments.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 text-center">No new comments</p>
                    ) : (
                      newComments.slice(0, 10).map((n) => {
                        const task = tasks.find((t) => t.id === n.taskId);
                        return (
                          <div key={n.id} className="px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                              setShowNotifications(false);
                              if (n.taskId) {
                                setExpandedTask(n.taskId);
                                loadNotes(n.taskId);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-semibold text-foreground">{n.authorName}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(n.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-xs text-foreground line-clamp-2">{n.text}</p>
                            {task && <p className="text-[10px] text-muted-foreground mt-0.5">on: {task.title}</p>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
            <button onClick={onLogout} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted" title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">
        {runningEntry && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Timer Running</p>
                  <p className="text-xs text-blue-700 truncate max-w-[160px]">
                    {tasks.find((t) => t.id === runningEntry.taskId)?.title || "Task"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-mono font-bold text-blue-900 tabular-nums">
                  {formatDuration(elapsed)}
                </span>
                <button
                  onClick={handleStopTimer}
                  className="h-9 px-3 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  Stop
                </button>
                <button
                  onClick={openEndTimeInput}
                  className="h-9 px-3 bg-blue-100 text-blue-800 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors"
                  title="Set a custom end time if you forgot to stop the timer"
                >
                  Set end time
                </button>
              </div>
            </div>

            {showEndTimeInput && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-700 mb-2 font-medium">
                  Set the actual time you stopped working:
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="datetime-local"
                    value={endTimeValue}
                    max={toLocalDatetimeInputValue(new Date())}
                    min={toLocalDatetimeInputValue(new Date(runningEntry.startedAt))}
                    onChange={(e) => setEndTimeValue(e.target.value)}
                    className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-blue-300 bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    onClick={handleStopWithEndTime}
                    disabled={!endTimeValue || stoppingWithTime}
                    className="h-9 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {stoppingWithTime ? "Saving…" : "Confirm & Stop"}
                  </button>
                  <button
                    onClick={() => setShowEndTimeInput(false)}
                    className="h-9 px-3 text-blue-700 text-sm rounded-lg hover:bg-blue-100 transition-colors flex-shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-foreground">{counts.all}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Tasks</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{counts.in_progress}</p>
            <p className="text-xs text-muted-foreground mt-0.5">In Progress</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-foreground tabular-nums">{formatDuration(totalTimeToday() + (runningEntry ? elapsed : 0))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Today</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">My Tasks</h2>
          <button onClick={() => loadData()} className="text-xs text-primary font-medium hover:underline">Refresh</button>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 mb-4">
          <div className="flex gap-1 bg-secondary rounded-lg p-1 min-w-max w-full">
            {(["all", "pending", "in_progress", "done"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 h-8 rounded-md text-xs font-medium whitespace-nowrap px-2 transition-all ${
                  filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
              </button>
            ))}
          </div>
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
              {filter === "all" ? "No tasks assigned to you yet." : `No ${filter === "in_progress" ? "in progress" : filter} tasks.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const pColor = PRIORITY_COLORS[task.priority];
              const isExpanded = expandedTask === task.id;
              const taskTime = getTaskTime(task.id);
              const isRunning = runningEntry?.taskId === task.id;
              const overdue = task.status !== "done" && isOverdue(task.dueDate);
              const dueSoon = task.status !== "done" && !overdue && isDueSoon(task.dueDate);

              return (
                <div key={task.id} className={`bg-card border rounded-xl overflow-hidden transition-all ${
                  isRunning ? "border-blue-300 ring-1 ring-blue-100" : overdue ? "border-red-200" : "border-border"
                }`}>
                  <div className="p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pColor.bg} ${pColor.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pColor.dot}`} />
                            {task.priority}
                          </span>
                          {task.dueDate && (
                            <span className={`text-xs font-medium ${overdue ? "text-red-600" : dueSoon ? "text-amber-600" : "text-muted-foreground"}`}>
                              {overdue ? "Overdue" : dueSoon ? "Due soon" : `Due ${formatDate(task.dueDate)}`}
                            </span>
                          )}
                          {isRunning && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                              Recording
                            </span>
                          )}
                        </div>
                        <h3 className={`text-sm font-medium text-foreground leading-snug ${task.status === "done" ? "line-through opacity-60" : ""}`}>
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          className="h-8 px-2 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        {task.status !== "done" && !isRunning && (
                          <button
                            onClick={() => handleStartTimer(task.id)}
                            disabled={!!runningEntry}
                            className="h-8 px-3 bg-blue-500 text-white text-xs font-medium rounded-md hover:bg-blue-600 transition-colors disabled:opacity-40 flex items-center gap-1"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            Start
                          </button>
                        )}
                        {isRunning && (
                          <button
                            onClick={handleStopTimer}
                            className="h-8 px-3 bg-red-500 text-white text-xs font-medium rounded-md hover:bg-red-600 transition-colors flex items-center gap-1"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                            Stop
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {(taskTime > 0 || isRunning) && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {formatDuration(taskTime + (isRunning ? elapsed : 0))}
                          </span>
                        )}
                        <button
                          onClick={() => toggleExpand(task.id)}
                          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          {isExpanded ? "Hide" : "Notes"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Time Log</h4>
                      {timeEntries.filter((e) => e.taskId === task.id).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No time logged yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {timeEntries
                            .filter((e) => e.taskId === task.id)
                            .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                            .slice(0, 5)
                            .map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between text-xs gap-2 flex-wrap">
                                <span className="text-muted-foreground">
                                  {formatDate(entry.startedAt)} {formatTime(entry.startedAt)}
                                  {entry.stoppedAt ? ` — ${formatTime(entry.stoppedAt)}` : " (running)"}
                                </span>
                                <span className="font-mono font-medium text-foreground">
                                  {entry.duration ? formatDuration(entry.duration) : "..."}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}

                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide pt-2">Notes</h4>
                      {(notes[task.id] || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No notes yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {(notes[task.id] || []).map((note) => (
                            <div key={note.id} className="bg-card rounded-lg p-3 border border-border">
                              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                                <span className="text-xs font-medium text-foreground">{note.authorName}</span>
                                <span className="text-xs text-muted-foreground">{formatDate(note.createdAt)} {formatTime(note.createdAt)}</span>
                              </div>
                              <p className="text-xs text-foreground whitespace-pre-wrap">{note.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add a note..."
                          value={noteText[task.id] || ""}
                          onChange={(e) => setNoteText((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(task.id); }}
                          className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button
                          onClick={() => handleAddNote(task.id)}
                          disabled={!noteText[task.id]?.trim()}
                          className="h-9 px-3 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}
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
