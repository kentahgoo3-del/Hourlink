import { AppIcon } from "@/components/AppIcon";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClientBadge } from "@/components/ClientBadge";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { TimerWidget } from "@/components/TimerWidget";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatCurrency(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatHours(seconds: number) {
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    clients, timeEntries, invoices, quotes, settings,
    getUnbilledAmount, getOutstandingAmount, getMonthRevenue,
    getBillingAlerts, getCashFlowForecast, getLastTimerSuggestion,
    activeTimers, startTimer, stopTimer, pauseTimer, resumeTimer,
  } = useApp();
  const runningTimer = activeTimers.find((t) => !t.timerPaused) || null;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const weekSeconds = useMemo(() =>
    timeEntries.filter((e) => e.endTime && new Date(e.startTime) >= weekStart)
      .reduce((s, e) => s + e.durationSeconds, 0), [timeEntries]);

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekSeconds = useMemo(() =>
    timeEntries.filter((e) => e.endTime && new Date(e.startTime) >= prevWeekStart && new Date(e.startTime) < weekStart)
      .reduce((s, e) => s + e.durationSeconds, 0), [timeEntries]);

  const monthRevenue = getMonthRevenue();
  const profitGoalPct = settings.profitGoal > 0 ? Math.min(1, monthRevenue / settings.profitGoal) : 0;

  const topClients = useMemo(() =>
    clients.map((c) => ({
      ...c,
      revenue: invoices.filter((inv) => inv.clientId === c.id && inv.status === "paid")
        .reduce((sum, inv) => {
          const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
          return sum + sub * (1 + inv.taxPercent / 100);
        }, 0),
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 3),
    [clients, invoices]);

  const recentInvoices = useMemo(() => invoices.slice(0, 3), [invoices]);
  const billingAlerts = useMemo(() => getBillingAlerts().slice(0, 2), [getBillingAlerts]);
  const cashFlow = useMemo(() => getCashFlowForecast().slice(0, 3), [getCashFlowForecast]);
  const suggestions = useMemo(() => getLastTimerSuggestion(), [getLastTimerSuggestion]);

  const weekDiff = weekSeconds - prevWeekSeconds;
  const weekDiffLabel = prevWeekSeconds > 0
    ? `${weekDiff >= 0 ? "+" : ""}${(weekDiff / 3600).toFixed(1)}h vs last week`
    : undefined;

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPadding + 16, paddingBottom: botPadding + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/images/hourlink_icon.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting}</Text>
            <Text style={[styles.name, { color: colors.foreground }]}>{settings.name || "HourLink"}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/settings")}
          testID="settings-btn"
        >
          <AppIcon name="settings-outline" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Profitability Goal */}
      {settings.profitGoal > 0 && (
        <View style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.goalRow}>
            <Text style={[styles.goalLabel, { color: colors.foreground }]}>Monthly Goal</Text>
            <Text style={[styles.goalPct, { color: colors.primary }]}>{Math.round(profitGoalPct * 100)}%</Text>
          </View>
          <View style={[styles.goalTrack, { backgroundColor: colors.muted }]}>
            <View style={[styles.goalFill, { width: `${profitGoalPct * 100}%` as any, backgroundColor: profitGoalPct >= 1 ? "#10b981" : colors.primary }]} />
          </View>
          <Text style={[styles.goalSub, { color: colors.mutedForeground }]}>
            {formatCurrency(monthRevenue, settings.currency)} of {formatCurrency(settings.profitGoal, settings.currency)} this month
          </Text>
        </View>
      )}

      {/* Smart Suggestions — hide cards already running, keep the rest visible */}
      {(() => {
        const visibleSuggestions = suggestions.filter((s) =>
          !activeTimers.some(
            (t) => t.resumeEntryId === s.entryId ||
              (!t.resumeEntryId && t.description === s.description && t.clientId === s.clientId)
          )
        );
        if (visibleSuggestions.length === 0) return null;
        return (
          <View style={styles.suggestionsWrapper}>
            <Text style={[styles.suggestionsHeader, { color: colors.mutedForeground }]}>
              {visibleSuggestions.length === 1 ? "Resume where you left off?" : "Resume recent timers"}
            </Text>
            {visibleSuggestions.map((s, i) => (
              <TouchableOpacity
                key={s.entryId}
                style={[
                  styles.suggestionCard,
                  { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" },
                  i > 0 && { marginTop: 8 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  startTimer({
                    clientId: s.clientId,
                    projectId: "",
                    description: s.description,
                    hourlyRate: s.hourlyRate || s.client?.hourlyRate || settings.defaultHourlyRate,
                    billable: true,
                    resumeEntryId: s.entryId,
                  });
                }}
                testID={i === 0 ? "smart-suggestion" : `smart-suggestion-${i}`}
              >
                <View style={styles.suggestionLeft}>
                  <AppIcon name="flash" size={16} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestionSub, { color: colors.foreground, fontWeight: "600" }]} numberOfLines={1}>
                      {s.description || "Last session"}
                    </Text>
                    <Text style={[styles.suggestionSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {s.client?.name || "No client"}
                    </Text>
                  </View>
                </View>
                <AppIcon name="play-circle" size={26} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        );
      })()}

      {/* Active Timers */}
      {activeTimers.map((timer) => (
        <TimerWidget
          key={timer.id}
          timer={timer}
          onStop={() => stopTimer(timer.id)}
          onPause={() => pauseTimer(timer.id)}
          onResume={() => resumeTimer(timer.id)}
        />
      ))}

      {/* Billing Alerts */}
      {billingAlerts.length > 0 && (
        <View style={[styles.alertCard, { backgroundColor: "#f59e0b18", borderColor: "#f59e0b50" }]}>
          <View style={styles.alertHeader}>
            <AppIcon name="alert-circle" size={18} color="#f59e0b" />
            <Text style={[styles.alertTitle, { color: colors.foreground }]}>Unbilled work waiting</Text>
          </View>
          {billingAlerts.map((alert) => (
            <TouchableOpacity
              key={alert.clientId}
              style={styles.alertRow}
              onPress={() => router.push("/finance")}
            >
              <ClientBadge name={alert.clientName} color={alert.clientColor} size="sm" />
              <Text style={[styles.alertText, { color: colors.foreground }]} numberOfLines={1}>
                {alert.clientName} — {alert.unbilledHours.toFixed(1)}h ({alert.daysSinceBilled}d old)
              </Text>
              <Text style={[styles.alertAmount, { color: "#f59e0b" }]}>
                {settings.currency}{alert.unbilledAmount.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* KPI Row */}
      <View style={styles.kpiRow}>
        <StatCard label="This week" value={formatHours(weekSeconds)} sub={weekDiffLabel} color={colors.primary} />
        <StatCard label="This month" value={formatCurrency(monthRevenue, settings.currency)} sub="revenue" color="#10b981" />
      </View>
      <View style={[styles.kpiRow, { marginTop: 10 }]}>
        <StatCard label="Unbilled" value={formatCurrency(getUnbilledAmount(), settings.currency)} sub="ready to invoice" color="#f59e0b" />
        <StatCard label="Outstanding" value={formatCurrency(getOutstandingAmount(), settings.currency)} sub="awaiting payment" color="#ef4444" />
      </View>

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/work"); }}
          testID="quick-timer"
        >
          <AppIcon name="timer-outline" size={22} color="#fff" />
          <Text style={styles.quickLabel}>New Timer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/finance"); }}
          testID="quick-invoice"
        >
          <AppIcon name="document-text-outline" size={22} color={colors.foreground} />
          <Text style={[styles.quickLabel, { color: colors.foreground }]}>New Invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/clients"); }}
          testID="quick-client"
        >
          <AppIcon name="person-add-outline" size={22} color={colors.foreground} />
          <Text style={[styles.quickLabel, { color: colors.foreground }]}>Add Client</Text>
        </TouchableOpacity>
      </View>

      {/* Cash Flow Forecast */}
      {cashFlow.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Expected Income</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cashFlowHeader}>
              <AppIcon name="trending-up" size={16} color="#10b981" />
              <Text style={[styles.cashFlowTotal, { color: "#10b981" }]}>
                {formatCurrency(cashFlow.reduce((s, c) => s + c.amount, 0), settings.currency)} forecasted
              </Text>
            </View>
            {cashFlow.map((item, idx) => (
              <View key={item.label} style={[styles.cashRow, idx < cashFlow.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.cashLabel, { color: colors.foreground }]}>{item.clientName}</Text>
                  <Text style={[styles.cashDue, { color: colors.mutedForeground }]}>
                    Due {new Date(item.dueDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                  </Text>
                </View>
                <Text style={[styles.cashAmount, { color: colors.foreground }]}>
                  {formatCurrency(item.amount, settings.currency)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Top Clients */}
      {topClients.filter((c) => c.revenue > 0).length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Top Clients</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {topClients.filter((c) => c.revenue > 0).map((c, idx) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.clientRow, idx < topClients.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={() => router.push({ pathname: "/client/[id]", params: { id: c.id } })}
              >
                <ClientBadge name={c.name} color={c.color} />
                <View style={styles.clientInfo}>
                  <Text style={[styles.clientName, { color: colors.foreground }]}>{c.name}</Text>
                  <Text style={[styles.clientSub, { color: colors.mutedForeground }]}>{c.company}</Text>
                </View>
                <Text style={[styles.clientRevenue, { color: colors.foreground }]}>
                  {formatCurrency(c.revenue, settings.currency)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Recent Invoices */}
      {recentInvoices.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Recent Invoices</Text>
            <TouchableOpacity onPress={() => router.push("/finance")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {recentInvoices.map((inv, idx) => {
              const client = clients.find((c) => c.id === inv.clientId);
              const total = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) * (1 + inv.taxPercent / 100);
              return (
                <TouchableOpacity
                  key={inv.id}
                  style={[styles.invoiceRow, idx < recentInvoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => router.push({ pathname: "/invoice/[id]", params: { id: inv.id } })}
                >
                  <View style={styles.invoiceInfo}>
                    <Text style={[styles.invoiceNum, { color: colors.foreground }]}>{inv.invoiceNumber}</Text>
                    <Text style={[styles.invoiceClient, { color: colors.mutedForeground }]}>{client?.name || "Unknown"}</Text>
                  </View>
                  <View style={styles.invoiceRight}>
                    <Text style={[styles.invoiceAmount, { color: colors.foreground }]}>{formatCurrency(total, settings.currency)}</Text>
                    <StatusBadge status={inv.status} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerLogo: { width: 101, height: 101, borderRadius: 25 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold", marginTop: 2 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  goalCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  goalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  goalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  goalPct: { fontSize: 16, fontFamily: "Inter_700Bold" },
  goalTrack: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  goalFill: { height: 6, borderRadius: 3 },
  goalSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  suggestionsWrapper: { marginBottom: 16 },
  suggestionsHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  suggestionCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1, padding: 14 },
  suggestionLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  suggestionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  suggestionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  alertCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  alertTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  alertText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  alertAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  kpiRow: { flexDirection: "row", gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 24, marginBottom: 12 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12 },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },
  quickRow: { flexDirection: "row", gap: 10 },
  quickBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", gap: 6 },
  quickLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#fff", textAlign: "center" },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cashFlowHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  cashFlowTotal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cashRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  cashLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  cashDue: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cashAmount: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  clientRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  clientSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  clientRevenue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  invoiceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  invoiceInfo: { flex: 1 },
  invoiceNum: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  invoiceClient: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  invoiceRight: { alignItems: "flex-end", gap: 4 },
  invoiceAmount: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
