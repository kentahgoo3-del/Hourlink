import { AppIcon } from "@/components/AppIcon";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormField } from "@/components/FormField";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { teamSync, type SharedTask, type WorkspaceInfo } from "@/services/teamSync";

const PRIORITY_COLOR = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TeamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, addTask } = useApp();

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [workspaceCode, setWorkspaceCode] = useState("");
  const [pendingTasks, setPendingTasks] = useState<SharedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  // Sheets
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showDelegate, setShowDelegate] = useState(false);

  // Form state
  const [joinCode, setJoinCode] = useState("");
  const [delegateTitle, setDelegateTitle] = useState("");
  const [delegateDesc, setDelegateDesc] = useState("");
  const [delegatePriority, setDelegatePriority] = useState<"low" | "medium" | "high">("medium");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Load persisted workspace
  useEffect(() => {
    AsyncStorage.multiGet(["teamWorkspaceCode", "teamIsOwner"]).then((pairs) => {
      const code = pairs[0][1];
      const owner = pairs[1][1] === "true";
      if (code) { setWorkspaceCode(code); setIsOwner(owner); loadWorkspace(code); }
    });
  }, []);

  const loadWorkspace = async (code: string) => {
    setLoading(true);
    setError("");
    try {
      const ws = await teamSync.getWorkspace(code);
      setWorkspace(ws);
      await syncPending(code);
    } catch (e: any) {
      setError(e.message || "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  };

  const syncPending = async (code: string) => {
    setSyncing(true);
    try {
      const tasks = await teamSync.getPendingTasks(code);
      setPendingTasks(tasks);
    } catch (_) {}
    setSyncing(false);
  };

  const handleCreate = async () => {
    const name = settings.name || "Owner";
    setLoading(true);
    try {
      const ws = await teamSync.createWorkspace(name);
      setWorkspace(ws);
      setWorkspaceCode(ws.code);
      setIsOwner(true);
      await AsyncStorage.multiSet([["teamWorkspaceCode", ws.code], ["teamIsOwner", "true"]]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreate(false);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to create workspace");
    } finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { Alert.alert("Enter the 6-character workspace code."); return; }
    const name = settings.name || "Member";
    setLoading(true);
    try {
      const ws = await teamSync.joinWorkspace(joinCode.trim().toUpperCase(), name);
      setWorkspace(ws);
      setWorkspaceCode(ws.code);
      setIsOwner(false);
      await AsyncStorage.multiSet([["teamWorkspaceCode", ws.code], ["teamIsOwner", "false"]]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowJoin(false);
      setJoinCode("");
    } catch (e: any) {
      Alert.alert("Not found", "No workspace found with that code. Double-check and try again.");
    } finally { setLoading(false); }
  };

  const handleDelegate = async () => {
    if (!delegateTitle.trim()) { Alert.alert("Enter a task title."); return; }
    setLoading(true);
    try {
      await teamSync.pushTask(workspaceCode, {
        title: delegateTitle.trim(),
        description: delegateDesc,
        priority: delegatePriority,
        fromUser: settings.name || "Team member",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDelegate(false);
      setDelegateTitle(""); setDelegateDesc(""); setDelegatePriority("medium");
      Alert.alert("Sent!", "Task added to the owner's to-do list.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send task");
    } finally { setLoading(false); }
  };

  const handleAccept = async (task: SharedTask) => {
    try {
      await teamSync.claimTask(workspaceCode, task.id);
      addTask({
        title: task.title,
        description: task.description + (task.fromUser ? `\n\n— From: ${task.fromUser}` : ""),
        priority: task.priority,
        status: "todo",
        clientId: "",
        dueDate: null,
        estimatedHours: null,
        hourlyRate: null,
      });
      setPendingTasks((prev) => prev.filter((t) => t.id !== task.id));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      Alert.alert("Error", "Could not accept task");
    }
  };

  const handleLeave = () => setShowLeaveConfirm(true);

  const doLeave = async () => {
    await AsyncStorage.multiRemove(["teamWorkspaceCode", "teamIsOwner"]);
    setWorkspace(null); setWorkspaceCode(""); setIsOwner(false); setPendingTasks([]);
    setShowLeaveConfirm(false);
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: botPadding + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <AppIcon name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Team & Delegation</Text>
        {workspace && (
          <TouchableOpacity
            style={[styles.syncBtn, { backgroundColor: colors.muted }]}
            onPress={() => syncPending(workspaceCode)}
          >
            {syncing ? <ActivityIndicator size="small" color={colors.primary} /> : <AppIcon name="refresh" size={18} color={colors.primary} />}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {!workspace ? (
          /* No workspace yet */
          <>
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.heroIcon, { backgroundColor: colors.primary + "18" }]}>
                <AppIcon name="people" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>Team Collaboration</Text>
              <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>
                Create a workspace and share your 6-character code with team members or freelancers. They can assign tasks directly to your to-do list — and you can delegate tasks to theirs.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: colors.primary }]}
              onPress={handleCreate}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <>
                <AppIcon name="add-circle" size={22} color="#fff" />
                <Text style={styles.bigBtnText}>Create My Workspace</Text>
              </>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => setShowJoin(true)}
            >
              <AppIcon name="log-in" size={22} color={colors.primary} />
              <Text style={[styles.bigBtnText, { color: colors.foreground }]}>Join a Workspace</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Workspace connected */
          <>
            {/* Workspace Card */}
            <View style={[styles.wsCard, { backgroundColor: colors.primary }]}>
              <View style={styles.wsCardTop}>
                <View>
                  <Text style={styles.wsLabel}>WORKSPACE CODE</Text>
                  <Text style={styles.wsCode}>{workspace.code}</Text>
                </View>
                <View style={[styles.ownerBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <Text style={styles.ownerBadgeText}>{isOwner ? "Owner" : "Member"}</Text>
                </View>
              </View>
              <Text style={styles.wsOwner}>Owner: {workspace.ownerName}</Text>
              <Text style={styles.wsSub}>{workspace.members.length} member{workspace.members.length !== 1 ? "s" : ""} connected{isOwner ? " · Share your code to invite" : ""}</Text>
            </View>

            {/* Members */}
            {workspace.members.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Members</Text>
                {workspace.members.map((m, i) => (
                  <View key={i} style={[styles.memberRow, i < workspace.members.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>{m.name[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: colors.foreground }]}>{m.name}</Text>
                      <Text style={[styles.memberSub, { color: colors.mutedForeground }]}>Joined {timeAgo(m.joinedAt)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Pending tasks (owner only) */}
            {isOwner && (
              <>
                <View style={styles.pendingHeader}>
                  <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                    Incoming Tasks {pendingTasks.length > 0 ? `(${pendingTasks.length})` : ""}
                  </Text>
                  <TouchableOpacity onPress={() => syncPending(workspaceCode)}>
                    <Text style={[styles.refreshLink, { color: colors.primary }]}>Refresh</Text>
                  </TouchableOpacity>
                </View>
                {pendingTasks.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <AppIcon name="checkmark-done" size={28} color={colors.mutedForeground} />
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pending tasks from your team</Text>
                  </View>
                ) : (
                  pendingTasks.map((task) => (
                    <View key={task.id} style={[styles.pendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.pendingTop}>
                        <View style={[styles.pPriority, { backgroundColor: PRIORITY_COLOR[task.priority] + "22" }]}>
                          <View style={[styles.pDot, { backgroundColor: PRIORITY_COLOR[task.priority] }]} />
                          <Text style={[styles.pPriorityText, { color: PRIORITY_COLOR[task.priority] }]}>{task.priority}</Text>
                        </View>
                        <Text style={[styles.pFrom, { color: colors.mutedForeground }]}>from {task.fromUser} · {timeAgo(task.sentAt)}</Text>
                      </View>
                      <Text style={[styles.pTitle, { color: colors.foreground }]}>{task.title}</Text>
                      {task.description ? <Text style={[styles.pDesc, { color: colors.mutedForeground }]}>{task.description}</Text> : null}
                      <TouchableOpacity
                        style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                        onPress={() => handleAccept(task)}
                      >
                        <AppIcon name="add-circle" size={16} color="#fff" />
                        <Text style={styles.acceptBtnText}>Add to My Tasks</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </>
            )}

            {/* Delegate task (member only) */}
            {!isOwner && (
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowDelegate(true)}
              >
                <AppIcon name="paper-plane" size={20} color="#fff" />
                <Text style={styles.bigBtnText}>Send Task to Owner</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.leaveBtn, { borderColor: "#ef4444" }]}
              onPress={handleLeave}
            >
              <Text style={styles.leaveBtnText}>Leave Workspace</Text>
            </TouchableOpacity>
          </>
        )}

        {error !== "" && (
          <Text style={[styles.errorText, { color: "#ef4444" }]}>{error}</Text>
        )}
      </View>

      {/* Join Sheet */}
      <BottomSheet visible={showJoin} onClose={() => setShowJoin(false)} title="Join a Workspace">
        <Text style={[styles.sheetDesc, { color: colors.mutedForeground }]}>
          Enter the 6-character code shared by the workspace owner.
        </Text>
        <FormField
          label="Workspace Code"
          placeholder="e.g., ABC123"
          value={joinCode}
          onChangeText={(t) => setJoinCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoFocus
        />
        <TouchableOpacity
          style={[styles.bigBtn, { backgroundColor: colors.primary }]}
          onPress={handleJoin}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigBtnText}>Join Workspace</Text>}
        </TouchableOpacity>
      </BottomSheet>

      {/* Delegate Sheet */}
      <BottomSheet visible={showDelegate} onClose={() => setShowDelegate(false)} title="Send Task to Owner">
        <Text style={[styles.sheetDesc, { color: colors.mutedForeground }]}>
          This task will appear in the workspace owner's incoming tasks list.
        </Text>
        <FormField label="Task Title *" placeholder="What needs to be done?" value={delegateTitle} onChangeText={setDelegateTitle} autoFocus />
        <FormField label="Details" placeholder="Any extra context..." value={delegateDesc} onChangeText={setDelegateDesc} multiline numberOfLines={2} />
        <Text style={[styles.prioLabel, { color: colors.mutedForeground }]}>Priority</Text>
        <View style={styles.prioRow}>
          {(["low", "medium", "high"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.prioChip, { backgroundColor: delegatePriority === p ? PRIORITY_COLOR[p] : colors.muted }]}
              onPress={() => setDelegatePriority(p)}
            >
              <Text style={[styles.prioChipText, { color: delegatePriority === p ? "#fff" : colors.foreground }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.bigBtn, { backgroundColor: colors.primary }]}
          onPress={handleDelegate}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <>
            <AppIcon name="paper-plane" size={18} color="#fff" />
            <Text style={styles.bigBtnText}>Send Task</Text>
          </>}
        </TouchableOpacity>
      </BottomSheet>
      <ConfirmDialog
        visible={showLeaveConfirm}
        title="Leave Workspace"
        message="You will no longer be connected to this workspace. All shared tasks will stop syncing."
        confirmLabel="Leave"
        destructive
        onConfirm={doLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  backBtn: { padding: 4 },
  screenTitle: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold" },
  syncBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, gap: 14 },
  heroCard: { borderRadius: 18, borderWidth: 1, padding: 24, alignItems: "center", gap: 12 },
  heroIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  heroDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  bigBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 16, gap: 8 },
  bigBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  wsCard: { borderRadius: 18, padding: 20 },
  wsCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  wsLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.7)", letterSpacing: 1.5 },
  wsCode: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 4, marginTop: 4 },
  ownerBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  ownerBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  wsOwner: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)" },
  wsSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 4 },
  section: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  memberName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  memberSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  pendingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  refreshLink: { fontSize: 13, fontFamily: "Inter_500Medium" },
  emptyBox: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  pendingCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  pendingTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  pPriority: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pDot: { width: 6, height: 6, borderRadius: 3 },
  pPriorityText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  pFrom: { fontSize: 11, fontFamily: "Inter_400Regular" },
  pTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  pDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  acceptBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10, marginTop: 4 },
  acceptBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  leaveBtn: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  leaveBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#ef4444" },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  sheetDesc: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 16, lineHeight: 20 },
  prioLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 10 },
  prioRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  prioChip: { flex: 1, alignItems: "center", borderRadius: 10, paddingVertical: 10 },
  prioChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
