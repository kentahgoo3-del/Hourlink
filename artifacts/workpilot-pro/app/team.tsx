import { AppIcon } from "@/components/AppIcon";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormField } from "@/components/FormField";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { teamSync, type SharedTask, type TeamMemberCredential, type TimeEntry, type WorkspaceInfo } from "@/services/teamSync";
import * as Clipboard from "expo-clipboard";
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

const PRIORITY_COLOR = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };
const STATUS_COLOR = { pending: "#9ca3af", in_progress: "#3b82f6", done: "#10b981" };
const STATUS_LABEL: Record<string, string> = { pending: "Pending", in_progress: "In Progress", done: "Done" };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TeamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, tasks: appTasks, addTask } = useApp();

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [workspaceCode, setWorkspaceCode] = useState("");
  const [pendingTasks, setPendingTasks] = useState<SharedTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberCredential[]>([]);
  const [teamTasks, setTeamTasks] = useState<SharedTask[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "members" | "tasks" | "time">("overview");

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showDelegate, setShowDelegate] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [delegateTitle, setDelegateTitle] = useState("");
  const [delegateDesc, setDelegateDesc] = useState("");
  const [delegatePriority, setDelegatePriority] = useState<"low" | "medium" | "high">("medium");
  const [delegateToEmail, setDelegateToEmail] = useState("");
  const [delegateFromApp, setDelegateFromApp] = useState(false);
  const [selectedAppTask, setSelectedAppTask] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState("");

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
      await syncAll(code);
    } catch (e: any) {
      setError(e.message || "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  };

  const syncAll = async (code: string) => {
    setSyncing(true);
    try {
      const [pending, allTasks, entries] = await Promise.all([
        teamSync.getPendingTasks(code),
        teamSync.getAllTasks(code),
        teamSync.getTimeEntries(code),
      ]);
      setPendingTasks(pending);
      setTeamTasks(allTasks.filter((t) => t.assignedTo));
      setTimeEntries(entries);

      const storedMembers = await AsyncStorage.getItem(`teamMembers_${code}`);
      if (storedMembers) {
        try { setTeamMembers(JSON.parse(storedMembers)); } catch {}
      }
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
      Alert.alert("Not found", "No workspace found with that code.");
    } finally { setLoading(false); }
  };

  const handleAddTeamMember = async () => {
    if (!memberName.trim() || !memberEmail.trim()) {
      Alert.alert("Please enter both name and email.");
      return;
    }
    if (!memberEmail.includes("@")) {
      Alert.alert("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const updated = [...teamMembers, { name: memberName.trim(), email: memberEmail.trim(), role: memberRole, password: "", isNew: true }];
      const result = await teamSync.setTeamMembers(workspaceCode, updated.map((m) => ({ name: m.name, email: m.email, role: m.role })));
      if (result.ok) {
        setTeamMembers(result.credentials);
        await AsyncStorage.setItem(`teamMembers_${workspaceCode}`, JSON.stringify(result.credentials));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowAddMember(false);
        setMemberName("");
        setMemberEmail("");
        setMemberRole("member");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to add member");
    } finally { setLoading(false); }
  };

  const handleRemoveMember = async (email: string) => {
    const updated = teamMembers.filter((m) => m.email.toLowerCase() !== email.toLowerCase());
    setLoading(true);
    try {
      const result = await teamSync.setTeamMembers(workspaceCode, updated.map((m) => ({ name: m.name, email: m.email, role: m.role })));
      if (result.ok) {
        setTeamMembers(result.credentials);
        await AsyncStorage.setItem(`teamMembers_${workspaceCode}`, JSON.stringify(result.credentials));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to remove member");
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
        fromUser: settings.name || "Owner",
        assignedTo: delegateToEmail || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDelegate(false);
      setDelegateTitle(""); setDelegateDesc(""); setDelegatePriority("medium"); setDelegateToEmail("");
      setDelegateFromApp(false); setSelectedAppTask(null);
      Alert.alert("Sent!", delegateToEmail ? `Task assigned to ${delegateToEmail}` : "Task added to workspace.");
      syncAll(workspaceCode);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to delegate task");
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
    await AsyncStorage.multiRemove(["teamWorkspaceCode", "teamIsOwner", `teamMembers_${workspaceCode}`]);
    setWorkspace(null); setWorkspaceCode(""); setIsOwner(false); setPendingTasks([]);
    setTeamMembers([]); setTeamTasks([]); setTimeEntries([]);
    setShowLeaveConfirm(false);
  };

  const copyToClipboard = async (text: string, emailTag: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedEmail(emailTag);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopiedEmail(""), 2000);
  };

  const openDelegateFromApp = () => {
    setDelegateFromApp(true);
    setShowDelegate(true);
  };

  const selectAppTask = (task: any) => {
    setSelectedAppTask(task.id);
    setDelegateTitle(task.title);
    setDelegateDesc(task.description || "");
    setDelegatePriority(task.priority || "medium");
  };

  const getMemberTimeTotal = (email: string): number => {
    return timeEntries.filter((e) => e.memberEmail.toLowerCase() === email.toLowerCase() && e.duration).reduce((sum, e) => sum + (e.duration || 0), 0);
  };

  const getMemberTaskCount = (email: string): number => {
    return teamTasks.filter((t) => t.assignedTo.toLowerCase() === email.toLowerCase()).length;
  };

  const getMemberDoneCount = (email: string): number => {
    return teamTasks.filter((t) => t.assignedTo.toLowerCase() === email.toLowerCase() && t.status === "done").length;
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const portalUrl = workspaceCode ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/client-portal/?code=${workspaceCode}&mode=team` : "";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: botPadding + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <AppIcon name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Team & Delegation</Text>
        {workspace && (
          <TouchableOpacity
            style={[styles.syncBtn, { backgroundColor: colors.muted }]}
            onPress={() => syncAll(workspaceCode)}
          >
            {syncing ? <ActivityIndicator size="small" color={colors.primary} /> : <AppIcon name="refresh" size={18} color={colors.primary} />}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {!workspace ? (
          <>
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.heroIcon, { backgroundColor: colors.primary + "18" }]}>
                <AppIcon name="people" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>Team Collaboration</Text>
              <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>
                Create a workspace, add team members with auto-generated login credentials, and delegate tasks. Members use the Team Portal to track time, update progress, and add notes.
              </Text>
            </View>
            <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.primary }]} onPress={handleCreate}>
              {loading ? <ActivityIndicator color="#fff" /> : <>
                <AppIcon name="add-circle" size={22} color="#fff" />
                <Text style={styles.bigBtnText}>Create My Workspace</Text>
              </>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowJoin(true)}>
              <AppIcon name="log-in" size={22} color={colors.primary} />
              <Text style={[styles.bigBtnText, { color: colors.foreground }]}>Join a Workspace</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
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
              <Text style={styles.wsSub}>
                {teamMembers.length} team member{teamMembers.length !== 1 ? "s" : ""} · {teamTasks.length} delegated task{teamTasks.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {isOwner && (
              <View style={styles.tabRow}>
                {(["overview", "members", "tasks", "time"] as const).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, activeTab === tab && { backgroundColor: colors.primary }]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[styles.tabText, { color: activeTab === tab ? "#fff" : colors.mutedForeground }]}>
                      {tab === "overview" ? "Overview" : tab === "members" ? "Members" : tab === "tasks" ? "Tasks" : "Time"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* OVERVIEW TAB */}
            {(activeTab === "overview" || !isOwner) && (
              <>
                {isOwner && (
                  <View style={styles.quickActions}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowAddMember(true)}>
                      <AppIcon name="person-add" size={20} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Add Member</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setDelegateFromApp(false); setShowDelegate(true); }}>
                      <AppIcon name="paper-plane" size={20} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Delegate Task</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isOwner && teamMembers.length > 0 && (
                  <TouchableOpacity
                    style={[styles.credBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => setShowCredentials(!showCredentials)}
                  >
                    <AppIcon name="key" size={18} color={colors.primary} />
                    <Text style={[styles.credBtnText, { color: colors.foreground }]}>
                      {showCredentials ? "Hide Login Credentials" : "Show Login Credentials"}
                    </Text>
                    <AppIcon name={showCredentials ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}

                {showCredentials && teamMembers.map((m, i) => (
                  <View key={i} style={[styles.credCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.credHeader}>
                      <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                        <Text style={[styles.avatarText, { color: colors.primary }]}>{m.name[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.credName, { color: colors.foreground }]}>{m.name}</Text>
                        <Text style={[styles.credRole, { color: colors.mutedForeground }]}>{m.role}</Text>
                      </View>
                    </View>
                    <View style={[styles.credDetail, { backgroundColor: colors.muted }]}>
                      <View style={styles.credRow}>
                        <Text style={[styles.credLabel, { color: colors.mutedForeground }]}>Email</Text>
                        <Text style={[styles.credValue, { color: colors.foreground }]}>{m.email}</Text>
                      </View>
                      <View style={styles.credRow}>
                        <Text style={[styles.credLabel, { color: colors.mutedForeground }]}>Password</Text>
                        <Text style={[styles.credValue, { color: colors.foreground, fontFamily: "monospace" }]}>{m.password}</Text>
                      </View>
                      <View style={styles.credRow}>
                        <Text style={[styles.credLabel, { color: colors.mutedForeground }]}>Portal</Text>
                        <Text style={[styles.credValue, { color: colors.primary, fontSize: 11 }]} numberOfLines={1}>{portalUrl}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.copyBtn, { backgroundColor: copiedEmail === m.email ? "#10b981" : colors.primary }]}
                      onPress={() => copyToClipboard(`Team Portal Login:\nEmail: ${m.email}\nPassword: ${m.password}\nLink: ${portalUrl}`, m.email)}
                    >
                      <AppIcon name={copiedEmail === m.email ? "checkmark" : "copy"} size={14} color="#fff" />
                      <Text style={styles.copyBtnText}>{copiedEmail === m.email ? "Copied!" : "Copy Details"}</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {isOwner && pendingTasks.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                      Incoming Tasks ({pendingTasks.length})
                    </Text>
                    {pendingTasks.map((task) => (
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
                        <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.primary }]} onPress={() => handleAccept(task)}>
                          <AppIcon name="add-circle" size={16} color="#fff" />
                          <Text style={styles.acceptBtnText}>Add to My Tasks</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}

                {!isOwner && (
                  <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.primary }]} onPress={() => setShowDelegate(true)}>
                    <AppIcon name="paper-plane" size={20} color="#fff" />
                    <Text style={styles.bigBtnText}>Send Task to Owner</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* MEMBERS TAB */}
            {activeTab === "members" && isOwner && (
              <>
                <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAddMember(true)}>
                  <AppIcon name="person-add" size={20} color="#fff" />
                  <Text style={styles.bigBtnText}>Add Team Member</Text>
                </TouchableOpacity>

                {teamMembers.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <AppIcon name="people" size={28} color={colors.mutedForeground} />
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No team members yet. Add your first team member above.</Text>
                  </View>
                ) : (
                  teamMembers.map((m, i) => (
                    <View key={i} style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.memberCardTop}>
                        <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                          <Text style={[styles.avatarText, { color: colors.primary }]}>{m.name[0].toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.memberName, { color: colors.foreground }]}>{m.name}</Text>
                          <Text style={[styles.memberSub, { color: colors.mutedForeground }]}>{m.email}</Text>
                        </View>
                        <View style={[styles.roleBadge, { backgroundColor: colors.muted }]}>
                          <Text style={[styles.roleText, { color: colors.mutedForeground }]}>{m.role}</Text>
                        </View>
                      </View>
                      <View style={styles.memberStats}>
                        <View style={styles.statItem}>
                          <Text style={[styles.statValue, { color: colors.foreground }]}>{getMemberTaskCount(m.email)}</Text>
                          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Tasks</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={[styles.statValue, { color: "#10b981" }]}>{getMemberDoneCount(m.email)}</Text>
                          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Done</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={[styles.statValue, { color: colors.foreground }]}>{formatDuration(getMemberTimeTotal(m.email))}</Text>
                          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Logged</Text>
                        </View>
                      </View>
                      <View style={styles.memberActions}>
                        <TouchableOpacity
                          style={[styles.smallBtn, { backgroundColor: colors.muted }]}
                          onPress={() => copyToClipboard(`Team Portal Login:\nEmail: ${m.email}\nPassword: ${m.password}\nLink: ${portalUrl}`, m.email)}
                        >
                          <AppIcon name={copiedEmail === m.email ? "checkmark" : "share"} size={14} color={colors.primary} />
                          <Text style={[styles.smallBtnText, { color: colors.primary }]}>{copiedEmail === m.email ? "Copied!" : "Share Login"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.smallBtn, { backgroundColor: "#fee2e2" }]}
                          onPress={() => handleRemoveMember(m.email)}
                        >
                          <AppIcon name="trash" size={14} color="#ef4444" />
                          <Text style={[styles.smallBtnText, { color: "#ef4444" }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {/* TASKS TAB */}
            {activeTab === "tasks" && isOwner && (
              <>
                <View style={styles.taskActions}>
                  <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={() => { setDelegateFromApp(false); setShowDelegate(true); }}>
                    <AppIcon name="add-circle" size={18} color="#fff" />
                    <Text style={styles.bigBtnText}>New Task</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, flex: 1 }]} onPress={openDelegateFromApp}>
                    <AppIcon name="arrow-forward" size={18} color={colors.primary} />
                    <Text style={[styles.bigBtnText, { color: colors.foreground }]}>From My Tasks</Text>
                  </TouchableOpacity>
                </View>

                {teamTasks.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <AppIcon name="clipboard" size={28} color={colors.mutedForeground} />
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No delegated tasks yet.</Text>
                  </View>
                ) : (
                  teamTasks.map((task) => {
                    const member = teamMembers.find((m) => m.email.toLowerCase() === task.assignedTo.toLowerCase());
                    const taskTime = timeEntries.filter((e) => e.taskId === task.id && e.duration).reduce((s, e) => s + (e.duration || 0), 0);
                    return (
                      <View key={task.id} style={[styles.teamTaskCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.teamTaskTop}>
                          <View style={[styles.pPriority, { backgroundColor: PRIORITY_COLOR[task.priority] + "22" }]}>
                            <View style={[styles.pDot, { backgroundColor: PRIORITY_COLOR[task.priority] }]} />
                            <Text style={[styles.pPriorityText, { color: PRIORITY_COLOR[task.priority] }]}>{task.priority}</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[task.status] + "22" }]}>
                            <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[task.status] }]}>{STATUS_LABEL[task.status] || task.status}</Text>
                          </View>
                        </View>
                        <Text style={[styles.pTitle, { color: colors.foreground }]}>{task.title}</Text>
                        {task.description ? <Text style={[styles.pDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{task.description}</Text> : null}
                        <View style={[styles.teamTaskFooter, { borderTopColor: colors.border }]}>
                          <View style={styles.assignedTo}>
                            <View style={[styles.miniAvatar, { backgroundColor: colors.primary + "22" }]}>
                              <Text style={[styles.miniAvatarText, { color: colors.primary }]}>{(member?.name || "?")[0].toUpperCase()}</Text>
                            </View>
                            <Text style={[styles.assignedName, { color: colors.mutedForeground }]}>{member?.name || task.assignedTo}</Text>
                          </View>
                          {taskTime > 0 && (
                            <Text style={[styles.taskTime, { color: colors.mutedForeground }]}>
                              <AppIcon name="time" size={12} color={colors.mutedForeground} /> {formatDuration(taskTime)}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}

            {/* TIME TAB */}
            {activeTab === "time" && isOwner && (
              <>
                {timeEntries.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <AppIcon name="time" size={28} color={colors.mutedForeground} />
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No time logged by team members yet.</Text>
                  </View>
                ) : (
                  <>
                    <View style={[styles.timeOverview, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.sectionLabel, { color: colors.foreground, marginBottom: 8 }]}>Team Time Summary</Text>
                      {teamMembers.map((m) => {
                        const total = getMemberTimeTotal(m.email);
                        return (
                          <View key={m.email} style={[styles.timeRow, { borderBottomColor: colors.border }]}>
                            <View style={styles.timeRowLeft}>
                              <View style={[styles.miniAvatar, { backgroundColor: colors.primary + "22" }]}>
                                <Text style={[styles.miniAvatarText, { color: colors.primary }]}>{m.name[0].toUpperCase()}</Text>
                              </View>
                              <Text style={[styles.timeRowName, { color: colors.foreground }]}>{m.name}</Text>
                            </View>
                            <Text style={[styles.timeRowValue, { color: total > 0 ? colors.foreground : colors.mutedForeground }]}>
                              {total > 0 ? formatDuration(total) : "0m"}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Recent Entries</Text>
                    {timeEntries
                      .filter((e) => e.duration)
                      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                      .slice(0, 20)
                      .map((entry) => {
                        const task = teamTasks.find((t) => t.id === entry.taskId);
                        return (
                          <View key={entry.id} style={[styles.timeEntryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.timeEntryTop}>
                              <Text style={[styles.timeEntryMember, { color: colors.foreground }]}>{entry.memberName}</Text>
                              <Text style={[styles.timeEntryDuration, { color: colors.primary }]}>{formatDuration(entry.duration || 0)}</Text>
                            </View>
                            <Text style={[styles.timeEntryTask, { color: colors.mutedForeground }]} numberOfLines={1}>
                              {task?.title || "Unknown task"}
                            </Text>
                            <Text style={[styles.timeEntryDate, { color: colors.mutedForeground }]}>
                              {new Date(entry.startedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} · {new Date(entry.startedAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                          </View>
                        );
                      })}
                  </>
                )}
              </>
            )}

            <TouchableOpacity style={[styles.leaveBtn, { borderColor: "#ef4444" }]} onPress={handleLeave}>
              <Text style={styles.leaveBtnText}>Leave Workspace</Text>
            </TouchableOpacity>
          </>
        )}
        {error !== "" && <Text style={[styles.errorText, { color: "#ef4444" }]}>{error}</Text>}
      </View>

      <BottomSheet visible={showJoin} onClose={() => setShowJoin(false)} title="Join a Workspace">
        <Text style={[styles.sheetDesc, { color: colors.mutedForeground }]}>Enter the 6-character code shared by the workspace owner.</Text>
        <FormField label="Workspace Code" placeholder="e.g., ABC123" value={joinCode} onChangeText={(t) => setJoinCode(t.toUpperCase())} autoCapitalize="characters" autoFocus />
        <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.primary }]} onPress={handleJoin}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigBtnText}>Join Workspace</Text>}
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={showAddMember} onClose={() => setShowAddMember(false)} title="Add Team Member">
        <Text style={[styles.sheetDesc, { color: colors.mutedForeground }]}>
          Add a member and share their auto-generated login. They'll use the Team Portal to view tasks, track time, and update progress.
        </Text>
        <FormField label="Name *" placeholder="e.g., John Smith" value={memberName} onChangeText={setMemberName} autoFocus />
        <FormField label="Email *" placeholder="e.g., john@example.com" value={memberEmail} onChangeText={setMemberEmail} keyboardType="email-address" autoCapitalize="none" />
        <Text style={[styles.prioLabel, { color: colors.mutedForeground }]}>Role</Text>
        <View style={styles.prioRow}>
          {["member", "lead", "contractor"].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.prioChip, { backgroundColor: memberRole === r ? colors.primary : colors.muted }]}
              onPress={() => setMemberRole(r)}
            >
              <Text style={[styles.prioChipText, { color: memberRole === r ? "#fff" : colors.foreground }]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.primary }]} onPress={handleAddTeamMember}>
          {loading ? <ActivityIndicator color="#fff" /> : <>
            <AppIcon name="person-add" size={18} color="#fff" />
            <Text style={styles.bigBtnText}>Add Member</Text>
          </>}
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={showDelegate} onClose={() => { setShowDelegate(false); setDelegateFromApp(false); setSelectedAppTask(null); }} title={delegateFromApp ? "Delegate App Task" : (isOwner ? "Delegate Task" : "Send Task to Owner")}>
        <Text style={[styles.sheetDesc, { color: colors.mutedForeground }]}>
          {isOwner
            ? "Assign a task to a team member. They'll see it in their Team Portal."
            : "This task will appear in the workspace owner's incoming tasks list."}
        </Text>

        {delegateFromApp && !selectedAppTask && (
          <ScrollView style={{ maxHeight: 200, marginBottom: 12 }} nestedScrollEnabled>
            {appTasks.filter((t) => t.status !== "done").map((t) => (
              <TouchableOpacity key={t.id} style={[styles.appTaskRow, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => selectAppTask(t)}>
                <Text style={[styles.appTaskTitle, { color: colors.foreground }]}>{t.title}</Text>
                <View style={[styles.pPriority, { backgroundColor: PRIORITY_COLOR[t.priority] + "22" }]}>
                  <Text style={[styles.pPriorityText, { color: PRIORITY_COLOR[t.priority] }]}>{t.priority}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {(!delegateFromApp || selectedAppTask) && (
          <>
            <FormField label="Task Title *" placeholder="What needs to be done?" value={delegateTitle} onChangeText={setDelegateTitle} autoFocus={!delegateFromApp} />
            <FormField label="Details" placeholder="Any extra context..." value={delegateDesc} onChangeText={setDelegateDesc} multiline numberOfLines={2} />
            <Text style={[styles.prioLabel, { color: colors.mutedForeground }]}>Priority</Text>
            <View style={styles.prioRow}>
              {(["low", "medium", "high"] as const).map((p) => (
                <TouchableOpacity key={p} style={[styles.prioChip, { backgroundColor: delegatePriority === p ? PRIORITY_COLOR[p] : colors.muted }]} onPress={() => setDelegatePriority(p)}>
                  <Text style={[styles.prioChipText, { color: delegatePriority === p ? "#fff" : colors.foreground }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {isOwner && teamMembers.length > 0 && (
              <>
                <Text style={[styles.prioLabel, { color: colors.mutedForeground }]}>Assign To</Text>
                <View style={[styles.prioRow, { flexWrap: "wrap" }]}>
                  <TouchableOpacity
                    style={[styles.prioChip, { backgroundColor: !delegateToEmail ? colors.primary : colors.muted }]}
                    onPress={() => setDelegateToEmail("")}
                  >
                    <Text style={[styles.prioChipText, { color: !delegateToEmail ? "#fff" : colors.foreground }]}>Unassigned</Text>
                  </TouchableOpacity>
                  {teamMembers.map((m) => (
                    <TouchableOpacity
                      key={m.email}
                      style={[styles.prioChip, { backgroundColor: delegateToEmail === m.email ? colors.primary : colors.muted }]}
                      onPress={() => setDelegateToEmail(m.email)}
                    >
                      <Text style={[styles.prioChipText, { color: delegateToEmail === m.email ? "#fff" : colors.foreground }]}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.primary }]} onPress={handleDelegate}>
              {loading ? <ActivityIndicator color="#fff" /> : <>
                <AppIcon name="paper-plane" size={18} color="#fff" />
                <Text style={styles.bigBtnText}>{isOwner ? "Delegate Task" : "Send Task"}</Text>
              </>}
            </TouchableOpacity>
          </>
        )}
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
  tabRow: { flexDirection: "row", gap: 6 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: "transparent" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  quickActions: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1, paddingVertical: 14 },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  credBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  credBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  credCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  credHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  credName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  credRole: { fontSize: 12, fontFamily: "Inter_400Regular", textTransform: "capitalize" },
  credDetail: { borderRadius: 10, padding: 12, gap: 6 },
  credRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  credLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  credValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  copyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  copyBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  sectionLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
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
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  memberCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  memberCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  memberName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  memberSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  memberStats: { flexDirection: "row", gap: 8 },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.03)" },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  memberActions: { flexDirection: "row", gap: 8 },
  smallBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  smallBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  taskActions: { flexDirection: "row", gap: 10 },
  teamTaskCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  teamTaskTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  teamTaskFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  assignedTo: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  miniAvatarText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  assignedName: { fontSize: 12, fontFamily: "Inter_400Regular" },
  taskTime: { fontSize: 12, fontFamily: "Inter_500Medium" },
  timeOverview: { borderRadius: 14, borderWidth: 1, padding: 14 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  timeRowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeRowName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  timeRowValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  timeEntryCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  timeEntryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timeEntryMember: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  timeEntryDuration: { fontSize: 14, fontFamily: "Inter_700Bold" },
  timeEntryTask: { fontSize: 12, fontFamily: "Inter_400Regular" },
  timeEntryDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  appTaskRow: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  appTaskTitle: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
});
