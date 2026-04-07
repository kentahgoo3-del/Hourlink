import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClientBadge } from "@/components/ClientBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Period = "week" | "month" | "quarter" | "year";

function formatCurrency(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatHours(seconds: number) {
  const h = seconds / 3600;
  return `${h.toFixed(1)}h`;
}

function getPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    return d;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

function MiniBar({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.min(100, percent * 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { clients, timeEntries, invoices, settings } = useApp();
  const [period, setPeriod] = useState<Period>("month");

  const periodStart = useMemo(() => getPeriodStart(period), [period]);

  const periodEntries = useMemo(() =>
    timeEntries.filter((e) => e.endTime && new Date(e.startTime) >= periodStart),
    [timeEntries, periodStart]
  );

  const periodInvoices = useMemo(() =>
    invoices.filter((inv) => inv.status === "paid" && new Date(inv.paidAt || inv.createdAt) >= periodStart),
    [invoices, periodStart]
  );

  const totalSeconds = useMemo(() =>
    periodEntries.reduce((s, e) => s + e.durationSeconds, 0),
    [periodEntries]
  );

  const billableSeconds = useMemo(() =>
    periodEntries.filter((e) => e.billable).reduce((s, e) => s + e.durationSeconds, 0),
    [periodEntries]
  );

  const totalRevenue = useMemo(() =>
    periodInvoices.reduce((sum, inv) => {
      const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
      return sum + sub * (1 + inv.taxPercent / 100);
    }, 0),
    [periodInvoices]
  );

  const avgHourlyRate = useMemo(() => {
    if (billableSeconds === 0) return 0;
    const billable = periodEntries.filter((e) => e.billable);
    const totalEarnable = billable.reduce((s, e) => s + (e.durationSeconds / 3600) * e.hourlyRate, 0);
    const billHours = billableSeconds / 3600;
    return billHours > 0 ? totalEarnable / billHours : 0;
  }, [periodEntries, billableSeconds]);

  const clientBreakdown = useMemo(() => {
    const map = new Map<string, { seconds: number; earned: number }>();
    for (const e of periodEntries) {
      const cur = map.get(e.clientId) || { seconds: 0, earned: 0 };
      cur.seconds += e.durationSeconds;
      if (e.billable) cur.earned += (e.durationSeconds / 3600) * e.hourlyRate;
      map.set(e.clientId, cur);
    }
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data, client: clients.find((c) => c.id === id) }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [periodEntries, clients]);

  const maxSeconds = Math.max(1, ...clientBreakdown.map((c) => c.seconds));

  const invoiceStatus = useMemo(() => {
    const all = invoices.filter((inv) => new Date(inv.createdAt) >= periodStart);
    const paid = all.filter((inv) => inv.status === "paid").length;
    const sent = all.filter((inv) => inv.status === "sent").length;
    const overdue = all.filter((inv) => inv.status === "overdue").length;
    const draft = all.filter((inv) => inv.status === "draft").length;
    return { total: all.length, paid, sent, overdue, draft };
  }, [invoices, periodStart]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPadding + 16, paddingBottom: botPadding + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>Reports</Text>

      {/* Period Selector */}
      <View style={[styles.periodRow, { backgroundColor: colors.muted }]}>
        {(["week", "month", "quarter", "year"] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && { backgroundColor: colors.primary }]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodLabel, { color: period === p ? "#fff" : colors.mutedForeground }]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.summaryLabel}>Revenue</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalRevenue, settings.currency)}</Text>
          <Text style={styles.summarySub}>{periodInvoices.length} paid invoices</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Hours</Text>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>{formatHours(totalSeconds)}</Text>
          <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>
            {formatHours(billableSeconds)} billable
          </Text>
        </View>
      </View>
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Avg Rate</Text>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>
            {formatCurrency(avgHourlyRate, settings.currency)}/h
          </Text>
          <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>blended rate</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Utilization</Text>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>
            {totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 100) : 0}%
          </Text>
          <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>billable ratio</Text>
        </View>
      </View>

      {/* Client Breakdown */}
      {clientBreakdown.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hours by Client</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {clientBreakdown.map((item, idx) => (
              <View
                key={item.id}
                style={[styles.clientRow, idx < clientBreakdown.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                {item.client && <ClientBadge name={item.client.name} color={item.client.color} size="sm" />}
                <View style={styles.clientMid}>
                  <View style={styles.clientNameRow}>
                    <Text style={[styles.clientName, { color: colors.foreground }]}>{item.client?.name || "Unknown"}</Text>
                    <Text style={[styles.clientHours, { color: colors.foreground }]}>{formatHours(item.seconds)}</Text>
                  </View>
                  <MiniBar percent={item.seconds / maxSeconds} color={item.client?.color || colors.primary} />
                  <Text style={[styles.clientEarned, { color: colors.mutedForeground }]}>
                    {formatCurrency(item.earned, settings.currency)} earned
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Invoice Status */}
      {invoiceStatus.total > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Invoice Status</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: "Paid", count: invoiceStatus.paid, color: "#10b981" },
              { label: "Sent", count: invoiceStatus.sent, color: "#3b82f6" },
              { label: "Overdue", count: invoiceStatus.overdue, color: "#ef4444" },
              { label: "Draft", count: invoiceStatus.draft, color: "#94a3b8" },
            ].map((row, idx) => (
              <View
                key={row.label}
                style={[styles.statusRow, idx < 3 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <View style={[styles.statusDot, { backgroundColor: row.color }]} />
                <Text style={[styles.statusLabel, { color: colors.foreground }]}>{row.label}</Text>
                <Text style={[styles.statusCount, { color: colors.foreground }]}>{row.count}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {totalSeconds === 0 && totalRevenue === 0 && (
        <View style={styles.emptyWrap}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No data yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Start tracking time and sending invoices to see your reports.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 20 },
  periodRow: { flexDirection: "row", borderRadius: 12, padding: 4, marginBottom: 20 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  periodLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  summaryGrid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
  },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  summaryValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 4 },
  summarySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 24, marginBottom: 12 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  clientRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  clientMid: { flex: 1 },
  clientNameRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  clientName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  clientHours: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  clientEarned: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: "#e2e8f0", overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  statusCount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
