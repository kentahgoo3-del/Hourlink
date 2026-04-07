import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/BottomSheet";
import { ClientBadge } from "@/components/ClientBadge";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { TimerWidget } from "@/components/TimerWidget";
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

function TimeEntryCard({ entry, onDelete }: { entry: TimeEntry; onDelete: () => void }) {
  const colors = useColors();
  const { clients, settings } = useApp();
  const client = clients.find((c) => c.id === entry.clientId);
  const earned = entry.endTime ? ((entry.durationSeconds / 3600) * entry.hourlyRate).toFixed(0) : null;

  return (
    <View style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
          <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
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
        {entry.invoiceId && (
          <View style={[styles.tagBadge, { backgroundColor: "#10b98118" }]}>
            <Text style={[styles.tagText, { color: "#10b981" }]}>Invoiced</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function WorkScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    clients, timeEntries, activeTimer,
    startTimer, stopTimer, deleteTimeEntry, addInvoice, updateTimeEntry, settings, companyProfile,
  } = useApp();

  const [showStart, setShowStart] = useState(false);
  const [showQuickInvoice, setShowQuickInvoice] = useState(false);
  const [stoppedEntry, setStoppedEntry] = useState<TimeEntry | null>(null);
  const [desc, setDesc] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || "");
  const [billable, setBillable] = useState(true);
  const [filter, setFilter] = useState<"all" | "billable" | "unbilled">("all");

  const filteredEntries = useMemo(() =>
    timeEntries.filter((e) => e.endTime).filter((e) => {
      if (filter === "billable") return e.billable;
      if (filter === "unbilled") return e.billable && !e.invoiceId;
      return true;
    }), [timeEntries, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const entry of filteredEntries) {
      const key = formatDate(entry.startTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries()).map(([date, entries]) => ({ date, entries }));
  }, [filteredEntries]);

  const handleStop = () => {
    if (activeTimer && activeTimer.billable) {
      const now = Date.now();
      const durationSeconds = Math.floor((now - new Date(activeTimer.startTime).getTime()) / 1000);
      setStoppedEntry({ ...activeTimer, endTime: new Date().toISOString(), durationSeconds });
      setShowQuickInvoice(true);
    }
    stopTimer();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleQuickInvoice = () => {
    if (!stoppedEntry) return;
    const hours = stoppedEntry.durationSeconds / 3600;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
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
    updateTimeEntry(stoppedEntry.id, { invoiceId });
    setShowQuickInvoice(false);
    setStoppedEntry(null);
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

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Time Tracking</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { if (!activeTimer) setShowStart(true); else handleStop(); }}
          testID="start-timer-btn"
        >
          <Ionicons name={activeTimer ? "stop" : "add"} size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {activeTimer && (
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <TimerWidget />
        </View>
      )}

      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {(["all", "billable", "unbilled"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterLabel, { color: filter === f ? colors.primary : colors.mutedForeground }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {grouped.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No time entries"
          description={activeTimer ? "Timer is running." : "Start tracking your work time."}
          actionLabel={activeTimer ? undefined : "Start Timer"}
          onAction={activeTimer ? undefined : () => setShowStart(true)}
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
                  onDelete={() => Alert.alert("Delete Entry", "Remove this time entry?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteTimeEntry(entry.id) },
                  ])}
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
            {/* Header */}
            <View style={[styles.quickInvIcon, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="timer-outline" size={30} color={colors.primary} />
            </View>
            <Text style={[styles.quickInvTitle, { color: colors.foreground }]}>Timer Stopped</Text>

            {/* Summary pill */}
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

            <View style={styles.divider} />

            {/* Actions */}
            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.primary }]}
              onPress={handleQuickInvoice}
              testID="quick-invoice-now"
            >
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={[styles.actionRowText, { color: "#fff" }]}>Invoice Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.muted }]}
              onPress={handleResume}
              testID="resume-timer"
            >
              <Ionicons name="play-outline" size={18} color={colors.foreground} />
              <Text style={[styles.actionRowText, { color: colors.foreground }]}>Resume Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionRowOutline, { borderColor: colors.border }]}
              onPress={handleInvoiceLater}
              testID="invoice-later"
            >
              <Ionicons name="time-outline" size={18} color={colors.mutedForeground} />
              <Text style={[styles.actionRowText, { color: colors.mutedForeground }]}>Invoice Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomSheet visible={showStart} onClose={() => setShowStart(false)} title="Start Timer">
        <FormField label="What are you working on?" placeholder="e.g., Website redesign, Client meeting" value={desc} onChangeText={setDesc} />
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Client</Text>
        <View style={styles.clientList}>
          {clients.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.clientChip, { backgroundColor: selectedClientId === c.id ? c.color + "22" : colors.muted, borderColor: selectedClientId === c.id ? c.color : "transparent", borderWidth: 1 }]}
              onPress={() => setSelectedClientId(c.id)}
            >
              <ClientBadge name={c.name} color={c.color} size="sm" />
              <Text style={[styles.chipLabel, { color: colors.foreground }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
          {clients.length === 0 && <Text style={[styles.noClient, { color: colors.mutedForeground }]}>No clients yet</Text>}
        </View>
        <View style={styles.billableRow}>
          <Text style={[styles.billableLabel, { color: colors.foreground }]}>Billable</Text>
          <TouchableOpacity style={[styles.toggle, { backgroundColor: billable ? colors.primary : colors.muted }]} onPress={() => setBillable((v) => !v)}>
            <View style={[styles.toggleThumb, { transform: [{ translateX: billable ? 20 : 0 }] }]} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.primary }]} onPress={handleStartTimer} testID="confirm-start-timer">
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={styles.startBtnText}>Start Timer</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  filterRow: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20 },
  filterTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  filterLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
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
  tagBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8, letterSpacing: 0.3 },
  clientList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  clientChip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  noClient: { fontSize: 13, fontFamily: "Inter_400Regular" },
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
});
