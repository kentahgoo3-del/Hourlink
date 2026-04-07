import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/BottomSheet";
import { ClientBadge } from "@/components/ClientBadge";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { useApp } from "@/context/AppContext";
import type { Task } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type FilterType = "all" | "todo" | "in_progress" | "done";

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "#10b981" },
  medium: { label: "Medium", color: "#f59e0b" },
  high: { label: "High", color: "#ef4444" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (taskDay.getTime() === today.getTime()) return "Today";
  if (taskDay.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
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
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (taskDay.getTime() === today.getTime()) return "today";
  if (taskDay.getTime() === tomorrow.getTime()) return "tomorrow";
  if (taskDay <= weekEnd) return "this_week";
  return "later";
}

const GROUP_ORDER = ["overdue", "today", "tomorrow", "this_week", "later", "no_date"];
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

function TaskCard({ task, onComplete, onDelete, onEdit, onStartTimer }: {
  task: Task;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onStartTimer: () => void;
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
        <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: "#10b981" }]} onPress={onComplete}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.swipeBtnLabel}>Done</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: "#ef4444" }]} onPress={onDelete}>
        <Ionicons name="trash" size={18} color="#fff" />
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
          done && { opacity: 0.55 },
          overdue && { borderLeftWidth: 3, borderLeftColor: "#ef4444" },
        ]}
        onPress={onEdit}
        testID={`task-card-${task.id}`}
      >
        {/* Top row */}
        <View style={styles.taskTop}>
          <TouchableOpacity
            style={[styles.checkbox, { borderColor: done ? "#10b981" : pCfg.color, backgroundColor: done ? "#10b981" : "transparent" }]}
            onPress={(e) => { e.stopPropagation(); onComplete(); }}
          >
            {done && <Ionicons name="checkmark" size={12} color="#fff" />}
          </TouchableOpacity>
          <View style={styles.taskMain}>
            <Text style={[styles.taskTitle, { color: colors.foreground }, done && { textDecorationLine: "line-through", color: colors.mutedForeground }]} numberOfLines={2}>
              {task.title}
            </Text>
            {task.description ? <Text style={[styles.taskDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{task.description}</Text> : null}
          </View>
          {!done && (
            <TouchableOpacity
              style={[styles.timerBtn, { backgroundColor: colors.primary + "18" }]}
              onPress={(e) => { e.stopPropagation(); onStartTimer(); }}
              testID={`task-timer-${task.id}`}
            >
              <Ionicons name="play" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom row */}
        <View style={styles.taskMeta}>
          <View style={[styles.priorityBadge, { backgroundColor: pCfg.color + "20" }]}>
            <View style={[styles.priorityDot, { backgroundColor: pCfg.color }]} />
            <Text style={[styles.priorityLabel, { color: pCfg.color }]}>{pCfg.label}</Text>
          </View>
          {task.dueDate && (
            <View style={[styles.dueBadge, { backgroundColor: overdue ? "#ef444418" : colors.muted }]}>
              <Ionicons name="calendar-outline" size={11} color={overdue ? "#ef4444" : colors.mutedForeground} />
              <Text style={[styles.dueLabel, { color: overdue ? "#ef4444" : colors.mutedForeground }]}>
                {formatDate(task.dueDate)}
              </Text>
            </View>
          )}
          {task.estimatedHours ? (
            <View style={[styles.dueBadge, { backgroundColor: colors.muted }]}>
              <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
              <Text style={[styles.dueLabel, { color: colors.mutedForeground }]}>{task.estimatedHours}h est.</Text>
            </View>
          ) : null}
          {client && <ClientBadge name={client.name} color={client.color} size="sm" />}
          {task.status === "in_progress" && (
            <View style={[styles.dueBadge, { backgroundColor: "#3b82f618" }]}>
              <Text style={[styles.dueLabel, { color: "#3b82f6" }]}>In Progress</Text>
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
  const { clients, tasks, addTask, updateTask, deleteTask, completeTask, startTimer, activeTimer, settings } = useApp();

  const [filter, setFilter] = useState<FilterType>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estHours, setEstHours] = useState("");

  const resetForm = () => {
    setTitle(""); setDesc(""); setPriority("medium"); setStatus("todo");
    setClientId(""); setDueDate(""); setEstHours("");
    setEditingTask(null);
  };

  const openAdd = () => { resetForm(); setShowAdd(true); };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDesc(task.description);
    setPriority(task.priority);
    setStatus(task.status);
    setClientId(task.clientId);
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "");
    setEstHours(task.estimatedHours?.toString() || "");
    setShowAdd(true);
  };

  const handleSave = () => {
    if (!title.trim()) { Alert.alert("Title required", "Please enter a task title."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let dueDateISO: string | null = null;
    if (dueDate.trim()) {
      const parts = dueDate.trim().split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(d.getTime())) dueDateISO = d.toISOString();
      }
      if (!dueDateISO) {
        Alert.alert("Invalid date", "Please enter the date as YYYY-MM-DD, e.g. 2026-04-15.");
        return;
      }
    }
    if (editingTask) {
      updateTask(editingTask.id, { title: title.trim(), description: desc, priority, status, clientId, dueDate: dueDateISO, estimatedHours: estHours ? parseFloat(estHours) : null });
    } else {
      addTask({ title: title.trim(), description: desc, priority, status, clientId, dueDate: dueDateISO, estimatedHours: estHours ? parseFloat(estHours) : null });
    }
    setShowAdd(false);
    resetForm();
  };

  const handleStartTimer = (task: Task) => {
    if (activeTimer) { Alert.alert("Timer running", "Stop the current timer first."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const client = clients.find((c) => c.id === task.clientId);
    startTimer({
      clientId: task.clientId,
      projectId: "",
      description: task.title,
      hourlyRate: client?.hourlyRate || settings.defaultHourlyRate,
      billable: true,
    });
    updateTask(task.id, { status: "in_progress" });
    router.push("/work");
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Task", "Remove this task?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTask(id) },
    ]);
  };

  const filtered = useMemo(() =>
    tasks.filter((t) => {
      if (filter === "all") return true;
      return t.status === filter;
    }), [tasks, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of filtered) {
      const key = getGroupKey(task);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return GROUP_ORDER.filter((k) => map.has(k)).map((k) => ({ key: k, label: GROUP_LABELS[k], color: GROUP_COLORS[k], tasks: map.get(k)! }));
  }, [filtered]);

  const pendingCount = useMemo(() => tasks.filter((t) => t.status !== "done").length, [tasks]);
  const overdueCount = useMemo(() => tasks.filter(isOverdue).length, [tasks]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Tasks</Text>
          {pendingCount > 0 && (
            <Text style={[styles.screenSub, { color: colors.mutedForeground }]}>
              {pendingCount} pending{overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
            </Text>
          )}
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd} testID="add-task-btn">
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {(["all", "todo", "in_progress", "done"] as FilterType[]).map((f) => {
          const labels: Record<FilterType, string> = { all: "All", todo: "To Do", in_progress: "In Progress", done: "Done" };
          const count = f === "all" ? tasks.length : tasks.filter((t) => t.status === f).length;
          return (
            <TouchableOpacity key={f} style={[styles.filterTab, filter === f && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterLabel, { color: filter === f ? colors.primary : colors.mutedForeground }]}>{labels[f]}</Text>
              {count > 0 && (
                <View style={[styles.filterCount, { backgroundColor: filter === f ? colors.primary : colors.muted }]}>
                  <Text style={[styles.filterCountText, { color: filter === f ? "#fff" : colors.mutedForeground }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Task list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="checkmark-circle-outline"
          title={filter === "done" ? "No completed tasks" : "No tasks yet"}
          description={filter === "all" ? "Add tasks to track your work and set deadlines." : `No ${filter.replace("_", " ")} tasks.`}
          actionLabel={filter !== "done" ? "Add Task" : undefined}
          onAction={filter !== "done" ? openAdd : undefined}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 100 }} showsVerticalScrollIndicator={false}>
          {grouped.map(({ key, label, color, tasks: groupTasks }) => (
            <View key={key} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupDot, { backgroundColor: color }]} />
                <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{label}</Text>
                <Text style={[styles.groupCount, { color: colors.mutedForeground }]}>{groupTasks.length}</Text>
              </View>
              {groupTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    completeTask(task.id);
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

      {/* Add / Edit Task Sheet */}
      <BottomSheet visible={showAdd} onClose={() => { setShowAdd(false); resetForm(); }} title={editingTask ? "Edit Task" : "New Task"}>
        <FormField label="Task Title *" placeholder="e.g., Finish homepage design, Send proposal" value={title} onChangeText={setTitle} autoFocus />
        <FormField label="Description" placeholder="Additional details..." value={desc} onChangeText={setDesc} multiline numberOfLines={2} />

        <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Priority</Text>
        <View style={styles.priorityRow}>
          {(["low", "medium", "high"] as Task["priority"][]).map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            return (
              <TouchableOpacity
                key={p}
                style={[styles.priorityChip, { backgroundColor: priority === p ? cfg.color : colors.muted, borderColor: priority === p ? cfg.color : "transparent", borderWidth: 1 }]}
                onPress={() => setPriority(p)}
              >
                <View style={[styles.priorityDotSm, { backgroundColor: priority === p ? "#fff" : cfg.color }]} />
                <Text style={[styles.priorityChipLabel, { color: priority === p ? "#fff" : colors.foreground }]}>{cfg.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Status</Text>
        <View style={styles.statusRow}>
          {(["todo", "in_progress", "done"] as Task["status"][]).map((s) => {
            const labels = { todo: "To Do", in_progress: "In Progress", done: "Done" };
            return (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, { backgroundColor: status === s ? colors.primary : colors.muted }]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.statusChipLabel, { color: status === s ? "#fff" : colors.foreground }]}>{labels[s]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Client (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={styles.clientRow}>
            <TouchableOpacity
              style={[styles.clientChip, { backgroundColor: !clientId ? colors.primary : colors.muted }]}
              onPress={() => setClientId("")}
            >
              <Text style={[styles.clientChipLabel, { color: !clientId ? "#fff" : colors.foreground }]}>None</Text>
            </TouchableOpacity>
            {clients.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.clientChip, { backgroundColor: clientId === c.id ? c.color + "22" : colors.muted, borderColor: clientId === c.id ? c.color : "transparent", borderWidth: 1 }]}
                onPress={() => setClientId(c.id)}
              >
                <ClientBadge name={c.name} color={c.color} size="sm" />
                <Text style={[styles.clientChipLabel, { color: colors.foreground }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <FormField label="Due Date" placeholder="YYYY-MM-DD" value={dueDate} onChangeText={setDueDate} />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Est. Hours" placeholder="e.g., 2.5" value={estHours} onChangeText={setEstHours} keyboardType="decimal-pad" />
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} testID="save-task-btn">
          <Text style={styles.saveBtnText}>{editingTask ? "Save Changes" : "Add Task"}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  screenSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  filterRow: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20 },
  filterTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 11 },
  filterLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  filterCount: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  filterCountText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  group: { marginBottom: 20 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  groupCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
  taskCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8 },
  taskTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0 },
  taskMain: { flex: 1 },
  taskTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  taskDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 16 },
  timerBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  taskMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  priorityBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  dueBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  dueLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  swipeActions: { flexDirection: "row", gap: 4, paddingLeft: 8, alignItems: "center" },
  swipeBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", justifyContent: "center", gap: 3, minWidth: 58 },
  swipeBtnLabel: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  sheetLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 10, letterSpacing: 0.3 },
  priorityRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  priorityChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  priorityDotSm: { width: 6, height: 6, borderRadius: 3 },
  priorityChipLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statusChip: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 10 },
  statusChipLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  clientRow: { flexDirection: "row", gap: 8 },
  clientChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  clientChipLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  twoCol: { flexDirection: "row", gap: 12 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
