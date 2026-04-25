import { AppIcon } from "@/components/AppIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/BottomSheet";
import { CalendarPicker } from "@/components/CalendarPicker";
import { ClientBadge } from "@/components/ClientBadge";
import { ClientDropdown } from "@/components/ClientDropdown";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { useApp } from "@/context/AppContext";
import type { Task } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { NonBinary } from "lucide-react-native";

const PORTAL_KEY = "@hourlink_portal_code";
const API_BASE = "https://hourlink-api.onrender.com/api";
const WEB_APP_DOMAIN =
  process.env.EXPO_PUBLIC_DOMAIN ||
  "3c94995a-f8aa-4cf3-8522-b97ec8b49001-00-gjye0mczcysk.picard.replit.dev";

type FilterType = "all" | "todo" | "in_progress" | "done";
type ViewMode = "list" | "calendar";

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "#10b981" },
  medium: { label: "Medium", color: "#f59e0b" },
  high: { label: "High", color: "#ef4444" },
};

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (taskDay.getTime() === today.getTime()) return "Today";
  if (taskDay.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(task.dueDate) < new Date();
}

function getGroupKey(task: Task): string {
  if (!task.dueDate) return "no_date";
  if (isOverdue(task)) return "overdue";
  const d = new Date(task.dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (taskDay.getTime() === today.getTime()) return "today";
  if (taskDay.getTime() === tomorrow.getTime()) return "tomorrow";
  if (taskDay <= weekEnd) return "this_week";
  return "later";
}

const GROUP_ORDER = [
  "overdue",
  "today",
  "tomorrow",
  "this_week",
  "later",
  "no_date",
];
const GROUP_LABELS: Record<string, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This Week",
  later: "Later",
  no_date: "No Date",
};
const GROUP_COLORS: Record<string, string> = {
  overdue: "#ef4444",
  today: "#3b82f6",
  tomorrow: "#8b5cf6",
  this_week: "#f59e0b",
  later: "#64748b",
  no_date: "#94a3b8",
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekDates(weekOffset: number): Date[] {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function TaskCard({
  task,
  onComplete,
  onDelete,
  onEdit,
  onStartTimer,
  showDate = true,
}: {
  task: Task;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onStartTimer: () => void;
  showDate?: boolean;
}) {
  const colors = useColors();
  const { clients } = useApp();
  const client = clients.find((c) => c.id === task.clientId);
  const pCfg = PRIORITY_CONFIG[task.priority];
  const overdue = isOverdue(task);
  const done = task.status === "done";

  const rightActions = () => (
    <View style={styles.swipeActions}>
      {task.status !== "done" && (
        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: "#10b981" }]}
          onPress={onComplete}
        >
          <AppIcon name="checkmark" size={20} color="#fff" />
          <Text style={styles.swipeBtnLabel}>Done</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.swipeBtn, { backgroundColor: "#ef4444" }]}
        onPress={onDelete}
      >
        <AppIcon name="trash" size={18} color="#fff" />
        <Text style={styles.swipeBtnLabel}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable renderRightActions={rightActions}>
      <TouchableOpacity
        style={[
          styles.taskCard,
          { backgroundColor: colors.card, borderColor: colors.border },
          done && { opacity: 0.5 },
          overdue && { borderLeftWidth: 3, borderLeftColor: "#ef4444" },
        ]}
        onPress={onEdit}
        testID={`task-card-${task.id}`}
      >
        <View style={styles.taskTop}>
          <TouchableOpacity
            style={[
              styles.checkbox,
              {
                borderColor: done ? "#10b981" : pCfg.color,
                backgroundColor: done ? "#10b981" : "transparent",
              },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onComplete();
            }}
          >
            {done && <AppIcon name="checkmark" size={12} color="#fff" />}
          </TouchableOpacity>
          <View style={styles.taskMain}>
            <Text
              style={[
                styles.taskTitle,
                { color: colors.foreground },
                done && {
                  textDecorationLine: "line-through",
                  color: colors.mutedForeground,
                },
              ]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            {task.description ? (
              <Text
                style={[styles.taskDesc, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {task.description}
              </Text>
            ) : null}
          </View>
          {!done && (
            <TouchableOpacity
              style={[
                styles.timerBtn,
                { backgroundColor: colors.primary + "18" },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onStartTimer();
              }}
              testID={`task-timer-${task.id}`}
            >
              <AppIcon name="play" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.taskMeta}>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: pCfg.color + "20" },
            ]}
          >
            <View
              style={[styles.priorityDot, { backgroundColor: pCfg.color }]}
            />
            <Text style={[styles.priorityLabel, { color: pCfg.color }]}>
              {pCfg.label}
            </Text>
          </View>
          {showDate && task.dueDate && (
            <View
              style={[
                styles.dueBadge,
                { backgroundColor: overdue ? "#ef444418" : colors.muted },
              ]}
            >
              <AppIcon
                name="calendar-outline"
                size={11}
                color={overdue ? "#ef4444" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.dueLabel,
                  { color: overdue ? "#ef4444" : colors.mutedForeground },
                ]}
              >
                {formatDate(task.dueDate)}
              </Text>
            </View>
          )}
          {task.estimatedHours ? (
            <View style={[styles.dueBadge, { backgroundColor: colors.muted }]}>
              <AppIcon
                name="time-outline"
                size={11}
                color={colors.mutedForeground}
              />
              <Text
                style={[styles.dueLabel, { color: colors.mutedForeground }]}
              >
                {task.estimatedHours}h est.
              </Text>
            </View>
          ) : null}
          {client && (
            <ClientBadge name={client.name} color={client.color} size="sm" />
          )}
          {task.status === "in_progress" && (
            <View style={[styles.dueBadge, { backgroundColor: "#3b82f618" }]}>
              <Text style={[styles.dueLabel, { color: "#3b82f6" }]}>
                In Progress
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    clients,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    startTimer,
    settings,
    timeEntries,
    addTaskComment,
    getTaskComments,
    taskComments,
    markCommentsSynced,
  } = useApp();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [showPortal, setShowPortal] = useState(false);
  const [portalCode, setPortalCode] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalCopied, setPortalCopied] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [clientCredentials, setClientCredentials] = useState<
    { name: string; email: string; password: string; isNew: boolean }[]
  >([]);
  const [credsCopied, setCredsCopied] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [portalComments, setPortalComments] = useState<
    {
      id: string;
      taskId: string;
      authorName: string;
      authorEmail: string;
      text: string;
      createdAt: string;
    }[]
  >([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSending, setCommentSending] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [estHours, setEstHours] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PORTAL_KEY).then((code) => {
      if (code) setPortalCode(code);
    });
  }, []);

  useEffect(() => {
    if (!portalCode) return;
    const poll = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/workspaces/${portalCode}/tasks/pending`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const existingPortalIds = new Set(
          tasks.filter((t) => t.portalTaskId).map((t) => t.portalTaskId),
        );
        const newTasks = data.filter((t: any) => !existingPortalIds.has(t.id));
        for (const task of newTasks) {
          const matchedClient = clients.find(
            (c) =>
              c.email.toLowerCase() === (task.fromEmail || "").toLowerCase(),
          );
          try {
            await fetch(
              `${API_BASE}/workspaces/${portalCode}/tasks/${task.id}/claim`,
              { method: "PATCH" },
            );
          } catch {}
          addTask({
            title: task.title,
            description: task.description || "",
            priority: task.priority || "medium",
            status: "todo",
            clientId: matchedClient?.id || "",
            dueDate: task.dueDate || null,
            estimatedHours: null,
            hourlyRate: null,
            portalTaskId: task.id,
          });
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [portalCode, tasks, clients, addTask]);

  useEffect(() => {
    if (!portalCode) return;
    const pushUnsynced = async () => {
      const unsynced = tasks.filter((t) => t.clientId && !t.portalTaskId);
      for (const task of unsynced) {
        const client = clients.find((c) => c.id === task.clientId);
        if (!client) continue;
        try {
          const res = await fetch(
            `${API_BASE}/workspaces/${portalCode}/tasks`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: task.title,
                description: task.description || "",
                priority: task.priority,
                fromUser: settings.name || "Freelancer",
                fromEmail: "",
                forEmail: client.email,
                dueDate: task.dueDate || null,
                source: "freelancer",
              }),
            },
          );
          if (res.ok) {
            const data = await res.json();
            updateTask(task.id, { portalTaskId: data.id });
          }
        } catch {}
      }
    };
    const interval = setInterval(pushUnsynced, 15000);
    return () => clearInterval(interval);
  }, [portalCode, tasks, clients, settings.name, updateTask]);

  useEffect(() => {
    if (!portalCode) return;
    const syncComments = async () => {
      const unsynced = taskComments.filter((c) => !c.synced);
      const syncedIds: string[] = [];
      for (const comment of unsynced) {
        const task = tasks.find((t) => t.id === comment.taskId);
        if (!task?.portalTaskId) continue;
        try {
          const res = await fetch(
            `${API_BASE}/workspaces/${portalCode}/tasks/${task.portalTaskId}/notes`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                authorName: comment.authorName,
                authorEmail: "",
                text: comment.text,
              }),
            },
          );
          if (res.ok) {
            syncedIds.push(comment.id);
          }
        } catch {}
      }
      if (syncedIds.length > 0) {
        markCommentsSynced(syncedIds);
      }
    };
    const interval = setInterval(syncComments, 20000);
    syncComments();
    return () => clearInterval(interval);
  }, [portalCode, taskComments, tasks, markCommentsSynced]);

  const syncClientsToApi = useCallback(
    async (code: string) => {
      if (clients.length === 0) {
        setClientCredentials([]);
        return;
      }

      try {
        const validClients = clients
          .filter((c) => c.email?.trim())
          .map((c) => ({
            name: c.name,
            email: c.email.trim(),
          }));

        if (validClients.length === 0) {
          setClientCredentials([]);
          return;
        }

        let activeCode = code;
        let res = await fetch(`${API_BASE}/workspaces/${activeCode}/clients`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clients: validClients }),
        });

        if (res.status === 404) {
          await AsyncStorage.removeItem(PORTAL_KEY);
          setPortalCode(null);

          const createRes = await fetch(`${API_BASE}/workspaces`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ownerName: settings.name || "HourLink User",
            }),
          });

          if (!createRes.ok) {
            const body = await createRes.json().catch(() => ({}));
            console.error("Workspace recreation failed:", body);
            setClientCredentials([]);
            return;
          }

          const ws = await createRes.json();
          activeCode = ws.code;
          await AsyncStorage.setItem(PORTAL_KEY, activeCode);
          setPortalCode(activeCode);

          res = await fetch(`${API_BASE}/workspaces/${activeCode}/clients`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clients: validClients }),
          });
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error("syncClientsToApi failed:", body);
          setClientCredentials([]);
          return;
        }

        const data = await res.json();
        setClientCredentials(data.credentials || []);
      } catch (e) {
        console.error("syncClientsToApi error:", e);
        setClientCredentials([]);
      }
    },
    [clients, settings.name],
  );

  const createOrGetPortal = useCallback(async () => {
    if (portalCode) {
      try {
        const check = await fetch(`${API_BASE}/workspaces/${portalCode}`);
        if (check.ok) return portalCode;
      } catch {}
    }

    setPortalLoading(true);

    try {
      const res = await fetch(`${API_BASE}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerName: settings.name || "HourLink User" }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Portal creation failed:", body);
        return null;
      }

      const ws = await res.json();
      await AsyncStorage.setItem(PORTAL_KEY, ws.code);
      setPortalCode(ws.code);
      return ws.code;
    } catch (e) {
      console.error("Portal creation failed:", e);
      return null;
    } finally {
      setPortalLoading(false);
    }
  }, [portalCode, settings.name]);

  const fetchAndImportPendingTasks = useCallback(
    async (code: string) => {
      try {
        const res = await fetch(`${API_BASE}/workspaces/${code}/tasks/pending`);
        if (!res.ok) {
          setPendingTasks([]);
          return;
        }

        const data = await res.json();
        const existingPortalIds = new Set(
          tasks.filter((t) => t.portalTaskId).map((t) => t.portalTaskId),
        );

        const newTasks = data.filter((t: any) => !existingPortalIds.has(t.id));

        for (const task of newTasks) {
          const matchedClient = clients.find(
            (c) =>
              c.email.toLowerCase() === (task.fromEmail || "").toLowerCase(),
          );

          try {
            await fetch(
              `${API_BASE}/workspaces/${code}/tasks/${task.id}/claim`,
              {
                method: "PATCH",
              },
            );
          } catch {}

          addTask({
            title: task.title,
            description: task.description || "",
            priority: task.priority || "medium",
            status: "todo",
            clientId: matchedClient?.id || "",
            dueDate: task.dueDate || null,
            estimatedHours: null,
            hourlyRate: null,
            portalTaskId: task.id,
          });
        }

        const remainingRes = await fetch(
          `${API_BASE}/workspaces/${code}/tasks/pending`,
        );

        if (remainingRes.ok) {
          const remaining = await remainingRes.json();
          setPendingTasks(remaining);
        } else {
          setPendingTasks([]);
        }
      } catch (e) {
        console.error("fetchAndImportPendingTasks error:", e);
        setPendingTasks([]);
      }
    },
    [tasks, clients, addTask],
  );

  const handleManualRefresh = useCallback(async () => {
    if (!portalCode || refreshing) return;
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await fetchAndImportPendingTasks(portalCode);
    } catch {}
    setRefreshing(false);
  }, [portalCode, refreshing, fetchAndImportPendingTasks]);

  const pushLocalTasksToPortal = useCallback(
    async (code: string) => {
      const clientTasks = tasks.filter((t) => t.clientId && !t.portalTaskId);

      for (const task of clientTasks) {
        const client = clients.find((c) => c.id === task.clientId);
        if (!client?.email?.trim()) continue;

        try {
          const res = await fetch(`${API_BASE}/workspaces/${code}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: task.title,
              description: task.description || "",
              priority: task.priority,
              fromUser: settings.name || "Freelancer",
              fromEmail: "",
              forEmail: client.email.trim(),
              assignedTo: "",
              dueDate: task.dueDate || null,
              source: "freelancer",
            }),
          });

          if (res.ok) {
            const data = await res.json();
            updateTask(task.id, { portalTaskId: data.id });
          } else {
            const body = await res.json().catch(() => ({}));
            console.error("pushLocalTasksToPortal failed:", body);
          }
        } catch (e) {
          console.error("pushLocalTasksToPortal error:", e);
        }
      }
    },
    [tasks, clients, settings.name, updateTask],
  );

  const openPortalSheet = useCallback(async () => {
    const code = await createOrGetPortal();

    if (!code) {
      Alert.alert(
        "Connection Error",
        "Could not connect to the portal server. Please try again.",
      );
      return;
    }

    await syncClientsToApi(code);
    await pushLocalTasksToPortal(code);
    await fetchAndImportPendingTasks(code);
    setShowPortal(true);
  }, [
    createOrGetPortal,
    syncClientsToApi,
    pushLocalTasksToPortal,
    fetchAndImportPendingTasks,
  ]);

  const syncTaskStatusToPortal = useCallback(
    async (
      portalTaskId: string,
      newStatus: "todo" | "in_progress" | "done",
    ) => {
      if (!portalCode) return;
      const portalStatus = newStatus === "todo" ? "pending" : newStatus;
      try {
        await fetch(
          `${API_BASE}/workspaces/${portalCode}/tasks/${portalTaskId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: portalStatus }),
          },
        );
      } catch {}
    },
    [portalCode],
  );

  const getPortalUrl = useCallback(() => {
    if (!portalCode) return "";
    return `https://${WEB_APP_DOMAIN}/client-portal/?code=${portalCode}`;
  }, [portalCode]);

  const getTeamPortalUrl = useCallback(() => {
    if (!portalCode) return "";
    return `https://${WEB_APP_DOMAIN}/client-portal/?code=${portalCode}&mode=team`;
  }, [portalCode]);

  const copyPortalLink = useCallback(async () => {
    const url = getPortalUrl();
    if (!url) return;

    await Clipboard.setStringAsync(url);
    setPortalCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setPortalCopied(false), 2000);
  }, [getPortalUrl]);

  const sharePortalLink = useCallback(async () => {
    const clientUrl = getPortalUrl();
    const teamUrl = getTeamPortalUrl();
    if (!clientUrl) return;

    try {
      await Share.share({
        message: `Submit tasks for me via HourLink:

Client portal:
${clientUrl}

Team portal:
${teamUrl}`,
        url: clientUrl,
      });
    } catch (e) {
      console.error("sharePortalLink error:", e);
    }
  }, [getPortalUrl, getTeamPortalUrl]);

  const shareClientCredentials = useCallback(
    async (cred: { name: string; email: string; password: string }) => {
      const url = getPortalUrl();
      const msg = `Hi ${cred.name},

You've been invited to the HourLink Task Portal.

Portal: ${url}
Email: ${cred.email}
Password: ${cred.password}

You can change your password on first login.`;

      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(msg);
        setCredsCopied(cred.email);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setCredsCopied(null), 2000);
      } else {
        try {
          await Share.share({ message: msg });
        } catch (e) {
          console.error("shareClientCredentials error:", e);
        }
      }
    },
    [getPortalUrl],
  );

  const pushSingleTaskToPortal = useCallback(
    async (task: {
      id: string;
      title: string;
      description: string;
      priority: string;
      clientId: string;
      dueDate: string | null;
      portalTaskId?: string | null;
    }) => {
      if (!portalCode || !task.clientId || task.portalTaskId) return;

      const client = clients.find((c) => c.id === task.clientId);
      if (!client?.email?.trim()) return;

      try {
        const check = await fetch(`${API_BASE}/workspaces/${portalCode}`);
        if (!check.ok) return;

        const res = await fetch(`${API_BASE}/workspaces/${portalCode}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            description: task.description || "",
            priority: task.priority,
            fromUser: settings.name || "Freelancer",
            fromEmail: "",
            forEmail: client.email.trim(),
            assignedTo: "",
            dueDate: task.dueDate || null,
            source: "freelancer",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          updateTask(task.id, { portalTaskId: data.id });
        } else {
          const body = await res.json().catch(() => ({}));
          console.error("pushSingleTaskToPortal failed:", body);
        }
      } catch (e) {
        console.error("pushSingleTaskToPortal error:", e);
      }
    },
    [portalCode, clients, settings.name, updateTask],
  );

  const resetForm = () => {
    setTitle("");
    setDesc("");
    setPriority("medium");
    setStatus("todo");
    setClientId("");
    setDueDate(null);
    setEstHours("");
    setHourlyRate("");
    setEditingTask(null);
  };

  const loadComments = useCallback(
    async (portalTaskId: string) => {
      if (!portalCode) return;

      setCommentsLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/workspaces/${portalCode}/tasks/${portalTaskId}/notes`,
        );

        if (res.ok) {
          const notes = await res.json();
          setPortalComments(notes);
        } else {
          setPortalComments([]);
        }
      } catch (e) {
        console.error("loadComments error:", e);
        setPortalComments([]);
      }
      setCommentsLoading(false);
    },
    [portalCode],
  );

  const postComment = useCallback(
    async (taskId: string, portalTaskId?: string | null) => {
      const text = commentText.trim();
      if (!text) return;

      setCommentSending(true);

      try {
        if (portalCode && portalTaskId) {
          const res = await fetch(
            `${API_BASE}/workspaces/${portalCode}/tasks/${portalTaskId}/notes`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                authorName: settings.name || "Freelancer",
                authorEmail: "",
                text,
              }),
            },
          );

          if (res.ok) {
            await loadComments(portalTaskId);
          } else {
            const body = await res.json().catch(() => ({}));
            console.error("postComment failed:", body);
          }
        } else {
          addTaskComment({
            taskId,
            authorName: settings.name || "Freelancer",
            text,
            synced: false,
          });
        }

        setCommentText("");
      } catch (e) {
        console.error("postComment error:", e);
      } finally {
        setCommentSending(false);
      }
    },
    [portalCode, commentText, settings.name, loadComments, addTaskComment],
  );

  const openAdd = (prefillDate?: string) => {
    resetForm();
    if (prefillDate) setDueDate(prefillDate);
    setShowAdd(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDesc(task.description);
    setPriority(task.priority);
    setStatus(task.status);
    setClientId(task.clientId);
    setDueDate(task.dueDate ?? null);
    setEstHours(task.estimatedHours?.toString() || "");
    setHourlyRate(task.hourlyRate?.toString() || "");
    setShowAdd(true);
    if (task.portalTaskId && portalCode) {
      loadComments(task.portalTaskId);
    } else {
      setPortalComments([]);
    }
  };

  const updateTaskWithSync = useCallback(
    (id: string, updates: Partial<Task>) => {
      updateTask(id, updates);
      if (updates.status) {
        const task = tasks.find((t) => t.id === id);
        if (task?.portalTaskId) {
          syncTaskStatusToPortal(task.portalTaskId, updates.status as any);
        }
      }
    },
    [updateTask, tasks, syncTaskStatusToPortal],
  );

  const completeTaskWithSync = useCallback(
    (id: string) => {
      completeTask(id);
      const task = tasks.find((t) => t.id === id);
      if (task?.portalTaskId) {
        syncTaskStatusToPortal(task.portalTaskId, "done");
      }
    },
    [completeTask, tasks, syncTaskStatusToPortal],
  );

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a task title.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const taskData = {
      title: title.trim(),
      description: desc,
      priority,
      status,
      clientId,
      dueDate,
      estimatedHours: estHours ? parseFloat(estHours) : null,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
    };
    if (editingTask) {
      updateTaskWithSync(editingTask.id, taskData);
    } else {
      const newTask = addTask(taskData);
      if (newTask && clientId) {
        pushSingleTaskToPortal({
          ...taskData,
          id: newTask.id,
          portalTaskId: null,
        });
      }
    }
    setShowAdd(false);
    resetForm();
  };

  const handleStartTimer = (task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const client = clients.find((c) => c.id === task.clientId);
    const rate =
      task.hourlyRate ?? client?.hourlyRate ?? settings.defaultHourlyRate;
    const existingEntry = timeEntries.find(
      (e) => e.taskId === task.id && e.endTime,
    );
    startTimer({
      clientId: task.clientId,
      projectId: "",
      taskId: task.id,
      description: task.title,
      hourlyRate: rate,
      billable: true,
      resumeEntryId: existingEntry?.id ?? null,
    });
    updateTaskWithSync(task.id, { status: "in_progress" });
    router.push("/work");
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingDeleteId(id);
  };

  const filtered = useMemo(
    () => tasks.filter((t) => (filter === "all" ? true : t.status === filter)),
    [tasks, filter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of filtered) {
      const key = getGroupKey(task);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return GROUP_ORDER.filter((k) => map.has(k)).map((k) => ({
      key: k,
      label: GROUP_LABELS[k],
      color: GROUP_COLORS[k],
      tasks: map.get(k)!,
    }));
  }, [filtered]);

  const pendingCount = useMemo(
    () => tasks.filter((t) => t.status !== "done").length,
    [tasks],
  );
  const overdueCount = useMemo(() => tasks.filter(isOverdue).length, [tasks]);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const tasksForDate = useMemo(
    () =>
      tasks.filter(
        (t) => t.dueDate && isSameDay(new Date(t.dueDate), selectedDate),
      ),
    [tasks, selectedDate],
  );

  const todayDate = new Date();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const monthLabel = weekDates[0].toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPadding + 16, borderBottomColor: colors.border },
        ]}
      >
        <View>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>
            Tasks
          </Text>
          {pendingCount > 0 && (
            <Text style={[styles.screenSub, { color: colors.mutedForeground }]}>
              {pendingCount} pending
              {overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.muted }]}
            onPress={handleManualRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <AppIcon name="refresh" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.muted }]}
            onPress={openPortalSheet}
          >
            <AppIcon name="share-outline" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                backgroundColor:
                  viewMode === "calendar" ? colors.primary : colors.muted,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode((v) => (v === "list" ? "calendar" : "list"));
            }}
          >
            <AppIcon
              name={
                viewMode === "calendar" ? "list-outline" : "calendar-outline"
              }
              size={18}
              color={viewMode === "calendar" ? "#fff" : colors.foreground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() =>
              openAdd(
                viewMode === "calendar"
                  ? selectedDate.toISOString()
                  : undefined,
              )
            }
            testID="add-task-btn"
          >
            <AppIcon name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === "list" ? (
        <>
          {/* Filter tabs */}
          <View
            style={[styles.filterRow, { borderBottomColor: colors.border }]}
          >
            {(["all", "todo", "in_progress", "done"] as FilterType[]).map(
              (f) => {
                const labels: Record<FilterType, string> = {
                  all: "All",
                  todo: "To Do",
                  in_progress: "In Progress",
                  done: "Done",
                };
                const count =
                  f === "all"
                    ? tasks.length
                    : tasks.filter((t) => t.status === f).length;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.filterTab,
                      filter === f && {
                        borderBottomColor: colors.primary,
                        borderBottomWidth: 2,
                      },
                    ]}
                    onPress={() => setFilter(f)}
                  >
                    <Text
                      style={[
                        styles.filterLabel,
                        {
                          color:
                            filter === f
                              ? colors.primary
                              : colors.mutedForeground,
                        },
                      ]}
                    >
                      {labels[f]}
                    </Text>
                    {count > 0 && (
                      <View
                        style={[
                          styles.filterCount,
                          {
                            backgroundColor:
                              filter === f ? colors.primary : colors.muted,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterCountText,
                            {
                              color:
                                filter === f ? "#fff" : colors.mutedForeground,
                            },
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              },
            )}
          </View>

          {/* Task list */}
          {filtered.length === 0 ? (
            <EmptyState
              icon="checkmark-circle-outline"
              title={filter === "done" ? "No completed tasks" : "No tasks yet"}
              description={
                filter === "all"
                  ? "Add tasks to track your work and set deadlines."
                  : `No ${filter.replace("_", " ")} tasks.`
              }
              actionLabel={filter !== "done" ? "Add Task" : undefined}
              onAction={filter !== "done" ? () => openAdd() : undefined}
            />
          ) : (
            <ScrollView
              contentContainerStyle={{
                padding: 20,
                paddingBottom: botPadding + 100,
              }}
              showsVerticalScrollIndicator={false}
            >
              {grouped.map(({ key, label, color, tasks: groupTasks }) => (
                <View key={key} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <View
                      style={[styles.groupDot, { backgroundColor: color }]}
                    />
                    <Text
                      style={[
                        styles.groupLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {label}
                    </Text>
                    <Text
                      style={[
                        styles.groupCount,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {groupTasks.length}
                    </Text>
                  </View>
                  {groupTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        completeTaskWithSync(task.id);
                      }}
                      onDelete={() => handleDelete(task.id)}
                      onEdit={() => openEdit(task)}
                      onStartTimer={() => handleStartTimer(task)}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        /* ── CALENDAR VIEW ── */
        <View style={{ flex: 1 }}>
          {/* Week strip */}
          <View
            style={[
              styles.weekStrip,
              {
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
              },
            ]}
          >
            {/* Month + nav */}
            <View style={styles.weekNav}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setWeekOffset((w) => w - 1);
                }}
              >
                <AppIcon
                  name="chevron-back"
                  size={20}
                  color={colors.foreground}
                />
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: colors.foreground }]}>
                {monthLabel}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setWeekOffset((w) => w + 1);
                }}
              >
                <AppIcon
                  name="chevron-forward"
                  size={20}
                  color={colors.foreground}
                />
              </TouchableOpacity>
            </View>

            {/* Day cells */}
            <View style={styles.dayRow}>
              {weekDates.map((date, i) => {
                const isToday = isSameDay(date, todayDate);
                const isSelected = isSameDay(date, selectedDate);
                const dayTasks = tasks.filter(
                  (t) => t.dueDate && isSameDay(new Date(t.dueDate), date),
                );
                const doneTasks = dayTasks.filter((t) => t.status === "done");
                const pendTasks = dayTasks.filter((t) => t.status !== "done");
                const overdueTasks = dayTasks.filter(isOverdue);

                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.dayCell}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDate(date);
                    }}
                  >
                    <Text
                      style={[
                        styles.dayLetter,
                        {
                          color: isToday
                            ? colors.primary
                            : colors.mutedForeground,
                        },
                      ]}
                    >
                      {DAY_LETTERS[i]}
                    </Text>
                    <View
                      style={[
                        styles.dayNumWrap,
                        isSelected && { backgroundColor: colors.primary },
                        isToday &&
                          !isSelected && {
                            backgroundColor: colors.primary + "20",
                          },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          {
                            color: isSelected
                              ? "#fff"
                              : isToday
                                ? colors.primary
                                : colors.foreground,
                          },
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </View>
                    {/* Task dots */}
                    <View style={styles.dotRow}>
                      {overdueTasks.length > 0 && (
                        <View
                          style={[
                            styles.taskDot,
                            { backgroundColor: "#ef4444" },
                          ]}
                        />
                      )}
                      {pendTasks.length > 0 && (
                        <View
                          style={[
                            styles.taskDot,
                            { backgroundColor: colors.primary },
                          ]}
                        />
                      )}
                      {doneTasks.length > 0 && (
                        <View
                          style={[
                            styles.taskDot,
                            { backgroundColor: "#10b981" },
                          ]}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Selected day header */}
          <View
            style={[styles.calDayHeader, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.calDayTitle, { color: colors.foreground }]}>
              {isSameDay(selectedDate, todayDate)
                ? "Today"
                : isSameDay(
                      selectedDate,
                      new Date(
                        todayDate.getFullYear(),
                        todayDate.getMonth(),
                        todayDate.getDate() + 1,
                      ),
                    )
                  ? "Tomorrow"
                  : selectedDate.toLocaleDateString("en-ZA", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
            </Text>
            <Text
              style={[styles.calDayCount, { color: colors.mutedForeground }]}
            >
              {tasksForDate.length}{" "}
              {tasksForDate.length === 1 ? "task" : "tasks"}
            </Text>
          </View>

          {/* Tasks for selected day */}
          {tasksForDate.length === 0 ? (
            <View style={styles.calEmpty}>
              <View
                style={[styles.calEmptyIcon, { backgroundColor: colors.muted }]}
              >
                <AppIcon
                  name="calendar-outline"
                  size={28}
                  color={colors.mutedForeground}
                />
              </View>
              <Text
                style={[styles.calEmptyTitle, { color: colors.foreground }]}
              >
                Nothing scheduled
              </Text>
              <Text
                style={[styles.calEmptyDesc, { color: colors.mutedForeground }]}
              >
                Tap + to add a task for this day
              </Text>
              <TouchableOpacity
                style={[styles.calAddBtn, { backgroundColor: colors.primary }]}
                onPress={() => openAdd(selectedDate.toISOString())}
              >
                <AppIcon name="add" size={16} color="#fff" />
                <Text style={styles.calAddBtnText}>Add task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{
                padding: 16,
                paddingBottom: botPadding + 100,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Pending */}
              {tasksForDate.filter((t) => t.status !== "done").length > 0 && (
                <View style={styles.calSection}>
                  <Text
                    style={[
                      styles.calSectionLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    TO DO
                  </Text>
                  {tasksForDate
                    .filter((t) => t.status !== "done")
                    .map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showDate={false}
                        onComplete={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          completeTaskWithSync(task.id);
                        }}
                        onDelete={() => handleDelete(task.id)}
                        onEdit={() => openEdit(task)}
                        onStartTimer={() => handleStartTimer(task)}
                      />
                    ))}
                </View>
              )}
              {/* Completed */}
              {tasksForDate.filter((t) => t.status === "done").length > 0 && (
                <View style={styles.calSection}>
                  <View style={styles.calSectionRow}>
                    <Text
                      style={[
                        styles.calSectionLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      COMPLETED
                    </Text>
                    <View
                      style={[
                        styles.calBadge,
                        { backgroundColor: "#10b98120" },
                      ]}
                    >
                      <AppIcon
                        name="checkmark-circle"
                        size={11}
                        color="#10b981"
                      />
                      <Text style={[styles.calBadgeText, { color: "#10b981" }]}>
                        {tasksForDate.filter((t) => t.status === "done").length}{" "}
                        done
                      </Text>
                    </View>
                  </View>
                  {tasksForDate
                    .filter((t) => t.status === "done")
                    .map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showDate={false}
                        onComplete={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          completeTaskWithSync(task.id);
                        }}
                        onDelete={() => handleDelete(task.id)}
                        onEdit={() => openEdit(task)}
                        onStartTimer={() => handleStartTimer(task)}
                      />
                    ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* Add / Edit Task Sheet */}
      <BottomSheet
        visible={showAdd}
        onClose={() => {
          setShowAdd(false);
          resetForm();
        }}
        title={editingTask ? "Edit Task" : "New Task"}
      >
        <FormField
          label="Task Title *"
          placeholder="e.g., Finish homepage design, Send proposal"
          value={title}
          onChangeText={setTitle}
          autoFocus
        />
        <FormField
          label="Description"
          placeholder="Additional details..."
          value={desc}
          onChangeText={setDesc}
          multiline
          numberOfLines={2}
        />

        <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>
          Priority
        </Text>
        <View style={styles.priorityRow}>
          {(["low", "medium", "high"] as Task["priority"][]).map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityChip,
                  {
                    backgroundColor: priority === p ? cfg.color : colors.muted,
                    borderColor: priority === p ? cfg.color : "transparent",
                    borderWidth: 1,
                  },
                ]}
                onPress={() => setPriority(p)}
              >
                <View
                  style={[
                    styles.priorityDotSm,
                    { backgroundColor: priority === p ? "#fff" : cfg.color },
                  ]}
                />
                <Text
                  style={[
                    styles.priorityChipLabel,
                    { color: priority === p ? "#fff" : colors.foreground },
                  ]}
                >
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>
          Status
        </Text>
        <View style={styles.statusRow}>
          {(["todo", "in_progress", "done"] as Task["status"][]).map((s) => {
            const labels = {
              todo: "To Do",
              in_progress: "In Progress",
              done: "Done",
            };
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor:
                      status === s ? colors.primary : colors.muted,
                  },
                ]}
                onPress={() => setStatus(s)}
              >
                <Text
                  style={[
                    styles.statusChipLabel,
                    { color: status === s ? "#fff" : colors.foreground },
                  ]}
                >
                  {labels[s]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ClientDropdown
          clients={clients}
          value={clientId}
          onChange={setClientId}
          label="Client (optional)"
          allowNone
          noneLabel="No client"
        />

        <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>
          Due Date
          {dueDate
            ? ` — ${new Date(dueDate).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`
            : ""}
        </Text>
        <CalendarPicker value={dueDate} onChange={setDueDate} />

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Est. Hours"
              placeholder="e.g., 2.5"
              value={estHours}
              onChangeText={setEstHours}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label={`Hourly Rate (${settings.currency})`}
              placeholder={`e.g., ${settings.defaultHourlyRate}`}
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          testID="save-task-btn"
        >
          <Text style={styles.saveBtnText}>
            {editingTask ? "Save Changes" : "Add Task"}
          </Text>
        </TouchableOpacity>

        {editingTask &&
          (() => {
            const localComments = getTaskComments(editingTask.id).map((c) => ({
              id: c.id,
              taskId: c.taskId,
              authorName: c.authorName,
              authorEmail: "",
              text: c.text,
              createdAt: c.createdAt,
            }));

            const mergedComments = [...localComments, ...portalComments];

            const allComments = mergedComments
              .filter((comment, index, arr) => {
                return (
                  index ===
                  arr.findIndex(
                    (x) =>
                      x.authorName === comment.authorName &&
                      x.text === comment.text &&
                      Math.abs(
                        new Date(x.createdAt).getTime() -
                          new Date(comment.createdAt).getTime(),
                      ) < 5000,
                  )
                );
              })
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              );
            return (
              <View
                style={[
                  styles.commentsSection,
                  { borderTopColor: colors.border },
                ]}
              >
                <View style={styles.commentHeader}>
                  <AppIcon
                    name="chatbubble-ellipses-outline"
                    size={16}
                    color={colors.foreground}
                  />
                  <Text
                    style={[styles.commentTitle, { color: colors.foreground }]}
                  >
                    Comments
                  </Text>
                  <Text
                    style={[
                      styles.commentCount,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    ({allComments.length})
                  </Text>
                </View>

                {commentsLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={{ paddingVertical: 12 }}
                  />
                ) : allComments.length === 0 ? (
                  <Text
                    style={[
                      styles.noComments,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    No comments yet. Start the conversation.
                  </Text>
                ) : (
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    {allComments.map((c) => (
                      <View
                        key={c.id}
                        style={[
                          styles.commentBubble,
                          {
                            backgroundColor:
                              c.authorEmail === ""
                                ? colors.primary + "12"
                                : colors.muted,
                          },
                        ]}
                      >
                        <View style={styles.commentBubbleTop}>
                          <Text
                            style={[
                              styles.commentAuthor,
                              { color: colors.foreground },
                            ]}
                          >
                            {c.authorName}
                          </Text>
                          <Text
                            style={[
                              styles.commentTime,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            {new Date(c.createdAt).toLocaleDateString("en-ZA", {
                              day: "numeric",
                              month: "short",
                            })}{" "}
                            {new Date(c.createdAt).toLocaleTimeString("en-ZA", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.commentBody,
                            { color: colors.foreground },
                          ]}
                        >
                          {c.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.commentInputRow}>
                  <TextInput
                    style={[
                      styles.commentInput,
                      {
                        backgroundColor: colors.muted,
                        color: colors.foreground,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Write a comment..."
                    placeholderTextColor={colors.mutedForeground}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                  />
                  <TouchableOpacity
                    style={[
                      styles.commentSendBtn,
                      {
                        backgroundColor: commentText.trim()
                          ? colors.primary
                          : colors.muted,
                      },
                    ]}
                    onPress={() =>
                      postComment(editingTask.id, editingTask.portalTaskId)
                    }
                    disabled={!commentText.trim() || commentSending}
                  >
                    {commentSending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <AppIcon
                        name="send"
                        size={16}
                        color={
                          commentText.trim() ? "#fff" : colors.mutedForeground
                        }
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
      </BottomSheet>

      <BottomSheet
        visible={showPortal}
        onClose={() => setShowPortal(false)}
        title="Client Task Portal"
      >
        <View style={{ gap: 16 }}>
          <View
            style={[
              portalStyles.infoCard,
              {
                backgroundColor: colors.primary + "10",
                borderColor: colors.primary + "30",
              },
            ]}
          >
            <AppIcon name="link-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text
                style={[portalStyles.infoTitle, { color: colors.foreground }]}
              >
                Share this link with your clients
              </Text>
              <Text
                style={[
                  portalStyles.infoDesc,
                  { color: colors.mutedForeground },
                ]}
              >
                They'll be able to submit tasks directly to your task list — no
                app install needed.
              </Text>
            </View>
          </View>

          {portalCode ? (
            <>
              <View
                style={[
                  portalStyles.urlBox,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[portalStyles.urlText, { color: colors.foreground }]}
                  numberOfLines={2}
                  selectable
                >
                  {getPortalUrl()}
                </Text>
              </View>
              <View style={portalStyles.actionRow}>
                <TouchableOpacity
                  style={[
                    portalStyles.actionBtn,
                    {
                      backgroundColor: portalCopied
                        ? "#10b981"
                        : colors.primary,
                    },
                  ]}
                  onPress={copyPortalLink}
                >
                  <AppIcon
                    name={portalCopied ? "checkmark" : "copy-outline"}
                    size={16}
                    color="#fff"
                  />
                  <Text style={portalStyles.actionBtnText}>
                    {portalCopied ? "Copied!" : "Copy Link"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    portalStyles.actionBtn,
                    {
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={sharePortalLink}
                >
                  <AppIcon
                    name="share-outline"
                    size={16}
                    color={colors.foreground}
                  />
                  <Text
                    style={[
                      portalStyles.actionBtnText,
                      { color: colors.foreground },
                    ]}
                  >
                    Share
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={[
                portalStyles.actionBtn,
                { backgroundColor: colors.primary, alignSelf: "stretch" },
              ]}
              onPress={createOrGetPortal}
              disabled={portalLoading}
            >
              <Text style={portalStyles.actionBtnText}>
                {portalLoading ? "Creating..." : "Generate Portal Link"}
              </Text>
            </TouchableOpacity>
          )}

          {clientCredentials.length > 0 && (
            <View style={{ gap: 8 }}>
              <View style={portalStyles.pendingHeader}>
                <Text
                  style={[
                    portalStyles.pendingTitle,
                    { color: colors.foreground },
                  ]}
                >
                  Client Login Details
                </Text>
                <View
                  style={[
                    portalStyles.pendingBadge,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Text
                    style={[
                      portalStyles.pendingBadgeText,
                      { color: colors.primary },
                    ]}
                  >
                    {clientCredentials.length}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  portalStyles.infoDesc,
                  { color: colors.mutedForeground, marginBottom: 4 },
                ]}
              >
                Share these login details with your clients so they can access
                the portal.
              </Text>
              {clientCredentials.map((cred) => (
                <View
                  key={cred.email}
                  style={[
                    portalStyles.credCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        portalStyles.pendingTaskTitle,
                        { color: colors.foreground },
                      ]}
                    >
                      {cred.name}
                    </Text>
                    <Text
                      style={[
                        portalStyles.pendingTaskMeta,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {cred.email}
                    </Text>
                    <View
                      style={[
                        portalStyles.passwordRow,
                        { backgroundColor: colors.muted },
                      ]}
                    >
                      <Text
                        style={[
                          portalStyles.passwordLabel,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Password:
                      </Text>
                      <Text
                        style={[
                          portalStyles.passwordValue,
                          { color: colors.foreground },
                        ]}
                      >
                        {cred.password}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      portalStyles.sendBtn,
                      {
                        backgroundColor:
                          credsCopied === cred.email
                            ? "#10b981"
                            : colors.primary,
                      },
                    ]}
                    onPress={() => shareClientCredentials(cred)}
                  >
                    <AppIcon
                      name={credsCopied === cred.email ? "checkmark" : "send"}
                      size={14}
                      color="#fff"
                    />
                    <Text style={portalStyles.sendBtnText}>
                      {credsCopied === cred.email ? "Copied" : "Send"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {clientCredentials.length === 0 && portalCode && (
            <View
              style={[
                portalStyles.infoCard,
                { backgroundColor: "#f59e0b10", borderColor: "#f59e0b30" },
              ]}
            >
              <AppIcon
                name="information-circle-outline"
                size={20}
                color="#f59e0b"
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[portalStyles.infoTitle, { color: colors.foreground }]}
                >
                  No clients yet
                </Text>
                <Text
                  style={[
                    portalStyles.infoDesc,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Add clients in the Clients tab first. Their login details will
                  appear here so you can share them.
                </Text>
              </View>
            </View>
          )}
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={!!pendingDeleteId}
        title="Delete Task"
        message="Remove this task? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pendingDeleteId) deleteTask(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </View>
  );
}

const portalStyles = StyleSheet.create({
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  infoDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  urlBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  urlText: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  pendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pendingTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  pendingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pendingBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  pendingTaskTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  pendingTaskMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  pendingTaskDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    lineHeight: 16,
  },
  claimBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  claimBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  credCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  passwordLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  passwordValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  screenSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  filterTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 11,
  },
  filterLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  filterCount: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  filterCountText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  group: { marginBottom: 20 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  groupCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
  taskCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8 },
  taskTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  taskMain: { flex: 1 },
  taskTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  taskDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
    lineHeight: 16,
  },
  timerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  taskMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  dueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  dueLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  swipeActions: {
    flexDirection: "row",
    gap: 4,
    paddingLeft: 8,
    alignItems: "center",
  },
  swipeBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minWidth: 58,
  },
  swipeBtnLabel: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  sheetLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  priorityRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  priorityChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
  },
  priorityDotSm: { width: 6, height: 6, borderRadius: 3 },
  priorityChipLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statusChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 10,
  },
  statusChipLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  twoCol: { flexDirection: "row", gap: 12 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  // Calendar styles
  weekStrip: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  monthLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dayRow: { flexDirection: "row", justifyContent: "space-around" },
  dayCell: { alignItems: "center", gap: 4, flex: 1 },
  dayLetter: { fontSize: 11, fontFamily: "Inter_500Medium" },
  dayNumWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dotRow: { flexDirection: "row", gap: 3, height: 6, alignItems: "center" },
  taskDot: { width: 5, height: 5, borderRadius: 3 },
  calDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  calDayTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  calDayCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  calEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 40,
  },
  calEmptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  calEmptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  calEmptyDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  calAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  calAddBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  calSection: { marginBottom: 20 },
  calSectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calSectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  calBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  calBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  commentsSection: { borderTopWidth: 1, marginTop: 20, paddingTop: 16 },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  commentTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  commentCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  noComments: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingVertical: 8,
  },
  commentBubble: { borderRadius: 10, padding: 10 },
  commentBubbleTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentAuthor: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  commentTime: { fontSize: 10, fontFamily: "Inter_400Regular" },
  commentBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  commentInputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  commentInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    maxHeight: 80,
    minHeight: 38,
  },
  commentSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
NonBinary