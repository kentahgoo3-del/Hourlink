import { AppIcon } from "@/components/AppIcon";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/BottomSheet";
import { ClientBadge } from "@/components/ClientBadge";
import { ClientDropdown } from "@/components/ClientDropdown";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { TimerWidget } from "@/components/TimerWidget";
import { WheelPicker } from "@/components/WheelPicker";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { TimeEntry } from "@/context/AppContext";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-ZA", { weekday: "short", month: "short", day: "numeric" });
}

function TimeEntryCard({ entry, onPress, onDelete }: { entry: TimeEntry; onPress: () => void; onDelete: () => void }) {
  const colors = useColors();
  const { clients, settings } = useApp();
  const client = clients.find((c) => c.id === entry.clientId);
  const earned = entry.endTime ? ((entry.durationSeconds / 3600) * entry.hourlyRate).toFixed(0) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.entryCard, { backgroundColor: colors.card, borderColor: entry.billable && !entry.invoiceId ? colors.warning + "60" : colors.border }]}
    >
      <View style={styles.entryTop}>
        <View style={styles.entryLeft}>
          {client && <ClientBadge name={client.name} color={client.color} size="sm" />}
          <View style={styles.entryMeta}>
            <Text style={[styles.entryDesc, { color: colors.foreground }]} numberOfLines={1}>
              {entry.description || "No description"}
            </Text>
            <Text style={[styles.entrySub, { color: colors.mutedForeground }]}>
              {client?.name || "No client"} · {formatTime(entry.startTime)}
              {entry.endTime ? ` – ${formatTime(entry.endTime)}` : " · Running"}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <AppIcon name="trash-outline" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <View style={styles.entryBottom}>
        <View style={[styles.durBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.durText, { color: colors.foreground }]}>{formatDuration(entry.durationSeconds)}</Text>
        </View>
        {earned !== null && (
          <Text style={[styles.earnedText, { color: "#10b981" }]}>{settings.currency}{earned}</Text>
        )}
        {!entry.billable && (
          <View style={[styles.tagBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.tagText, { color: colors.mutedForeground }]}>Non-billable</Text>
          </View>
        )}
        {entry.billable && !entry.invoiceId && (
          <View style={[styles.tagBadge, { backgroundColor: colors.warning + "20" }]}>
            <AppIcon name="alert-circle-outline" size={12} color={colors.warning} />
            <Text style={[styles.tagText, { color: colors.warning }]}>Unbilled</Text>
          </View>
        )}
        {entry.invoiceId && (
          <View style={[styles.tagBadge, { backgroundColor: "#10b98118" }]}>
            <AppIcon name="checkmark-circle-outline" size={12} color="#10b981" />
            <Text style={[styles.tagText, { color: "#10b981" }]}>Invoiced</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function WorkScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    clients, timeEntries, activeTimers, tasks,
    startTimer, stopTimer, pauseTimer, resumeTimer,
    deleteTimeEntry, addInvoice, updateTimeEntry, settings, companyProfile,
    addTaskComment, getTaskComments, getEntryComments,
  } = useApp();

  const runningTimer = activeTimers.find((t) => !t.timerPaused) || null;
  const activeTimer = runningTimer; // keep local alias for alert/misc compat

  const [showStart, setShowStart] = useState(false);
  const [showQuickInvoice, setShowQuickInvoice] = useState(false);
  const [showEntrySheet, setShowEntrySheet] = useState(false);
  const [showBatchSheet, setShowBatchSheet] = useState(false);
  const [stoppedEntry, setStoppedEntry] = useState<TimeEntry | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [desc, setDesc] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || "");
  const [billable, setBillable] = useState(true);
  const [filter, setFilter] = useState<"all" | "billable" | "unbilled" | "archived">("all");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [entryCommentText, setEntryCommentText] = useState("");

  // Timer alert
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const alertDismissedUntilRef = useRef<number>(0);
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Edit entry time
  const [showEditTime, setShowEditTime] = useState(false);
  const [editHour, setEditHour] = useState(0);
  const [editMinute, setEditMinute] = useState(0);
  const [editDurationPreview, setEditDurationPreview] = useState<string | null>(null);

  // Smart alert: update elapsed time every 30s
  useEffect(() => {
    if (!activeTimer) { setElapsedMinutes(0); return; }
    const update = () => {
      const mins = Math.floor((Date.now() - new Date(activeTimer.startTime).getTime()) / 60000);
      setElapsedMinutes(mins);
      if (Date.now() > alertDismissedUntilRef.current) setAlertDismissed(false);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [activeTimer]);

  const thresholdMinutes = (settings.timerAlertThresholdHours ?? 2) * 60;
  const showTimerAlert = !!activeTimer && elapsedMinutes >= thresholdMinutes && !alertDismissed;

  const dismissAlert = () => {
    alertDismissedUntilRef.current = Date.now() + 60 * 60 * 1000;
    setAlertDismissed(true);
  };

  // Compute edit preview whenever hour/minute changes
  useEffect(() => {
    if (!selectedEntry) { setEditDurationPreview(null); return; }
    const start = new Date(selectedEntry.startTime);
    const end = new Date(selectedEntry.startTime);
    end.setHours(editHour, editMinute, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
    const secs = Math.floor((end.getTime() - start.getTime()) / 1000);
    if (secs <= 0) { setEditDurationPreview(null); return; }
    setEditDurationPreview(formatDuration(secs));
  }, [editHour, editMinute, selectedEntry]);

  const openEditTime = (entry: TimeEntry) => {
    const now = new Date();
    if (entry.endTime) {
      const d = new Date(entry.endTime);
      setEditHour(d.getHours());
      setEditMinute(d.getMinutes());
    } else {
      setEditHour(now.getHours());
      setEditMinute(now.getMinutes());
    }
    setEditDurationPreview(null);
    setShowEditTime(true);
  };

  const saveEditTime = () => {
    if (!selectedEntry || !editDurationPreview) return;
    const start = new Date(selectedEntry.startTime);
    const end = new Date(selectedEntry.startTime);
    end.setHours(editHour, editMinute, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
    const secs = Math.floor((end.getTime() - start.getTime()) / 1000);
    if (secs <= 0) return;
    updateTimeEntry(selectedEntry.id, { endTime: end.toISOString(), durationSeconds: secs });
    setSelectedEntry((prev) => prev ? { ...prev, endTime: end.toISOString(), durationSeconds: secs } : prev);
    setShowEditTime(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const archivedCount = useMemo(() => timeEntries.filter((e) => e.endTime && e.invoiceId).length, [timeEntries]);

  const filteredEntries = useMemo(() => {
    if (filter === "archived") {
      const q = archiveSearch.trim().toLowerCase();
      return timeEntries.filter((e) => {
        if (!e.endTime || !e.invoiceId) return false;
        if (!q) return true;
        const client = clients.find((c) => c.id === e.clientId);
        return (
          (e.description || "").toLowerCase().includes(q) ||
          (client?.name || "").toLowerCase().includes(q)
        );
      });
    }
    return timeEntries.filter((e) => e.endTime && !e.invoiceId).filter((e) => {
      if (filter === "billable") return e.billable;
      if (filter === "unbilled") return e.billable;
      return true;
    });
  }, [timeEntries, clients, filter, archiveSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const entry of filteredEntries) {
      const key = formatDate(entry.startTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries()).map(([date, entries]) => ({ date, entries }));
  }, [filteredEntries]);

  // Unbilled entries grouped by client for batch invoicing
  const unbilledByClient = useMemo(() => {
    const allUnbilled = timeEntries.filter((e) => e.billable && !e.invoiceId && e.endTime);
    const map = new Map<string, TimeEntry[]>();
    for (const e of allUnbilled) {
      if (!map.has(e.clientId)) map.set(e.clientId, []);
      map.get(e.clientId)!.push(e);
    }
    return Array.from(map.entries()).map(([clientId, entries]) => {
      const client = clients.find((c) => c.id === clientId);
      const totalSeconds = entries.reduce((s, e) => s + e.durationSeconds, 0);
      const totalAmount = entries.reduce((s, e) => s + (e.durationSeconds / 3600) * e.hourlyRate, 0);
      return { clientId, client, entries, totalSeconds, totalAmount };
    });
  }, [timeEntries, clients]);

  const handleStop = (id?: string) => {
    const timer = id ? activeTimers.find((t) => t.id === id) : runningTimer;
    const completed = stopTimer(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (timer && timer.billable) {
      if (completed) {
        setStoppedEntry(completed);
      } else {
        const nowMs = Date.now();
        const totalSecs = (timer.pausedSeconds || 0) + (timer.timerPaused ? 0 :
          Math.floor((nowMs - new Date(timer.sessionStartTime || timer.startTime).getTime()) / 1000));
        setStoppedEntry({ ...timer, endTime: new Date().toISOString(), durationSeconds: totalSecs });
      }
      setShowQuickInvoice(true);
    }
  };

  const buildInvoiceItems = (entries: TimeEntry[]) =>
    entries.map((e) => ({
      id: Date.now().toString() + Math.random(),
      description: e.description || "Professional services",
      quantity: parseFloat((e.durationSeconds / 3600).toFixed(2)),
      unitPrice: e.hourlyRate,
    }));

  const handleQuickInvoice = () => {
    if (!stoppedEntry) return;
    const hours = stoppedEntry.durationSeconds / 3600;
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
    const invoiceId = addInvoice({
      clientId: stoppedEntry.clientId,
      title: stoppedEntry.description || "Time tracking invoice",
      items: [{ id: Date.now().toString(), description: stoppedEntry.description || "Professional services", quantity: parseFloat(hours.toFixed(2)), unitPrice: stoppedEntry.hourlyRate }],
      notes: companyProfile.paymentTerms || "",
      taxPercent: settings.defaultTaxPercent,
      status: "draft",
      dueDate: dueDate.toISOString(),
      paidAt: null,
      quoteId: null,
    });
    // Link the time entry to the invoice - use a small delay to ensure stopTimer() has saved it
    setTimeout(() => updateTimeEntry(stoppedEntry.id, { invoiceId }), 100);
    setShowQuickInvoice(false);
    setStoppedEntry(null);
    router.push({ pathname: "/invoice/[id]", params: { id: invoiceId } });
  };

  // Create invoice for any single unbilled entry (from the entry detail sheet)
  const handleCreateInvoiceForEntry = (entry: TimeEntry) => {
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
    const invoiceId = addInvoice({
      clientId: entry.clientId,
      title: entry.description || "Time tracking invoice",
      items: buildInvoiceItems([entry]),
      notes: companyProfile.paymentTerms || "",
      taxPercent: settings.defaultTaxPercent,
      status: "draft",
      dueDate: dueDate.toISOString(),
      paidAt: null,
      quoteId: null,
    });
    updateTimeEntry(entry.id, { invoiceId });
    setShowEntrySheet(false);
    setSelectedEntry(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/invoice/[id]", params: { id: invoiceId } });
  };

  // Create one invoice for ALL unbilled entries for a client
  const handleBatchInvoiceForClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    const entries = unbilledByClient.find((g) => g.clientId === clientId)?.entries ?? [];
    if (entries.length === 0) return;
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
    const invoiceId = addInvoice({
      clientId,
      title: `Services for ${client?.name || "Client"}`,
      items: buildInvoiceItems(entries),
      notes: companyProfile.paymentTerms || "",
      taxPercent: settings.defaultTaxPercent,
      status: "draft",
      dueDate: dueDate.toISOString(),
      paidAt: null,
      quoteId: null,
    });
    for (const e of entries) updateTimeEntry(e.id, { invoiceId });
    setShowBatchSheet(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/invoice/[id]", params: { id: invoiceId } });
  };

  const handleResume = () => {
    if (!stoppedEntry) return;
    startTimer({
      clientId: stoppedEntry.clientId,
      taskId: stoppedEntry.taskId ?? null,
      description: stoppedEntry.description,
      hourlyRate: stoppedEntry.hourlyRate,
      billable: stoppedEntry.billable,
      resumeEntryId: stoppedEntry.id,
    });
    setShowQuickInvoice(false);
    setStoppedEntry(null);
  };

  const handleInvoiceLater = () => {
    setShowQuickInvoice(false);
    setStoppedEntry(null);
  };

  const handleStartTimer = () => {
    const client = clients.find((c) => c.id === selectedClientId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startTimer({
      clientId: selectedClientId || "",
      projectId: "",
      taskId: null,
      description: desc.trim() || "Work session",
      hourlyRate: client?.hourlyRate ?? settings.defaultHourlyRate,
      billable,
    });
    setShowStart(false);
    setDesc("");
  };

  const entryClient = selectedEntry ? clients.find((c) => c.id === selectedEntry.clientId) : null;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Time Tracking</Text>
        <View style={styles.headerRight}>
          {unbilledByClient.length > 0 && (
            <TouchableOpacity
              style={[styles.batchBtn, { backgroundColor: colors.warning + "20", borderColor: colors.warning + "60" }]}
              onPress={() => setShowBatchSheet(true)}
            >
              <AppIcon name="receipt-outline" size={14} color={colors.warning} />
              <Text style={[styles.batchBtnText, { color: colors.warning }]}>
                Batch Invoice
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowStart(true)}
            testID="start-timer-btn"
          >
            <AppIcon name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {activeTimers.length > 0 && (
        <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 0 }}>
          {activeTimers.map((timer) => (
            <TimerWidget
              key={timer.id}
              timer={timer}
              onStop={() => handleStop(timer.id)}
              onPause={() => { pauseTimer(timer.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              onResume={() => { resumeTimer(timer.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            />
          ))}
        </View>
      )}

      {/* Smart Timer Alert Banner */}
      {showTimerAlert && (
        <View style={[alertStyles.banner, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "50" }]}>
          <AppIcon name="alert-circle-outline" size={20} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={[alertStyles.bannerTitle, { color: colors.warning }]}>
              Timer running for {elapsedMinutes >= 60 ? `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m` : `${elapsedMinutes}m`}
            </Text>
            <Text style={[alertStyles.bannerSub, { color: colors.warning + "cc" }]}>Are you still working?</Text>
          </View>
          <TouchableOpacity
            style={[alertStyles.alertBtn, { backgroundColor: colors.warning + "25", borderColor: colors.warning + "60" }]}
            onPress={dismissAlert}
          >
            <Text style={[alertStyles.alertBtnText, { color: colors.warning }]}>Still Working</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[alertStyles.alertBtn, { backgroundColor: colors.warning, borderColor: colors.warning }]}
            onPress={() => { dismissAlert(); handleStop(runningTimer?.id); }}
          >
            <Text style={[alertStyles.alertBtnText, { color: "#fff" }]}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {(["all", "billable", "unbilled", "archived"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => { setFilter(f); setArchiveSearch(""); }}
          >
            <Text style={[styles.filterLabel, { color: filter === f ? colors.primary : colors.mutedForeground }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
            {f === "unbilled" && unbilledByClient.reduce((s, g) => s + g.entries.length, 0) > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.warning }]}>
                <Text style={styles.filterBadgeText}>
                  {unbilledByClient.reduce((s, g) => s + g.entries.length, 0)}
                </Text>
              </View>
            )}
            {f === "archived" && archivedCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.mutedForeground }]}>
                <Text style={styles.filterBadgeText}>{archivedCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Archive search bar */}
      {filter === "archived" && (
        <View style={[styles.archiveSearchRow, { backgroundColor: colors.muted, borderBottomColor: colors.border }]}>
          <AppIcon name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.archiveSearchInput, { color: colors.foreground }]}
            placeholder="Search by client or description…"
            placeholderTextColor={colors.mutedForeground}
            value={archiveSearch}
            onChangeText={setArchiveSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {archiveSearch.length > 0 && (
            <TouchableOpacity onPress={() => setArchiveSearch("")}>
              <AppIcon name="close-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Unbilled summary banner */}
      {filter === "unbilled" && unbilledByClient.length > 0 && (
        <View style={[styles.unbilledBanner, { backgroundColor: colors.warning + "12", borderBottomColor: colors.warning + "30" }]}>
          <AppIcon name="information-circle-outline" size={16} color={colors.warning} />
          <Text style={[styles.unbilledBannerText, { color: colors.warning }]}>
            Tap an entry to invoice it, or use Batch Invoice to group multiple entries.
          </Text>
        </View>
      )}

      {grouped.length === 0 ? (
        <EmptyState
          icon={filter === "archived" ? "archive-outline" : "time-outline"}
          title={filter === "archived" ? (archiveSearch ? "No results" : "No archived entries") : filter === "unbilled" ? "All caught up!" : "No time entries"}
          description={
            filter === "archived"
              ? archiveSearch
                ? "Try a different client name or description."
                : "Invoiced entries will appear here."
              : filter === "unbilled"
              ? "No unbilled time. Great work staying on top of your billing!"
              : activeTimers.length > 0
              ? "Timer is running."
              : "Start tracking your work time."
          }
          actionLabel={filter === "archived" || activeTimers.length > 0 || filter === "unbilled" ? undefined : "Start Timer"}
          onAction={filter === "archived" || activeTimers.length > 0 || filter === "unbilled" ? undefined : () => setShowStart(true)}
        />
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupDate, { color: colors.mutedForeground }]}>{item.date}</Text>
                <Text style={[styles.groupTotal, { color: colors.mutedForeground }]}>
                  {formatDuration(item.entries.reduce((s, e) => s + e.durationSeconds, 0))} ·{" "}
                  {settings.currency}{item.entries.filter(e => e.billable).reduce((s, e) => s + (e.durationSeconds / 3600) * e.hourlyRate, 0).toFixed(0)}
                </Text>
              </View>
              {item.entries.map((entry) => (
                <TimeEntryCard
                  key={entry.id}
                  entry={entry}
                  onPress={() => { setSelectedEntry(entry); setShowEntrySheet(true); }}
                  onDelete={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPendingDeleteEntryId(entry.id); }}
                />
              ))}
            </View>
          )}
        />
      )}

      {/* Timer Stopped Modal */}
      <Modal visible={showQuickInvoice} transparent animationType="fade" onRequestClose={handleInvoiceLater}>
        <View style={styles.modalOverlay}>
          <View style={[styles.quickInvCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.quickInvIcon, { backgroundColor: colors.primary + "20" }]}>
              <AppIcon name="timer-outline" size={30} color={colors.primary} />
            </View>
            <Text style={[styles.quickInvTitle, { color: colors.foreground }]}>Timer Stopped</Text>

            {stoppedEntry && (
              <View style={[styles.summaryPill, { backgroundColor: colors.muted }]}>
                <Text style={[styles.summaryTime, { color: colors.foreground }]}>
                  {formatDuration(stoppedEntry.durationSeconds)}
                </Text>
                <View style={[styles.summaryDot, { backgroundColor: colors.border }]} />
                <Text style={[styles.summaryAmount, { color: "#10b981" }]}>
                  {settings.currency}{((stoppedEntry.durationSeconds / 3600) * stoppedEntry.hourlyRate).toFixed(0)}
                </Text>
              </View>
            )}

            {stoppedEntry?.description ? (
              <Text style={[styles.quickInvDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                {stoppedEntry.description}
              </Text>
            ) : null}

            <View style={[styles.noteInputBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <AppIcon name="create-outline" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[styles.noteInput, { color: colors.foreground }]}
                placeholder="Leave a note for next time..."
                placeholderTextColor={colors.mutedForeground}
                value={noteText}
                onChangeText={setNoteText}
                multiline
              />
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (noteText.trim() && stoppedEntry) {
                  const taskId = stoppedEntry.taskId || stoppedEntry.id;
                  addTaskComment({
                    taskId,
                    timeEntryId: stoppedEntry.id,
                    authorName: settings.name || "Me",
                    text: noteText.trim(),
                  });
                  setNoteText("");
                }
                handleQuickInvoice();
              }}
              testID="quick-invoice-now"
            >
              <AppIcon name="document-text-outline" size={18} color="#fff" />
              <Text style={[styles.actionRowText, { color: "#fff" }]}>Invoice Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.muted }]}
              onPress={() => {
                if (noteText.trim() && stoppedEntry) {
                  const taskId = stoppedEntry.taskId || stoppedEntry.id;
                  addTaskComment({
                    taskId,
                    timeEntryId: stoppedEntry.id,
                    authorName: settings.name || "Me",
                    text: noteText.trim(),
                  });
                  setNoteText("");
                }
                handleResume();
              }}
              testID="resume-timer"
            >
              <AppIcon name="play-outline" size={18} color={colors.foreground} />
              <Text style={[styles.actionRowText, { color: colors.foreground }]}>Resume Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionRowOutline, { borderColor: colors.border }]}
              onPress={() => {
                if (noteText.trim() && stoppedEntry) {
                  const taskId = stoppedEntry.taskId || stoppedEntry.id;
                  addTaskComment({
                    taskId,
                    timeEntryId: stoppedEntry.id,
                    authorName: settings.name || "Me",
                    text: noteText.trim(),
                  });
                  setNoteText("");
                }
                handleInvoiceLater();
              }}
              testID="invoice-later"
            >
              <AppIcon name="time-outline" size={18} color={colors.mutedForeground} />
              <Text style={[styles.actionRowText, { color: colors.mutedForeground }]}>Invoice Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Entry Detail Sheet */}
      <BottomSheet
        visible={showEntrySheet}
        onClose={() => { setShowEntrySheet(false); setSelectedEntry(null); }}
        title="Time Entry"
      >
        {selectedEntry && (
          <>
            {/* Entry summary card */}
            <View style={[styles.entryDetailCard, { backgroundColor: colors.muted, borderRadius: colors.cr }]}>
              {entryClient && (
                <View style={{ marginBottom: 10 }}>
                  <ClientBadge name={entryClient.name} color={entryClient.color} size="sm" />
                </View>
              )}
              <Text style={[styles.entryDetailDesc, { color: colors.foreground }]}>
                {selectedEntry.description || "No description"}
              </Text>
              <View style={styles.entryDetailRow}>
                <View style={styles.entryDetailStat}>
                  <Text style={[styles.entryDetailStatLabel, { color: colors.mutedForeground }]}>DURATION</Text>
                  <Text style={[styles.entryDetailStatValue, { color: colors.foreground }]}>
                    {formatDuration(selectedEntry.durationSeconds)}
                  </Text>
                </View>
                <View style={[styles.entryDetailDivider, { backgroundColor: colors.border }]} />
                <View style={styles.entryDetailStat}>
                  <Text style={[styles.entryDetailStatLabel, { color: colors.mutedForeground }]}>RATE</Text>
                  <Text style={[styles.entryDetailStatValue, { color: colors.foreground }]}>
                    {settings.currency}{selectedEntry.hourlyRate}/h
                  </Text>
                </View>
                <View style={[styles.entryDetailDivider, { backgroundColor: colors.border }]} />
                <View style={styles.entryDetailStat}>
                  <Text style={[styles.entryDetailStatLabel, { color: colors.mutedForeground }]}>EARNED</Text>
                  <Text style={[styles.entryDetailStatValue, { color: "#10b981" }]}>
                    {settings.currency}{((selectedEntry.durationSeconds / 3600) * selectedEntry.hourlyRate).toFixed(0)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.entryDetailDate, { color: colors.mutedForeground }]}>
                {new Date(selectedEntry.startTime).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}
                {" · "}{formatTime(selectedEntry.startTime)}
                {selectedEntry.endTime ? ` – ${formatTime(selectedEntry.endTime)}` : " · Running"}
              </Text>
            </View>

            {/* Edit Time button */}
            <TouchableOpacity
              style={[alertStyles.editTimeBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => openEditTime(selectedEntry)}
            >
              <AppIcon name="pencil" size={15} color={colors.primary} />
              <Text style={[alertStyles.editTimeBtnText, { color: colors.primary }]}>Correct End Time</Text>
            </TouchableOpacity>

            <View style={{ height: 8 }} />

            {/* Status */}
            {!selectedEntry.billable && (
              <View style={[styles.statusBanner, { backgroundColor: colors.muted }]}>
                <AppIcon name="information-circle-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.statusBannerText, { color: colors.mutedForeground }]}>This entry is non-billable.</Text>
              </View>
            )}

            {selectedEntry.billable && selectedEntry.invoiceId && (
              <>
                <View style={[styles.statusBanner, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
                  <AppIcon name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={[styles.statusBannerText, { color: "#065f46" }]}>Already linked to an invoice.</Text>
                </View>
                <TouchableOpacity
                  style={[styles.sheetBtn, { backgroundColor: colors.primary }]}
                  onPress={() => { setShowEntrySheet(false); router.push({ pathname: "/invoice/[id]", params: { id: selectedEntry.invoiceId! } }); }}
                >
                  <AppIcon name="document-text-outline" size={18} color="#fff" />
                  <Text style={styles.sheetBtnText}>View Invoice</Text>
                </TouchableOpacity>
              </>
            )}

            {selectedEntry.billable && !selectedEntry.invoiceId && (
              <>
                <View style={[styles.statusBanner, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "40" }]}>
                  <AppIcon name="alert-circle-outline" size={16} color={colors.warning} />
                  <Text style={[styles.statusBannerText, { color: colors.warning }]}>This entry hasn't been invoiced yet.</Text>
                </View>
                <TouchableOpacity
                  style={[styles.sheetBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleCreateInvoiceForEntry(selectedEntry)}
                >
                  <AppIcon name="document-text-outline" size={18} color="#fff" />
                  <Text style={styles.sheetBtnText}>Create Invoice for This Entry</Text>
                </TouchableOpacity>
                {/* Batch invoice shortcut if multiple unbilled for same client */}
                {(unbilledByClient.find((g) => g.clientId === selectedEntry.clientId)?.entries.length ?? 0) > 1 && (
                  <TouchableOpacity
                    style={[styles.sheetBtnOutline, { borderColor: colors.primary }]}
                    onPress={() => { setShowEntrySheet(false); setShowBatchSheet(true); }}
                  >
                    <AppIcon name="receipt-outline" size={18} color={colors.primary} />
                    <Text style={[styles.sheetBtnOutlineText, { color: colors.primary }]}>
                      Batch Invoice ({unbilledByClient.find((g) => g.clientId === selectedEntry.clientId)?.entries.length} entries)
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {(() => {
              const taskId = selectedEntry.taskId || selectedEntry.id;
              const comments = getTaskComments(taskId);
              const entryNotes = getEntryComments(selectedEntry.id);
              const allComments = [...new Map([...comments, ...entryNotes].map(c => [c.id, c])).values()]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              return (
                <View style={[cStyles.commentsSection, { borderTopColor: colors.border }]}>
                  <View style={cStyles.commentHeader}>
                    <AppIcon name="chatbubble-ellipses-outline" size={16} color={colors.foreground} />
                    <Text style={[cStyles.commentTitle, { color: colors.foreground }]}>Notes & Comments</Text>
                    <Text style={[cStyles.commentCount, { color: colors.mutedForeground }]}>({allComments.length})</Text>
                  </View>
                  {allComments.length === 0 ? (
                    <Text style={[cStyles.noComments, { color: colors.mutedForeground }]}>No notes yet. Add one to track your progress.</Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 160, marginBottom: 8 }}>
                      {allComments.map((c) => (
                        <View key={c.id} style={[cStyles.commentBubble, { backgroundColor: colors.primary + "10" }]}>
                          <View style={cStyles.commentBubbleTop}>
                            <Text style={[cStyles.commentAuthor, { color: colors.foreground }]}>{c.authorName}</Text>
                            <Text style={[cStyles.commentTime, { color: colors.mutedForeground }]}>
                              {new Date(c.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}{" "}
                              {new Date(c.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                          </View>
                          <Text style={[cStyles.commentBody, { color: colors.foreground }]}>{c.text}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                  <View style={cStyles.commentInputRow}>
                    <TextInput
                      style={[cStyles.commentInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                      placeholder="Add a note..."
                      placeholderTextColor={colors.mutedForeground}
                      value={entryCommentText}
                      onChangeText={setEntryCommentText}
                      multiline
                    />
                    <TouchableOpacity
                      style={[cStyles.commentSendBtn, { backgroundColor: entryCommentText.trim() ? colors.primary : colors.muted }]}
                      onPress={() => {
                        if (entryCommentText.trim()) {
                          addTaskComment({
                            taskId,
                            timeEntryId: selectedEntry.id,
                            authorName: settings.name || "Me",
                            text: entryCommentText.trim(),
                          });
                          setEntryCommentText("");
                        }
                      }}
                      disabled={!entryCommentText.trim()}
                    >
                      <AppIcon name="send" size={14} color={entryCommentText.trim() ? "#fff" : colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}

            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: colors.muted }]}
              onPress={() => {
                startTimer({
                  clientId: selectedEntry.clientId,
                  taskId: selectedEntry.taskId ?? null,
                  description: selectedEntry.description,
                  hourlyRate: selectedEntry.hourlyRate,
                  billable: selectedEntry.billable,
                  resumeEntryId: selectedEntry.id,
                });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowEntrySheet(false);
                setSelectedEntry(null);
              }}
            >
              <AppIcon name="play" size={18} color={colors.primary} />
              <Text style={[styles.sheetBtnText, { color: colors.primary }]}>Restart Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetBtnDanger, { borderColor: "#ef444440" }]}
              onPress={() => { setShowEntrySheet(false); setPendingDeleteEntryId(selectedEntry.id); }}
            >
              <AppIcon name="trash-outline" size={16} color="#ef4444" />
              <Text style={styles.sheetBtnDangerText}>Delete Entry</Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>

      {/* Batch Invoice Sheet */}
      <BottomSheet
        visible={showBatchSheet}
        onClose={() => setShowBatchSheet(false)}
        title="Batch Invoice"
      >
        <Text style={[styles.batchHint, { color: colors.mutedForeground }]}>
          Create one invoice per client covering all their unbilled time entries.
        </Text>
        {unbilledByClient.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <AppIcon name="checkmark-circle-outline" size={40} color="#10b981" />
            <Text style={[{ color: colors.mutedForeground, marginTop: 8, fontFamily: "Inter_500Medium", fontSize: 14 }]}>
              No unbilled time entries.
            </Text>
          </View>
        ) : (
          unbilledByClient.map((group) => (
            <View
              key={group.clientId}
              style={[styles.batchClientCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.cr }]}
            >
              <View style={styles.batchClientTop}>
                {group.client && <ClientBadge name={group.client.name} color={group.client.color} size="sm" />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.batchClientName, { color: colors.foreground }]}>
                    {group.client?.name || "Unknown Client"}
                  </Text>
                  <Text style={[styles.batchClientSub, { color: colors.mutedForeground }]}>
                    {group.entries.length} entr{group.entries.length === 1 ? "y" : "ies"} · {formatDuration(group.totalSeconds)}
                  </Text>
                </View>
                <Text style={[styles.batchClientAmount, { color: "#10b981" }]}>
                  {settings.currency}{group.totalAmount.toFixed(0)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.batchInvoiceBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleBatchInvoiceForClient(group.clientId)}
              >
                <AppIcon name="document-text-outline" size={15} color="#fff" />
                <Text style={styles.batchInvoiceBtnText}>Invoice All {group.entries.length} Entries</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </BottomSheet>

      <BottomSheet visible={showStart} onClose={() => setShowStart(false)} title="Start Timer">
        <FormField label="What are you working on?" placeholder="e.g., Website redesign, Client meeting" value={desc} onChangeText={setDesc} />
        <ClientDropdown
          clients={clients}
          value={selectedClientId}
          onChange={setSelectedClientId}
          label="Client"
          placeholder="Select a client"
        />
        <View style={styles.billableRow}>
          <Text style={[styles.billableLabel, { color: colors.foreground }]}>Billable</Text>
          <TouchableOpacity style={[styles.toggle, { backgroundColor: billable ? colors.primary : colors.muted }]} onPress={() => setBillable((v) => !v)}>
            <View style={[styles.toggleThumb, { transform: [{ translateX: billable ? 20 : 0 }] }]} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.primary }]} onPress={handleStartTimer} testID="confirm-start-timer">
          <AppIcon name="play" size={18} color="#fff" />
          <Text style={styles.startBtnText}>Start Timer</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Edit Time Modal */}
      <Modal visible={showEditTime} transparent animationType="fade" onRequestClose={() => setShowEditTime(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.quickInvCard, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
            <View style={[styles.quickInvIcon, { backgroundColor: colors.primary + "20", marginBottom: 8 }]}>
              <AppIcon name="pencil" size={26} color={colors.primary} />
            </View>
            <Text style={[styles.quickInvTitle, { color: colors.foreground, marginBottom: 4 }]}>Correct End Time</Text>
            {selectedEntry && (
              <Text style={[styles.quickInvDesc, { color: colors.mutedForeground, marginBottom: 16 }]}>
                Started at {formatTime(selectedEntry.startTime)} · Enter the actual end time below.
              </Text>
            )}

            <View style={alertStyles.timeRow}>
              <WheelPicker
                value={editHour}
                min={0}
                max={23}
                onChange={setEditHour}
                label="HOUR"
                colors={colors}
              />
              <Text style={[alertStyles.timeSep, { color: colors.foreground }]}>:</Text>
              <WheelPicker
                value={editMinute}
                min={0}
                max={59}
                onChange={setEditMinute}
                label="MINUTE"
                colors={colors}
              />
            </View>

            {editDurationPreview && (
              <View style={[alertStyles.durationPreview, { backgroundColor: "#10b98112", borderColor: "#10b98130" }]}>
                <AppIcon name="time-outline" size={14} color="#10b981" />
                <Text style={[alertStyles.durationPreviewText, { color: "#10b981" }]}>
                  New duration: {editDurationPreview}
                </Text>
              </View>
            )}

            <View style={[styles.divider, { marginVertical: 14 }]} />

            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: editDurationPreview ? colors.primary : colors.muted }]}
              onPress={saveEditTime}
              disabled={!editDurationPreview}
            >
              <AppIcon name="checkmark" size={18} color={editDurationPreview ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.actionRowText, { color: editDurationPreview ? "#fff" : colors.mutedForeground }]}>Save Correction</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionRowOutline, { borderColor: colors.border, marginTop: 8 }]}
              onPress={() => setShowEditTime(false)}
            >
              <Text style={[styles.actionRowText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!pendingDeleteEntryId}
        title="Delete Entry"
        message="Remove this time entry? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (pendingDeleteEntryId) deleteTimeEntry(pendingDeleteEntryId); setPendingDeleteEntryId(null); }}
        onCancel={() => setPendingDeleteEntryId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  batchBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  batchBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  filterRow: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20 },
  filterTab: { flex: 1, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  filterLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  filterBadge: { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: "center" },
  filterBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  unbilledBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  unbilledBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  group: { marginBottom: 20 },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  groupDate: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  groupTotal: { fontSize: 12, fontFamily: "Inter_500Medium" },
  entryCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  entryTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  entryLeft: { flex: 1, flexDirection: "row", gap: 10, alignItems: "center" },
  entryMeta: { flex: 1 },
  entryDesc: { fontSize: 14, fontFamily: "Inter_500Medium" },
  entrySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  entryBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  durBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  durText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  earnedText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tagBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  tagText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  billableRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  billableLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  toggle: { width: 48, height: 28, borderRadius: 14, justifyContent: "center", paddingHorizontal: 4 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  startBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  startBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  quickInvCard: { borderRadius: 20, borderWidth: 1, padding: 24, width: "100%", alignItems: "center", gap: 10 },
  quickInvIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  quickInvTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  quickInvDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 8 },
  summaryPill: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  summaryTime: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  summaryDot: { width: 4, height: 4, borderRadius: 2 },
  summaryAmount: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  divider: { height: 1, width: "100%", backgroundColor: "rgba(0,0,0,0.08)", marginVertical: 4 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, justifyContent: "center" },
  actionRowOutline: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, justifyContent: "center", borderWidth: 1 },
  actionRowText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  // Entry detail sheet
  entryDetailCard: { padding: 16 },
  entryDetailDesc: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 14 },
  entryDetailRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  entryDetailStat: { flex: 1, alignItems: "center" },
  entryDetailStatLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
  entryDetailStatValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  entryDetailDivider: { width: 1, height: 32 },
  entryDetailDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, borderColor: "transparent", padding: 12, marginBottom: 12 },
  statusBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  sheetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, marginBottom: 10 },
  sheetBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  sheetBtnOutline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, borderWidth: 1, marginBottom: 10 },
  sheetBtnOutlineText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sheetBtnDanger: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, borderWidth: 1, marginTop: 4 },
  sheetBtnDangerText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#ef4444" },
  // Batch sheet
  batchHint: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16, lineHeight: 18 },
  batchClientCard: { borderWidth: 1, padding: 14, marginBottom: 12 },
  batchClientTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  batchClientName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  batchClientSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  batchClientAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  batchInvoiceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 11 },
  batchInvoiceBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  noteInputBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, width: "100%", marginTop: 2 },
  noteInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 36, maxHeight: 60, textAlignVertical: "top" },
  archiveSearchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1 },
  archiveSearchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0 },
});

const alertStyles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginTop: 12, borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14 },
  bannerTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  bannerSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  alertBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  alertBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  editTimeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 14, marginTop: 12 },
  editTimeBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6, width: "100%", justifyContent: "center", marginBottom: 16 },
  timeField: { flex: 1, alignItems: "center" },
  timeLabel: { fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  timeInput: { width: "100%", borderRadius: 12, borderWidth: 1, fontSize: 28, fontFamily: "Inter_700Bold", paddingVertical: 12, paddingHorizontal: 8 },
  timeSep: { fontSize: 32, fontFamily: "Inter_700Bold", marginTop: 18, alignSelf: "center" },
  durationPreview: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, width: "100%" },
  durationPreviewText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

const cStyles = StyleSheet.create({
  commentsSection: { borderTopWidth: 1, paddingTop: 14, marginTop: 6, marginBottom: 12 },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  commentTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  commentCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  noComments: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 10 },
  commentBubble: { borderRadius: 10, padding: 10, marginBottom: 6 },
  commentBubbleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  commentAuthor: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  commentTime: { fontSize: 10, fontFamily: "Inter_400Regular" },
  commentBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  commentInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  commentInput: { flex: 1, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 36, maxHeight: 70, textAlignVertical: "top" },
  commentSendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
